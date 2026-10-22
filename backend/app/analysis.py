"""Extração de frames e estimativa de altura da vegetação por frame.

Ordem de prioridade da inferência (vídeo, /api/process-video):
1. Roboflow (inferência hospedada) — se ROBOFLOW_API_KEY e as demais
   variáveis de ambiente estiverem configuradas.
2. YOLOv8-Seg local (backend/app/models/best.pt) — se o arquivo existir.
3. Placeholder por densidade de pixels verdes (HSV) — sempre disponível,
   garante que o pipeline funciona ponta a ponta mesmo sem nenhum modelo.

A conversão máscara -> centímetros ainda é uma aproximação pela área da
máscara no frame (mesma escala do placeholder anterior), não a fórmula de
calibração real do Colab — isso fica para quando essa fórmula for definida.

Para foto avulsa (/api/analisar-foto), ver `analisar_foto_com_regua` —
caminho separado que chama a API própria da Mirella (roda no notebook
dela, mede por régua física na cena em vez de estimativa de cobertura).
"""

import base64
import os
import tempfile
from pathlib import Path

import cv2
import numpy as np
import requests

MODEL_PATH = Path(__file__).parent / "models" / "best.pt"

_roboflow_model = None
_roboflow_load_attempted = False

_model = None
_model_load_attempted = False


def _get_roboflow_model():
    """Carrega o modelo hospedado no Roboflow sob demanda. Devolve None se
    as variáveis de ambiente não estiverem todas configuradas.

    Lê os.environ dentro da função (não no nível do módulo) para não
    depender da ordem de import — db.py chama load_dotenv(), mas se este
    módulo for importado antes disso, ler as variáveis no import as
    congelaria como None permanentemente."""
    global _roboflow_model, _roboflow_load_attempted
    if _roboflow_load_attempted:
        return _roboflow_model
    _roboflow_load_attempted = True

    api_key = os.environ.get("ROBOFLOW_API_KEY")
    workspace = os.environ.get("ROBOFLOW_WORKSPACE")
    project_name = os.environ.get("ROBOFLOW_PROJECT")
    version = os.environ.get("ROBOFLOW_VERSION")

    if all([api_key, workspace, project_name, version]):
        from roboflow import Roboflow

        rf = Roboflow(api_key=api_key)
        project = rf.workspace(workspace).project(project_name)
        _roboflow_model = project.version(int(version)).model
    return _roboflow_model


def _get_model():
    """Carrega o YOLOv8-Seg local sob demanda. Devolve None se o .pt não existir."""
    global _model, _model_load_attempted
    if _model_load_attempted:
        return _model
    _model_load_attempted = True
    if MODEL_PATH.exists():
        try:
            from ultralytics import YOLO
        except ImportError:
            # Instalação local mínima (requirements-local.txt) não traz
            # ultralytics/torch: cai para a estimativa HSV.
            return None

        _model = YOLO(str(MODEL_PATH))
    return _model


def extract_frames(video_path: str, interval_seconds: float = 2.0):
    """Extrai um frame a cada `interval_seconds` do vídeo."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_interval = max(1, int(fps * interval_seconds))

    frames = []
    frame_idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_idx % frame_interval == 0:
            timestamp_s = frame_idx / fps
            frames.append((timestamp_s, frame))
        frame_idx += 1

    cap.release()
    return frames


AREA_INTERESSE_FRACAO_INFERIOR = 0.35
# Suposição de calibração: numa câmera veicular apontada para frente, a
# vegetação do acostamento aparece na faixa inferior do quadro — o resto é
# pista e céu, que não deveriam contar na cobertura. Sem recortar essa área,
# a % de vegetação fica artificialmente baixa mesmo com grama alta, porque é
# diluída pelo frame inteiro. Ajustar esta fração quando houver um vídeo de
# referência real com o ângulo de câmera definitivo da Motiva.


def _recortar_area_interesse(frame: np.ndarray) -> np.ndarray:
    altura = frame.shape[0]
    y_inicio = int(altura * (1 - AREA_INTERESSE_FRACAO_INFERIOR))
    return frame[y_inicio:, :]


def estimate_height_cm(frame: np.ndarray) -> float:
    """Estima altura em cm a partir da vegetação detectada no frame.

    Ordem de tentativa: Roboflow (hospedado) -> YOLOv8-Seg local -> HSV.
    """
    roboflow_model = _get_roboflow_model()
    if roboflow_model is not None:
        return _estimate_height_from_roboflow(roboflow_model, frame)

    model = _get_model()
    if model is not None:
        return _estimate_height_from_segmentation(model, frame)

    return _estimate_height_from_green_density(frame)


def _estimate_height_from_roboflow(model, frame: np.ndarray) -> float:
    """Manda o frame pra inferência hospedada no Roboflow e converte o
    polígono de segmentação retornado numa máscara, na mesma escala usada
    pelo YOLOv8-Seg local (coverage_ratio * 35cm)."""
    frame = _recortar_area_interesse(frame)
    height, width = frame.shape[:2]

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        cv2.imwrite(tmp.name, frame)
        tmp_path = tmp.name

    try:
        prediction = model.predict(tmp_path, confidence=10, overlap=30).json()
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    combined = np.zeros((height, width), dtype=np.uint8)
    for pred in prediction.get("predictions", []):
        points = pred.get("points")
        if not points:
            continue
        polygon = np.array([[p["x"], p["y"]] for p in points], dtype=np.int32)
        cv2.fillPoly(combined, [polygon], 1)

    coverage_ratio = float(np.count_nonzero(combined)) / combined.size
    return round(coverage_ratio * 35, 1)


def _estimate_height_from_segmentation(model, frame: np.ndarray) -> float:
    frame = _recortar_area_interesse(frame)
    height, width = frame.shape[:2]
    results = model(frame, conf=0.10, verbose=False)

    coverage_ratio = 0.0
    for r in results:
        if r.masks is None:
            continue
        combined = np.zeros((height, width), dtype=bool)
        for mask in r.masks.data:
            m = cv2.resize(mask.cpu().numpy(), (width, height))
            combined |= m > 0
        coverage_ratio = float(np.count_nonzero(combined)) / combined.size
        break

    # mapeamento provisório: cobertura da máscara -> cm (0 a 35cm), faixa
    # realista de vegetação de acostamento. Substituir quando a fórmula real
    # de calibração (área de interesse dos 4m do acostamento) estiver definida.
    return round(coverage_ratio * 35, 1)


def _estimate_height_from_green_density(frame: np.ndarray) -> float:
    frame = _recortar_area_interesse(frame)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lower_green = np.array([35, 40, 40])
    upper_green = np.array([85, 255, 255])
    mask = cv2.inRange(hsv, lower_green, upper_green)

    green_ratio = float(np.count_nonzero(mask)) / mask.size
    height_cm = round(green_ratio * 35, 1)
    return height_cm


LIMIAR_CRITICO_CM = 30
LIMIAR_ALERTA_CM = 10


def classify_status(height_cm: float) -> tuple[str, str]:
    if height_cm >= LIMIAR_CRITICO_CM:
        return "CRITICO", "vermelho"
    if height_cm >= LIMIAR_ALERTA_CM:
        return "ALERTA", "amarelo"
    return "OK", "verde"


# Ordem de prioridade para o cronograma de roçada: crítico primeiro.
STATUS_PRIORITY = {"CRITICO": 0, "ALERTA": 1, "OK": 2}

# Taxa de crescimento assumida para a previsão preventiva (cm/dia). É uma
# suposição para demonstração — sem dado de campo real de crescimento ainda.
# Ajustar quando houver leituras repetidas do mesmo trecho ao longo do tempo.
TAXA_CRESCIMENTO_CM_DIA = 0.5


def prever_dias_ate_critico(altura_atual_cm: float) -> int | None:
    """Estima em quantos dias o trecho cruzaria o limiar CRÍTICO, assumindo
    a taxa de crescimento acima. Devolve 0 se já está crítico."""
    if altura_atual_cm >= LIMIAR_CRITICO_CM:
        return 0
    import math

    return math.ceil((LIMIAR_CRITICO_CM - altura_atual_cm) / TAXA_CRESCIMENTO_CM_DIA)


# Altura representativa por severidade, só para manter compatibilidade com
# o resto do sistema (Dashboard, Cronograma etc. esperam average_height_cm
# numérico). A API da Mirella não devolve centímetro exato — ela classifica
# por zona comparando com a régua física (10cm/30cm na cena), então usamos
# o ponto médio de cada zona na mesma escala 0-35cm já usada no resto do app.
ALTURA_REPRESENTATIVA_POR_SEVERIDADE = {"ok": 5.0, "alerta": 20.0, "critico": 35.0}

SEVERIDADE_PARA_STATUS = {"ok": "OK", "alerta": "ALERTA", "critico": "CRITICO"}
SEVERIDADE_PARA_COR = {"ok": "verde", "alerta": "amarelo", "critico": "vermelho"}


class ErroAnaliseFoto(Exception):
    """Levantado quando a API da Mirella processa a foto mas não consegue
    classificar (sem régua visível, sem vegetação etc — HTTP 422 dela)."""


def analisar_foto_com_regua(
    conteudo_bytes: bytes,
    filename: str,
    lat: float | None = None,
    lon: float | None = None,
) -> dict | None:
    """Manda a foto pra API da Mirella (roda no notebook dela, na mesma
    rede) e devolve o resultado já traduzido pro formato do VeroAI.

    Devolve None se MIRELLA_API_URL não estiver configurada (endpoint
    principal cai de volta pra estimate_height_cm) ou se a API dela estiver
    fora do ar (notebook desligado/rede caiu) — nesse caso loga o motivo
    mas não derruba o request do usuário.

    Levanta ErroAnaliseFoto se a API respondeu mas não conseguiu classificar
    a foto (ex: régua não encontrada) — esse erro deve virar HTTP 422 pro
    cliente, com a mensagem explicando o que fazer.
    """
    base_url = os.environ.get("MIRELLA_API_URL")
    if not base_url:
        return None

    try:
        resp = requests.post(
            f"{base_url.rstrip('/')}/analisar-foto",
            files={"arquivo": (filename, conteudo_bytes)},
            data={
                "lat": lat,
                "lon": lon,
                "incluir_imagem": "true",
            },
            timeout=30,
        )
        resp.raise_for_status()
    except requests.RequestException:
        import logging

        logging.exception("Falha ao chamar a API da Mirella (%s)", base_url)
        return None

    dados = resp.json()
    if not dados.get("sucesso"):
        raise ErroAnaliseFoto(dados.get("erro", "Não foi possível analisar a foto."))

    severidade = dados["severidade"]
    return {
        "height_cm": ALTURA_REPRESENTATIVA_POR_SEVERIDADE.get(severidade, 0.0),
        "status": SEVERIDADE_PARA_STATUS.get(severidade, "OK"),
        "color": SEVERIDADE_PARA_COR.get(severidade, "verde"),
        "rotulo": dados.get("rotulo"),
        "motivo": dados.get("motivo"),
        "imagem_anotada_base64": dados.get("imagem_anotada_base64"),
    }
