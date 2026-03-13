@echo off
chcp 65001 >nul
title AiCoder - Быстрый старт
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    call "%~dp01_УСТАНОВИТЬ.bat"
    if not %errorlevel%==0 exit /b 1
)

call "%~dp02_ЗАПУСТИТЬ.bat"
exit /b %errorlevel%
