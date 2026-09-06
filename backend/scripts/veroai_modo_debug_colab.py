import cv2
import numpy as np
import os
import glob
from ultralytics import YOLO

# 1. Configurações dos arquivos
caminho_video_entrada = '/content/video_teste_grama.MOV' # Mantenha o nome do seu vídeo aqui
caminho_video_saida = '/content/veroai_modo_debug.mp4'

# 2. Limite da área de análise: até 4 metros depois da pista
# Marque em um frame do vídeo (abra a imagem e veja o pixel Y de cada ponto):
#   P_PISTA_Y = pixel Y onde termina a pista (mais embaixo na imagem)
#   P_4M_Y    = pixel Y do ponto 4 metros depois da pista (mais em cima)
P_PISTA_Y = 650   # <-- AJUSTE conforme o seu vídeo
P_4M_Y = 480      # <-- AJUSTE conforme o seu vídeo

if not os.path.exists(caminho_video_entrada):
    print("❌ Ei! Faça o upload do vídeo de teste no Colab!")
else:
    # 3. Carrega o modelo de segmentação mais recente
    caminho_modelo = glob.glob('/content/runs/**/best.pt', recursive=True)[-1]
    best_model = YOLO(caminho_modelo)
    print(f"✅ Modelo carregado: {caminho_modelo}")

    # 4. Inicializa o vídeo
    cap = cv2.VideoCapture(caminho_video_entrada)
    largura = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    altura = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(caminho_video_saida, fourcc, fps, (largura, altura))

    # Máscara da área liberada para a IA: do topo do frame até a borda da pista
    roi_mask = np.zeros((altura, largura), dtype=np.uint8)
    roi_mask[0:P_PISTA_Y, :] = 1

    print(f"🎬 Iniciando processamento COM LIMITE DE 4m ({total_frames} frames)...")

    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # Roda a IA com confiança baixa para não deixar escapar nada
        results = best_model(frame, conf=0.10, verbose=False)

        houve_deteccao = False

        for r in results:
            if r.masks is not None:
                grama_total_mask = np.zeros((altura, largura), dtype=np.uint8)

                # Junta todas as máscaras de grama que a IA achou na tela toda
                for mask in r.masks.data:
                    m = cv2.resize(mask.cpu().numpy(), (largura, altura))
                    grama_total_mask = np.logical_or(grama_total_mask, m > 0)

                # Aplica o limite de 4 metros: só considera grama dentro da faixa liberada
                grama_total_mask = np.logical_and(grama_total_mask, roi_mask)

                if grama_total_mask.any():
                    houve_deteccao = True
                    # Pinta de verde só o que estiver dentro do limite
                    frame[grama_total_mask] = frame[grama_total_mask] * 0.5 + np.array((0, 255, 0)) * 0.5

        # Desenha as linhas de referência do limite
        cv2.line(frame, (0, P_PISTA_Y), (largura, P_PISTA_Y), (0, 255, 255), 2)
        cv2.putText(frame, "BORDA DA PISTA", (20, P_PISTA_Y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

        cv2.line(frame, (0, P_4M_Y), (largura, P_4M_Y), (0, 165, 255), 2)
        cv2.putText(frame, "LIMITE DE 4m", (20, P_4M_Y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)

        # Cria o Painel de Debug no topo
        cv2.rectangle(frame, (10, 10), (700, 80), (0, 0, 0), -1)

        cv2.putText(frame, "VEROAI | MODO DEBUG (Limite 4m)", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        if houve_deteccao:
            cv2.putText(frame, "STATUS: IA DETECTOU VEGETACAO", (20, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        else:
            cv2.putText(frame, "STATUS: NENHUMA DETECCAO (CEGA)", (20, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        out.write(frame)

        if frame_count % 30 == 0:
            print(f"⏳ Processando... {frame_count}/{total_frames} frames concluídos.")

    cap.release()
    out.release()
    print("\n✅ VÍDEO FINALIZADO!")
    print("👉 Baixe o arquivo 'veroai_modo_debug.mp4' e veja onde a IA está focando.")
