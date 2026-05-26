#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# Tier-based controller copy script
# Called during Docker build to include only the controllers for the
# specified tier (standard, pro, or ultra).
# ══════════════════════════════════════════════════════════════════════
set -e

TIER="${1:-standard}"
SRC="/build/src/watchnexus/core/Controllers"
CONTROLLERS_DIR="/build/src/watchnexus/core/Controllers"

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

# All controller source files
ALL_SRC="/build/src/watchnexus/core/Controllers_all"

# Move all controllers to a temp location, then selectively copy back
if [ -d "$ALL_SRC" ]; then
    echo "  Controllers_all already exists, using it"
else
    cp -r "$CONTROLLERS_DIR" "$ALL_SRC"
fi

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

echo "[WatchNexus] ${TIER} tier: $(ls $CONTROLLERS_DIR/*.cs 2>/dev/null | wc -l) controllers"
