#!/usr/bin/env bash
# Usage: ./make-patch.sh <patch_id> <app_version> [description]
# Builds Patches/<app_version>.json from the files in Patches/files/<patch_id>/
set -euo pipefail
PATCH_ID="${1:?patch_id required}"
VERSION="${2:?app version required (e.g. 1.0.0)}"
DESC="${3:-Hotfix $PATCH_ID}"
DIR="Patches/files/$PATCH_ID"
[ -d "$DIR" ] || { echo "No files at $DIR"; exit 1; }

FILES_JSON=""
while IFS= read -r f; do
  REL="${f#"$DIR"/}"
  SHA=$(sha256sum "$f" | cut -d' ' -f1)
  case "$REL" in
    *.dll|*.exe|*.so|*.dylib) TARGET="app" ;;   # staged, needs restart
    *) TARGET="web" ;;                          # applied live, no restart
  esac
  FILES_JSON+="    { \"path\": \"$REL\", \"target\": \"$TARGET\", \"sha256\": \"$SHA\" },\n"
done < <(find "$DIR" -type f | sort)
FILES_JSON=$(printf "%b" "$FILES_JSON" | sed '$ s/,$//')

cat > "Patches/$VERSION.json" <<MANIFEST
{
  "patch_id": "$PATCH_ID",
  "description": "$DESC",
  "severity": "low",
  "silent": true,
  "files": [
$FILES_JSON
  ]
}
MANIFEST
echo "Wrote Patches/$VERSION.json ($(find "$DIR" -type f | wc -l) file(s))"
