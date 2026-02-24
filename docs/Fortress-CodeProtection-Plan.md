# WatchNexus Code Protection Strategy
## Codename: **Fortress**

### Overview

WatchNexus uses a dual-layer protection strategy combining **legal protection** (dual licensing) with **technical protection** (Cython compilation) to ensure the codebase remains protected while staying open source.

**Related Plans:**
- **Constellation** - Distribution & Packaging (Windows, macOS, Linux)
- **Harbor** - Docker & Raspberry Pi Deployment
- **Crucible** - FFmpeg Replacement Investigation

---

## Distribution Targets (Cross-Reference: Constellation)

### Compiled Binary Releases

| Platform | Format | Architectures |
|----------|--------|---------------|
| **Windows** | .exe installer, .zip portable | x64, x86 |
| **macOS Sequoia** (15) | .dmg | arm64, x64, universal |
| **macOS Sonoma** (14) | .dmg | arm64, x64, universal |
| **macOS Ventura** (13) | .dmg | arm64, x64, universal |
| **macOS Monterey** (12) | .dmg (legacy) | arm64, x64 |
| **Linux AppImage** | .AppImage | x64, arm64, armhf |
| **Debian/Ubuntu** | .deb | x64, arm64, armhf |
| **Fedora/RHEL** | .rpm | x64, arm64 |
| **Arch Linux** | AUR (PKGBUILD) | any |
| **Docker** | Multi-arch image | amd64, arm64, arm/v7 |
| **Raspberry Pi** | Native + Docker | arm64, armhf |

### Architecture Compatibility

| Processor | Status | Notes |
|-----------|--------|-------|
| Intel (x86_64) | ✅ Ready | All desktop/laptop |
| AMD (x86_64) | ✅ Ready | All desktop/server |
| Apple M1/M2/M3 | ✅ Ready | ARM64 native |
| ARM64 (aarch64) | ✅ Ready | Pi 4/5, AWS Graviton |
| ARMv7 (armhf) | ✅ Ready | Pi 3, older ARM |
| NVIDIA GPU | ⚠️ Optional | NVENC acceleration |

---

## Container & Distribution Banner Assets

All official banners for Docker Hub, Unraid, and dashboard previews are located in `/assets/banners/`. Each variant corresponds to a WatchNexus package format:

| Variant | Extension | Purpose | Banners |
|---------|-----------|---------|---------|
| **WN** | `.wn` | WatchNexus Core (standard) | Docker/Unraid 1600x600, Hub Social 1200x630, Dashboard 1024x512, Stack Preview 1280x720 |
| **WNF** | `.wnf` | WatchNexus Fortress (protected) | Docker/Unraid 1600x600, Hub Social 1200x630, Dashboard 1024x512, Stack Preview 1280x720 |
| **WNC** | `.wnc` | WatchNexus Compiled | Docker/Unraid 1600x600, Hub Social 1200x630, Dashboard 1024x512, Stack Preview 1280x720 |
| **WND** | `.wnd` | WatchNexus Docker | Docker/Unraid 1600x600, Hub Social 1200x630, Dashboard 1024x512, Stack Preview 1280x720 |
| **WNP** | `.wnp` | WatchNexus Portable | Docker/Unraid 1600x600, Hub Social 1200x630, Dashboard 1024x512, Stack Preview 1280x720 |
| **WNT** | `.wnt` | WatchNexus Tray | Docker/Unraid 1600x600, Hub Social 1200x630, Dashboard 1024x512, Stack Preview 1280x720 |
| **Suite** | suite | WatchNexus Full Suite | Docker/Unraid 1600x600, Hub Social 1200x630, Dashboard 1024x512, Stack Preview 1280x720 |

**Usage Guidelines:**
- Docker Hub: Use `*_docker_hub_social_1200x630.png` as the repository social preview
- Unraid Community Apps: Use `*_docker_unraid_banner_1600x600.png` for the app banner
- Dashboard/Portainer: Use `*_dashboard_banner_1024x512.png` for stack previews
- Documentation/README: Use `*_stack_preview_1280x720.png` for feature screenshots

**Manifest:** See `/assets/banners/manifest.json` for structured metadata.

---

## 1. Dual Licensing Model

### Open Source License: AGPL v3 (GNU Affero General Public License)

**Why AGPL?**
- Strongest copyleft license available
- Requires ANY modifications to be open-sourced (including SaaS deployments)
- If a competitor uses your code, they MUST release their changes
- Protects against "embrace, extend, extinguish" tactics

**Key AGPL Requirements:**
- Source code must be available to users
- Modifications must be shared under AGPL
- Network use counts as distribution (closes the "SaaS loophole")

### Commercial License

For businesses that don't want to open-source their modifications:
- One-time fee or subscription model
- Allows proprietary modifications
- Includes support and updates
- No requirement to share changes

### Licensing Files to Create:
```
/LICENSE              - AGPL v3 full text
/LICENSE-COMMERCIAL   - Commercial license terms
/NOTICE              - Attribution requirements
```

---

## 2. Cython Compilation Strategy

### What is Cython?
Cython compiles Python code to C, then to native binary extensions (.so on Linux, .pyd on Windows). The resulting files:
- Execute faster (10-100x for some operations)
- Cannot be easily decompiled back to readable Python
- Are platform-specific binaries

### Modules to Protect (Core Business Logic):

| Module | File | Why Protect? |
|--------|------|--------------|
| Database | `database.py` | Core data layer |
| Marmalade | `marmalade_server.py` | Media scanning algorithms |
| Compote | `compote.py` | Indexer aggregation logic |
| Fondue | `fondue.py` | Torrent engine |
| Authentication | `auth.py` (extract from server.py) | Security-critical |
| Licensing | `license_validator.py` (new) | License verification |

### Modules to Keep as Python (For Community):
- Plugin system (`plugin_adapter.py`, `gadgets.py`)
- Configuration files
- Frontend (React/JavaScript - separate protection if needed)
- API route definitions (documentation value)

---

## 3. Build System Architecture

### Source Repository (GitHub - Public)
```
watchnexus/
├── LICENSE                    # AGPL v3
├── LICENSE-COMMERCIAL         # Commercial terms
├── README.md
├── setup.py                   # Cython build configuration
├── pyproject.toml
├── src/
│   ├── core/                  # Protected modules (Cython)
│   │   ├── database.pyx       # .pyx = Cython source
│   │   ├── marmalade.pyx
│   │   ├── compote.pyx
│   │   ├── fondue.pyx
│   │   └── fortress.pyx       # License validator
│   ├── api/                   # Open modules (Python)
│   │   ├── routes.py
│   │   └── models.py
│   └── plugins/               # Open for community
│       └── ...
└── build/                     # Compiled binaries (not in repo)
```

### Official Release (Compiled)
```
watchnexus-release/
├── core/
│   ├── database.cpython-311-x86_64-linux-gnu.so    # Compiled!
│   ├── marmalade.cpython-311-x86_64-linux-gnu.so
│   ├── compote.cpython-311-x86_64-linux-gnu.so
│   ├── fondue.cpython-311-x86_64-linux-gnu.so
│   └── fortress.cpython-311-x86_64-linux-gnu.so
├── api/
│   ├── routes.py              # Still readable
│   └── models.py
└── plugins/
    └── ...
```

---

## 4. Implementation Steps

### Phase 1: Licensing Setup
1. Add AGPL v3 license to repository
2. Create commercial license terms
3. Add license headers to all source files
4. Create NOTICE file with attributions

### Phase 2: Cython Build System
1. Install Cython: `pip install cython`
2. Create `setup.py` with Cython extension configuration
3. Convert protected `.py` files to `.pyx` format
4. Test compilation on Linux, macOS, Windows
5. Create build scripts for each platform

### Phase 3: License Validator (Fortress Module)
1. Create embedded license checking system
2. Implement online activation (optional)
3. Add hardware fingerprinting for license binding
4. Create grace period for offline use

### Phase 4: Release Pipeline
1. GitHub Actions workflow for automated builds
2. Sign releases with GPG key
3. Create checksum files for verification
4. Publish compiled binaries to releases page

---

## 5. Protection Levels

### Level 1: Legal Only (Current)
- Add AGPL license
- Minimal technical barrier
- Relies on legal enforcement

### Level 2: Legal + Cython (Recommended)
- AGPL + Commercial dual license
- Core modules compiled to binary
- Source available but official builds are protected
- ~80% protection against casual copying

### Level 3: Full Fortress (Maximum)
- Everything from Level 2
- Plus: License validator with online activation
- Plus: Code signing and tamper detection
- Plus: Obfuscation of remaining Python code
- ~95% protection (determined attackers can still reverse-engineer)

---

## 6. What Competitors Would Need To Do

With this protection:

1. **To use your code commercially**: Must buy commercial license OR release their modifications under AGPL

2. **To reverse-engineer**: Would need to decompile Cython binaries (very difficult, results in assembly-like C code)

3. **To bypass licensing**: Would need to crack the Fortress module (illegal in most jurisdictions under DMCA)

4. **To fork legally**: Can fork under AGPL but must keep it open source and share all changes

---

## 7. Example License Header

```python
# WatchNexus - Unified Media Pipeline
# Copyright (C) 2024-2026 [Your Name/Company]
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# For commercial licensing options, contact: [your-email]
```

---

## 8. Recommended Implementation Order

1. **Now**: Add AGPL license and headers (immediate legal protection)
2. **Before Kickstarter delivery**: Set up Cython build system
3. **Post-launch**: Implement Fortress license validator
4. **Ongoing**: Monitor for violations, enforce licensing

---

## Questions to Decide

1. Company/entity name for copyright?
2. Contact email for commercial licensing?
3. Price structure for commercial license?
4. Which protection level to implement first?
