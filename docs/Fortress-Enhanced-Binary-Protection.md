# WatchNexus Fortress - Enhanced Binary Protection
## Custom File Extensions & Native Libraries

### Overview

This document extends the Fortress protection strategy with **custom file extensions** and **platform-native binaries** to create a professional, branded release that feels genuinely proprietary.

---

## 1. Custom File Extensions

### WatchNexus File Types

| Extension | Full Name | Purpose | Platform |
|-----------|-----------|---------|----------|
| `.wn` | WatchNexus Module | Compiled core module | All |
| `.wnf` | WatchNexus Framework | Framework/library bundle | All |
| `.wnc` | WatchNexus Config | Encrypted configuration | All |
| `.wnd` | WatchNexus Data | Encrypted data cache | All |
| `.wnp` | WatchNexus Plugin | Plugin package | All |
| `.wnt` | WatchNexus Theme | Theme package | All |

### Platform-Specific Native Files

| Platform | Extension | Actual Type | Description |
|----------|-----------|-------------|-------------|
| **Windows** | `.wn.dll` | PE/DLL | Native Windows library |
| **Windows** | `.wncore.dll` | PE/DLL | Core engine DLL |
| **macOS** | `.wn.dylib` | Mach-O | Native macOS library |
| **macOS** | `.wncore.framework` | Framework | macOS framework bundle |
| **Linux** | `.wn.so` | ELF | Native Linux shared object |
| **Linux** | `.wncore.so` | ELF | Core engine shared object |

---

## 2. File Structure by Platform

### Windows Release Structure
```
WatchNexus/
├── WatchNexus.exe                    # Main executable
├── WatchNexusServer.exe              # Server executable
├── bin/
│   ├── wncore.dll                    # Core engine
│   ├── wnmedia.dll                   # Media processing (Marmalade)
│   ├── wnindex.dll                   # Indexer engine (Compote)
│   ├── wntorrent.dll                 # Torrent engine (Fondue)
│   ├── wnauth.dll                    # Authentication
│   ├── wndb.dll                      # Database layer
│   ├── wnstream.dll                  # Streaming engine
│   └── wnfingerprint.dll             # Audio fingerprinting
├── lib/
│   ├── marmalade.wn                  # Compiled module
│   ├── compote.wn                    # Compiled module
│   ├── fondue.wn                     # Compiled module
│   ├── database.wn                   # Compiled module
│   └── zest.wn                       # Compiled module
├── plugins/
│   └── *.wnp                         # Plugin packages
├── themes/
│   └── *.wnt                         # Theme packages
├── config/
│   └── settings.wnc                  # Encrypted config
└── data/
    └── cache.wnd                     # Encrypted cache
```

### macOS Release Structure (App Bundle)
```
WatchNexus.app/
├── Contents/
│   ├── Info.plist
│   ├── MacOS/
│   │   └── WatchNexus                # Main executable
│   ├── Frameworks/
│   │   ├── WNCore.framework/         # Core framework
│   │   │   ├── WNCore                # Binary
│   │   │   ├── Headers/
│   │   │   └── Resources/
│   │   ├── WNMedia.framework/        # Media framework
│   │   ├── WNStream.framework/       # Streaming framework
│   │   └── libwn.dylib               # Shared library
│   ├── Resources/
│   │   ├── lib/
│   │   │   ├── marmalade.wn
│   │   │   ├── compote.wn
│   │   │   └── fondue.wn
│   │   ├── plugins/
│   │   └── themes/
│   └── PlugIns/
│       └── WNHelper.appex            # Helper extension
```

### Linux Release Structure
```
watchnexus/
├── bin/
│   ├── watchnexus                    # Main executable
│   └── watchnexus-server             # Server executable
├── lib/
│   ├── libwncore.so                  # Core library
│   ├── libwnmedia.so                 # Media library
│   ├── libwnindex.so                 # Indexer library
│   ├── libwntorrent.so               # Torrent library
│   ├── libwnstream.so                # Streaming library
│   └── wn/                           # Python modules
│       ├── marmalade.wn.so           # Compiled module
│       ├── compote.wn.so
│       ├── fondue.wn.so
│       └── database.wn.so
├── share/
│   ├── watchnexus/
│   │   ├── plugins/
│   │   └── themes/
│   ├── applications/
│   │   └── watchnexus.desktop
│   └── icons/
└── etc/
    └── watchnexus/
        └── config.wnc
```

---

## 3. Implementation Architecture

### Custom Module Loader

```python
# wnloader.py - WatchNexus Custom Module Loader
"""
Custom import system for .wn files
Handles decryption and loading of protected modules
"""

import sys
import importlib.abc
import importlib.machinery
import importlib.util
from pathlib import Path
from typing import Optional
import hashlib

# Magic bytes for .wn files
WN_MAGIC = b'WNEX'  # WatchNexus EXtension
WN_VERSION = 1

class WNModuleFinder(importlib.abc.MetaPathFinder):
    """Find .wn modules in the WatchNexus library path"""
    
    def __init__(self, wn_paths: list):
        self.wn_paths = wn_paths
    
    def find_spec(self, fullname: str, path, target=None):
        """Find a .wn module specification"""
        module_name = fullname.split('.')[-1]
        
        for wn_path in self.wn_paths:
            # Check for .wn file
            wn_file = Path(wn_path) / f"{module_name}.wn"
            if wn_file.exists():
                return importlib.machinery.ModuleSpec(
                    fullname,
                    WNModuleLoader(str(wn_file)),
                    origin=str(wn_file)
                )
            
            # Check for platform-specific variants
            platform_variants = [
                f"{module_name}.wn.so",      # Linux
                f"{module_name}.wn.dll",     # Windows
                f"{module_name}.wn.dylib",   # macOS
            ]
            for variant in platform_variants:
                variant_path = Path(wn_path) / variant
                if variant_path.exists():
                    return importlib.machinery.ModuleSpec(
                        fullname,
                        WNNativeLoader(str(variant_path)),
                        origin=str(variant_path)
                    )
        
        return None


class WNModuleLoader(importlib.abc.Loader):
    """Load encrypted .wn Python modules"""
    
    def __init__(self, path: str):
        self.path = path
        self._license_key = None
    
    def create_module(self, spec):
        return None  # Use default module creation
    
    def exec_module(self, module):
        """Execute the .wn module"""
        with open(self.path, 'rb') as f:
            data = f.read()
        
        # Verify magic bytes
        if data[:4] != WN_MAGIC:
            raise ImportError(f"Invalid WatchNexus module: {self.path}")
        
        # Read header
        version = data[4]
        flags = data[5]
        
        # Decrypt if encrypted (flag bit 0)
        if flags & 0x01:
            payload = self._decrypt(data[16:])
        else:
            payload = data[16:]
        
        # Execute the code
        code = compile(payload, self.path, 'exec')
        exec(code, module.__dict__)
    
    def _decrypt(self, data: bytes) -> bytes:
        """Decrypt module data using license key"""
        # Implementation uses hardware-bound key derivation
        # Actual implementation would use proper encryption
        from cryptography.fernet import Fernet
        key = self._derive_key()
        f = Fernet(key)
        return f.decrypt(data)
    
    def _derive_key(self) -> bytes:
        """Derive decryption key from hardware fingerprint"""
        # Combines: machine ID, CPU info, MAC address
        # This binds the installation to specific hardware
        import uuid
        import base64
        
        machine_id = str(uuid.getnode())
        # Add more hardware identifiers in production
        key_material = hashlib.sha256(machine_id.encode()).digest()
        return base64.urlsafe_b64encode(key_material)


class WNNativeLoader(importlib.abc.Loader):
    """Load native .wn.so/.wn.dll/.wn.dylib modules"""
    
    def __init__(self, path: str):
        self.path = path
    
    def create_module(self, spec):
        """Load native extension module"""
        import importlib.util
        
        # Verify digital signature before loading
        if not self._verify_signature():
            raise ImportError(f"Invalid signature: {self.path}")
        
        # Load as native extension
        loader = importlib.machinery.ExtensionFileLoader(
            spec.name, self.path
        )
        return loader.create_module(spec)
    
    def exec_module(self, module):
        pass  # Native modules are executed on creation
    
    def _verify_signature(self) -> bool:
        """Verify the digital signature of native module"""
        # In production, verify against WatchNexus signing key
        return True


def install_wn_loader(wn_paths: list = None):
    """Install the WatchNexus module loader"""
    if wn_paths is None:
        wn_paths = [
            './lib',
            '/usr/lib/watchnexus/wn',
            '/opt/watchnexus/lib',
        ]
    
    finder = WNModuleFinder(wn_paths)
    sys.meta_path.insert(0, finder)
    print(f"WatchNexus module loader installed. Paths: {wn_paths}")


# Auto-install on import
install_wn_loader()
```

### Module Compiler (Build Tool)

```python
# wncompile.py - WatchNexus Module Compiler
"""
Compiles Python modules to protected .wn format
Optionally compiles to native code via Cython
"""

import argparse
import hashlib
import struct
from pathlib import Path
from typing import Optional
import subprocess
import tempfile
import shutil

WN_MAGIC = b'WNEX'
WN_VERSION = 1

class WNCompiler:
    """Compile Python to WatchNexus protected format"""
    
    def __init__(self, 
                 encrypt: bool = True,
                 native: bool = False,
                 sign: bool = True):
        self.encrypt = encrypt
        self.native = native
        self.sign = sign
    
    def compile_module(self, 
                       source_path: str, 
                       output_path: str = None) -> str:
        """Compile a Python module to .wn format"""
        source = Path(source_path)
        
        if output_path is None:
            output_path = source.with_suffix('.wn')
        
        if self.native:
            return self._compile_native(source, output_path)
        else:
            return self._compile_bytecode(source, output_path)
    
    def _compile_bytecode(self, source: Path, output: Path) -> str:
        """Compile to encrypted Python bytecode"""
        # Read source
        with open(source, 'r') as f:
            code = f.read()
        
        # Compile to bytecode
        bytecode = compile(code, str(source), 'exec')
        import marshal
        payload = marshal.dumps(bytecode)
        
        # Encrypt if requested
        flags = 0
        if self.encrypt:
            flags |= 0x01
            payload = self._encrypt(payload)
        
        # Build header
        header = struct.pack(
            '4sBBxxxxxxxxxx',  # Magic, version, flags, padding
            WN_MAGIC,
            WN_VERSION,
            flags
        )
        
        # Write output
        with open(output, 'wb') as f:
            f.write(header + payload)
        
        print(f"Compiled: {source} -> {output}")
        return str(output)
    
    def _compile_native(self, source: Path, output: Path) -> str:
        """Compile to native code via Cython"""
        import platform
        
        # Determine output extension
        system = platform.system()
        if system == 'Windows':
            native_ext = '.wn.dll'
        elif system == 'Darwin':
            native_ext = '.wn.dylib'
        else:
            native_ext = '.wn.so'
        
        native_output = output.with_suffix(native_ext)
        
        # Create temporary directory for build
        with tempfile.TemporaryDirectory() as tmpdir:
            # Copy source to .pyx
            pyx_file = Path(tmpdir) / source.with_suffix('.pyx').name
            shutil.copy(source, pyx_file)
            
            # Create setup.py for Cython
            setup_py = Path(tmpdir) / 'setup.py'
            setup_py.write_text(f'''
from setuptools import setup
from Cython.Build import cythonize

setup(
    ext_modules=cythonize("{pyx_file.name}"),
    script_args=["build_ext", "--inplace"]
)
''')
            
            # Run Cython compilation
            subprocess.run(
                ['python', 'setup.py'],
                cwd=tmpdir,
                check=True
            )
            
            # Find and copy the compiled module
            for f in Path(tmpdir).glob('*.so'):
                shutil.copy(f, native_output)
            for f in Path(tmpdir).glob('*.pyd'):
                shutil.copy(f, native_output)
        
        # Sign if requested
        if self.sign:
            self._sign_binary(native_output)
        
        print(f"Compiled native: {source} -> {native_output}")
        return str(native_output)
    
    def _encrypt(self, data: bytes) -> bytes:
        """Encrypt module data"""
        from cryptography.fernet import Fernet
        key = Fernet.generate_key()  # In production, use build-time key
        f = Fernet(key)
        return f.encrypt(data)
    
    def _sign_binary(self, path: Path):
        """Sign the binary with WatchNexus key"""
        import platform
        system = platform.system()
        
        if system == 'Windows':
            # Use signtool.exe
            # signtool sign /f certificate.pfx /p password file.dll
            pass
        elif system == 'Darwin':
            # Use codesign
            # codesign -s "Developer ID" file.dylib
            pass
        else:
            # Linux doesn't have standard signing
            # Could use GPG or custom signature
            pass


def main():
    parser = argparse.ArgumentParser(
        description='WatchNexus Module Compiler'
    )
    parser.add_argument('source', help='Source Python file')
    parser.add_argument('-o', '--output', help='Output path')
    parser.add_argument('--native', action='store_true',
                       help='Compile to native code')
    parser.add_argument('--no-encrypt', action='store_true',
                       help='Skip encryption')
    parser.add_argument('--no-sign', action='store_true',
                       help='Skip signing')
    
    args = parser.parse_args()
    
    compiler = WNCompiler(
        encrypt=not args.no_encrypt,
        native=args.native,
        sign=not args.no_sign
    )
    
    compiler.compile_module(args.source, args.output)


if __name__ == '__main__':
    main()
```

---

## 4. Windows DLL Implementation

### Core DLL Structure

```c
// wncore.c - WatchNexus Core DLL
// Compiled with: cl /LD wncore.c /Fe:wncore.dll

#include <windows.h>
#include <Python.h>

#define WNCORE_API __declspec(dllexport)

// Version info
WNCORE_API const char* WNCore_GetVersion() {
    return "2.5.5";
}

// License validation
WNCORE_API int WNCore_ValidateLicense(const char* license_key) {
    // Validate license against server or local cache
    // Returns: 0 = invalid, 1 = valid, 2 = trial
    return 1;
}

// Hardware fingerprint
WNCORE_API const char* WNCore_GetHardwareId() {
    static char hwid[64];
    // Generate hardware fingerprint
    // Combines: CPU ID, motherboard serial, MAC address
    return hwid;
}

// Initialize Python interpreter
WNCORE_API int WNCore_Initialize() {
    Py_Initialize();
    return Py_IsInitialized();
}

// Module loading
WNCORE_API PyObject* WNCore_LoadModule(const char* module_path) {
    // Load and decrypt .wn module
    // Return Python module object
    return NULL;
}

// DLL entry point
BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID reserved) {
    switch (reason) {
        case DLL_PROCESS_ATTACH:
            // Initialize
            break;
        case DLL_PROCESS_DETACH:
            // Cleanup
            break;
    }
    return TRUE;
}
```

### Windows Version Resource

```rc
// wncore.rc - Version resource for wncore.dll
#include <windows.h>

VS_VERSION_INFO VERSIONINFO
FILEVERSION     2,5,5,0
PRODUCTVERSION  2,5,5,0
FILEFLAGSMASK   VS_FFI_FILEFLAGSMASK
FILEFLAGS       0
FILEOS          VOS_NT_WINDOWS32
FILETYPE        VFT_DLL
FILESUBTYPE     VFT2_UNKNOWN
BEGIN
    BLOCK "StringFileInfo"
    BEGIN
        BLOCK "040904E4"
        BEGIN
            VALUE "CompanyName",      "WatchNexus"
            VALUE "FileDescription",  "WatchNexus Core Engine"
            VALUE "FileVersion",      "2.5.5.0"
            VALUE "InternalName",     "wncore"
            VALUE "LegalCopyright",   "Copyright (C) 2024-2026 WatchNexus"
            VALUE "OriginalFilename", "wncore.dll"
            VALUE "ProductName",      "WatchNexus Media Server"
            VALUE "ProductVersion",   "2.5.5.0"
        END
    END
    BLOCK "VarFileInfo"
    BEGIN
        VALUE "Translation", 0x409, 1252
    END
END
```

---

## 5. macOS Framework Implementation

### Framework Structure

```
WNCore.framework/
├── WNCore                           # Binary (symlink to Versions/A/WNCore)
├── Headers                          # Headers (symlink)
├── Resources                        # Resources (symlink)
└── Versions/
    ├── A/
    │   ├── WNCore                   # Actual binary
    │   ├── Headers/
    │   │   └── WNCore.h
    │   ├── Resources/
    │   │   ├── Info.plist
    │   │   └── en.lproj/
    │   └── _CodeSignature/
    │       └── CodeResources
    └── Current -> A
```

### Framework Info.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>WNCore</string>
    <key>CFBundleIdentifier</key>
    <string>com.watchnexus.WNCore</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>WNCore</string>
    <key>CFBundlePackageType</key>
    <string>FMWK</string>
    <key>CFBundleShortVersionString</key>
    <string>2.5.5</string>
    <key>CFBundleVersion</key>
    <string>2.5.5</string>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2024-2026 WatchNexus. All rights reserved.</string>
</dict>
</plist>
```

---

## 6. Linux Shared Object Implementation

### SO File with Version

```bash
# Build versioned shared object
gcc -shared -fPIC -o libwncore.so.2.5.5 wncore.c -lpython3.11

# Create symlinks (standard Linux convention)
ln -s libwncore.so.2.5.5 libwncore.so.2
ln -s libwncore.so.2 libwncore.so
```

### ELF Metadata

```bash
# Add custom section with WatchNexus metadata
objcopy --add-section .wnmeta=metadata.bin \
        --set-section-flags .wnmeta=noload,readonly \
        libwncore.so
```

---

## 7. File Extension Registration

### Windows Registry

```reg
Windows Registry Editor Version 5.00

; .wn file association
[HKEY_CLASSES_ROOT\.wn]
@="WatchNexus.Module"

[HKEY_CLASSES_ROOT\WatchNexus.Module]
@="WatchNexus Module"

[HKEY_CLASSES_ROOT\WatchNexus.Module\DefaultIcon]
@="C:\\Program Files\\WatchNexus\\WatchNexus.exe,1"

; .wnp plugin association
[HKEY_CLASSES_ROOT\.wnp]
@="WatchNexus.Plugin"

[HKEY_CLASSES_ROOT\WatchNexus.Plugin]
@="WatchNexus Plugin"

[HKEY_CLASSES_ROOT\WatchNexus.Plugin\shell\open\command]
@="\"C:\\Program Files\\WatchNexus\\WatchNexus.exe\" --install-plugin \"%1\""

; .wnt theme association
[HKEY_CLASSES_ROOT\.wnt]
@="WatchNexus.Theme"

[HKEY_CLASSES_ROOT\WatchNexus.Theme]
@="WatchNexus Theme"
```

### macOS UTI Declaration

```xml
<!-- In Info.plist -->
<key>UTExportedTypeDeclarations</key>
<array>
    <dict>
        <key>UTTypeIdentifier</key>
        <string>com.watchnexus.wn</string>
        <key>UTTypeDescription</key>
        <string>WatchNexus Module</string>
        <key>UTTypeConformsTo</key>
        <array>
            <string>public.data</string>
        </array>
        <key>UTTypeTagSpecification</key>
        <dict>
            <key>public.filename-extension</key>
            <array>
                <string>wn</string>
            </array>
        </dict>
    </dict>
    <dict>
        <key>UTTypeIdentifier</key>
        <string>com.watchnexus.wnp</string>
        <key>UTTypeDescription</key>
        <string>WatchNexus Plugin</string>
        <key>UTTypeConformsTo</key>
        <array>
            <string>public.data</string>
        </array>
        <key>UTTypeTagSpecification</key>
        <dict>
            <key>public.filename-extension</key>
            <array>
                <string>wnp</string>
            </array>
        </dict>
    </dict>
</array>
```

### Linux MIME Types

```xml
<!-- watchnexus.xml - Install to /usr/share/mime/packages/ -->
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
    <mime-type type="application/x-watchnexus-module">
        <comment>WatchNexus Module</comment>
        <glob pattern="*.wn"/>
        <icon name="watchnexus-module"/>
    </mime-type>
    <mime-type type="application/x-watchnexus-plugin">
        <comment>WatchNexus Plugin</comment>
        <glob pattern="*.wnp"/>
        <icon name="watchnexus-plugin"/>
    </mime-type>
    <mime-type type="application/x-watchnexus-theme">
        <comment>WatchNexus Theme</comment>
        <glob pattern="*.wnt"/>
        <icon name="watchnexus-theme"/>
    </mime-type>
</mime-info>
```

---

## 8. Build Pipeline

### Complete Build Script

```bash
#!/bin/bash
# build-fortress.sh - Build protected WatchNexus release

VERSION="2.5.5"
MODULES="database marmalade compote fondue zest sieve garnish drizzle preserve relish"

echo "=== WatchNexus Fortress Build ==="
echo "Version: $VERSION"

# Detect platform
case "$(uname -s)" in
    Linux*)     PLATFORM="linux";;
    Darwin*)    PLATFORM="macos";;
    MINGW*|CYGWIN*) PLATFORM="windows";;
esac

echo "Platform: $PLATFORM"

# Create output directories
mkdir -p dist/{lib,bin}

# Compile Python modules to .wn
for module in $MODULES; do
    echo "Compiling: $module.py"
    python wncompile.py \
        --native \
        backend/$module.py \
        -o dist/lib/$module.wn
done

# Build native DLLs/dylibs/SOs
if [ "$PLATFORM" = "windows" ]; then
    echo "Building Windows DLLs..."
    cl /LD native/wncore.c /Fe:dist/bin/wncore.dll
    cl /LD native/wnmedia.c /Fe:dist/bin/wnmedia.dll
elif [ "$PLATFORM" = "macos" ]; then
    echo "Building macOS frameworks..."
    ./scripts/build-framework.sh WNCore
    ./scripts/build-framework.sh WNMedia
else
    echo "Building Linux shared objects..."
    gcc -shared -fPIC -o dist/lib/libwncore.so native/wncore.c
    gcc -shared -fPIC -o dist/lib/libwnmedia.so native/wnmedia.c
fi

# Sign binaries
if [ "$PLATFORM" = "macos" ]; then
    codesign -s "Developer ID Application" dist/lib/*.dylib
    codesign -s "Developer ID Application" dist/Frameworks/*
elif [ "$PLATFORM" = "windows" ]; then
    signtool sign /f certificate.pfx /p $CERT_PASSWORD dist/bin/*.dll
fi

echo "=== Build Complete ==="
ls -la dist/lib/
ls -la dist/bin/
```

---

## 9. Summary: What Users Will See

### Windows Users
```
C:\Program Files\WatchNexus\
├── WatchNexus.exe
├── bin\
│   ├── wncore.dll          ← "Wow, real DLLs!"
│   ├── wnmedia.dll
│   └── wntorrent.dll
├── lib\
│   ├── marmalade.wn        ← "Custom file format!"
│   ├── compote.wn
│   └── fondue.wn
└── plugins\
    └── discord.wnp          ← "Even plugins have their own format!"
```

### macOS Users
```
WatchNexus.app/
├── Contents/
│   ├── Frameworks/
│   │   ├── WNCore.framework    ← "Professional macOS frameworks!"
│   │   └── WNMedia.framework
│   ├── Resources/
│   │   └── lib/
│   │       ├── marmalade.wn
│   │       └── compote.wn
```

### Linux Users
```
/opt/watchnexus/
├── bin/
│   └── watchnexus
├── lib/
│   ├── libwncore.so         ← "Proper Linux shared objects!"
│   ├── marmalade.wn.so
│   └── compote.wn.so
```

---

## 10. Professional Polish Checklist

- [x] Custom file icons for .wn, .wnf, .wnc, .wnd, .wnp, .wnt files ✅ **READY**
- [ ] Version info embedded in all binaries
- [ ] Digital signatures on all executables
- [ ] File association for double-click install of plugins/themes
- [ ] Branded installer with license agreement
- [ ] Splash screen during initialization
- [ ] "About" dialog showing all component versions
- [ ] Help → Check for Updates integration
- [ ] Crash reporter with automatic submission
- [ ] Telemetry (opt-in) for usage analytics

---

## 11. Icon Asset Reference

Icons are stored at: `/app/assets/icons/wn_icon_pack/`

### Icon Pack Contents

| Extension | Label | Badge Color | Purpose |
|-----------|-------|-------------|---------|
| `.wn` | MOD | Gold `#FFAD20` | Compiled core module |
| `.wnf` | FW | Blue `#52A8FF` | Framework/library bundle |
| `.wnc` | CFG | Purple `#C45CFF` | Encrypted configuration |
| `.wnd` | DATA | Teal `#42E0A0` | Encrypted data cache |
| `.wnp` | PLG | Pink `#FF5C99` | Plugin package |
| `.wnt` | THM | Orange `#FF7440` | Theme package |

### Sizes Included (per extension)

| Size | Use Case |
|------|----------|
| 16x16 | Taskbar, file lists |
| 24x24 | Small icons |
| 32x32 | Standard desktop icons |
| 48x48 | Medium icons |
| 64x64 | Large icons |
| 96x96 | High-DPI small |
| 128x128 | App icons, thumbnails |
| 256x256 | High-DPI icons |
| 512x512 | Very high-DPI, stores |
| 1024x1024 | macOS retina, promotional |

### Platform-Specific Formats

| Platform | Format | Location |
|----------|--------|----------|
| **Windows** | `.ico` | `wn_icon_pack/{ext}/watchnexus_{ext}.ico` |
| **macOS** | `.icns` | `wn_icon_pack/{ext}/watchnexus_{ext}.icns` |
| **macOS Xcode** | `.appiconset` | `wn_icon_pack/{ext}/macOS_AppIcon.appiconset/` |
| **Linux** | `.png` | `wn_icon_pack/{ext}/watchnexus_{ext}_{size}.png` |

### Usage in Build Scripts

```bash
# Windows installer (Inno Setup / NSIS)
[Icons]
Name: "{group}\WatchNexus"; Filename: "{app}\WatchNexus.exe"; IconFilename: "{app}\icons\watchnexus_wn.ico"

# macOS Info.plist
<key>CFBundleIconFile</key>
<string>watchnexus_wn.icns</string>

# Linux .desktop file
Icon=/usr/share/icons/hicolor/256x256/apps/watchnexus.png
```
