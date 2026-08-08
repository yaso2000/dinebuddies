@echo off
REM Double-click or run: save.cmd
REM Optional message: save.cmd Fixed stage chat theme
cd /d "%~dp0"
call npm run save -- %*
if errorlevel 1 pause
