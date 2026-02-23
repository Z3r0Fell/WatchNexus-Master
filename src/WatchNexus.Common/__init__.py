# WatchNexus.Common - Shared Utilities
# This module contains common utilities, types, and helpers used across WatchNexus

"""
WatchNexus Common Module
Shared utilities, configuration, and types for the WatchNexus media pipeline.
"""

__version__ = "2.3.0"
__author__ = "WatchNexus Team"

# Re-export commonly used items
from .config import get_config, Config
from .logging import get_logger, setup_logging
from .auth import verify_token, create_token
from .database import get_database
