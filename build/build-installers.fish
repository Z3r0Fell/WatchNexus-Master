#!/usr/bin/env fish
# ══════════════════════════════════════════════════════════════════════
#  WatchNexus — Release Support Artifacts (fish)
#  ──────────────────────────────────────────────────────────────────
#  Business decision (2026-09-16): Docker is the ONLY installation and
#  release channel. Native installers (.deb / .rpm / .pkg.tar.zst /
#  Windows .exe) are DISCONTINUED and are no longer built.
#
#  Release images are produced by build/docker-build.sh. This script
#  generates the Docker-adjacent artifacts that ship alongside them:
#     • community-hub templates (Unraid / TrueNAS / CasaOS / HexOS /
#       Portainer / Synology) — all Docker / compose based
#     • optional offline `docker save` tarballs per tier
#
#  Usage:
#      ./build-installers.fish [standard|pro|ultra|all] [--docker] [--no-community]
#
#  Flags:
#      --docker         also `docker save` loadable tarballs per tier
#      --no-community   skip community-hub template generation
# ══════════════════════════════════════════════════════════════════════

set -g SCRIPT_DIR (dirname (status -f))
set -g ROOT_DIR (realpath "$SCRIPT_DIR/..")
set -g STAGE_DIR "$ROOT_DIR/stage"
set -g RELEASE_DIR "$ROOT_DIR/release"
set -g VERSION "1.0.4"
set -g VENDOR "WatchNexus Media Systems"
set -g URL "https://watchnexus.ca"
set -g LICENSE "Proprietary"

# ── Parse args ──────────────────────────────────────────────────────
set -l TARGET "all"
set -g DO_DOCKER 0
set -g DO_COMMUNITY 1
for arg in $argv
    switch $arg
        case standard pro ultra all
            set TARGET $arg
        case --docker
            set DO_DOCKER 1
        case --no-community
            set DO_COMMUNITY 0
        case '*'
            echo "Unknown arg: $arg"
            echo "Usage: "(status -f)" [standard|pro|ultra|all] [--docker] [--no-community]"
            exit 1
    end
end

if test "$TARGET" = "all"
    set -g TIERS standard pro ultra
else
    set -g TIERS $TARGET
end

# ── Pre-flight checks ───────────────────────────────────────────────
function require
    if not command -v $argv[1] > /dev/null
        echo "[!] Missing: $argv[1] — install with: $argv[2]"
        exit 1
    end
end

if test "$DO_DOCKER" = "1"
    require docker "https://docs.docker.com/engine/install/"
end

echo "══════════════════════════════════════════════════"
echo "  WatchNexus Release Support Artifacts  (v$VERSION)"
echo "  Root      : $ROOT_DIR"
echo "  Release   : $RELEASE_DIR"
echo "  Tiers     : $TIERS"
echo "  Docker    : $DO_DOCKER"
echo "  Community : $DO_COMMUNITY"
echo ""
echo "  NOTE: Native installers (.deb/.rpm/.pkg.tar.zst/.exe) are"
echo "  discontinued. Release images come from build/docker-build.sh."
echo "══════════════════════════════════════════════════"

# ── Step 1: Docker tarballs (optional, --docker) ────────────────────
# For offline distribution through the same single Docker channel.
if test "$DO_DOCKER" = "1"
    echo ""
    echo "[1/2] Exporting Docker tarballs..."
    for tier in $TIERS
        set -l img "watchnexus/watchnexus:$VERSION-$tier"
        set -l outdir "$RELEASE_DIR/$tier/docker"
        mkdir -p "$outdir"
        set -l tarball "$outdir/watchnexus-$tier-$VERSION-docker.tar"
        echo "  [$tier] → $img"
        if docker image inspect "$img" > /dev/null 2>&1
            docker save "$img" -o "$tarball"
            if test $status -eq 0
                echo "    saved: "(basename "$tarball")"  ("(du -h "$tarball" | cut -f1)")"
            else
                echo "    [!] docker save failed for $tier"
            end
        else
            echo "    [!] image $img not present locally — build it first via ./build/docker-build.sh $tier"
        end
    end
end

# ── Step 2: Community-hub artifacts (Unraid / HexOS / TrueNAS / CasaOS / Portainer / Synology)
if test "$DO_COMMUNITY" = "1"
    echo ""
    echo "[2/2] Generating community-hub artifacts..."
    set -g COMMUNITY_TEMPLATES "$SCRIPT_DIR/packaging/community/_templates"

    function render -a src dst tier
        set -l tier_title (string upper -- (string sub -l 1 -- $tier))(string sub -s 2 -- $tier)
        set -l tier_features
        switch $tier
            case standard
                set tier_features "31 modules: libraries, playback, scrobbling, discovery, podcasts, radio, photos."
            case pro
                set tier_features "49 modules: everything in Standard plus *arr automation, backups, download clients, collections, live-TV DVR, analytics."
            case ultra
                set tier_features "73 modules: everything in Pro plus Bastion 2FA, Tunnel VPN, Strudel rip pipeline, hardware transcoding, Parfait/Menu discovery, Chowder sync, Pretzel emulator, S3 backup, cloud sync."
        end
        sed -e "s|@TIER@|$tier|g" \
            -e "s|@TIER_TITLE@|$tier_title|g" \
            -e "s|@VERSION@|$VERSION|g" \
            -e "s|@TIER_FEATURES@|$tier_features|g" \
            "$src" > "$dst"
    end

    for tier in $TIERS
        set -l hub "$RELEASE_DIR/$tier/community-hubs"
        rm -rf "$hub"
        mkdir -p "$hub/truenas"

        render "$COMMUNITY_TEMPLATES/docker-compose.yml.in"          "$hub/docker-compose.yml"           $tier
        render "$COMMUNITY_TEMPLATES/unraid-template.xml.in"         "$hub/unraid-watchnexus-$tier.xml"  $tier
        render "$COMMUNITY_TEMPLATES/casaos-app.json.in"             "$hub/casaos-app.json"              $tier
        render "$COMMUNITY_TEMPLATES/hexos-compose.yml.in"           "$hub/hexos-compose.yml"            $tier
        render "$COMMUNITY_TEMPLATES/portainer-template.json.in"     "$hub/portainer-template.json"      $tier
        render "$COMMUNITY_TEMPLATES/portainer-stack.yml.in"         "$hub/portainer-stack.yml"          $tier
        render "$COMMUNITY_TEMPLATES/synology-README.md.in"          "$hub/synology-README.md"           $tier
        render "$COMMUNITY_TEMPLATES/truenas/Chart.yaml.in"          "$hub/truenas/Chart.yaml"           $tier
        render "$COMMUNITY_TEMPLATES/truenas/values.yaml.in"         "$hub/truenas/values.yaml"          $tier

        set -l count (find "$hub" -type f | wc -l)
        echo "  [$tier] $count files → $hub"
    end
end

# ── Step 3: SHA-256 manifest ────────────────────────────────────────
echo ""
echo "Generating SHA256SUMS over release support artifacts..."
chmod +x "$SCRIPT_DIR/fortress-build.sh"
bash "$SCRIPT_DIR/fortress-build.sh" sign "$RELEASE_DIR"

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo "  Build complete."
echo ""
echo "  Output tree:"
set -g TOTAL_ARTIFACTS 0
for tier in $TIERS
    set -l tier_dir "$RELEASE_DIR/$tier"
    test -d "$tier_dir"; or continue
    set -l tier_count 0
    echo "    [$tier]"
    for f in "$tier_dir"/docker/*.tar
        test -f "$f"; or continue
        set -l size (du -h "$f" | cut -f1)
        echo "      $size  "(basename "$f")
        set tier_count (math $tier_count + 1)
        set TOTAL_ARTIFACTS (math $TOTAL_ARTIFACTS + 1)
    end
    if test -d "$tier_dir/community-hubs"
        set -l hub_count (find "$tier_dir/community-hubs" -type f | wc -l)
        echo "      "(string trim "$hub_count")"   community-hub files in community-hubs/"
    end
    if test $tier_count -eq 0
        echo "      (no docker tarballs — build images first or pass --docker)"
    end
end
echo ""
echo "  Total release artifacts: $TOTAL_ARTIFACTS"
echo ""
echo "  Next:"
echo "    1. Publish images:  ./build/docker-build.sh --push --multiarch"
echo "    2. rsync release/ to the webspace / release server."
echo "══════════════════════════════════════════════════"