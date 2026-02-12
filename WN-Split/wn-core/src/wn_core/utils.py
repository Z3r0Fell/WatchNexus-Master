"""Common utility functions"""
import re
from typing import Union

def format_size(size_bytes: Union[int, float]) -> str:
    """Format bytes to human readable string"""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.2f} PB"

def format_duration(seconds: int) -> str:
    """Format seconds to HH:MM:SS"""
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"

def sanitize_filename(filename: str) -> str:
    """Remove invalid characters from filename"""
    return re.sub(r'[<>:"/\\|?*]', "", filename)
