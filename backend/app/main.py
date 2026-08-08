import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .analysis import extract_frames, estimate_height_cm, classify_status

app = FastAPI(title="VeroAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db.init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/process-video")
async def process_video(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Envie um arquivo de vídeo")

    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

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
            "INSERT INTO videos (filename, average_height_cm, status) VALUES (?, ?, ?)",
            (file.filename, average_height_cm, overall_status),
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
            "average_height_cm": average_height_cm,
            "status": overall_status,
            "color": overall_color,
            "readings": readings,
        }
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.get("/api/videos")
def list_videos():
    conn = db.get_connection()
    rows = conn.execute("SELECT * FROM videos ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]


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
