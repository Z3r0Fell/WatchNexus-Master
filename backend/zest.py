"""
Zest - WatchNexus Log Viewer & System Monitor
🍋 Adds flavor to debugging - view logs, system health, and diagnostics

Features:
- Real-time log viewing from backend/logs/watchnexus.log
- Log filtering by level (INFO, WARNING, ERROR, DEBUG)
- Log search functionality
- System health metrics
- Log rotation status
- Download logs as file
"""

import os
import re
import logging
from pathlib import Path
from typing import Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
import psutil

logger = logging.getLogger(__name__)

# Log file location
ROOT_DIR = Path(__file__).parent
LOG_DIR = ROOT_DIR / "logs"
LOG_FILE = LOG_DIR / "watchnexus.log"


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


@dataclass
class LogEntry:
    """Represents a parsed log entry."""
    timestamp: str
    level: str
    logger_name: str
    message: str
    raw: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "level": self.level,
            "logger": self.logger_name,
            "message": self.message,
            "raw": self.raw
        }


class ZestLogViewer:
    """
    Zest - Log viewer and system monitor for WatchNexus.
    Provides real-time access to application logs and system health.
    """
    
    # Pattern to parse log lines: 2024-02-23 12:34:56,789 - server - INFO - message
    LOG_PATTERN = re.compile(
        r'^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},?\d*)\s+-\s+(\w+)\s+-\s+(\w+)\s+-\s+(.*)$'
    )
    
    def __init__(self, log_file: Path = None):
        self.log_file = log_file or LOG_FILE
        self._ensure_log_dir()
    
    def _ensure_log_dir(self):
        """Ensure log directory exists."""
        LOG_DIR.mkdir(exist_ok=True)
        if not self.log_file.exists():
            self.log_file.touch()
    
    def _parse_log_line(self, line: str) -> Optional[LogEntry]:
        """Parse a single log line into a LogEntry."""
        line = line.strip()
        if not line:
            return None
        
        match = self.LOG_PATTERN.match(line)
        if match:
            return LogEntry(
                timestamp=match.group(1),
                logger_name=match.group(2),
                level=match.group(3),
                message=match.group(4),
                raw=line
            )
        
        # Return unparsed line as raw entry
        return LogEntry(
            timestamp="",
            level="INFO",
            logger_name="unknown",
            message=line,
            raw=line
        )
    
    def get_logs(
        self,
        lines: int = 100,
        level: str = None,
        search: str = None,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get log entries with optional filtering.
        
        Args:
            lines: Maximum number of lines to return
            level: Filter by log level (INFO, WARNING, ERROR, etc.)
            search: Search string to filter messages
            offset: Skip this many matching entries
            
        Returns:
            Dict with logs, total count, and file info
        """
        if not self.log_file.exists():
            return {
                "logs": [],
                "total": 0,
                "file_size": 0,
                "file_path": str(self.log_file),
                "exists": False
            }
        
        try:
            # Read all lines (reverse to get latest first)
            with open(self.log_file, 'r', encoding='utf-8', errors='ignore') as f:
                all_lines = f.readlines()
            
            # Parse and filter
            entries = []
            for line in reversed(all_lines):
                entry = self._parse_log_line(line)
                if not entry:
                    continue
                
                # Apply level filter
                if level and entry.level.upper() != level.upper():
                    continue
                
                # Apply search filter
                if search and search.lower() not in entry.message.lower():
                    continue
                
                entries.append(entry)
            
            total = len(entries)
            
            # Apply pagination
            paginated = entries[offset:offset + lines]
            
            file_stat = self.log_file.stat()
            
            return {
                "logs": [e.to_dict() for e in paginated],
                "total": total,
                "returned": len(paginated),
                "offset": offset,
                "file_size": file_stat.st_size,
                "file_size_formatted": self._format_size(file_stat.st_size),
                "file_path": str(self.log_file),
                "last_modified": datetime.fromtimestamp(file_stat.st_mtime, tz=timezone.utc).isoformat(),
                "exists": True
            }
            
        except Exception as e:
            logger.error(f"Error reading logs: {e}")
            return {
                "logs": [],
                "total": 0,
                "error": str(e),
                "file_path": str(self.log_file),
                "exists": self.log_file.exists()
            }
    
    def get_log_file_raw(self, tail_lines: int = 500) -> str:
        """
        Get raw log file content (last N lines).
        
        Args:
            tail_lines: Number of lines from end of file
            
        Returns:
            Raw log content as string
        """
        if not self.log_file.exists():
            return ""
        
        try:
            with open(self.log_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            return ''.join(lines[-tail_lines:])
        except Exception as e:
            logger.error(f"Error reading raw logs: {e}")
            return f"Error reading logs: {e}"
    
    def get_log_stats(self) -> Dict[str, Any]:
        """Get statistics about the log file."""
        stats = {
            "file_path": str(self.log_file),
            "exists": self.log_file.exists(),
            "level_counts": {
                "DEBUG": 0,
                "INFO": 0,
                "WARNING": 0,
                "ERROR": 0,
                "CRITICAL": 0
            },
            "total_lines": 0,
            "file_size": 0,
            "file_size_formatted": "0 B",
            "last_modified": None,
            "backup_count": 0
        }
        
        if not self.log_file.exists():
            return stats
        
        try:
            file_stat = self.log_file.stat()
            stats["file_size"] = file_stat.st_size
            stats["file_size_formatted"] = self._format_size(file_stat.st_size)
            stats["last_modified"] = datetime.fromtimestamp(file_stat.st_mtime, tz=timezone.utc).isoformat()
            
            # Count log backups
            backup_pattern = f"{self.log_file.stem}.*{self.log_file.suffix}"
            stats["backup_count"] = len(list(LOG_DIR.glob(backup_pattern)))
            
            # Count levels (sample last 1000 lines for performance)
            with open(self.log_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            stats["total_lines"] = len(lines)
            
            for line in lines[-1000:]:
                for level in stats["level_counts"]:
                    if f" - {level} - " in line:
                        stats["level_counts"][level] += 1
                        break
            
        except Exception as e:
            logger.error(f"Error getting log stats: {e}")
            stats["error"] = str(e)
        
        return stats
    
    def clear_logs(self) -> Dict[str, Any]:
        """
        Clear the log file (creates backup first).
        
        Returns:
            Status dict with backup info
        """
        if not self.log_file.exists():
            return {"status": "no_file", "message": "Log file does not exist"}
        
        try:
            # Create backup
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = LOG_DIR / f"watchnexus_{timestamp}.log.bak"
            
            import shutil
            shutil.copy2(self.log_file, backup_path)
            
            # Clear the file
            with open(self.log_file, 'w') as f:
                f.write(f"# Log cleared at {datetime.now(timezone.utc).isoformat()}\n")
            
            logger.info(f"Logs cleared. Backup saved to {backup_path}")
            
            return {
                "status": "cleared",
                "backup_path": str(backup_path),
                "message": f"Logs cleared. Backup saved to {backup_path.name}"
            }
            
        except Exception as e:
            logger.error(f"Error clearing logs: {e}")
            return {"status": "error", "message": str(e)}
    
    def get_system_health(self) -> Dict[str, Any]:
        """
        Get system health metrics.
        
        Returns:
            Dict with CPU, memory, disk info
        """
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count()
            
            # Memory
            memory = psutil.virtual_memory()
            
            # Disk
            disk = psutil.disk_usage('/')
            
            # Process info
            process = psutil.Process(os.getpid())
            process_memory = process.memory_info()
            
            return {
                "cpu": {
                    "percent": cpu_percent,
                    "count": cpu_count
                },
                "memory": {
                    "total": memory.total,
                    "available": memory.available,
                    "used": memory.used,
                    "percent": memory.percent,
                    "total_formatted": self._format_size(memory.total),
                    "used_formatted": self._format_size(memory.used),
                    "available_formatted": self._format_size(memory.available)
                },
                "disk": {
                    "total": disk.total,
                    "used": disk.used,
                    "free": disk.free,
                    "percent": disk.percent,
                    "total_formatted": self._format_size(disk.total),
                    "used_formatted": self._format_size(disk.used),
                    "free_formatted": self._format_size(disk.free)
                },
                "process": {
                    "pid": process.pid,
                    "memory_rss": process_memory.rss,
                    "memory_rss_formatted": self._format_size(process_memory.rss),
                    "memory_vms": process_memory.vms,
                    "memory_vms_formatted": self._format_size(process_memory.vms),
                    "cpu_percent": process.cpu_percent()
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting system health: {e}")
            return {"error": str(e)}
    
    def _format_size(self, bytes_size: int) -> str:
        """Format bytes to human readable string."""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_size < 1024.0:
                return f"{bytes_size:.1f} {unit}"
            bytes_size /= 1024.0
        return f"{bytes_size:.1f} PB"


# Singleton instance
_zest_viewer: Optional[ZestLogViewer] = None


def get_zest_viewer() -> ZestLogViewer:
    """Get or create the Zest log viewer instance."""
    global _zest_viewer
    if _zest_viewer is None:
        _zest_viewer = ZestLogViewer()
    return _zest_viewer
