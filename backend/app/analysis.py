"""Extração de frames e estimativa de altura da vegetação por frame.

A função estimate_height_cm é um placeholder até a Tarefa #6 (integrar o
YOLOv8-Seg real exportado do Colab). Por enquanto ela devolve uma estimativa
determinística baseada em densidade de pixels verdes, só para as telas e o
pipeline ponta a ponta funcionarem antes do modelo real entrar.
"""

import cv2
import numpy as np


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
    """Placeholder: estima altura em cm a partir da densidade de verde no frame.

    Será substituído pela segmentação YOLOv8-Seg + cálculo real (Tarefa #6).
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lower_green = np.array([35, 40, 40])
    upper_green = np.array([85, 255, 255])
    mask = cv2.inRange(hsv, lower_green, upper_green)

    green_ratio = float(np.count_nonzero(mask)) / mask.size
    # mapeamento simples: densidade de verde -> cm (0 a 80cm)
    height_cm = round(green_ratio * 80, 1)
    return height_cm


def classify_status(height_cm: float) -> tuple[str, str]:
    if height_cm >= 50:
        return "CRITICO", "vermelho"
    if height_cm >= 30:
        return "ALERTA", "amarelo"
    return "OK", "verde"
