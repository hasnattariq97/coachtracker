@echo off
REM Cleanup script for Coach Task Tracker - kills stuck Node processes
REM Usage: scripts\cleanup.cmd

echo.
echo ======================================
echo  Coach Task Tracker - System Cleanup
echo ======================================
echo.

echo [1/4] Checking for Node processes...
for /f "tokens=2" %%A in ('tasklist ^| find /c "node.exe"') do set NODE_COUNT=%%A

if "%NODE_COUNT%"=="0" (
    echo      ✓ No Node processes running
) else (
    echo      ⚠  Found %NODE_COUNT% Node process(es)
    echo      Killing all Node processes...
    taskkill /IM node.exe /F 2>nul
    if errorlevel 0 (
        echo      ✓ Node processes terminated
    )
)

echo.
echo [2/4] Waiting for cleanup (3 seconds)...
timeout /t 3 /nobreak

echo.
echo [3/4] Verifying cleanup...
for /f "tokens=2" %%A in ('tasklist ^| find /c "node.exe"') do set NODE_COUNT=%%A
if "%NODE_COUNT%"=="0" (
    echo      ✓ All Node processes cleaned
) else (
    echo      ⚠  %NODE_COUNT% process(es) still running (retry if persistent)
)

echo.
echo [4/4] Summary
echo      • Port 3001: Backend (must be restarted manually)
echo      • Port 5173: Frontend (must be restarted manually)
echo      • Database: server\tracker.db (untouched)
echo.
echo ======================================
echo  ✓ Cleanup complete
echo ======================================
echo.
echo Next steps:
echo   1. Open new terminal: cd d:\Cursor_new\server ^&^& node index.js
echo   2. Open another terminal: cd d:\Cursor_new\client ^&^& npm run dev
echo   3. Visit http://localhost:5173
echo.
pause
