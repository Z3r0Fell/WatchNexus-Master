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
#   ./docker-build.sh --no-cache      # Build all with --no-cache
#   ./docker-build.sh --multiarch     # Build multi-arch (linux/amd64,linux/arm64)
#
# Registry: Set DOCKER_REGISTRY env var (default: watchnexus)
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

REGISTRY="${DOCKER_REGISTRY:-watchnexus}"
VERSION="1.0.1"
PUSH=false
NO_CACHE=false
MULTIARCH=false
TIERS=("standard" "pro" "ultra")

# Parse args
for arg in "$@"; do
  case $arg in
    --push) PUSH=true ;;
    --no-cache) NO_CACHE=true ;;
    --multiarch) MULTIARCH=true ;;
    standard|pro|ultra) TIERS=("$arg") ;;
  esac
done

echo "══════════════════════════════════════════════════"
echo "  WatchNexus Docker Build Pipeline v${VERSION}"
echo "  Registry: ${REGISTRY}"
echo "  Tiers: ${TIERS[*]}"
echo "  Push: ${PUSH}"
echo "  No Cache: ${NO_CACHE}"
echo "══════════════════════════════════════════════════"
echo ""

for TIER in "${TIERS[@]}"; do
  IMAGE="${REGISTRY}/watchnexus:${VERSION}-${TIER}"
  IMAGE_LATEST="${REGISTRY}/watchnexus:latest-${TIER}"

  echo "──────────────────────────────────────────────────"
  echo "  Building: ${IMAGE}"
  echo "──────────────────────────────────────────────────"

  BUILD_ARGS=(
    --build-arg "TIER=${TIER}"
    --tag "${IMAGE}"
    --tag "${IMAGE_LATEST}"
    --label "com.watchnexus.tier=${TIER}"
    --label "com.watchnexus.version=${VERSION}"
    --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    -f Dockerfile
    .
  )

  if [ "$MULTIARCH" = true ]; then
    BUILD_CMD="docker buildx build --platform linux/amd64,linux/arm64"
    if [ "$PUSH" = true ]; then
      BUILD_CMD+=" --push"
    else
      BUILD_CMD+=" --load"
    fi
  else
    BUILD_CMD="docker build"
  fi

  if [ "$NO_CACHE" = true ]; then
    BUILD_ARGS+=(--no-cache)
  fi

  $BUILD_CMD "${BUILD_ARGS[@]}"

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

# Cleanup dangling images to save disk space
echo ""
echo "Cleaning up dangling images..."
docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true

echo ""
echo "══════════════════════════════════════════════════"
echo "  Build Complete!"
echo ""
echo "  Run with:"
echo "    docker run -p 8001:8001 ${REGISTRY}/watchnexus:${VERSION}-standard"
echo "    docker run -p 8001:8001 ${REGISTRY}/watchnexus:${VERSION}-pro"
echo "    docker run -p 8001:8001 ${REGISTRY}/watchnexus:${VERSION}-ultra"
echo ""
echo "  Or with compose:"
echo "    docker compose --profile standard up -d"
echo "    docker compose --profile pro up -d"
echo "    docker compose --profile ultra up -d"
echo "══════════════════════════════════════════════════"
