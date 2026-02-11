"""
Jellyfin/Emby Compatible API Layer for WatchNexus
=================================================

This module provides a hidden API layer that makes WatchNexus compatible with
existing Jellyfin/Emby clients. This allows users to connect using apps like:
- Jellyfin Android/iOS
- Infuse
- Swiftfin
- Finamp
- And many more...

HIDDEN FEATURE: Not advertised in main UI, for advanced users only.
Enable by connecting any Jellyfin client to: http://server:8096/emby

API Compatibility: Jellyfin 10.8+ / Emby 4.x
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Query, Request
from fastapi.responses import JSONResponse, Response, RedirectResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import hashlib
import os

# Create hidden router - prefix with /emby for client compatibility
jellyfin_router = APIRouter(prefix="/emby", tags=["Jellyfin Compatible API (Hidden)"])

# ==================== MODELS ====================

class JellyfinAuthRequest(BaseModel):
    Username: str
    Pw: str

class JellyfinUser(BaseModel):
    Name: str
    ServerId: str
    Id: str
    HasPassword: bool = True
    HasConfiguredPassword: bool = True
    HasConfiguredEasyPassword: bool = False
    EnableAutoLogin: bool = False
    Policy: Dict[str, Any] = {}
    Configuration: Dict[str, Any] = {}

class JellyfinAuthResult(BaseModel):
    User: JellyfinUser
    SessionInfo: Dict[str, Any]
    AccessToken: str
    ServerId: str

class JellyfinSystemInfo(BaseModel):
    ServerName: str = "WatchNexus"
    Version: str = "10.8.0"  # Jellyfin compatibility version
    ProductName: str = "WatchNexus (Jellyfin Compatible)"
    OperatingSystem: str = "Linux"
    Id: str
    StartupWizardCompleted: bool = True
    SupportsLibraryMonitor: bool = True
    WebSocketPortNumber: int = 8096
    HasUpdateAvailable: bool = False
    CanSelfRestart: bool = False
    CanLaunchWebBrowser: bool = False
    LocalAddress: str = "http://localhost:8096"

class BaseItemDto(BaseModel):
    """Core Jellyfin item type - used for all media"""
    Name: str
    ServerId: str
    Id: str
    Type: str  # Movie, Series, Episode, MusicAlbum, Audio, etc.
    MediaType: Optional[str] = None  # Video, Audio, Photo
    IsFolder: bool = False
    ParentId: Optional[str] = None
    UserData: Optional[Dict[str, Any]] = None
    ImageTags: Optional[Dict[str, str]] = None
    BackdropImageTags: Optional[List[str]] = None
    Overview: Optional[str] = None
    ProductionYear: Optional[int] = None
    PremiereDate: Optional[str] = None
    CommunityRating: Optional[float] = None
    RunTimeTicks: Optional[int] = None
    Path: Optional[str] = None
    Container: Optional[str] = None
    
# ==================== HELPERS ====================

# Server ID (persistent across restarts)
SERVER_ID = os.environ.get("JELLYFIN_SERVER_ID", str(uuid.uuid5(uuid.NAMESPACE_DNS, "watchnexus.local")))

# Active sessions storage (in-memory for now)
jellyfin_sessions: Dict[str, Dict] = {}

def generate_token() -> str:
    """Generate Jellyfin-compatible access token"""
    return hashlib.sha256(f"{uuid.uuid4()}{datetime.now().isoformat()}".encode()).hexdigest()[:32]

def parse_authorization_header(authorization: str = None) -> Optional[Dict[str, str]]:
    """Parse Jellyfin/Emby authorization header"""
    if not authorization:
        return None
    
    # Format: MediaBrowser Client="...", Device="...", DeviceId="...", Version="...", Token="..."
    params = {}
    if authorization.startswith("MediaBrowser "):
        auth_str = authorization[13:]
        for part in auth_str.split(","):
            if "=" in part:
                key, value = part.strip().split("=", 1)
                params[key.strip()] = value.strip().strip('"')
    
    return params if params else None

async def get_jellyfin_user(
    authorization: str = Header(None, alias="Authorization"),
    x_emby_token: str = Header(None, alias="X-Emby-Token"),
    x_mediabrowser_token: str = Header(None, alias="X-MediaBrowser-Token"),
    api_key: str = Query(None, alias="api_key"),
):
    """Extract and validate Jellyfin authentication"""
    token = None
    
    # Try various token sources
    if x_emby_token:
        token = x_emby_token
    elif x_mediabrowser_token:
        token = x_mediabrowser_token
    elif api_key:
        token = api_key
    elif authorization:
        params = parse_authorization_header(authorization)
        if params and "Token" in params:
            token = params["Token"]
    
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Look up session
    session = jellyfin_sessions.get(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return session

# ==================== SYSTEM ENDPOINTS ====================

@jellyfin_router.get("/System/Info")
@jellyfin_router.get("/System/Info/Public")
async def get_system_info():
    """Return server information - used by clients to identify server"""
    return JellyfinSystemInfo(
        Id=SERVER_ID,
        LocalAddress=f"http://localhost:8096"
    )

@jellyfin_router.get("/System/Endpoint")
async def get_endpoint_info():
    """Return endpoint information"""
    return {
        "IsLocal": True,
        "IsInNetwork": True
    }

@jellyfin_router.get("/System/Ping")
async def ping():
    """Health check endpoint"""
    return Response(content="WatchNexus", media_type="text/plain")

@jellyfin_router.get("/Branding/Configuration")
async def get_branding():
    """Return branding configuration"""
    return {
        "LoginDisclaimer": "Welcome to WatchNexus - Jellyfin Compatible Mode",
        "CustomCss": "",
        "SplashscreenEnabled": False
    }

@jellyfin_router.get("/Branding/Css")
@jellyfin_router.get("/Branding/Css.css")
async def get_branding_css():
    """Return custom CSS (empty)"""
    return Response(content="", media_type="text/css")

# ==================== AUTHENTICATION ====================

@jellyfin_router.post("/Users/AuthenticateByName")
async def authenticate_by_name(
    auth_request: JellyfinAuthRequest,
    authorization: str = Header(None, alias="Authorization"),
    x_emby_authorization: str = Header(None, alias="X-Emby-Authorization"),
):
    """
    Authenticate user and return access token.
    This is the primary login endpoint for Jellyfin clients.
    """
    # Import from main server module
    from server import db, bcrypt
    
    # Find user
    user = await db.users.find_one({"email": auth_request.Username.lower()})
    if not user:
        # Also try by username
        user = await db.users.find_one({"username": auth_request.Username})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Verify password
    if not bcrypt.checkpw(auth_request.Pw.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Generate token
    token = generate_token()
    user_id = str(user.get("id", user.get("_id")))
    
    # Parse client info from authorization header
    client_info = parse_authorization_header(authorization or x_emby_authorization) or {}
    
    # Create session
    session = {
        "user_id": user_id,
        "username": user.get("username", auth_request.Username),
        "email": user.get("email"),
        "token": token,
        "client": client_info.get("Client", "Unknown"),
        "device": client_info.get("Device", "Unknown"),
        "device_id": client_info.get("DeviceId", str(uuid.uuid4())),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    jellyfin_sessions[token] = session
    
    # Build response
    jellyfin_user = JellyfinUser(
        Name=user.get("username", auth_request.Username),
        ServerId=SERVER_ID,
        Id=user_id,
        Policy={
            "IsAdministrator": True,
            "IsHidden": False,
            "IsDisabled": False,
            "EnableAllDevices": True,
            "EnableAllFolders": True,
            "EnableAllChannels": True,
            "EnableContentDeletion": True,
            "EnableContentDownloading": True,
            "EnableRemoteAccess": True,
            "EnableLiveTvAccess": True,
            "EnableLiveTvManagement": True,
            "EnableMediaPlayback": True,
            "EnableAudioPlaybackTranscoding": True,
            "EnableVideoPlaybackTranscoding": True,
            "EnablePlaybackRemuxing": True,
        },
        Configuration={
            "PlayDefaultAudioTrack": True,
            "SubtitleLanguagePreference": "eng",
            "DisplayMissingEpisodes": False,
            "EnableLocalPassword": False,
            "OrderedViews": [],
            "LatestItemsExcludes": [],
            "MyMediaExcludes": [],
            "HidePlayedInLatest": True,
            "RememberAudioSelections": True,
            "RememberSubtitleSelections": True,
            "EnableNextEpisodeAutoPlay": True,
        }
    )
    
    return JellyfinAuthResult(
        User=jellyfin_user,
        SessionInfo={
            "Id": session["device_id"],
            "UserId": user_id,
            "UserName": session["username"],
            "Client": session["client"],
            "DeviceName": session["device"],
            "DeviceId": session["device_id"],
            "ServerId": SERVER_ID,
            "SupportedCommands": [],
            "SupportsRemoteControl": False,
            "PlayState": {"CanSeek": False, "IsPaused": False, "IsMuted": False},
        },
        AccessToken=token,
        ServerId=SERVER_ID
    )

@jellyfin_router.get("/Users/{user_id}")
async def get_user(user_id: str, session: dict = Depends(get_jellyfin_user)):
    """Get user details"""
    return JellyfinUser(
        Name=session["username"],
        ServerId=SERVER_ID,
        Id=session["user_id"],
        Policy={"IsAdministrator": True},
        Configuration={}
    )

# ==================== LIBRARY VIEWS ====================

@jellyfin_router.get("/Users/{user_id}/Views")
async def get_user_views(user_id: str, session: dict = Depends(get_jellyfin_user)):
    """
    Get library views (top-level folders like Movies, TV Shows, Music).
    This is what appears on the home screen of Jellyfin clients.
    """
    views = [
        BaseItemDto(
            Name="Movies",
            ServerId=SERVER_ID,
            Id="movies-collection",
            Type="CollectionFolder",
            IsFolder=True,
            ImageTags={"Primary": "movies"},
        ),
        BaseItemDto(
            Name="TV Shows", 
            ServerId=SERVER_ID,
            Id="tvshows-collection",
            Type="CollectionFolder",
            IsFolder=True,
            ImageTags={"Primary": "tvshows"},
        ),
        BaseItemDto(
            Name="Music",
            ServerId=SERVER_ID,
            Id="music-collection", 
            Type="CollectionFolder",
            IsFolder=True,
            ImageTags={"Primary": "music"},
        ),
        BaseItemDto(
            Name="Live TV",
            ServerId=SERVER_ID,
            Id="livetv-collection",
            Type="CollectionFolder",
            IsFolder=True,
            ImageTags={"Primary": "livetv"},
        ),
    ]
    
    return {
        "Items": [v.model_dump() for v in views],
        "TotalRecordCount": len(views),
        "StartIndex": 0
    }

# ==================== ITEMS / LIBRARY ====================

@jellyfin_router.get("/Items")
@jellyfin_router.get("/Users/{user_id}/Items")
async def get_items(
    user_id: str = None,
    parentId: str = Query(None, alias="ParentId"),
    includeItemTypes: str = Query(None, alias="IncludeItemTypes"),
    sortBy: str = Query("SortName", alias="SortBy"),
    sortOrder: str = Query("Ascending", alias="SortOrder"),
    recursive: bool = Query(False, alias="Recursive"),
    limit: int = Query(100, alias="Limit"),
    startIndex: int = Query(0, alias="StartIndex"),
    searchTerm: str = Query(None, alias="SearchTerm"),
    fields: str = Query(None, alias="Fields"),
    session: dict = Depends(get_jellyfin_user)
):
    """
    Get library items. This is the main endpoint for browsing media.
    """
    from server import db
    
    items = []
    
    # Fetch from WatchNexus library
    query = {}
    
    # Filter by parent collection
    if parentId == "movies-collection":
        query["media_type"] = "movie"
    elif parentId == "tvshows-collection":
        query["media_type"] = "tv"
    elif parentId == "music-collection":
        query["media_type"] = {"$in": ["music", "audiobook"]}
    elif parentId == "livetv-collection":
        query["media_type"] = "live_tv"
    
    # Filter by item types
    if includeItemTypes:
        type_map = {
            "Movie": "movie",
            "Series": "tv", 
            "Audio": "music",
            "MusicAlbum": "music",
        }
        types = [type_map.get(t, t.lower()) for t in includeItemTypes.split(",")]
        if types:
            query["media_type"] = {"$in": types}
    
    # Search
    if searchTerm:
        query["title"] = {"$regex": searchTerm, "$options": "i"}
    
    # Fetch from database
    cursor = db.library.find(query, {"_id": 0}).skip(startIndex).limit(limit)
    
    # Sort
    sort_field = "title" if sortBy == "SortName" else sortBy.lower()
    sort_dir = 1 if sortOrder == "Ascending" else -1
    cursor = cursor.sort(sort_field, sort_dir)
    
    async for item in cursor:
        # Convert to Jellyfin format
        jf_type = {
            "movie": "Movie",
            "tv": "Series",
            "music": "Audio",
            "audiobook": "AudioBook",
            "live_tv": "LiveTvChannel"
        }.get(item.get("media_type", "movie"), "Video")
        
        items.append(BaseItemDto(
            Name=item.get("title", "Unknown"),
            ServerId=SERVER_ID,
            Id=item.get("id", str(uuid.uuid4())),
            Type=jf_type,
            MediaType="Video" if item.get("media_type") in ["movie", "tv"] else "Audio",
            Overview=item.get("overview"),
            ProductionYear=int(item.get("release_date", "0000")[:4]) if item.get("release_date") else None,
            CommunityRating=item.get("vote_average"),
            ImageTags={"Primary": item.get("id")} if item.get("poster_path") else None,
            BackdropImageTags=[item.get("id")] if item.get("backdrop_path") else None,
            UserData={
                "PlaybackPositionTicks": 0,
                "PlayCount": 0,
                "IsFavorite": False,
                "Played": False,
            }
        ).model_dump())
    
    total = await db.library.count_documents(query)
    
    return {
        "Items": items,
        "TotalRecordCount": total,
        "StartIndex": startIndex
    }

@jellyfin_router.get("/Items/{item_id}")
async def get_item(item_id: str, session: dict = Depends(get_jellyfin_user)):
    """Get single item details"""
    from server import db
    
    item = await db.library.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    jf_type = {
        "movie": "Movie",
        "tv": "Series", 
        "music": "Audio",
    }.get(item.get("media_type", "movie"), "Video")
    
    return BaseItemDto(
        Name=item.get("title", "Unknown"),
        ServerId=SERVER_ID,
        Id=item.get("id"),
        Type=jf_type,
        MediaType="Video",
        Overview=item.get("overview"),
        ProductionYear=int(item.get("release_date", "0000")[:4]) if item.get("release_date") else None,
        CommunityRating=item.get("vote_average"),
        ImageTags={"Primary": item.get("id")} if item.get("poster_path") else None,
        Path=item.get("file_path"),
    ).model_dump()

# ==================== IMAGES ====================

@jellyfin_router.get("/Items/{item_id}/Images/{image_type}")
@jellyfin_router.get("/Items/{item_id}/Images/{image_type}/{image_index}")
async def get_item_image(
    item_id: str,
    image_type: str,
    image_index: int = 0,
    maxWidth: int = Query(None),
    maxHeight: int = Query(None),
    quality: int = Query(90),
):
    """
    Redirect to actual image URL.
    In production, this would serve cached/resized images.
    """
    from server import db, TMDB_IMAGE_BASE
    
    # Handle collection images
    collection_images = {
        "movies": "https://image.tmdb.org/t/p/w500/placeholder_movies.jpg",
        "tvshows": "https://image.tmdb.org/t/p/w500/placeholder_tv.jpg",
        "music": "https://image.tmdb.org/t/p/w500/placeholder_music.jpg",
        "livetv": "https://image.tmdb.org/t/p/w500/placeholder_livetv.jpg",
    }
    
    if item_id in collection_images:
        return RedirectResponse(url=collection_images[item_id])
    
    # Get item from database
    item = await db.library.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Determine image path
    if image_type.lower() in ["primary", "poster"]:
        path = item.get("poster_path")
    elif image_type.lower() in ["backdrop", "banner", "art"]:
        path = item.get("backdrop_path")
    else:
        path = item.get("poster_path")
    
    if not path:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Build TMDB URL
    size = "original"
    if maxWidth:
        if maxWidth <= 200:
            size = "w200"
        elif maxWidth <= 400:
            size = "w400"
        elif maxWidth <= 500:
            size = "w500"
        else:
            size = "original"
    
    image_url = f"{TMDB_IMAGE_BASE}{size}{path}"
    return RedirectResponse(url=image_url)

# ==================== PLAYBACK ====================

@jellyfin_router.get("/Videos/{item_id}/stream")
@jellyfin_router.get("/Videos/{item_id}/stream.{container}")
async def stream_video(
    item_id: str,
    container: str = "mp4",
    session: dict = Depends(get_jellyfin_user)
):
    """
    Video streaming endpoint.
    In production, this would handle transcoding and direct play.
    """
    from server import db
    
    item = await db.library.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    file_path = item.get("file_path")
    if not file_path:
        raise HTTPException(status_code=404, detail="Media file not found")
    
    # In a real implementation, this would:
    # 1. Check if direct play is supported
    # 2. Start transcoding if needed
    # 3. Stream the video
    
    return {
        "message": "Streaming not implemented in demo mode",
        "file_path": file_path,
        "item_id": item_id
    }

@jellyfin_router.get("/Items/{item_id}/PlaybackInfo")
async def get_playback_info(
    item_id: str,
    userId: str = Query(None),
    session: dict = Depends(get_jellyfin_user)
):
    """Get playback information for an item"""
    from server import db
    
    item = await db.library.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {
        "MediaSources": [{
            "Id": item_id,
            "Name": item.get("title"),
            "Path": item.get("file_path"),
            "Container": "mp4",
            "Size": 0,
            "SupportsDirectPlay": True,
            "SupportsDirectStream": True,
            "SupportsTranscoding": True,
            "MediaStreams": []
        }],
        "PlaySessionId": str(uuid.uuid4())
    }

# ==================== SESSIONS ====================

@jellyfin_router.get("/Sessions")
async def get_sessions(session: dict = Depends(get_jellyfin_user)):
    """Get active sessions"""
    return list(jellyfin_sessions.values())

@jellyfin_router.post("/Sessions/Playing")
async def report_playback_start(session: dict = Depends(get_jellyfin_user)):
    """Report playback started"""
    return {"success": True}

@jellyfin_router.post("/Sessions/Playing/Progress")
async def report_playback_progress(session: dict = Depends(get_jellyfin_user)):
    """Report playback progress"""
    return {"success": True}

@jellyfin_router.post("/Sessions/Playing/Stopped")
async def report_playback_stopped(session: dict = Depends(get_jellyfin_user)):
    """Report playback stopped"""
    return {"success": True}

# ==================== SEARCH ====================

@jellyfin_router.get("/Search/Hints")
async def search_hints(
    searchTerm: str = Query(..., alias="SearchTerm"),
    limit: int = Query(20, alias="Limit"),
    session: dict = Depends(get_jellyfin_user)
):
    """Quick search suggestions"""
    from server import db
    
    items = []
    cursor = db.library.find(
        {"title": {"$regex": searchTerm, "$options": "i"}},
        {"_id": 0}
    ).limit(limit)
    
    async for item in cursor:
        items.append({
            "ItemId": item.get("id"),
            "Id": item.get("id"),
            "Name": item.get("title"),
            "Type": "Movie" if item.get("media_type") == "movie" else "Series",
            "RunTimeTicks": 0,
            "ProductionYear": int(item.get("release_date", "0000")[:4]) if item.get("release_date") else None,
        })
    
    return {
        "SearchHints": items,
        "TotalRecordCount": len(items)
    }

# ==================== FAVORITES ====================

@jellyfin_router.post("/Users/{user_id}/FavoriteItems/{item_id}")
async def add_favorite(user_id: str, item_id: str, session: dict = Depends(get_jellyfin_user)):
    """Add item to favorites"""
    # In production, save to database
    return {"success": True}

@jellyfin_router.delete("/Users/{user_id}/FavoriteItems/{item_id}")
async def remove_favorite(user_id: str, item_id: str, session: dict = Depends(get_jellyfin_user)):
    """Remove item from favorites"""
    return {"success": True}

# ==================== MARK PLAYED ====================

@jellyfin_router.post("/Users/{user_id}/PlayedItems/{item_id}")
async def mark_played(user_id: str, item_id: str, session: dict = Depends(get_jellyfin_user)):
    """Mark item as played"""
    return {"success": True}

@jellyfin_router.delete("/Users/{user_id}/PlayedItems/{item_id}")
async def mark_unplayed(user_id: str, item_id: str, session: dict = Depends(get_jellyfin_user)):
    """Mark item as unplayed"""
    return {"success": True}
