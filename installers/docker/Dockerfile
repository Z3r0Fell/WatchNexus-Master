FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files
COPY src/watchnexus/WatchNexus.sln ./
COPY src/watchnexus/core/WatchNexus.Core.csproj ./core/
COPY src/watchnexus/shared/WatchNexus.Shared.csproj ./shared/

# Restore packages
RUN dotnet restore

# Copy source code and build
COPY src/watchnexus/ ./
RUN dotnet publish core/WatchNexus.Core.csproj -c Release -o /app/publish

# Frontend build
FROM node:22-slim AS frontend
WORKDIR /web
COPY src/web/package.json src/web/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY src/web/ ./
RUN yarn build

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0-bookworm-slim
WORKDIR /opt/watchnexus

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r watchnexus && useradd -r -g watchnexus -d /opt/watchnexus watchnexus

# Copy published .NET app
COPY --from=build /app/publish ./

# Copy frontend build
COPY --from=frontend /web/build ./web/build/

# Copy module manifests
COPY src/watchnexus/modules/ ./modules/

# Create data/log dirs and set ownership
RUN mkdir -p data logs && chown -R watchnexus:watchnexus /opt/watchnexus

VOLUME /opt/watchnexus/data
VOLUME /opt/watchnexus/logs

ARG PORT=8001
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT}
ENV WATCHNEXUS_PORT=${PORT}
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

USER watchnexus

ENTRYPOINT ["dotnet", "WatchNexus.Core.dll"]
