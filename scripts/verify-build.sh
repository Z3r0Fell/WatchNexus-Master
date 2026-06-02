#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  WatchNexus Build Verification
#  Builds all C# projects and reports pass/fail per project.
#  Usage: ./scripts/verify-build.sh [--configuration Debug|Release]
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

# ── Constants ────────────────────────────────────────────────────────
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly CONFIGURATION="${1:-Release}"
readonly SOLUTION="$REPO_ROOT/src/watchnexus/WatchNexus.sln"

# ── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── State ────────────────────────────────────────────────────────────
BUILD_FAILED=false
BUILD_LOG=$(mktemp)
START_TIME=$(date +%s)
declare -a RESULTS

# ── Find projects ────────────────────────────────────────────────────
mapfile -t PROJECTS < <(find "$REPO_ROOT/src/watchnexus" -name '*.csproj' -type f | sort)

if [[ ${#PROJECTS[@]} -eq 0 ]]; then
    echo -e "${RED}ERROR: No .csproj files found in src/watchnexus/${NC}"
    exit 1
fi

# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  WatchNexus Build Verification${NC}"
echo -e "${BOLD}  Configuration : ${CONFIGURATION}${NC}"
echo -e "${BOLD}  Solution      : ${SOLUTION}${NC}"
echo -e "${BOLD}  Projects      : ${#PROJECTS[@]} found${NC}"
echo -e "${BOLD}  Date          : $(date -u '+%Y-%m-%d %H:%M:%S UTC')${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Check prerequisites ──────────────────────────────────────────────
if ! command -v dotnet &>/dev/null; then
    echo -e "${RED}ERROR: dotnet CLI not found in PATH${NC}"
    echo "Install .NET 10 SDK: https://dotnet.microsoft.com/download/dotnet/10.0"
    exit 1
fi

DOTNET_VERSION=$(dotnet --version 2>/dev/null || echo "unknown")
echo -e "  ${CYAN}dotnet${NC} version: $DOTNET_VERSION"
echo ""

# ── Solution-level restore ───────────────────────────────────────────
echo -e "${BOLD}[Restore] Restoring solution packages...${NC}"
if dotnet restore "$SOLUTION" --verbosity quiet 2>&1 | tee -a "$BUILD_LOG"; then
    echo -e "  ${GREEN}✓ Solution restore passed${NC}"
else
    echo -e "  ${RED}✗ Solution restore failed${NC}"
    BUILD_FAILED=true
fi
echo ""

# ── Build each project ──────────────────────────────────────────────
echo -e "${BOLD}[Build] Building ${#PROJECTS[@]} projects...${NC}"
echo ""

for proj in "${PROJECTS[@]}"; do
    proj_name=$(basename "$proj" .csproj)
    proj_dir=$(dirname "$proj")
    relative_path="${proj_dir#$REPO_ROOT/src/watchnexus/}"
    [[ -z "$relative_path" ]] && relative_path="."

    printf "  Building %-40s ... " "${proj_name}"

    # Capture build output
    if dotnet build "$proj" -c "$CONFIGURATION" --no-restore \
        --verbosity quiet \
        -p:WarningLevel=4 \
        2>>"$BUILD_LOG" >>"$BUILD_LOG"; then
        echo -e "${GREEN}✓ PASS${NC}"
        RESULTS+=("PASS|$proj_name|$relative_path")
    else
        echo -e "${RED}✗ FAIL${NC}"
        RESULTS+=("FAIL|$proj_name|$relative_path")
        BUILD_FAILED=true
    fi
done

# ══════════════════════════════════════════════════════════════════════
#  Summary
# ══════════════════════════════════════════════════════════════════════
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
PASS_COUNT=0
FAIL_COUNT=0

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Build Results${NC}"
echo -e "${BOLD}  Time: ${TOTAL_TIME}s${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${NC}"
echo ""

for result in "${RESULTS[@]}"; do
    IFS='|' read -r status proj_name proj_path <<< "$result"
    if [[ "$status" == "PASS" ]]; then
        echo -e "  ${GREEN}✓${NC}  ${proj_name}  (${proj_path})"
        ((PASS_COUNT++))
    else
        echo -e "  ${RED}✗${NC}  ${proj_name}  (${proj_path})"
        ((FAIL_COUNT++))
    fi
done

echo ""
echo -e "  ${GREEN}${PASS_COUNT} passed${NC}, ${RED}${FAIL_COUNT} failed${NC}, $((PASS_COUNT+FAIL_COUNT)) total"
echo -e "  Total time: ${TOTAL_TIME}s"
echo ""

if $BUILD_FAILED; then
    echo -e "  ${YELLOW}Build log:${NC} $BUILD_LOG"
    echo -e "  ${YELLOW}Review the output above or check the log file for details.${NC}"
    echo ""
    echo -e "${RED}BUILD FAILED${NC}"
    exit 1
else
    rm -f "$BUILD_LOG"
    echo -e "${GREEN}BUILD PASSED${NC}"
    exit 0
fi
