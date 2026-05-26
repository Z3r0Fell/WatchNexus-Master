#!/usr/bin/env bash
# WatchNexus — Linux post-install hook
# Args: $1 installdir   $2 http_port   $3 tier
set -euo pipefail

INSTALLDIR="${1:?installdir required}"
PORT="${2:-8001}"
TIER="${3:-standard}"
SERVICE_USER="watchnexus"
UNIT_PATH="/etc/systemd/system/watchnexus.service"

# 1. Create the service user (idempotent)
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
    useradd --system --home "$INSTALLDIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# 2. Chown the install tree
chown -R "$SERVICE_USER":"$SERVICE_USER" "$INSTALLDIR"
chmod +x "$INSTALLDIR/bin/WatchNexus.Core" 2>/dev/null || true

# 3. Persist the tier marker (Fortress integrity check reads this)
echo "$TIER"           > "$INSTALLDIR/tier.lock"
echo "${productVersion:-1.0.0}" > "$INSTALLDIR/version.lock"
chown "$SERVICE_USER":"$SERVICE_USER" "$INSTALLDIR/tier.lock" "$INSTALLDIR/version.lock"

# 4. Install the systemd unit
cat > "$UNIT_PATH" <<UNIT
[Unit]
Description=WatchNexus ${TIER^} Core
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALLDIR}
ExecStart=${INSTALLDIR}/bin/WatchNexus.Core --urls http://0.0.0.0:${PORT}
Restart=on-failure
RestartSec=5
Environment=DOTNET_NOLOGO=1
Environment=ASPNETCORE_ENVIRONMENT=Production

[Install]
WantedBy=multi-user.target
UNIT

# 5. Enable + start
systemctl daemon-reload
systemctl enable --now watchnexus.service

echo "WatchNexus ${TIER} installed at ${INSTALLDIR} (port ${PORT})."
