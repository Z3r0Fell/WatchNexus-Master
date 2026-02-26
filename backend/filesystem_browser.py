"""
OS-Aware Filesystem Browser Module
Handles directory browsing with OS-specific logic for Windows, macOS, and Linux.
"""
import os
import platform
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import string


class OSType(Enum):
    WINDOWS = "windows"
    MACOS = "darwin"
    LINUX = "linux"
    UNKNOWN = "unknown"


@dataclass
class DirectoryItem:
    name: str
    path: str
    is_directory: bool
    is_parent: bool = False
    item_count: int = 0
    permission_denied: bool = False
    is_hidden: bool = False
    is_symlink: bool = False


@dataclass
class DriveInfo:
    name: str
    path: str
    label: str = ""
    is_removable: bool = False
    is_network: bool = False


@dataclass
class BrowseResult:
    current_path: str
    parent_path: Optional[str]
    items: List[Dict]
    drives: List[Dict]
    is_root: bool
    os_type: str
    path_separator: str
    home_directory: str
    media_count: int = 0
    error: Optional[str] = None


class FilesystemBrowser:
    """OS-aware filesystem browser with proper path handling."""
    
    MEDIA_EXTENSIONS = {
        '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v',
        '.mp3', '.flac', '.wav', '.aac', '.m4a', '.ogg', '.wma',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic'
    }
    
    # Blocked system paths per OS
    BLOCKED_PATHS = {
        OSType.WINDOWS: [
            'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)',
            'C:\\ProgramData', 'C:\\$Recycle.Bin', 'C:\\System Volume Information'
        ],
        OSType.MACOS: [
            '/System', '/private', '/Library/Caches', '/bin', '/sbin',
            '/usr/bin', '/usr/sbin', '/var/log'
        ],
        OSType.LINUX: [
            '/proc', '/sys', '/dev', '/boot', '/etc/shadow', '/etc/passwd',
            '/root', '/var/log', '/run', '/snap'
        ]
    }
    
    def __init__(self):
        self.os_type = self._detect_os()
        self.path_separator = '\\' if self.os_type == OSType.WINDOWS else '/'
        self.home_dir = self._get_home_directory()
    
    def _detect_os(self) -> OSType:
        """Detect the current operating system."""
        system = platform.system().lower()
        if system == 'windows':
            return OSType.WINDOWS
        elif system == 'darwin':
            return OSType.MACOS
        elif system == 'linux':
            return OSType.LINUX
        return OSType.UNKNOWN
    
    def _get_home_directory(self) -> str:
        """Get the user's home directory."""
        home = os.path.expanduser("~")
        if home and home != "~" and os.path.exists(home):
            return home
        
        # Fallbacks per OS
        if self.os_type == OSType.WINDOWS:
            return "C:\\Users"
        elif self.os_type == OSType.MACOS:
            return "/Users"
        else:
            return "/home"
    
    def _normalize_path(self, path: str) -> str:
        """Normalize path for the current OS."""
        if not path:
            return self._get_default_start_path()
        
        # Convert forward/back slashes appropriately
        if self.os_type == OSType.WINDOWS:
            path = path.replace('/', '\\')
            # Ensure drive letter is uppercase
            if len(path) >= 2 and path[1] == ':':
                path = path[0].upper() + path[1:]
        else:
            path = path.replace('\\', '/')
        
        # Resolve the path
        try:
            resolved = Path(path).resolve()
            return str(resolved)
        except Exception:
            return path
    
    def _get_default_start_path(self) -> str:
        """Get the default starting path based on OS."""
        if self.os_type == OSType.WINDOWS:
            # Start at user's home or C:
            if os.path.exists(self.home_dir):
                return self.home_dir
            return "C:\\"
        
        elif self.os_type == OSType.MACOS:
            # Start at user's home
            if os.path.exists(self.home_dir):
                return self.home_dir
            return "/Users"
        
        else:  # Linux
            # Try user home first, then /home, then /
            if os.path.exists(self.home_dir) and self.home_dir != "/root":
                return self.home_dir
            
            # Check for user directories in /home
            if os.path.exists("/home"):
                try:
                    users = [d for d in os.listdir("/home") 
                             if os.path.isdir(os.path.join("/home", d)) 
                             and not d.startswith('.')]
                    if users:
                        return os.path.join("/home", users[0])
                except PermissionError:
                    pass
            
            return "/"
    
    def _is_path_blocked(self, path: str) -> bool:
        """Check if a path is in the blocked list."""
        path_lower = path.lower() if self.os_type == OSType.WINDOWS else path
        blocked = self.BLOCKED_PATHS.get(self.os_type, [])
        
        for blocked_path in blocked:
            blocked_lower = blocked_path.lower() if self.os_type == OSType.WINDOWS else blocked_path
            if path_lower.startswith(blocked_lower):
                return True
        return False
    
    def _is_root_path(self, path: str) -> bool:
        """Check if the path is a root path."""
        if self.os_type == OSType.WINDOWS:
            # C:\ or D:\ etc.
            return len(path) <= 3 and path[1:] in (':\\', ':')
        else:
            return path == '/'
    
    def _get_parent_path(self, path: str) -> Optional[str]:
        """Get the parent path, or None if at root."""
        if self._is_root_path(path):
            return None
        
        parent = Path(path).parent
        parent_str = str(parent)
        
        # Windows: Ensure drive letter format
        if self.os_type == OSType.WINDOWS:
            if len(parent_str) == 2 and parent_str[1] == ':':
                parent_str += '\\'
        
        return parent_str
    
    def get_drives(self) -> List[Dict]:
        """Get available drives/mount points based on OS."""
        drives = []
        
        if self.os_type == OSType.WINDOWS:
            # Windows: List all available drive letters
            for letter in string.ascii_uppercase:
                drive_path = f"{letter}:\\"
                if os.path.exists(drive_path):
                    try:
                        # Try to get volume label
                        label = letter + ":"
                        drives.append({
                            "name": label,
                            "path": drive_path,
                            "label": label,
                            "type": "drive"
                        })
                    except Exception:
                        pass
        
        elif self.os_type == OSType.MACOS:
            # macOS: /Volumes and common paths
            drives.append({"name": "Macintosh HD", "path": "/", "type": "root"})
            drives.append({"name": "Home", "path": self.home_dir, "type": "home"})
            
            # List /Volumes for external drives
            volumes_path = "/Volumes"
            if os.path.exists(volumes_path):
                try:
                    for vol in os.listdir(volumes_path):
                        vol_path = os.path.join(volumes_path, vol)
                        if os.path.isdir(vol_path) and vol != "Macintosh HD":
                            drives.append({
                                "name": vol,
                                "path": vol_path,
                                "type": "volume"
                            })
                except PermissionError:
                    pass
        
        else:  # Linux
            # Common Linux mount points
            linux_mounts = [
                ("/", "Root"),
                ("/home", "Home"),
                ("/media", "Media"),
                ("/mnt", "Mount"),
                ("/srv", "Server"),
                ("/data", "Data"),
            ]
            
            for mount_path, mount_name in linux_mounts:
                if os.path.exists(mount_path) and os.path.isdir(mount_path):
                    drives.append({
                        "name": mount_name,
                        "path": mount_path,
                        "type": "mount"
                    })
            
            # Add user's home directory
            if self.home_dir and self.home_dir not in [d["path"] for d in drives]:
                drives.append({
                    "name": "My Home",
                    "path": self.home_dir,
                    "type": "home"
                })
            
            # List user directories in /home
            if os.path.exists("/home"):
                try:
                    for user_dir in os.listdir("/home"):
                        user_path = os.path.join("/home", user_dir)
                        if os.path.isdir(user_path) and not user_dir.startswith('.'):
                            if user_path not in [d["path"] for d in drives]:
                                drives.append({
                                    "name": f"~{user_dir}",
                                    "path": user_path,
                                    "type": "user_home"
                                })
                except PermissionError:
                    pass
        
        return drives
    
    def browse(self, path: str = "") -> BrowseResult:
        """Browse a directory and return its contents."""
        # Normalize the path
        normalized_path = self._normalize_path(path)
        
        # Check if path is blocked
        if self._is_path_blocked(normalized_path):
            return BrowseResult(
                current_path=normalized_path,
                parent_path=self._get_parent_path(normalized_path),
                items=[],
                drives=self.get_drives(),
                is_root=self._is_root_path(normalized_path),
                os_type=self.os_type.value,
                path_separator=self.path_separator,
                home_directory=self.home_dir,
                error="Access denied to system directory"
            )
        
        # Verify path exists
        target = Path(normalized_path)
        if not target.exists():
            # Try to find closest existing parent
            while not target.exists() and target.parent != target:
                target = target.parent
            normalized_path = str(target)
        
        if not target.is_dir():
            return BrowseResult(
                current_path=normalized_path,
                parent_path=self._get_parent_path(normalized_path),
                items=[],
                drives=self.get_drives(),
                is_root=self._is_root_path(normalized_path),
                os_type=self.os_type.value,
                path_separator=self.path_separator,
                home_directory=self.home_dir,
                error="Path is not a directory"
            )
        
        items = []
        media_count = 0
        
        try:
            # List directory contents
            entries = sorted(target.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
            
            for entry in entries:
                try:
                    # Determine if hidden
                    is_hidden = entry.name.startswith('.')
                    if self.os_type == OSType.WINDOWS:
                        try:
                            import ctypes
                            attrs = ctypes.windll.kernel32.GetFileAttributesW(str(entry))
                            is_hidden = attrs != -1 and bool(attrs & 2)
                        except Exception:
                            pass
                    
                    # Skip hidden items
                    if is_hidden:
                        continue
                    
                    if entry.is_dir():
                        item_count = 0
                        permission_denied = False
                        
                        try:
                            item_count = sum(1 for _ in entry.iterdir())
                        except PermissionError:
                            permission_denied = True
                        except Exception:
                            pass
                        
                        items.append({
                            "name": entry.name,
                            "path": str(entry),
                            "type": "directory",
                            "is_parent": False,
                            "item_count": item_count,
                            "permission_denied": permission_denied,
                            "is_symlink": entry.is_symlink()
                        })
                    
                    elif entry.is_file():
                        # Count media files
                        if entry.suffix.lower() in self.MEDIA_EXTENSIONS:
                            media_count += 1
                
                except PermissionError:
                    continue
                except Exception:
                    continue
        
        except PermissionError:
            return BrowseResult(
                current_path=normalized_path,
                parent_path=self._get_parent_path(normalized_path),
                items=[],
                drives=self.get_drives(),
                is_root=self._is_root_path(normalized_path),
                os_type=self.os_type.value,
                path_separator=self.path_separator,
                home_directory=self.home_dir,
                error="Permission denied"
            )
        
        return BrowseResult(
            current_path=normalized_path,
            parent_path=self._get_parent_path(normalized_path),
            items=items,
            drives=self.get_drives(),
            is_root=self._is_root_path(normalized_path),
            os_type=self.os_type.value,
            path_separator=self.path_separator,
            home_directory=self.home_dir,
            media_count=media_count
        )


# Singleton instance
_browser_instance = None

def get_filesystem_browser() -> FilesystemBrowser:
    """Get or create the filesystem browser singleton."""
    global _browser_instance
    if _browser_instance is None:
        _browser_instance = FilesystemBrowser()
    return _browser_instance
