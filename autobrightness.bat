@echo off
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no esta instalado o no esta en el PATH.
    echo Por favor instala Node.js desde https://nodejs.org/ y vuelve a intentarlo.
    pause
    exit /b 1
)

node "%~dp0main.js"
pause