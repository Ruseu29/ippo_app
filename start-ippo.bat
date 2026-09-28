@echo off
setlocal
title IPPO Typing - close this window to stop

rem Dependencies and build output stay in LocalAppData, outside Google Drive.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local-env.ps1" %*
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo Could not start IPPO Typing. Please share the message above.
pause
exit /b 1
