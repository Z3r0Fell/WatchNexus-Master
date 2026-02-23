"""
WatchNexus Common Database
Shared database connection utilities.
"""

from typing import Optional, Any
from .config import get_config


# Database singleton
_database: Optional[Any] = None


async def get_database():
    """Get the database instance."""
    global _database
    if _database is None:
        # Import here to avoid circular imports
        from database import Database
        config = get_config()
        _database = Database(config.database.url, config.database.name)
        await _database.connect()
    return _database


async def close_database():
    """Close the database connection."""
    global _database
    if _database:
        await _database.close()
        _database = None
