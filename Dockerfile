# ══════════════════════════════════════════════════════════════════════
# WatchNexus — Multi-Tier Docker Build
# Build args: TIER=standard|pro|ultra (default: standard)
# ══════════════════════════════════════════════════════════════════════

# ── Stage 1: Frontend Build ──────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /build/frontend

COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile || yarn install

COPY frontend/ ./
# Empty backend URL = same-origin mode for standalone deployment
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# ── Stage 2: Backend Build ───────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
ARG TIER=standard
WORKDIR /build

# Copy solution + project files first (layer caching for restores)
COPY src/watchnexus/core/WatchNexus.Core.csproj src/watchnexus/core/
COPY src/watchnexus/shared/WatchNexus.Shared.csproj src/watchnexus/shared/
RUN dotnet restore src/watchnexus/core/WatchNexus.Core.csproj

# Copy shared code
COPY src/watchnexus/shared/ src/watchnexus/shared/

# Copy core code (everything except controllers — we'll selectively copy those)
COPY src/watchnexus/core/Program.cs src/watchnexus/core/
COPY src/watchnexus/core/Log.cs src/watchnexus/core/
COPY src/watchnexus/core/ModuleLoader.cs src/watchnexus/core/
COPY src/watchnexus/core/Fortress.cs src/watchnexus/core/
COPY src/watchnexus/core/appsettings.json src/watchnexus/core/
COPY src/watchnexus/core/Data/ src/watchnexus/core/Data/
COPY src/watchnexus/core/Auth/ src/watchnexus/core/Auth/
COPY src/watchnexus/core/Services/ src/watchnexus/core/Services/
COPY src/watchnexus/core/Middleware/ src/watchnexus/core/Middleware/
COPY src/watchnexus/core/Settings/ src/watchnexus/core/Settings/

# ── Tier-Based Controller Selection ─────────────────────────────────
# Standard controllers (always included)
COPY src/watchnexus/core/Controllers/CoreController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/ContentController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/BridgeController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/SettingsController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/FilesystemController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/LibrariesController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/SystemController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/WeatherController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/PodcastsController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/RadioController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/PhotosController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/WebVideoController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/SpotdlController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/UpdateController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/GadgetsCatalogueController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/CellarController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/FortressController.cs src/watchnexus/core/Controllers/
COPY src/watchnexus/core/Controllers/Helpers.cs src/watchnexus/core/Controllers/

# Use a script to conditionally copy Pro/Ultra controllers
COPY build/copy-tier-controllers.sh /tmp/
RUN chmod +x /tmp/copy-tier-controllers.sh && /tmp/copy-tier-controllers.sh ${TIER} && rm -rf /build/src/watchnexus/core/Controllers_all

# Publish
ENV SkipFrontendBuild=true
RUN dotnet publish src/watchnexus/core/WatchNexus.Core.csproj \
    -c Release -o /publish --no-restore \
    /p:SkipFrontendBuild=true

# ── Stage 3: Runtime ─────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS runtime
ARG TIER=standard

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    mediainfo \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Labels
LABEL org.opencontainers.image.title="WatchNexus ${TIER}" \
      org.opencontainers.image.description="WatchNexus Media Server - ${TIER} Edition" \
      org.opencontainers.image.version="2.9.0" \
      org.opencontainers.image.vendor="WatchNexus" \
      org.opencontainers.image.source="https://github.com/Z3r0Fell/watchnexus" \
      com.watchnexus.tier="${TIER}"

WORKDIR /app

# Copy published backend
COPY --from=backend-build /publish ./

# Copy frontend build
COPY --from=frontend-build /build/frontend/build ./web/build/

# Create data directories
RUN mkdir -p /app/data /app/logs /data/media /data/rips /data/transcoded /data/offline

# Environment
ENV ASPNETCORE_URLS=http://0.0.0.0:8002 \
    WATCHNEXUS_PORT=8002 \
    WATCHNEXUS_TIER=${TIER} \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_EnableDiagnostics=0

# Volume mounts
VOLUME ["/app/data", "/data/media", "/data/rips"]

EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:8002/api/health || exit 1

ENTRYPOINT ["dotnet", "WatchNexus.Core.dll"]
