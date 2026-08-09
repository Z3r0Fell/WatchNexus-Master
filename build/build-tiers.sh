#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# WatchNexus — Tier Build Packager
# Creates separate distributable artifacts for Standard, Pro, and Ultra.
# Usage: ./build-tiers.sh [standard|pro|ultra|all]
# Output: /app/dist/<tier>/
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$ROOT_DIR/src/watchnexus/core"
FRONTEND_DIR="$ROOT_DIR/frontend"
DIST_DIR="$ROOT_DIR/dist"

# ── Controller → Tier Mapping ────────────────────────────────────────
STANDARD_CONTROLLERS=(
  "CoreController.cs"
  "ContentController.cs"
  "BridgeController.cs"
  "SettingsController.cs"
  "FilesystemController.cs"
  "LibrariesController.cs"
  "SystemController.cs"
  "WeatherController.cs"
  "PodcastsController.cs"
  "RadioController.cs"
  "PhotosController.cs"
  "WebVideoController.cs"
  "CellarController.cs"
  "Helpers.cs"
)

PRO_CONTROLLERS=(
  "CoreModuleControllers.cs"
  "MediaControllers.cs"
  "TruffleController.cs"
  "SproutController.cs"
  "DrizzleController.cs"
  "MeringueController.cs"
  "IptvController.cs"
  "RouxController.cs"
  "BacklogControllers.cs"
)

ULTRA_CONTROLLERS=(
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
  "CodeNameAliasControllers.cs"
  "FeatureControllers.cs"
)

# ── Frontend Page → Tier Mapping ─────────────────────────────────────
STANDARD_PAGES=(
  "Dashboard.js" "LibraryPage.js" "MoviesPage.js" "TVShowsPage.js"
  "AnimePage.js" "MusicPage.js" "PlaylistsPage.js" "DiscoverPage.js"
  "SearchPage.js" "WatchlistPage.js" "DownloadsPage.js" "MediaDetails.js"
  "MediaBrowserPage.js" "LibraryManagerPage.js" "SettingsPage.js"
  "SystemPage.js" "LogViewerPage.js" "HelpPage.jsx"
  "ChurroPage.jsx" "RouxPage.jsx" "GlazePage.jsx"
)

STANDARD_GADGET_PAGES=(
  "WeatherPage.jsx" "PodcastsPage.jsx" "RadioPage.jsx"
  "PhotosPage.jsx" "WebVideoPage.jsx"
)

PRO_PAGES=(
  "IndexerSearchPage.js" "FonduePage.jsx" "SaffronPage.jsx"
  "SourdoughPage.jsx" "SproutPage.jsx" "StreamingPage.js"
  "WatchHistoryPage.js" "DVRPage.js" "LiveTVPage.js"
  "BiscottiPage.jsx" "TreaclePage.jsx" "SagePage.jsx" "TerrinePage.jsx"
)

PRO_GADGET_PAGES=(
  "AnalyticsPage.jsx" "RequestsPage.jsx"
)

ULTRA_PAGES=(
  "SecurityPage.js" "VpnPage.js" "StrudelPage.jsx"
  "WatchPartyPage.js" "PluginMarketplacePage.js" "ThemeCommunityPage.js"
  "ParfaitPage.jsx" "MenuPage.jsx" "PretzelPage.jsx"
  "PopsiclePage.jsx" "PreservesPage.jsx" "MarshmallowPage.jsx"
)

ULTRA_GADGET_PAGES=(
  "NotificationsPage.jsx" "ParentalControlsPage.jsx"
  "ProcessingPage.jsx" "UsenetPage.jsx"
)

# ── Build Function ───────────────────────────────────────────────────
build_tier() {
  local TIER=$1
  local OUT="$DIST_DIR/$TIER"
  echo "══════════════════════════════════════════════════"
  echo "  Building WatchNexus $TIER"
  echo "══════════════════════════════════════════════════"

  rm -rf "$OUT"
  mkdir -p "$OUT/backend/Controllers" "$OUT/frontend/pages" "$OUT/frontend/pages/gadgets"

  # Copy standard controllers always
  for f in "${STANDARD_CONTROLLERS[@]}"; do
    [ -f "$SRC_DIR/Controllers/$f" ] && cp "$SRC_DIR/Controllers/$f" "$OUT/backend/Controllers/"
  done

  # Copy standard pages
  for f in "${STANDARD_PAGES[@]}"; do
    [ -f "$FRONTEND_DIR/src/pages/$f" ] && cp "$FRONTEND_DIR/src/pages/$f" "$OUT/frontend/pages/"
  done
  for f in "${STANDARD_GADGET_PAGES[@]}"; do
    [ -f "$FRONTEND_DIR/src/pages/gadgets/$f" ] && cp "$FRONTEND_DIR/src/pages/gadgets/$f" "$OUT/frontend/pages/gadgets/"
  done

  # Pro tier includes pro controllers + pages
  if [ "$TIER" = "pro" ] || [ "$TIER" = "ultra" ]; then
    for f in "${PRO_CONTROLLERS[@]}"; do
      [ -f "$SRC_DIR/Controllers/$f" ] && cp "$SRC_DIR/Controllers/$f" "$OUT/backend/Controllers/"
    done
    for f in "${PRO_PAGES[@]}"; do
      [ -f "$FRONTEND_DIR/src/pages/$f" ] && cp "$FRONTEND_DIR/src/pages/$f" "$OUT/frontend/pages/"
    done
    for f in "${PRO_GADGET_PAGES[@]}"; do
      [ -f "$FRONTEND_DIR/src/pages/gadgets/$f" ] && cp "$FRONTEND_DIR/src/pages/gadgets/$f" "$OUT/frontend/pages/gadgets/"
    done
  fi

  # Ultra tier includes ultra controllers + pages
  if [ "$TIER" = "ultra" ]; then
    for f in "${ULTRA_CONTROLLERS[@]}"; do
      [ -f "$SRC_DIR/Controllers/$f" ] && cp "$SRC_DIR/Controllers/$f" "$OUT/backend/Controllers/"
    done
    for f in "${ULTRA_PAGES[@]}"; do
      [ -f "$FRONTEND_DIR/src/pages/$f" ] && cp "$FRONTEND_DIR/src/pages/$f" "$OUT/frontend/pages/"
    done
    for f in "${ULTRA_GADGET_PAGES[@]}"; do
      [ -f "$FRONTEND_DIR/src/pages/gadgets/$f" ] && cp "$FRONTEND_DIR/src/pages/gadgets/$f" "$OUT/frontend/pages/gadgets/"
    done
  fi

  # Copy shared infrastructure that EVERY tier needs to compile
  cp -r "$SRC_DIR/Data"        "$OUT/backend/" 2>/dev/null || true
  cp -r "$SRC_DIR/Models"      "$OUT/backend/" 2>/dev/null || true
  cp -r "$SRC_DIR/Auth"        "$OUT/backend/" 2>/dev/null || true     # AuthService.cs
  cp -r "$SRC_DIR/Services"    "$OUT/backend/" 2>/dev/null || true     # TrayIconService, BotBackgroundService
  cp -r "$SRC_DIR/Properties"  "$OUT/backend/" 2>/dev/null || true     # launchSettings, etc.
  cp "$SRC_DIR/WatchNexus.Core.csproj" "$OUT/backend/" 2>/dev/null || true
  cp "$SRC_DIR/Program.cs"             "$OUT/backend/" 2>/dev/null || true
  cp "$SRC_DIR/appsettings.json"       "$OUT/backend/" 2>/dev/null || true
  cp "$SRC_DIR/appsettings.Development.json" "$OUT/backend/" 2>/dev/null || true

  # The csproj references ../shared/WatchNexus.Shared.csproj — replicate that layout
  rm -rf "$OUT/shared"
  mkdir -p "$OUT/shared"
  cp "$ROOT_DIR/src/watchnexus/shared/"*.cs      "$OUT/shared/" 2>/dev/null || true
  cp "$ROOT_DIR/src/watchnexus/shared/"*.csproj  "$OUT/shared/" 2>/dev/null || true

  # Write tier manifest
  cat > "$OUT/tier.json" <<EOF
{
  "tier": "$TIER",
  "version": "1.0.1",
  "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "controllers": $(ls "$OUT/backend/Controllers/" 2>/dev/null | wc -l),
  "pages": $(find "$OUT/frontend/pages" \( -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l)
}
EOF

  echo "  Output: $OUT"
  echo "  Controllers: $(ls "$OUT/backend/Controllers/" 2>/dev/null | wc -l)"
  echo "  Pages: $(find "$OUT/frontend/pages" \( -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l)"
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────
TARGET="${1:-all}"

case "$TARGET" in
  standard) build_tier "standard" ;;
  pro) build_tier "pro" ;;
  ultra) build_tier "ultra" ;;
  all)
    build_tier "standard"
    build_tier "pro"
    build_tier "ultra"
    echo "All tiers built in $DIST_DIR"
    ;;
  *) echo "Usage: $0 [standard|pro|ultra|all]"; exit 1 ;;
esac
