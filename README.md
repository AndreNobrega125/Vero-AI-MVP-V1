# VeroAI — Challenge Motiva

Solução de visão computacional para estimar a altura da vegetação às margens de
rodovias. Um vídeo gravado em campo é processado quadro a quadro, a vegetação é
segmentada e a altura estimada em centímetros, permitindo priorizar a roçada nos
trechos críticos em vez de percorrer a rodovia inteira.

## Equipe

Grupo 19 — VeroAI *(número provisório, a confirmar com o professor)*

| Integrante | RM | Turma |
| --- | --- | --- |
| André Ayello de Nobrega | 561754 | CCPG |
| André Gouveia de Lima | 564219 | CCPO |
| Caio Castelão Carminato | 563630 | CCPG |
| Guilherme Vasques Tamai | 563276 | CCPG |
| Mirella Mascarenhas | 562092 | CCPG |
| Vitor Komura de Freitas | 563694 | CCPG |

## Estrutura

```
backend/    API FastAPI — extração de frames, estimativa de altura, persistência
frontend/   Site Next.js — identificação da equipe, teste do protótipo, dashboard
```

## Telas

| Rota | Descrição |
| --- | --- |
| `/` | Identificação da equipe |
| `/processar` | Upload do vídeo, processamento e resultado da análise |
| `/dashboard` | Plataforma de dados: KPIs, filtros e histórico por trecho |

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

Site em `http://localhost:3000`.

Se a API estiver em outro endereço, defina a variável de ambiente
`NEXT_PUBLIC_API_URL` antes de iniciar o frontend.

## Como funciona

1. O vídeo é enviado para `POST /api/process-video`.
2. O backend extrai um frame a cada 2 segundos com OpenCV.
3. Cada frame passa pela estimativa de altura da vegetação.
4. As leituras e a média do trecho são gravadas em SQLite (`backend/data/`).
5. O frontend exibe o resultado e mantém o histórico no dashboard.

## Estado atual

O pipeline está completo e funcional ponta a ponta: é possível subir um vídeo,
processá-lo, ver o resultado na tela e acompanhar o histórico no dashboard.

**O que já está pronto e testado**

- As três telas implementadas e renderizando (build de produção e typecheck passando)
- Backend processando vídeo de ponta a ponta e persistindo em SQLite
- Teste real executado: vídeo → 5 leituras → média 37 cm → status ALERTA → salvo → visível no dashboard

**A ressalva importante**

`backend/app/analysis.py` ainda **não usa o YOLOv8-Seg**. Ele usa uma estimativa
provisória baseada em densidade de pixels verdes (HSV). O fluxo todo funciona,
mas os números exibidos hoje ainda não vêm do nosso modelo treinado.

---

## O que ainda precisamos fazer

### 1. Integrar o modelo YOLOv8-Seg real — BLOQUEIO PRINCIPAL

É a única coisa que separa o protótipo de estar realmente pronto.

Precisamos de duas coisas vindas do Colab:

- O arquivo de pesos treinado (`.pt`)
- O trecho do código com a lógica de conversão para centímetros — o recorte da
  área de interesse (os 4 metros do acostamento) e o cálculo da altura a partir
  da máscara de segmentação

Com isso em mãos, a mudança acontece em um único arquivo:
`backend/app/analysis.py`, na função `estimate_height_cm()`. O resto do sistema
(extração de frames, banco, telas, dashboard) não muda em nada — foi construído
justamente para que a troca do modelo fosse isolada.

**Atenção ao ambiente:** o Python usado no desenvolvimento é o 3.14, e o
`ultralytics`/PyTorch pode ainda não ter build compatível com essa versão. Se a
instalação falhar, a solução é criar o venv do backend com Python 3.11 ou 3.12.

### 2. Confirmar o número do grupo com o professor

Está preenchido como **19**, mas ainda precisa ser confirmado. Se mudar, basta
editar `groupNumber` em `frontend/src/lib/team.ts`.

### 3. Gravar o vídeo de entrega

Máximo de 5 minutos, publicado no YouTube como "Não listado". Roteiro planejado:

**Bloco 1 — Identificação (~20s)**
Tela `/` em cheio: grupo, integrantes, RMs e turma.

**Bloco 2 — Testes do protótipo (~2min)**
- Filmagem em campo: o carro andando na rodovia, câmera apontada para o acostamento
- Corte para o Colab rodando o YOLOv8-Seg sobre esse vídeo, mostrando as máscaras
  de segmentação desenhadas sobre a vegetação (é a prova visual de que a IA é real)
- Corte para o site: abrir `/processar`, subir o mesmo vídeo, clicar em
  "Analisar vegetação" e mostrar o resultado aparecendo
- Se algo falhar, o edital **pede** que mostremos e expliquemos a limitação e como
  pretendemos superá-la. Não esconder.

**Bloco 3 — Plataforma de dados (~2min)**
Abrir `/dashboard`, mostrar os KPIs, filtrar por CRÍTICO para demonstrar a
consulta, clicar em uma linha para abrir as leituras daquele trecho, e fechar
explicando o uso prático pela Motiva.

**Detalhe da narração:** deixar explícito que os dados do dashboard vieram do
processamento do vídeo mostrado no bloco anterior. É isso que costura os blocos
2 e 3 e evita que o dashboard pareça enfeite.

### 4. Enviar no Portal do Aluno

Apenas um arquivo `.txt` contendo número do grupo, turma e o link do YouTube.
Não enviar o arquivo de vídeo.

### 5. Se sobrar tempo (opcional, não exigido pelo edital)

- **GPS → km da rodovia:** capturar a coordenada durante a filmagem e converter
  para quilometragem usando a fórmula de Haversine a partir de um ponto de
  referência. É matemática pura, não exige API externa nem chave de acesso.
- **Mapa no dashboard:** plotar os trechos críticos com Leaflet + OpenStreetMap
  (gratuito, sem necessidade de cadastro ou billing).

---

## Por que foi construído assim

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
