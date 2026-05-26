#!/usr/bin/env bash
# WatchNexus — Linux pre-uninstall hook
# Args: $1 installdir
set -euo pipefail

INSTALLDIR="${1:?installdir required}"
UNIT_PATH="/etc/systemd/system/watchnexus.service"

systemctl stop watchnexus.service 2>/dev/null || true
systemctl disable watchnexus.service 2>/dev/null || true
rm -f "$UNIT_PATH"
systemctl daemon-reload || true

echo "WatchNexus service removed (data preserved at ${INSTALLDIR}/data if present)."
