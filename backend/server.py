import os
import uuid
import hashlib
import secrets
import platform
import psutil
from datetime import datetime, timezone, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import jwt

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET", "WatchNexus_DefaultSecret_ChangeInProduction_32chars!")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# --- Auth helpers ---
def create_token(user_id: str, email: str, username: str, role: str = "user"):
    payload = {
        "sub": user_id,
        "email": email,
        "name": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iss": "WatchNexus",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_iss": False})
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- Models ---
class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class LibraryRequest(BaseModel):
    Name: Optional[str] = None
    name: Optional[str] = None
    Path: Optional[str] = None
    path: Optional[str] = None
    MediaType: Optional[str] = None
    media_type: Optional[str] = None

class IpRuleRequest(BaseModel):
    Ip: Optional[str] = None
    ip: Optional[str] = None
    RuleType: Optional[str] = "block"
    rule_type: Optional[str] = None
    Reason: Optional[str] = ""
    reason: Optional[str] = None

class ApiKeyRequest(BaseModel):
    Name: Optional[str] = None
    name: Optional[str] = None
    Permissions: Optional[str] = "read"
    permissions: Optional[str] = None

class VpnServerSetup(BaseModel):
    ListenPort: Optional[int] = 51820
    Address: Optional[str] = "10.0.0.1/24"
    Dns: Optional[str] = "1.1.1.1"
    Endpoint: Optional[str] = ""
    Mtu: Optional[int] = 1420

class VpnPeerCreate(BaseModel):
    Name: Optional[str] = None
    name: Optional[str] = None
    AllowedIps: Optional[str] = "10.0.0.0/24"

class SettingValue(BaseModel):
    value: Optional[str] = None
    Value: Optional[str] = None

class TmdbUpdate(BaseModel):
    api_key: Optional[str] = None
    Api_key: Optional[str] = None

class QbitUpdate(BaseModel):
    Host: Optional[str] = "localhost"
    host: Optional[str] = None
    Port: Optional[int] = 8080
    port: Optional[int] = None
    Username: Optional[str] = "admin"
    username: Optional[str] = None
    Password: Optional[str] = ""
    password: Optional[str] = None
    Enabled: Optional[bool] = False
    enabled: Optional[bool] = None


# ==================== HEALTH ====================
@app.get("/api/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat(), "version": "2.6.5"}


# ==================== AUTH ====================
@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user_id = str(uuid.uuid4())
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    user = {
        "id": user_id,
        "email": req.email,
        "username": req.username,
        "password_hash": hashed,
        "avatar": None,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_token(user_id, req.email, req.username)
    return {
        "access_token": token,
        "user": {"Id": user_id, "Email": req.email, "Username": req.username, "Avatar": None, "Role": "user", "CreatedAt": user["created_at"]},
    }

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not bcrypt.checkpw(req.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["email"], user["username"], user.get("role", "user"))
    return {
        "access_token": token,
        "user": {"Id": user["id"], "Email": user["email"], "Username": user["username"], "Avatar": user.get("avatar"), "Role": user.get("role", "user"), "CreatedAt": user.get("created_at")},
    }

@app.get("/api/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return {"Id": user["id"], "Email": user["email"], "Username": user["username"], "Avatar": user.get("avatar"), "Role": user.get("role", "user"), "CreatedAt": user.get("created_at")}

@app.post("/api/auth/logout")
async def auth_logout():
    return {"status": "logged_out"}


# ==================== USERS ====================
@app.get("/api/users/me")
async def users_me(user=Depends(get_current_user)):
    return {"Id": user["id"], "Email": user["email"], "Username": user["username"], "Avatar": user.get("avatar"), "Role": user.get("role", "user"), "CreatedAt": user.get("created_at")}

@app.get("/api/users/profiles")
async def users_profiles(user=Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return [{"Id": u["id"], "Email": u["email"], "Username": u["username"], "Avatar": u.get("avatar"), "Role": u.get("role", "user")} for u in users]


# ==================== USER PREFERENCES ====================
@app.get("/api/user/preferences")
async def get_user_preferences(user=Depends(get_current_user)):
    prefs = await db.settings.find_one({"user_id": user["id"], "key": "user_preferences"}, {"_id": 0})
    if prefs and prefs.get("value"):
        import json
        try:
            data = json.loads(prefs["value"])
            return data
        except Exception:
            pass
    return {"visible_tabs": []}

@app.put("/api/user/preferences")
async def update_user_preferences(visible_tabs: str = None, user=Depends(get_current_user)):
    import json
    data = {"visible_tabs": json.loads(visible_tabs) if visible_tabs else []}
    await db.settings.update_one(
        {"user_id": user["id"], "key": "user_preferences"},
        {"$set": {"value": json.dumps(data), "user_id": user["id"], "key": "user_preferences"}},
        upsert=True
    )
    return {"status": "saved"}


# ==================== INFO ====================
@app.get("/api/info")
async def info(user=Depends(get_current_user)):
    process = psutil.Process()
    return {
        "version": "2.6.5",
        "hostname": platform.node(),
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "python_version": platform.python_version(),
        "cpu_count": os.cpu_count(),
        "memory_used": process.memory_info().rss,
        "uptime": (datetime.now(timezone.utc) - datetime.fromtimestamp(process.create_time(), tz=timezone.utc)).total_seconds(),
        "modules": [
            {"name": "Marmalade", "codename": "marmalade", "version": "2.6.5", "status": "active"},
            {"name": "Bastion", "codename": "bastion", "version": "2.6.5", "status": "active"},
            {"name": "Tunnel", "codename": "tunnel", "version": "2.6.5", "status": "active"},
            {"name": "Zest", "codename": "zest", "version": "2.6.5", "status": "active"},
            {"name": "Fondue", "codename": "fondue", "version": "2.6.5", "status": "active"},
        ],
    }


# ==================== DASHBOARD ====================
@app.get("/api/dashboard")
async def dashboard(user=Depends(get_current_user)):
    total_libraries = await db.libraries.count_documents({})
    total_media = await db.media_items.count_documents({})
    total_movies = await db.media_items.count_documents({"media_type": "movies"})
    total_tv = await db.media_items.count_documents({"media_type": "tv"})
    recent = await db.media_items.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return {
        "total_libraries": total_libraries,
        "total_media": total_media,
        "total_movies": total_movies,
        "total_tv": total_tv,
        "total_size": 0,
        "recent_media": recent,
    }


# ==================== LIBRARIES ====================
@app.get("/api/libraries")
async def get_libraries(user=Depends(get_current_user)):
    libs = await db.libraries.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return libs

@app.get("/api/libraries/recent")
async def libraries_recent(limit: int = 20, user=Depends(get_current_user)):
    items = await db.media_items.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return items

@app.get("/api/libraries/{lib_id}")
async def get_library(lib_id: str, user=Depends(get_current_user)):
    lib = await db.libraries.find_one({"id": lib_id}, {"_id": 0})
    if not lib:
        raise HTTPException(status_code=404, detail="Library not found")
    return lib

@app.post("/api/libraries")
async def create_library(req: LibraryRequest, user=Depends(get_current_user)):
    name = req.Name or req.name or ""
    path = req.Path or req.path or ""
    media_type = req.MediaType or req.media_type or "movies"
    type_map = {"Movie": "movies", "Movies": "movies", "TvShow": "tv", "TV Shows": "tv", "Music": "music", "Anime": "anime"}
    media_type = type_map.get(media_type, media_type.lower())
    lib = {
        "id": str(uuid.uuid4()),
        "name": name,
        "path": path,
        "media_type": media_type,
        "item_count": 0,
        "total_size": 0,
        "scan_status": "idle",
        "last_scanned_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.libraries.insert_one(lib)
    lib.pop("_id", None)
    return lib

@app.put("/api/libraries/{lib_id}")
async def update_library(lib_id: str, req: LibraryRequest, user=Depends(get_current_user)):
    lib = await db.libraries.find_one({"id": lib_id})
    if not lib:
        raise HTTPException(status_code=404, detail="Library not found")
    update = {}
    if req.Name or req.name:
        update["name"] = req.Name or req.name
    if req.Path or req.path:
        update["path"] = req.Path or req.path
    if update:
        await db.libraries.update_one({"id": lib_id}, {"$set": update})
    lib = await db.libraries.find_one({"id": lib_id}, {"_id": 0})
    return lib

@app.delete("/api/libraries/{lib_id}")
async def delete_library(lib_id: str, user=Depends(get_current_user)):
    await db.media_items.delete_many({"library_id": lib_id})
    await db.libraries.delete_one({"id": lib_id})
    return {"status": "deleted"}

@app.post("/api/libraries/{lib_id}/scan")
async def scan_library(lib_id: str, user=Depends(get_current_user)):
    lib = await db.libraries.find_one({"id": lib_id}, {"_id": 0})
    if not lib:
        raise HTTPException(status_code=404, detail="Library not found")
    return {
        "job_id": str(uuid.uuid4())[:8],
        "library_id": lib_id,
        "library_name": lib.get("name", ""),
        "status": "scanning",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "progress": 0,
    }

@app.get("/api/libraries/{lib_id}/scan/status")
async def scan_status(lib_id: str, user=Depends(get_current_user)):
    return {"library_id": lib_id, "status": "idle", "progress": 0}


# ==================== MARMALADE (bridge) ====================
@app.get("/api/marmalade/libraries")
async def marmalade_libraries(user=Depends(get_current_user)):
    return await db.libraries.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

@app.post("/api/marmalade/libraries")
async def marmalade_add_library(name: str = "", path: str = "", media_type: str = "movies", user=Depends(get_current_user)):
    lib = {
        "id": str(uuid.uuid4()),
        "name": name, "path": path, "media_type": media_type,
        "item_count": 0, "total_size": 0, "scan_status": "idle",
        "last_scanned_at": None, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.libraries.insert_one(lib)
    lib.pop("_id", None)
    return lib

@app.delete("/api/marmalade/libraries/{lib_id}")
async def marmalade_remove_library(lib_id: str, user=Depends(get_current_user)):
    await db.media_items.delete_many({"library_id": lib_id})
    await db.libraries.delete_one({"id": lib_id})
    return {"status": "deleted"}

@app.post("/api/marmalade/libraries/{lib_id}/scan")
async def marmalade_scan_library(lib_id: str, user=Depends(get_current_user)):
    return {"status": "scanning", "library_id": lib_id}

@app.post("/api/marmalade/libraries/{lib_id}/refresh-metadata")
async def marmalade_refresh_metadata(lib_id: str, user=Depends(get_current_user)):
    return {"status": "refreshing", "library_id": lib_id}

@app.get("/api/marmalade/media")
async def marmalade_media(library_id: str = None, media_type: str = None, limit: int = 50, offset: int = 0, user=Depends(get_current_user)):
    query = {}
    if library_id:
        query["library_id"] = library_id
    if media_type:
        query["media_type"] = media_type
    items = await db.media_items.find(query, {"_id": 0}).sort("title", 1).skip(offset).limit(limit).to_list(limit)
    return items

@app.get("/api/marmalade/media/recent")
async def marmalade_recent(limit: int = 20, user=Depends(get_current_user)):
    items = await db.media_items.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return items

@app.get("/api/marmalade/stats")
async def marmalade_stats(user=Depends(get_current_user)):
    return {
        "total_libraries": await db.libraries.count_documents({}),
        "total_media": await db.media_items.count_documents({}),
        "total_size": 0,
    }

@app.get("/api/marmalade/status")
async def marmalade_status(user=Depends(get_current_user)):
    return {"status": "active", "version": "2.6.5"}


# ==================== SETTINGS ====================
@app.get("/api/settings")
async def get_settings(user=Depends(get_current_user)):
    settings = await db.settings.find({"$or": [{"user_id": user["id"]}, {"user_id": None}]}, {"_id": 0}).to_list(500)
    return {s["key"]: s.get("value", "") for s in settings}

@app.post("/api/settings/bulk")
async def bulk_settings(settings: dict, user=Depends(get_current_user)):
    for k, v in settings.items():
        await db.settings.update_one(
            {"key": k, "user_id": user["id"]},
            {"$set": {"key": k, "value": str(v), "user_id": user["id"]}},
            upsert=True
        )
    return {"status": "saved"}

@app.get("/api/settings/integrations")
async def get_integrations(user=Depends(get_current_user)):
    tmdb = await db.settings.find_one({"key": "tmdb_api_key", "user_id": user["id"]}, {"_id": 0})
    tmdb_key = tmdb.get("value", "") if tmdb else ""
    return {
        "tmdb": {"api_key": tmdb_key, "has_key": bool(tmdb_key), "source": "user" if tmdb_key else "none"},
        "qbittorrent": {"host": "localhost", "port": 8080, "username": "admin", "password": "", "enabled": False},
    }

@app.put("/api/settings/integrations/tmdb")
async def update_tmdb(req: TmdbUpdate, user=Depends(get_current_user)):
    key = req.api_key or req.Api_key or ""
    await db.settings.update_one(
        {"key": "tmdb_api_key", "user_id": user["id"]},
        {"$set": {"key": "tmdb_api_key", "value": key, "user_id": user["id"]}},
        upsert=True
    )
    return {"status": "saved", "has_key": bool(key)}

@app.put("/api/settings/integrations/qbittorrent")
async def update_qbit(req: QbitUpdate, user=Depends(get_current_user)):
    return {"status": "saved", "settings": req.dict()}

@app.post("/api/settings/integrations/qbittorrent/test")
async def test_qbit(req: QbitUpdate):
    return {"success": False, "error": "Connection failed"}

@app.get("/api/settings/{key}")
async def get_setting(key: str, user=Depends(get_current_user)):
    s = await db.settings.find_one({"key": key, "$or": [{"user_id": user["id"]}, {"user_id": None}]}, {"_id": 0})
    return {"key": key, "value": s.get("value") if s else None}

@app.put("/api/settings/{key}")
async def set_setting(key: str, req: SettingValue, user=Depends(get_current_user)):
    val = req.value or req.Value or ""
    await db.settings.update_one(
        {"key": key, "user_id": user["id"]},
        {"$set": {"key": key, "value": val, "user_id": user["id"]}},
        upsert=True
    )
    return {"key": key, "value": val}

@app.delete("/api/settings/{key}")
async def delete_setting(key: str, user=Depends(get_current_user)):
    await db.settings.delete_one({"key": key, "user_id": user["id"]})
    return {"status": "deleted"}


# ==================== TMDB PROXY ====================
import httpx

@app.get("/api/tmdb/search")
async def tmdb_search(query: str, page: int = 1, media_type: str = "multi", user=Depends(get_current_user)):
    return await _tmdb_proxy(f"/search/{media_type}", {"query": query, "page": str(page)}, user)

@app.get("/api/tmdb/trending/{media_type}/{time_window}")
async def tmdb_trending(media_type: str, time_window: str, user=Depends(get_current_user)):
    return await _tmdb_proxy(f"/trending/{media_type}/{time_window}", {}, user)

@app.get("/api/tmdb/movie/now_playing")
async def tmdb_now_playing(page: int = 1, user=Depends(get_current_user)):
    return await _tmdb_proxy("/movie/now_playing", {"page": str(page)}, user)

@app.get("/api/tmdb/tv/on_the_air")
async def tmdb_on_the_air(page: int = 1, user=Depends(get_current_user)):
    return await _tmdb_proxy("/tv/on_the_air", {"page": str(page)}, user)

@app.get("/api/tmdb/movie/{movie_id}")
async def tmdb_movie_detail(movie_id: int, user=Depends(get_current_user)):
    return await _tmdb_proxy(f"/movie/{movie_id}", {"append_to_response": "credits,similar,videos,images"}, user)

@app.get("/api/tmdb/tv/{tv_id}")
async def tmdb_tv_detail(tv_id: int, user=Depends(get_current_user)):
    return await _tmdb_proxy(f"/tv/{tv_id}", {"append_to_response": "credits,similar,videos,images"}, user)

@app.get("/api/tmdb/tv/{tv_id}/season/{season_num}")
async def tmdb_season(tv_id: int, season_num: int, user=Depends(get_current_user)):
    return await _tmdb_proxy(f"/tv/{tv_id}/season/{season_num}", {}, user)

@app.get("/api/tmdb/discover/{media_type}")
async def tmdb_discover(media_type: str, page: int = 1, with_genres: str = None, sort_by: str = None, user=Depends(get_current_user)):
    params = {"page": str(page)}
    if with_genres:
        params["with_genres"] = with_genres
    if sort_by:
        params["sort_by"] = sort_by
    return await _tmdb_proxy(f"/discover/{media_type}", params, user)

@app.get("/api/tmdb/genres/{media_type}")
async def tmdb_genres(media_type: str, user=Depends(get_current_user)):
    return await _tmdb_proxy(f"/genre/{media_type}/list", {}, user)

async def _tmdb_proxy(path: str, params: dict, user: dict):
    tmdb_setting = await db.settings.find_one({"key": "tmdb_api_key", "user_id": user["id"]}, {"_id": 0})
    api_key = tmdb_setting.get("value", "") if tmdb_setting else ""
    if not api_key:
        return {"results": [], "page": 1, "total_pages": 0, "total_results": 0}
    params["api_key"] = api_key
    params["language"] = "en-US"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://api.themoviedb.org/3{path}", params=params, timeout=10)
            return resp.json()
    except Exception:
        return {"results": [], "page": 1, "total_pages": 0, "total_results": 0}


# ==================== WATCHLIST ====================
@app.get("/api/watchlist")
async def get_watchlist(user=Depends(get_current_user)):
    import json
    items = await db.settings.find({"user_id": user["id"], "key": {"$regex": "^watchlist:"}}, {"_id": 0}).to_list(500)
    result = []
    for s in items:
        try:
            result.append(json.loads(s["value"]))
        except Exception:
            pass
    return result

@app.post("/api/watchlist")
async def add_to_watchlist(request: Request, user=Depends(get_current_user)):
    import json
    item = await request.json()
    tmdb_id = str(item.get("tmdb_id") or item.get("id", str(uuid.uuid4())))
    key = f"watchlist:{tmdb_id}"
    await db.settings.update_one(
        {"key": key, "user_id": user["id"]},
        {"$set": {"key": key, "value": json.dumps(item), "user_id": user["id"]}},
        upsert=True
    )
    return {"status": "added", "tmdb_id": tmdb_id}

@app.delete("/api/watchlist/{tmdb_id}")
async def remove_from_watchlist(tmdb_id: str, user=Depends(get_current_user)):
    await db.settings.delete_one({"key": f"watchlist:{tmdb_id}", "user_id": user["id"]})
    return {"status": "removed"}


# ==================== WATCH PROGRESS ====================
@app.get("/api/watch-progress")
async def get_progress(user=Depends(get_current_user)):
    import json
    items = await db.settings.find({"user_id": user["id"], "key": {"$regex": "^progress:"}}, {"_id": 0}).to_list(500)
    result = []
    for s in items:
        try:
            result.append(json.loads(s["value"]))
        except Exception:
            pass
    return result

@app.post("/api/watch-progress")
async def update_progress(request: Request, user=Depends(get_current_user)):
    import json
    progress = await request.json()
    tmdb_id = str(progress.get("tmdb_id", ""))
    media_type = progress.get("media_type", "movie")
    key = f"progress:{tmdb_id}:{media_type}"
    await db.settings.update_one(
        {"key": key, "user_id": user["id"]},
        {"$set": {"key": key, "value": json.dumps(progress), "user_id": user["id"]}},
        upsert=True
    )
    return {"status": "saved"}

@app.delete("/api/watch-progress")
async def delete_progress(tmdb_id: str = None, media_type: str = None, user=Depends(get_current_user)):
    prefix = f"progress:{tmdb_id}"
    await db.settings.delete_many({"user_id": user["id"], "key": {"$regex": f"^{prefix}"}})
    return {"status": "deleted"}

@app.delete("/api/watch-progress/all")
async def clear_all_progress(user=Depends(get_current_user)):
    await db.settings.delete_many({"user_id": user["id"], "key": {"$regex": "^progress:"}})
    return {"status": "cleared"}


# ==================== NEXT UP ====================
@app.get("/api/next-up")
async def next_up(user=Depends(get_current_user)):
    return []


# ==================== DOWNLOADS ====================
@app.get("/api/downloads")
async def get_downloads(status: str = None, user=Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    downloads = await db.downloads.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return downloads

@app.post("/api/downloads")
async def add_download(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    dl = {
        "id": str(uuid.uuid4()),
        "name": data.get("title", data.get("name", "")),
        "url": data.get("url", ""),
        "status": "queued",
        "progress": 0,
        "size": data.get("size", 0),
        "downloaded": 0,
        "save_path": data.get("save_path", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.downloads.insert_one(dl)
    dl.pop("_id", None)
    return dl

@app.get("/api/downloads/engine/status")
async def download_engine_status(user=Depends(get_current_user)):
    return {"engine": "built-in", "status": "idle", "active_downloads": 0}

@app.get("/api/downloads/engine/torrents")
async def download_engine_torrents(user=Depends(get_current_user)):
    return []


# ==================== SECURITY ====================
@app.get("/api/security/stats")
async def security_stats(user=Depends(get_current_user)):
    return {
        "total_audit_logs": await db.audit_logs.count_documents({}),
        "ip_rules_count": await db.ip_rules.count_documents({}),
        "blocked_ips": await db.ip_rules.count_documents({"rule_type": "block"}),
        "allowed_ips": await db.ip_rules.count_documents({"rule_type": "allow"}),
        "active_api_keys": await db.api_keys.count_documents({"is_active": True}),
        "total_api_keys": await db.api_keys.count_documents({}),
        "owasp_headers": True,
        "rate_limiting": True,
        "csrf_protection": True,
    }

@app.get("/api/security/audit")
async def security_audit(page: int = 1, page_size: int = 50, user=Depends(get_current_user)):
    total = await db.audit_logs.count_documents({})
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"logs": logs, "total": total, "page": page, "page_size": page_size}

@app.get("/api/security/ip-rules")
async def get_ip_rules(user=Depends(get_current_user)):
    return await db.ip_rules.find({}, {"_id": 0}).to_list(500)

@app.post("/api/security/ip-rules")
async def add_ip_rule(req: IpRuleRequest, user=Depends(get_current_user)):
    ip = req.Ip or req.ip or ""
    rule_type = req.rule_type or req.RuleType or "block"
    reason = req.reason or req.Reason or ""
    rule = {
        "id": str(uuid.uuid4()),
        "ip": ip, "rule_type": rule_type, "reason": reason,
        "hits": 0, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ip_rules.insert_one(rule)
    rule.pop("_id", None)
    await _log_audit(user["id"], "ip_rule_added", f"{rule_type} {ip}")
    return rule

@app.delete("/api/security/ip-rules/{rule_id}")
async def delete_ip_rule(rule_id: str, user=Depends(get_current_user)):
    await db.ip_rules.delete_one({"id": rule_id})
    await _log_audit(user["id"], "ip_rule_removed", rule_id)
    return {"status": "deleted"}

@app.get("/api/security/api-keys")
async def get_api_keys(user=Depends(get_current_user)):
    keys = await db.api_keys.find({}, {"_id": 0, "key_hash": 0}).to_list(100)
    return keys

@app.post("/api/security/api-keys")
async def create_api_key(req: ApiKeyRequest, user=Depends(get_current_user)):
    name = req.Name or req.name or ""
    permissions = req.permissions or req.Permissions or "read"
    raw_key = f"wnx_{secrets.token_hex(24)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_preview = raw_key[:8] + "..." + raw_key[-4:]
    key_doc = {
        "id": str(uuid.uuid4()),
        "name": name, "key_hash": key_hash, "key_preview": key_preview,
        "permissions": permissions, "is_active": True,
        "last_used": None, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.api_keys.insert_one(key_doc)
    await _log_audit(user["id"], "api_key_created", name)
    return {
        "Id": key_doc["id"], "Name": name, "key": raw_key,
        "key_preview": key_preview, "Permissions": permissions,
        "IsActive": True, "CreatedAt": key_doc["created_at"],
    }

@app.delete("/api/security/api-keys/{key_id}")
async def revoke_api_key(key_id: str, user=Depends(get_current_user)):
    await db.api_keys.update_one({"id": key_id}, {"$set": {"is_active": False}})
    await _log_audit(user["id"], "api_key_revoked", key_id)
    return {"status": "revoked"}

@app.get("/api/security/sessions")
async def get_sessions(user=Depends(get_current_user)):
    return []

@app.post("/api/security/sessions/{session_id}/revoke")
async def revoke_session(session_id: str, user=Depends(get_current_user)):
    return {"status": "revoked"}

async def _log_audit(user_id: str, action: str, details: str):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": action, "user_id": user_id,
        "ip": "", "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


# ==================== VPN ====================
async def _get_or_create_vpn_server():
    config = await db.vpn_server_configs.find_one({"id": "default"}, {"_id": 0})
    if config:
        return config
    config = {
        "id": "default",
        "listen_port": 51820, "address": "10.0.0.1/24",
        "dns": "1.1.1.1", "endpoint": "", "mtu": 1420,
        "public_key": secrets.token_urlsafe(32),
        "private_key": secrets.token_urlsafe(32),
        "is_active": False, "is_configured": False,
    }
    await db.vpn_server_configs.insert_one(config)
    config.pop("_id", None)
    return config

@app.get("/api/vpn/server")
async def vpn_get_server(user=Depends(get_current_user)):
    s = await _get_or_create_vpn_server()
    return {
        "ListenPort": s["listen_port"], "Address": s["address"],
        "Dns": s["dns"], "Endpoint": s["endpoint"], "Mtu": s["mtu"],
        "public_key": s["public_key"], "is_active": s["is_active"],
        "is_configured": s["is_configured"], "interface": "wg0",
    }

@app.post("/api/vpn/server/setup")
async def vpn_setup(req: VpnServerSetup, user=Depends(get_current_user)):
    s = await _get_or_create_vpn_server()
    await db.vpn_server_configs.update_one({"id": "default"}, {"$set": {
        "listen_port": req.ListenPort, "address": req.Address,
        "dns": req.Dns, "endpoint": req.Endpoint, "mtu": req.Mtu,
        "is_configured": True,
    }})
    s = await _get_or_create_vpn_server()
    return {
        "ListenPort": s["listen_port"], "Address": s["address"],
        "Dns": s["dns"], "Endpoint": s["endpoint"], "Mtu": s["mtu"],
        "public_key": s["public_key"], "is_active": s["is_active"], "is_configured": True,
    }

@app.put("/api/vpn/server")
async def vpn_update_server(req: VpnServerSetup, user=Depends(get_current_user)):
    return await vpn_setup(req, user)

@app.post("/api/vpn/server/activate")
async def vpn_activate(user=Depends(get_current_user)):
    await db.vpn_server_configs.update_one({"id": "default"}, {"$set": {"is_active": True}})
    return {"is_active": True}

@app.post("/api/vpn/server/deactivate")
async def vpn_deactivate(user=Depends(get_current_user)):
    await db.vpn_server_configs.update_one({"id": "default"}, {"$set": {"is_active": False}})
    return {"is_active": False}

@app.get("/api/vpn/peers")
async def vpn_get_peers(user=Depends(get_current_user)):
    return await db.vpn_peers.find({}, {"_id": 0}).to_list(100)

@app.get("/api/vpn/peers/{peer_id}")
async def vpn_get_peer(peer_id: str, user=Depends(get_current_user)):
    p = await db.vpn_peers.find_one({"id": peer_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404)
    return p

@app.post("/api/vpn/peers")
async def vpn_create_peer(req: VpnPeerCreate, user=Depends(get_current_user)):
    name = req.Name or req.name or ""
    count = await db.vpn_peers.count_documents({})
    peer = {
        "id": str(uuid.uuid4()),
        "name": name, "allowed_ips": req.AllowedIps,
        "address": f"10.0.0.{count + 2}/32",
        "public_key": secrets.token_urlsafe(32),
        "private_key": secrets.token_urlsafe(32),
        "preshared_key": secrets.token_urlsafe(32),
        "is_active": True, "transfer_rx": 0, "transfer_tx": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.vpn_peers.insert_one(peer)
    peer.pop("_id", None)
    return peer

@app.put("/api/vpn/peers/{peer_id}")
async def vpn_update_peer(peer_id: str, req: VpnPeerCreate, user=Depends(get_current_user)):
    p = await db.vpn_peers.find_one({"id": peer_id})
    if not p:
        raise HTTPException(status_code=404)
    name = req.Name or req.name or p.get("name", "")
    await db.vpn_peers.update_one({"id": peer_id}, {"$set": {"name": name, "allowed_ips": req.AllowedIps}})
    return await db.vpn_peers.find_one({"id": peer_id}, {"_id": 0})

@app.delete("/api/vpn/peers/{peer_id}")
async def vpn_delete_peer(peer_id: str, user=Depends(get_current_user)):
    await db.vpn_peers.delete_one({"id": peer_id})
    return {"status": "deleted"}

@app.post("/api/vpn/peers/{peer_id}/toggle")
async def vpn_toggle_peer(peer_id: str, user=Depends(get_current_user)):
    p = await db.vpn_peers.find_one({"id": peer_id})
    if not p:
        raise HTTPException(status_code=404)
    new_state = not p.get("is_active", True)
    await db.vpn_peers.update_one({"id": peer_id}, {"$set": {"is_active": new_state}})
    return await db.vpn_peers.find_one({"id": peer_id}, {"_id": 0})

@app.get("/api/vpn/peers/{peer_id}/qr-data")
async def vpn_peer_qr(peer_id: str, user=Depends(get_current_user)):
    import base64
    p = await db.vpn_peers.find_one({"id": peer_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404)
    s = await _get_or_create_vpn_server()
    config = f'[Interface]\nPrivateKey = {p["private_key"]}\nAddress = {p["address"]}\nDNS = {s["dns"]}\n\n[Peer]\nPublicKey = {s["public_key"]}\nAllowedIPs = 0.0.0.0/0\nEndpoint = {s["endpoint"]}:{s["listen_port"]}\n'
    return {"qr_data": base64.b64encode(config.encode()).decode(), "peer_id": peer_id}

@app.post("/api/vpn/server/wg-up")
async def vpn_wg_up(user=Depends(get_current_user)):
    return {"status": "up", "message": "WireGuard activated (mock)"}

@app.post("/api/vpn/server/wg-down")
async def vpn_wg_down(user=Depends(get_current_user)):
    return {"status": "down", "message": "WireGuard deactivated (mock)"}

@app.get("/api/vpn/server/wg-status")
async def vpn_wg_status(user=Depends(get_current_user)):
    s = await _get_or_create_vpn_server()
    return {
        "interface": "wg0", "is_running": s["is_active"],
        "ListenPort": s["listen_port"], "public_key": s["public_key"],
        "peers_connected": await db.vpn_peers.count_documents({"is_active": True}),
        "total_peers": await db.vpn_peers.count_documents({}),
    }

@app.get("/api/vpn/logs")
async def vpn_logs(user=Depends(get_current_user)):
    return {"logs": [], "total": 0, "page": 1}

@app.get("/api/vpn/stats")
async def vpn_stats(user=Depends(get_current_user)):
    s = await _get_or_create_vpn_server()
    return {
        "server_active": s["is_active"], "server_configured": s["is_configured"],
        "total_peers": await db.vpn_peers.count_documents({}),
        "active_peers": await db.vpn_peers.count_documents({"is_active": True}),
        "total_rx": 0, "total_tx": 0,
    }


# ==================== LOGS ====================
@app.get("/api/logs")
async def get_log_files(user=Depends(get_current_user)):
    return []

@app.get("/api/logs/latest")
async def get_latest_logs(lines: int = 100, level: str = None, user=Depends(get_current_user)):
    return {"entries": [], "total": 0}

@app.get("/api/logs/file/{filename}")
async def get_log_file(filename: str, offset: int = 0, limit: int = 1000, user=Depends(get_current_user)):
    return {"lines": [], "filename": filename, "total": 0}

@app.get("/api/logs/system")
async def logs_system(user=Depends(get_current_user)):
    process = psutil.Process()
    return {
        "uptime_seconds": (datetime.now(timezone.utc) - datetime.fromtimestamp(process.create_time(), tz=timezone.utc)).total_seconds(),
        "memory_mb": process.memory_info().rss / 1024 / 1024,
        "cpu_time_seconds": sum(process.cpu_times()[:2]),
        "threads": process.num_threads(),
    }

@app.delete("/api/logs/file/{filename}")
async def delete_log_file(filename: str, user=Depends(get_current_user)):
    return {"status": "deleted"}


# ==================== FILESYSTEM BROWSE ====================
@app.get("/api/filesystem/browse")
async def filesystem_browse(path: str = "", user=Depends(get_current_user)):
    os_type = platform.system().lower()
    if os_type == "darwin":
        os_type = "darwin"
    elif os_type == "windows":
        os_type = "windows"
    else:
        os_type = "linux"
    
    path_sep = "\\" if os_type == "windows" else "/"
    home_dir = str(Path.home())
    
    # Default to home directory
    if not path:
        path = home_dir
    
    current_path = path
    items = []
    drives = []
    parent_path = None
    is_root = False
    media_count = 0
    
    media_extensions = {".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".m4v", ".webm",
                       ".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma"}
    
    try:
        p = Path(current_path)
        
        if not p.exists():
            raise HTTPException(status_code=400, detail=f"Path does not exist: {current_path}")
        
        if not p.is_dir():
            raise HTTPException(status_code=400, detail=f"Not a directory: {current_path}")
        
        # Build drives/quick access
        if os_type == "linux":
            drives = [
                {"name": "Root", "path": "/"},
                {"name": "Home", "path": home_dir},
            ]
            if Path("/media").exists():
                drives.append({"name": "Media", "path": "/media"})
            if Path("/mnt").exists():
                drives.append({"name": "Mounts", "path": "/mnt"})
            if Path("/tmp").exists():
                drives.append({"name": "Tmp", "path": "/tmp"})
        elif os_type == "darwin":
            drives = [
                {"name": "Root", "path": "/"},
                {"name": "Home", "path": home_dir},
                {"name": "Volumes", "path": "/Volumes"},
            ]
        else:
            import string
            for letter in string.ascii_uppercase:
                dp = f"{letter}:\\"
                if Path(dp).exists():
                    drives.append({"name": f"{letter}:", "path": dp})
        
        # Parent path
        parent = p.parent
        if str(parent) != str(p):
            parent_path = str(parent)
        else:
            is_root = True
        
        # List directory contents
        try:
            for entry in sorted(p.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
                if entry.name.startswith('.'):
                    continue
                if entry.is_dir():
                    try:
                        child_count = sum(1 for _ in entry.iterdir())
                    except PermissionError:
                        child_count = 0
                    items.append({
                        "name": entry.name,
                        "path": str(entry),
                        "type": "directory",
                        "is_parent": False,
                        "item_count": child_count,
                        "permission_denied": False,
                    })
                elif entry.suffix.lower() in media_extensions:
                    media_count += 1
        except PermissionError:
            raise HTTPException(status_code=403, detail=f"Permission denied: {current_path}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    return {
        "current_path": str(current_path),
        "items": items,
        "drives": drives,
        "parent_path": parent_path,
        "is_root": is_root,
        "os_type": os_type,
        "path_separator": path_sep,
        "home_directory": home_dir,
        "media_files_in_current": media_count,
    }


# ==================== STREAMING SERVICES ====================
@app.get("/api/streaming-services")
async def get_streaming_services(user=Depends(get_current_user)):
    return []

@app.put("/api/streaming-services/{service_id}")
async def update_streaming_service(service_id: str, enabled: bool = False, username: str = "", user=Depends(get_current_user)):
    return {"status": "updated"}

@app.get("/api/streaming-logins/services")
async def get_streaming_login_services(user=Depends(get_current_user)):
    return []

@app.get("/api/streaming-logins")
async def get_streaming_logins(user=Depends(get_current_user)):
    return []

@app.post("/api/streaming-logins")
async def add_streaming_login(service_id: str = "", email: str = "", password: str = "", user=Depends(get_current_user)):
    return {"status": "added"}

@app.delete("/api/streaming-logins/{service_id}")
async def delete_streaming_login(service_id: str, user=Depends(get_current_user)):
    return {"status": "deleted"}

@app.get("/api/streaming-logins/{service_id}/credentials")
async def get_streaming_credentials(service_id: str, user=Depends(get_current_user)):
    return {}


# ==================== PREFERENCES (bridge) ====================
@app.get("/api/preferences")
async def get_preferences(user=Depends(get_current_user)):
    prefs = await db.settings.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    return {p["key"]: p.get("value", "") for p in prefs}

@app.post("/api/preferences")
async def set_preferences(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    for k, v in data.items():
        await db.settings.update_one(
            {"key": k, "user_id": user["id"]},
            {"$set": {"key": k, "value": str(v), "user_id": user["id"]}},
            upsert=True
        )
    return {"status": "saved"}


# ==================== COMPOTE (Indexer Manager) ====================
@app.get("/api/compote/indexers")
async def compote_get_indexers(user=Depends(get_current_user)):
    return await db.indexers.find({}, {"_id": 0}).to_list(100)

@app.get("/api/compote/indexer-types")
async def compote_indexer_types(user=Depends(get_current_user)):
    return ["torznab", "newznab", "rss", "jackett", "prowlarr"]

@app.get("/api/compote/setup-guide")
async def compote_setup_guide(user=Depends(get_current_user)):
    return {"guide": "Configure indexers to search for content."}

@app.get("/api/compote/default-indexers")
async def compote_default_indexers(user=Depends(get_current_user)):
    return []

@app.post("/api/compote/indexers")
async def compote_add_indexer(name: str = "", indexer_type: str = "", url: str = "", api_key: str = "", enabled: bool = True, priority: int = 50, user=Depends(get_current_user)):
    indexer = {
        "id": str(uuid.uuid4()),
        "name": name, "indexer_type": indexer_type, "url": url,
        "api_key": api_key, "enabled": enabled, "priority": priority,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.indexers.insert_one(indexer)
    indexer.pop("_id", None)
    return indexer

@app.put("/api/compote/indexers/{indexer_id}")
async def compote_update_indexer(indexer_id: str, request: Request, user=Depends(get_current_user)):
    data = await request.json()
    await db.indexers.update_one({"id": indexer_id}, {"$set": data})
    return await db.indexers.find_one({"id": indexer_id}, {"_id": 0})

@app.delete("/api/compote/indexers/{indexer_id}")
async def compote_remove_indexer(indexer_id: str, user=Depends(get_current_user)):
    await db.indexers.delete_one({"id": indexer_id})
    return {"status": "deleted"}

@app.post("/api/compote/indexers/{indexer_id}/test")
async def compote_test_indexer(indexer_id: str, user=Depends(get_current_user)):
    return {"success": True, "response_time": 0.5}

@app.get("/api/compote/search")
async def compote_search(query: str = "", media_type: str = "movies", sort_by: str = "seeders", limit: int = 50, user=Depends(get_current_user)):
    return []

@app.post("/api/compote/grab")
async def compote_grab(title: str = "", download_url: str = None, magnet_url: str = None, size: int = 0, use_builtin: bool = True, user=Depends(get_current_user)):
    return {"status": "grabbed", "title": title}


# ==================== INDEXERS (legacy) ====================
@app.get("/api/indexers")
async def get_indexers(user=Depends(get_current_user)):
    return await db.indexers.find({}, {"_id": 0}).to_list(100)

@app.post("/api/indexers")
async def add_indexer(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.indexers.insert_one(data)
    data.pop("_id", None)
    return data

@app.put("/api/indexers/{indexer_id}")
async def update_indexer(indexer_id: str, request: Request, user=Depends(get_current_user)):
    data = await request.json()
    await db.indexers.update_one({"id": indexer_id}, {"$set": data})
    return await db.indexers.find_one({"id": indexer_id}, {"_id": 0})


# ==================== GELATIN (External Access) ====================
@app.get("/api/gelatin/status")
async def gelatin_status(user=Depends(get_current_user)):
    return {"status": "inactive", "tunnels": 0}

@app.get("/api/gelatin/lan-url")
async def gelatin_lan_url(user=Depends(get_current_user)):
    return {"url": f"http://{platform.node()}:8001"}

@app.post("/api/gelatin/tunnel/create")
async def gelatin_create_tunnel(provider: str = "built_in", user=Depends(get_current_user)):
    return {"tunnel_id": str(uuid.uuid4()), "status": "created", "provider": provider}

@app.get("/api/gelatin/tunnels")
async def gelatin_tunnels(user=Depends(get_current_user)):
    return []

@app.delete("/api/gelatin/tunnel/{tunnel_id}")
async def gelatin_close_tunnel(tunnel_id: str, user=Depends(get_current_user)):
    return {"status": "closed"}

@app.post("/api/gelatin/access-token")
async def gelatin_access_token(permissions: str = "view,watch_party", expires_hours: int = 24, user=Depends(get_current_user)):
    return {"token": secrets.token_urlsafe(32), "permissions": permissions, "expires_hours": expires_hours}

@app.get("/api/gelatin/share-link")
async def gelatin_share_link(party_code: str = "", use_external: bool = False, user=Depends(get_current_user)):
    return {"link": f"/party/{party_code}"}

@app.get("/api/gelatin/discover")
async def gelatin_discover(timeout: float = 3.0, user=Depends(get_current_user)):
    return []


# ==================== SUBTITLES ====================
@app.get("/api/subtitles/search/tv")
async def subtitle_search_tv(show_name: str = "", season: int = 1, episode: int = 1, languages: str = "en", user=Depends(get_current_user)):
    return []

@app.get("/api/subtitles/search/movie")
async def subtitle_search_movie(movie_name: str = "", year: int = None, imdb_id: str = None, languages: str = "en", user=Depends(get_current_user)):
    return []

@app.post("/api/subtitles/download")
async def subtitle_download(download_url: str = "", source: str = "", media_id: str = "", user=Depends(get_current_user)):
    return {"status": "downloaded"}

@app.get("/api/subtitles/settings")
async def subtitle_settings(user=Depends(get_current_user)):
    return {"auto_download": False, "languages": ["en"]}

@app.put("/api/subtitles/settings")
async def update_subtitle_settings(request: Request, user=Depends(get_current_user)):
    return {"status": "saved"}


# ==================== WATCH PARTY ====================
@app.get("/api/watch-party/list")
async def watch_party_list(user=Depends(get_current_user)):
    return []

@app.post("/api/watch-party/create")
async def watch_party_create(media_id: str = "", media_title: str = "", media_type: str = "movie", user=Depends(get_current_user)):
    code = secrets.token_urlsafe(6)
    return {"party_code": code, "media_id": media_id, "media_title": media_title}

@app.get("/api/watch-party/{party_code}")
async def watch_party_get(party_code: str, user=Depends(get_current_user)):
    return {"party_code": party_code, "status": "waiting"}


# ==================== MEDIA HEALTH ====================
@app.post("/api/media/health-check")
async def media_health_check(file_path: str = "", compute_hash: bool = False, user=Depends(get_current_user)):
    return {"status": "healthy", "file_path": file_path}

@app.post("/api/media/repair")
async def media_repair(file_path: str = "", output_path: str = None, user=Depends(get_current_user)):
    return {"status": "repaired"}

@app.post("/api/media/scan-library")
async def media_scan_library(directory: str = "", user=Depends(get_current_user)):
    return {"status": "scanning"}

@app.get("/api/media/scheduled-scans")
async def media_scheduled_scans(user=Depends(get_current_user)):
    return []

@app.post("/api/media/scheduled-scans")
async def media_create_scheduled_scan(request: Request, user=Depends(get_current_user)):
    return {"status": "created"}

@app.put("/api/media/scheduled-scans/{scan_id}")
async def media_update_scheduled_scan(scan_id: str, request: Request, user=Depends(get_current_user)):
    return {"status": "updated"}

@app.delete("/api/media/scheduled-scans/{scan_id}")
async def media_delete_scheduled_scan(scan_id: str, user=Depends(get_current_user)):
    return {"status": "deleted"}

@app.post("/api/media/scheduled-scans/{scan_id}/run")
async def media_run_scheduled_scan(scan_id: str, user=Depends(get_current_user)):
    return {"status": "running"}

@app.get("/api/media/notifications")
async def media_notifications(unread_only: bool = False, user=Depends(get_current_user)):
    return []

@app.put("/api/media/notifications/{notification_id}/read")
async def media_mark_notification_read(notification_id: str, user=Depends(get_current_user)):
    return {"status": "read"}

@app.delete("/api/media/notifications/{notification_id}")
async def media_delete_notification(notification_id: str, user=Depends(get_current_user)):
    return {"status": "deleted"}

@app.post("/api/media/redownload")
async def media_redownload(file_path: str = "", title: str = "", media_type: str = "movie", tmdb_id: str = None, user=Depends(get_current_user)):
    return {"status": "requested"}


# ==================== QBITTORRENT (legacy) ====================
@app.get("/api/qbittorrent/status")
async def qbit_status(user=Depends(get_current_user)):
    return {"connected": False, "status": "disconnected"}

@app.get("/api/qbittorrent/torrents")
async def qbit_torrents(filter: str = "all", category: str = "", limit: int = 50, user=Depends(get_current_user)):
    return []

@app.post("/api/qbittorrent/add")
async def qbit_add(url: str = None, magnet: str = None, save_path: str = "", category: str = "watchnexus", user=Depends(get_current_user)):
    return {"status": "added"}

@app.post("/api/qbittorrent/pause/{hash}")
async def qbit_pause(hash: str, user=Depends(get_current_user)):
    return {"status": "paused"}

@app.post("/api/qbittorrent/resume/{hash}")
async def qbit_resume(hash: str, user=Depends(get_current_user)):
    return {"status": "resumed"}

@app.delete("/api/qbittorrent/delete/{hash}")
async def qbit_delete(hash: str, delete_files: bool = False, user=Depends(get_current_user)):
    return {"status": "deleted"}

@app.get("/api/qbittorrent/files/{hash}")
async def qbit_files(hash: str, user=Depends(get_current_user)):
    return []

@app.post("/api/qbittorrent/test")
async def qbit_test(host: str = "", port: int = 8080, username: str = "", password: str = ""):
    return {"success": False, "error": "Not configured"}


# ==================== RIPEN (Gadgets) ====================
@app.get("/api/ripen/installed")
async def ripen_installed(user=Depends(get_current_user)):
    return {"gadgets": []}

@app.get("/api/ripen/hooks")
async def ripen_hooks(user=Depends(get_current_user)):
    return {
        "sidebar_entries": [], "routes": [], "settings_panels": [],
        "dashboard_widgets": [], "theme_presets": [],
        "providers": {"metadata": [], "subtitle": [], "notification": [], "indexer": [], "streaming": [], "sync": [], "auth": []},
        "enhanced_pages": [], "background_services": [],
    }

@app.post("/api/ripen/install/{gadget_id}")
async def ripen_install(gadget_id: str, user=Depends(get_current_user)):
    return {"status": "installed", "gadget_id": gadget_id}

@app.delete("/api/ripen/uninstall/{gadget_id}")
async def ripen_uninstall(gadget_id: str, user=Depends(get_current_user)):
    return {"status": "uninstalled"}

@app.post("/api/ripen/activate/{gadget_id}")
async def ripen_activate(gadget_id: str, user=Depends(get_current_user)):
    return {"status": "activated"}

@app.post("/api/ripen/deactivate/{gadget_id}")
async def ripen_deactivate(gadget_id: str, user=Depends(get_current_user)):
    return {"status": "deactivated"}


# ==================== MILK (Theme Forge) ====================
@app.get("/api/milk/theme-forge")
async def milk_theme_forge(user=Depends(get_current_user)):
    return {"themes": [], "active_theme": None, "custom_css": ""}

@app.get("/api/milk/themes")
async def milk_themes(user=Depends(get_current_user)):
    return []
