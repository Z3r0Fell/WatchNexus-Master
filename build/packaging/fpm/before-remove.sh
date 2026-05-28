#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  fpm before-remove hook
#  Stop + disable the systemd unit BEFORE the package manager removes
#  files. Leaves user data at /var/lib/watchnexus untouched.
# ══════════════════════════════════════════════════════════════════════
set -e

if command -v systemctl >/dev/null 2>&1; then
    systemctl stop watchnexus.service 2>/dev/null || true
    systemctl disable watchnexus.service 2>/dev/null || true
fi

exit 0
