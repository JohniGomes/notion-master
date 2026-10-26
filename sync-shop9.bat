@echo off
rem ---------------------------------------------------------------
rem Importa as O.S do Shop9 para o Supabase.
rem Chamado pelo Agendador de Tarefas toda segunda-feira as 10h.
rem Precisa da VPN do escritorio ligada.
rem
rem Usa %~dp0 em vez do caminho escrito, porque a pasta tem acento
rem e o prompt do Windows nem sempre le acento corretamente.
rem ---------------------------------------------------------------
setlocal
cd /d "%~dp0"

if not exist logs mkdir logs
set LOG=logs\sync-shop9.log

echo.>> "%LOG%"
echo ======================================================>> "%LOG%"
echo Inicio: %date% %time%>> "%LOG%"

call "C:\Program Files\nodejs\npm.cmd" run sync-shop9 >> "%LOG%" 2>&1
set CODIGO=%errorlevel%

echo Fim: %date% %time%  (codigo de saida: %CODIGO%)>> "%LOG%"

rem mantem o log em no maximo ~2000 linhas
for /f %%A in ('find /c /v "" ^< "%LOG%"') do set LINHAS=%%A
if %LINHAS% GTR 2000 (
  more +1000 "%LOG%" > "%LOG%.tmp"
  move /y "%LOG%.tmp" "%LOG%" >nul
)

endlocal & exit /b %CODIGO%
