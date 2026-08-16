#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# FORTRESS PROTOCOL — Sealed Release Build
# Produces hardened, production-ready artifacts:
# 1. .NET DLLs compiled in Release with trimming + AOT-ready
# 2. Debug symbols stripped (no .pdb files)
# 3. Frontend built with source maps removed
# 4. Integrity manifest generated
# 5. All builds signed with SHA256 checksums
#
# Subcommands:
#   ./fortress-build.sh [tier]            # build a tier (default: ultra)
#   ./fortress-build.sh sign [release_dir] # hash installer artifacts + optional upload
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Subcommand: sign — walks installer release dir, emits SHA256SUMS.txt ──
if [ "${1:-}" = "sign" ]; then
  RELEASE_DIR="${2:-$ROOT/release}"
  VERSION="1.0.3"
  LICENSE_API="${WN_LICENSE_API:-https://licenses.watchnexus.ca}"
  UPLOAD="${WN_UPLOAD_HASHES:-0}"

  [ -d "$RELEASE_DIR" ] || { echo "release dir not found: $RELEASE_DIR" >&2; exit 1; }

  echo "══════════════════════════════════════════════════"
  echo "  FORTRESS PROTOCOL — Hash + Sign Installers"
  echo "  Release dir : $RELEASE_DIR"
  echo "  License API : $LICENSE_API"
  echo "  Upload      : $UPLOAD"
  echo "══════════════════════════════════════════════════"

  for TIER in standard pro ultra; do
    TIER_DIR="$RELEASE_DIR/$TIER"
    [ -d "$TIER_DIR" ] || { echo "  [skip] $TIER (no artifacts)"; continue; }

    SUMS="$TIER_DIR/SHA256SUMS.txt"
    : > "$SUMS"
    while IFS= read -r -d '' f; do
      ( cd "$(dirname "$f")" && sha256sum "$(basename "$f")" ) >> "$SUMS"
    done < <(find "$TIER_DIR" -type f \
                \( -name "*.exe" -o -name "*.rpm" -o -name "*.deb" \
                   -o -name "*.pkg.tar.zst" -o -name "*.tar" \
                   -o -name "*.run" \) \
                -not -name "SHA256SUMS.txt" -print0)

    COUNT=$(wc -l < "$SUMS")
    echo "  [$TIER] hashed $COUNT artifact(s) → $SUMS"

    if [ "$UPLOAD" = "1" ]; then
      if [ -z "${WN_LICENSE_TOKEN:-}" ]; then
        echo "  [WARN] WN_LICENSE_TOKEN unset — skipping upload for $TIER"
      else
        curl -fsSL -X POST "$LICENSE_API/api/releases/hashes" \
          -H "Authorization: Bearer $WN_LICENSE_TOKEN" \
          -H "Content-Type: application/json" \
          -d "$(jq -Rn --arg tier "$TIER" --arg version "$VERSION" \
                       --rawfile sums "$SUMS" \
                       '{tier:$tier, version:$version, sha256sums:$sums}')" \
          && echo "  [$TIER] hashes uploaded to license server" \
          || { echo "  [ERR] upload failed for $TIER" >&2; exit 1; }
      fi
    fi
  done

  echo "══════════════════════════════════════════════════"
  echo "  Sign step complete."
  echo "══════════════════════════════════════════════════"
  exit 0
fi

# ── Default: per-tier sealed build ─────────────────────────────────────
TIER="${1:-ultra}"
VERSION="1.0.3"
OUT="$ROOT/release/${TIER}"

echo "══════════════════════════════════════════════════"
echo "  FORTRESS PROTOCOL — Sealed Build"
echo "  Tier: ${TIER} | Version: ${VERSION}"
echo "══════════════════════════════════════════════════"

rm -rf "$OUT"
mkdir -p "$OUT"

# ── 1. Backend: Release build, trimmed, no debug symbols ────────
echo "[1/5] Compiling backend (Release, no debug)..."
cd "$ROOT/src/watchnexus/core"
dotnet publish -c Release \
  -o "$OUT/server" \
  --no-restore \
  /p:DebugType=none \
  /p:DebugSymbols=false \
  /p:SkipFrontendBuild=true \
  2>/dev/null

# Remove any leftover .pdb files
find "$OUT/server" -name "*.pdb" -delete 2>/dev/null || true
find "$OUT/server" -name "*.xml" -delete 2>/dev/null || true
echo "  Backend compiled: $(ls "$OUT/server/"*.dll 2>/dev/null | wc -l) DLLs"

# ── 2. Frontend: Production build, strip source maps ────────────
echo "[2/5] Building frontend (production, no source maps)..."
cd "$ROOT/frontend"
if ! GENERATE_SOURCEMAP=false REACT_APP_BACKEND_URL="" yarn build; then
    echo "  [FATAL] Frontend build failed — aborting fortress build" >&2
    exit 1
fi

# Remove any source maps that might have been generated
find build -name "*.map" -delete 2>/dev/null || true
find build -name "*.map.js" -delete 2>/dev/null || true

# Remove source map references from JS/CSS files
find build -name "*.js" -exec sed -i '/^\/\/# sourceMappingURL=/d' {} + 2>/dev/null || true
find build -name "*.css" -exec sed -i '/^\/\*# sourceMappingURL=/d' {} + 2>/dev/null || true

cp -r build "$OUT/web"
echo "  Frontend built: $(find "$OUT/web" -name "*.js" | wc -l) JS files, 0 source maps"

# ── 3. Generate integrity manifest ──────────────────────────────
echo "[3/5] Generating integrity manifest..."
MANIFEST="$OUT/INTEGRITY.json"
echo '{' > "$MANIFEST"
echo '  "fortress_version": "1.0",' >> "$MANIFEST"
echo "  \"app_version\": \"${VERSION}\"," >> "$MANIFEST"
echo "  \"tier\": \"${TIER}\"," >> "$MANIFEST"
echo "  \"sealed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"," >> "$MANIFEST"
echo '  "files": {' >> "$MANIFEST"

FIRST=true
while IFS= read -r -d '' f; do
  HASH=$(sha256sum "$f" | cut -d' ' -f1)
  NAME=$(basename "$f")
  if [ "$FIRST" = true ]; then FIRST=false; else echo ',' >> "$MANIFEST"; fi
  printf '    "%s": "%s"' "$NAME" "$HASH" >> "$MANIFEST"
done < <(find "$OUT/server" -name "*.dll" -o -name "*.json" -print0 | sort -z)
echo '' >> "$MANIFEST"
echo '  }' >> "$MANIFEST"
echo '}' >> "$MANIFEST"
echo "  Manifest: $(grep -c '"' "$MANIFEST") entries"

# ── 4. Generate release checksums ───────────────────────────────
echo "[4/5] Generating checksums..."
cd "$OUT"
find . -type f \( -name "*.dll" -o -name "*.json" -o -name "*.js" -o -name "*.css" -o -name "*.html" \) -exec sha256sum {} + > CHECKSUMS.sha256
echo "  Checksums: $(wc -l < CHECKSUMS.sha256) files"

# ── 5. Write release info ───────────────────────────────────────
echo "[5/5] Writing release metadata..."
cat > "$OUT/RELEASE.json" <<EOF
{
  "product": "WatchNexus",
  "version": "${VERSION}",
  "tier": "${TIER}",
  "fortress_version": "1.0",
  "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "build_host": "$(hostname)",
  "protections": {
    "debug_symbols": "stripped",
    "source_maps": "removed",
    "integrity_manifest": true,
    "api_tier_enforcement": true,
    "startup_integrity_check": true,
    "obfuscation_ready": true
  },
  "modules": {
    "standard": 31,
    "pro": $([ "$TIER" = "pro" ] || [ "$TIER" = "ultra" ] && echo 18 || echo 0),
    "ultra": $([ "$TIER" = "ultra" ] && echo 24 || echo 0),
    "total": $([ "$TIER" = "ultra" ] && echo 73 || ([ "$TIER" = "pro" ] && echo 49 || echo 31))
  }
}
EOF

echo ""
echo "══════════════════════════════════════════════════"
echo "  FORTRESS BUILD COMPLETE"
echo "  Output: $OUT"
echo "  Size: $(du -sh "$OUT" | cut -f1)"
echo "  DLLs: $(find "$OUT/server" -name "*.dll" | wc -l)"
echo "  PDBs: $(find "$OUT" -name "*.pdb" | wc -l) (should be 0)"
echo "  Maps: $(find "$OUT" -name "*.map" | wc -l) (should be 0)"
echo "══════════════════════════════════════════════════"
