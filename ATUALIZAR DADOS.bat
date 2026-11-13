@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Atualizar dados do Painel Gerencial
cd /d "%~dp0"

echo.
echo  ===========================================================
echo    ATUALIZAR DADOS DO PAINEL GERENCIAL
echo    Importa as O.S e o financeiro do Shop9
echo  ===========================================================
echo.

rem ---- le o endereco do Shop9 do .env.local, em vez de fixar aqui ----
set "HOST="
set "PORTA=2500"
for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env.local") do (
  if /i "%%A"=="SHOP9_SQL_HOST" set "HOST=%%B"
  if /i "%%A"=="SHOP9_SQL_PORT" set "PORTA=%%B"
)
rem tira espacos e quebra de linha que possam vir junto
for /f "tokens=* delims= " %%H in ("!HOST!") do set "HOST=%%H"
set "HOST=!HOST: =!"
set "PORTA=!PORTA: =!"

if "!HOST!"=="" (
  echo  [ERRO] Nao encontrei SHOP9_SQL_HOST no arquivo .env.local.
  echo         Verifique se o arquivo esta na mesma pasta deste atalho.
  goto :fim
)

echo  Procurando o servidor do Shop9 em !HOST!:!PORTA! ...
powershell -NoProfile -Command "exit [int](-not (Test-NetConnection -ComputerName '!HOST!' -Port !PORTA! -InformationLevel Quiet -WarningAction SilentlyContinue))"
if errorlevel 1 (
  echo.
  echo  [NAO CONECTOU] O servidor do Shop9 nao respondeu.
  echo.
  echo  Quase sempre e a VPN do escritorio desligada.
  echo  Ligue o Radmin VPN, espere ficar verde e rode este atalho de novo.
  echo.
  goto :fim
)
echo  Servidor encontrado. Iniciando a importacao...
echo.

if not exist logs mkdir logs
set "LOG=logs\sync-shop9.log"
echo.>> "%LOG%"
echo ======================================================>> "%LOG%"
echo Inicio (manual): %date% %time%>> "%LOG%"

rem Grava a saida num arquivo temporario e so depois mostra. Nao use
rem PowerShell com Tee-Object aqui: ele trata cada linha de stderr do npm
rem como erro e devolve codigo 1 mesmo quando a importacao deu certo.
echo  Importando... isso leva cerca de 40 segundos.
echo.
set "TMPSAIDA=%TEMP%\sync-shop9-saida.txt"
call "C:\Program Files\nodejs\npm.cmd" run sync-shop9 > "%TMPSAIDA%" 2>&1
set CODIGO=%errorlevel%
type "%TMPSAIDA%"
type "%TMPSAIDA%" >> "%LOG%"
del "%TMPSAIDA%" 2>nul

echo Fim (manual): %date% %time%  (codigo de saida: %CODIGO%)>> "%LOG%"
echo.
if "%CODIGO%"=="0" (
  echo  ===========================================================
  echo    PRONTO. Os dados do painel foram atualizados.
  echo    Recarregue a pagina do Painel Gerencial para ver.
  echo  ===========================================================
) else (
  echo  ===========================================================
  echo    [FALHOU] A importacao nao terminou (codigo %CODIGO%^).
  echo    O detalhe do erro esta em: logs\sync-shop9.log
  echo  ===========================================================
)

:fim
echo.
echo  Pressione qualquer tecla para fechar.
pause >nul
endlocal
