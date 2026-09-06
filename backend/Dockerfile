FROM python:3.13-slim

# Bibliotecas de sistema exigidas pelo opencv-python (mesmo sem uso de GUI,
# o binario importa esses .so em tempo de carregamento do modulo).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libxcb1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
