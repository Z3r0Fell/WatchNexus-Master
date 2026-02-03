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
    user_id: str
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

# ==================== MARMALADE MEDIA SERVER PROXY ====================
# Proxy requests to the local Marmalade media server (based on Jellyfin/Emby protocol)

MARMALADE_URL = os.environ.get("MARMALADE_URL", "http://localhost:8096")

@api_router.api_route("/marmalade/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def marmalade_proxy(path: str, request: Request):
    """Proxy all requests to the Marmalade media server"""
    async with httpx.AsyncClient(timeout=30.0) as http_client:
        # Build the target URL
        url = f"{MARMALADE_URL}/{path}"
        
        # Get query params
        params = dict(request.query_params)
        
        # Get headers (forward auth headers)
        headers = {}
        for key, value in request.headers.items():
            if key.lower() in ['x-emby-authorization', 'x-emby-token', 'authorization', 'content-type']:
                headers[key] = value
        
        # Get body for POST/PUT/PATCH
        body = None
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.json()
            except:
                body = await request.body()
        
        try:
            if request.method == "GET":
                response = await http_client.get(url, params=params, headers=headers)
            elif request.method == "POST":
                response = await http_client.post(url, params=params, headers=headers, json=body if isinstance(body, dict) else None, content=body if isinstance(body, bytes) else None)
            elif request.method == "PUT":
                response = await http_client.put(url, params=params, headers=headers, json=body if isinstance(body, dict) else None)
            elif request.method == "DELETE":
                response = await http_client.delete(url, params=params, headers=headers)
            elif request.method == "PATCH":
                response = await http_client.patch(url, params=params, headers=headers, json=body if isinstance(body, dict) else None)
            
            # Return the response
            content_type = response.headers.get('content-type', 'application/json')
            
            if 'image' in content_type:
                return Response(content=response.content, media_type=content_type)
            elif 'json' in content_type:
                return response.json()
            else:
                return Response(content=response.content, media_type=content_type)
                
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Marmalade server timeout")
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Cannot connect to Marmalade server")
        except Exception as e:
            logger.error(f"Marmalade proxy error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

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
    client.close()
