#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  WatchNexus — InstallBuilder Staging Script  (Arch laptop, v1.0.0 RTP)
#  ----------------------------------------------------------------------
#  Run this on your Arch laptop in the cloned WatchNexus repo. It builds
#  the FULL backend once per RID (win-x64, linux-x64) and a tier-baked
#  frontend bundle per tier. Tier enforcement is performed at runtime by
#  CellarController + LicenseContext against https://licenses.watchnexus.ca
#  (the binaries are identical across tiers; only the React bundle and
#  installer metadata differ).
#
#  Output layout (per tier):
#     stage/<tier>/
#       publish/
#         win-x64/      ← self-contained .NET 10 backend (Windows)
#         linux-x64/    ← self-contained .NET 10 backend (Linux)
#         web/          ← production React bundle, REACT_APP_TIER baked in
#       tier.json
#       LICENSE.txt
#       LICENSE.html
#       README.md
#
#  Usage:
#     ./prepare-installers.sh [standard|pro|ultra|all]
#
#  Requires (Arch): dotnet-sdk, nodejs, yarn, jq
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
STAGE_DIR="$ROOT_DIR/stage"
SHARED_PUBLISH_ROOT="$ROOT_DIR/.publish-shared"
CORE_CSPROJ="$ROOT_DIR/src/watchnexus/core/WatchNexus.Core.csproj"
FRONTEND_DIR="$ROOT_DIR/src/web"       # frontend/ is a symlink to src/web/
VERSION="1.0.0"
RIDS=(win-x64 linux-x64)

TARGET="${1:-all}"
case "$TARGET" in
    standard|pro|ultra|all) ;;
    *) echo "Usage: $0 [standard|pro|ultra|all]"; exit 1 ;;
esac

# ── Pre-flight checks ───────────────────────────────────────────────
need() { command -v "$1" >/dev/null 2>&1 || { echo "[!] Missing: $1"; exit 1; }; }
need dotnet
need node
need yarn
need jq

[ -f "$CORE_CSPROJ" ] || { echo "[!] Cannot find $CORE_CSPROJ"; exit 1; }
[ -d "$FRONTEND_DIR" ] || { echo "[!] Cannot find $FRONTEND_DIR (frontend/ symlink broken?)"; exit 1; }

echo "══════════════════════════════════════════════════"
echo "  WatchNexus Installer Staging  (v${VERSION})"
echo "  Root    : $ROOT_DIR"
echo "  Stage   : $STAGE_DIR"
echo "  Target  : $TARGET"
echo "══════════════════════════════════════════════════"

if [ "$TARGET" = "all" ]; then
    TIERS=(standard pro ultra)
else
    TIERS=("$TARGET")
fi

# ── Step 1: Publish backend ONCE per RID (shared by all tiers) ─────
echo ""
echo "[1/3] Publishing backend (shared, full source, per RID)..."
rm -rf "$SHARED_PUBLISH_ROOT"
mkdir -p "$SHARED_PUBLISH_ROOT"

for RID in "${RIDS[@]}"; do
    echo "       → $RID"
    dotnet publish "$CORE_CSPROJ" \
        -c Release -r "$RID" \
        --self-contained true \
        -p:PublishSingleFile=true \
        -p:PublishTrimmed=false \
        -p:DebugType=none \
        -p:DebugSymbols=false \
        -p:SkipFrontendBuild=true \
        -o "$SHARED_PUBLISH_ROOT/$RID" \
        --nologo --verbosity quiet
    find "$SHARED_PUBLISH_ROOT/$RID" -name "*.pdb" -delete 2>/dev/null || true
    SIZE=$(du -sh "$SHARED_PUBLISH_ROOT/$RID" | cut -f1)
    echo "         done — $SIZE"
done

# ── Step 2: Per-tier frontend bundle (tier-baked) ──────────────────
echo ""
echo "[2/3] Building tier-baked frontend bundles..."
(
    cd "$FRONTEND_DIR"
    [ -d node_modules ] || yarn install --frozen-lockfile
)

for TIER in "${TIERS[@]}"; do
    echo "       → $TIER"
    (
        cd "$FRONTEND_DIR"
        REACT_APP_TIER="$TIER" \
        REACT_APP_VERSION="$VERSION" \
        REACT_APP_BACKEND_URL="" \
        GENERATE_SOURCEMAP=false \
            yarn build --silent
    )
    OUT="$STAGE_DIR/$TIER/publish/web"
    rm -rf "$OUT" && mkdir -p "$OUT"
    cp -r "$FRONTEND_DIR/build/." "$OUT/"
    find "$OUT" -name "*.map" -delete 2>/dev/null || true
    SIZE=$(du -sh "$OUT" | cut -f1)
    echo "         done — $SIZE"
done

# ── Step 3: Assemble per-tier stage trees ──────────────────────────
echo ""
echo "[3/3] Assembling per-tier stage trees..."
for TIER in "${TIERS[@]}"; do
    OUT="$STAGE_DIR/$TIER"
    mkdir -p "$OUT/publish"

    # Hard-copy (not symlink) the shared backend into each tier's stage
    # so InstallBuilder can ingest stage/<tier>/ as a self-contained unit.
    for RID in "${RIDS[@]}"; do
        rm -rf "$OUT/publish/$RID"
        cp -a "$SHARED_PUBLISH_ROOT/$RID" "$OUT/publish/$RID"
    done

    # tier.json manifest
    jq -n \
       --arg tier "$TIER" \
       --arg version "$VERSION" \
       --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg arch "$(uname -m)" \
       --arg host "$(hostname)" \
       '{tier:$tier, version:$version, built_at:$ts, build_arch:$arch, build_host:$host, rtp:"1.0.0"}' \
       > "$OUT/tier.json"

    # Ship legal + production docs alongside the binaries
    cp "$ROOT_DIR/LICENSE.txt"  "$OUT/LICENSE.txt"  2>/dev/null || true
    cp "$ROOT_DIR/LICENSE.html" "$OUT/LICENSE.html" 2>/dev/null || true
    cp "$ROOT_DIR/README.md"    "$OUT/README.md"    2>/dev/null || true

    WIN_SIZE=$(du -sh "$OUT/publish/win-x64"   | cut -f1)
    LIN_SIZE=$(du -sh "$OUT/publish/linux-x64" | cut -f1)
    WEB_SIZE=$(du -sh "$OUT/publish/web"       | cut -f1)
    echo "       [$TIER] win-x64=$WIN_SIZE  linux-x64=$LIN_SIZE  web=$WEB_SIZE"
done

# Cleanup the shared intermediate
rm -rf "$SHARED_PUBLISH_ROOT"

echo ""
echo "══════════════════════════════════════════════════"
echo "  Staging complete."
echo "  Feed InstallBuilder 26 with:"
echo "    /opt/installbuilder-26/bin/builder build \\"
echo "      $SCRIPT_DIR/installbuilder/watchnexus.xml <TARGET> \\"
echo "      --setvars tier=<TIER> productVersion=$VERSION \\"
echo "      --setvars payload_root=$STAGE_DIR/<TIER>"
echo "══════════════════════════════════════════════════"
