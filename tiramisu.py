"""
WatchNexus Tiramisu - Auto-Updater Module 🍰

Codename: Tiramisu

Features:
- Check for new releases from GitHub/update server
- Download updates in background
- One-click update installation
- Rollback capability
- Update notifications

Usage:
    from tiramisu import TiramisuUpdater
    updater = TiramisuUpdater()
    if updater.check_for_updates():
        updater.download_and_install()
"""

import os
import sys
import json
import shutil
import hashlib
import zipfile
import tempfile
import threading
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Callable
from dataclasses import dataclass

try:
    import requests
except ImportError:
    requests = None

# Configuration
WATCHNEXUS_DIR = Path(__file__).parent
VERSION_FILE = WATCHNEXUS_DIR / "VERSION"
BACKUP_DIR = WATCHNEXUS_DIR / "backups" / "updates"
UPDATE_CACHE_DIR = WATCHNEXUS_DIR / ".update_cache"

# Update sources
GITHUB_REPO = "watchnexus/watchnexus"
GITHUB_API = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
CUSTOM_UPDATE_URL = os.environ.get("WATCHNEXUS_UPDATE_URL", "")

# Current version (fallback)
CURRENT_VERSION = "2.5.0"


@dataclass
class UpdateInfo:
    """Information about an available update."""
    version: str
    release_date: str
    download_url: str
    changelog: str
    size_bytes: int
    checksum: str
    is_prerelease: bool
    
    @property
    def size_mb(self) -> float:
        return self.size_bytes / (1024 * 1024)


class TiramisuUpdater:
    """
    WatchNexus Auto-Updater
    
    Handles checking, downloading, and installing updates.
    """
    
    def __init__(self, 
                 current_version: str = None,
                 check_interval_hours: int = 24,
                 include_prereleases: bool = False,
                 on_update_available: Callable = None,
                 on_download_progress: Callable = None,
                 on_update_complete: Callable = None,
                 on_error: Callable = None):
        """
        Initialize the updater.
        
        Args:
            current_version: Current installed version (auto-detected if None)
            check_interval_hours: How often to check for updates
            include_prereleases: Whether to include pre-release versions
            on_update_available: Callback when update is found
            on_download_progress: Callback for download progress (percent, bytes)
            on_update_complete: Callback when update is installed
            on_error: Callback for errors
        """
        self.current_version = current_version or self._get_current_version()
        self.check_interval = timedelta(hours=check_interval_hours)
        self.include_prereleases = include_prereleases
        
        # Callbacks
        self.on_update_available = on_update_available
        self.on_download_progress = on_download_progress
        self.on_update_complete = on_update_complete
        self.on_error = on_error
        
        # State
        self.latest_update: Optional[UpdateInfo] = None
        self.last_check: Optional[datetime] = None
        self.is_checking = False
        self.is_downloading = False
        self.download_progress = 0
        
        # Ensure directories exist
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        UPDATE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        # Load last check time
        self._load_state()
    
    def _get_current_version(self) -> str:
        """Get current installed version."""
        # Try VERSION file
        if VERSION_FILE.exists():
            try:
                return VERSION_FILE.read_text().strip()
            except:
                pass
        
        # Try backend server.py
        server_file = WATCHNEXUS_DIR / "backend" / "server.py"
        if server_file.exists():
            try:
                content = server_file.read_text()
                for line in content.split('\n'):
                    if 'VERSION' in line and '=' in line:
                        # Extract version string
                        version = line.split('=')[1].strip().strip('"\'')
                        if version[0].isdigit():
                            return version
            except:
                pass
        
        return CURRENT_VERSION
    
    def _load_state(self):
        """Load updater state from cache."""
        state_file = UPDATE_CACHE_DIR / "state.json"
        if state_file.exists():
            try:
                data = json.loads(state_file.read_text())
                if data.get("last_check"):
                    self.last_check = datetime.fromisoformat(data["last_check"])
            except:
                pass
    
    def _save_state(self):
        """Save updater state to cache."""
        state_file = UPDATE_CACHE_DIR / "state.json"
        try:
            data = {
                "last_check": self.last_check.isoformat() if self.last_check else None,
                "current_version": self.current_version
            }
            state_file.write_text(json.dumps(data, indent=2))
        except:
            pass
    
    def should_check(self) -> bool:
        """Check if it's time to check for updates."""
        if not self.last_check:
            return True
        return datetime.now() - self.last_check > self.check_interval
    
    def check_for_updates(self, force: bool = False) -> Optional[UpdateInfo]:
        """
        Check for available updates.
        
        Args:
            force: Force check even if recently checked
            
        Returns:
            UpdateInfo if update available, None otherwise
        """
        if not force and not self.should_check():
            return self.latest_update
        
        if self.is_checking:
            return None
        
        self.is_checking = True
        
        try:
            # Try GitHub first
            update = self._check_github()
            
            # Fallback to custom update server
            if not update and CUSTOM_UPDATE_URL:
                update = self._check_custom_server()
            
            self.last_check = datetime.now()
            self._save_state()
            
            if update and self._is_newer_version(update.version):
                self.latest_update = update
                if self.on_update_available:
                    self.on_update_available(update)
                return update
            
            return None
            
        except Exception as e:
            if self.on_error:
                self.on_error(f"Update check failed: {str(e)}")
            return None
        finally:
            self.is_checking = False
    
    def _check_github(self) -> Optional[UpdateInfo]:
        """Check GitHub releases for updates."""
        if not requests:
            return None
        
        try:
            headers = {"Accept": "application/vnd.github.v3+json"}
            
            # Check latest release
            response = requests.get(GITHUB_API, headers=headers, timeout=10)
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            
            # Skip prereleases unless enabled
            if data.get("prerelease") and not self.include_prereleases:
                return None
            
            # Find the right asset (prefer Linux zip)
            download_url = None
            size_bytes = 0
            
            for asset in data.get("assets", []):
                name = asset.get("name", "").lower()
                if "linux" in name and name.endswith(".zip"):
                    download_url = asset.get("browser_download_url")
                    size_bytes = asset.get("size", 0)
                    break
            
            # Fallback to source zip
            if not download_url:
                download_url = data.get("zipball_url")
                size_bytes = 0  # Unknown for source archives
            
            if not download_url:
                return None
            
            return UpdateInfo(
                version=data.get("tag_name", "").lstrip("v"),
                release_date=data.get("published_at", "")[:10],
                download_url=download_url,
                changelog=data.get("body", ""),
                size_bytes=size_bytes,
                checksum="",  # GitHub doesn't provide checksums
                is_prerelease=data.get("prerelease", False)
            )
            
        except Exception:
            return None
    
    def _check_custom_server(self) -> Optional[UpdateInfo]:
        """Check custom update server for updates."""
        if not requests or not CUSTOM_UPDATE_URL:
            return None
        
        try:
            response = requests.get(
                f"{CUSTOM_UPDATE_URL}/latest",
                timeout=10
            )
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            
            return UpdateInfo(
                version=data.get("version", ""),
                release_date=data.get("date", ""),
                download_url=data.get("download_url", ""),
                changelog=data.get("changelog", ""),
                size_bytes=data.get("size", 0),
                checksum=data.get("checksum", ""),
                is_prerelease=data.get("prerelease", False)
            )
            
        except Exception:
            return None
    
    def _is_newer_version(self, new_version: str) -> bool:
        """Compare versions to check if new_version is newer."""
        try:
            def parse_version(v):
                # Handle versions like "2.5.0", "2.5.0-beta.1"
                v = v.lstrip("v").split("-")[0]
                return tuple(int(x) for x in v.split("."))
            
            current = parse_version(self.current_version)
            new = parse_version(new_version)
            
            return new > current
        except:
            return False
    
    def download_update(self, update: UpdateInfo = None) -> Optional[Path]:
        """
        Download an update package.
        
        Args:
            update: Update to download (uses latest if None)
            
        Returns:
            Path to downloaded file, or None on failure
        """
        update = update or self.latest_update
        if not update:
            return None
        
        if not requests:
            if self.on_error:
                self.on_error("requests module not available")
            return None
        
        if self.is_downloading:
            return None
        
        self.is_downloading = True
        self.download_progress = 0
        
        try:
            # Download file
            response = requests.get(
                update.download_url,
                stream=True,
                timeout=30
            )
            
            if response.status_code != 200:
                raise Exception(f"Download failed: HTTP {response.status_code}")
            
            # Get total size
            total_size = int(response.headers.get('content-length', 0))
            if total_size == 0:
                total_size = update.size_bytes
            
            # Download to temp file
            download_path = UPDATE_CACHE_DIR / f"watchnexus-{update.version}.zip"
            downloaded = 0
            
            with open(download_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        if total_size > 0:
                            self.download_progress = int((downloaded / total_size) * 100)
                            if self.on_download_progress:
                                self.on_download_progress(self.download_progress, downloaded)
            
            # Verify checksum if provided
            if update.checksum:
                actual_checksum = self._calculate_checksum(download_path)
                if actual_checksum != update.checksum:
                    download_path.unlink()
                    raise Exception("Checksum verification failed")
            
            return download_path
            
        except Exception as e:
            if self.on_error:
                self.on_error(f"Download failed: {str(e)}")
            return None
        finally:
            self.is_downloading = False
    
    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of a file."""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def create_backup(self) -> Optional[Path]:
        """
        Create a backup of the current installation.
        
        Returns:
            Path to backup, or None on failure
        """
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"watchnexus_{self.current_version}_{timestamp}"
            backup_path = BACKUP_DIR / backup_name
            
            # Create backup directory
            backup_path.mkdir(parents=True, exist_ok=True)
            
            # Backup critical directories
            dirs_to_backup = ["backend", "frontend/src"]
            
            for dir_name in dirs_to_backup:
                src = WATCHNEXUS_DIR / dir_name
                if src.exists():
                    dst = backup_path / dir_name
                    if src.is_dir():
                        shutil.copytree(src, dst, ignore=shutil.ignore_patterns(
                            'node_modules', '__pycache__', '*.pyc', '.git', 'build'
                        ))
                    else:
                        dst.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(src, dst)
            
            # Save version info
            (backup_path / "VERSION").write_text(self.current_version)
            
            # Create backup manifest
            manifest = {
                "version": self.current_version,
                "date": datetime.now().isoformat(),
                "directories": dirs_to_backup
            }
            (backup_path / "manifest.json").write_text(json.dumps(manifest, indent=2))
            
            return backup_path
            
        except Exception as e:
            if self.on_error:
                self.on_error(f"Backup failed: {str(e)}")
            return None
    
    def install_update(self, update_file: Path, backup_first: bool = True) -> bool:
        """
        Install an update from a downloaded file.
        
        Args:
            update_file: Path to update zip file
            backup_first: Create backup before installing
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Create backup
            if backup_first:
                backup_path = self.create_backup()
                if not backup_path:
                    raise Exception("Backup failed, aborting update")
            
            # Extract update to temp directory
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                with zipfile.ZipFile(update_file, 'r') as zf:
                    zf.extractall(temp_path)
                
                # Find the extracted content (may be in a subdirectory)
                extracted_dirs = list(temp_path.iterdir())
                if len(extracted_dirs) == 1 and extracted_dirs[0].is_dir():
                    source_dir = extracted_dirs[0]
                else:
                    source_dir = temp_path
                
                # Install backend
                backend_src = source_dir / "backend"
                if backend_src.exists():
                    backend_dst = WATCHNEXUS_DIR / "backend"
                    # Remove old files (except data directories)
                    for item in backend_dst.iterdir():
                        if item.name not in ['data', 'logs', 'backups', '.env', 'watchnexus.db']:
                            if item.is_dir():
                                shutil.rmtree(item)
                            else:
                                item.unlink()
                    # Copy new files
                    for item in backend_src.iterdir():
                        dst = backend_dst / item.name
                        if item.is_dir():
                            if dst.exists():
                                shutil.rmtree(dst)
                            shutil.copytree(item, dst)
                        else:
                            shutil.copy2(item, dst)
                
                # Install frontend source
                frontend_src = source_dir / "frontend" / "src"
                if frontend_src.exists():
                    frontend_dst = WATCHNEXUS_DIR / "frontend" / "src"
                    if frontend_dst.exists():
                        shutil.rmtree(frontend_dst)
                    shutil.copytree(frontend_src, frontend_dst)
            
            # Update version file
            if self.latest_update:
                VERSION_FILE.write_text(self.latest_update.version)
                self.current_version = self.latest_update.version
            
            # Clean up download cache
            for f in UPDATE_CACHE_DIR.glob("*.zip"):
                try:
                    f.unlink()
                except:
                    pass
            
            if self.on_update_complete:
                self.on_update_complete(self.current_version)
            
            return True
            
        except Exception as e:
            if self.on_error:
                self.on_error(f"Installation failed: {str(e)}")
            return False
    
    def download_and_install(self, update: UpdateInfo = None) -> bool:
        """
        Download and install an update in one step.
        
        Args:
            update: Update to install (uses latest if None)
            
        Returns:
            True if successful, False otherwise
        """
        update = update or self.latest_update
        if not update:
            if self.on_error:
                self.on_error("No update available")
            return False
        
        # Download
        update_file = self.download_update(update)
        if not update_file:
            return False
        
        # Install
        return self.install_update(update_file)
    
    def rollback(self, backup_name: str = None) -> bool:
        """
        Rollback to a previous version.
        
        Args:
            backup_name: Specific backup to restore (latest if None)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Find backup
            if backup_name:
                backup_path = BACKUP_DIR / backup_name
            else:
                # Get latest backup
                backups = sorted(BACKUP_DIR.iterdir(), reverse=True)
                if not backups:
                    raise Exception("No backups available")
                backup_path = backups[0]
            
            if not backup_path.exists():
                raise Exception(f"Backup not found: {backup_path}")
            
            # Load manifest
            manifest_file = backup_path / "manifest.json"
            if manifest_file.exists():
                manifest = json.loads(manifest_file.read_text())
            else:
                manifest = {"directories": ["backend", "frontend/src"]}
            
            # Restore directories
            for dir_name in manifest.get("directories", []):
                src = backup_path / dir_name
                if src.exists():
                    dst = WATCHNEXUS_DIR / dir_name
                    if dst.exists():
                        shutil.rmtree(dst)
                    shutil.copytree(src, dst)
            
            # Restore version
            version_file = backup_path / "VERSION"
            if version_file.exists():
                VERSION_FILE.write_text(version_file.read_text())
                self.current_version = version_file.read_text().strip()
            
            return True
            
        except Exception as e:
            if self.on_error:
                self.on_error(f"Rollback failed: {str(e)}")
            return False
    
    def list_backups(self) -> list:
        """Get list of available backups."""
        backups = []
        
        for backup_dir in sorted(BACKUP_DIR.iterdir(), reverse=True):
            if backup_dir.is_dir():
                manifest_file = backup_dir / "manifest.json"
                if manifest_file.exists():
                    try:
                        manifest = json.loads(manifest_file.read_text())
                        backups.append({
                            "name": backup_dir.name,
                            "version": manifest.get("version", "unknown"),
                            "date": manifest.get("date", "unknown"),
                            "path": str(backup_dir)
                        })
                    except:
                        backups.append({
                            "name": backup_dir.name,
                            "version": "unknown",
                            "date": "unknown",
                            "path": str(backup_dir)
                        })
        
        return backups
    
    def cleanup_old_backups(self, keep_count: int = 5):
        """Remove old backups, keeping only the most recent ones."""
        backups = sorted(BACKUP_DIR.iterdir(), reverse=True)
        
        for backup in backups[keep_count:]:
            try:
                if backup.is_dir():
                    shutil.rmtree(backup)
            except:
                pass
    
    def check_async(self, callback: Callable = None):
        """Check for updates in background thread."""
        def _check():
            result = self.check_for_updates()
            if callback:
                callback(result)
        
        thread = threading.Thread(target=_check, daemon=True)
        thread.start()
        return thread


# Standalone CLI
def main():
    """Command-line interface for Tiramisu updater."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="WatchNexus Tiramisu - Auto-Updater",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Check command
    check_parser = subparsers.add_parser("check", help="Check for updates")
    check_parser.add_argument("--prereleases", action="store_true", help="Include pre-releases")
    
    # Update command
    update_parser = subparsers.add_parser("update", help="Download and install update")
    update_parser.add_argument("--no-backup", action="store_true", help="Skip backup")
    
    # Rollback command
    rollback_parser = subparsers.add_parser("rollback", help="Rollback to previous version")
    rollback_parser.add_argument("--backup", type=str, help="Specific backup name")
    
    # Backups command
    subparsers.add_parser("backups", help="List available backups")
    
    # Version command
    subparsers.add_parser("version", help="Show current version")
    
    args = parser.parse_args()
    
    # Initialize updater
    updater = TiramisuUpdater(
        include_prereleases=getattr(args, 'prereleases', False),
        on_download_progress=lambda p, b: print(f"\rDownloading: {p}%", end="", flush=True),
        on_error=lambda e: print(f"Error: {e}")
    )
    
    if args.command == "check":
        print(f"Current version: {updater.current_version}")
        print("Checking for updates...")
        
        update = updater.check_for_updates(force=True)
        
        if update:
            print(f"\n✓ Update available: v{update.version}")
            print(f"  Released: {update.release_date}")
            print(f"  Size: {update.size_mb:.1f} MB")
            if update.is_prerelease:
                print("  (Pre-release)")
            print(f"\nChangelog:\n{update.changelog[:500]}...")
        else:
            print("\n✓ You're running the latest version!")
    
    elif args.command == "update":
        print("Checking for updates...")
        update = updater.check_for_updates(force=True)
        
        if not update:
            print("No updates available.")
            return
        
        print(f"Updating to v{update.version}...")
        
        if updater.download_and_install(update):
            print(f"\n✓ Successfully updated to v{update.version}")
            print("Please restart WatchNexus to apply changes.")
        else:
            print("\n✗ Update failed")
    
    elif args.command == "rollback":
        backup_name = getattr(args, 'backup', None)
        print(f"Rolling back{f' to {backup_name}' if backup_name else ''}...")
        
        if updater.rollback(backup_name):
            print("✓ Rollback successful")
            print("Please restart WatchNexus.")
        else:
            print("✗ Rollback failed")
    
    elif args.command == "backups":
        backups = updater.list_backups()
        
        if not backups:
            print("No backups available.")
            return
        
        print("Available backups:\n")
        for b in backups:
            print(f"  {b['name']}")
            print(f"    Version: {b['version']}")
            print(f"    Date: {b['date']}")
            print()
    
    elif args.command == "version":
        print(f"WatchNexus v{updater.current_version}")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
