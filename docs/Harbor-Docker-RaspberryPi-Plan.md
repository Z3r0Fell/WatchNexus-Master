# WatchNexus Docker & Raspberry Pi Deployment
## Codename: **Harbor**

### Overview

This document outlines containerization and embedded device deployment strategies for WatchNexus.

---

## Part 1: Docker Deployment

### 1.1 Docker Images

**Official Images:**
```
watchnexus/server:latest           # Latest stable
watchnexus/server:2.5.5            # Specific version
watchnexus/server:2.5.5-alpine     # Alpine-based (smaller)
watchnexus/server:2.5.5-cuda       # With NVIDIA CUDA support
```

**Multi-Architecture Support:**
```
linux/amd64      # Standard x86_64 servers
linux/arm64      # Raspberry Pi 4/5, AWS Graviton, Apple Silicon
linux/arm/v7     # Raspberry Pi 3, older ARM devices
```

### 1.2 Dockerfile (Standard)

```dockerfile
# WatchNexus Server - Standard Image
# Multi-architecture: amd64, arm64, arm/v7

FROM python:3.11-slim-bookworm AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libchromaprint-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user (non-root)
RUN useradd -m -s /bin/bash watchnexus
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY --chown=watchnexus:watchnexus . .

# Build frontend
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Final image
FROM base AS final
COPY --from=frontend-builder /frontend/build /app/frontend/build

# Set environment
ENV PYTHONUNBUFFERED=1
ENV WATCHNEXUS_DATA=/data
ENV WATCHNEXUS_CONFIG=/config

# Create data directories
RUN mkdir -p /data /config /media && \
    chown -R watchnexus:watchnexus /data /config

# Switch to non-root user
USER watchnexus

# Expose ports
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

# Start server
CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

### 1.3 Dockerfile (Alpine - Minimal)

```dockerfile
# WatchNexus Server - Alpine (Smaller Image)
FROM python:3.11-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    chromaprint \
    curl \
    gcc \
    musl-dev \
    libffi-dev

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create directories and user
RUN adduser -D watchnexus && \
    mkdir -p /data /config /media && \
    chown -R watchnexus:watchnexus /app /data /config

USER watchnexus

EXPOSE 8001

CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

### 1.4 Dockerfile (NVIDIA CUDA)

```dockerfile
# WatchNexus Server - With NVIDIA GPU Acceleration
FROM nvidia/cuda:12.2-runtime-ubuntu22.04 AS base

# Install Python and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3-pip \
    ffmpeg \
    libchromaprint-tools \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install NVIDIA Video Codec SDK (for NVENC/NVDEC)
# Note: Requires accepting NVIDIA EULA

WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .

ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,video,utility

EXPOSE 8001

CMD ["python3", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

### 1.5 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  watchnexus:
    image: watchnexus/server:latest
    container_name: watchnexus
    restart: unless-stopped
    ports:
      - "8001:8001"      # API/Web UI
      - "6881:6881"      # Torrent (TCP)
      - "6881:6881/udp"  # Torrent (UDP/DHT)
    volumes:
      - ./config:/config           # Configuration
      - ./data:/data               # Database and cache
      - /path/to/media:/media:ro   # Media library (read-only)
      - /path/to/downloads:/downloads  # Downloads folder
    environment:
      - TZ=America/New_York
      - PUID=1000
      - PGID=1000
      - WATCHNEXUS_LOG_LEVEL=INFO
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: Reverse proxy
  traefik:
    image: traefik:v2.10
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik:/etc/traefik
    labels:
      - "traefik.enable=true"

# Named volumes for persistence
volumes:
  config:
  data:
```

### 1.6 Docker Compose (NVIDIA GPU)

```yaml
# docker-compose.nvidia.yml
version: '3.8'

services:
  watchnexus:
    image: watchnexus/server:latest-cuda
    container_name: watchnexus
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu, video]
    ports:
      - "8001:8001"
    volumes:
      - ./config:/config
      - ./data:/data
      - /path/to/media:/media:ro
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=compute,video,utility
      - WATCHNEXUS_HARDWARE_ACCEL=nvenc
```

### 1.7 Building Multi-Architecture Images

```bash
# Create builder for multi-arch
docker buildx create --name multiarch --use

# Build and push all architectures
docker buildx build \
  --platform linux/amd64,linux/arm64,linux/arm/v7 \
  --tag watchnexus/server:2.5.5 \
  --tag watchnexus/server:latest \
  --push \
  .
```

---

## Part 2: Raspberry Pi Deployment

### 2.1 Supported Models

| Model | Architecture | RAM | Status | Notes |
|-------|-------------|-----|--------|-------|
| Pi 5 | ARM64 | 4-8GB | ✅ Recommended | Full performance |
| Pi 4 | ARM64 | 2-8GB | ✅ Supported | Good performance |
| Pi 400 | ARM64 | 4GB | ✅ Supported | Desktop form factor |
| Pi 3B+ | ARMv7 | 1GB | ⚠️ Limited | May struggle with transcoding |
| Pi Zero 2W | ARM64 | 512MB | ❌ Not Recommended | Insufficient RAM |

### 2.2 Raspberry Pi OS Installation

**One-Line Install Script:**
```bash
curl -sSL https://get.watchnexus.io/pi | bash
```

**Manual Installation:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y \
    python3.11 \
    python3-pip \
    python3-venv \
    ffmpeg \
    libchromaprint-tools \
    git

# Create dedicated user
sudo useradd -m -s /bin/bash watchnexus
sudo usermod -aG video,audio watchnexus

# Clone and install
sudo -u watchnexus git clone https://github.com/yourname/watchnexus /opt/watchnexus
cd /opt/watchnexus
sudo -u watchnexus python3 -m venv venv
sudo -u watchnexus ./venv/bin/pip install -r requirements.txt

# Install systemd service
sudo cp watchnexus.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable watchnexus
sudo systemctl start watchnexus
```

### 2.3 Systemd Service File

```ini
# /etc/systemd/system/watchnexus.service
[Unit]
Description=WatchNexus Media Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=watchnexus
Group=watchnexus
WorkingDirectory=/opt/watchnexus
ExecStart=/opt/watchnexus/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

# Resource limits for Pi
MemoryMax=75%
CPUQuota=90%

# Environment
Environment=PYTHONUNBUFFERED=1
Environment=WATCHNEXUS_DATA=/var/lib/watchnexus
Environment=WATCHNEXUS_LOG_LEVEL=INFO

[Install]
WantedBy=multi-user.target
```

### 2.4 Raspberry Pi Optimization

**config.txt optimizations:**
```ini
# /boot/config.txt additions for media server

# Increase GPU memory for video processing
gpu_mem=256

# Enable hardware video decode
dtoverlay=vc4-kms-v3d

# Disable Bluetooth if not needed (saves power)
dtoverlay=disable-bt

# Increase USB current (for external drives)
max_usb_current=1
```

**Swap configuration (for 2GB models):**
```bash
# Increase swap for memory-intensive operations
sudo dphys-swapfile swapoff
sudo sed -i 's/CONF_SWAPSIZE=100/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### 2.5 DietPi Integration

DietPi is a lightweight Raspberry Pi OS optimized for single-board computers.

**DietPi Software Entry:**
```bash
# Add to /boot/dietpi/dietpi-software
SOFTWARE_WATCHNEXUS_NAME='WatchNexus'
SOFTWARE_WATCHNEXUS_DESC='Unified Media Pipeline'
SOFTWARE_WATCHNEXUS_DEPS='python3 ffmpeg'
SOFTWARE_WATCHNEXUS_INSTALL_SCRIPT='/boot/dietpi/scripts/install_watchnexus.sh'
```

**Installation via DietPi:**
```bash
dietpi-software install watchnexus
```

### 2.6 LibreELEC/OSMC Add-on

For Kodi-based Raspberry Pi setups:

**Add-on structure:**
```
plugin.service.watchnexus/
├── addon.xml
├── service.py          # Background service
├── resources/
│   └── settings.xml
└── watchnexus/         # Embedded server
```

---

## Part 3: Other Embedded/SBC Platforms

### 3.1 ODROID Support

| Model | Architecture | Status |
|-------|-------------|--------|
| ODROID-N2+ | ARM64 | ✅ Supported |
| ODROID-C4 | ARM64 | ✅ Supported |
| ODROID-XU4 | ARMv7 | ⚠️ Limited |

### 3.2 Orange Pi Support

| Model | Architecture | Status |
|-------|-------------|--------|
| Orange Pi 5 | ARM64 | ✅ Supported |
| Orange Pi 4 | ARM64 | ✅ Supported |

### 3.3 Intel NUC / Mini PCs

```bash
# Installation on Intel NUC running Ubuntu
sudo apt install docker.io docker-compose
docker-compose up -d
```

---

## Part 4: NAS Integration

### 4.1 Synology DSM

**Via Docker (Container Manager):**
1. Open Container Manager
2. Registry → Search "watchnexus"
3. Download latest image
4. Create container with volume mappings

**Via Community Package:**
- SPK package available for Synology NAS
- Installs natively without Docker

### 4.2 QNAP

**Via Container Station:**
1. Open Container Station
2. Create Application → Docker Compose
3. Paste docker-compose.yml
4. Deploy

### 4.3 TrueNAS Scale

**Via Apps Catalog:**
1. Apps → Discover Apps
2. Search "WatchNexus"
3. Install with configuration

**Via Custom Docker:**
```bash
# SSH into TrueNAS
docker run -d \
  --name watchnexus \
  -p 8001:8001 \
  -v /mnt/pool/media:/media:ro \
  -v /mnt/pool/appdata/watchnexus:/data \
  watchnexus/server:latest
```

### 4.4 Unraid

**Via Community Applications:**
1. Apps → Search "WatchNexus"
2. Click Install
3. Configure paths and ports

**Template XML:**
```xml
<?xml version="1.0"?>
<Container version="2">
  <Name>WatchNexus</Name>
  <Repository>watchnexus/server:latest</Repository>
  <Registry>https://hub.docker.com/r/watchnexus/server</Registry>
  <Network>bridge</Network>
  <Privileged>false</Privileged>
  <Support>https://github.com/yourname/watchnexus</Support>
  <Overview>Unified Media Pipeline</Overview>
  <Category>MediaServer:Video MediaServer:Music</Category>
  <WebUI>http://[IP]:[PORT:8001]</WebUI>
  <Config Name="WebUI Port" Target="8001" Default="8001" Mode="tcp" Description="Web interface port"/>
  <Config Name="Media" Target="/media" Default="/mnt/user/media" Mode="ro" Description="Media library"/>
  <Config Name="Config" Target="/config" Default="/mnt/user/appdata/watchnexus" Mode="rw" Description="Config directory"/>
</Container>
```

---

## Part 5: Deployment Checklist

### Pre-Deployment
- [ ] Verify architecture compatibility
- [ ] Check storage requirements (min 1GB for app, plus media)
- [ ] Ensure FFmpeg is available
- [ ] Configure firewall rules

### Deployment
- [ ] Pull/install appropriate package
- [ ] Configure volume mounts
- [ ] Set environment variables
- [ ] Start service

### Post-Deployment
- [ ] Access web UI
- [ ] Create admin account
- [ ] Add media libraries
- [ ] Configure indexers (optional)
- [ ] Test playback

### Monitoring
- [ ] Set up health checks
- [ ] Configure log rotation
- [ ] Enable automatic updates (optional)
