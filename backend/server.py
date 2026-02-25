from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, BackgroundTasks, Body
from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import re
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import httpx
import json
import time
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ==================== LOGGING SETUP ====================
LOG_DIR = ROOT_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "watchnexus.log"

# Create file handler with rotation (10MB max, keep 7 backups)
file_handler = RotatingFileHandler(
    LOG_FILE,
    maxBytes=10*1024*1024,  # 10MB
    backupCount=7,
    encoding='utf-8'
)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),  # Console output
        file_handler               # File output
    ]
)
logger = logging.getLogger("server")
logger.info(f"Logging initialized. Log file: {LOG_FILE}")

# Database - SQLite (self-contained, no external dependencies)
from database import init_database, SQLiteDB
db: SQLiteDB = None  # Will be initialized on startup

# Configuration
TMDB_API_KEY = os.environ.get('TMDB_API_KEY')
JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret_change_me')
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/"
GOOGLE_OAUTH_CLIENT_ID = "392737972706-krhv8egv3jj8qrpd1ppri6712a16huno.apps.googleusercontent.com"
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# Create the main app
app = FastAPI(title="WatchNexus API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: str
    password: str
    username: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    username: str
    avatar: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class MediaItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tmdb_id: Optional[int] = None
    media_type: str  # movie, tv, music, audiobook, live_tv
    title: str
    overview: Optional[str] = None
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    release_date: Optional[str] = None
    vote_average: Optional[float] = None
    genres: List[str] = []
    local_path: Optional[str] = None
    file_size: Optional[int] = None
    quality: Optional[str] = None
    added_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class WatchlistItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tmdb_id: int
    media_type: str
    title: str
    poster_path: Optional[str] = None
    added_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class WatchProgress(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None  # Set by server from authenticated user
    tmdb_id: int
    media_type: str
    title: str
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    progress: float  # 0-100
    current_time: int  # seconds
    duration: int  # seconds
    season: Optional[int] = None
    episode: Optional[int] = None
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DownloadItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tmdb_id: Optional[int] = None
    title: str
    media_type: str
    status: str = "queued"  # queued, downloading, seeding, completed, paused, error
    progress: float = 0
    size: int = 0
    downloaded: int = 0
    speed: int = 0
    eta: Optional[str] = None
    source: Optional[str] = None
    added_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class IndexerConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # torrent, usenet
    url: str
    api_key: Optional[str] = None
    enabled: bool = True

class StreamingService(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    icon: str
    color: str
    enabled: bool = False
    username: Optional[str] = None
    deep_link_base: str

class AppSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    download_path: str = "/media/downloads"
    library_path: str = "/media/library"
    auto_subtitles: bool = True
    subtitle_languages: List[str] = ["en"]
    quality_preference: str = "1080p"
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None

class QualityDefinition(BaseModel):
    """Definition of a quality tier with ranking."""
    model_config = ConfigDict(extra="ignore")
    name: str  # e.g., "Bluray-1080p", "WEB-720p"
    resolution: str  # "2160p", "1080p", "720p", "480p"
    source: str  # "Bluray", "WEB", "HDTV", "DVD", "CAM"
    rank: int  # Higher = better quality
    min_size: Optional[int] = None  # Min size in MB (optional)
    max_size: Optional[int] = None  # Max size in MB (optional)
    enabled: bool = True

class QualityProfile(BaseModel):
    """Quality profile like Sonarr/Radarr."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    name: str
    upgrade_allowed: bool = True
    cutoff: str  # Quality name at which to stop upgrading
    qualities: List[QualityDefinition] = []
    is_default: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ScheduledScan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None  # Set by server
    directory: str
    schedule_type: str = "daily"  # daily, weekly, monthly
    schedule_time: str = "03:00"  # HH:MM format
    enabled: bool = True
    last_scan: Optional[str] = None
    next_scan: Optional[str] = None
    notify_on_issues: bool = True
    auto_repair: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ScanNotification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    scan_id: str
    directory: str
    total_files: int
    healthy_files: int
    warning_files: int
    error_files: int
    issues: List[Dict] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    read: bool = False

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_user_from_session_token(session_token: str) -> Optional[dict]:
    """Get user from session token (Google OAuth)"""
    if not session_token:
        return None
    try:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if not session:
            return None
        
        # Check expiry with timezone awareness
        expires_at = session.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return None
        
        user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0, "password": 0})
        return user
    except Exception as e:
        logger.error(f"Session token validation error: {e}")
        return None

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[dict]:
    """Get current user from JWT token or session cookie"""
    # First, try session token from cookie
    session_token = request.cookies.get("session_token")
    if session_token:
        user = await get_user_from_session_token(session_token)
        if user:
            return user
    
    # Fall back to JWT token from Authorization header
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
            user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
            return user
        except Exception:
            pass
    
    return None

async def require_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    user = await get_current_user(request, credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ==================== TMDB HELPERS ====================

tmdb_cache = {}
CACHE_TTL = 3600  # 1 hour

async def tmdb_request(endpoint: str, params: dict = None) -> Optional[dict]:
    cache_key = f"{endpoint}_{json.dumps(params or {}, sort_keys=True)}"
    cached = tmdb_cache.get(cache_key)
    if cached and time.time() - cached["ts"] < CACHE_TTL:
        return cached["data"]
    
    params = params or {}
    params["api_key"] = TMDB_API_KEY
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{TMDB_BASE_URL}{endpoint}", params=params, timeout=10)
            if response.status_code == 429:
                await asyncio.sleep(2)
                response = await client.get(f"{TMDB_BASE_URL}{endpoint}", params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            tmdb_cache[cache_key] = {"data": data, "ts": time.time()}
            return data
    except Exception as e:
        logger.error(f"TMDB request failed: {e}")
        return None

def get_image_url(path: str, size: str = "w500") -> Optional[str]:
    return f"{TMDB_IMAGE_BASE}{size}{path}" if path else None

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "username": data.username,
        "password": hash_password(data.password),
        "avatar": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id)
    user_response = UserResponse(
        id=user_id,
        email=data.email,
        username=data.username,
        avatar=None,
        created_at=user_doc["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    logger.info(f"Login attempt for email: {data.email}")
    user = await db.users.find_one({"email": data.email})
    if not user:
        logger.warning(f"User not found: {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials - user not found")
    if not verify_password(data.password, user["password"]):
        logger.warning(f"Invalid password for: {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials - wrong password")
    
    token = create_token(user["id"])
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        username=user["username"],
        avatar=user.get("avatar"),
        created_at=user["created_at"]
    )
    logger.info(f"Login successful for: {data.email}")
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/clear-users")
async def clear_users(current_user: dict = Depends(require_auth)):
    """Development endpoint to clear all users - requires admin authentication"""
    # Only allow admin users
    user_doc = await db.users.find_one({"id": current_user["id"]})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.delete_many({})
    return {"deleted": result.deleted_count, "message": "All users cleared"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(require_auth)):
    return UserResponse(**user)

# ==================== GOOGLE OAUTH ROUTES ====================
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

@api_router.post("/auth/google/session")
async def google_oauth_session(session_id: str):
    """Exchange session_id from Google OAuth for a session token"""
    try:
        # Call Emergent Auth API to get user data
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                EMERGENT_AUTH_URL,
                headers={"X-Session-ID": session_id},
                timeout=10
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session ID")
            
            oauth_data = response.json()
            
            # Extract user info
            email = oauth_data.get("email")
            name = oauth_data.get("name", "")
            picture = oauth_data.get("picture")
            session_token = oauth_data.get("session_token")
            
            if not email or not session_token:
                raise HTTPException(status_code=400, detail="Invalid OAuth response")
            
            # Check if user exists, create if not
            existing_user = await db.users.find_one({"email": email}, {"_id": 0})
            
            if existing_user:
                user_id = existing_user["id"]
                # Update user info if needed
                await db.users.update_one(
                    {"email": email},
                    {"$set": {
                        "avatar": picture,
                        "username": existing_user.get("username") or name.split()[0] if name else email.split("@")[0]
                    }}
                )
            else:
                # Create new user
                user_id = str(uuid.uuid4())
                user_doc = {
                    "id": user_id,
                    "email": email,
                    "username": name.split()[0] if name else email.split("@")[0],
                    "password": None,  # OAuth users don't have passwords
                    "avatar": picture,
                    "auth_type": "google",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(user_doc)
            
            # Store session
            session_doc = {
                "user_id": user_id,
                "session_token": session_token,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc)
            }
            await db.user_sessions.update_one(
                {"user_id": user_id},
                {"$set": session_doc},
                upsert=True
            )
            
            # Get full user data
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
            
            # Create response with session cookie
            response = JSONResponse(content={
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "username": user["username"],
                    "avatar": user.get("avatar"),
                    "created_at": user["created_at"]
                },
                "session_token": session_token
            })
            
            # Set httpOnly cookie
            response.set_cookie(
                key="session_token",
                value=session_token,
                httponly=True,
                secure=True,
                samesite="none",
                max_age=7 * 24 * 60 * 60,  # 7 days
                path="/"
            )
            
            return response
            
    except httpx.RequestError as e:
        logger.error(f"Google OAuth error: {e}")
        raise HTTPException(status_code=500, detail="OAuth service unavailable")

@api_router.post("/auth/logout")
async def logout(request: Request):
    """Logout user by clearing session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response = JSONResponse(content={"status": "logged out"})
    response.delete_cookie(key="session_token", path="/")
    return response

# ==================== TMDB ROUTES ====================

@api_router.get("/tmdb/search")
async def search_media(query: str, page: int = 1, media_type: str = "multi"):
    if media_type == "multi":
        data = await tmdb_request("/search/multi", {"query": query, "page": page})
    else:
        data = await tmdb_request(f"/search/{media_type}", {"query": query, "page": page})
    
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch from TMDB")
    
    # Enhance results with full image URLs
    for item in data.get("results", []):
        item["poster_url"] = get_image_url(item.get("poster_path"), "w342")
        item["backdrop_url"] = get_image_url(item.get("backdrop_path"), "w780")
    
    return data

@api_router.get("/tmdb/trending/{media_type}/{time_window}")
async def get_trending(media_type: str = "all", time_window: str = "week"):
    data = await tmdb_request(f"/trending/{media_type}/{time_window}")
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch trending")
    
    for item in data.get("results", []):
        item["poster_url"] = get_image_url(item.get("poster_path"), "w342")
        item["backdrop_url"] = get_image_url(item.get("backdrop_path"), "w1280")
    
    return data

# IMPORTANT: Static routes must be defined BEFORE parameterized routes
@api_router.get("/tmdb/movie/now_playing")
async def get_now_playing(page: int = 1):
    data = await tmdb_request("/movie/now_playing", {"page": page})
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch")
    for item in data.get("results", []):
        item["poster_url"] = get_image_url(item.get("poster_path"), "w342")
        item["backdrop_url"] = get_image_url(item.get("backdrop_path"), "w1280")
    return data

@api_router.get("/tmdb/tv/on_the_air")
async def get_on_the_air(page: int = 1):
    data = await tmdb_request("/tv/on_the_air", {"page": page})
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch")
    for item in data.get("results", []):
        item["poster_url"] = get_image_url(item.get("poster_path"), "w342")
        item["backdrop_url"] = get_image_url(item.get("backdrop_path"), "w1280")
    return data

@api_router.get("/tmdb/genres/{media_type}")
async def get_genres(media_type: str):
    data = await tmdb_request(f"/genre/{media_type}/list")
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch genres")
    return data

@api_router.get("/tmdb/movie/{movie_id}")
async def get_movie_details(movie_id: int):
    data = await tmdb_request(f"/movie/{movie_id}", {
        "append_to_response": "credits,videos,images,similar,recommendations"
    })
    if not data:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    data["poster_url"] = get_image_url(data.get("poster_path"), "w500")
    data["backdrop_url"] = get_image_url(data.get("backdrop_path"), "w1280")
    
    # Get trailer
    videos = data.get("videos", {}).get("results", [])
    trailer = next((v for v in videos if v.get("type") == "Trailer" and v.get("site") == "YouTube"), None)
    data["trailer_key"] = trailer.get("key") if trailer else None
    
    return data

@api_router.get("/tmdb/tv/{tv_id}")
async def get_tv_details(tv_id: int):
    data = await tmdb_request(f"/tv/{tv_id}", {
        "append_to_response": "credits,videos,images,similar,content_ratings"
    })
    if not data:
        raise HTTPException(status_code=404, detail="TV show not found")
    
    data["poster_url"] = get_image_url(data.get("poster_path"), "w500")
    data["backdrop_url"] = get_image_url(data.get("backdrop_path"), "w1280")
    
    videos = data.get("videos", {}).get("results", [])
    trailer = next((v for v in videos if v.get("type") == "Trailer" and v.get("site") == "YouTube"), None)
    data["trailer_key"] = trailer.get("key") if trailer else None
    
    return data

@api_router.get("/tmdb/tv/{tv_id}/season/{season_num}")
async def get_tv_season(tv_id: int, season_num: int):
    data = await tmdb_request(f"/tv/{tv_id}/season/{season_num}")
    if not data:
        raise HTTPException(status_code=404, detail="Season not found")
    
    for ep in data.get("episodes", []):
        ep["still_url"] = get_image_url(ep.get("still_path"), "w300")
    
    return data

@api_router.get("/tmdb/discover/{media_type}")
async def discover_media(
    media_type: str, 
    page: int = 1, 
    genre: int = None, 
    sort_by: str = "popularity.desc",
    with_genres: str = None,
    with_original_language: str = None,
    with_keywords: str = None,
    year: int = None,
    first_air_date_year: int = None,
):
    """Discover movies or TV shows with various filters."""
    params = {"page": page, "sort_by": sort_by}
    
    # Handle genre parameter (backward compatibility)
    if genre:
        params["with_genres"] = genre
    if with_genres:
        params["with_genres"] = with_genres
    if with_original_language:
        params["with_original_language"] = with_original_language
    if with_keywords:
        params["with_keywords"] = with_keywords
    if year and media_type == "movie":
        params["year"] = year
    if first_air_date_year and media_type == "tv":
        params["first_air_date_year"] = first_air_date_year
    
    data = await tmdb_request(f"/discover/{media_type}", params)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to discover media")
    
    for item in data.get("results", []):
        item["poster_url"] = get_image_url(item.get("poster_path"), "w342")
        item["backdrop_url"] = get_image_url(item.get("backdrop_path"), "w780")
    
    return data

# ==================== WATCHLIST & PROGRESS ====================

@api_router.post("/watchlist")
async def add_to_watchlist(item: WatchlistItem, user: dict = Depends(require_auth)):
    item.user_id = user["id"]
    existing = await db.watchlist.find_one({"user_id": user["id"], "tmdb_id": item.tmdb_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already in watchlist")
    await db.watchlist.insert_one(item.model_dump())
    return item

@api_router.get("/watchlist", response_model=List[WatchlistItem])
async def get_watchlist(user: dict = Depends(require_auth)):
    items = await db.watchlist.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return items

@api_router.delete("/watchlist/{tmdb_id}")
async def remove_from_watchlist(tmdb_id: int, user: dict = Depends(require_auth)):
    result = await db.watchlist.delete_one({"user_id": user["id"], "tmdb_id": tmdb_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found in watchlist")
    return {"status": "removed"}

@api_router.post("/watch-progress")
async def update_watch_progress(progress: WatchProgress, user: dict = Depends(require_auth)):
    progress.user_id = user["id"]
    progress.updated_at = datetime.now(timezone.utc).isoformat()
    await db.watch_progress.update_one(
        {"user_id": user["id"], "tmdb_id": progress.tmdb_id},
        {"$set": progress.model_dump()},
        upsert=True
    )
    return progress

@api_router.get("/watch-progress", response_model=List[WatchProgress])
async def get_watch_progress(user: dict = Depends(require_auth)):
    items = await db.watch_progress.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(20)
    return items

@api_router.get("/next-up")
async def get_next_up(user: dict = Depends(require_auth)):
    """
    Get 'Next Up' list - next episodes for TV shows the user is watching.
    Returns episodes that haven't been started yet for shows with watch progress.
    """
    # Get user's TV watch progress items
    tv_progress = await db.watch_progress.find(
        {"user_id": user["id"], "media_type": "tv"},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(50)
    
    next_up = []
    seen_shows = set()
    
    for item in tv_progress:
        # Skip if we already have next-up for this show
        if item["tmdb_id"] in seen_shows:
            continue
        
        # Calculate next episode
        current_season = item.get("season", 1)
        current_episode = item.get("episode", 1)
        progress = item.get("progress", 0)
        
        # If current episode is mostly watched (>85%), suggest next episode
        if progress >= 85:
            next_episode = current_episode + 1
            next_season = current_season
        else:
            # Continue current episode
            next_up.append({
                "tmdb_id": item["tmdb_id"],
                "title": item["title"],
                "poster_path": item.get("poster_path"),
                "backdrop_path": item.get("backdrop_path"),
                "season": current_season,
                "episode": current_episode,
                "progress": progress,
                "current_time": item.get("current_time", 0),
                "duration": item.get("duration", 0),
                "is_continue": True,
                "updated_at": item.get("updated_at")
            })
            seen_shows.add(item["tmdb_id"])
            continue
        
        # Add next episode suggestion
        next_up.append({
            "tmdb_id": item["tmdb_id"],
            "title": item["title"],
            "poster_path": item.get("poster_path"),
            "backdrop_path": item.get("backdrop_path"),
            "season": next_season,
            "episode": next_episode,
            "progress": 0,
            "current_time": 0,
            "duration": item.get("duration", 0),
            "is_continue": False,
            "updated_at": item.get("updated_at")
        })
        seen_shows.add(item["tmdb_id"])
    
    return next_up[:10]  # Limit to 10 items

@api_router.delete("/watch-progress")
async def delete_watch_progress(
    tmdb_id: int,
    media_type: str,
    season: int = None,
    episode: int = None,
    user: dict = Depends(require_auth)
):
    """Delete a specific watch progress entry."""
    query = {"user_id": user["id"], "tmdb_id": tmdb_id, "media_type": media_type}
    if season is not None:
        query["season"] = season
    if episode is not None:
        query["episode"] = episode
    
    result = await db.watch_progress.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Watch progress not found")
    return {"message": "Watch progress deleted", "deleted_count": result.deleted_count}

@api_router.delete("/watch-progress/all")
async def clear_all_watch_progress(user: dict = Depends(require_auth)):
    """Clear all watch progress for the current user."""
    result = await db.watch_progress.delete_many({"user_id": user["id"]})
    return {"message": "All watch history cleared", "deleted_count": result.deleted_count}

# ==================== DOWNLOADS (MOCK) ====================

mock_downloads = []

@api_router.get("/downloads", response_model=List[DownloadItem])
async def get_downloads():
    return mock_downloads

@api_router.post("/downloads")
async def add_download(title: str, media_type: str, tmdb_id: int = None, size: int = 0, user: dict = Depends(require_auth)):
    download = DownloadItem(
        title=title,
        media_type=media_type,
        tmdb_id=tmdb_id,
        size=size or 1500000000,  # 1.5GB default
        status="queued"
    )
    mock_downloads.append(download)
    return download

@api_router.patch("/downloads/{download_id}")
async def update_download(download_id: str, status: str = None, progress: float = None, user: dict = Depends(require_auth)):
    for dl in mock_downloads:
        if dl.id == download_id:
            if status:
                dl.status = status
            if progress is not None:
                dl.progress = progress
                dl.downloaded = int(dl.size * progress / 100)
            return dl
    raise HTTPException(status_code=404, detail="Download not found")

@api_router.delete("/downloads/{download_id}")
async def delete_download(download_id: str, user: dict = Depends(require_auth)):
    global mock_downloads
    mock_downloads = [d for d in mock_downloads if d.id != download_id]
    return {"status": "deleted"}

# ==================== SETTINGS ====================

@api_router.get("/settings")
async def get_settings(user: dict = Depends(require_auth)):
    settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not settings:
        settings = AppSettings().model_dump()
        settings["user_id"] = user["id"]
    return settings

@api_router.put("/settings")
async def update_settings(settings: AppSettings, user: dict = Depends(require_auth)):
    settings_dict = settings.model_dump()
    settings_dict["user_id"] = user["id"]
    await db.settings.update_one(
        {"user_id": user["id"]},
        {"$set": settings_dict},
        upsert=True
    )
    return settings_dict

# ==================== PLAYBACK SETTINGS ====================

class PlaybackSettings(BaseModel):
    auto_skip_intro: bool = False
    auto_skip_credits: bool = False
    skip_button_duration: int = 5
    intro_detection_enabled: bool = True
    credits_detection_enabled: bool = True
    default_intro_start: int = 0
    default_intro_end: int = 90
    default_credits_offset: int = 90
    auto_play_next: bool = True
    next_episode_countdown: int = 15

@api_router.get("/settings/playback")
async def get_playback_settings(user: dict = Depends(require_auth)):
    """Get playback settings for the user."""
    settings = await db.playback_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not settings:
        settings = PlaybackSettings().model_dump()
    return settings

@api_router.put("/settings/playback")
async def update_playback_settings(settings: PlaybackSettings, user: dict = Depends(require_auth)):
    """Update playback settings for the user."""
    settings_dict = settings.model_dump()
    settings_dict["user_id"] = user["id"]
    await db.playback_settings.update_one(
        {"user_id": user["id"]},
        {"$set": settings_dict},
        upsert=True
    )
    return settings_dict

@api_router.get("/system/chromaprint-status")
async def get_chromaprint_status(user: dict = Depends(require_auth)):
    """Check if Chromaprint (fpcalc) is installed."""
    import shutil
    fpcalc_path = shutil.which("fpcalc")
    return {
        "installed": fpcalc_path is not None,
        "path": fpcalc_path
    }

@api_router.post("/marmalade/analyze-all-intros")
async def analyze_all_intros(user: dict = Depends(require_auth)):
    """Queue all TV series for intro analysis."""
    # Get all unique series from the media table
    try:
        # Use a query to get distinct series names
        all_media = await db.media.find({"type": "tv"}).to_list(1000)
        series_names = set(m.get("series_name") for m in all_media if m.get("series_name"))
        queued = len(series_names)
    except Exception as e:
        logger.error(f"Failed to query media for intro analysis: {e}")
        queued = 0
            
    return {
        "status": "queued",
        "queued": queued,
        "message": f"Queued {queued} series for intro analysis"
    }

# ==================== USER MANAGEMENT ====================

class UserPermissions(BaseModel):
    can_download: bool = True
    can_delete: bool = False
    can_manage_library: bool = False
    can_manage_users: bool = False
    can_access_settings: bool = False
    max_streams: int = 3
    allowed_libraries: List[str] = []

class UserCreate2(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"
    permissions: Optional[UserPermissions] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[UserPermissions] = None

@api_router.get("/users/profiles")
async def get_user_profiles(request: Request):
    """
    Get user profiles for local network login.
    Only returns basic profile info (no passwords, limited data).
    Only accessible from local/private networks.
    """
    # Check if request is from local network
    client_ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    ip = forwarded if forwarded else client_ip
    
    # Check if local network (allow in development/preview)
    (
        ip.startswith("10.") or
        ip.startswith("192.168.") or
        ip.startswith("172.16.") or ip.startswith("172.17.") or ip.startswith("172.18.") or
        ip.startswith("172.19.") or ip.startswith("172.20.") or ip.startswith("172.21.") or
        ip.startswith("172.22.") or ip.startswith("172.23.") or ip.startswith("172.24.") or
        ip.startswith("172.25.") or ip.startswith("172.26.") or ip.startswith("172.27.") or
        ip.startswith("172.28.") or ip.startswith("172.29.") or ip.startswith("172.30.") or
        ip.startswith("172.31.") or
        ip == "127.0.0.1" or
        ip == "localhost" or
        ip == "::1" or
        ip == "unknown"  # Allow in containerized environments
    )
    
    # For security, we could restrict this to local only
    # For now, we allow it but return minimal data
    
    users_cursor = db.users.find({})
    users_raw = await users_cursor.to_list(20)
    
    # Manually filter to only include safe fields
    users = []
    for u in users_raw:
        users.append({
            "id": u.get("id"),
            "username": u.get("username", ""),
            "email": u.get("email", ""),
            "avatar": u.get("avatar"),
            "avatar_color": u.get("avatar_color"),
        })
    
    return users

def is_local_network_request(request: Request) -> bool:
    """Check if request comes from local/private network."""
    client_ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    ip = forwarded if forwarded else client_ip
    
    # Check for local/private IP ranges
    return (
        ip.startswith("10.") or
        ip.startswith("192.168.") or
        ip.startswith("172.16.") or ip.startswith("172.17.") or ip.startswith("172.18.") or
        ip.startswith("172.19.") or ip.startswith("172.20.") or ip.startswith("172.21.") or
        ip.startswith("172.22.") or ip.startswith("172.23.") or ip.startswith("172.24.") or
        ip.startswith("172.25.") or ip.startswith("172.26.") or ip.startswith("172.27.") or
        ip.startswith("172.28.") or ip.startswith("172.29.") or ip.startswith("172.30.") or
        ip.startswith("172.31.") or
        ip == "127.0.0.1" or
        ip == "localhost" or
        ip == "::1" or
        ip == "unknown"  # Allow in containerized environments
    )

class QuickLoginRequest(BaseModel):
    user_id: str
    pin: Optional[str] = None  # Optional PIN for extra security

@api_router.post("/users/quick-login")
async def quick_login(request: Request, login_data: QuickLoginRequest):
    """
    Quick login for home network users - no password required.
    Similar to Netflix's 'Who's Watching?' feature.
    Only works from local/private network IPs.
    """
    # Verify request is from local network
    if not is_local_network_request(request):
        raise HTTPException(
            status_code=403, 
            detail="Quick login only available on home network"
        )
    
    # Find user
    user = await db.users.find_one({"id": login_data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check PIN if user has one set
    user_pin = user.get("quick_login_pin")
    if user_pin:
        if not login_data.pin:
            raise HTTPException(status_code=401, detail="PIN required")
        if login_data.pin != user_pin:
            raise HTTPException(status_code=401, detail="Invalid PIN")
    
    # Generate JWT token
    token_data = {
        "sub": user["id"],
        "email": user["email"],
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
        "type": "quick_login"
    }
    token = jwt.encode(token_data, JWT_SECRET, algorithm="HS256")
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Return user data without sensitive info
    user_response = {
        "id": user["id"],
        "email": user["email"],
        "username": user.get("username", ""),
        "role": user.get("role", "user"),
        "permissions": user.get("permissions", UserPermissions().model_dump()),
        "avatar": user.get("avatar"),
        "avatar_color": user.get("avatar_color")
    }
    
    return {
        "token": token,
        "user": user_response
    }

@api_router.post("/users/{user_id}/set-pin")
async def set_quick_login_pin(user_id: str, pin_data: dict, current_user: dict = Depends(require_auth)):
    """Set or remove quick login PIN for a user."""
    # User can only set their own PIN (or admin can set any)
    if current_user["id"] != user_id:
        user_doc = await db.users.find_one({"id": current_user["id"]})
        if not user_doc or user_doc.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Can only modify your own PIN")
    
    pin = pin_data.get("pin")
    
    if pin:
        # Validate PIN (4-6 digits)
        if not pin.isdigit() or len(pin) < 4 or len(pin) > 6:
            raise HTTPException(status_code=400, detail="PIN must be 4-6 digits")
        await db.users.update_one({"id": user_id}, {"$set": {"quick_login_pin": pin}})
    else:
        # Remove PIN
        await db.users.update_one({"id": user_id}, {"$unset": {"quick_login_pin": ""}})
    
    return {"message": "PIN updated successfully"}

@api_router.get("/users/{user_id}/has-pin")
async def check_user_has_pin(user_id: str, request: Request):
    """Check if a user has a quick login PIN set (for UI to show PIN input)."""
    # Only allow from local network
    if not is_local_network_request(request):
        raise HTTPException(status_code=403, detail="Only available on home network")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"has_pin": bool(user.get("quick_login_pin"))}

@api_router.get("/users")
async def get_all_users(user: dict = Depends(require_auth)):
    """Get all users (admin only)"""
    # Check if current user is admin
    current_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    if not current_user or current_user.get("role") != "admin":
        # For now, allow all authenticated users to see user list
        pass
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    
    # Add default permissions if not present
    for u in users:
        if "permissions" not in u:
            u["permissions"] = UserPermissions().model_dump()
        if "role" not in u:
            u["role"] = "admin" if u.get("email") == "admin@watchnexus.local" else "user"
    
    return users

@api_router.post("/users")
async def create_user(user_data: UserCreate2, current_user: dict = Depends(require_auth)):
    """Create a new user (admin only)"""
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username already exists
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Hash password
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create user
    new_user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email.lower(),
        "username": user_data.username,
        "password": hashed_password,
        "role": user_data.role,
        "permissions": (user_data.permissions or UserPermissions()).model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": None
    }
    
    await db.users.insert_one(new_user)
    
    # Return without password
    del new_user["password"]
    if "_id" in new_user:
        del new_user["_id"]
    return new_user

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(require_auth)):
    """Update a user"""
    update_dict = {}
    
    if user_data.username:
        update_dict["username"] = user_data.username
    if user_data.email:
        update_dict["email"] = user_data.email.lower()
    if user_data.password:
        update_dict["password"] = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    if user_data.role:
        update_dict["role"] = user_data.role
    if user_data.permissions:
        update_dict["permissions"] = user_data.permissions.model_dump()
    
    if update_dict:
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_auth)):
    """Delete a user and all their associated data"""
    # Prevent deleting self
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Check if user exists first
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete all user-related data first (to avoid foreign key constraints)
    try:
        # Delete from all tables with user_id foreign key
        await db.user_sessions.delete_many({"user_id": user_id})
        await db.watchlist.delete_many({"user_id": user_id})
        await db.watch_progress.delete_many({"user_id": user_id})
        await db.settings.delete_many({"user_id": user_id})
        await db.library.delete_many({"user_id": user_id})
        await db.indexers.delete_many({"user_id": user_id})
        await db.streaming_services.delete_many({"user_id": user_id})
        await db.scheduled_scans.delete_many({"user_id": user_id})
        await db.scan_notifications.delete_many({"user_id": user_id})
        await db.redownload_requests.delete_many({"user_id": user_id})
        await db.compote_indexers.delete_many({"user_id": user_id})
        await db.grab_requests.delete_many({"user_id": user_id})
        await db.subtitle_settings.delete_many({"user_id": user_id})
        await db.streaming_logins.delete_many({"user_id": user_id})
        await db.playlists.delete_many({"user_id": user_id})
        await db.quality_profiles.delete_many({"user_id": user_id})
        await db.iptv_sources.delete_many({"user_id": user_id})
        await db.user_preferences.delete_many({"user_id": user_id})
        
        # Finally delete the user
        result = await db.users.delete_one({"id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")
    
    return {"message": "User deleted"}

# ==================== INDEXERS (MOCK CONFIG) ====================

default_indexers = [
    {"id": "1", "name": "1337x", "type": "torrent", "url": "https://1337x.to", "api_key": None, "enabled": False},
    {"id": "2", "name": "RARBG", "type": "torrent", "url": "https://rarbg.to", "api_key": None, "enabled": False},
    {"id": "3", "name": "YTS", "type": "torrent", "url": "https://yts.mx", "api_key": None, "enabled": False},
    {"id": "4", "name": "EZTV", "type": "torrent", "url": "https://eztv.re", "api_key": None, "enabled": False},
]

@api_router.get("/indexers")
async def get_indexers(user: dict = Depends(require_auth)):
    indexers = await db.indexers.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    if not indexers:
        return default_indexers
    return indexers

@api_router.post("/indexers")
async def add_indexer(indexer: IndexerConfig, user: dict = Depends(require_auth)):
    indexer_dict = indexer.model_dump()
    indexer_dict["user_id"] = user["id"]
    await db.indexers.insert_one(indexer_dict)
    return indexer

@api_router.put("/indexers/{indexer_id}")
async def update_indexer(indexer_id: str, indexer: IndexerConfig, user: dict = Depends(require_auth)):
    indexer_dict = indexer.model_dump()
    indexer_dict["user_id"] = user["id"]
    await db.indexers.update_one(
        {"id": indexer_id, "user_id": user["id"]},
        {"$set": indexer_dict},
        upsert=True
    )
    return indexer_dict

# ==================== STREAMING SERVICES ====================

default_streaming_services = [
    {"id": "netflix", "name": "Netflix", "icon": "netflix", "color": "#E50914", "enabled": False, "deep_link_base": "https://www.netflix.com/search?q="},
    {"id": "disney", "name": "Disney+", "icon": "disney", "color": "#113CCF", "enabled": False, "deep_link_base": "https://www.disneyplus.com/search?q="},
    {"id": "prime", "name": "Prime Video", "icon": "prime", "color": "#00A8E1", "enabled": False, "deep_link_base": "https://www.amazon.com/s?k="},
    {"id": "hulu", "name": "Hulu", "icon": "hulu", "color": "#1CE783", "enabled": False, "deep_link_base": "https://www.hulu.com/search?q="},
    {"id": "hbo", "name": "HBO Max", "icon": "hbo", "color": "#B000FF", "enabled": False, "deep_link_base": "https://play.max.com/search?q="},
    {"id": "apple", "name": "Apple TV+", "icon": "apple", "color": "#000000", "enabled": False, "deep_link_base": "https://tv.apple.com/search?term="},
    {"id": "peacock", "name": "Peacock", "icon": "peacock", "color": "#000000", "enabled": False, "deep_link_base": "https://www.peacocktv.com/search?q="},
    {"id": "paramount", "name": "Paramount+", "icon": "paramount", "color": "#0064FF", "enabled": False, "deep_link_base": "https://www.paramountplus.com/search?q="},
]

@api_router.get("/streaming-services")
async def get_streaming_services(user: dict = Depends(require_auth)):
    services = await db.streaming_services.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    if not services:
        return default_streaming_services
    return services

@api_router.put("/streaming-services/{service_id}")
async def update_streaming_service(service_id: str, enabled: bool, username: str = None, user: dict = Depends(require_auth)):
    await db.streaming_services.update_one(
        {"id": service_id, "user_id": user["id"]},
        {"$set": {"id": service_id, "enabled": enabled, "username": username, "user_id": user["id"]}},
        upsert=True
    )
    return {"id": service_id, "enabled": enabled, "username": username}

# ==================== IPTV SOURCES ====================

@api_router.get("/iptv/sources")
async def get_iptv_sources(user: dict = Depends(require_auth)):
    """Get all IPTV sources for the current user."""
    sources = await db.iptv_sources.find({"user_id": user["id"]}, {"_id": 0})
    return {"sources": sources, "count": len(sources)}

@api_router.post("/iptv/sources")
async def add_iptv_source(name: str, url: str, type: str = "m3u", epg_url: str = None, user: dict = Depends(require_auth)):
    """Add a new IPTV source."""
    source = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": name,
        "url": url,
        "type": type,
        "epg_url": epg_url,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.iptv_sources.insert_one(source)
    del source["user_id"]  # Don't return user_id
    return source

@api_router.delete("/iptv/sources/{source_id}")
async def delete_iptv_source(source_id: str, user: dict = Depends(require_auth)):
    """Delete an IPTV source."""
    result = await db.iptv_sources.delete_one({"id": source_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="IPTV source not found")
    return {"message": "IPTV source deleted"}

# ==================== USER PREFERENCES (Synced Settings) ====================

@api_router.get("/user/preferences")
async def get_user_preferences(user: dict = Depends(require_auth)):
    """Get user preferences (synced across devices)."""
    prefs = await db.user_preferences.find_one({"user_id": user["id"]}, {"_id": 0})
    if not prefs:
        # Return defaults
        return {
            "visible_tabs": [],
            "download_mode": "builtin",
            "theme_mode": "dark"
        }
    return {
        "visible_tabs": json.loads(prefs.get("visible_tabs", "[]")) if isinstance(prefs.get("visible_tabs"), str) else prefs.get("visible_tabs", []),
        "download_mode": prefs.get("download_mode", "builtin"),
        "theme_mode": prefs.get("theme_mode", "dark")
    }

@api_router.put("/user/preferences")
async def update_user_preferences(
    visible_tabs: list = None,
    download_mode: str = None,
    theme_mode: str = None,
    user: dict = Depends(require_auth)
):
    """Update user preferences."""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if visible_tabs is not None:
        update_data["visible_tabs"] = json.dumps(visible_tabs)
    if download_mode is not None:
        update_data["download_mode"] = download_mode
    if theme_mode is not None:
        update_data["theme_mode"] = theme_mode
    
    await db.user_preferences.update_one(
        {"user_id": user["id"]},
        {"$set": {**update_data, "user_id": user["id"]}},
        upsert=True
    )
    return {"message": "Preferences updated"}

# ==================== FILE BROWSER ====================

@api_router.get("/filesystem/browse")
async def browse_filesystem(
    path: str = "",
    user: dict = Depends(require_auth)
):
    """
    Browse the local filesystem to find media folders.
    Returns directories and basic info for folder selection.
    OS-aware: Returns appropriate paths for Windows, Linux, or macOS.
    """
    import os
    import platform
    from pathlib import Path as FilePath
    
    os_type = platform.system().lower()  # 'windows', 'linux', 'darwin'
    
    # Determine default path based on OS
    if not path:
        if os_type == 'windows':
            path = "C:\\"
        elif os_type == 'darwin':
            path = os.path.expanduser("~")
        else:
            path = "/home"
    
    try:
        # Normalize and validate path
        target_path = FilePath(path).resolve()
        
        # Security: Prevent accessing sensitive system directories
        if os_type == 'windows':
            blocked_paths = ['C:\\Windows', 'C:\\Program Files', 'C:\\ProgramData']
        else:
            blocked_paths = ['/proc', '/sys', '/dev', '/boot', '/etc/shadow']
        
        if any(str(target_path).startswith(bp) for bp in blocked_paths):
            raise HTTPException(status_code=403, detail="Access denied to system directory")
        
        if not target_path.exists():
            raise HTTPException(status_code=404, detail="Path not found")
        
        if not target_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        items = []
        
        # Determine if we're at root
        is_root = False
        if os_type == 'windows':
            # Check if at drive root (e.g., C:\)
            is_root = len(str(target_path)) <= 3
        else:
            is_root = str(target_path) == "/"
        
        # Add parent directory option (unless at root)
        if not is_root:
            items.append({
                "name": "..",
                "path": str(target_path.parent),
                "type": "directory",
                "is_parent": True
            })
        
        # List directory contents
        try:
            for entry in sorted(target_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                try:
                    # Skip hidden files and system files
                    if entry.name.startswith('.'):
                        continue
                    
                    item = {
                        "name": entry.name,
                        "path": str(entry),
                        "type": "directory" if entry.is_dir() else "file",
                        "is_parent": False
                    }
                    
                    if entry.is_dir():
                        # Count items in directory (limited check)
                        try:
                            item["item_count"] = len(list(entry.iterdir())[:100])
                        except PermissionError:
                            item["item_count"] = 0
                            item["permission_denied"] = True
                        items.append(item)
                    else:
                        # For files, add size and check if it's a media file
                        try:
                            stat = entry.stat()
                            item["size"] = stat.st_size
                            
                            # Check if it's a media file
                            media_extensions = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', 
                                               '.mp3', '.flac', '.wav', '.aac', '.m4a', '.ogg',
                                               '.jpg', '.jpeg', '.png', '.gif', '.bmp'}
                            if entry.suffix.lower() in media_extensions:
                                item["is_media"] = True
                        except Exception:
                            item["size"] = 0
                        
                        # Only include directories for library selection
                        # but we can show media file counts
                except PermissionError:
                    continue
                except Exception:
                    continue
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied to read directory")
        
        # Get common mount points/drives
        drives = []
        if os.name == 'nt':  # Windows
            import string
            for letter in string.ascii_uppercase:
                drive = f"{letter}:\\"
                if os.path.exists(drive):
                    drives.append({"name": f"{letter}:", "path": drive})
        else:  # Linux/Mac
            common_mounts = ["/", "/home", "/media", "/mnt", "/srv", "/data"]
            for mount in common_mounts:
                if os.path.exists(mount) and os.path.isdir(mount):
                    drives.append({"name": mount, "path": mount})
            
            # Add user home directory
            home = os.path.expanduser("~")
            if home not in common_mounts:
                drives.append({"name": "Home", "path": home})
            
            # Add all user directories from /home (Linux)
            home_dir = FilePath("/home")
            if home_dir.exists() and home_dir.is_dir():
                try:
                    for user_dir in home_dir.iterdir():
                        if user_dir.is_dir() and not user_dir.name.startswith('.'):
                            user_path = str(user_dir)
                            # Don't add if already in drives list
                            if not any(d["path"] == user_path for d in drives):
                                drives.append({"name": f"/home/{user_dir.name}", "path": user_path})
                except PermissionError:
                    pass
        
        # Count media files in current directory
        media_count = 0
        try:
            for entry in target_path.iterdir():
                if entry.is_file():
                    media_extensions = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
                                       '.mp3', '.flac', '.wav', '.aac', '.m4a', '.ogg'}
                    if entry.suffix.lower() in media_extensions:
                        media_count += 1
        except Exception:
            pass
        
        return {
            "current_path": str(target_path),
            "parent_path": str(target_path.parent) if not is_root else None,
            "items": items,
            "drives": drives,
            "media_files_in_current": media_count,
            "is_root": is_root,
            "os_type": os_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error browsing filesystem: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== LOCAL LIBRARY ====================

@api_router.get("/library", response_model=List[MediaItem])
async def get_library(media_type: str = None, user: dict = Depends(require_auth)):
    query = {"user_id": user["id"]}
    if media_type:
        query["media_type"] = media_type
    items = await db.library.find(query, {"_id": 0}).to_list(500)
    return items

@api_router.post("/library")
async def add_to_library(item: MediaItem, user: dict = Depends(require_auth)):
    item_dict = item.model_dump()
    item_dict["user_id"] = user["id"]
    await db.library.insert_one(item_dict)
    return item

# ==================== MEDIA HEALTH CHECKER ====================

from sieve import check_media_health, repair_media_file, scan_library

@api_router.post("/media/health-check")
async def check_file_health(file_path: str, compute_hash: bool = False, user: dict = Depends(require_auth)):
    """Check health of a single media file."""
    return check_media_health(file_path, compute_hash)

@api_router.post("/media/repair")
async def repair_file(file_path: str, output_path: str = None, user: dict = Depends(require_auth)):
    """Attempt to repair a media file."""
    return repair_media_file(file_path, output_path)

@api_router.post("/media/scan-library")
async def scan_media_library(directory: str, user: dict = Depends(require_auth)):
    """Scan a directory for media health issues."""
    return scan_library(directory)

# ==================== SCHEDULED SCANS & NOTIFICATIONS ====================

@api_router.get("/media/scheduled-scans")
async def get_scheduled_scans(user: dict = Depends(require_auth)):
    """Get all scheduled scans for the user."""
    scans = await db.scheduled_scans.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    return scans

@api_router.post("/media/scheduled-scans")
async def create_scheduled_scan(scan: ScheduledScan, user: dict = Depends(require_auth)):
    """Create a new scheduled scan."""
    scan_dict = scan.model_dump()
    scan_dict["user_id"] = user["id"]
    
    # Calculate next scan time based on schedule
    now = datetime.now(timezone.utc)
    hour, minute = map(int, scan.schedule_time.split(":"))
    next_scan = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if next_scan <= now:
        if scan.schedule_type == "daily":
            next_scan += timedelta(days=1)
        elif scan.schedule_type == "weekly":
            next_scan += timedelta(weeks=1)
        elif scan.schedule_type == "monthly":
            next_scan += timedelta(days=30)
    
    scan_dict["next_scan"] = next_scan.isoformat()
    
    await db.scheduled_scans.insert_one(scan_dict)
    scan_dict.pop("_id", None)
    return scan_dict

@api_router.put("/media/scheduled-scans/{scan_id}")
async def update_scheduled_scan(scan_id: str, scan: ScheduledScan, user: dict = Depends(require_auth)):
    """Update a scheduled scan."""
    scan_dict = scan.model_dump()
    scan_dict["user_id"] = user["id"]
    
    await db.scheduled_scans.update_one(
        {"id": scan_id, "user_id": user["id"]},
        {"$set": scan_dict}
    )
    return scan_dict

@api_router.delete("/media/scheduled-scans/{scan_id}")
async def delete_scheduled_scan(scan_id: str, user: dict = Depends(require_auth)):
    """Delete a scheduled scan."""
    result = await db.scheduled_scans.delete_one({"id": scan_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled scan not found")
    return {"status": "deleted"}

@api_router.post("/media/scheduled-scans/{scan_id}/run")
async def run_scheduled_scan_now(scan_id: str, user: dict = Depends(require_auth)):
    """Run a scheduled scan immediately."""
    scan_doc = await db.scheduled_scans.find_one(
        {"id": scan_id, "user_id": user["id"]},
        {"_id": 0}
    )
    if not scan_doc:
        raise HTTPException(status_code=404, detail="Scheduled scan not found")
    
    # Run the scan
    results = scan_library(scan_doc["directory"])
    
    # Calculate stats
    total = len(results)
    healthy = sum(1 for r in results if r["status"] == "healthy")
    warnings = sum(1 for r in results if r["status"] == "warning")
    errors = sum(1 for r in results if r["status"] in ["error", "corrupt", "repairable"])
    
    # Update last scan time
    now = datetime.now(timezone.utc)
    await db.scheduled_scans.update_one(
        {"id": scan_id},
        {"$set": {"last_scan": now.isoformat()}}
    )
    
    # Create notification if there are issues
    issues_list = [r for r in results if r["status"] != "healthy"]
    if issues_list and scan_doc.get("notify_on_issues", True):
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "scan_id": scan_id,
            "directory": scan_doc["directory"],
            "total_files": total,
            "healthy_files": healthy,
            "warning_files": warnings,
            "error_files": errors,
            "issues": issues_list[:10],  # Limit to first 10 issues
            "created_at": now.isoformat(),
            "read": False
        }
        await db.scan_notifications.insert_one(notification)
    
    return {
        "total_files": total,
        "healthy_files": healthy,
        "warning_files": warnings,
        "error_files": errors,
        "results": results
    }

@api_router.get("/media/notifications")
async def get_notifications(user: dict = Depends(require_auth), unread_only: bool = False):
    """Get scan notifications for the user."""
    query = {"user_id": user["id"]}
    if unread_only:
        query["read"] = False
    
    notifications = await db.scan_notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return notifications

@api_router.put("/media/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(require_auth)):
    """Mark a notification as read."""
    await db.scan_notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True}}
    )
    return {"status": "marked as read"}

@api_router.delete("/media/notifications/{notification_id}")
async def delete_notification(notification_id: str, user: dict = Depends(require_auth)):
    """Delete a notification."""
    await db.scan_notifications.delete_one({"id": notification_id, "user_id": user["id"]})
    return {"status": "deleted"}

# ==================== RE-DOWNLOAD USING INDEXERS ====================

@api_router.post("/media/redownload")
async def request_redownload(
    file_path: str,
    title: str,
    media_type: str = "movie",
    tmdb_id: int = None,
    user: dict = Depends(require_auth)
):
    """Request re-download of a corrupted file using indexers."""
    # Get user's enabled indexers
    user_indexers = await db.indexers.find(
        {"user_id": user["id"], "enabled": True},
        {"_id": 0}
    ).to_list(50)
    
    if not user_indexers:
        # Use default indexers (even if not enabled, we'll show them)
        user_indexers = default_indexers
    
    # Filter to enabled only
    enabled_indexers = [i for i in user_indexers if i.get("enabled", False)]
    
    # Queue a download (using the mock downloads for now)
    download = DownloadItem(
        title=f"[Re-download] {title}",
        media_type=media_type,
        tmdb_id=tmdb_id,
        size=0,  # Unknown until search completes
        status="searching" if enabled_indexers else "pending_indexers"
    )
    
    # Store the re-download request
    redownload_request = {
        "id": download.id,
        "user_id": user["id"],
        "original_file": file_path,
        "title": title,
        "media_type": media_type,
        "tmdb_id": tmdb_id,
        "status": "queued" if enabled_indexers else "pending_indexers",
        "indexers_to_search": [i["name"] for i in enabled_indexers],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.redownload_requests.insert_one(redownload_request)
    
    # Add to downloads queue
    mock_downloads.append(download)
    
    if enabled_indexers:
        return {
            "status": "queued",
            "download_id": download.id,
            "message": f"Re-download queued. Will search {len(enabled_indexers)} indexer(s) for: {title}",
            "indexers": [i["name"] for i in enabled_indexers]
        }
    else:
        return {
            "status": "pending_indexers",
            "download_id": download.id,
            "message": f"Re-download queued for '{title}'. Enable indexers in Settings to start search.",
            "indexers": []
        }

# ==================== COMPOTE - INDEXER MANAGER ====================
# Python-based indexer aggregator (inspired by Prowlarr)

from compote import get_compote, IndexerConfig, DEFAULT_INDEXERS, INDEXER_TYPES, INDEXER_SETUP_GUIDE

@api_router.get("/compote/indexers")
async def compote_list_indexers(user: dict = Depends(require_auth)):
    """List all configured Compote indexers."""
    compote = get_compote()
    indexers = compote.list_indexers()
    
    # If no indexers configured, return defaults
    if not indexers:
        return DEFAULT_INDEXERS
    
    return indexers

@api_router.get("/compote/indexer-types")
async def compote_get_indexer_types():
    """Get available indexer types and their descriptions."""
    return INDEXER_TYPES

@api_router.get("/compote/setup-guide")
async def compote_get_setup_guide():
    """Get setup guides for different indexer types."""
    return INDEXER_SETUP_GUIDE

@api_router.get("/compote/default-indexers")
async def compote_get_default_indexers():
    """Get list of default/preset indexers that can be added."""
    return DEFAULT_INDEXERS

@api_router.post("/compote/indexers")
async def compote_add_indexer(
    name: str,
    indexer_type: str,
    url: str,
    api_key: str = "",
    enabled: bool = True,
    priority: int = 50,
    cloudflare_protected: bool = False,
    search_path: str = "",
    cookie: str = "",
    user: dict = Depends(require_auth)
):
    """Add a new indexer to Compote."""
    compote = get_compote()
    
    # Generate ID from name
    indexer_id = name.lower().replace(" ", "_").replace("-", "_")
    
    config = IndexerConfig(
        id=indexer_id,
        name=name,
        type=indexer_type,
        url=url,
        api_key=api_key,
        enabled=enabled,
        priority=priority,
        cloudflare_protected=cloudflare_protected,
        search_path=search_path,
        cookie=cookie,
    )
    
    compote.add_indexer(config)
    
    # Also save to database for persistence
    await db.compote_indexers.update_one(
        {"id": indexer_id, "user_id": user["id"]},
        {"$set": {
            "id": indexer_id,
            "name": name,
            "type": indexer_type,
            "url": url,
            "api_key": api_key,
            "enabled": enabled,
            "priority": priority,
            "cloudflare_protected": cloudflare_protected,
            "search_path": search_path,
            "cookie": cookie,
            "user_id": user["id"],
        }},
        upsert=True
    )
    
    return {"status": "added", "id": indexer_id, "name": name}

@api_router.put("/compote/indexers/{indexer_id}")
async def compote_update_indexer(
    indexer_id: str,
    request: Request,
    user: dict = Depends(require_auth)
):
    """Update an existing indexer."""
    compote = get_compote()
    
    try:
        body = await request.json()
    except Exception:
        body = {}
    
    # Get existing config
    existing = compote.get_indexer(indexer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Indexer not found")
    
    # Update fields
    name = body.get("name", existing.name)
    url = body.get("url", existing.url)
    api_key = body.get("api_key", existing.api_key)
    enabled = body.get("enabled", existing.enabled)
    priority = body.get("priority", existing.priority)
    cloudflare_protected = body.get("cloudflare_protected", existing.cloudflare_protected)
    search_path = body.get("search_path", existing.search_path)
    cookie = body.get("cookie", existing.cookie)
    
    # Create updated config
    config = IndexerConfig(
        id=indexer_id,
        name=name,
        type=existing.type,
        url=url,
        api_key=api_key,
        enabled=enabled,
        priority=priority,
        cloudflare_protected=cloudflare_protected,
        search_path=search_path,
        cookie=cookie,
    )
    
    compote.add_indexer(config)  # This replaces the existing one
    
    # Update in database
    await db.compote_indexers.update_one(
        {"id": indexer_id, "user_id": user["id"]},
        {"$set": {
            "name": name,
            "url": url,
            "api_key": api_key,
            "enabled": enabled,
            "priority": priority,
            "cloudflare_protected": cloudflare_protected,
            "search_path": search_path,
            "cookie": cookie,
        }}
    )
    
    return {"status": "updated", "id": indexer_id}

@api_router.delete("/compote/indexers/{indexer_id}")
async def compote_remove_indexer(indexer_id: str, user: dict = Depends(require_auth)):
    """Remove an indexer from Compote."""
    compote = get_compote()
    compote.remove_indexer(indexer_id)
    
    await db.compote_indexers.delete_one({"id": indexer_id, "user_id": user["id"]})
    
    return {"status": "removed", "id": indexer_id}

@api_router.post("/compote/indexers/{indexer_id}/test")
async def compote_test_indexer(indexer_id: str, user: dict = Depends(require_auth)):
    """Test connectivity to an indexer."""
    compote = get_compote()
    result = await compote.test_indexer(indexer_id)
    return result


# ==================== QUALITY PROFILES (SONARR/RADARR-STYLE) ====================

# Default quality definitions that mirror Sonarr/Radarr
DEFAULT_QUALITY_DEFINITIONS = [
    {"name": "Bluray-2160p Remux", "resolution": "2160p", "source": "Bluray", "rank": 100, "enabled": True},
    {"name": "Bluray-2160p", "resolution": "2160p", "source": "Bluray", "rank": 95, "enabled": True},
    {"name": "WEB-2160p", "resolution": "2160p", "source": "WEB", "rank": 90, "enabled": True},
    {"name": "HDTV-2160p", "resolution": "2160p", "source": "HDTV", "rank": 85, "enabled": True},
    {"name": "Bluray-1080p Remux", "resolution": "1080p", "source": "Bluray", "rank": 80, "enabled": True},
    {"name": "Bluray-1080p", "resolution": "1080p", "source": "Bluray", "rank": 75, "enabled": True},
    {"name": "WEB-1080p", "resolution": "1080p", "source": "WEB", "rank": 70, "enabled": True},
    {"name": "HDTV-1080p", "resolution": "1080p", "source": "HDTV", "rank": 65, "enabled": True},
    {"name": "Bluray-720p", "resolution": "720p", "source": "Bluray", "rank": 60, "enabled": True},
    {"name": "WEB-720p", "resolution": "720p", "source": "WEB", "rank": 55, "enabled": True},
    {"name": "HDTV-720p", "resolution": "720p", "source": "HDTV", "rank": 50, "enabled": True},
    {"name": "DVD-R", "resolution": "480p", "source": "DVD", "rank": 40, "enabled": False},
    {"name": "WEB-480p", "resolution": "480p", "source": "WEB", "rank": 35, "enabled": False},
    {"name": "SDTV", "resolution": "480p", "source": "HDTV", "rank": 30, "enabled": False},
    {"name": "CAM", "resolution": "Unknown", "source": "CAM", "rank": 10, "enabled": False},
]

@api_router.get("/quality-profiles")
async def get_quality_profiles(user: dict = Depends(require_auth)):
    """Get all quality profiles for the current user."""
    profiles = await db.quality_profiles.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # If no profiles exist, create default ones
    if not profiles:
        now = datetime.now(timezone.utc).isoformat()
        default_profiles = [
            {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "name": "Any",
                "upgrade_allowed": True,
                "cutoff": "Bluray-1080p",
                "qualities": json.dumps([
                    {"name": "Bluray-2160p", "resolution": "2160p", "source": "Bluray", "rank": 95, "enabled": True},
                    {"name": "WEB-2160p", "resolution": "2160p", "source": "WEB", "rank": 90, "enabled": True},
                    {"name": "Bluray-1080p", "resolution": "1080p", "source": "Bluray", "rank": 75, "enabled": True},
                    {"name": "WEB-1080p", "resolution": "1080p", "source": "WEB", "rank": 70, "enabled": True},
                    {"name": "Bluray-720p", "resolution": "720p", "source": "Bluray", "rank": 60, "enabled": True},
                    {"name": "WEB-720p", "resolution": "720p", "source": "WEB", "rank": 55, "enabled": True},
                ]),
                "is_default": 1,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "name": "HD - 720p/1080p",
                "upgrade_allowed": True,
                "cutoff": "Bluray-1080p",
                "qualities": json.dumps([
                    {"name": "Bluray-1080p", "resolution": "1080p", "source": "Bluray", "rank": 75, "enabled": True},
                    {"name": "WEB-1080p", "resolution": "1080p", "source": "WEB", "rank": 70, "enabled": True},
                    {"name": "HDTV-1080p", "resolution": "1080p", "source": "HDTV", "rank": 65, "enabled": True},
                    {"name": "Bluray-720p", "resolution": "720p", "source": "Bluray", "rank": 60, "enabled": True},
                    {"name": "WEB-720p", "resolution": "720p", "source": "WEB", "rank": 55, "enabled": True},
                ]),
                "is_default": 0,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "name": "Ultra-HD",
                "upgrade_allowed": True,
                "cutoff": "Bluray-2160p",
                "qualities": json.dumps([
                    {"name": "Bluray-2160p Remux", "resolution": "2160p", "source": "Bluray", "rank": 100, "enabled": True},
                    {"name": "Bluray-2160p", "resolution": "2160p", "source": "Bluray", "rank": 95, "enabled": True},
                    {"name": "WEB-2160p", "resolution": "2160p", "source": "WEB", "rank": 90, "enabled": True},
                ]),
                "is_default": 0,
                "created_at": now,
                "updated_at": now,
            },
        ]
        
        for profile in default_profiles:
            await db.quality_profiles.insert_one(profile)
        
        # Fetch the created profiles
        profiles = await db.quality_profiles.find(
            {"user_id": user["id"]},
            {"_id": 0}
        ).to_list(100)
    
    # Parse qualities JSON string
    for profile in profiles:
        if isinstance(profile.get("qualities"), str):
            profile["qualities"] = json.loads(profile["qualities"])
    
    return {
        "profiles": profiles,
        "quality_definitions": DEFAULT_QUALITY_DEFINITIONS
    }

@api_router.post("/quality-profiles")
async def create_quality_profile(
    name: str,
    cutoff: str = "Bluray-1080p",
    qualities: str = None,  # JSON string of quality definitions
    upgrade_allowed: bool = True,
    user: dict = Depends(require_auth)
):
    """Create a new quality profile."""
    now = datetime.now(timezone.utc).isoformat()
    
    # Parse qualities or use defaults
    if qualities:
        qualities_list = json.loads(qualities)
    else:
        # Default: HD qualities enabled
        qualities_list = [q for q in DEFAULT_QUALITY_DEFINITIONS if q["resolution"] in ["1080p", "720p"]]
    
    profile = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": name,
        "upgrade_allowed": 1 if upgrade_allowed else 0,
        "cutoff": cutoff,
        "qualities": json.dumps(qualities_list),
        "is_default": 0,
        "created_at": now,
        "updated_at": now,
    }
    
    await db.quality_profiles.insert_one(profile)
    
    # Return with parsed qualities
    profile["qualities"] = qualities_list
    return profile

@api_router.put("/quality-profiles/{profile_id}")
async def update_quality_profile(
    profile_id: str,
    body: dict = Body(...),
    user: dict = Depends(require_auth)
):
    """Update a quality profile."""
    # Check ownership
    existing = await db.quality_profiles.find_one(
        {"id": profile_id, "user_id": user["id"]},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Build update
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if "name" in body:
        updates["name"] = body["name"]
    if "cutoff" in body:
        updates["cutoff"] = body["cutoff"]
    if "upgrade_allowed" in body:
        updates["upgrade_allowed"] = 1 if body["upgrade_allowed"] else 0
    if "qualities" in body:
        if isinstance(body["qualities"], list):
            updates["qualities"] = json.dumps(body["qualities"])
        else:
            updates["qualities"] = body["qualities"]
    if "is_default" in body:
        # If setting as default, unset other defaults first
        if body["is_default"]:
            await db.quality_profiles.update_many(
                {"user_id": user["id"]},
                {"is_default": 0}
            )
        updates["is_default"] = 1 if body["is_default"] else 0
    
    await db.quality_profiles.update_one(
        {"id": profile_id},
        updates
    )
    
    # Return updated profile
    updated = await db.quality_profiles.find_one(
        {"id": profile_id},
        {"_id": 0}
    )
    if isinstance(updated.get("qualities"), str):
        updated["qualities"] = json.loads(updated["qualities"])
    
    return updated

@api_router.delete("/quality-profiles/{profile_id}")
async def delete_quality_profile(profile_id: str, user: dict = Depends(require_auth)):
    """Delete a quality profile."""
    # Check ownership
    existing = await db.quality_profiles.find_one(
        {"id": profile_id, "user_id": user["id"]},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    await db.quality_profiles.delete_one({"id": profile_id})
    return {"status": "deleted", "id": profile_id}

@api_router.get("/quality-profiles/{profile_id}")
async def get_quality_profile(profile_id: str, user: dict = Depends(require_auth)):
    """Get a specific quality profile."""
    profile = await db.quality_profiles.find_one(
        {"id": profile_id, "user_id": user["id"]},
        {"_id": 0}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    if isinstance(profile.get("qualities"), str):
        profile["qualities"] = json.loads(profile["qualities"])
    
    return profile

@api_router.get("/quality-definitions")
async def get_quality_definitions(user: dict = Depends(require_auth)):
    """Get all available quality definitions."""
    return {"definitions": DEFAULT_QUALITY_DEFINITIONS}

@api_router.get("/compote/search")
async def compote_search(
    query: str,
    media_type: str = "movies",
    sort_by: str = "seeders",
    limit: int = 50,
    user: dict = Depends(require_auth)
):
    """Search across all enabled indexers."""
    compote = get_compote()
    
    # Load user's indexers from database
    user_indexers = await db.compote_indexers.find(
        {"user_id": user["id"], "enabled": True},
        {"_id": 0}
    ).to_list(50)
    
    # Add to compote if not already added
    for idx_data in user_indexers:
        if idx_data["id"] not in compote.indexers:
            config = IndexerConfig(
                id=idx_data["id"],
                name=idx_data["name"],
                type=idx_data["type"],
                url=idx_data["url"],
                api_key=idx_data.get("api_key", ""),
                enabled=idx_data.get("enabled", True),
                priority=idx_data.get("priority", 50),
            )
            compote.add_indexer(config)
    
    # Perform search
    results = await compote.search(
        query=query,
        media_type=media_type,
        limit_per_indexer=limit,
        sort_by=sort_by
    )
    
    return {
        "query": query,
        "media_type": media_type,
        "total_results": len(results),
        "results": results
    }

# ==================== SYRUP - LIVE SCRAPER SEARCH ====================
from syrup_scrapers import search_all_scrapers, SCRAPERS

@api_router.get("/syrup/scrapers")
async def syrup_list_scrapers():
    """List available Syrup scrapers."""
    return {
        "scrapers": [
            {"id": s_id, "name": SCRAPERS[s_id].name}
            for s_id in SCRAPERS.keys()
        ]
    }

@api_router.get("/syrup/search")
async def syrup_search(
    query: str,
    scrapers: str = None,  # Comma-separated scraper IDs
    limit: int = 50,
    user: dict = Depends(require_auth)
):
    """
    Search using Syrup's live site scrapers.
    This performs real-time scraping of torrent sites.
    """
    from compote import get_preserve
    
    scraper_list = scrapers.split(",") if scrapers else None
    preserve = get_preserve()
    
    try:
        results = await search_all_scrapers(
            query=query,
            scrapers=scraper_list,
            limit_per_scraper=limit // (len(scraper_list) if scraper_list else 4),
            preserve_instance=preserve
        )
        
        return {
            "query": query,
            "scrapers_used": scraper_list or list(SCRAPERS.keys()),
            "total_results": len(results),
            "results": results
        }
    except Exception as e:
        logger.error(f"Syrup search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== DIRECT MAGNET SUBMISSION ====================

@api_router.post("/downloads/add-magnet")
async def add_magnet_direct(
    magnet: str,
    name: str = None,
    sequential: bool = True,
    user: dict = Depends(require_auth)
):
    """
    Add a magnet link directly to the download engine.
    This allows users to paste magnet links directly.
    """
    if not magnet or not magnet.startswith("magnet:"):
        raise HTTPException(status_code=400, detail="Invalid magnet link")
    
    # Extract name from magnet if not provided
    if not name:
        import urllib.parse
        parsed = urllib.parse.urlparse(magnet)
        params = urllib.parse.parse_qs(parsed.query)
        name = params.get('dn', ['Unknown Torrent'])[0]
        name = urllib.parse.unquote_plus(name)
    
    # Get user's download settings
    settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    save_path = settings.get("download_path", "/media/downloads") if settings else "/media/downloads"
    
    try:
        engine = get_fondue_engine()
        torrent_id = await engine.add_magnet(
            magnet,
            save_path=save_path,
            sequential=sequential,
            category="watchnexus"
        )
        
        if torrent_id:
            return {
                "success": True,
                "message": "Magnet added to download queue",
                "torrent_id": torrent_id,
                "name": name,
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to add magnet")
            
    except Exception as e:
        logger.error(f"Failed to add magnet: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/compote/grab")
async def compote_grab(
    title: str,
    download_url: str = None,
    magnet_url: str = None,
    size: int = 0,
    use_builtin: bool = True,  # Default to built-in engine
    user: dict = Depends(require_auth)
):
    """Grab/download a release - sends to built-in engine or qBittorrent."""
    if not download_url and not magnet_url:
        raise HTTPException(status_code=400, detail="Either download_url or magnet_url is required")
    
    # Get user's download settings
    settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    save_path = settings.get("download_path", "/media/downloads") if settings else "/media/downloads"
    
    download_success = False
    download_message = ""
    torrent_id = None
    
    # Check user preference (stored in localStorage on frontend, passed here)
    download_mode = "builtin" if use_builtin else "qbittorrent"
    
    if download_mode == "builtin":
        # Use built-in torrent engine
        try:
            engine = get_fondue_engine()
            
            if magnet_url:
                torrent_id = await engine.add_magnet(
                    magnet_url,
                    save_path=save_path,
                    sequential=True,  # Enable for streaming
                    category="watchnexus"
                )
                download_success = torrent_id is not None
                download_message = "Added to built-in engine" if download_success else "Engine: Failed to add"
            else:
                # For .torrent URLs, we'd need to download the file first
                # For now, skip non-magnet downloads
                download_message = "Built-in engine requires magnet links"
                
        except Exception as e:
            download_message = f"Built-in engine error: {str(e)}"
            logger.warning(f"Built-in engine grab failed: {e}")
    else:
        # Use qBittorrent
        try:
            from qbittorrent_client import get_qbittorrent_client
            qbit = get_qbittorrent_client()
            
            if magnet_url:
                download_success = await qbit.add_magnet(magnet_url, save_path=save_path, category="watchnexus")
            elif download_url:
                download_success = await qbit.add_torrent(urls=[download_url], save_path=save_path, category="watchnexus")
            
            download_message = "Added to qBittorrent" if download_success else "qBittorrent: Failed to add"
        except Exception as e:
            download_message = f"qBittorrent not available: {str(e)}"
            logger.warning(f"qBittorrent grab failed: {e}")
    
    # Create a download entry for tracking
    download = DownloadItem(
        title=title,
        media_type="movie",
        size=size,
        status="downloading" if download_success else "queued",
        progress=0,
    )
    
    mock_downloads.append(download)
    
    # Store the grab request
    grab_request = {
        "id": download.id,
        "user_id": user["id"],
        "title": title,
        "download_url": download_url,
        "magnet_url": magnet_url,
        "size": size,
        "status": "grabbed" if download_success else "queued",
        "engine": download_mode,
        "torrent_id": torrent_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.grab_requests.insert_one(grab_request)
    
    return {
        "status": "grabbed" if download_success else "queued",
        "download_id": download.id,
        "torrent_id": torrent_id,
        "message": f"Added '{title}' to download queue. {download_message}",
        "engine": download_mode,
        "success": download_success
    }

# ==================== QBITTORRENT API ====================

from qbittorrent_client import get_qbittorrent_client

@api_router.get("/qbittorrent/status")
async def qbittorrent_status(user: dict = Depends(require_auth)):
    """Get qBittorrent connection status and transfer info."""
    qbit = get_qbittorrent_client()
    test_result = await qbit.test_connection()
    
    if test_result["success"]:
        transfer = await qbit.get_transfer_info()
        test_result["transfer"] = transfer
    
    return test_result

@api_router.get("/qbittorrent/torrents")
async def qbittorrent_torrents(
    filter: str = "all",
    category: str = "",
    limit: int = 50,
    user: dict = Depends(require_auth)
):
    """Get list of torrents from qBittorrent."""
    qbit = get_qbittorrent_client()
    torrents = await qbit.get_torrents(filter=filter, category=category, limit=limit)
    return [t.to_dict() for t in torrents]

@api_router.post("/qbittorrent/add")
async def qbittorrent_add(
    url: str = None,
    magnet: str = None,
    save_path: str = "",
    category: str = "watchnexus",
    user: dict = Depends(require_auth)
):
    """Add a torrent to qBittorrent."""
    if not url and not magnet:
        raise HTTPException(status_code=400, detail="Either url or magnet is required")
    
    qbit = get_qbittorrent_client()
    
    if magnet:
        success = await qbit.add_magnet(magnet, save_path=save_path, category=category)
    else:
        success = await qbit.add_torrent(urls=[url], save_path=save_path, category=category)
    
    if success:
        return {"status": "added", "message": "Torrent added to qBittorrent"}
    else:
        raise HTTPException(status_code=500, detail="Failed to add torrent")

@api_router.post("/qbittorrent/pause/{torrent_hash}")
async def qbittorrent_pause(torrent_hash: str, user: dict = Depends(require_auth)):
    """Pause a torrent."""
    qbit = get_qbittorrent_client()
    success = await qbit.pause_torrent(torrent_hash)
    return {"status": "paused" if success else "failed"}

@api_router.post("/qbittorrent/resume/{torrent_hash}")
async def qbittorrent_resume(torrent_hash: str, user: dict = Depends(require_auth)):
    """Resume a torrent."""
    qbit = get_qbittorrent_client()
    success = await qbit.resume_torrent(torrent_hash)
    return {"status": "resumed" if success else "failed"}

@api_router.delete("/qbittorrent/delete/{torrent_hash}")
async def qbittorrent_delete(
    torrent_hash: str,
    delete_files: bool = False,
    user: dict = Depends(require_auth)
):
    """Delete a torrent."""
    qbit = get_qbittorrent_client()
    success = await qbit.delete_torrent(torrent_hash, delete_files=delete_files)
    return {"status": "deleted" if success else "failed"}

@api_router.get("/qbittorrent/files/{torrent_hash}")
async def qbittorrent_files(torrent_hash: str, user: dict = Depends(require_auth)):
    """Get files in a torrent."""
    qbit = get_qbittorrent_client()
    files = await qbit.get_torrent_files(torrent_hash)
    return files

@api_router.post("/qbittorrent/test")
async def qbittorrent_test(
    host: str = "localhost",
    port: int = 8080,
    username: str = "admin",
    password: str = "adminadmin",
    user: dict = Depends(require_auth)
):
    """Test qBittorrent connection with custom credentials."""
    from qbittorrent_client import QBittorrentClient
    qbit = QBittorrentClient(host=host, port=port, username=username, password=password)
    result = await qbit.test_connection()
    await qbit.close()
    return result

# ==================== BUILT-IN TORRENT ENGINE ====================
# Native torrent downloading - no external applications required!
# REQUIRES: libtorrent system package
# Arch Linux: sudo pacman -S libtorrent-rasterbar python-libtorrent
# Ubuntu/Debian: sudo apt install python3-libtorrent

from fondue import get_fondue_engine, shutdown_fondue_engine

@api_router.get("/downloads/engine/status")
async def torrent_engine_status(user: dict = Depends(require_auth)):
    """Get built-in torrent engine status and transfer info."""
    try:
        engine = get_fondue_engine()
        transfer = engine.get_transfer_info()
        return {
            "success": True,
            "engine": "WatchNexus Built-in Torrent Engine",
            "version": "1.0.0",
            "transfer": transfer,
            "message": "Engine running"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@api_router.get("/downloads/engine/torrents")
async def torrent_engine_list(user: dict = Depends(require_auth)):
    """Get list of all torrents from built-in engine."""
    engine = get_fondue_engine()
    torrents = engine.get_all_torrents()
    return [t.to_dict() for t in torrents]

@api_router.post("/downloads/engine/add")
async def torrent_engine_add(
    magnet: str = None,
    save_path: str = "",
    sequential: bool = False,
    category: str = "watchnexus",
    user: dict = Depends(require_auth)
):
    """Add a torrent to the built-in engine."""
    if not magnet:
        raise HTTPException(status_code=400, detail="Magnet link is required")
    
    # Get user's download path from settings
    if not save_path:
        settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
        save_path = settings.get("download_path", "/media/downloads") if settings else "/media/downloads"
    
    engine = get_fondue_engine()
    torrent_id = await engine.add_magnet(
        magnet_url=magnet,
        save_path=save_path,
        sequential=sequential,
        category=category
    )
    
    if torrent_id:
        return {
            "status": "added",
            "torrent_id": torrent_id,
            "message": "Torrent added to built-in download engine"
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to add torrent")

# Settings routes MUST come before {torrent_id} routes to avoid path conflicts
@api_router.get("/downloads/engine/settings")
async def torrent_engine_get_settings(user: dict = Depends(require_auth)):
    """Get current torrent engine settings."""
    engine = get_fondue_engine()
    settings = engine.get_settings()
    return settings.to_dict()

@api_router.put("/downloads/engine/settings")
async def torrent_engine_update_settings(
    request: Request,
    user: dict = Depends(require_auth)
):
    """Update torrent engine settings."""
    engine = get_fondue_engine()
    
    try:
        body = await request.json()
    except Exception:
        body = {}
    
    # Also check query params
    params = dict(request.query_params)
    body.update(params)
    
    # Convert string numbers to proper types
    int_fields = [
        'max_active_downloads', 'max_active_uploads', 'max_active_torrents',
        'max_download_rate', 'max_upload_rate', 'alt_download_rate', 'alt_upload_rate',
        'max_connections_global', 'max_connections_per_torrent',
        'max_uploads_global', 'max_uploads_per_torrent',
        'seed_time_limit', 'max_completed_torrents', 'slow_torrent_threshold', 'listen_port'
    ]
    float_fields = ['seed_ratio_limit']
    bool_fields = [
        'remove_after_completion', 'remove_after_seeding', 'delete_files_on_remove',
        'dont_count_slow_torrents', 'enable_dht', 'enable_pex', 'enable_lsd',
        'enable_upnp', 'enable_natpmp', 'preallocate_storage', 'add_paused',
        'sequential_download_default', 'prioritize_first_last_pieces', 'announce_to_all_trackers'
    ]
    
    for field in int_fields:
        if field in body and body[field] is not None:
            try:
                body[field] = int(body[field])
            except (ValueError, TypeError):
                pass
    
    for field in float_fields:
        if field in body and body[field] is not None:
            try:
                body[field] = float(body[field])
            except (ValueError, TypeError):
                pass
    
    for field in bool_fields:
        if field in body:
            if isinstance(body[field], str):
                body[field] = body[field].lower() in ('true', '1', 'yes')
    
    updated = engine.update_settings(body)
    return {"status": "updated", "settings": updated.to_dict()}

@api_router.post("/downloads/engine/pause-all")
async def torrent_engine_pause_all(user: dict = Depends(require_auth)):
    """Pause all torrents."""
    engine = get_fondue_engine()
    count = engine.pause_all()
    return {"status": "paused", "count": count}

@api_router.post("/downloads/engine/resume-all")
async def torrent_engine_resume_all(user: dict = Depends(require_auth)):
    """Resume all torrents."""
    engine = get_fondue_engine()
    count = engine.resume_all()
    return {"status": "resumed", "count": count}

@api_router.post("/downloads/engine/remove-completed")
async def torrent_engine_remove_completed(
    delete_files: bool = False,
    user: dict = Depends(require_auth)
):
    """Remove all completed torrents."""
    engine = get_fondue_engine()
    count = engine.remove_completed(delete_files=delete_files)
    return {"status": "removed", "count": count}

# Torrent-specific routes (dynamic {torrent_id} comes after static routes)
@api_router.get("/downloads/engine/{torrent_id}")
async def torrent_engine_get(torrent_id: str, user: dict = Depends(require_auth)):
    """Get status of a specific torrent."""
    engine = get_fondue_engine()
    status = engine.get_status(torrent_id)
    
    if status:
        return status.to_dict()
    else:
        raise HTTPException(status_code=404, detail="Torrent not found")

@api_router.get("/downloads/engine/{torrent_id}/files")
async def torrent_engine_files(torrent_id: str, user: dict = Depends(require_auth)):
    """Get files in a torrent."""
    engine = get_fondue_engine()
    files = engine.get_files(torrent_id)
    return [f.to_dict() for f in files]

@api_router.post("/downloads/engine/{torrent_id}/pause")
async def torrent_engine_pause(torrent_id: str, user: dict = Depends(require_auth)):
    """Pause a torrent."""
    engine = get_fondue_engine()
    success = engine.pause(torrent_id)
    return {"status": "paused" if success else "failed"}

@api_router.post("/downloads/engine/{torrent_id}/resume")
async def torrent_engine_resume(torrent_id: str, user: dict = Depends(require_auth)):
    """Resume a paused torrent."""
    engine = get_fondue_engine()
    success = engine.resume(torrent_id)
    return {"status": "resumed" if success else "failed"}

@api_router.delete("/downloads/engine/{torrent_id}")
async def torrent_engine_remove(
    torrent_id: str,
    delete_files: bool = False,
    user: dict = Depends(require_auth)
):
    """Remove a torrent."""
    engine = get_fondue_engine()
    success = engine.remove(torrent_id, delete_files=delete_files)
    return {"status": "removed" if success else "failed"}

@api_router.post("/downloads/engine/{torrent_id}/sequential")
async def torrent_engine_sequential(
    torrent_id: str,
    enabled: bool = True,
    user: dict = Depends(require_auth)
):
    """Enable/disable sequential download for streaming."""
    engine = get_fondue_engine()
    success = engine.set_sequential(torrent_id, enabled)
    return {"status": "updated" if success else "failed", "sequential": enabled}

# ==================== MARMALADE MEDIA SERVER ====================
# Python-based media server (replaces Jellyfin)

from marmalade_server import get_marmalade_server

@api_router.get("/marmalade/status")
async def marmalade_status(user: dict = Depends(require_auth)):
    """Get Marmalade server status."""
    server = get_marmalade_server()
    return {
        "status": "running",
        "version": "1.0.0",
        "engine": "Marmalade (Python)",
        "libraries": len(server.libraries),
        "media_files": len(server.media_files),
    }

# Library Management
@api_router.get("/marmalade/libraries")
async def marmalade_get_libraries(user: dict = Depends(require_auth)):
    """Get all libraries."""
    server = get_marmalade_server()
    return [lib.to_dict() for lib in server.get_libraries()]

@api_router.post("/marmalade/libraries")
async def marmalade_add_library(
    name: str,
    path: str,
    media_type: str = "movies",
    user: dict = Depends(require_auth)
):
    """Add a new library."""
    server = get_marmalade_server()
    library = server.add_library(name, path, media_type)
    return library.to_dict()

@api_router.delete("/marmalade/libraries/{library_id}")
async def marmalade_remove_library(library_id: str, user: dict = Depends(require_auth)):
    """Remove a library."""
    server = get_marmalade_server()
    success = server.remove_library(library_id)
    return {"status": "removed" if success else "not_found"}

@api_router.post("/marmalade/libraries/{library_id}/scan")
async def marmalade_scan_library(library_id: str, user: dict = Depends(require_auth)):
    """Scan a library for new media."""
    server = get_marmalade_server()
    result = await server.scan_library(library_id)
    return result

# Media Retrieval
@api_router.get("/marmalade/media")
async def marmalade_get_media(
    library_id: str = None,
    media_type: str = None,
    limit: int = 100,
    offset: int = 0,
    user: dict = Depends(require_auth)
):
    """Get media files with optional filtering."""
    server = get_marmalade_server()
    media = server.get_all_media(library_id, media_type, limit, offset)
    return [m.to_dict() for m in media]

@api_router.get("/marmalade/tv-series")
async def marmalade_get_tv_series(
    library_id: Optional[str] = None,
    user: dict = Depends(require_auth)
):
    """Get TV episodes grouped by series and season."""
    server = get_marmalade_server()
    return server.get_tv_series_grouped(library_id)

@api_router.get("/marmalade/media/recent")
async def marmalade_get_recent(limit: int = 20, user: dict = Depends(require_auth)):
    """Get recently added media."""
    server = get_marmalade_server()
    media = server.get_recent_media(limit)
    return [m.to_dict() for m in media]

@api_router.get("/marmalade/media/search")
async def marmalade_search(query: str, limit: int = 50, user: dict = Depends(require_auth)):
    """Search for media."""
    server = get_marmalade_server()
    media = server.search_media(query, limit)
    return [m.to_dict() for m in media]

@api_router.get("/marmalade/media/{media_id}")
async def marmalade_get_media_item(media_id: str, user: dict = Depends(require_auth)):
    """Get a specific media item."""
    server = get_marmalade_server()
    media = server.get_media(media_id)
    if media:
        return media.to_dict()
    raise HTTPException(status_code=404, detail="Media not found")

@api_router.get("/marmalade/continue-watching")
async def marmalade_continue_watching(limit: int = 10, user: dict = Depends(require_auth)):
    """Get continue watching list."""
    server = get_marmalade_server()
    media = server.get_continue_watching(limit)
    return [m.to_dict() for m in media]

# Watch Progress
@api_router.post("/marmalade/media/{media_id}/progress")
async def marmalade_update_progress(
    media_id: str,
    progress: float,
    user: dict = Depends(require_auth)
):
    """Update watch progress."""
    server = get_marmalade_server()
    success = server.update_watch_progress(media_id, progress)
    return {"status": "updated" if success else "not_found"}

@api_router.post("/marmalade/media/{media_id}/watched")
async def marmalade_mark_watched(
    media_id: str,
    watched: bool = True,
    user: dict = Depends(require_auth)
):
    """Mark media as watched/unwatched."""
    server = get_marmalade_server()
    success = server.mark_watched(media_id, watched)
    return {"status": "updated" if success else "not_found"}

@api_router.post("/marmalade/media/{media_id}/refresh-metadata")
async def marmalade_refresh_metadata(
    media_id: str,
    user: dict = Depends(require_auth)
):
    """Refresh TMDB metadata for a specific media file."""
    server = get_marmalade_server()
    success = await server.refresh_media_metadata(media_id)
    if success:
        media = server.get_media(media_id)
        return {
            "status": "refreshed",
            "media": media.to_dict() if media else None
        }
    return {"status": "no_changes", "media_id": media_id}

@api_router.post("/marmalade/libraries/{library_id}/refresh-metadata")
async def marmalade_refresh_library_metadata(
    library_id: str,
    user: dict = Depends(require_auth)
):
    """Refresh TMDB metadata for all media in a library."""
    server = get_marmalade_server()
    library = server.get_library(library_id)
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")
    
    # Get all media in the library
    media_list = [m for m in server.media_files.values() if m.path.startswith(library.path)]
    
    refreshed = 0
    for media in media_list:
        success = await server.refresh_media_metadata(media.id)
        if success:
            refreshed += 1
    
    return {
        "status": "complete",
        "library": library.name,
        "total": len(media_list),
        "refreshed": refreshed
    }

# ==================== MEDIA MANAGEMENT (Manual Import) ====================

@api_router.post("/media-management/scan-import")
async def scan_for_import(
    body: dict = Body(...),
    user: dict = Depends(require_auth)
):
    """Scan a directory for importable media files."""
    path = body.get("path", "")
    if not path or not os.path.isdir(path):
        raise HTTPException(status_code=400, detail="Invalid directory path")
    
    # Video file extensions to look for
    video_extensions = {'.mkv', '.mp4', '.avi', '.m4v', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m2ts'}
    
    files = []
    try:
        for root, dirs, filenames in os.walk(path):
            # Skip hidden directories
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            
            for filename in filenames:
                ext = os.path.splitext(filename)[1].lower()
                if ext in video_extensions:
                    file_path = os.path.join(root, filename)
                    try:
                        size = os.path.getsize(file_path)
                        files.append({
                            "path": file_path,
                            "filename": filename,
                            "size": size,
                            "size_formatted": f"{size / (1024*1024*1024):.2f} GB" if size > 1024*1024*1024 else f"{size / (1024*1024):.1f} MB"
                        })
                    except OSError:
                        continue
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to access directory")
    
    return {"files": files, "count": len(files)}

@api_router.post("/media-management/import")
async def import_media_files(
    body: dict = Body(...),
    user: dict = Depends(require_auth)
):
    """Import selected media files into a library."""
    files = body.get("files", [])
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    server = get_marmalade_server()
    imported = 0
    failed = 0
    
    for file_info in files:
        file_path = file_info.get("path")
        target_library = file_info.get("library_id")
        
        if not file_path or not os.path.exists(file_path):
            failed += 1
            continue
        
        try:
            # Add to marmalade media library
            success = await server.import_file(file_path, target_library)
            if success:
                imported += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Failed to import {file_path}: {e}")
            failed += 1
    
    return {
        "status": "complete",
        "imported": imported,
        "failed": failed,
        "total": len(files)
    }

# Streaming
@api_router.get("/marmalade/stream/{media_id}")
async def marmalade_get_stream(
    media_id: str,
    quality: str = "original",
    user: dict = Depends(require_auth)
):
    """Get stream info for a media file."""
    server = get_marmalade_server()
    stream_info = server.get_stream_url(media_id, quality)
    if stream_info:
        return stream_info
    raise HTTPException(status_code=404, detail="Media not found")

@api_router.get("/marmalade/stream/{media_id}/file")
async def marmalade_stream_file(media_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Stream a media file (supports range requests). Authentication optional for local network."""
    # Note: We use get_current_user instead of require_auth to allow streaming
    # even without full authentication (e.g., for local network users using Who's Watching)
    # The media_id itself acts as a form of authorization since it's not predictable
    
    server = get_marmalade_server()
    media = server.get_media(media_id)
    
    if not media or not os.path.exists(media.path):
        raise HTTPException(status_code=404, detail="Media file not found")
    
    file_path = media.path
    file_size = os.path.getsize(file_path)
    
    # Get range header for partial content
    range_header = request.headers.get('range')
    
    if range_header:
        # Parse range header
        range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
            
            if start >= file_size:
                raise HTTPException(status_code=416, detail="Range not satisfiable")
            
            content_length = end - start + 1
            
            def iter_file():
                with open(file_path, 'rb') as f:
                    f.seek(start)
                    remaining = content_length
                    while remaining > 0:
                        chunk_size = min(8192, remaining)
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk
            
            from starlette.responses import StreamingResponse
            return StreamingResponse(
                iter_file(),
                status_code=206,
                media_type=server._get_mime_type(file_path),
                headers={
                    'Content-Range': f'bytes {start}-{end}/{file_size}',
                    'Content-Length': str(content_length),
                    'Accept-Ranges': 'bytes',
                }
            )
    
    # Full file response
    from starlette.responses import FileResponse
    return FileResponse(
        file_path,
        media_type=server._get_mime_type(file_path),
        headers={'Accept-Ranges': 'bytes'}
    )

# ==================== ADVANCED PLAYBACK CONTROLS ====================

@api_router.get("/marmalade/media/{media_id}/skip-segments")
async def get_skip_segments(media_id: str, user: dict = Depends(require_auth)):
    """
    Get skip segments (intro, credits, recap) for a media file.
    Returns estimated segments based on duration if no custom segments exist.
    """
    server = get_marmalade_server()
    media = server.get_media(media_id)
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Check database for custom skip segments
    skip_data = await get_skip_segments_from_db(media_id)
    
    if skip_data:
        return {"media_id": media_id, "segments": skip_data}
    
    # Generate estimated skip segments based on media type and duration
    segments = []
    duration = media.duration
    
    if duration > 0:
        # TV episode typically has intro in first 30-120 seconds
        if media.media_type.value == "episode" or media.series_name:
            # Estimate intro (usually 30-90 seconds, starts within first 5 minutes)
            if duration > 300:  # Only for videos longer than 5 minutes
                segments.append({
                    "type": "intro",
                    "start": 30,  # Often after cold open
                    "end": 90,    # Most intros are 30-60 seconds
                    "estimated": True
                })
            
            # Estimate credits (last 60-120 seconds)
            if duration > 300:
                credits_start = max(duration - 90, duration * 0.95)
                segments.append({
                    "type": "credits",
                    "start": credits_start,
                    "end": duration,
                    "estimated": True
                })
        
        # Movies typically have longer credits
        elif media.media_type.value == "movie":
            # Movies usually have credits at the very end
            if duration > 3600:  # For movies > 1 hour
                credits_start = max(duration - 180, duration * 0.97)
                segments.append({
                    "type": "credits",
                    "start": credits_start,
                    "end": duration,
                    "estimated": True
                })
    
    return {"media_id": media_id, "segments": segments}


async def get_skip_segments_from_db(media_id: str) -> list:
    """Fetch custom skip segments from database if available."""
    from database import get_database
    db = get_database()
    
    try:
        # Note: Using skip_markers table (schema uses this name)
        segments = await db.skip_markers.find_one({"media_id": media_id})
        if segments:
            return segments.get("segments", [])
    except Exception:
        pass
    
    return []


@api_router.post("/marmalade/media/{media_id}/skip-segments")
async def set_skip_segments(
    media_id: str,
    segments: List[dict],
    user: dict = Depends(require_auth)
):
    """
    Set custom skip segments for a media file.
    Requires admin permission.
    """
    from database import get_database
    db = get_database()
    
    server = get_marmalade_server()
    media = server.get_media(media_id)
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Validate segments
    valid_types = ["intro", "credits", "recap", "preview"]
    for segment in segments:
        if segment.get("type") not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid segment type: {segment.get('type')}")
        if "start" not in segment or "end" not in segment:
            raise HTTPException(status_code=400, detail="Segments must have start and end times")
        if segment["start"] >= segment["end"]:
            raise HTTPException(status_code=400, detail="Segment start must be before end")
    
    # Save to database (using skip_markers table)
    await db.skip_markers.update_one(
        {"media_id": media_id},
        {"$set": {"media_id": media_id, "segments": segments, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"success": True, "message": "Skip segments saved"}


@api_router.get("/marmalade/media/{media_id}/next-episode")
async def get_next_episode(media_id: str, user: dict = Depends(require_auth)):
    """
    Get the next episode in a series for auto-play functionality.
    """
    server = get_marmalade_server()
    media = server.get_media(media_id)
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Only works for TV episodes
    if media.media_type.value != "episode" and not media.series_name:
        return None
    
    series_name = media.series_name or media.title
    current_season = media.season_number or 1
    current_episode = media.episode_number or 1
    
    # Get all media from the same series
    all_media = server.get_all_media(media_type="episode")
    
    # Filter to same series
    series_episodes = [
        m for m in all_media 
        if (m.series_name or m.title) == series_name
    ]
    
    # Sort by season and episode
    series_episodes.sort(key=lambda x: (x.season_number or 0, x.episode_number or 0))
    
    # Find next episode
    next_ep = None
    found_current = False
    
    for ep in series_episodes:
        if found_current:
            next_ep = ep
            break
        if ep.id == media_id:
            found_current = True
    
    # Also check for next episode in same season, then next season
    if not next_ep:
        # Try next episode number in same season
        for ep in series_episodes:
            if (ep.season_number or 0) == current_season and (ep.episode_number or 0) == current_episode + 1:
                next_ep = ep
                break
        
        # Try first episode of next season
        if not next_ep:
            for ep in series_episodes:
                if (ep.season_number or 0) == current_season + 1 and (ep.episode_number or 0) == 1:
                    next_ep = ep
                    break
    
    if next_ep:
        return {
            "id": next_ep.id,
            "title": next_ep.title,
            "series_name": next_ep.series_name,
            "season_number": next_ep.season_number,
            "episode_number": next_ep.episode_number,
            "thumbnail": next_ep.poster_url or next_ep.backdrop_url,
            "duration": next_ep.duration,
        }
    
    return None

# ==================== AUDIO FINGERPRINT DETECTION ====================
from fprint import analyze_series_for_intros

@api_router.post("/marmalade/series/{series_name}/analyze-intros")
async def analyze_series_intros(
    series_name: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_auth)
):
    """
    Trigger audio fingerprint analysis to detect intro/credits segments for a series.
    
    This analyzes audio across all episodes of a series to find repeated segments
    (like opening themes) and automatically creates skip segments for them.
    """
    server = get_marmalade_server()
    
    # Get all episodes from this series
    all_media = server.get_all_media(media_type="episode")
    series_episodes = [
        m for m in all_media 
        if (m.series_name or "").lower() == series_name.lower()
    ]
    
    if len(series_episodes) < 2:
        return {
            "success": False, 
            "message": f"Need at least 2 episodes to detect intros. Found {len(series_episodes)}."
        }
    
    # Prepare episode data for analysis
    episode_data = [
        {
            "media_id": ep.id,
            "file_path": ep.path,
            "duration": ep.duration or 0
        }
        for ep in series_episodes
        if ep.path and os.path.exists(ep.path)
    ]
    
    if len(episode_data) < 2:
        return {
            "success": False,
            "message": "Not enough episodes with valid file paths found."
        }
    
    # Run analysis in background
    async def run_analysis():
        try:
            from database import get_database
            db = get_database()
            
            detected = await analyze_series_for_intros(episode_data)
            
            if detected:
                # Save detected segments for each episode
                for ep_data in episode_data:
                    await db.skip_segments.update_one(
                        {"media_id": ep_data["media_id"]},
                        {
                            "$set": {
                                "media_id": ep_data["media_id"],
                                "segments": detected,
                                "detected_at": datetime.now(timezone.utc).isoformat(),
                                "series_name": series_name
                            }
                        },
                        upsert=True
                    )
                
                logger.info(f"Detected {len(detected)} skip segments for series: {series_name}")
            else:
                logger.info(f"No intro/credits detected for series: {series_name}")
                
        except Exception as e:
            logger.error(f"Error analyzing series {series_name}: {e}")
    
    background_tasks.add_task(run_analysis)
    
    return {
        "success": True,
        "message": f"Analysis started for {len(episode_data)} episodes. Skip segments will be auto-saved when detected.",
        "episodes_queued": len(episode_data)
    }


@api_router.get("/marmalade/series/{series_name}/intro-status")
async def get_series_intro_status(
    series_name: str,
    user: dict = Depends(require_auth)
):
    """
    Get the intro/credits detection status for a series.
    Shows which episodes have detected skip segments.
    """
    from database import get_database
    db = get_database()
    server = get_marmalade_server()
    
    # Get all episodes from this series
    all_media = server.get_all_media(media_type="episode")
    series_episodes = [
        m for m in all_media 
        if (m.series_name or "").lower() == series_name.lower()
    ]
    
    # Check which have skip segments
    episodes_with_segments = []
    episodes_without_segments = []
    
    for ep in series_episodes:
        skip_data = await db.skip_segments.find_one({"media_id": ep.id})
        if skip_data and skip_data.get("segments"):
            episodes_with_segments.append({
                "id": ep.id,
                "title": ep.title,
                "season": ep.season_number,
                "episode": ep.episode_number,
                "segments": skip_data.get("segments", [])
            })
        else:
            episodes_without_segments.append({
                "id": ep.id,
                "title": ep.title,
                "season": ep.season_number,
                "episode": ep.episode_number
            })
    
    return {
        "series_name": series_name,
        "total_episodes": len(series_episodes),
        "with_segments": len(episodes_with_segments),
        "without_segments": len(episodes_without_segments),
        "episodes_with_segments": episodes_with_segments,
        "episodes_without_segments": episodes_without_segments
    }


@api_router.post("/marmalade/media/{media_id}/detect-segments")
async def detect_single_media_segments(
    media_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_auth)
):
    """
    Trigger audio fingerprint analysis for a single media item.
    Compares against other episodes from the same series.
    """
    server = get_marmalade_server()
    media = server.get_media(media_id)
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    if not media.series_name:
        return {"success": False, "message": "This feature only works for TV series episodes"}
    
    # Redirect to series analysis
    return await analyze_series_intros(media.series_name, background_tasks, user)


# ==================== SUBTITLE SERVICE ====================
from garnish import get_garnish_service

@api_router.get("/subtitles/search/tv")
async def search_tv_subtitles(
    show_name: str,
    season: int,
    episode: int,
    languages: str = "en",
    user: dict = Depends(require_auth)
):
    """Search for TV show subtitles."""
    service = get_garnish_service()
    lang_list = [lang.strip() for lang in languages.split(",")]
    results = await service.search_tv(show_name, season, episode, lang_list)
    return {"results": results, "count": len(results)}

@api_router.get("/subtitles/search/movie")
async def search_movie_subtitles(
    movie_name: str,
    year: int = None,
    imdb_id: str = None,
    languages: str = "en",
    user: dict = Depends(require_auth)
):
    """Search for movie subtitles."""
    service = get_garnish_service()
    lang_list = [lang.strip() for lang in languages.split(",")]
    results = await service.search_movie(movie_name, year, imdb_id, lang_list)
    return {"results": results, "count": len(results)}

@api_router.post("/subtitles/download")
async def download_subtitle(
    download_url: str,
    source: str,
    media_id: str,
    user: dict = Depends(require_auth)
):
    """Download a subtitle file."""
    service = get_garnish_service()
    
    # Get media path for save location
    server = get_marmalade_server()
    media = server.get_media(media_id)
    
    if media:
        save_path = os.path.dirname(media.path)
    else:
        # Use default subtitle path
        settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
        save_path = settings.get("download_path", "/media/downloads") if settings else "/media/downloads"
        save_path = os.path.join(save_path, "subtitles")
    
    result = await service.download(download_url, source, save_path)
    
    if result:
        return {"success": True, "path": result}
    else:
        raise HTTPException(status_code=500, detail="Failed to download subtitle")

@api_router.get("/subtitles/settings")
async def get_subtitle_settings(user: dict = Depends(require_auth)):
    """Get user's subtitle preferences."""
    settings = await db.subtitle_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not settings:
        settings = {
            "preferred_languages": ["en"],
            "auto_download": True,
            "hearing_impaired": False,
            "addic7ed_enabled": True,
            "opensubtitles_enabled": False,
        }
    return settings

@api_router.put("/subtitles/settings")
async def update_subtitle_settings(
    request: Request,
    user: dict = Depends(require_auth)
):
    """Update user's subtitle preferences."""
    body = await request.json()
    body["user_id"] = user["id"]
    
    await db.subtitle_settings.update_one(
        {"user_id": user["id"]},
        {"$set": body},
        upsert=True
    )
    
    # Update service config
    service = get_garnish_service()
    service.configure(body)
    
    return {"status": "updated"}

# ==================== STREAMING SERVICE LOGINS ====================
from cryptography.fernet import Fernet
import base64

# Generate or load encryption key
STREAMING_ENCRYPTION_KEY = os.environ.get('STREAMING_ENCRYPTION_KEY', base64.urlsafe_b64encode(os.urandom(32)).decode())

def get_cipher():
    """Get Fernet cipher for encrypting credentials."""
    key = STREAMING_ENCRYPTION_KEY.encode() if len(STREAMING_ENCRYPTION_KEY) == 44 else base64.urlsafe_b64encode(STREAMING_ENCRYPTION_KEY.encode()[:32])
    return Fernet(key if isinstance(key, bytes) else key.encode())

STREAMING_SERVICE_CONFIGS = {
    "netflix": {
        "name": "Netflix",
        "icon": "🎬",
        "color": "#E50914",
        "deep_link": "https://www.netflix.com/search?q=",
        "login_url": "https://www.netflix.com/login",
    },
    "disney": {
        "name": "Disney+",
        "icon": "🏰",
        "color": "#113CCF",
        "deep_link": "https://www.disneyplus.com/search?q=",
        "login_url": "https://www.disneyplus.com/login",
    },
    "prime": {
        "name": "Amazon Prime Video",
        "icon": "📦",
        "color": "#00A8E1",
        "deep_link": "https://www.amazon.com/s?k=",
        "login_url": "https://www.amazon.com/gp/sign-in.html",
    },
    "crunchyroll": {
        "name": "Crunchyroll",
        "icon": "🍥",
        "color": "#F47521",
        "deep_link": "https://www.crunchyroll.com/search?q=",
        "login_url": "https://www.crunchyroll.com/login",
    },
    "youtube": {
        "name": "YouTube Premium",
        "icon": "▶️",
        "color": "#FF0000",
        "deep_link": "https://www.youtube.com/results?search_query=",
        "login_url": "https://accounts.google.com/",
    },
    "hbomax": {
        "name": "HBO Max",
        "icon": "🎭",
        "color": "#5822B4",
        "deep_link": "https://play.max.com/search?q=",
        "login_url": "https://play.max.com/login",
    },
    "hulu": {
        "name": "Hulu",
        "icon": "📺",
        "color": "#1CE783",
        "deep_link": "https://www.hulu.com/search?q=",
        "login_url": "https://www.hulu.com/login",
    },
    "peacock": {
        "name": "Peacock",
        "icon": "🦚",
        "color": "#000000",
        "deep_link": "https://www.peacocktv.com/search?q=",
        "login_url": "https://www.peacocktv.com/signin",
    },
    "paramount": {
        "name": "Paramount+",
        "icon": "⭐",
        "color": "#0064FF",
        "deep_link": "https://www.paramountplus.com/search?q=",
        "login_url": "https://www.paramountplus.com/account/signin/",
    },
    "appletv": {
        "name": "Apple TV+",
        "icon": "🍎",
        "color": "#555555",
        "deep_link": "https://tv.apple.com/search?term=",
        "login_url": "https://tv.apple.com/",
    },
    "funimation": {
        "name": "Funimation",
        "icon": "🎌",
        "color": "#5B0BB5",
        "deep_link": "https://www.funimation.com/search?q=",
        "login_url": "https://www.funimation.com/log-in/",
    },
}

@api_router.get("/streaming-logins/services")
async def get_streaming_services_list():
    """Get list of supported streaming services."""
    return list(STREAMING_SERVICE_CONFIGS.values())

@api_router.get("/streaming-logins")
async def get_user_streaming_logins(user: dict = Depends(require_auth)):
    """Get user's configured streaming service logins (credentials hidden)."""
    logins = await db.streaming_logins.find(
        {"user_id": user["id"]},
        {"_id": 0, "password_encrypted": 0}  # Don't return encrypted password
    ).to_list(50)
    
    return logins

@api_router.post("/streaming-logins")
async def add_streaming_login(
    service_id: str,
    email: str,
    password: str,
    user: dict = Depends(require_auth)
):
    """Add or update a streaming service login."""
    if service_id not in STREAMING_SERVICE_CONFIGS:
        raise HTTPException(status_code=400, detail="Unknown streaming service")
    
    service = STREAMING_SERVICE_CONFIGS[service_id]
    
    # Encrypt password
    try:
        cipher = get_cipher()
        encrypted_password = cipher.encrypt(password.encode()).decode()
    except Exception as e:
        logger.error(f"Encryption error: {e}")
        encrypted_password = ""
    
    login_doc = {
        "user_id": user["id"],
        "service_id": service_id,
        "service_name": service["name"],
        "icon": service["icon"],
        "color": service["color"],
        "email": email,
        "password_encrypted": encrypted_password,
        "deep_link": service["deep_link"],
        "login_url": service["login_url"],
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.streaming_logins.update_one(
        {"user_id": user["id"], "service_id": service_id},
        {"$set": login_doc},
        upsert=True
    )
    
    # Return without password
    login_doc.pop("password_encrypted")
    return {"status": "added", "login": login_doc}

@api_router.delete("/streaming-logins/{service_id}")
async def delete_streaming_login(service_id: str, user: dict = Depends(require_auth)):
    """Remove a streaming service login."""
    result = await db.streaming_logins.delete_one({
        "user_id": user["id"],
        "service_id": service_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Login not found")
    
    return {"status": "deleted"}

@api_router.get("/streaming-logins/{service_id}/credentials")
async def get_streaming_credentials(service_id: str, user: dict = Depends(require_auth)):
    """Get decrypted credentials for a streaming service (for auto-login)."""
    login = await db.streaming_logins.find_one(
        {"user_id": user["id"], "service_id": service_id},
        {"_id": 0}
    )
    
    if not login:
        raise HTTPException(status_code=404, detail="Login not found")
    
    # Decrypt password
    password = ""
    if login.get("password_encrypted"):
        try:
            cipher = get_cipher()
            password = cipher.decrypt(login["password_encrypted"].encode()).decode()
        except Exception as e:
            logger.error(f"Decryption error: {e}")
    
    return {
        "email": login.get("email"),
        "password": password,
        "login_url": login.get("login_url"),
    }

# ==================== WATCH PARTY ====================
from potluck import get_potluck_manager
from fastapi import WebSocket, WebSocketDisconnect

@api_router.get("/watch-party/list")
async def list_watch_parties(user: dict = Depends(require_auth)):
    """List public watch parties."""
    manager = get_potluck_manager()
    return manager.list_public_parties()

@api_router.post("/watch-party/create")
async def create_watch_party_rest(
    media_id: str,
    media_title: str,
    media_type: str = "movie",
    user: dict = Depends(require_auth)
):
    """Create a watch party (REST endpoint for getting party code before WebSocket)."""
    manager = get_potluck_manager()
    
    # Generate party code
    party_code = manager.generate_party_code()
    
    # Store pending party info
    pending_party = {
        "party_code": party_code,
        "host_id": user["id"],
        "host_username": user.get("username", "Host"),
        "media_id": media_id,
        "media_title": media_title,
        "media_type": media_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.pending_parties.update_one(
        {"party_code": party_code},
        {"$set": pending_party},
        upsert=True
    )
    
    return {
        "party_code": party_code,
        "share_url": f"/party/{party_code}",
        "message": "Connect via WebSocket to start the party"
    }

@api_router.get("/watch-party/{party_code}")
async def get_watch_party_info(party_code: str, user: dict = Depends(require_auth)):
    """Get watch party information."""
    manager = get_potluck_manager()
    party = manager.get_party(party_code)
    
    if party:
        return party.to_dict()
    
    # Check pending parties
    pending = await db.pending_parties.find_one(
        {"party_code": party_code.upper()},
        {"_id": 0}
    )
    
    if pending:
        return {
            "party_code": pending["party_code"],
            "status": "pending",
            "media_title": pending.get("media_title"),
            "host": pending.get("host_username"),
        }
    
    raise HTTPException(status_code=404, detail="Watch party not found")

# WebSocket endpoint for Watch Party
@app.websocket("/ws/party/{party_code}")
async def watch_party_websocket(websocket: WebSocket, party_code: str):
    """WebSocket connection for watch party synchronization."""
    await websocket.accept()
    
    manager = get_potluck_manager()
    user_id = None
    
    try:
        # First message should be authentication
        auth_msg = await websocket.receive_json()
        
        if auth_msg.get("type") != "auth":
            await websocket.send_json({"type": "error", "message": "Authentication required"})
            await websocket.close()
            return
        
        # Validate token or session
        auth_msg.get("token")
        user_id = auth_msg.get("user_id")
        username = auth_msg.get("username", "Guest")
        action = auth_msg.get("action", "join")  # create or join
        
        if action == "create":
            # Check for pending party
            pending = await db.pending_parties.find_one({"party_code": party_code.upper()})
            
            if pending:
                party = await manager.create_party(
                    host_id=user_id,
                    host_username=username,
                    media_id=pending.get("media_id", ""),
                    media_title=pending.get("media_title", "Watch Party"),
                    media_type=pending.get("media_type", "movie"),
                    websocket=websocket,
                )
                
                # Clean up pending
                await db.pending_parties.delete_one({"party_code": party_code.upper()})
            else:
                party = await manager.create_party(
                    host_id=user_id,
                    host_username=username,
                    media_id=auth_msg.get("media_id", ""),
                    media_title=auth_msg.get("media_title", "Watch Party"),
                    media_type=auth_msg.get("media_type", "movie"),
                    websocket=websocket,
                )
        else:
            party = await manager.join_party(
                party_id=party_code,
                user_id=user_id,
                username=username,
                websocket=websocket,
            )
        
        if not party:
            await websocket.send_json({"type": "error", "message": "Party not found"})
            await websocket.close()
            return
        
        # Send initial party state
        await websocket.send_json({
            "type": "party_joined",
            "party": party.to_dict(),
        })
        
        # Handle messages
        while True:
            message = await websocket.receive_json()
            await manager.handle_message(user_id, message)
            
    except WebSocketDisconnect:
        logger.info(f"User {user_id} disconnected from party {party_code}")
    except Exception as e:
        logger.error(f"Watch party error: {e}")
    finally:
        if user_id:
            await manager.leave_party(user_id)

# ==================== GELATIN - EXTERNAL ACCESS ====================
from gelatin import get_gelatin_server

@api_router.get("/gelatin/status")
async def gelatin_status(user: dict = Depends(require_auth)):
    """Get Gelatin server status and URLs."""
    server = get_gelatin_server()
    return server.get_server_info()

@api_router.get("/gelatin/lan-url")
async def gelatin_lan_url(user: dict = Depends(require_auth)):
    """Get LAN URL for local network access."""
    server = get_gelatin_server()
    return {"lan_url": server.get_lan_url()}

@api_router.post("/gelatin/tunnel/create")
async def gelatin_create_tunnel(
    provider: str = "built_in",
    user: dict = Depends(require_auth)
):
    """Create a tunnel for external access."""
    server = get_gelatin_server()
    tunnel = await server.create_tunnel(provider)
    
    if tunnel:
        return {
            "tunnel_id": tunnel.tunnel_id,
            "public_url": tunnel.public_url,
            "created_at": tunnel.created_at,
        }
    
    raise HTTPException(status_code=500, detail="Failed to create tunnel")

@api_router.get("/gelatin/tunnels")
async def gelatin_list_tunnels(user: dict = Depends(require_auth)):
    """List active tunnels."""
    server = get_gelatin_server()
    return server.get_active_tunnels()

@api_router.delete("/gelatin/tunnel/{tunnel_id}")
async def gelatin_close_tunnel(tunnel_id: str, user: dict = Depends(require_auth)):
    """Close an active tunnel."""
    server = get_gelatin_server()
    success = await server.close_tunnel(tunnel_id)
    return {"status": "closed" if success else "not_found"}

@api_router.post("/gelatin/access-token")
async def gelatin_create_access_token(
    permissions: str = "view,watch_party",
    expires_hours: int = 24,
    user: dict = Depends(require_auth)
):
    """Generate a temporary access token for sharing."""
    server = get_gelatin_server()
    perm_list = [p.strip() for p in permissions.split(",")]
    token = server.generate_access_token(user["id"], perm_list, expires_hours)
    
    return {
        "token": token,
        "permissions": perm_list,
        "expires_hours": expires_hours,
    }

@api_router.get("/gelatin/share-link")
async def gelatin_share_link(
    party_code: str,
    use_external: bool = False,
    user: dict = Depends(require_auth)
):
    """Generate a shareable link for a watch party."""
    server = get_gelatin_server()
    link = server.generate_share_link(party_code, use_external)
    return {"share_link": link}

@api_router.get("/gelatin/discover")
async def gelatin_discover_servers(
    timeout: float = 3.0,
    user: dict = Depends(require_auth)
):
    """Discover other WatchNexus servers on the network."""
    server = get_gelatin_server()
    servers = await server.discover_servers(timeout)
    return {"servers": servers}

# ==================== MILK THEME ENGINE ====================
from milk import get_milk_engine, ThemeType, ThemeConfig

@api_router.get("/milk/themes")
async def get_all_themes(user: dict = Depends(require_auth)):
    """Get all available themes (built-in + custom)."""
    engine = get_milk_engine()
    return {
        "current": engine.get_current_theme().to_dict() if engine.get_current_theme() else None,
        "built_in": engine.get_built_in_themes(),
        "custom": engine.get_custom_themes(),
    }

@api_router.get("/milk/current")
async def get_current_theme(user: dict = Depends(require_auth)):
    """Get current active theme configuration."""
    engine = get_milk_engine()
    theme = engine.get_current_theme()
    return theme.to_dict() if theme else None

@api_router.get("/milk/css")
async def get_theme_css(user: dict = Depends(require_auth)):
    """Get CSS for current theme."""
    engine = get_milk_engine()
    return {"css": engine.get_current_css()}

@api_router.post("/milk/set-theme")
async def set_theme(
    theme_type: str,
    user: dict = Depends(require_auth)
):
    """Set active theme by type."""
    engine = get_milk_engine()
    try:
        theme = engine.set_theme(ThemeType(theme_type))
        return {"status": "success", "theme": theme.to_dict()}
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown theme type: {theme_type}")

@api_router.post("/milk/custom-theme")
async def set_custom_theme(
    request: Request,
    user: dict = Depends(require_auth)
):
    """Create or update custom theme."""
    engine = get_milk_engine()
    body = await request.json()
    
    config = ThemeConfig.from_dict(body)
    theme = engine.set_custom_theme(config)
    
    return {"status": "success", "theme": theme.to_dict()}

@api_router.delete("/milk/custom-theme/{name}")
async def delete_custom_theme(name: str, user: dict = Depends(require_auth)):
    """Delete a custom theme."""
    engine = get_milk_engine()
    success = engine.delete_custom_theme(name)
    return {"status": "deleted" if success else "not_found"}

@api_router.get("/milk/theme-forge")
async def get_theme_forge_config(user: dict = Depends(require_auth)):
    """Get full Theme Forge configuration for UI."""
    engine = get_milk_engine()
    return engine.get_theme_forge_config()

@api_router.post("/milk/export/{name}")
async def export_theme(name: str, user: dict = Depends(require_auth)):
    """Export a custom theme as JSON."""
    engine = get_milk_engine()
    json_str = engine.export_theme(name)
    if json_str:
        return {"json": json_str}
    raise HTTPException(status_code=404, detail="Theme not found")

@api_router.post("/milk/import")
async def import_theme(
    request: Request,
    user: dict = Depends(require_auth)
):
    """Import a theme from JSON."""
    engine = get_milk_engine()
    body = await request.json()
    
    theme = engine.import_theme(json.dumps(body))
    if theme:
        return {"status": "imported", "theme": theme.to_dict()}
    raise HTTPException(status_code=400, detail="Invalid theme data")

# ==================== GADGETS PLUGIN SYSTEM ====================
from gadgets import get_gadgets_manager

@api_router.get("/gadgets/plugins")
async def list_plugins(user: dict = Depends(require_auth)):
    """List all discovered plugins."""
    manager = get_gadgets_manager()
    # Auto-discover plugins if none found
    if not manager._manifests:
        await manager.discover_plugins()
    return manager.get_all_plugins()

@api_router.post("/gadgets/discover")
async def discover_plugins(user: dict = Depends(require_auth)):
    """Scan for new plugins."""
    manager = get_gadgets_manager()
    manifests = await manager.discover_plugins()
    return {"discovered": len(manifests), "plugins": [m.to_dict() for m in manifests]}

@api_router.post("/gadgets/load/{plugin_id}")
async def load_plugin(plugin_id: str, user: dict = Depends(require_auth)):
    """Load and activate a plugin."""
    manager = get_gadgets_manager()
    plugin = await manager.load_plugin(plugin_id)
    
    if plugin:
        return {"status": "loaded", "plugin": plugin.to_dict()}
    raise HTTPException(status_code=500, detail="Failed to load plugin")

@api_router.post("/gadgets/unload/{plugin_id}")
async def unload_plugin(plugin_id: str, user: dict = Depends(require_auth)):
    """Unload and deactivate a plugin."""
    manager = get_gadgets_manager()
    success = await manager.unload_plugin(plugin_id)
    return {"status": "unloaded" if success else "not_found"}

@api_router.post("/gadgets/plugins/{plugin_id}/enable")
async def enable_plugin(plugin_id: str, user: dict = Depends(require_auth)):
    """Enable and load a plugin."""
    manager = get_gadgets_manager()
    plugin = await manager.load_plugin(plugin_id)
    if plugin:
        return {"status": "enabled", "plugin": plugin.to_dict()}
    raise HTTPException(status_code=500, detail="Failed to enable plugin")

@api_router.post("/gadgets/plugins/{plugin_id}/disable")
async def disable_plugin(plugin_id: str, user: dict = Depends(require_auth)):
    """Disable and unload a plugin."""
    manager = get_gadgets_manager()
    success = await manager.unload_plugin(plugin_id)
    return {"status": "disabled" if success else "not_found"}

@api_router.get("/gadgets/plugin/{plugin_id}")
async def get_plugin_info(plugin_id: str, user: dict = Depends(require_auth)):
    """Get detailed plugin information."""
    manager = get_gadgets_manager()
    plugin = manager.get_plugin(plugin_id)
    
    if plugin:
        return plugin.to_dict()
    raise HTTPException(status_code=404, detail="Plugin not found or not loaded")

@api_router.put("/gadgets/plugin/{plugin_id}/settings")
async def update_plugin_settings(
    plugin_id: str,
    request: Request,
    user: dict = Depends(require_auth)
):
    """Update plugin settings."""
    manager = get_gadgets_manager()
    body = await request.json()
    
    success = await manager.update_plugin_settings(plugin_id, body)
    return {"status": "updated" if success else "failed"}

@api_router.post("/gadgets/import-file")
async def import_plugin_from_file(
    file: UploadFile = File(...),
    user: dict = Depends(require_auth)
):
    """Import a plugin from an uploaded zip file."""
    import zipfile
    import shutil
    import tempfile
    
    manager = get_gadgets_manager()
    
    # Validate file type
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files are supported")
    
    try:
        # Save uploaded file to temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        # Extract and validate
        with zipfile.ZipFile(tmp_path, 'r') as zip_ref:
            # Check for manifest.json in root or first subdirectory
            manifest_path = None
            plugin_root = None
            
            for name in zip_ref.namelist():
                if name.endswith('manifest.json'):
                    manifest_path = name
                    # Get the directory containing manifest
                    plugin_root = os.path.dirname(name)
                    break
            
            if not manifest_path:
                raise HTTPException(status_code=400, detail="No manifest.json found in plugin archive")
            
            # Read and parse manifest
            manifest_content = zip_ref.read(manifest_path)
            manifest_data = json.loads(manifest_content)
            
            # Generate plugin ID from manifest
            plugin_id = manifest_data.get('id') or manifest_data.get('name', 'unknown').lower().replace(' ', '_')
            
            # Create target directory
            target_dir = manager.plugins_dir / plugin_id
            if target_dir.exists():
                shutil.rmtree(target_dir)
            target_dir.mkdir(parents=True)
            
            # Extract files
            for member in zip_ref.namelist():
                # Calculate relative path
                if plugin_root:
                    if not member.startswith(plugin_root):
                        continue
                    rel_path = member[len(plugin_root):].lstrip('/')
                else:
                    rel_path = member
                
                if not rel_path:
                    continue
                
                target_path = target_dir / rel_path
                
                if member.endswith('/'):
                    target_path.mkdir(parents=True, exist_ok=True)
                else:
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(target_path, 'wb') as f:
                        f.write(zip_ref.read(member))
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        # Re-discover plugins
        await manager.discover_plugins()
        
        return {
            "status": "imported",
            "plugin_id": plugin_id,
            "name": manifest_data.get('name', plugin_id),
            "version": manifest_data.get('version', '1.0.0')
        }
        
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid manifest.json format")
    except Exception as e:
        logger.error(f"Plugin import failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/gadgets/import-url")
async def import_plugin_from_url(
    url: str,
    user: dict = Depends(require_auth)
):
    """Import a plugin from a URL (zip file)."""
    import zipfile
    import shutil
    import tempfile
    
    manager = get_gadgets_manager()
    
    if not url.endswith('.zip'):
        raise HTTPException(status_code=400, detail="URL must point to a .zip file")
    
    try:
        # Download the file
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url, timeout=60)
            response.raise_for_status()
            content = response.content
        
        # Save to temp file and process same as file upload
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        with zipfile.ZipFile(tmp_path, 'r') as zip_ref:
            # Check for manifest.json
            manifest_path = None
            plugin_root = None
            
            for name in zip_ref.namelist():
                if name.endswith('manifest.json'):
                    manifest_path = name
                    plugin_root = os.path.dirname(name)
                    break
            
            if not manifest_path:
                raise HTTPException(status_code=400, detail="No manifest.json found in plugin archive")
            
            manifest_content = zip_ref.read(manifest_path)
            manifest_data = json.loads(manifest_content)
            
            plugin_id = manifest_data.get('id') or manifest_data.get('name', 'unknown').lower().replace(' ', '_')
            
            target_dir = manager.plugins_dir / plugin_id
            if target_dir.exists():
                shutil.rmtree(target_dir)
            target_dir.mkdir(parents=True)
            
            for member in zip_ref.namelist():
                if plugin_root:
                    if not member.startswith(plugin_root):
                        continue
                    rel_path = member[len(plugin_root):].lstrip('/')
                else:
                    rel_path = member
                
                if not rel_path:
                    continue
                
                target_path = target_dir / rel_path
                
                if member.endswith('/'):
                    target_path.mkdir(parents=True, exist_ok=True)
                else:
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(target_path, 'wb') as f:
                        f.write(zip_ref.read(member))
        
        os.unlink(tmp_path)
        await manager.discover_plugins()
        
        return {
            "status": "imported",
            "plugin_id": plugin_id,
            "name": manifest_data.get('name', plugin_id),
            "version": manifest_data.get('version', '1.0.0'),
            "source_url": url
        }
        
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download: {str(e)}")
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file at URL")
    except Exception as e:
        logger.error(f"Plugin import from URL failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/gadgets/import-kodi")
async def import_kodi_addon(
    url: str,
    user: dict = Depends(require_auth)
):
    """
    Import a Kodi addon and convert it to a WatchNexus plugin.
    Supports Kodi video addons with addon.xml manifest.
    """
    import zipfile
    import shutil
    import tempfile
    import xml.etree.ElementTree as ET
    
    manager = get_gadgets_manager()
    
    try:
        # Download the addon
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url, timeout=60)
            response.raise_for_status()
            content = response.content
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        addon_id = None
        addon_name = None
        addon_version = "1.0.0"
        addon_author = "Unknown"
        addon_description = ""
        
        with zipfile.ZipFile(tmp_path, 'r') as zip_ref:
            # Find addon.xml
            addon_xml_path = None
            addon_root = None
            
            for name in zip_ref.namelist():
                if name.endswith('addon.xml'):
                    addon_xml_path = name
                    addon_root = os.path.dirname(name)
                    break
            
            if not addon_xml_path:
                raise HTTPException(status_code=400, detail="No addon.xml found - not a valid Kodi addon")
            
            # Parse addon.xml
            addon_xml_content = zip_ref.read(addon_xml_path).decode('utf-8')
            root = ET.fromstring(addon_xml_content)
            
            addon_id = root.attrib.get('id', 'unknown_addon')
            addon_name = root.attrib.get('name', addon_id)
            addon_version = root.attrib.get('version', '1.0.0')
            addon_author = root.attrib.get('provider-name', 'Unknown')
            
            # Get description
            for ext in root.findall('.//extension[@point="xbmc.addon.metadata"]'):
                summary = ext.find('summary')
                if summary is not None:
                    addon_description = summary.text or ""
                    break
            
            # Create plugin directory
            plugin_id = f"kodi_{addon_id.replace('.', '_')}"
            target_dir = manager.plugins_dir / plugin_id
            if target_dir.exists():
                shutil.rmtree(target_dir)
            target_dir.mkdir(parents=True)
            
            # Extract addon files
            for member in zip_ref.namelist():
                if addon_root and not member.startswith(addon_root):
                    continue
                    
                rel_path = member[len(addon_root):].lstrip('/') if addon_root else member
                if not rel_path:
                    continue
                    
                target_path = target_dir / rel_path
                if member.endswith('/'):
                    target_path.mkdir(parents=True, exist_ok=True)
                else:
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(target_path, 'wb') as f:
                        f.write(zip_ref.read(member))
            
            # Create WatchNexus manifest.json for the Kodi addon
            manifest = {
                "id": plugin_id,
                "name": f"[Kodi] {addon_name}",
                "description": addon_description or f"Kodi addon: {addon_name}",
                "version": addon_version,
                "author": addon_author,
                "plugin_type": "indexer_provider",
                "kodi_addon": True,
                "kodi_addon_id": addon_id,
                "entry_point": None,
                "tags": ["kodi", "addon", "external"]
            }
            
            with open(target_dir / "manifest.json", 'w') as f:
                json.dump(manifest, f, indent=2)
        
        os.unlink(tmp_path)
        await manager.discover_plugins()
        
        return {
            "status": "imported",
            "plugin_id": plugin_id,
            "name": f"[Kodi] {addon_name}",
            "version": addon_version,
            "source_url": url,
            "kodi_addon_id": addon_id
        }
        
    except HTTPException:
        raise
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Failed to download Kodi addon: {str(e)}")
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")
    except ET.ParseError as e:
        raise HTTPException(status_code=400, detail=f"Invalid addon.xml: {str(e)}")
    except Exception as e:
        logger.error(f"Kodi addon import failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/gadgets/plugins/{plugin_id}/uninstall")
async def uninstall_plugin(plugin_id: str, user: dict = Depends(require_auth)):
    """Uninstall a plugin by removing its files."""
    import shutil
    
    manager = get_gadgets_manager()
    
    # Unload if loaded
    await manager.unload_plugin(plugin_id)
    
    # Remove plugin directory
    plugin_dir = manager.plugins_dir / plugin_id
    if plugin_dir.exists():
        shutil.rmtree(plugin_dir)
        
        # Remove from manifests
        if plugin_id in manager._manifests:
            del manager._manifests[plugin_id]
        
        return {"status": "uninstalled", "plugin_id": plugin_id}
    
    raise HTTPException(status_code=404, detail="Plugin not found")

@api_router.get("/gadgets/providers/{provider_type}")
async def list_providers(provider_type: str, user: dict = Depends(require_auth)):
    """List plugins by provider type."""
    manager = get_gadgets_manager()
    
    providers_map = {
        "metadata": manager.get_metadata_providers,
        "indexer": manager.get_indexer_providers,
        "subtitle": manager.get_subtitle_providers,
        "notification": manager.get_notification_providers,
        "theme": manager.get_theme_providers,
        "scheduled": manager.get_scheduled_tasks,
    }
    
    getter = providers_map.get(provider_type)
    if getter:
        providers = getter()
        return {"providers": [p.to_dict() for p in providers]}
    
    raise HTTPException(status_code=400, detail=f"Unknown provider type: {provider_type}")

# ==================== KODI REPOSITORY BROWSER ====================
from kodi_browser import get_kodi_browser

@api_router.get("/kodi/addons")
async def list_kodi_addons(
    query: str = "",
    category: str = None,
    limit: int = 50,
    user: dict = Depends(require_auth)
):
    """Search and list Kodi addons."""
    browser = get_kodi_browser()
    addons = await browser.search_addons(query=query, category=category, limit=limit)
    return {"addons": [a.to_dict() for a in addons], "total": len(addons)}

@api_router.get("/kodi/addons/popular")
async def get_popular_kodi_addons(limit: int = 20, user: dict = Depends(require_auth)):
    """Get popular/featured Kodi addons."""
    browser = get_kodi_browser()
    addons = await browser.get_popular_addons(limit=limit)
    return {"addons": [a.to_dict() for a in addons]}

@api_router.get("/kodi/categories")
async def get_kodi_categories(user: dict = Depends(require_auth)):
    """Get all Kodi addon categories with counts."""
    browser = get_kodi_browser()
    categories = await browser.get_categories()
    return {"categories": categories}

@api_router.get("/kodi/addons/{addon_id}")
async def get_kodi_addon(addon_id: str, user: dict = Depends(require_auth)):
    """Get detailed info about a specific Kodi addon."""
    browser = get_kodi_browser()
    addon = await browser.get_addon(addon_id)
    if addon:
        return addon.to_dict()
    raise HTTPException(status_code=404, detail="Addon not found")

@api_router.get("/kodi/addons/category/{category}")
async def get_kodi_addons_by_category(
    category: str,
    limit: int = 50,
    user: dict = Depends(require_auth)
):
    """Get addons in a specific category."""
    browser = get_kodi_browser()
    addons = await browser.get_addons_by_category(category, limit=limit)
    return {"addons": [a.to_dict() for a in addons], "category": category}

@api_router.post("/kodi/refresh")
async def refresh_kodi_addons(user: dict = Depends(require_auth)):
    """Force refresh the Kodi addon cache."""
    browser = get_kodi_browser()
    addons = await browser.fetch_addons(force_refresh=True)
    return {"status": "refreshed", "addon_count": len(addons)}

# ==================== PLUGIN ADAPTER API ====================
from plugin_adapter import AdapterFactory, convert_kodi_addon

@api_router.post("/adapter/convert")
async def convert_plugin_upload(
    file: UploadFile = File(...),
    ecosystem: str = Form(None),
    user: dict = Depends(require_auth)
):
    """
    Convert an uploaded plugin ZIP from Kodi/Jellyfin/Plex to WatchNexus format.
    """
    import tempfile
    import shutil
    
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")
    
    temp_dir = tempfile.mkdtemp(prefix="wn_upload_")
    zip_path = os.path.join(temp_dir, file.filename)
    
    try:
        with open(zip_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        detected = ecosystem or AdapterFactory.detect_ecosystem(zip_path)
        if not detected:
            raise HTTPException(status_code=400, detail="Could not detect plugin ecosystem. Please specify ecosystem manually.")
        
        manifest, result = AdapterFactory.convert(zip_path, ecosystem=detected)
        
        if manifest:
            return {
                "status": "success",
                "ecosystem": detected,
                "manifest": manifest.to_dict(),
                "output_path": result,
                "warnings": getattr(AdapterFactory.get_adapter(detected), 'warnings', []),
                "errors": getattr(AdapterFactory.get_adapter(detected), 'errors', []),
            }
        else:
            raise HTTPException(status_code=400, detail=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

@api_router.get("/adapter/detect")
async def detect_plugin_ecosystem(
    source_path: str,
    user: dict = Depends(require_auth)
):
    """Detect the ecosystem of a plugin source."""
    ecosystem = AdapterFactory.detect_ecosystem(source_path)
    if ecosystem:
        return {"ecosystem": ecosystem}
    raise HTTPException(status_code=400, detail="Could not detect plugin ecosystem")

@api_router.get("/adapter/supported")
async def get_supported_ecosystems():
    """Get list of supported plugin ecosystems."""
    return {
        "ecosystems": [
            {"id": "kodi", "name": "Kodi", "extensions": ["addon.xml"], "description": "Kodi add-ons (.zip with addon.xml)"},
            {"id": "jellyfin", "name": "Jellyfin/Emby", "extensions": ["meta.json"], "description": "Jellyfin plugins (.zip with meta.json)"},
            {"id": "plex", "name": "Plex", "extensions": ["Info.plist"], "description": "Plex plugins (.bundle or .zip with Info.plist)"},
        ]
    }

@api_router.post("/kodi/addons/{addon_id}/install")
async def install_kodi_addon(
    addon_id: str,
    user: dict = Depends(require_auth)
):
    """
    Download and convert a Kodi addon for installation.
    """
    browser = get_kodi_browser()
    addon = await browser.get_addon(addon_id)
    
    if not addon:
        raise HTTPException(status_code=404, detail="Addon not found")
    
    # Download addon
    import tempfile
    import aiohttp
    
    async with aiohttp.ClientSession() as session:
        async with session.get(addon.download_url) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=502, detail="Failed to download addon")
            
            # Save to temp file
            temp_dir = tempfile.mkdtemp()
            zip_path = os.path.join(temp_dir, f"{addon_id}.zip")
            
            with open(zip_path, 'wb') as f:
                f.write(await resp.read())
    
    # Convert
    manifest, output_path = convert_kodi_addon(zip_path)
    
    if manifest:
        return {
            "status": "converted",
            "addon": addon.to_dict(),
            "manifest": manifest.to_dict(),
            "output_path": output_path,
            "notes": manifest.adaptation_notes
        }
    else:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {output_path}")

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ==================== DRIZZLE - PLAYLIST & QUEUE ENGINE ====================

from drizzle import (
    get_drizzle_engine, init_drizzle, 
    PlaylistType, SkipMarkerType
)

@api_router.get("/drizzle/playlists")
async def drizzle_get_playlists(user: dict = Depends(require_auth)):
    """Get all playlists for the current user."""
    drizzle = get_drizzle_engine()
    playlists = await drizzle.get_user_playlists(user["id"])
    return {
        "playlists": [p.to_dict() for p in playlists],
        "count": len(playlists)
    }

@api_router.post("/drizzle/playlists")
async def drizzle_create_playlist(
    name: str,
    description: str = "",
    playlist_type: str = "custom",
    user: dict = Depends(require_auth)
):
    """Create a new playlist."""
    drizzle = get_drizzle_engine()
    playlist = await drizzle.create_playlist(
        user_id=user["id"],
        name=name,
        description=description,
        playlist_type=PlaylistType(playlist_type)
    )
    return playlist.to_dict()

@api_router.get("/drizzle/playlists/{playlist_id}")
async def drizzle_get_playlist(playlist_id: str, user: dict = Depends(require_auth)):
    """Get a specific playlist."""
    drizzle = get_drizzle_engine()
    playlist = await drizzle.get_playlist(playlist_id, user["id"])
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist.to_dict()

@api_router.put("/drizzle/playlists/{playlist_id}")
async def drizzle_update_playlist(
    playlist_id: str,
    request: Request,
    user: dict = Depends(require_auth)
):
    """Update a playlist's settings."""
    drizzle = get_drizzle_engine()
    playlist = await drizzle.get_playlist(playlist_id, user["id"])
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    try:
        body = await request.json()
    except Exception:
        body = {}
    
    # Update fields
    if "name" in body:
        playlist.name = body["name"]
    if "description" in body:
        playlist.description = body["description"]
    if "shuffle" in body:
        playlist.shuffle = body["shuffle"]
    if "repeat" in body:
        playlist.repeat = body["repeat"]
    if "auto_skip_intros" in body:
        playlist.auto_skip_intros = body["auto_skip_intros"]
    if "auto_skip_outros" in body:
        playlist.auto_skip_outros = body["auto_skip_outros"]
    if "auto_play_next" in body:
        playlist.auto_play_next = body["auto_play_next"]
    if "credits_threshold" in body:
        playlist.credits_threshold = body["credits_threshold"]
    
    await drizzle.update_playlist(playlist)
    return playlist.to_dict()

@api_router.delete("/drizzle/playlists/{playlist_id}")
async def drizzle_delete_playlist(playlist_id: str, user: dict = Depends(require_auth)):
    """Delete a playlist."""
    drizzle = get_drizzle_engine()
    success = await drizzle.delete_playlist(playlist_id, user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"status": "deleted", "id": playlist_id}

@api_router.post("/drizzle/playlists/{playlist_id}/items")
async def drizzle_add_item(
    playlist_id: str,
    request: Request,
    position: int = None,
    user: dict = Depends(require_auth)
):
    """Add an item to a playlist."""
    drizzle = get_drizzle_engine()
    
    try:
        item_data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid item data")
    
    item = await drizzle.add_to_playlist(playlist_id, user["id"], item_data, position)
    if not item:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    return item.to_dict()

@api_router.delete("/drizzle/playlists/{playlist_id}/items/{item_id}")
async def drizzle_remove_item(
    playlist_id: str,
    item_id: str,
    user: dict = Depends(require_auth)
):
    """Remove an item from a playlist."""
    drizzle = get_drizzle_engine()
    success = await drizzle.remove_from_playlist(playlist_id, user["id"], item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Item or playlist not found")
    return {"status": "removed", "item_id": item_id}

@api_router.put("/drizzle/playlists/{playlist_id}/items/{item_id}/reorder")
async def drizzle_reorder_item(
    playlist_id: str,
    item_id: str,
    new_position: int,
    user: dict = Depends(require_auth)
):
    """Reorder an item in a playlist."""
    drizzle = get_drizzle_engine()
    success = await drizzle.reorder_playlist_item(playlist_id, user["id"], item_id, new_position)
    if not success:
        raise HTTPException(status_code=404, detail="Item or playlist not found")
    return {"status": "reordered", "item_id": item_id, "new_position": new_position}

# ==================== DRIZZLE - Quick Playlist Creation ====================

@api_router.post("/drizzle/play-season")
async def drizzle_play_season(
    show_tmdb_id: int,
    show_title: str,
    season_number: int,
    user: dict = Depends(require_auth)
):
    """Create and start a playlist for a TV season."""
    drizzle = get_drizzle_engine()
    
    # Fetch season episodes from TMDB
    season_data = await tmdb_request(f"/tv/{show_tmdb_id}/season/{season_number}")
    if not season_data:
        raise HTTPException(status_code=404, detail="Season not found")
    
    episodes = season_data.get("episodes", [])
    if not episodes:
        raise HTTPException(status_code=404, detail="No episodes found")
    
    playlist = await drizzle.create_season_playlist(
        user_id=user["id"],
        show_tmdb_id=show_tmdb_id,
        show_title=show_title,
        season_number=season_number,
        episodes=episodes
    )
    
    # Set as active queue
    await drizzle.set_active_queue(user["id"], playlist.id)
    
    return {
        "playlist": playlist.to_dict(),
        "message": f"Season {season_number} playlist created with {len(episodes)} episodes",
        "active": True
    }

@api_router.post("/drizzle/play-collection")
async def drizzle_play_collection(
    collection_id: int,
    collection_name: str,
    user: dict = Depends(require_auth)
):
    """Create and start a playlist for a movie collection."""
    drizzle = get_drizzle_engine()
    
    # Fetch collection from TMDB
    collection_data = await tmdb_request(f"/collection/{collection_id}")
    if not collection_data:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    movies = collection_data.get("parts", [])
    if not movies:
        raise HTTPException(status_code=404, detail="No movies found in collection")
    
    # Sort by release date
    movies.sort(key=lambda x: x.get("release_date", "9999"))
    
    playlist = await drizzle.create_collection_playlist(
        user_id=user["id"],
        collection_name=collection_name,
        movies=movies
    )
    
    # Set as active queue
    await drizzle.set_active_queue(user["id"], playlist.id)
    
    return {
        "playlist": playlist.to_dict(),
        "message": f"Collection playlist created with {len(movies)} movies",
        "active": True
    }

# ==================== DRIZZLE - Queue Management ====================

@api_router.post("/drizzle/queue/set/{playlist_id}")
async def drizzle_set_queue(playlist_id: str, user: dict = Depends(require_auth)):
    """Set a playlist as the active queue."""
    drizzle = get_drizzle_engine()
    playlist = await drizzle.set_active_queue(user["id"], playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"status": "active", "playlist": playlist.to_dict()}

@api_router.get("/drizzle/queue")
async def drizzle_get_queue(user: dict = Depends(require_auth)):
    """Get the current active queue state."""
    drizzle = get_drizzle_engine()
    state = await drizzle.get_queue_state(user["id"])
    if not state:
        return {"active": False, "queue": None}
    return {"active": True, "queue": state}

@api_router.get("/drizzle/queue/next/{current_item_id}")
async def drizzle_get_next(current_item_id: str, user: dict = Depends(require_auth)):
    """Get the next item in the queue."""
    drizzle = get_drizzle_engine()
    next_item = await drizzle.get_next_in_queue(user["id"], current_item_id)
    if not next_item:
        return {"has_next": False, "next": None}
    return {"has_next": True, "next": next_item.to_dict()}

@api_router.post("/drizzle/queue/progress")
async def drizzle_update_progress(
    item_id: str,
    current_time: int,
    watched: bool = False,
    user: dict = Depends(require_auth)
):
    """Update playback progress for an item in the queue."""
    drizzle = get_drizzle_engine()
    await drizzle.update_queue_progress(user["id"], item_id, current_time, watched)
    return {"status": "updated"}

@api_router.delete("/drizzle/queue")
async def drizzle_clear_queue(user: dict = Depends(require_auth)):
    """Clear the active queue."""
    drizzle = get_drizzle_engine()
    drizzle.clear_active_queue(user["id"])
    return {"status": "cleared"}

# ==================== DRIZZLE - Skip Markers ====================

@api_router.get("/drizzle/markers/{media_type}/{tmdb_id}")
async def drizzle_get_markers(
    media_type: str,
    tmdb_id: int,
    user: dict = Depends(require_auth)
):
    """Get skip markers for a media item."""
    drizzle = get_drizzle_engine()
    markers = await drizzle.get_skip_markers(media_type, tmdb_id)
    return {"markers": markers}

@api_router.post("/drizzle/markers")
async def drizzle_set_marker(
    media_type: str,
    tmdb_id: int,
    marker_type: str,
    start_time: int,
    end_time: int,
    auto_skip: bool = True,
    label: str = "",
    user: dict = Depends(require_auth)
):
    """Set a skip marker for a media item."""
    drizzle = get_drizzle_engine()
    marker = await drizzle.set_skip_marker(
        media_type=media_type,
        tmdb_id=tmdb_id,
        marker_type=SkipMarkerType(marker_type),
        start_time=start_time,
        end_time=end_time,
        auto_skip=auto_skip,
        label=label
    )
    return marker

# ==================== SYSTEM MAINTENANCE ====================

import platform
import psutil
import sys

# Server start time for uptime calculation
SERVER_START_TIME = datetime.now(timezone.utc)
APP_VERSION = "2.5.11"

@api_router.get("/system/info")
async def get_system_info():
    """Get comprehensive system information (no auth required for basic info)."""
    return {
        "app_name": "WatchNexus",
        "version": APP_VERSION,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }

@api_router.get("/system/stats")
async def get_system_stats(user: dict = Depends(require_auth)):
    """Get detailed system statistics."""
    try:
        # Calculate uptime
        uptime_seconds = (datetime.now(timezone.utc) - SERVER_START_TIME).total_seconds()
        uptime_str = _format_uptime(uptime_seconds)
        
        # Get system stats
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get Python info
        python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        
        return {
            "app": {
                "name": "WatchNexus",
                "version": APP_VERSION,
                "uptime": uptime_str,
                "uptime_seconds": int(uptime_seconds),
                "started_at": SERVER_START_TIME.isoformat(),
            },
            "system": {
                "platform": platform.system(),
                "platform_release": platform.release(),
                "platform_version": platform.version(),
                "architecture": platform.machine(),
                "hostname": platform.node(),
                "python_version": python_version,
            },
            "resources": {
                "cpu_percent": cpu_percent,
                "cpu_count": psutil.cpu_count(),
                "memory_total_gb": round(memory.total / (1024**3), 2),
                "memory_used_gb": round(memory.used / (1024**3), 2),
                "memory_percent": memory.percent,
                "disk_total_gb": round(disk.total / (1024**3), 2),
                "disk_used_gb": round(disk.used / (1024**3), 2),
                "disk_free_gb": round(disk.free / (1024**3), 2),
                "disk_percent": round((disk.used / disk.total) * 100, 1),
            },
        }
    except Exception as e:
        logger.error(f"Error getting system stats: {e}")
        return {"error": str(e)}

def _format_uptime(seconds: float) -> str:
    """Format uptime seconds into human readable string."""
    days, remainder = divmod(int(seconds), 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, secs = divmod(remainder, 60)
    
    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    else:
        return f"{secs}s"

@api_router.get("/db/stats")
async def get_database_stats(user: dict = Depends(require_auth)):
    """Get database statistics and health info."""
    if db:
        stats = await db.get_stats()
        stats["status"] = "healthy"
        stats["engine"] = "SQLite"
        stats["mode"] = "WAL"
        
        # Add version info
        db_version = await db.get_db_version()
        stats["db_version"] = db_version
        
        # Read current app version
        version_file = ROOT_DIR.parent / "VERSION"
        app_version = version_file.read_text().strip() if version_file.exists() else "2.5.0"
        stats["app_version"] = app_version
        
        # Check for version mismatch (old database with new app)
        if db_version and app_version:
            # Compare major.minor versions
            db_major_minor = '.'.join(db_version.split('.')[:2])
            app_major_minor = '.'.join(app_version.split('.')[:2])
            stats["version_mismatch"] = db_major_minor != app_major_minor
        else:
            stats["version_mismatch"] = db_version is None
        
        return stats
    return {"status": "not_initialized"}

@api_router.get("/db/backups")
async def list_database_backups(user: dict = Depends(require_auth)):
    """List all available database backups."""
    from database import BACKUP_DIR
    backups = []
    if BACKUP_DIR.exists():
        for backup_file in sorted(BACKUP_DIR.glob("watchnexus_*.db"), reverse=True):
            stat = backup_file.stat()
            backups.append({
                "filename": backup_file.name,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })
    return {"backups": backups, "total": len(backups), "max_kept": 7}

@api_router.post("/db/vacuum")
async def vacuum_database(user: dict = Depends(require_auth)):
    """Manually trigger database optimization."""
    if db:
        await db.vacuum_now()
        return {"status": "success", "message": "Database vacuumed and optimized"}
    return {"status": "error", "message": "Database not initialized"}

@api_router.post("/db/backup")
async def create_database_backup(user: dict = Depends(require_auth)):
    """Manually create a database backup."""
    if db:
        db._create_backup()
        return {"status": "success", "message": "Backup created"}
    return {"status": "error", "message": "Database not initialized"}

@api_router.post("/db/reset")
async def reset_database(user: dict = Depends(require_auth)):
    """
    Reset the database to a clean state.
    This will:
    1. Create a backup of the current database
    2. Drop all tables
    3. Recreate the schema
    
    WARNING: This is destructive and cannot be undone!
    """
    global db
    if not db:
        return {"status": "error", "message": "Database not initialized"}
    
    try:
        # Create backup first
        db._create_backup()
        logger.warning("Database reset requested - backup created")
        
        # Drop all data tables (keep schema)
        tables_to_clear = [
            "users", "user_sessions", "watchlist", "watch_progress", "settings",
            "library", "indexers", "streaming_services", "scheduled_scans",
            "scan_notifications", "redownload_requests", "compote_indexers",
            "grab_requests", "subtitle_settings", "streaming_logins", 
            "pending_parties", "playlists", "skip_markers", "quality_profiles",
            "playback_settings", "media"
        ]
        
        for table in tables_to_clear:
            try:
                await db._connection.execute(f"DELETE FROM {table}")
            except Exception as e:
                logger.warning(f"Could not clear table {table}: {e}")
        
        await db._connection.commit()
        
        logger.info("Database reset complete - all tables cleared")
        return {"status": "success", "message": "Database reset complete. All data has been cleared."}
        
    except Exception as e:
        logger.error(f"Error resetting database: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset database: {str(e)}")

@api_router.get("/cache/stats")
async def get_cache_stats(user: dict = Depends(require_auth)):
    """Get TMDB cache statistics."""
    return {
        "tmdb_cache_entries": len(tmdb_cache),
        "cache_ttl_seconds": CACHE_TTL,
    }

@api_router.post("/cache/clear")
async def clear_cache(user: dict = Depends(require_auth)):
    """Clear the TMDB cache."""
    global tmdb_cache
    count = len(tmdb_cache)
    tmdb_cache = {}
    return {"status": "success", "cleared_entries": count}

@api_router.get("/torrent/status")
async def get_torrent_engine_status(user: dict = Depends(require_auth)):
    """Get torrent engine (Fondue) status."""
    try:
        engine = get_fondue_engine()
        if engine:
            return {
                "status": "running",
                "engine": "LTorrent",
                "active_torrents": len(engine.torrents) if hasattr(engine, 'torrents') else 0,
            }
        return {"status": "stopped", "engine": "LTorrent"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@api_router.get("/logs/list")
async def list_log_files(user: dict = Depends(require_auth)):
    """List available log files."""
    logs = []
    if LOG_DIR.exists():
        for log_file in sorted(LOG_DIR.glob("watchnexus.log*"), reverse=True):
            stat = log_file.stat()
            logs.append({
                "filename": log_file.name,
                "size_kb": round(stat.st_size / 1024, 2),
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })
    return {"logs": logs, "log_dir": str(LOG_DIR)}

@api_router.get("/logs/view")
async def view_log_file(
    filename: str = "watchnexus.log",
    lines: int = 200,
    user: dict = Depends(require_auth)
):
    """View last N lines of a log file."""
    log_path = LOG_DIR / filename
    
    # Security: only allow files in log directory
    if not log_path.parent.resolve() == LOG_DIR.resolve():
        raise HTTPException(status_code=400, detail="Invalid log file")
    
    if not log_path.exists():
        return {"lines": [], "total_lines": 0, "filename": filename}
    
    try:
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            all_lines = f.readlines()
            total_lines = len(all_lines)
            last_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            return {
                "lines": [line.rstrip() for line in last_lines],
                "total_lines": total_lines,
                "showing": len(last_lines),
                "filename": filename
            }
    except Exception as e:
        logger.error(f"Error reading log file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/logs/download/{filename}")
async def download_log_file(filename: str, user: dict = Depends(require_auth)):
    """Download a log file."""
    log_path = LOG_DIR / filename
    
    # Security: only allow files in log directory
    if not log_path.parent.resolve() == LOG_DIR.resolve():
        raise HTTPException(status_code=400, detail="Invalid log file")
    
    if not log_path.exists():
        raise HTTPException(status_code=404, detail="Log file not found")
    
    return FileResponse(
        log_path,
        media_type="text/plain",
        filename=filename
    )

@api_router.post("/logs/clear")
async def clear_old_logs(user: dict = Depends(require_auth)):
    """Clear rotated log files (keeps current log)."""
    cleared = 0
    for log_file in LOG_DIR.glob("watchnexus.log.*"):
        try:
            log_file.unlink()
            cleared += 1
        except Exception as e:
            logger.error(f"Failed to delete {log_file}: {e}")
    return {"status": "success", "cleared_files": cleared}


# ==================== ZEST (LOG VIEWER) API ====================
# 🍋 Zest - Adds flavor to debugging

from zest import get_zest_viewer

@api_router.get("/zest/logs")
async def zest_get_logs(
    lines: int = 100,
    level: str = None,
    search: str = None,
    offset: int = 0,
    user: dict = Depends(require_auth)
):
    """
    Get parsed log entries with filtering.
    
    Query params:
    - lines: Max number of entries (default 100)
    - level: Filter by level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    - search: Search text in messages
    - offset: Skip entries for pagination
    """
    zest = get_zest_viewer()
    return zest.get_logs(lines=lines, level=level, search=search, offset=offset)

@api_router.get("/zest/logs/raw")
async def zest_get_raw_logs(
    tail_lines: int = 500,
    user: dict = Depends(require_auth)
):
    """Get raw log file content (last N lines)."""
    zest = get_zest_viewer()
    return PlainTextResponse(zest.get_log_file_raw(tail_lines=tail_lines))

@api_router.get("/zest/stats")
async def zest_get_log_stats(user: dict = Depends(require_auth)):
    """Get log file statistics and level counts."""
    zest = get_zest_viewer()
    return zest.get_log_stats()

@api_router.get("/zest/health")
async def zest_get_system_health(user: dict = Depends(require_auth)):
    """Get system health metrics (CPU, memory, disk, process)."""
    zest = get_zest_viewer()
    return zest.get_system_health()

@api_router.post("/zest/logs/clear")
async def zest_clear_logs(user: dict = Depends(require_auth)):
    """Clear log file (creates backup first)."""
    zest = get_zest_viewer()
    return zest.clear_logs()


# ==================== GARNISH (SUBTITLES) SETTINGS API ====================
# 🌿 Garnish - The finishing touch for subtitles


@api_router.get("/garnish/settings")
async def garnish_get_settings(user: dict = Depends(require_auth)):
    """Get subtitle provider settings."""
    garnish = get_garnish_service()
    return {
        "auto_subtitles": garnish.settings.get("auto_subtitles", True),
        "subtitle_languages": garnish.settings.get("preferred_languages", ["en"]),
        "providers": garnish.settings.get("providers", ["opensubtitles", "addic7ed"]),
        "provider_configs": garnish.settings.get("provider_configs", {})
    }

@api_router.post("/garnish/settings")
async def garnish_save_settings(
    settings: dict,
    user: dict = Depends(require_auth)
):
    """Save subtitle provider settings."""
    garnish = get_garnish_service()
    
    # Update settings
    if "auto_subtitles" in settings:
        garnish.settings["auto_subtitles"] = settings["auto_subtitles"]
    if "subtitle_languages" in settings:
        garnish.settings["preferred_languages"] = settings["subtitle_languages"]
    if "providers" in settings:
        garnish.settings["providers"] = settings["providers"]
    if "provider_configs" in settings:
        garnish.settings["provider_configs"] = settings["provider_configs"]
        
        # Update individual provider credentials
        if "opensubtitles" in settings["provider_configs"]:
            cfg = settings["provider_configs"]["opensubtitles"]
            if cfg.get("api_key"):
                garnish.opensubtitles.api_key = cfg["api_key"]
            if cfg.get("username"):
                garnish.opensubtitles.username = cfg["username"]
        
        if "addic7ed" in settings["provider_configs"]:
            cfg = settings["provider_configs"]["addic7ed"]
            if cfg.get("username"):
                garnish.addic7ed.username = cfg["username"]
            if cfg.get("password"):
                garnish.addic7ed.password = cfg["password"]
    
    return {"status": "success", "message": "Subtitle settings saved"}

@api_router.post("/garnish/test/{provider_id}")
async def garnish_test_provider(
    provider_id: str,
    user: dict = Depends(require_auth)
):
    """Test a subtitle provider connection."""
    garnish = get_garnish_service()
    
    try:
        if provider_id == "opensubtitles":
            # Test OpenSubtitles with a simple search
            results = await garnish.opensubtitles.search("test", languages=["en"])
            return {"success": True, "message": f"Found {len(results)} results", "provider": provider_id}
        
        elif provider_id == "addic7ed":
            # Test Addic7ed with a simple search
            results = await garnish.addic7ed.search_tv_show("test", 1, 1, ["en"])
            return {"success": True, "message": f"Found {len(results)} results", "provider": provider_id}
        
        else:
            # For other providers, return success (placeholder)
            return {"success": True, "message": "Provider configured", "provider": provider_id}
            
    except Exception as e:
        return {"success": False, "error": str(e), "provider": provider_id}


# ==================== RELISH (IPTV) API ====================

from relish import get_relish

@api_router.get("/iptv/sources")
async def list_iptv_sources(user: dict = Depends(require_auth)):
    """List all IPTV sources."""
    relish = get_relish()
    return relish.list_sources()

@api_router.post("/iptv/sources")
async def add_iptv_source(
    name: str,
    url: str,
    epg_url: str = "",
    user: dict = Depends(require_auth)
):
    """Add a new IPTV source (M3U playlist)."""
    relish = get_relish()
    source = await relish.add_source(name, url, epg_url)
    return source.to_dict()

@api_router.delete("/iptv/sources/{source_id}")
async def remove_iptv_source(source_id: str, user: dict = Depends(require_auth)):
    """Remove an IPTV source."""
    relish = get_relish()
    success = relish.remove_source(source_id)
    return {"success": success}

@api_router.post("/iptv/sources/{source_id}/refresh")
async def refresh_iptv_source(source_id: str, user: dict = Depends(require_auth)):
    """Refresh channels from an IPTV source."""
    relish = get_relish()
    success = await relish.refresh_source(source_id)
    return {"success": success}

@api_router.get("/iptv/channels")
async def list_iptv_channels(
    group: str = None,
    favorites_only: bool = False,
    search: str = None,
    user: dict = Depends(require_auth)
):
    """List IPTV channels with filters."""
    relish = get_relish()
    return relish.list_channels(group=group, favorites_only=favorites_only, search=search)

@api_router.get("/iptv/channels/{channel_id}")
async def get_iptv_channel(channel_id: str, user: dict = Depends(require_auth)):
    """Get IPTV channel details."""
    relish = get_relish()
    channel = relish.get_channel(channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channel

@api_router.get("/iptv/groups")
async def get_iptv_groups(user: dict = Depends(require_auth)):
    """Get list of channel groups."""
    relish = get_relish()
    return relish.get_groups()

@api_router.post("/iptv/channels/{channel_id}/favorite")
async def toggle_iptv_favorite(channel_id: str, user: dict = Depends(require_auth)):
    """Toggle favorite status for a channel."""
    relish = get_relish()
    success = relish.toggle_favorite(channel_id)
    return {"success": success}

@api_router.post("/iptv/channels/{channel_id}/hide")
async def toggle_iptv_hidden(channel_id: str, user: dict = Depends(require_auth)):
    """Toggle hidden status for a channel."""
    relish = get_relish()
    success = relish.toggle_hidden(channel_id)
    return {"success": success}

@api_router.get("/iptv/channels/{channel_id}/check")
async def check_iptv_stream(channel_id: str, user: dict = Depends(require_auth)):
    """Check if a stream is accessible."""
    relish = get_relish()
    return await relish.check_stream(channel_id)

@api_router.get("/iptv/epg/{channel_id}")
async def get_iptv_epg(channel_id: str, user: dict = Depends(require_auth)):
    """Get EPG programs for a channel."""
    relish = get_relish()
    return relish.get_programs(channel_id)

@api_router.get("/iptv/epg/{channel_id}/current")
async def get_iptv_current_program(channel_id: str, user: dict = Depends(require_auth)):
    """Get currently playing program."""
    relish = get_relish()
    program = relish.get_current_program(channel_id)
    if not program:
        return {"message": "No current program"}
    return program

@api_router.get("/iptv/stats")
async def get_iptv_stats(user: dict = Depends(require_auth)):
    """Get IPTV statistics."""
    relish = get_relish()
    return relish.get_stats()

@api_router.post("/iptv/parse-m3u")
async def parse_iptv_m3u(content: str, user: dict = Depends(require_auth)):
    """Parse M3U content and return channels (preview without saving)."""
    relish = get_relish()
    channels = await relish.parse_m3u(content)
    return [c.to_dict() for c in channels]

@api_router.get("/iptv/export")
async def export_iptv_m3u(
    favorites_only: bool = False,
    user: dict = Depends(require_auth)
):
    """Export channels as M3U playlist."""
    relish = get_relish()
    channels = relish.list_channels(favorites_only=favorites_only)
    channel_ids = [c["id"] for c in channels]
    m3u_content = relish.export_m3u(channel_ids)
    return {"content": m3u_content, "filename": "watchnexus_iptv.m3u"}


# ==================== PULP (USENET) EXTENDED API ====================

from compote import get_pulp

@api_router.get("/pulp/queue")
async def get_usenet_queue(user: dict = Depends(require_auth)):
    """Get current NZB download queue."""
    pulp = get_pulp()
    return pulp.get_queue()

@api_router.post("/pulp/queue")
async def add_to_usenet_queue(
    nzb_url: str,
    title: str,
    category: str = "",
    user: dict = Depends(require_auth)
):
    """Add NZB to download queue."""
    pulp = get_pulp()
    nzb_id = pulp.queue_nzb(nzb_url, title, category)
    return {"id": nzb_id, "status": "queued"}

@api_router.post("/pulp/search")
async def search_usenet(
    indexer_url: str,
    api_key: str,
    query: str,
    categories: str = "",
    user: dict = Depends(require_auth)
):
    """Search Newznab indexer for NZB releases."""
    pulp = get_pulp()
    cat_list = [int(c) for c in categories.split(",") if c.strip().isdigit()] if categories else None
    results = await pulp.search_newznab(indexer_url, api_key, query, cat_list)
    return results

@api_router.post("/pulp/parse-nzb")
async def parse_nzb_content(content: str, user: dict = Depends(require_auth)):
    """Parse NZB XML content."""
    pulp = get_pulp()
    parsed = pulp.parse_nzb(content)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid NZB content")
    return parsed


# ==================== GADGETS CATALOGUE ====================

from gadgets_catalogue import get_catalogue, get_catalogue_categories, search_catalogue

@api_router.get("/gadgets/catalogue")
async def gadgets_catalogue(user: dict = Depends(require_auth)):
    """Get the full built-in gadgets catalogue."""
    return {
        "items": get_catalogue(),
        "categories": get_catalogue_categories(),
        "total": len(get_catalogue()),
    }

@api_router.get("/gadgets/catalogue/search")
async def gadgets_catalogue_search(
    q: str = "",
    category: str = None,
    plugin_type: str = None,
    user: dict = Depends(require_auth)
):
    """Search the gadgets catalogue."""
    results = search_catalogue(query=q, category=category, plugin_type=plugin_type)
    return {"items": results, "total": len(results)}

@api_router.get("/gadgets/catalogue/categories")
async def gadgets_catalogue_categories(user: dict = Depends(require_auth)):
    """Get catalogue categories with item counts."""
    return get_catalogue_categories()


# ==================== RIPEN - GADGET LIFECYCLE ENGINE ====================

from ripen_lifecycle import get_ripen_engine

@api_router.get("/ripen/installed")
async def ripen_get_installed(user: dict = Depends(require_auth)):
    """Get all installed gadgets with their hooks."""
    engine = get_ripen_engine()
    installed = await engine.get_installed()
    return {"gadgets": installed, "count": len(installed)}

@api_router.get("/ripen/hooks")
async def ripen_get_hooks(user: dict = Depends(require_auth)):
    """Get aggregated UI hooks from all active gadgets."""
    engine = get_ripen_engine()
    return await engine.get_active_hooks()

@api_router.post("/ripen/install/{gadget_id}")
async def ripen_install(gadget_id: str, user: dict = Depends(require_auth)):
    """Install a gadget from the catalogue."""
    engine = get_ripen_engine()
    try:
        result = await engine.install(gadget_id)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.delete("/ripen/uninstall/{gadget_id}")
async def ripen_uninstall(gadget_id: str, user: dict = Depends(require_auth)):
    """Uninstall a gadget."""
    engine = get_ripen_engine()
    removed = await engine.uninstall(gadget_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Gadget not installed")
    return {"success": True, "gadget_id": gadget_id}

@api_router.post("/ripen/activate/{gadget_id}")
async def ripen_activate(gadget_id: str, user: dict = Depends(require_auth)):
    """Activate an installed gadget."""
    engine = get_ripen_engine()
    if not await engine.activate(gadget_id):
        raise HTTPException(status_code=404, detail="Gadget not found")
    return {"success": True, "status": "active"}

@api_router.post("/ripen/deactivate/{gadget_id}")
async def ripen_deactivate(gadget_id: str, user: dict = Depends(require_auth)):
    """Deactivate an installed gadget."""
    engine = get_ripen_engine()
    if not await engine.deactivate(gadget_id):
        raise HTTPException(status_code=404, detail="Gadget not found")
    return {"success": True, "status": "inactive"}

@api_router.put("/ripen/config/{gadget_id}")
async def ripen_update_config(gadget_id: str, config: dict, user: dict = Depends(require_auth)):
    """Update a gadget's configuration."""
    engine = get_ripen_engine()
    if not await engine.update_config(gadget_id, config):
        raise HTTPException(status_code=404, detail="Gadget not found")
    return {"success": True}


# Include router and middleware
app.include_router(api_router)

# Hidden Jellyfin-compatible API layer
# Allows connection from existing Jellyfin/Emby clients
# Connect to: http://server:8096/emby (or your server URL + /emby)
try:
    from jellyfin_compat import jellyfin_router
    app.include_router(jellyfin_router)
    logger.info("Jellyfin-compatible API layer enabled at /emby")
except ImportError as e:
    logger.warning(f"Jellyfin compatibility layer not available: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== DATABASE INITIALIZATION ====================
@app.on_event("startup")
async def startup_db():
    """Initialize SQLite database on startup."""
    global db
    db = await init_database()
    logger.info("SQLite database initialized successfully")
    
    # Initialize Drizzle with database connection
    init_drizzle(db)
    logger.info("Drizzle playlist engine initialized")

# ==================== STATIC FILE SERVING (FOR STANDALONE BUILD) ====================
# Serve frontend build files when running as standalone application
FRONTEND_BUILD_DIR = ROOT_DIR.parent / "frontend"
FRONTEND_BUILD_FALLBACK = ROOT_DIR / "frontend_build"  # Alternative location

# Determine which frontend directory exists
frontend_dir = None
for potential_dir in [FRONTEND_BUILD_DIR, FRONTEND_BUILD_FALLBACK]:
    if potential_dir.exists() and (potential_dir / "index.html").exists():
        frontend_dir = potential_dir
        break

if frontend_dir:
    # Serve static files (JS, CSS, images) from /static
    static_dir = frontend_dir / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    
    # Serve other static assets (favicon, manifest, etc.)
    @app.get("/favicon.ico")
    async def favicon():
        favicon_path = frontend_dir / "favicon.ico"
        if favicon_path.exists():
            return FileResponse(str(favicon_path))
        raise HTTPException(status_code=404)
    
    @app.get("/manifest.json")
    async def manifest():
        manifest_path = frontend_dir / "manifest.json"
        if manifest_path.exists():
            return FileResponse(str(manifest_path), media_type="application/json")
        raise HTTPException(status_code=404)
    
    @app.get("/watchnexus-logo.png")
    async def logo_png():
        logo_path = frontend_dir / "watchnexus-logo.png"
        if logo_path.exists():
            return FileResponse(str(logo_path), media_type="image/png")
        raise HTTPException(status_code=404)
    
    @app.get("/watchnexus-logo.svg")
    async def logo_svg():
        logo_path = frontend_dir / "watchnexus-logo.svg"
        if logo_path.exists():
            return FileResponse(str(logo_path), media_type="image/svg+xml")
        raise HTTPException(status_code=404)
    
    @app.get("/asset-manifest.json")
    async def asset_manifest():
        manifest_path = frontend_dir / "asset-manifest.json"
        if manifest_path.exists():
            return FileResponse(str(manifest_path), media_type="application/json")
        raise HTTPException(status_code=404)
    
    # Serve root path explicitly
    @app.get("/")
    async def serve_root():
        index_path = frontend_dir / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path), media_type="text/html")
        raise HTTPException(status_code=404, detail="Frontend not found")
    
    # Catch-all route: serve index.html for SPA routing
    # This must be LAST to not interfere with API routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't serve index.html for API routes
        if full_path.startswith("api/") or full_path.startswith("emby/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404, detail="Not Found")
        
        # Serve index.html for all other routes (SPA client-side routing)
        index_path = frontend_dir / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path), media_type="text/html")
        raise HTTPException(status_code=404, detail="Frontend not found")
    
    logger.info(f"Frontend static files enabled from: {frontend_dir}")
else:
    logger.warning("No frontend build directory found. Run 'yarn build' in frontend/ to enable static serving.")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Clean shutdown of database and torrent engine."""
    global db
    # Shutdown torrent engine gracefully
    try:
        shutdown_fondue_engine()
    except Exception:
        pass
    # Close SQLite connection
    if db:
        await db.close()


# ==================== STANDALONE STARTUP ====================
if __name__ == "__main__":
    import uvicorn
    import sys
    
    # Get port from environment or default to 8001
    port = int(os.environ.get("PORT", 8001))
    host = os.environ.get("HOST", "0.0.0.0")
    
    logger.info(f"Starting WatchNexus server on {host}:{port}")
    
    # Run uvicorn server
    uvicorn.run(
        "server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
