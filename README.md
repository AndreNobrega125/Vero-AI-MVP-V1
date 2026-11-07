# VeroAI Web

Protótipo web que estima a **altura da vegetação às margens de rodovias** a partir de um vídeo gravado em campo. Cada vídeo é processado quadro a quadro, a altura é estimada em centímetros e o resultado alimenta um dashboard, para priorizar a roçada nos trechos críticos em vez de percorrer a rodovia inteira. Feito para o Challenge Motiva (FIAP).

Site publicado: [vero-ai-mvp-v1.vercel.app](https://vero-ai-mvp-v1.vercel.app)

## O que ele faz

1. O usuário envia um vídeo em `/processar`.
2. O backend extrai um frame a cada 2 segundos com OpenCV.
3. Cada frame passa pela estimativa de altura da vegetação.
4. As leituras e a média do trecho são gravadas em SQLite.
5. O site mostra o resultado e mantém o histórico em `/dashboard`, com KPIs, filtros e leituras por trecho.

| Rota | Descrição |
| --- | --- |
| `/` | Identificação da equipe |
| `/processar` | Upload do vídeo, processamento e resultado da análise |
| `/dashboard` | Plataforma de dados: KPIs, filtros e histórico por trecho |

## Estado atual

O pipeline funciona ponta a ponta: um teste real com vídeo gerou 5 leituras, média de 37 cm, status ALERTA, gravou no banco e apareceu no dashboard.

**Ressalva importante:** `backend/app/analysis.py` ainda **não usa o YOLOv8-Seg**. Hoje ele usa uma estimativa provisória por densidade de pixels verdes (HSV), então os números exibidos ainda não vêm do modelo treinado. A troca fica isolada na função `estimate_height_cm()`. As pendências estão em [docs/PENDENCIAS.md](docs/PENDENCIAS.md).

## Tecnologias

- **Backend:** Python, FastAPI, OpenCV, SQLite
- **Frontend:** Next.js, TypeScript

## Como rodar

### Backend

```bash
cd backend
python -m venv venv
venv/Scripts/python.exe -m pip install -r requirements.txt
venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

API em `http://localhost:8000` (documentação interativa em `/docs`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Site em `http://localhost:3000`. Se a API estiver em outro endereço, defina `NEXT_PUBLIC_API_URL` antes de iniciar o frontend.

## Estrutura

```
backend/    API FastAPI: extração de frames, estimativa de altura, persistência
frontend/   Site Next.js: identificação da equipe, teste do protótipo, dashboard
docs/       Pendências e roteiro da entrega
```

## Decisões de projeto

Contexto para quem for mexer no código:

- **Upload de vídeo em vez de câmera ao vivo.** A captura em tempo real dependia
  de conexão móvel estável em um carro em movimento na rodovia. Se a conexão
  caísse durante a gravação, perderíamos a filmagem e precisaríamos voltar ao
  local. Com upload, filmamos sem depender de nada e processamos depois com wifi,
  quantas vezes for necessário.
- **Site web em vez de app React Native nativo.** Cabe no prazo do Challenge e já
  cumpre o requisito de demonstrar a plataforma de dados. A arquitetura permite
  construir o app nativo depois consumindo a mesma API, sem reescrever o backend.
- **Um frame a cada 2 segundos, não vídeo contínuo.** A vegetação não muda em
  1/30 de segundo. Processar 30fps seria custo computacional sem ganho de precisão.
- **Backend separado do frontend.** O site não sabe nada de IA — só faz uma
  requisição HTTP e desenha o resultado. Todo o processamento pesado fica isolado
  no Python.
- **SQLite para persistência.** O edital exige mostrar "dados coletados e
  disponibilizados" e "possibilidades de consulta". Sem gravar os resultados, cada
  análise se perderia e não haveria dashboard para apresentar.

## Time

André Nobrega, André Gouveia, Caio Carminato, Guilherme Tamai, Mirella Mascarenhas e Vitor Komura.
