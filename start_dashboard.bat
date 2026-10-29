@echo off
echo ============================================================
echo Starting Panopticon EDR Backend & Console Services
echo ============================================================

set PANOPTICON_MANAGER_TOKEN=mock-analyst-token

echo [*] Starting Spring Boot Java Backend on Port 8788...
start "Panopticon Java Backend" cmd /k "cd /d %~dp0backend && gradlew.bat bootRun"

timeout /t 5 /nobreak >nul

echo [*] Starting Panopticon Web Console on Port 8787...
start "Panopticon Console" cmd /k "cd /d %~dp0console && python app.py --manager-url http://127.0.0.1:8788 --alerts-file alerts.ndjson"

echo [✓] Services launched! Navigate to: http://127.0.0.1:8787/#overview
pause
