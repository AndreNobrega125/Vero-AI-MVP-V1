"""Popula o banco com trechos de EXEMPLO para demonstração (banca/vídeo).

Uso:
    venv/Scripts/python.exe scripts/seed_exemplos.py          # limpa e recria os exemplos
    venv/Scripts/python.exe scripts/seed_exemplos.py --clear  # só remove os exemplos

Os registros ficam marcados com is_exemplo=1 e aparecem no dashboard com um
badge "EXEMPLO", para não serem confundidos com o resultado real do vídeo
processado pelo modelo. Rodar de novo sempre que quiser resetar a demo.

Cada exemplo simula um vídeo de DURACAO_S segundos cobrindo o km_inicio–km_fim
inteiro, com uma leitura a cada 2s (mesmo intervalo do pipeline real).
"""

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import db  # noqa: E402
from app.analysis import classify_status  # noqa: E402

DURACAO_S = 60
INTERVALO_S = 2.0

EXEMPLOS = [
    {
        "nome_trecho": "Km 12 a 14 — BR-101 Norte",
        "filename": "exemplo_km12_14.mp4",
        "km_inicio": 12.0,
        "km_fim": 14.0,
        "media_alvo": 31.0,
        "amplitude": 3.0,
    },
    {
        "nome_trecho": "Km 30 a 31 — Acesso Industrial",
        "filename": "exemplo_km30_31.mp4",
        "km_inicio": 30.0,
        "km_fim": 31.0,
        "media_alvo": 21.5,
        "amplitude": 2.5,
    },
    {
        "nome_trecho": "Km 50 a 51 — Trevo Sul",
        "filename": "exemplo_km50_51.mp4",
        "km_inicio": 50.0,
        "km_fim": 51.0,
        "media_alvo": 6.8,
        "amplitude": 2.0,
    },
    {
        "nome_trecho": "Km 65 a 67 — Curva do Mirante",
        "filename": "exemplo_km65_67.mp4",
        "km_inicio": 65.0,
        "km_fim": 67.0,
        "media_alvo": 17.0,
        "amplitude": 2.5,
    },
]


def gerar_leituras_cm(media_alvo: float, amplitude: float, seed: int) -> list[float]:
    """Gera uma leitura a cada 2s ao longo de DURACAO_S, oscilando em torno
    da média alvo — simula variação natural da vegetação ao longo do trecho."""
    rng = random.Random(seed)
    timestamps = [t for t in range(0, DURACAO_S, int(INTERVALO_S))]
    leituras = []
    for t in timestamps:
        ruido = rng.uniform(-amplitude, amplitude)
        altura = max(1.0, round(media_alvo + ruido, 1))
        leituras.append(altura)
    return leituras


def clear_exemplos(conn):
    ids = [row["id"] for row in conn.execute("SELECT id FROM videos WHERE is_exemplo = 1")]
    if ids:
        placeholders = ",".join("?" for _ in ids)
        conn.execute(f"DELETE FROM readings WHERE video_id IN ({placeholders})", ids)
        conn.execute(f"DELETE FROM videos WHERE id IN ({placeholders})", ids)
    conn.commit()
    return len(ids)


def seed(conn):
    for i, exemplo in enumerate(EXEMPLOS):
        leituras_cm = gerar_leituras_cm(exemplo["media_alvo"], exemplo["amplitude"], seed=100 + i)

        readings = []
        for idx, height_cm in enumerate(leituras_cm):
            status, color = classify_status(height_cm)
            readings.append(
                {"timestamp_s": idx * INTERVALO_S, "height_cm": height_cm, "status": status, "color": color}
            )

        average_height_cm = round(sum(r["height_cm"] for r in readings) / len(readings), 1)
        overall_status, _ = classify_status(average_height_cm)

        cur = conn.execute(
            "INSERT INTO videos (filename, average_height_cm, status, km_inicio, km_fim, nome_trecho, is_exemplo) "
            "VALUES (?, ?, ?, ?, ?, ?, 1)",
            (
                exemplo["filename"],
                average_height_cm,
                overall_status,
                exemplo["km_inicio"],
                exemplo["km_fim"],
                exemplo["nome_trecho"],
            ),
        )
        video_id = cur.lastrowid
        conn.executemany(
            "INSERT INTO readings (video_id, timestamp_s, height_cm, status, color) VALUES (?, ?, ?, ?, ?)",
            [(video_id, r["timestamp_s"], r["height_cm"], r["status"], r["color"]) for r in readings],
        )
    conn.commit()


def main():
    db.init_db()
    conn = db.get_connection()
    removidos = clear_exemplos(conn)
    print(f"Removidos {removidos} exemplo(s) anterior(es).")

    if "--clear" not in sys.argv:
        seed(conn)
        print(f"Inseridos {len(EXEMPLOS)} trechos de exemplo ({DURACAO_S // int(INTERVALO_S)} leituras cada).")

    conn.close()


if __name__ == "__main__":
    main()
