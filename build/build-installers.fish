#!/usr/bin/env fish
# ══════════════════════════════════════════════════════════════════════
#  WatchNexus — Installer Build (fish + fpm + NSIS)
#  ──────────────────────────────────────────────────────────────────
#  Target host:  Arch Linux, fish shell, all build deps installed.
#  Replaces:     BitRock InstallBuilder (deleted)
#  Produces:     .deb / .rpm / .pkg.tar.zst / Windows .exe per tier.
#
#  Usage:
#      ./build-installers.fish [standard|pro|ultra|all] [--sign] [--upload]
#
#  Flags:
#      --sign     run osslsigncode on the Windows EXE artifacts
#      --upload   POST SHA256SUMS.txt to https://licenses.watchnexus.ca
#
#  Prerequisites (one-time, on this Arch laptop):
#      sudo pacman -S --needed ruby dotnet-sdk nodejs npm yarn jq \
#                              osslsigncode rpm-tools nsis fakeroot
#      # Ruby 3.4 split several stdlibs out of core; fpm needs them as gems:
#      gem install --user-install fpm erb mutex_m getoptlong base64 fiddle
#      set -Ux PATH (ruby -e 'puts Gem.user_dir')/bin \$PATH
#
#  If fpm dies with `cannot load such file -- erb (LoadError)` on Arch,
#  this script will auto-install the missing stdlib gem as a user gem.
# ══════════════════════════════════════════════════════════════════════

set -g SCRIPT_DIR (dirname (status -f))
set -g ROOT_DIR (realpath "$SCRIPT_DIR/..")
set -g STAGE_DIR "$ROOT_DIR/stage"
set -g RELEASE_DIR "$ROOT_DIR/release"
set -g NSIS_TEMPLATE "$SCRIPT_DIR/packaging/nsis/watchnexus.nsi.in"
set -g FPM_HOOKS_DIR "$SCRIPT_DIR/packaging/fpm"
set -g VERSION "1.0.1"
set -g VENDOR "WatchNexus Media Systems"
set -g URL "https://watchnexus.ca"
set -g LICENSE "Proprietary"
set -g MAINTAINER "Auz Larocque <support@watchnexus.ca>"

# ── Parse args ──────────────────────────────────────────────────────
set -l TARGET "all"
set -g DO_SIGN 0
set -g DO_UPLOAD 0
set -g SKIP_STAGE 0
set -g DO_DOCKER 0
set -g DO_COMMUNITY 1
for arg in $argv
    switch $arg
        case standard pro ultra all
            set TARGET $arg
        case --sign
            set DO_SIGN 1
        case --upload
            set DO_UPLOAD 1
        case --skip-stage
            set SKIP_STAGE 1
        case --docker
            set DO_DOCKER 1
        case --no-community
            set DO_COMMUNITY 0
        case '*'
            echo "Unknown arg: $arg"
            echo "Usage: "(status -f)" [standard|pro|ultra|all] [--sign] [--upload] [--skip-stage] [--docker] [--no-community]"
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

require dotnet         "sudo pacman -S dotnet-sdk"
require yarn           "sudo pacman -S yarn"
require jq             "sudo pacman -S jq"
require fpm            "gem install --user-install fpm"
require makensis       "sudo pacman -S nsis"
require rpmbuild       "sudo pacman -S rpm-tools"
# Note: fpm's pacman target uses bsdtar + zstd internally; no need for
# makepkg. fakeroot is only needed if you're cross-building debs as a
# non-root user; modern fpm handles dpkg-deb directly.

# ── fpm health-check (Ruby 3.4+ vs fpm 1.17 bundled-gem fallout) ────
# Ruby 3.4 moved several modules out of the default stdlib into
# bundled/default gems. fpm 1.17 still `require`s them eagerly. The
# trick is that *system* `ruby -r erb -e 0` may succeed (Arch's ruby
# package still finds erb), while `fpm` running through the user-gem
# wrapper does NOT — because the gem stub's $LOAD_PATH excludes the
# system bundled gems. So we can't probe with bare ruby. Instead we
# probe by invoking fpm itself and parsing its LoadError for the
# missing module name; we then `gem install --user-install` it and
# loop until fpm prints its version banner cleanly.
function preflight_fpm
    set -l max_attempts 8
    set -l attempt 0
    while test $attempt -lt $max_attempts
        set -l out (fpm --version 2>&1)
        if test $status -eq 0
            return 0
        end
        # Parse: "cannot load such file -- erb (LoadError)"
        set -l missing (string match -r 'cannot load such file -- (\w+)' -- $out | tail -n 1)
        if test -z "$missing"
            echo "[!] fpm preflight failed and no LoadError pattern matched. Raw output:"
            for line in $out
                echo "    $line"
            end
            return 1
        end
        set attempt (math $attempt + 1)
        echo "  [fpm] missing gem '$missing' (attempt $attempt) — installing as user gem..."
        gem install --user-install --no-document "$missing" > /dev/null 2>&1
        or begin
            echo "[!] gem install --user-install $missing failed."
            echo "    Try: sudo pacman -S ruby-$missing"
            echo "    Or:  gem install --user-install $missing"
            return 1
        end
    end
    echo "[!] fpm still failing after $max_attempts auto-installs. Bailing."
    return 1
end

echo "[ruby] checking fpm health..."
preflight_fpm
or exit 1
echo "[ruby] fpm "(fpm --version 2>/dev/null)" — OK"

if test "$DO_SIGN" = "1"
    require osslsigncode "sudo pacman -S osslsigncode"
    require openssl      "sudo pacman -S openssl"

    # Resolve the .pfx path (env override → default)
    if test -z "$WN_PFX_PATH"
        set -g WN_PFX_PATH "/opt/signing/watchnexus.pfx"
    end
    if not test -f "$WN_PFX_PATH"
        echo "[!] --sign needs a PKCS12 (.pfx) certificate."
        echo "    Looked at: $WN_PFX_PATH"
        echo "    Override with:  set -x WN_PFX_PATH /path/to/your.pfx"
        exit 1
    end

    # Prompt for passphrase if not already in the environment.
    # Reads silently (no echo) — fish's read -s.
    if test -z "$WN_SIGN_PASS"
        echo ""
        echo "PFX file: $WN_PFX_PATH"
        read -sP "Enter PFX passphrase (input hidden): " WN_SIGN_PASS
        echo ""
        if test -z "$WN_SIGN_PASS"
            echo "[!] Empty passphrase — aborting."
            exit 1
        end

        # Verify the passphrase opens the .pfx before we kick off a long build
        echo -n "Verifying passphrase... "
        if openssl pkcs12 -in "$WN_PFX_PATH" -passin "pass:$WN_SIGN_PASS" \
                          -nokeys -noout > /dev/null 2>&1
            echo "ok."
        else
            echo "FAILED."
            echo "[!] The passphrase did not open $WN_PFX_PATH. Aborting."
            set -e WN_SIGN_PASS
            exit 1
        end
        set -gx WN_SIGN_PASS $WN_SIGN_PASS
    else
        echo "PFX passphrase: using \$WN_SIGN_PASS from environment."
    end

    # Timestamp server (override-able)
    if test -z "$WN_TIMESTAMP_URL"
        set -g WN_TIMESTAMP_URL "http://timestamp.digicert.com"
    end
end

echo "══════════════════════════════════════════════════"
echo "  WatchNexus Installer Build  (v$VERSION)"
echo "  Root      : $ROOT_DIR"
echo "  Stage     : $STAGE_DIR"
echo "  Release   : $RELEASE_DIR"
echo "  Tiers     : $TIERS"
echo "  Sign      : $DO_SIGN"
echo "  Upload    : $DO_UPLOAD"
echo "  Docker    : $DO_DOCKER"
echo "  Community : $DO_COMMUNITY"
echo "══════════════════════════════════════════════════"

# ── Step 1: Stage tier payloads (delegates to bash script) ──────────
if test "$SKIP_STAGE" = "1"
    echo ""
    echo "[1/7] Skipping staging (--skip-stage); reusing existing $STAGE_DIR"
    for tier in $TIERS
        if not test -f "$STAGE_DIR/$tier/publish/web/index.html"
            echo "  [!] stage/$tier looks incomplete — cannot --skip-stage. Run without the flag."
            exit 1
        end
    end
else
    echo ""
    echo "[1/7] Staging tier payloads via prepare-installers.sh..."
    chmod +x "$SCRIPT_DIR/prepare-installers.sh"
    bash "$SCRIPT_DIR/prepare-installers.sh" $TARGET
    or begin
        echo "[!] prepare-installers.sh failed"
        exit 1
    end
end

# ── Step 2: Per-tier Linux packages via fpm ─────────────────────────
echo ""
echo "[2/7] Building Linux packages via fpm..."

function build_linux_packages -a tier
    set -l payload_x64 "$STAGE_DIR/$tier/publish/linux-x64"
    set -l payload_arm64 "$STAGE_DIR/$tier/publish/linux-arm64"
    set -l web_payload "$STAGE_DIR/$tier/publish/web"
    set -l out "$RELEASE_DIR/$tier"
    set -l pkg_name "watchnexus-$tier"
    set -l tier_title (string upper -- (string sub -l 1 -- $tier))(string sub -s 2 -- $tier)

    if not test -d "$payload_x64"
        echo "  [!] Missing x64 payload: $payload_x64"
        echo "      STAGE_DIR=$STAGE_DIR  RELEASE_DIR=$RELEASE_DIR"
        echo "      Did prepare-installers.sh complete? Inspect $STAGE_DIR/$tier/ tree."
        return 1
    end

    mkdir -p "$out"

    # Build for each available architecture
    set -l arches
    if test -d "$payload_x64"
        set -a arches x86_64
    end
    if test -d "$payload_arm64"
        set -a arches arm64
    end

    for arch in $arches
        set -l payload
        if test "$arch" = "x86_64"
            set payload "$payload_x64"
        else
            set payload "$payload_arm64"
        end

        # Layout fpm pulls from. We feed it a staging root with:
        #   opt/watchnexus/bin/        (linux binaries)
        #   opt/watchnexus/web/        (frontend bundle)
        #   opt/watchnexus/tier.lock   (marker file the post-install reads)
        #   opt/watchnexus/version.lock
        #   opt/watchnexus/LICENSE.txt
        #   opt/watchnexus/LICENSE.html
        #   opt/watchnexus/README.md
        #   usr/lib/systemd/system/watchnexus.service
        set -l root "$out/_fpm_root_${tier}_${arch}"
        rm -rf "$root"
        mkdir -p "$root/opt/watchnexus/bin" \
                 "$root/opt/watchnexus/web" \
                 "$root/usr/lib/systemd/system" \
                 "$root/usr/bin" \
                 "$root/etc/xdg/autostart" \
                 "$root/usr/share/icons/hicolor/256x256/apps" \
                 "$root/usr/share/applications"

        cp -a "$payload/." "$root/opt/watchnexus/bin/"
        cp -a "$web_payload/." "$root/opt/watchnexus/web/"
        echo "$tier"    > "$root/opt/watchnexus/tier.lock"
        echo "$VERSION" > "$root/opt/watchnexus/version.lock"
        cp "$STAGE_DIR/$tier/LICENSE.txt"  "$root/opt/watchnexus/LICENSE.txt"  2>/dev/null
        cp "$STAGE_DIR/$tier/LICENSE.html" "$root/opt/watchnexus/LICENSE.html" 2>/dev/null
        cp "$STAGE_DIR/$tier/README.md"    "$root/opt/watchnexus/README.md"    2>/dev/null

        # systemd unit (same for all tiers)
        cp "$FPM_HOOKS_DIR/service/watchnexus.service" \
           "$root/usr/lib/systemd/system/watchnexus.service"

        # ── User-session tray controller (new in v1.0.0) ─────────────
        # /usr/bin/watchnexus-tray launches the Core binary in --tray mode
        # for each interactive user. /etc/xdg/autostart/* auto-starts it on
        # GUI login. The hicolor icon supports the AppIndicator's "icon=watchnexus".
        cp "$FPM_HOOKS_DIR/bin/watchnexus-tray" "$root/usr/bin/watchnexus-tray"
        chmod +x "$root/usr/bin/watchnexus-tray"
        cp "$FPM_HOOKS_DIR/xdg-autostart/watchnexus-tray.desktop" \
           "$root/etc/xdg/autostart/watchnexus-tray.desktop"
        # App launcher entry (Activities / app drawer)
        cp "$FPM_HOOKS_DIR/xdg-autostart/watchnexus-tray.desktop" \
           "$root/usr/share/applications/watchnexus.desktop"
        # System icon (so `Icon=watchnexus` in the .desktop resolves)
        cp "$SCRIPT_DIR/packaging/resources/watchnexus-logo.png" \
           "$root/usr/share/icons/hicolor/256x256/apps/watchnexus.png" 2>/dev/null
        # Drop the .ico into /opt so the TrayController can find a square icon
        # via its candidate path resolver.
        cp "$SCRIPT_DIR/packaging/resources/watchnexus.ico" \
           "$root/opt/watchnexus/watchnexus.ico" 2>/dev/null

        set -l common_args \
            --name "$pkg_name" \
            --version "$VERSION" \
            --license "$LICENSE" \
            --vendor "$VENDOR" \
            --maintainer "$MAINTAINER" \
            --url "$URL" \
            --description "WatchNexus $tier_title — modular media server, v$VERSION (RTP 1.0)" \
            --architecture "$arch" \
            --after-install "$FPM_HOOKS_DIR/after-install.sh" \
            --before-remove "$FPM_HOOKS_DIR/before-remove.sh" \
            --after-remove  "$FPM_HOOKS_DIR/after-remove.sh"

        # ── DEB ────────────────────────────────────────────────────────
        echo "  [$tier] → .deb ($arch)"
        mkdir -p "$out/deb"
        fpm -s dir -t deb \
            $common_args \
            --depends "libicu70 | libicu71 | libicu72 | libicu74" \
            --depends "libkrb5-3" \
            --depends "zlib1g" \
            --deb-priority optional \
            --deb-compression xz \
            --category "video" \
            --package "$out/deb/" \
            -C "$root" \
            opt usr etc 2>&1
        set -l deb_status $status
        if test $deb_status -ne 0
            echo "  [!] fpm deb exited $deb_status for $tier ($arch)"
        end

        # ── RPM ────────────────────────────────────────────────────────
        echo "  [$tier] → .rpm ($arch)"
        mkdir -p "$out/rpm"
        fpm -s dir -t rpm \
            $common_args \
            --depends "libicu" \
            --depends "krb5-libs" \
            --depends "zlib" \
            --rpm-summary "WatchNexus $tier_title media server" \
            --rpm-os linux \
            --rpm-compression xz \
            --package "$out/rpm/" \
            -C "$root" \
            opt usr etc 2>&1
        set -l rpm_status $status
        if test $rpm_status -ne 0
            echo "  [!] fpm rpm exited $rpm_status for $tier ($arch)"
        end

        # ── Arch pkg.tar.zst (fpm target 'pacman') ─────────────────────
        echo "  [$tier] → .pkg.tar.zst ($arch)"
        mkdir -p "$out/arch"
        fpm -s dir -t pacman \
            $common_args \
            --depends "icu" \
            --depends "krb5" \
            --depends "zlib" \
            --pacman-compression zstd \
            --package "$out/arch/" \
            -C "$root" \
            opt usr etc 2>&1
        set -l pac_status $status
        if test $pac_status -ne 0
            echo "  [!] fpm pacman exited $pac_status for $tier ($arch)"
        end

        # ── Cleanup the fpm root ───────────────────────────────────────
        rm -rf "$root"
    end

    # Move outputs into final-named files
    for d in deb rpm arch
        for f in "$out/$d"/*
            test -f "$f"; or continue
            echo "    produced: "(basename "$f")
        end
    end
end

for tier in $TIERS
    build_linux_packages "$tier"
end

# ── Step 3: Windows EXE via NSIS ────────────────────────────────────
echo ""
echo "[3/7] Building Windows installers via NSIS..."

function build_windows_installer -a tier
    set -l payload "$STAGE_DIR/$tier/publish/win-x64"
    set -l web_payload "$STAGE_DIR/$tier/publish/web"
    set -l out "$RELEASE_DIR/$tier/windows"
    set -l tier_title (string upper -- (string sub -l 1 -- $tier))(string sub -s 2 -- $tier)

    if not test -d "$payload"
        echo "  [!] Missing payload: $payload"
        return 1
    end

    mkdir -p "$out"

    # Render the NSIS .nsi from the template
    set -l nsi "$out/watchnexus-$tier.nsi"
    sed -e "s|@TIER@|$tier|g" \
        -e "s|@TIER_TITLE@|$tier_title|g" \
        -e "s|@VERSION@|$VERSION|g" \
        -e "s|@VENDOR@|$VENDOR|g" \
        -e "s|@URL@|$URL|g" \
        -e "s|@PAYLOAD_WIN@|$payload|g" \
        -e "s|@PAYLOAD_WEB@|$web_payload|g" \
        -e "s|@STAGE_ROOT@|$STAGE_DIR/$tier|g" \
        -e "s|@OUT_DIR@|$out|g" \
        "$NSIS_TEMPLATE" > "$nsi"

    echo "  [$tier] → makensis"
    makensis -V2 "$nsi" >/dev/null 2>&1
    if test $status -ne 0
        echo "  [!] NSIS build failed for $tier"
    else
        tail -8 <(makensis -V2 "$nsi" 2>&1)
    end

    set -l outfile "$out/watchnexus-$tier-$VERSION-windows-x64.exe"
    if test -f "$outfile"
        echo "    produced: "(basename "$outfile")
    else
        echo "    [!] expected $outfile not produced"
    end
end

for tier in $TIERS
    build_windows_installer "$tier"
end

# ── Step 4: Docker image build (optional, --docker) ─────────────────
if test "$DO_DOCKER" = "1"
    echo ""
    echo "[4/7] Building Docker images..."
    require docker "https://docs.docker.com/engine/install/"
    for tier in $TIERS
        set -l img "watchnexus/watchnexus:$VERSION-$tier"
        set -l latest "watchnexus/watchnexus:latest-$tier"
        echo "  [$tier] → $img"
        docker build \
            --build-arg TIER=$tier \
            -t "$img" \
            -t "$latest" \
            -f "$ROOT_DIR/Dockerfile" \
            "$ROOT_DIR"
        if test $status -ne 0
            echo "  [!] Docker build failed for $tier"
            continue
        end
        # Export as a loadable tarball for offline distribution
        mkdir -p "$RELEASE_DIR/$tier/docker"
        set -l tarball "$RELEASE_DIR/$tier/docker/watchnexus-$tier-$VERSION-docker.tar"
        docker save "$img" -o "$tarball"
        if test $status -eq 0
            echo "    saved tarball: "(basename "$tarball")"  ("(du -h "$tarball" | cut -f1)")"
        else
            echo "    [!] docker save failed for $tier"
        end
    end
else
    echo ""
    echo "[4/7] Skipping Docker build (pass --docker to enable)"
end

# ── Step 5: Community-hub artifacts (Unraid / HexOS / TrueNAS / CasaOS / Portainer / Synology)
if test "$DO_COMMUNITY" = "1"
    echo ""
    echo "[5/7] Generating community-hub artifacts..."
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
else
    echo ""
    echo "[5/7] Skipping community-hub artifacts (pass --no-community to opt out)"
end

# ── Step 6: Sign Windows installers (optional) ──────────────────────
if test "$DO_SIGN" = "1"
    echo ""
    echo "[6/7] Signing Windows installers with osslsigncode..."
    echo "      PFX        : $WN_PFX_PATH"
    echo "      Timestamp  : $WN_TIMESTAMP_URL"
    set -l SIGN_OK 0
    set -l SIGN_FAIL 0
    for tier in $TIERS
        set -l tier_title (string upper -- (string sub -l 1 -- $tier))(string sub -s 2 -- $tier)
        set -l infile  "$RELEASE_DIR/$tier/windows/watchnexus-$tier-$VERSION-windows-x64.exe"
        set -l tmpfile "$RELEASE_DIR/$tier/windows/watchnexus-$tier-$VERSION-windows-x64-signed.exe"

        if not test -f "$infile"
            echo "  [$tier] [!] unsigned exe missing — skipping"
            set SIGN_FAIL (math $SIGN_FAIL + 1)
            continue
        end

        echo "  [$tier] signing..."
        osslsigncode sign \
            -pkcs12 "$WN_PFX_PATH" \
            -pass   "$WN_SIGN_PASS" \
            -h      sha256 \
            -n      "WatchNexus $tier_title" \
            -i      "$URL" \
            -ts     "$WN_TIMESTAMP_URL" \
            -in     "$infile" \
            -out    "$tmpfile"
        set -l sign_status $status

        if test $sign_status -eq 0
            mv "$tmpfile" "$infile"
            # Verify the signature actually attached
            if osslsigncode verify "$infile" > /dev/null 2>&1
                set -l size (du -h "$infile" | cut -f1)
                echo "    signed + verified ($size) → "(basename "$infile")
                set SIGN_OK (math $SIGN_OK + 1)
            else
                echo "    [!] sign succeeded but verify failed for $tier"
                set SIGN_FAIL (math $SIGN_FAIL + 1)
            end
        else
            echo "    [!] osslsigncode exited $sign_status for $tier"
            rm -f "$tmpfile"
            set SIGN_FAIL (math $SIGN_FAIL + 1)
        end
    end
    echo ""
    echo "  Signing summary: $SIGN_OK signed, $SIGN_FAIL failed"

    # Scrub the passphrase from environment so it doesn't leak into
    # subsequent commands or process listings.
    set -e WN_SIGN_PASS
else
    echo ""
    echo "[6/7] Skipping Windows signing (pass --sign to enable)"
end

# ── Step 5: SHA-256 manifest + optional license-server upload ───────
echo ""
echo "[7/7] Generating SHA256SUMS and (optionally) uploading..."
set -l fortress_args sign "$RELEASE_DIR"
if test "$DO_UPLOAD" = "1"
    set -x WN_UPLOAD_HASHES 1
    if test -z "$WN_LICENSE_TOKEN"
        echo "  [!] --upload requires WN_LICENSE_TOKEN env var"
        exit 1
    end
end

chmod +x "$SCRIPT_DIR/fortress-build.sh"
bash "$SCRIPT_DIR/fortress-build.sh" $fortress_args

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
    for f in "$tier_dir"/deb/*.deb "$tier_dir"/rpm/*.rpm "$tier_dir"/arch/*.pkg.tar.zst "$tier_dir"/windows/*.exe "$tier_dir"/docker/*.tar
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
        echo "      (no artifacts produced — check fpm/makensis output above)"
    end
end
echo ""
echo "  Total artifacts: $TOTAL_ARTIFACTS"
echo ""
if test $TOTAL_ARTIFACTS -eq 0
    echo "  ⚠ Nothing was produced. Scroll up for the actual fpm/makensis errors."
    echo "    Common causes:"
    echo "      • fpm flags incompatible with your fpm/rpmbuild/dpkg versions"
    echo "      • Stage payload missing (re-run without --skip-stage)"
    echo "      • NSIS template syntax error (check the .nsi in release/<tier>/windows/)"
else
    echo "  Next:"
    echo "    1. Smoke-test each installer in a disposable VM/container."
    echo "    2. rsync release/ to releases.watchnexus.ca:/srv/releases/v$VERSION/"
    echo "    3. Flip the 'latest' symlink on the VPS."
end
echo "══════════════════════════════════════════════════"
