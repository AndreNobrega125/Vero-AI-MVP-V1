import shutil
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import db
from .analysis import (
    extract_frames,
    estimate_height_cm,
    classify_status,
    prever_dias_ate_critico,
    STATUS_PRIORITY,
)

app = FastAPI(title="VeroAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db.init_db()

VIDEOS_DIR = Path(__file__).resolve().parent.parent / "data" / "videos"


def _clear_previous_videos() -> None:
    """Apaga o vídeo salvo do processamento anterior, se existir."""
    if not VIDEOS_DIR.exists():
        return
    for old_file in VIDEOS_DIR.iterdir():
        if old_file.is_file():
            old_file.unlink(missing_ok=True)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/process-video")
async def process_video(
    file: UploadFile = File(...),
    km_inicio: Optional[float] = Form(None),
    km_fim: Optional[float] = Form(None),
    nome_trecho: Optional[str] = Form(None),
):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Envie um arquivo de vídeo")

    _clear_previous_videos()

    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    video_id = None
    try:
        frames = extract_frames(tmp_path, interval_seconds=2.0)
        if not frames:
            raise HTTPException(status_code=422, detail="Não foi possível ler frames do vídeo")

        readings = []
        for timestamp_s, frame in frames:
            height_cm = estimate_height_cm(frame)
            status, color = classify_status(height_cm)
            readings.append(
                {"timestamp_s": round(timestamp_s, 1), "height_cm": height_cm, "status": status, "color": color}
            )

        average_height_cm = round(sum(r["height_cm"] for r in readings) / len(readings), 1)
        overall_status, overall_color = classify_status(average_height_cm)

        conn = db.get_connection()
        cur = conn.execute(
            "INSERT INTO videos (filename, average_height_cm, status, km_inicio, km_fim, nome_trecho, is_exemplo) "
            "VALUES (?, ?, ?, ?, ?, ?, 0)",
            (file.filename, average_height_cm, overall_status, km_inicio, km_fim, nome_trecho),
        )
        video_id = cur.lastrowid
        conn.executemany(
            "INSERT INTO readings (video_id, timestamp_s, height_cm, status, color) VALUES (?, ?, ?, ?, ?)",
            [(video_id, r["timestamp_s"], r["height_cm"], r["status"], r["color"]) for r in readings],
        )
        conn.commit()
        conn.close()

        return {
            "video_id": video_id,
            "filename": file.filename,
            "nome_trecho": nome_trecho,
            "average_height_cm": average_height_cm,
            "status": overall_status,
            "color": overall_color,
            "km_inicio": km_inicio,
            "km_fim": km_fim,
            "readings": readings,
        }
    finally:
        if video_id is not None:
            VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
            stored_path = VIDEOS_DIR / f"{video_id}{Path(file.filename).suffix}"
            shutil.move(tmp_path, stored_path)
        else:
            Path(tmp_path).unlink(missing_ok=True)


def _com_previsao(video: dict) -> dict:
    """Anexa a previsão preventiva (dias/data até cruzar o limiar crítico)."""
    dias = prever_dias_ate_critico(video["average_height_cm"])
    video["previsao_dias_ate_critico"] = dias
    video["previsao_data_critico"] = (
        (datetime.now() + timedelta(days=dias)).strftime("%Y-%m-%d") if dias else None
    )
    return video


@app.get("/api/videos")
def list_videos(km_ref: Optional[float] = None, raio_km: Optional[float] = None):
    conn = db.get_connection()
    rows = conn.execute("SELECT * FROM videos ORDER BY created_at DESC").fetchall()
    conn.close()
    videos = [_com_previsao(dict(row)) for row in rows]

    if km_ref is not None and raio_km is not None:
        videos = [v for v in videos if _distancia_do_ref(v, km_ref) is not None and _distancia_do_ref(v, km_ref) <= raio_km]

    return videos


def _distancia_do_ref(video: dict, km_ref: float) -> Optional[float]:
    """Distância (km) do ponto médio do trecho até uma referência na rodovia."""
    if video.get("km_inicio") is None or video.get("km_fim") is None:
        return None
    ponto_medio = (video["km_inicio"] + video["km_fim"]) / 2
    return abs(ponto_medio - km_ref)


class LocalizacaoUpdate(BaseModel):
    km_inicio: float
    km_fim: float


@app.patch("/api/videos/{video_id}/localizacao")
def set_localizacao(video_id: int, body: LocalizacaoUpdate):
    conn = db.get_connection()
    video = conn.execute("SELECT id FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video:
        conn.close()
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")
    conn.execute(
        "UPDATE videos SET km_inicio = ?, km_fim = ? WHERE id = ?",
        (body.km_inicio, body.km_fim, video_id),
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    conn.close()
    return dict(updated)


@app.post("/api/videos/{video_id}/solicitar-rocada")
def solicitar_rocada(video_id: int):
    conn = db.get_connection()
    video = conn.execute("SELECT id FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video:
        conn.close()
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")
    agora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("UPDATE videos SET rocada_solicitada_em = ? WHERE id = ?", (agora, video_id))
    conn.commit()
    updated = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    conn.close()
    return _com_previsao(dict(updated))


@app.delete("/api/videos/{video_id}/solicitar-rocada")
def cancelar_solicitacao_rocada(video_id: int):
    conn = db.get_connection()
    video = conn.execute("SELECT id FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video:
        conn.close()
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")
    conn.execute("UPDATE videos SET rocada_solicitada_em = NULL WHERE id = ?", (video_id,))
    conn.commit()
    updated = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    conn.close()
    return _com_previsao(dict(updated))


class AgendamentoUpdate(BaseModel):
    data: str  # formato YYYY-MM-DD


@app.patch("/api/videos/{video_id}/agendar-rocada")
def agendar_rocada(video_id: int, body: AgendamentoUpdate):
    conn = db.get_connection()
    video = conn.execute("SELECT id FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video:
        conn.close()
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")
    conn.execute("UPDATE videos SET rocada_agendada_para = ? WHERE id = ?", (body.data, video_id))
    conn.commit()
    updated = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    conn.close()
    return _com_previsao(dict(updated))


@app.delete("/api/videos/{video_id}/agendar-rocada")
def cancelar_agendamento_rocada(video_id: int):
    conn = db.get_connection()
    video = conn.execute("SELECT id FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video:
        conn.close()
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")
    conn.execute("UPDATE videos SET rocada_agendada_para = NULL WHERE id = ?", (video_id,))
    conn.commit()
    updated = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    conn.close()
    return _com_previsao(dict(updated))


@app.get("/api/proximo-horario-disponivel")
def proximo_horario_disponivel():
    """Sugere a data livre mais próxima para agendar uma roçada urgente.

    Simulação para demonstração: considera só dias úteis (seg-sex) e assume
    uma única equipe (no máximo 1 roçada agendada por dia). Não é uma
    integração real com agenda de equipes da Motiva.
    """
    conn = db.get_connection()
    ocupados = {
        row["rocada_agendada_para"]
        for row in conn.execute(
            "SELECT rocada_agendada_para FROM videos WHERE rocada_agendada_para IS NOT NULL"
        )
    }
    conn.close()

    candidato = datetime.now().date() + timedelta(days=1)
    while candidato.weekday() >= 5 or candidato.strftime("%Y-%m-%d") in ocupados:
        candidato += timedelta(days=1)

    return {"data": candidato.strftime("%Y-%m-%d")}


@app.get("/api/cronograma")
def get_cronograma(max_km_dia: float = 20.0):
    """Sugestão de cronograma de roçada: prioriza trechos por criticidade
    (CRITICO > ALERTA > OK) e, dentro do mesmo nível, agrupa trechos próximos
    entre si em "dias" de trabalho para minimizar deslocamento."""
    conn = db.get_connection()
    rows = conn.execute(
        "SELECT * FROM videos WHERE km_inicio IS NOT NULL AND km_fim IS NOT NULL ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    videos = [dict(row) for row in rows]

    for v in videos:
        v["km_medio"] = (v["km_inicio"] + v["km_fim"]) / 2

    videos.sort(key=lambda v: (STATUS_PRIORITY.get(v["status"], len(STATUS_PRIORITY)), v["km_medio"]))

    cronograma = []
    dia = 0
    km_anterior = None
    prioridade_anterior = None
    for v in videos:
        prioridade = STATUS_PRIORITY.get(v["status"], len(STATUS_PRIORITY))
        distancia_anterior_km = None
        if km_anterior is None or prioridade != prioridade_anterior:
            dia += 1
            distancia_anterior_km = 0.0
        else:
            distancia_anterior_km = round(abs(v["km_medio"] - km_anterior), 1)
            if distancia_anterior_km > max_km_dia:
                dia += 1
                distancia_anterior_km = 0.0

        v = _com_previsao(v)
        cronograma.append(
            {
                "video_id": v["id"],
                "filename": v["filename"],
                "nome_trecho": v["nome_trecho"],
                "is_exemplo": bool(v["is_exemplo"]),
                "km_inicio": v["km_inicio"],
                "km_fim": v["km_fim"],
                "status": v["status"],
                "average_height_cm": v["average_height_cm"],
                "dia": dia,
                "distancia_anterior_km": distancia_anterior_km,
                "rocada_solicitada_em": v["rocada_solicitada_em"],
                "previsao_dias_ate_critico": v["previsao_dias_ate_critico"],
                "previsao_data_critico": v["previsao_data_critico"],
            }
        )
        km_anterior = v["km_medio"]
        prioridade_anterior = prioridade

    return {"max_km_dia": max_km_dia, "total_dias": dia, "cronograma": cronograma}


@app.get("/api/videos/{video_id}/readings")
def get_readings(video_id: int):
    conn = db.get_connection()
    video = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video:
        conn.close()
        raise HTTPException(status_code=404, detail="Vídeo não encontrado")
    rows = conn.execute("SELECT * FROM readings WHERE video_id = ? ORDER BY timestamp_s", (video_id,)).fetchall()
    conn.close()
    return {"video": dict(video), "readings": [dict(row) for row in rows]}
