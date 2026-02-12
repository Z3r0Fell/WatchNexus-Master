"""Authentication utilities"""
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
from functools import wraps

def create_token(user_id: str, secret: str, expires_hours: int = 24) -> str:
    """Create a JWT token"""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=expires_hours),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, secret, algorithm="HS256")

def verify_token(token: str, secret: str) -> Optional[Dict]:
    """Verify and decode a JWT token"""
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None

def require_auth(func):
    """Decorator to require authentication"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Implementation depends on framework
        return await func(*args, **kwargs)
    return wrapper
