@echo off
setlocal
title IPPO Typing - close this window to stop

rem Use the tools installed in the existing ippo conda environment.
set "IPPO_ENV=%USERPROFILE%\miniconda3\envs\ippo"
set "IPPO_PNPM=%IPPO_ENV%\pnpm.cmd"

if not exist "%IPPO_ENV%\node.exe" (
  echo Node.js was not found in the ippo environment.
  goto :failed
)
if not exist "%IPPO_PNPM%" (
  echo pnpm was not found in the ippo environment.
  goto :failed
)

pushd "%~dp0"
if errorlevel 1 goto :failed
if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies are missing. Run pnpm install in this folder first.
  popd
  goto :failed
)

set "PATH=%IPPO_ENV%;%IPPO_ENV%\Library\bin;%PATH%"
echo Starting IPPO Typing. Keep this window open while using the app.
echo Close this window or press Ctrl+C to stop the server.
call "%IPPO_PNPM%" dev --host localhost --open
set "IPPO_EXIT_CODE=%ERRORLEVEL%"
popd
if not "%IPPO_EXIT_CODE%"=="0" goto :failed
exit /b 0

:failed
echo.
echo Could not start IPPO Typing. Please share the message above.
pause
exit /b 1
