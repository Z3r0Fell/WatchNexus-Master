# -*- mode: python ; coding: utf-8 -*-
# WatchNexus Backend PyInstaller Spec
# Builds the backend server into a single executable

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Get the server directory
server_dir = os.path.dirname(os.path.abspath(SPEC))
src_dir = os.path.dirname(server_dir)

# Collect all hidden imports
hidden_imports = [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'aiosqlite',
    'bcrypt',
    'passlib.handlers',
    'passlib.handlers.bcrypt',
    'feedparser',
    'bs4',
    'httpx',
    'pydantic',
    'starlette',
    'fastapi',
    'multipart',
    'python_multipart',
]

# Data files to include
datas = [
    # Include any data files the server needs
]

# Analysis
a = Analysis(
    ['server.py'],
    pathex=[server_dir],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'scipy',
        'numpy',
        'pandas',
        'PIL',
        'cv2',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

# Remove unnecessary files to reduce size
excluded_binaries = [
    'libcrypto',  # Will be loaded from system
    'libssl',
    '_tkinter',
]

a.binaries = [b for b in a.binaries if not any(ex in b[0] for ex in excluded_binaries)]

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='watchnexus-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Keep console for logging
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Add icon path here for Windows
)
