@echo off
chcp 65001 >nul
title AiCoder - Установка
cd /d "%~dp0"

echo.
echo ==============================
echo   AiCoder - Установка
echo ==============================
echo.

set "PYTHON_CMD="

where py >nul 2>nul
if %errorlevel%==0 set "PYTHON_CMD=py -3"

if not defined PYTHON_CMD (
    where python >nul 2>nul
    if %errorlevel%==0 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
    echo Python не найден.
    echo Установите Python 3.11+ и затем снова запустите этот файл.
    start "" "https://www.python.org/downloads/windows/"
    echo.
    pause
    exit /b 1
)

where git >nul 2>nul
if not %errorlevel%==0 (
    echo Git не найден.
    echo Установите Git и затем снова запустите этот файл.
    start "" "https://git-scm.com/download/win"
    echo.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo Создаю локальное окружение Python...
    %PYTHON_CMD% -m venv ".venv"
    if not %errorlevel%==0 (
        echo Не удалось создать виртуальное окружение.
        pause
        exit /b 1
    )
)

call ".venv\Scripts\activate.bat"

echo.
echo Обновляю pip...
python -m pip install --upgrade pip
if not %errorlevel%==0 (
    echo Не удалось обновить pip.
    pause
    exit /b 1
)

echo.
echo Устанавливаю зависимости AiCoder...
python -m pip install -r "source\backend_py\requirements.txt"
if not %errorlevel%==0 (
    echo Не удалось установить зависимости.
    pause
    exit /b 1
)

if not exist "source\projects" mkdir "source\projects"
if not exist "source\.aicoder" mkdir "source\.aicoder"

echo.
echo Установка завершена успешно.
echo Теперь можно запускать файл "2_ЗАПУСТИТЬ.bat"
echo.
pause
exit /b 0
