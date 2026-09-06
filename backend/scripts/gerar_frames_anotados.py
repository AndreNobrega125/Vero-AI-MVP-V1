"""Gera frames anotados mostrando a área de interesse e a vegetação
detectada pelo placeholder (densidade de verde), para apresentação/demo.

Uso:
    venv/Scripts/python.exe scripts/gerar_frames_anotados.py <video> <pasta_saida>
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np

from app.analysis import (
    AREA_INTERESSE_FRACAO_INFERIOR,
    _estimate_height_from_green_density,
    classify_status,
    extract_frames,
)


def anotar_frame(frame: np.ndarray, height_cm: float, status: str) -> np.ndarray:
    anotado = frame.copy()
    altura_total = frame.shape[0]
    y_linha = int(altura_total * (1 - AREA_INTERESSE_FRACAO_INFERIOR))

    # Linha marcando o início da área de interesse
    cv2.line(anotado, (0, y_linha), (frame.shape[1], y_linha), (0, 200, 255), 2)
    cv2.putText(anotado, "AREA DE INTERESSE (acostamento)", (10, y_linha - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 2)

    # Destaca em verde o que o placeholder detecta como vegetação, só na área de interesse
    recorte = anotado[y_linha:, :]
    hsv = cv2.cvtColor(recorte, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([35, 40, 40]), np.array([85, 255, 255]))
    overlay = recorte.copy()
    overlay[mask > 0] = (0, 255, 0)
    recorte[:] = cv2.addWeighted(recorte, 0.5, overlay, 0.5, 0)

    # Painel de info
    cv2.rectangle(anotado, (10, 10), (620, 80), (0, 0, 0), -1)
    cv2.putText(anotado, "VEROAI | ANALISE (placeholder por densidade de verde)", (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cor_status = {"OK": (0, 255, 0), "ALERTA": (0, 200, 255), "CRITICO": (0, 0, 255)}[status]
    cv2.putText(anotado, f"Altura estimada: {height_cm}cm | Status: {status}", (20, 65),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, cor_status, 2)
    return anotado


def main():
    if len(sys.argv) < 3:
        print("Uso: gerar_frames_anotados.py <video> <pasta_saida>")
        return
    video_path = sys.argv[1]
    pasta_saida = Path(sys.argv[2])
    pasta_saida.mkdir(parents=True, exist_ok=True)

    frames = extract_frames(video_path, interval_seconds=2.0)
    print(f"{len(frames)} frames extraídos.")

    for timestamp_s, frame in frames:
        height_cm = _estimate_height_from_green_density(frame)
        status, _ = classify_status(height_cm)
        anotado = anotar_frame(frame, height_cm, status)
        nome = pasta_saida / f"frame_{timestamp_s:.0f}s.jpg"
        cv2.imwrite(str(nome), anotado)
        print(f"{timestamp_s:.0f}s -> {height_cm}cm ({status}) -> {nome}")


if __name__ == "__main__":
    main()
