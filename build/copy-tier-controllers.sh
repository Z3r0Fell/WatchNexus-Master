#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# Tier-based controller copy script
# Called during Docker build to include only the controllers for the
# specified tier (standard, pro, or ultra).
# ══════════════════════════════════════════════════════════════════════
set -e

TIER="${1:-standard}"
CONTROLLERS_DIR="/build/src/watchnexus/core/Controllers"

if [[ "$TIER" != "standard" && "$TIER" != "pro" && "$TIER" != "ultra" ]]; then
    echo "[WatchNexus] ERROR: Invalid tier '$TIER'. Use standard, pro, or ultra." >&2
    exit 1
fi

echo "[WatchNexus] Building ${TIER} tier..."

# Pro controllers (included in pro + ultra)
PRO_FILES=(
    "CoreModuleControllers.cs"
    "MediaControllers.cs"
    "TruffleController.cs"
    "SproutController.cs"
    "DrizzleController.cs"
    "MeringueController.cs"
    "IptvController.cs"
    "RouxController.cs"
    "CodeNameAliasControllers.cs"
    "FeatureControllers.cs"
    "BacklogControllers.cs"
)

# Ultra controllers (included in ultra only)
ULTRA_FILES=(
    "SecurityController.cs"
    "RindController.cs"
    "PepperController.cs"
    "CrucibleController.cs"
    "StrudelController.cs"
    "StrudelPipelineController.cs"
    "CrumbsController.cs"
    "BrineController.cs"
    "LadleController.cs"
    "BotController.cs"
    "GameBotController.cs"
    "MatrixController.cs"
    "SynapseAdminController.cs"
    "MediaBridgeController.cs"
    "VpnController.cs"
    "QBittorrentController.cs"
    "SubtitlesController.cs"
    "ParfaitController.cs"
    "MenuController.cs"
    "PretzelController.cs"
    "UtilityControllers.cs"
)

# Use a tier-specific staging directory to avoid race conditions
ALL_SRC="/build/src/watchnexus/core/Controllers_all_${TIER}"

# Clear staging and copy all controllers there
rm -rf "$ALL_SRC"
cp -r "$CONTROLLERS_DIR" "$ALL_SRC"

# Clear the controllers directory so we only copy back what this tier needs
rm -f "$CONTROLLERS_DIR"/*.cs

# Always copy core controllers
for f in "$ALL_SRC"/*.cs; do
    [ -f "$f" ] && cp "$f" "$CONTROLLERS_DIR/"
done

if [ "$TIER" = "pro" ] || [ "$TIER" = "ultra" ]; then
    echo "  Including Pro controllers..."
    for f in "${PRO_FILES[@]}"; do
        if [ -f "$ALL_SRC/$f" ]; then
            cp "$ALL_SRC/$f" "$CONTROLLERS_DIR/$f"
            echo "    + $f"
        fi
    done
fi

if [ "$TIER" = "ultra" ]; then
    echo "  Including Ultra controllers..."
    for f in "${ULTRA_FILES[@]}"; do
        if [ -f "$ALL_SRC/$f" ]; then
            cp "$ALL_SRC/$f" "$CONTROLLERS_DIR/$f"
            echo "    + $f"
        fi
    done
fi

# Clean up staging
rm -rf "$ALL_SRC"

echo "[WatchNexus] ${TIER} tier: $(find "$CONTROLLERS_DIR" -maxdepth 1 -type f -name "*.cs" | wc -l) controllers"
