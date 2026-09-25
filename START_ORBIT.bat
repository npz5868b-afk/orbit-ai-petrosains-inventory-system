@echo off
title ORBIT AI Launcher
cd /d "%~dp0"

echo ==========================================
echo        ORBIT AI - STARTING SYSTEM
echo ==========================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Backend Python environment not found.
    pause
    exit /b 1
)

if not exist "backend\models\orbit_ai_5class_yolo11n_best.pt" (
    echo [ERROR] ORBIT AI model not found.
    pause
    exit /b 1
)

echo [1/2] Starting ORBIT Backend...
start "ORBIT Backend" cmd /k "set ORBIT_DETECTOR_MODE=real&& set ORBIT_MODEL_WEIGHTS=backend/models/orbit_ai_5class_yolo11n_best.pt&& set ORBIT_OCR_ENABLED=true&& .venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting ORBIT Frontend...
start "ORBIT Frontend" cmd /k "pnpm.cmd dev"

echo.
echo ==========================================
echo ORBIT AI launch commands sent.
echo Backend : http://127.0.0.1:8000
echo Frontend: http://localhost:3000
echo ==========================================
echo.
pause