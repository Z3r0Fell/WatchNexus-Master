from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, Cookie
from fastapi.responses import Response, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    username: str

class UserLogin(BaseModel):
    email: EmailStr
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
    user_id: str
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
        except:
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
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        username=user["username"],
        avatar=user.get("avatar"),
        created_at=user["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

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
async def discover_media(media_type: str, page: int = 1, genre: int = None, sort_by: str = "popularity.desc"):
    params = {"page": page, "sort_by": sort_by}
    if genre:
        params["with_genres"] = genre
    
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

# ==================== DOWNLOADS (MOCK) ====================

mock_downloads = []

@api_router.get("/downloads", response_model=List[DownloadItem])
async def get_downloads():
    return mock_downloads

@api_router.post("/downloads")
async def add_download(title: str, media_type: str, tmdb_id: int = None, size: int = 0):
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
async def update_download(download_id: str, status: str = None, progress: float = None):
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
async def delete_download(download_id: str):
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

from media_health_checker import check_media_health, repair_media_file, scan_library

@api_router.post("/media/health-check")
async def check_file_health(file_path: str, compute_hash: bool = False):
    """Check health of a single media file."""
    return check_media_health(file_path, compute_hash)

@api_router.post("/media/repair")
async def repair_file(file_path: str, output_path: str = None):
    """Attempt to repair a media file."""
    return repair_media_file(file_path, output_path)

@api_router.post("/media/scan-library")
async def scan_media_library(directory: str):
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
    except:
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
        engine = get_torrent_engine()
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
            engine = get_torrent_engine()
            
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

from torrent_engine import get_torrent_engine, shutdown_torrent_engine

@api_router.get("/downloads/engine/status")
async def torrent_engine_status(user: dict = Depends(require_auth)):
    """Get built-in torrent engine status and transfer info."""
    try:
        engine = get_torrent_engine()
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
    engine = get_torrent_engine()
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
    
    engine = get_torrent_engine()
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
    engine = get_torrent_engine()
    settings = engine.get_settings()
    return settings.to_dict()

@api_router.put("/downloads/engine/settings")
async def torrent_engine_update_settings(
    request: Request,
    user: dict = Depends(require_auth)
):
    """Update torrent engine settings."""
    engine = get_torrent_engine()
    
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
    engine = get_torrent_engine()
    count = engine.pause_all()
    return {"status": "paused", "count": count}

@api_router.post("/downloads/engine/resume-all")
async def torrent_engine_resume_all(user: dict = Depends(require_auth)):
    """Resume all torrents."""
    engine = get_torrent_engine()
    count = engine.resume_all()
    return {"status": "resumed", "count": count}

@api_router.post("/downloads/engine/remove-completed")
async def torrent_engine_remove_completed(
    delete_files: bool = False,
    user: dict = Depends(require_auth)
):
    """Remove all completed torrents."""
    engine = get_torrent_engine()
    count = engine.remove_completed(delete_files=delete_files)
    return {"status": "removed", "count": count}

# Torrent-specific routes (dynamic {torrent_id} comes after static routes)
@api_router.get("/downloads/engine/{torrent_id}")
async def torrent_engine_get(torrent_id: str, user: dict = Depends(require_auth)):
    """Get status of a specific torrent."""
    engine = get_torrent_engine()
    status = engine.get_status(torrent_id)
    
    if status:
        return status.to_dict()
    else:
        raise HTTPException(status_code=404, detail="Torrent not found")

@api_router.get("/downloads/engine/{torrent_id}/files")
async def torrent_engine_files(torrent_id: str, user: dict = Depends(require_auth)):
    """Get files in a torrent."""
    engine = get_torrent_engine()
    files = engine.get_files(torrent_id)
    return [f.to_dict() for f in files]

@api_router.post("/downloads/engine/{torrent_id}/pause")
async def torrent_engine_pause(torrent_id: str, user: dict = Depends(require_auth)):
    """Pause a torrent."""
    engine = get_torrent_engine()
    success = engine.pause(torrent_id)
    return {"status": "paused" if success else "failed"}

@api_router.post("/downloads/engine/{torrent_id}/resume")
async def torrent_engine_resume(torrent_id: str, user: dict = Depends(require_auth)):
    """Resume a paused torrent."""
    engine = get_torrent_engine()
    success = engine.resume(torrent_id)
    return {"status": "resumed" if success else "failed"}

@api_router.delete("/downloads/engine/{torrent_id}")
async def torrent_engine_remove(
    torrent_id: str,
    delete_files: bool = False,
    user: dict = Depends(require_auth)
):
    """Remove a torrent."""
    engine = get_torrent_engine()
    success = engine.remove(torrent_id, delete_files=delete_files)
    return {"status": "removed" if success else "failed"}

@api_router.post("/downloads/engine/{torrent_id}/sequential")
async def torrent_engine_sequential(
    torrent_id: str,
    enabled: bool = True,
    user: dict = Depends(require_auth)
):
    """Enable/disable sequential download for streaming."""
    engine = get_torrent_engine()
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
async def marmalade_stream_file(media_id: str, request: Request):
    """Stream a media file (supports range requests)."""
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

# ==================== SUBTITLE SERVICE ====================
from subtitle_service import get_subtitle_service

@api_router.get("/subtitles/search/tv")
async def search_tv_subtitles(
    show_name: str,
    season: int,
    episode: int,
    languages: str = "en",
    user: dict = Depends(require_auth)
):
    """Search for TV show subtitles."""
    service = get_subtitle_service()
    lang_list = [l.strip() for l in languages.split(",")]
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
    service = get_subtitle_service()
    lang_list = [l.strip() for l in languages.split(",")]
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
    service = get_subtitle_service()
    
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
    service = get_subtitle_service()
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
from watch_party import get_party_manager, WatchParty
from fastapi import WebSocket, WebSocketDisconnect

@api_router.get("/watch-party/list")
async def list_watch_parties(user: dict = Depends(require_auth)):
    """List public watch parties."""
    manager = get_party_manager()
    return manager.list_public_parties()

@api_router.post("/watch-party/create")
async def create_watch_party_rest(
    media_id: str,
    media_title: str,
    media_type: str = "movie",
    user: dict = Depends(require_auth)
):
    """Create a watch party (REST endpoint for getting party code before WebSocket)."""
    manager = get_party_manager()
    
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
    manager = get_party_manager()
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
    
    manager = get_party_manager()
    user_id = None
    
    try:
        # First message should be authentication
        auth_msg = await websocket.receive_json()
        
        if auth_msg.get("type") != "auth":
            await websocket.send_json({"type": "error", "message": "Authentication required"})
            await websocket.close()
            return
        
        # Validate token or session
        token = auth_msg.get("token")
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

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    # Shutdown torrent engine gracefully
    try:
        shutdown_torrent_engine()
    except:
        pass
    client.close()
