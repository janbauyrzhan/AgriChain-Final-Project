@echo off
cd /d "%~dp0"
if not exist node_modules call npm ci
call npm test
pause
