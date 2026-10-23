@echo off
setlocal
cd /d "%~dp0"

REM Roda o VeroAI inteiro (API + site) em localhost, sem Supabase/Railway/Vercel.
REM Requisitos: Python 3.10+ e Node.js 20+ instalados (com "Add to PATH").

where python >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Python nao encontrado. Instale em https://www.python.org/downloads/ marcando "Add python.exe to PATH".
  pause & exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org/
  pause & exit /b 1
)

REM Forca o banco local (SQLite) mesmo que exista DATABASE_URL no ambiente.
set "DATABASE_URL="
set "NEXT_PUBLIC_API_URL=http://localhost:8000"

if not exist backend\venv\Scripts\python.exe (
  echo [1/4] Criando ambiente Python...
  python -m venv backend\venv || (pause & exit /b 1)
)

echo [2/4] Instalando dependencias da API (so na primeira vez demora)...
backend\venv\Scripts\python.exe -m pip install -q -r backend\requirements-local.txt || (pause & exit /b 1)

if not exist backend\data\veroai.db (
  echo [3/4] Criando banco local com dados de exemplo...
  pushd backend
  venv\Scripts\python.exe scripts\seed_exemplos.py
  venv\Scripts\python.exe scripts\seed_mensagens.py
  popd
) else (
  echo [3/4] Banco local ja existe.
)

if not exist frontend\node_modules (
  echo [4/4] Instalando dependencias do site, so na primeira vez demora...
  pushd frontend
  call npm install || (popd & pause & exit /b 1)
  popd
) else (
  echo [4/4] Dependencias do site ja instaladas.
)

start "VeroAI - API (porta 8000)" cmd /k "cd /d %~dp0backend && venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"
start "VeroAI - Site (porta 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Aguardando o site subir...
timeout /t 20 /nobreak >nul
start http://localhost:3000
echo.
echo Pronto. Para encerrar, feche as duas janelas pretas (API e Site).
endlocal
