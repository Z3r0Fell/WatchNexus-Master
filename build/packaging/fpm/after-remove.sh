#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  fpm after-remove hook
#  Final cleanup AFTER the package manager finishes removing files.
#  Reloads systemd so the now-missing unit isn't cached.
# ══════════════════════════════════════════════════════════════════════
set -e

if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload 2>/dev/null || true
fi

# Note: we intentionally do NOT delete the 'watchnexus' user or
# /var/lib/watchnexus — those persist user data so a reinstall picks
# up the existing library. To fully purge, run:
#   sudo userdel watchnexus && sudo rm -rf /var/lib/watchnexus

exit 0
