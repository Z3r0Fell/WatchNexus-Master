@echo off
title WatchNexus Server
echo ================================================
echo  WatchNexus v2.7.3 - Self-Hosted Media Pipeline
echo ================================================
echo.
echo Starting WatchNexus on http://localhost:8001 ...
echo.
set ASPNETCORE_URLS=http://0.0.0.0:8001
WatchNexus.Core.exe
pause
