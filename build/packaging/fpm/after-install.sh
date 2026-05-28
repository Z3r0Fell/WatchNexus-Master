#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  fpm after-install hook (runs as root on the target machine)
#  Common to .deb / .rpm / .pkg.tar.zst — reads /opt/watchnexus/tier.lock
#  to know which tier was installed.
# ══════════════════════════════════════════════════════════════════════
set -e

INSTALLDIR="/opt/watchnexus"
SERVICE_USER="watchnexus"
TIER="$(cat "$INSTALLDIR/tier.lock" 2>/dev/null || echo standard)"
VERSION="$(cat "$INSTALLDIR/version.lock" 2>/dev/null || echo unknown)"
PORT="${WATCHNEXUS_PORT:-8001}"

# 1. Create the service user (idempotent across deb/rpm/pacman)
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
    if command -v useradd >/dev/null 2>&1; then
        useradd --system --home "$INSTALLDIR" --shell /usr/sbin/nologin "$SERVICE_USER"
    elif command -v adduser >/dev/null 2>&1; then
        adduser --system --home "$INSTALLDIR" --shell /usr/sbin/nologin "$SERVICE_USER"
    fi
fi

# 2. Set perms
chown -R "$SERVICE_USER":"$SERVICE_USER" "$INSTALLDIR"
chmod +x "$INSTALLDIR/bin/WatchNexus.Core" 2>/dev/null || true

# 3. Data dir
mkdir -p /var/lib/watchnexus
chown -R "$SERVICE_USER":"$SERVICE_USER" /var/lib/watchnexus

# 4. Reload + enable + start systemd unit (shipped at /usr/lib/systemd/system/)
if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload || true
    systemctl enable watchnexus.service 2>/dev/null || true
    systemctl restart watchnexus.service || true
fi

echo "WatchNexus ${TIER^} v${VERSION} installed at ${INSTALLDIR} (port ${PORT})."
echo "Open http://localhost:${PORT} in your browser to activate your license."
exit 0
