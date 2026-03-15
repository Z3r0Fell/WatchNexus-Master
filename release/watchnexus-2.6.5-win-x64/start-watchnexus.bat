@echo off
title WatchNexus Server
echo ================================================
echo  WatchNexus v2.6.5 - Self-Hosted Media Pipeline
echo  QA: https://z3r0fell.github.io/watchnexus-qa/
echo ================================================
echo.
echo Starting WatchNexus on http://localhost:8001 ...
echo.
set ASPNETCORE_URLS=http://0.0.0.0:8001
WatchNexus.Core.exe
pause
