"""Extração de frames e estimativa de altura da vegetação por frame.

Usa o YOLOv8-Seg treinado (backend/app/models/best.pt) quando o arquivo está
presente. Sem o arquivo, cai no placeholder por densidade de pixels verdes
(HSV) para o pipeline continuar funcionando ponta a ponta.

A conversão máscara -> centímetros ainda é uma aproximação pela área da
máscara no frame (mesma escala do placeholder anterior), não a fórmula de
calibração real do Colab — isso fica para quando essa fórmula for definida.
"""

from pathlib import Path

import cv2
import numpy as np

MODEL_PATH = Path(__file__).parent / "models" / "best.pt"

_model = None
_model_load_attempted = False


def _get_model():
    """Carrega o YOLOv8-Seg sob demanda. Devolve None se o .pt não existir."""
    global _model, _model_load_attempted
    if _model_load_attempted:
        return _model
    _model_load_attempted = True
    if MODEL_PATH.exists():
        from ultralytics import YOLO

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


def estimate_height_cm(frame: np.ndarray) -> float:
    """Estima altura em cm a partir da vegetação detectada no frame.

    Usa o YOLOv8-Seg quando o modelo está disponível (cobertura da máscara
    de segmentação); cai no placeholder por densidade de verde (HSV) caso
    contrário.
    """
    model = _get_model()
    if model is not None:
        return _estimate_height_from_segmentation(model, frame)
    return _estimate_height_from_green_density(frame)


def _estimate_height_from_segmentation(model, frame: np.ndarray) -> float:
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
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lower_green = np.array([35, 40, 40])
    upper_green = np.array([85, 255, 255])
    mask = cv2.inRange(hsv, lower_green, upper_green)

    green_ratio = float(np.count_nonzero(mask)) / mask.size
    height_cm = round(green_ratio * 35, 1)
    return height_cm


LIMIAR_CRITICO_CM = 30
LIMIAR_ALERTA_CM = 20


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
