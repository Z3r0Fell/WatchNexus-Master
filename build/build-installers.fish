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

set -g SCRIPT_DIR (dirname (status -f))
set -g ROOT_DIR (realpath "$SCRIPT_DIR/..")
set -g STAGE_DIR "$ROOT_DIR/stage"
set -g RELEASE_DIR "$ROOT_DIR/release"
set -g NSIS_TEMPLATE "$SCRIPT_DIR/packaging/nsis/watchnexus.nsi.in"
set -g FPM_HOOKS_DIR "$SCRIPT_DIR/packaging/fpm"
set -g VERSION "1.0.0"
set -g VENDOR "WatchNexus Media Systems"
set -g URL "https://watchnexus.ca"
set -g LICENSE "Proprietary"
set -g MAINTAINER "Auz Larocque <support@watchnexus.ca>"

# ── Parse args ──────────────────────────────────────────────────────
set -l TARGET "all"
set -g DO_SIGN 0
set -g DO_UPLOAD 0
set -g SKIP_STAGE 0
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
        case '*'
            echo "Unknown arg: $arg"
            echo "Usage: "(status -f)" [standard|pro|ultra|all] [--sign] [--upload] [--skip-stage]"
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
echo "  Root     : $ROOT_DIR"
echo "  Stage    : $STAGE_DIR"
echo "  Release  : $RELEASE_DIR"
echo "  Tiers    : $TIERS"
echo "  Sign     : $DO_SIGN"
echo "  Upload   : $DO_UPLOAD"
echo "══════════════════════════════════════════════════"

# ── Step 1: Stage tier payloads (delegates to bash script) ──────────
if test "$SKIP_STAGE" = "1"
    echo ""
    echo "[1/5] Skipping staging (--skip-stage); reusing existing $STAGE_DIR"
    for tier in $TIERS
        if not test -f "$STAGE_DIR/$tier/publish/web/index.html"
            echo "  [!] stage/$tier looks incomplete — cannot --skip-stage. Run without the flag."
            exit 1
        end
    end
else
    echo ""
    echo "[1/5] Staging tier payloads via prepare-installers.sh..."
    chmod +x "$SCRIPT_DIR/prepare-installers.sh"
    bash "$SCRIPT_DIR/prepare-installers.sh" $TARGET
    or begin
        echo "[!] prepare-installers.sh failed"
        exit 1
    end
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
        echo "  [!] Missing payload: $payload"
        echo "      STAGE_DIR=$STAGE_DIR  RELEASE_DIR=$RELEASE_DIR"
        echo "      Did prepare-installers.sh complete? Inspect $STAGE_DIR/$tier/ tree."
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
        --depends "libicu70 | libicu71 | libicu72 | libicu74" \
        --depends "libkrb5-3" \
        --depends "zlib1g" \
        --deb-priority optional \
        --deb-compression xz \
        --category "video" \
        --package "$out/deb/" \
        -C "$root" \
        opt usr 2>&1
    set -l deb_status $status
    if test $deb_status -ne 0
        echo "  [!] fpm deb exited $deb_status for $tier"
    end

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
        --rpm-compression xz \
        --package "$out/rpm/" \
        -C "$root" \
        opt usr 2>&1
    set -l rpm_status $status
    if test $rpm_status -ne 0
        echo "  [!] fpm rpm exited $rpm_status for $tier"
    end

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
        opt usr 2>&1
    set -l pac_status $status
    if test $pac_status -ne 0
        echo "  [!] fpm pacman exited $pac_status for $tier"
    end

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
set -g TOTAL_ARTIFACTS 0
for tier in $TIERS
    set -l tier_dir "$RELEASE_DIR/$tier"
    test -d "$tier_dir"; or continue
    set -l tier_count 0
    echo "    [$tier]"
    for f in "$tier_dir"/deb/*.deb "$tier_dir"/rpm/*.rpm "$tier_dir"/arch/*.pkg.tar.zst "$tier_dir"/windows/*.exe
        test -f "$f"; or continue
        set -l size (du -h "$f" | cut -f1)
        echo "      $size  "(basename "$f")
        set tier_count (math $tier_count + 1)
        set TOTAL_ARTIFACTS (math $TOTAL_ARTIFACTS + 1)
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
