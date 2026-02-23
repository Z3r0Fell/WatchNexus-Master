"""
WatchNexus Common Configuration
Centralized configuration management for all WatchNexus modules.
"""

import os
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from pathlib import Path


@dataclass
class ServerConfig:
    """Server configuration."""
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = False
    workers: int = 1


@dataclass
class DatabaseConfig:
    """Database configuration."""
    url: str = field(default_factory=lambda: os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    name: str = field(default_factory=lambda: os.environ.get("DB_NAME", "watchnexus"))


@dataclass
class AuthConfig:
    """Authentication configuration."""
    jwt_secret: str = field(default_factory=lambda: os.environ.get("JWT_SECRET", "change-me-in-production"))
    jwt_algorithm: str = "HS256"
    token_expiry_hours: int = 24


@dataclass
class TMDBConfig:
    """TMDB API configuration."""
    api_key: str = field(default_factory=lambda: os.environ.get("TMDB_API_KEY", ""))
    base_url: str = "https://api.themoviedb.org/3"
    image_base_url: str = "https://image.tmdb.org/t/p"


@dataclass
class PathConfig:
    """Path configuration."""
    data_dir: Path = field(default_factory=lambda: Path(os.environ.get("DATA_DIR", "/app/backend/data")))
    logs_dir: Path = field(default_factory=lambda: Path(os.environ.get("LOGS_DIR", "/app/backend/logs")))
    plugins_dir: Path = field(default_factory=lambda: Path(os.environ.get("PLUGINS_DIR", "/app/backend/plugins")))
    cache_dir: Path = field(default_factory=lambda: Path(os.environ.get("CACHE_DIR", "/app/backend/cache")))


@dataclass  
class Config:
    """Main configuration container."""
    server: ServerConfig = field(default_factory=ServerConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    auth: AuthConfig = field(default_factory=AuthConfig)
    tmdb: TMDBConfig = field(default_factory=TMDBConfig)
    paths: PathConfig = field(default_factory=PathConfig)
    
    version: str = "2.3.0"
    app_name: str = "WatchNexus"


# Singleton config instance
_config: Optional[Config] = None


def get_config() -> Config:
    """Get or create the global configuration instance."""
    global _config
    if _config is None:
        _config = Config()
    return _config


def reload_config() -> Config:
    """Force reload of configuration."""
    global _config
    _config = Config()
    return _config
