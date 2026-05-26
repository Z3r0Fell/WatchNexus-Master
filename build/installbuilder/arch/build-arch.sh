#!/usr/bin/env bash
# Render and build Arch packages for each tier from the InstallBuilder linux-x64 output.
# Usage: ./build-arch.sh [standard|pro|ultra|all]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${WATCHNEXUS_VERSION:-1.0.0}"
TIERS=("$@")
[ "${#TIERS[@]}" -eq 0 ] && TIERS=("all")
[ "${TIERS[0]}" = "all" ] && TIERS=(standard pro ultra)

declare -A DISPLAY=( [standard]=Standard [pro]=Pro [ultra]=Ultra )

for TIER in "${TIERS[@]}"; do
    WORK="$SCRIPT_DIR/$TIER"
    INSTALLER="/app/release/$TIER/linux/watchnexus-$TIER-$VERSION-linux-x64-installer.run"

    [ -f "$INSTALLER" ] || { echo "Missing $INSTALLER — run InstallBuilder linux-x64 target first"; exit 1; }

    rm -rf "$WORK"
    mkdir -p "$WORK"
    cp "$INSTALLER" "$WORK/"

    sed -e "s/@TIER@/$TIER/g" \
        -e "s/@TIER_DISPLAY@/${DISPLAY[$TIER]}/g" \
        -e "s/@VERSION@/$VERSION/g" \
        "$SCRIPT_DIR/PKGBUILD.in" > "$WORK/PKGBUILD"

    ( cd "$WORK" && makepkg -f --noconfirm )

    mkdir -p "/app/release/$TIER/arch"
    mv "$WORK"/*.pkg.tar.zst "/app/release/$TIER/arch/"
    echo "Built Arch package for $TIER → /app/release/$TIER/arch/"
done
