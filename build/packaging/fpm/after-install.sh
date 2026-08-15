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
    NOLOGIN_SHELL=""
    for candidate in /usr/sbin/nologin /sbin/nologin /usr/bin/false; do
        if [ -f "$candidate" ]; then NOLOGIN_SHELL="$candidate"; break; fi
    done
    if command -v useradd >/dev/null 2>&1; then
        useradd --system --home "$INSTALLDIR" --shell "${NOLOGIN_SHELL:-/usr/sbin/nologin}" "$SERVICE_USER"
    elif command -v adduser >/dev/null 2>&1; then
        adduser --system --home "$INSTALLDIR" --shell "${NOLOGIN_SHELL:-/usr/sbin/nologin}" "$SERVICE_USER"
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

# 5. Ensure xdg autostart wrapper is executable so it can spawn at user login.
#    The .desktop file (shipped at /etc/xdg/autostart/watchnexus-tray.desktop)
#    invokes /usr/bin/watchnexus-tray, which re-execs the Core binary with
#    `--tray`. systemd runs as the `watchnexus` user (no GUI), so the tray
#    has to live in each interactive user's session.
chmod +x /usr/bin/watchnexus-tray 2>/dev/null || true

echo "WatchNexus ${TIER^} v${VERSION} installed at ${INSTALLDIR} (port ${PORT})."
echo "Open http://localhost:${PORT} in your browser to activate your license."
echo "The system tray controller will appear automatically next time you log into a GUI session,"
echo "  or run 'watchnexus-tray &' to start it right now."
exit 0
