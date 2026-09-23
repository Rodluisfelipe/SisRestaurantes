@echo off
rem Lanza reiniciar-caja.ps1 aunque PowerShell tenga bloqueados los scripts.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0reiniciar-caja.ps1"
pause
