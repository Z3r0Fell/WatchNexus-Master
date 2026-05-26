#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  WatchNexus — InstallBuilder Staging Script  (Arch Linux laptop)
#  ----------------------------------------------------------------------
#  Run this on your Arch laptop AFTER extracting the WatchNexus release
#  tarball / git clone. It produces three tier-separated staging trees
#  under ./stage/{standard,pro,ultra}/ that BitRock InstallBuilder 26
#  consumes directly via /app/build/installbuilder/watchnexus.xml.
#
#  Output layout (per tier):
#     stage/<tier>/
#       publish/
#         win-x64/        ← self-contained .NET 10 backend for Windows
#         linux-x64/      ← self-contained .NET 10 backend for Linux
#         web/            ← production React bundle (tier-baked)
#       tier.json
#       LICENSE.txt
#       LICENSE.html
#       README.md
#
#  Usage:
#     ./prepare-installers.sh [standard|pro|ultra|all]
#
#  Requires (Arch): dotnet-sdk, nodejs, yarn, jq, base-devel
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
STAGE_DIR="$ROOT_DIR/stage"
SRC_BACKEND="$ROOT_DIR/src/watchnexus/core"
SRC_FRONTEND="$ROOT_DIR/frontend"
RESOURCE_DIR="$SCRIPT_DIR/installbuilder/resources"
VERSION="1.0.0"
RIDS=(win-x64 linux-x64)

TARGET="${1:-all}"

# ── Pre-flight checks ───────────────────────────────────────────────
need() { command -v "$1" >/dev/null 2>&1 || { echo "[!] Missing: $1"; exit 1; }; }
need dotnet
need node
need yarn
need jq

echo "══════════════════════════════════════════════════"
echo "  WatchNexus Installer Staging  (v${VERSION})"
echo "  Root   : $ROOT_DIR"
echo "  Stage  : $STAGE_DIR"
echo "  Target : $TARGET"
echo "══════════════════════════════════════════════════"

# ── Step 1: run the tier separator to fan out source files ──────────
echo "[1/4] Separating tier source trees..."
chmod +x "$SCRIPT_DIR/build-tiers.sh"
"$SCRIPT_DIR/build-tiers.sh" "$TARGET"

# Resolve which tiers to stage
if [ "$TARGET" = "all" ]; then
    TIERS=(standard pro ultra)
else
    TIERS=("$TARGET")
fi

# ── Step 2: per-tier dotnet publish (Win + Linux) + yarn build ──────
for TIER in "${TIERS[@]}"; do
    SRC_DIST="$ROOT_DIR/dist/$TIER"
    OUT="$STAGE_DIR/$TIER"

    [ -d "$SRC_DIST" ] || { echo "[!] dist/$TIER missing — build-tiers.sh failed"; exit 1; }

    echo ""
    echo "[2/4] [$TIER] Publishing backend (win-x64 + linux-x64)..."
    rm -rf "$OUT"
    mkdir -p "$OUT/publish/web"

    for RID in "${RIDS[@]}"; do
        echo "       → $RID"
        dotnet publish "$SRC_DIST/backend/WatchNexus.Core.csproj" \
            -c Release -r "$RID" \
            --self-contained true \
            -p:PublishSingleFile=true \
            -p:PublishTrimmed=false \
            -p:DebugType=none \
            -p:DebugSymbols=false \
            -o "$OUT/publish/$RID" \
            --nologo --verbosity quiet
        find "$OUT/publish/$RID" -name "*.pdb" -delete 2>/dev/null || true
    done

    echo "[3/4] [$TIER] Building frontend (tier-baked)..."
    (
        cd "$SRC_FRONTEND"
        # Install deps only once per session
        [ -d node_modules ] || yarn install --frozen-lockfile
        REACT_APP_TIER="$TIER" \
        REACT_APP_VERSION="$VERSION" \
        GENERATE_SOURCEMAP=false \
            yarn build --silent
    )
    cp -r "$SRC_FRONTEND/build/." "$OUT/publish/web/"
    # Strip any leaked source-map references
    find "$OUT/publish/web" -name "*.map" -delete 2>/dev/null || true

    # ── Step 4: per-tier metadata + ship docs ─────────────────────
    echo "[4/4] [$TIER] Writing tier manifest + bundling docs..."
    jq -n \
       --arg tier "$TIER" \
       --arg version "$VERSION" \
       --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg arch "$(uname -m)" \
       --arg host "$(hostname)" \
       '{tier:$tier, version:$version, built_at:$ts, build_arch:$arch, build_host:$host, rtp:"1.0.0"}' \
       > "$OUT/tier.json"

    # Ship the legal + production docs alongside the binaries
    cp "$ROOT_DIR/LICENSE.txt"  "$OUT/LICENSE.txt"  2>/dev/null || true
    cp "$ROOT_DIR/LICENSE.html" "$OUT/LICENSE.html" 2>/dev/null || true
    cp "$ROOT_DIR/README.md"    "$OUT/README.md"    2>/dev/null || true

    # Sanity sizes
    WIN_SIZE=$(du -sh "$OUT/publish/win-x64"   | cut -f1)
    LIN_SIZE=$(du -sh "$OUT/publish/linux-x64" | cut -f1)
    WEB_SIZE=$(du -sh "$OUT/publish/web"       | cut -f1)
    echo "       win-x64=$WIN_SIZE  linux-x64=$LIN_SIZE  web=$WEB_SIZE"
done

echo ""
echo "══════════════════════════════════════════════════"
echo "  Staging complete."
echo "  Feed InstallBuilder 26 with:"
echo "    /opt/installbuilder-26/bin/builder build \\"
echo "      $SCRIPT_DIR/installbuilder/watchnexus.xml <TARGET> \\"
echo "      --setvars tier=<TIER> productVersion=$VERSION \\"
echo "      --setvars payload_root=$STAGE_DIR/<TIER>"
echo "══════════════════════════════════════════════════"
