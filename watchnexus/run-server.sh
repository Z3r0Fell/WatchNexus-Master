#!/bin/bash
export DOTNET_ROOT=/opt/dotnet
export PATH=$PATH:/opt/dotnet
export JELLYFIN_DATA_DIR=/var/lib/watchnexus/data
export JELLYFIN_CONFIG_DIR=/var/lib/watchnexus/config
export JELLYFIN_LOG_DIR=/var/lib/watchnexus/log
export JELLYFIN_CACHE_DIR=/var/lib/watchnexus/cache
export JELLYFIN_FFMPEG=/usr/bin/ffmpeg

cd /app/watchnexus/server
dotnet run --project Jellyfin.Server --configuration Release -- --webdir /app/watchnexus/web/dist
