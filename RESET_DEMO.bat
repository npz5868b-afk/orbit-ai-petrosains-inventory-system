@echo off
title ORBIT AI Demo Reset
cd /d "%~dp0"

echo ==========================================
echo          ORBIT AI - DEMO RESET
echo ==========================================
echo.
echo WARNING:
echo This will reset the ORBIT demo database
echo and inventory state.
echo.
echo This does NOT modify:
echo - Source code
echo - AI model
echo - Training data
echo.
set /p CONFIRM=Type RESET to continue: 

if /I not "%CONFIRM%"=="RESET" (
    echo.
    echo Reset cancelled. Nothing was changed.
    pause
    exit /b 0
)

echo.
echo Resetting ORBIT demo data...
".venv\Scripts\python.exe" backend\scripts\reset_demo.py

if errorlevel 1 (
    echo.
    echo [ERROR] Demo reset failed.
    echo Check the message above before trying again.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo       ORBIT DEMO RESET COMPLETE
echo ==========================================
echo.
pause
