# Pendências e roteiro da entrega

> Anotações internas do grupo que ficavam no README (o que falta, roteiro do vídeo, entrega no Portal do Aluno). O resumo do projeto está no [README principal](../README.md).

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
