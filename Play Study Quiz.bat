@echo off
title Study Quiz Game
cd /d "%~dp0"

echo Starting Study Quiz...
echo.

:: Try Python first (most common)
where python >nul 2>nul
if %errorlevel%==0 (
    start http://localhost:8000
    python -m http.server 8000
    goto :end
)

:: Try Python3
where python3 >nul 2>nul
if %errorlevel%==0 (
    start http://localhost:8000
    python3 -m http.server 8000
    goto :end
)

:: Try Node.js npx serve
where npx >nul 2>nul
if %errorlevel%==0 (
    start http://localhost:3000
    npx serve -l 3000
    goto :end
)

:: Nothing found
echo.
echo ERROR: Could not find Python or Node.js installed.
echo.
echo Please install one of these:
echo   - Python: https://www.python.org/downloads/
echo   - Node.js: https://nodejs.org/
echo.
pause

:end
