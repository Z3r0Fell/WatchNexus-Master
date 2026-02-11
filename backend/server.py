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

from compote import get_compote, IndexerConfig, DEFAULT_INDEXERS

@api_router.get("/compote/indexers")
async def compote_list_indexers(user: dict = Depends(require_auth)):
    """List all configured Compote indexers."""
    compote = get_compote()
    indexers = compote.list_indexers()
    
    # If no indexers configured, return defaults
    if not indexers:
        return DEFAULT_INDEXERS
    
    return indexers

@api_router.post("/compote/indexers")
async def compote_add_indexer(
    name: str,
    indexer_type: str,
    url: str,
    api_key: str = "",
    enabled: bool = True,
    priority: int = 50,
    user: dict = Depends(require_auth)
):
    """Add a new indexer to Compote."""
    compote = get_compote()
    
    # Generate ID from name
    indexer_id = name.lower().replace(" ", "_")
    
    config = IndexerConfig(
        id=indexer_id,
        name=name,
        type=indexer_type,
        url=url,
        api_key=api_key,
        enabled=enabled,
        priority=priority,
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
            "user_id": user["id"],
        }},
        upsert=True
    )
    
    return {"status": "added", "id": indexer_id, "name": name}

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

@api_router.post("/compote/grab")
async def compote_grab(
    title: str,
    download_url: str = None,
    magnet_url: str = None,
    size: int = 0,
    user: dict = Depends(require_auth)
):
    """Grab/download a release - sends to qBittorrent if configured."""
    if not download_url and not magnet_url:
        raise HTTPException(status_code=400, detail="Either download_url or magnet_url is required")
    
    # Try to add to qBittorrent
    qbit_success = False
    qbit_message = ""
    
    try:
        from qbittorrent_client import get_qbittorrent_client
        qbit = get_qbittorrent_client()
        
        # Get settings for save path
        settings = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
        save_path = settings.get("download_path", "/media/downloads") if settings else "/media/downloads"
        
        if magnet_url:
            qbit_success = await qbit.add_magnet(magnet_url, save_path=save_path, category="watchnexus")
        elif download_url:
            qbit_success = await qbit.add_torrent(urls=[download_url], save_path=save_path, category="watchnexus")
        
        if qbit_success:
            qbit_message = "Added to qBittorrent"
        else:
            qbit_message = "qBittorrent: Failed to add"
    except Exception as e:
        qbit_message = f"qBittorrent not available: {str(e)}"
        logger.warning(f"qBittorrent grab failed: {e}")
    
    # Always create a download entry for tracking
    download = DownloadItem(
        title=title,
        media_type="movie",
        size=size,
        status="downloading" if qbit_success else "queued",
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
        "status": "grabbed",
        "qbit_success": qbit_success,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.grab_requests.insert_one(grab_request)
    
    return {
        "status": "grabbed" if qbit_success else "queued",
        "download_id": download.id,
        "message": f"Added '{title}' to download queue. {qbit_message}",
        "qbittorrent": qbit_success
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
    # Shutdown torrent engine gracefully
    try:
        shutdown_torrent_engine()
    except:
        pass
    client.close()
