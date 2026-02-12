"""Configuration management for WatchNexus"""
import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class Config:
    """Application configuration"""
    mongo_url: str = "mongodb://localhost:27017"
    db_name: str = "watchnexus"
    jwt_secret: str = "change-me-in-production"
    tmdb_api_key: Optional[str] = None
    
    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            mongo_url=os.environ.get("MONGO_URL", cls.mongo_url),
            db_name=os.environ.get("DB_NAME", cls.db_name),
            jwt_secret=os.environ.get("JWT_SECRET", cls.jwt_secret),
            tmdb_api_key=os.environ.get("TMDB_API_KEY"),
        )

def load_config() -> Config:
    """Load configuration from environment"""
    return Config.from_env()
