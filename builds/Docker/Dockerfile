# WatchNexus Docker Image
# Multi-stage build for optimized image size

FROM node:18-alpine AS frontend-builder

WORKDIR /app/web
COPY separated/web/package.json separated/web/yarn.lock ./
RUN yarn install --frozen-lockfile

COPY separated/web/ ./
RUN yarn build

# Backend stage
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash watchnexus

WORKDIR /app

# Copy backend
COPY separated/server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY separated/server/ ./server/

# Copy frontend build
COPY --from=frontend-builder /app/web/build ./web/build/

# Create data directory
RUN mkdir -p /data/backups /data/logs /data/cache && \
    chown -R watchnexus:watchnexus /app /data

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DATA_DIR=/data
ENV PORT=8001

# Switch to non-root user
USER watchnexus

WORKDIR /app/server

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
