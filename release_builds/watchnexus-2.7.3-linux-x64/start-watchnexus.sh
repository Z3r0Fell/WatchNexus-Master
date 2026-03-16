#!/bin/bash
echo "=== WatchNexus v2.7.3 ==="
echo "Starting on http://localhost:8001..."
export ASPNETCORE_URLS="http://0.0.0.0:8001"
dotnet WatchNexus.Core.dll
