@echo off
REM ============================================================
REM deploy.bat — Run this before every upload to GitHub/server
REM It stamps sw.js with the current timestamp so cache busts
REM automatically on every deployment. No manual version bumping.
REM ============================================================

echo [Delivo Deploy] Stamping service worker with build timestamp...

REM Generate timestamp (YYYYMMDDHHMMSS format)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DT=%%I
set BUILD_TS=%DT:~0,14%

REM Replace __BUILD_TS__ in sw.js with actual timestamp
powershell -Command "(Get-Content sw.js) -replace '__BUILD_TS__', '%BUILD_TS%' | Set-Content sw.js"

echo [Delivo Deploy] sw.js stamped with: %BUILD_TS%
echo [Delivo Deploy] Now upload all files to GitHub Pages / your server.
echo [Delivo Deploy] Done!
pause