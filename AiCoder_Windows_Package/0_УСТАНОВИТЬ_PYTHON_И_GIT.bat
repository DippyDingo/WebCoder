@echo off
chcp 65001 >nul
title AiCoder - Установка Python и Git
cd /d "%~dp0"

echo.
echo ==========================================
echo   AiCoder - Установка Python и Git
echo ==========================================
echo.

set "HAS_WINGET=0"
where winget >nul 2>nul
if %errorlevel%==0 set "HAS_WINGET=1"

set "HAS_PYTHON=0"
where py >nul 2>nul
if %errorlevel%==0 set "HAS_PYTHON=1"
if "%HAS_PYTHON%"=="0" (
    where python >nul 2>nul
    if %errorlevel%==0 set "HAS_PYTHON=1"
)

set "HAS_GIT=0"
where git >nul 2>nul
if %errorlevel%==0 set "HAS_GIT=1"

if "%HAS_PYTHON%"=="1" (
    echo Python уже установлен.
) else (
    echo Python не найден.
)

if "%HAS_GIT%"=="1" (
    echo Git уже установлен.
) else (
    echo Git не найден.
)

echo.

if "%HAS_PYTHON%"=="1" if "%HAS_GIT%"=="1" (
    echo Python и Git уже установлены.
    echo Можно сразу запускать "БЫСТРЫЙ_СТАРТ.bat"
    echo.
    pause
    exit /b 0
)

if "%HAS_WINGET%"=="1" (
    echo На компьютере найден winget.
    echo Сейчас будет выполнена установка недостающих программ.
    echo.

    if "%HAS_PYTHON%"=="0" (
        echo Устанавливаю Python...
        winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements
        echo.
    )

    if "%HAS_GIT%"=="0" (
        echo Устанавливаю Git...
        winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
        echo.
    )

    echo Установка через winget завершена.
    echo Если какая-то программа не установилась, можно повторить запуск этого файла или установить вручную.
    echo.
    pause
    exit /b 0
)

echo На этом компьютере не найден winget.
echo Сейчас откроются официальные страницы загрузки Python и Git.
echo.
start "" "https://www.python.org/downloads/windows/"
start "" "https://git-scm.com/download/win"
echo После установки Python и Git снова откройте "БЫСТРЫЙ_СТАРТ.bat"
echo.
pause
exit /b 0
