"""
WatchNexus Common Authentication
Shared authentication utilities for all WatchNexus modules.
"""

import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from .config import get_config


def create_token(
    user_id: str,
    email: str,
    username: str,
    is_admin: bool = False,
    expiry_hours: Optional[int] = None
) -> str:
    """
    Create a JWT access token.
    
    Args:
        user_id: User's unique ID
        email: User's email
        username: User's username
        is_admin: Whether user is admin
        expiry_hours: Token expiry in hours (default from config)
        
    Returns:
        JWT token string
    """
    config = get_config()
    expiry = expiry_hours or config.auth.token_expiry_hours
    
    payload = {
        "sub": user_id,
        "email": email,
        "username": username,
        "is_admin": is_admin,
        "exp": datetime.now(timezone.utc) + timedelta(hours=expiry),
        "iat": datetime.now(timezone.utc),
        "iss": config.app_name
    }
    
    return jwt.encode(
        payload,
        config.auth.jwt_secret,
        algorithm=config.auth.jwt_algorithm
    )


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode a JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded payload dict or None if invalid
    """
    config = get_config()
    
    try:
        payload = jwt.decode(
            token,
            config.auth.jwt_secret,
            algorithms=[config.auth.jwt_algorithm]
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def extract_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Extract user info from token.
    
    Args:
        token: JWT token string
        
    Returns:
        User dict with id, email, username, is_admin or None
    """
    payload = verify_token(token)
    if not payload:
        return None
    
    return {
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "username": payload.get("username"),
        "is_admin": payload.get("is_admin", False)
    }
