FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files
COPY watchnexus/WatchNexus.sln ./
COPY watchnexus/core/WatchNexus.Core.csproj ./core/
COPY watchnexus/shared/WatchNexus.Shared.csproj ./shared/

# Restore packages
RUN dotnet restore

# Copy source code and build
COPY watchnexus/ ./
RUN dotnet publish core/WatchNexus.Core.csproj -c Release -o /app/publish

# Frontend build
FROM node:20-slim AS frontend
WORKDIR /web
COPY src/web/package.json src/web/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY src/web/ ./
RUN yarn build

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0-bookworm-slim
WORKDIR /opt/watchnexus

# Copy published .NET app
COPY --from=build /app/publish ./

# Copy frontend build
COPY --from=frontend /web/build ./web/build/

# Copy module manifests
COPY watchnexus/modules/ ./modules/

# Create data/log dirs
RUN mkdir -p data logs

VOLUME /opt/watchnexus/data
VOLUME /opt/watchnexus/logs

ENV ASPNETCORE_URLS=http://0.0.0.0:8001
ENV WATCHNEXUS_PORT=8001

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

ENTRYPOINT ["dotnet", "WatchNexus.Core.dll"]
