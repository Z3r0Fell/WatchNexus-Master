#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# WatchNexus — Docker Image Build & Push Script
# Builds and optionally pushes all three tier images.
#
# Usage:
#   ./docker-build.sh                 # Build all tiers
#   ./docker-build.sh standard        # Build standard only
#   ./docker-build.sh --push          # Build all + push to registry
#   ./docker-build.sh ultra --push    # Build ultra + push
#
# Registry: Set DOCKER_REGISTRY env var (default: watchnexus)
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

REGISTRY="${DOCKER_REGISTRY:-watchnexus}"
VERSION="1.0.0"
PUSH=false
TIERS=("standard" "pro" "ultra")

# Parse args
for arg in "$@"; do
  case $arg in
    --push) PUSH=true ;;
    standard|pro|ultra) TIERS=("$arg") ;;
  esac
done

echo "══════════════════════════════════════════════════"
echo "  WatchNexus Docker Build Pipeline v${VERSION}"
echo "  Registry: ${REGISTRY}"
echo "  Tiers: ${TIERS[*]}"
echo "  Push: ${PUSH}"
echo "══════════════════════════════════════════════════"
echo ""

for TIER in "${TIERS[@]}"; do
  IMAGE="${REGISTRY}/watchnexus:${VERSION}-${TIER}"
  IMAGE_LATEST="${REGISTRY}/watchnexus:latest-${TIER}"

  echo "──────────────────────────────────────────────────"
  echo "  Building: ${IMAGE}"
  echo "──────────────────────────────────────────────────"

  docker build \
    --build-arg TIER="${TIER}" \
    --tag "${IMAGE}" \
    --tag "${IMAGE_LATEST}" \
    --label "com.watchnexus.tier=${TIER}" \
    --label "com.watchnexus.version=${VERSION}" \
    --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -f Dockerfile \
    .

  echo "  Built: ${IMAGE}"
  echo "  Size: $(docker image inspect ${IMAGE} --format='{{.Size}}' | numfmt --to=iec 2>/dev/null || echo 'unknown')"

  if [ "$PUSH" = true ]; then
    echo "  Pushing..."
    docker push "${IMAGE}"
    docker push "${IMAGE_LATEST}"
    echo "  Pushed: ${IMAGE}"
  fi

  echo ""
done

# Tag the ultra edition as the default 'latest'
if [[ " ${TIERS[*]} " =~ " ultra " ]]; then
  docker tag "${REGISTRY}/watchnexus:${VERSION}-ultra" "${REGISTRY}/watchnexus:latest"
  echo "Tagged ultra as ${REGISTRY}/watchnexus:latest"
  if [ "$PUSH" = true ]; then
    docker push "${REGISTRY}/watchnexus:latest"
  fi
fi

echo ""
echo "══════════════════════════════════════════════════"
echo "  Build Complete!"
echo ""
echo "  Run with:"
echo "    docker run -p 8002:8002 ${REGISTRY}/watchnexus:${VERSION}-standard"
echo "    docker run -p 8002:8002 ${REGISTRY}/watchnexus:${VERSION}-pro"
echo "    docker run -p 8002:8002 ${REGISTRY}/watchnexus:${VERSION}-ultra"
echo ""
echo "  Or with compose:"
echo "    docker compose --profile standard up -d"
echo "    docker compose --profile pro up -d"
echo "    docker compose --profile ultra up -d"
echo "══════════════════════════════════════════════════"
