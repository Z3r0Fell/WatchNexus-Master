"""
WatchNexus Core - Shared utilities and base components
"""

from .config import Config, load_config
from .database import get_database, DatabaseManager
from .auth import create_token, verify_token, require_auth
from .utils import format_size, format_duration, sanitize_filename

__version__ = "1.0.0"
__all__ = [
    "Config", "load_config",
    "get_database", "DatabaseManager", 
    "create_token", "verify_token", "require_auth",
    "format_size", "format_duration", "sanitize_filename"
]
