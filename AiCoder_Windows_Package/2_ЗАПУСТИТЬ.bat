@echo off
chcp 65001 >nul
title AiCoder - Запуск
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Сначала нужно выполнить установку.
    echo Запустите файл "1_УСТАНОВИТЬ.bat"
    echo.
    pause
    exit /b 1
)

if not exist "source\frontend\dist\index.html" (
    echo Не найден собранный frontend.
    echo В этой папке должен быть готовый комплект приложения.
    echo.
    pause
    exit /b 1
)

call ".venv\Scripts\activate.bat"

echo.
echo Запускаю AiCoder...
echo Если браузер не открылся автоматически, откройте адрес:
echo http://127.0.0.1:9080
echo.

python "source\backend_py\run_local.py" --dir "%cd%\source"
exit /b %errorlevel%
