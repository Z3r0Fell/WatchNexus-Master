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
#      gem install --user-install fpm
#      set -Ux PATH (ruby -e 'puts Gem.user_dir')/bin \$PATH
# ══════════════════════════════════════════════════════════════════════

set -l SCRIPT_DIR (dirname (status -f))
set -l ROOT_DIR (realpath "$SCRIPT_DIR/..")
set -l STAGE_DIR "$ROOT_DIR/stage"
set -l RELEASE_DIR "$ROOT_DIR/release"
set -l NSIS_TEMPLATE "$SCRIPT_DIR/packaging/nsis/watchnexus.nsi.in"
set -l FPM_HOOKS_DIR "$SCRIPT_DIR/packaging/fpm"
set -l VERSION "1.0.0"
set -l VENDOR "WatchNexus Media Systems"
set -l URL "https://watchnexus.ca"
set -l LICENSE "Proprietary"
set -l MAINTAINER "Auz Larocque <support@watchnexus.ca>"

# ── Parse args ──────────────────────────────────────────────────────
set -l TARGET "all"
set -l DO_SIGN 0
set -l DO_UPLOAD 0
for arg in $argv
    switch $arg
        case standard pro ultra all
            set TARGET $arg
        case --sign
            set DO_SIGN 1
        case --upload
            set DO_UPLOAD 1
        case '*'
            echo "Unknown arg: $arg"
            echo "Usage: "(status -f)" [standard|pro|ultra|all] [--sign] [--upload]"
            exit 1
    end
end

if test "$TARGET" = "all"
    set TIERS standard pro ultra
else
    set TIERS $TARGET
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
require makepkg        "(comes with base-devel)"
require fakeroot       "sudo pacman -S fakeroot"

if test "$DO_SIGN" = "1"
    require osslsigncode "sudo pacman -S osslsigncode"
    if test -z "$WN_SIGN_PASS"
        echo "[!] --sign requires WN_SIGN_PASS env var (pfx passphrase)"
        echo "    set -x WN_SIGN_PASS 'your-pfx-passphrase'"
        exit 1
    end
    if not test -f /opt/signing/watchnexus.pfx
        echo "[!] --sign requires /opt/signing/watchnexus.pfx"
        exit 1
    end
end

echo "══════════════════════════════════════════════════"
echo "  WatchNexus Installer Build  (v$VERSION)"
echo "  Root     : $ROOT_DIR"
echo "  Stage    : $STAGE_DIR"
echo "  Release  : $RELEASE_DIR"
echo "  Tiers    : $TIERS"
echo "  Sign     : $DO_SIGN"
echo "  Upload   : $DO_UPLOAD"
echo "══════════════════════════════════════════════════"

# ── Step 1: Stage tier payloads (delegates to bash script) ──────────
echo ""
echo "[1/5] Staging tier payloads via prepare-installers.sh..."
chmod +x "$SCRIPT_DIR/prepare-installers.sh"
bash "$SCRIPT_DIR/prepare-installers.sh" $TARGET
or begin
    echo "[!] prepare-installers.sh failed"
    exit 1
end

# ── Step 2: Per-tier Linux packages via fpm ─────────────────────────
echo ""
echo "[2/5] Building Linux packages via fpm..."

function build_linux_packages -a tier
    set -l payload "$STAGE_DIR/$tier/publish/linux-x64"
    set -l web_payload "$STAGE_DIR/$tier/publish/web"
    set -l out "$RELEASE_DIR/$tier"
    set -l pkg_name "watchnexus-$tier"
    set -l tier_title (string upper -- (string sub -l 1 -- $tier))(string sub -s 2 -- $tier)

    if not test -d "$payload"
        echo "  [!] Missing payload: $payload — run prepare-installers.sh first"
        return 1
    end

    mkdir -p "$out"

    # Layout fpm pulls from. We feed it a staging root with:
    #   opt/watchnexus/bin/        (linux binaries)
    #   opt/watchnexus/web/        (frontend bundle)
    #   opt/watchnexus/tier.lock   (marker file the post-install reads)
    #   opt/watchnexus/version.lock
    #   opt/watchnexus/LICENSE.txt
    #   opt/watchnexus/LICENSE.html
    #   opt/watchnexus/README.md
    #   usr/lib/systemd/system/watchnexus.service
    set -l root "$out/_fpm_root_$tier"
    rm -rf "$root"
    mkdir -p "$root/opt/watchnexus/bin" \
             "$root/opt/watchnexus/web" \
             "$root/usr/lib/systemd/system"

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

    set -l common_args \
        --name "$pkg_name" \
        --version "$VERSION" \
        --license "$LICENSE" \
        --vendor "$VENDOR" \
        --maintainer "$MAINTAINER" \
        --url "$URL" \
        --description "WatchNexus $tier_title — modular media server, v$VERSION (RTP 1.0)" \
        --architecture x86_64 \
        --after-install "$FPM_HOOKS_DIR/after-install.sh" \
        --before-remove "$FPM_HOOKS_DIR/before-remove.sh" \
        --after-remove  "$FPM_HOOKS_DIR/after-remove.sh"

    # ── DEB ────────────────────────────────────────────────────────
    echo "  [$tier] → .deb"
    mkdir -p "$out/deb"
    fpm -s dir -t deb \
        $common_args \
        --depends "libicu (>= 60)" \
        --depends "libkrb5-3" \
        --depends "zlib1g" \
        --deb-systemd-enable \
        --deb-systemd-auto-start \
        --deb-priority optional \
        --deb-compression xz \
        --category "video" \
        --package "$out/deb/" \
        -C "$root" \
        opt usr
    or echo "  [!] DEB build failed for $tier"

    # ── RPM ────────────────────────────────────────────────────────
    echo "  [$tier] → .rpm"
    mkdir -p "$out/rpm"
    fpm -s dir -t rpm \
        $common_args \
        --depends "libicu" \
        --depends "krb5-libs" \
        --depends "zlib" \
        --rpm-summary "WatchNexus $tier_title media server" \
        --rpm-os linux \
        --rpm-tag "Group: Applications/Multimedia" \
        --rpm-compression xz \
        --package "$out/rpm/" \
        -C "$root" \
        opt usr
    or echo "  [!] RPM build failed for $tier"

    # ── Arch pkg.tar.zst (fpm target 'pacman') ─────────────────────
    echo "  [$tier] → .pkg.tar.zst"
    mkdir -p "$out/arch"
    fpm -s dir -t pacman \
        $common_args \
        --depends "icu" \
        --depends "krb5" \
        --depends "zlib" \
        --pacman-compression zstd \
        --package "$out/arch/" \
        -C "$root" \
        opt usr
    or echo "  [!] Arch pkg build failed for $tier"

    # ── Cleanup the fpm root ───────────────────────────────────────
    rm -rf "$root"

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
echo "[3/5] Building Windows installers via NSIS..."

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
    makensis -V2 "$nsi" 2>&1 | tail -8
    or echo "  [!] NSIS build failed for $tier"

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

# ── Step 4: Sign Windows installers (optional) ──────────────────────
if test "$DO_SIGN" = "1"
    echo ""
    echo "[4/5] Signing Windows installers with osslsigncode..."
    for tier in $TIERS
        set -l infile "$RELEASE_DIR/$tier/windows/watchnexus-$tier-$VERSION-windows-x64.exe"
        set -l outfile "$RELEASE_DIR/$tier/windows/watchnexus-$tier-$VERSION-windows-x64-signed.exe"
        if not test -f "$infile"
            echo "  [!] $tier: unsigned exe missing"
            continue
        end
        echo "  [$tier] signing..."
        osslsigncode sign \
            -pkcs12 /opt/signing/watchnexus.pfx \
            -pass "$WN_SIGN_PASS" \
            -n "WatchNexus "(string upper -- (string sub -l 1 -- $tier))(string sub -s 2 -- $tier) \
            -i "$URL" \
            -t http://timestamp.digicert.com \
            -in  "$infile" \
            -out "$outfile"
        and mv "$outfile" "$infile"
        and echo "    signed → $infile"
        or  echo "    [!] sign failed for $tier"
    end
else
    echo ""
    echo "[4/5] Skipping Windows signing (pass --sign to enable)"
end

# ── Step 5: SHA-256 manifest + optional license-server upload ───────
echo ""
echo "[5/5] Generating SHA256SUMS and (optionally) uploading..."
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
for tier in $TIERS
    set -l tier_dir "$RELEASE_DIR/$tier"
    test -d "$tier_dir"; or continue
    echo "    [$tier]"
    for f in "$tier_dir"/deb/*.deb "$tier_dir"/rpm/*.rpm "$tier_dir"/arch/*.pkg.tar.zst "$tier_dir"/windows/*.exe
        test -f "$f"; or continue
        set -l size (du -h "$f" | cut -f1)
        echo "      $size  "(basename "$f")
    end
end
echo ""
echo "  Next:"
echo "    1. Smoke-test each installer in a disposable VM/container."
echo "    2. rsync release/ to releases.watchnexus.ca:/srv/releases/v$VERSION/"
echo "    3. Flip the 'latest' symlink on the VPS."
echo "══════════════════════════════════════════════════"
