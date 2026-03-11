#!/bin/bash
# WatchNexus .NET 8 API Startup Script
export PATH="/opt/dotnet:$PATH"
export DOTNET_ROOT="/opt/dotnet"

cd /app/src/dotnet/src/WatchNexus.API

# Kill any existing process on 8001
fuser -k 8001/tcp 2>/dev/null
sleep 1

# Build and run
dotnet build --configuration Release --no-restore -q 2>/dev/null
exec dotnet run --configuration Release --no-build
