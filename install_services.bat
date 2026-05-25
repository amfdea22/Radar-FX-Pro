@echo off
title Radar-FX Auto-Install
cd /d "%~dp0"
%SYSTEMROOT%\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File "%~dp0install_services.ps1"
pause
