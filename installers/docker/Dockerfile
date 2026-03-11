FROM python:3.11-slim AS backend-base

WORKDIR /opt/watchnexus

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg ffmpeg sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 for frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g yarn \
    && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY src/server/ /opt/watchnexus/backend/
WORKDIR /opt/watchnexus/backend
RUN pip install --no-cache-dir -r requirements.txt

# Copy and build frontend
COPY src/web/ /opt/watchnexus/frontend-src/
WORKDIR /opt/watchnexus/frontend-src
RUN yarn install --frozen-lockfile && yarn build \
    && mv build /opt/watchnexus/backend/frontend_build \
    && rm -rf /opt/watchnexus/frontend-src

# Copy tray app and launcher
COPY tray_app.py /opt/watchnexus/
COPY launch.py /opt/watchnexus/
COPY VERSION /opt/watchnexus/

WORKDIR /opt/watchnexus/backend

# Volumes
VOLUME /opt/watchnexus/backend/data
VOLUME /opt/watchnexus/backend/logs

# Environment
ENV WATCHNEXUS_PORT=8001
ENV WATCHNEXUS_DATA=/opt/watchnexus/backend/data
ENV PYTHONUNBUFFERED=1

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
