@echo off
title BATALHA AEREA v1.0 - MULTIPLAYER
color 0B
cd /d "%~dp0"

echo ================================================
echo     BATALHA AEREA MULTIPLAYER - v1.0
echo ================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado! Instale em https://nodejs.org/
    pause
    exit /b
)

if not exist "server.js" (
    echo [ERRO] Nao encontrei server.js!
    pause
    exit /b
)

if not exist "node_modules" (
    echo [1/5] Instalando dependencias pela primeira vez...
    call npm install
)

echo [2/5] Parando processos anteriores...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cloudflared-windows-amd64.exe >nul 2>&1
timeout /t 2 >nul

echo [3/5] Iniciando servidor Node.js (PORT 3001)...
start "Plane Server" /min node --no-warnings server.js

echo Aguardando servidor iniciar...
set /a count=0
:check_server
timeout /t 1 >nul
set /a count+=1
netstat -an | find "127.0.0.1:3001" >nul
if %errorlevel% equ 0 goto server_ready
if %count% lss 30 goto check_server
echo [AVISO] Servidor nao respondeu em 30 segundos, mas vamos tentar continuar...
:server_ready

echo [4/5] Escolha o modo de execucao:
echo     [1] Com Cloudflare Tunnel (publico)
echo     [2] Apenas local (http://localhost:3001)
echo.
set /p modo="Digite 1 ou 2: "

if "%modo%"=="2" goto local_mode
if "%modo%"=="1" goto tunnel_mode

echo Opcao invalida. Saindo.
pause
exit /b

:local_mode
echo.
echo ================================================
echo         SERVIDOR LOCAL INICIADO
echo ================================================
echo Acesse no navegador: http://localhost:3001
echo.
echo Pressione qualquer tecla para encerrar o servidor...
pause >nul
taskkill /f /im node.exe >nul 2>&1
echo Servidor encerrado.
exit /b

:tunnel_mode
if not exist "cloudflared-windows-amd64.exe" (
    echo [ERRO] cloudflared-windows-amd64.exe nao encontrado!
    echo Baixe de https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/local/
    pause
    exit /b
)

echo [5/5] Iniciando Cloudflare Tunnel...
echo.
echo ================================================
echo         LINK PUBLICO PARA ACESSO
echo ================================================
echo AGUARDE... O TUNNEL ESTA SENDO CRIADO
echo.
"cloudflared-windows-amd64.exe" tunnel --url http://127.0.0.1:3001

echo.
echo Tunnel encerrado. Deseja encerrar o servidor Node.js? (S/N)
set /p resp=
if /i "%resp%"=="S" taskkill /f /im node.exe >nul 2>&1
pause
