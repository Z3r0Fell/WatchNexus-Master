# ══════════════════════════════════════════════════════════════════════
# WatchNexus — Multi-Tier Docker Build
# Build args: TIER=standard|pro|ultra (default: standard)
#            NODE_VERSION=node:22-alpine
#            DOTNET_SDK_VERSION=10.0
#            DOTNET_ASPNET_VERSION=10.0-bookworm-slim
# ══════════════════════════════════════════════════════════════════════

# ── Stage 1: Frontend Build ──────────────────────────────────────────
ARG NODE_VERSION=node:22-alpine
FROM ${NODE_VERSION} AS frontend-build
WORKDIR /build/frontend

COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

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
COPY src/watchnexus/modules/lobster/WatchNexus.Module.Lobster.csproj src/watchnexus/modules/lobster/
RUN dotnet restore src/watchnexus/core/WatchNexus.Core.csproj \
    && dotnet restore src/watchnexus/modules/lobster/WatchNexus.Module.Lobster.csproj

# Copy shared code
COPY src/watchnexus/shared/ src/watchnexus/shared/

# Copy core code (whole tree — .dockerignore excludes bin/obj/data)
# Selective per-dir COPYs kept breaking the build (Services/ and
# Properties/ were omitted); a full-tree copy is simpler and always correct.
COPY src/watchnexus/core/ src/watchnexus/core/

# ── Controllers ──────────────────────────────────────────────────────
# All controllers are compiled into every tier image. Tier enforcement is
# runtime-only: FortressController gates module codenames against the
# license tier, exactly like the native (non-Docker) release. Compile-time
# tier exclusion was removed because it (a) duplicated types via the
# Controllers_all staging dir, and (b) stripped FortressController +
# UpdateController + GadgetsCatalogueController + ChowderController, which
# are in no tier list and are required by every tier.

# External modules (module.json manifests + Lobster source). ModuleLoader
# scans <app>/modules/<name>/ at startup; the core publish's
# PublishModulesCopy target copies every module.json there.
COPY src/watchnexus/modules/ src/watchnexus/modules/

# Publish
ENV SkipFrontendBuild=true
RUN dotnet publish src/watchnexus/core/WatchNexus.Core.csproj \
    -c Release -o /publish --no-restore \
    /p:SkipFrontendBuild=true

# Lobster is an external DLL module (serves /api/lobster/*), not compiled
# into Core. Publish it next to its manifest so ModuleLoader loads
# modules/lobster/WatchNexus.Module.Lobster.dll in every tier (tier gating
# remains runtime-only).
RUN dotnet publish src/watchnexus/modules/lobster/WatchNexus.Module.Lobster.csproj \
    -c Release -o /publish/modules/lobster --no-restore \
    && test -f /publish/modules/lobster/module.json \
    && test -f /publish/modules/lobster/WatchNexus.Module.Lobster.dll

# ── Stage 3: Runtime ─────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS runtime
ARG TIER=standard
# Publishable activate-only license key for official images (see CellarController).
# Supplied at release time: --build-arg LICENSE_SERVER_CLIENT_KEY=wnk_...
ARG LICENSE_SERVER_CLIENT_KEY=""
ARG PORT=8001

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    mediainfo \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Labels
LABEL org.opencontainers.image.title="WatchNexus ${TIER}" \
      org.opencontainers.image.description="WatchNexus Media Server - ${TIER} Edition" \
      org.opencontainers.image.version="1.0.6" \
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

# Run as a non-root user (security hardening). Named volumes inherit this
# ownership on first creation; bind mounts must be chown'd on the host.
RUN groupadd -r watchnexus && useradd -r -g watchnexus -d /app watchnexus \
    && chown -R watchnexus:watchnexus /app /data
USER watchnexus

# Environment
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT} \
    WATCHNEXUS_PORT=${PORT} \
    WATCHNEXUS_TIER=${TIER} \
    LICENSE_SERVER_CLIENT_KEY=${LICENSE_SERVER_CLIENT_KEY} \
    WATCHNEXUS_DATA_DIR=/app/data \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_EnableDiagnostics=0

# Volume mounts
VOLUME ["/app/data", "/data/media", "/data/rips"]

EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:${WATCHNEXUS_PORT:-8001}/api/health || exit 1

# Security hardening notes:
# - HSTS, CSP, X-Frame-Options, etc. are set by middleware in Program.cs
# - For production, also consider:
#   - Pinning base images by digest (e.g., node:22-alpine@sha256:...)
#   - Using a reverse proxy (nginx, traefik) for TLS termination

ENTRYPOINT ["dotnet", "WatchNexus.Core.dll"]
