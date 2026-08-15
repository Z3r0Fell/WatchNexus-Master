# ══════════════════════════════════════════════════════════════════════
# WatchNexus — Multi-Tier Docker Build
# Build args: TIER=standard|pro|ultra (default: standard)
# ══════════════════════════════════════════════════════════════════════

# ── Stage 1: Frontend Build ──────────────────────────────────────────
FROM node:22-alpine AS frontend-build
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
      org.opencontainers.image.version="1.0.1" \
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
ENV ASPNETCORE_URLS=http://0.0.0.0:8001 \
    WATCHNEXUS_PORT=8001 \
    WATCHNEXUS_TIER=${TIER} \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_EnableDiagnostics=0

# Volume mounts
VOLUME ["/app/data", "/data/media", "/data/rips"]

EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:8001/api/health || exit 1

# Note: For production, consider:
# - Pinning base images by digest (e.g., node:22-alpine@sha256:...)
# - Enabling HTTPS with TLS certificates
# - Adding security headers (HSTS, CSP, X-Frame-Options)
# - Using a reverse proxy (nginx, traefik) for TLS termination

ENTRYPOINT ["dotnet", "WatchNexus.Core.dll"]
