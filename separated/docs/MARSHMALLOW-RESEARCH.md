# WatchNexus Marshmallow - Cloud Sync Research 🍡

**Codename:** Marshmallow  
**Status:** Research & Planning  
**Date:** February 2026

## Executive Summary

Marshmallow is the cloud sync feature for WatchNexus that enables users to:
- Sync watch progress, history, and resume points across all devices
- Backup user data, settings, and preferences to the cloud
- Share libraries and playlists across multiple WatchNexus servers
- Enable seamless device switching (start on TV, continue on phone)

---

## 1. Current State Analysis

### What Competitors Offer

| Service | Cloud Sync | Multi-Server | Watch Progress | Offline Sync |
|---------|------------|--------------|----------------|--------------|
| **Plex** | ✅ (Plex Pass) | ❌ | ✅ | ✅ (Plex Pass) |
| **Jellyfin** | ❌ | ❌ | ✅ (single server) | ❌ |
| **Emby** | ❌ | ❌ | ✅ (single server) | ✅ (Premiere) |

### Third-Party Solutions (Inspiration)

1. **JellyPlex-Watched** - Docker tool for bidirectional watch history sync between Jellyfin/Plex
2. **jellyfin2plex** - Library sync using hardlinks
3. **Trakt.tv** - Universal watch history tracking across services

---

## 2. Marshmallow Architecture

### 2.1 Sync Data Categories

```
┌─────────────────────────────────────────────────────────────┐
│                    MARSHMALLOW SYNC DATA                     │
├─────────────────────────────────────────────────────────────┤
│  TIER 1: CRITICAL (Real-time sync)                          │
│  ├── Watch Progress (position, duration, completed)          │
│  ├── Watch History (what was watched, when)                  │
│  └── Continue Watching queue                                 │
├─────────────────────────────────────────────────────────────┤
│  TIER 2: IMPORTANT (Near real-time, <5 min)                 │
│  ├── User Playlists                                         │
│  ├── Favorites/Watchlist                                    │
│  ├── Ratings                                                │
│  └── User Preferences (audio/subtitle defaults)             │
├─────────────────────────────────────────────────────────────┤
│  TIER 3: PERIODIC (Hourly/Daily)                            │
│  ├── User Settings                                          │
│  ├── Theme Customizations                                   │
│  ├── Quality Profiles                                       │
│  └── Indexer Configurations                                 │
├─────────────────────────────────────────────────────────────┤
│  TIER 4: OPTIONAL (Manual/On-demand)                        │
│  ├── Full Database Backup                                   │
│  ├── Library Metadata                                       │
│  └── Custom Artwork                                         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Sync Providers (Multi-Cloud Support)

```
┌─────────────────────────────────────────────────────────────┐
│                    SYNC PROVIDERS                            │
├──────────────┬──────────────┬──────────────┬───────────────┤
│   PROVIDER   │     PROS     │     CONS     │   USE CASE    │
├──────────────┼──────────────┼──────────────┼───────────────┤
│ WatchNexus   │ Native,      │ Requires     │ Default for   │
│ Cloud        │ optimized,   │ account      │ most users    │
│ (Official)   │ free tier    │              │               │
├──────────────┼──────────────┼──────────────┼───────────────┤
│ Google       │ Free 15GB,   │ OAuth setup, │ Personal      │
│ Drive        │ familiar     │ rate limits  │ backup        │
├──────────────┼──────────────┼──────────────┼───────────────┤
│ S3/MinIO     │ Self-hosted, │ Setup        │ Privacy-      │
│              │ unlimited    │ complexity   │ focused users │
├──────────────┼──────────────┼──────────────┼───────────────┤
│ WebDAV       │ Universal,   │ Slow for     │ Nextcloud     │
│              │ self-hosted  │ large data   │ users         │
├──────────────┼──────────────┼──────────────┼───────────────┤
│ Dropbox      │ Easy setup,  │ Limited      │ Simple        │
│              │ reliable     │ free tier    │ backup        │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

### 2.3 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT DEVICES                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Ruby    │ │Sapphire │ │ Diamond │ │Tanzanite│           │
│  │(And.TV) │ │(Mobile) │ │ (Kodi)  │ │ (Roku)  │           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       │           │           │           │                 │
│       └───────────┴─────┬─────┴───────────┘                 │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              WATCHNEXUS SERVER                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │           MARSHMALLOW SYNC ENGINE              │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │  │  │
│  │  │  │ Change   │  │ Conflict │  │ Batch        │ │  │  │
│  │  │  │ Detector │  │ Resolver │  │ Processor    │ │  │  │
│  │  │  └────┬─────┘  └────┬─────┘  └──────┬───────┘ │  │  │
│  │  │       └─────────────┴────────────────┘        │  │  │
│  │  │                      │                         │  │  │
│  │  │                      ▼                         │  │  │
│  │  │  ┌─────────────────────────────────────────┐  │  │  │
│  │  │  │         PROVIDER ADAPTERS               │  │  │  │
│  │  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐   │  │  │  │
│  │  │  │  │ S3  │ │GDrv │ │WebDAV│ │WatchNexus│  │  │  │  │
│  │  │  │  └──┬──┘ └──┬──┘ └──┬──┘ └────┬────┘   │  │  │  │
│  │  │  └─────┼───────┼───────┼─────────┼────────┘  │  │  │
│  │  └────────┼───────┼───────┼─────────┼──────────┘  │  │
│  └───────────┼───────┼───────┼─────────┼────────────┘  │
│              │       │       │         │               │
└──────────────┼───────┼───────┼─────────┼───────────────┘
               ▼       ▼       ▼         ▼
        ┌──────────────────────────────────────────┐
        │            CLOUD STORAGE                  │
        │  ┌─────┐ ┌─────────┐ ┌───────┐ ┌──────┐ │
        │  │MinIO│ │Google   │ │Next   │ │Watch │ │
        │  │/S3  │ │Drive    │ │Cloud  │ │Nexus │ │
        │  └─────┘ └─────────┘ └───────┘ └──────┘ │
        └──────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 Sync Record Schema

```python
class SyncRecord(BaseModel):
    """Individual sync record for any syncable data."""
    id: str                      # UUID
    user_id: str                 # User who owns this data
    record_type: str             # "watch_progress", "playlist", "setting", etc.
    record_id: str               # ID of the actual record
    data: dict                   # The data to sync
    checksum: str                # SHA256 of data for conflict detection
    local_modified: datetime     # When modified locally
    cloud_modified: datetime     # When modified in cloud
    sync_status: str             # "pending", "synced", "conflict", "error"
    device_id: str               # Which device made the change
    version: int                 # Incrementing version for conflict resolution

class WatchProgressSync(BaseModel):
    """Watch progress sync data."""
    media_id: str
    media_type: str              # "movie", "episode"
    position_seconds: float
    duration_seconds: float
    completed: bool
    completed_at: Optional[datetime]
    last_watched: datetime

class PlaylistSync(BaseModel):
    """Playlist sync data."""
    playlist_id: str
    name: str
    description: str
    items: List[str]             # Media IDs
    is_public: bool
    created_at: datetime
    modified_at: datetime
```

### 3.2 Conflict Resolution Strategy

```
CONFLICT RESOLUTION RULES:
─────────────────────────

1. WATCH PROGRESS (Last-Write-Wins + Merge)
   ├── If cloud position > local position: Use cloud (user watched more)
   ├── If local position > cloud position: Use local
   └── If positions equal but timestamps differ: Use newer timestamp

2. PLAYLISTS (Manual + Merge)
   ├── New items: Merge both (union)
   ├── Removed items: Keep removal (delete wins)
   ├── Reordering: Use most recent order
   └── Name/description: Use most recent

3. SETTINGS (Last-Write-Wins)
   └── Most recent timestamp wins

4. FAVORITES (Additive)
   └── Always merge (never remove unless explicit)
```

---

## 4. API Design

### 4.1 Backend Endpoints

```python
# Marshmallow API Routes

# Sync Status & Config
GET  /api/marshmallow/status          # Get sync status
POST /api/marshmallow/configure       # Configure sync provider
GET  /api/marshmallow/providers       # List available providers

# Manual Sync Operations
POST /api/marshmallow/sync            # Trigger full sync
POST /api/marshmallow/sync/push       # Push local changes to cloud
POST /api/marshmallow/sync/pull       # Pull cloud changes to local

# Watch Progress Sync
GET  /api/marshmallow/progress        # Get all synced progress
POST /api/marshmallow/progress        # Sync progress update
GET  /api/marshmallow/progress/{id}   # Get specific progress

# Conflict Resolution
GET  /api/marshmallow/conflicts       # List unresolved conflicts
POST /api/marshmallow/conflicts/{id}  # Resolve a conflict

# Backup/Restore
POST /api/marshmallow/backup          # Create full backup
GET  /api/marshmallow/backups         # List available backups
POST /api/marshmallow/restore/{id}    # Restore from backup
```

### 4.2 WebSocket for Real-time Sync

```python
# Real-time sync events via WebSocket

WS /api/marshmallow/ws

# Events:
{
    "type": "progress_update",
    "data": {
        "media_id": "...",
        "position": 1234.5,
        "device": "ruby-androidtv"
    }
}

{
    "type": "sync_complete",
    "data": {
        "records_synced": 15,
        "conflicts": 0
    }
}

{
    "type": "conflict_detected",
    "data": {
        "record_type": "playlist",
        "record_id": "...",
        "local_version": {...},
        "cloud_version": {...}
    }
}
```

---

## 5. Provider Implementations

### 5.1 S3-Compatible Storage

```python
# marshmallow/providers/s3_provider.py

import boto3
from typing import Optional
from datetime import datetime

class S3SyncProvider:
    """S3-compatible sync provider (AWS S3, MinIO, Backblaze B2, etc.)"""
    
    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str):
        self.client = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key
        )
        self.bucket = bucket
    
    async def upload_sync_data(self, user_id: str, data_type: str, data: dict) -> bool:
        """Upload sync data to S3."""
        key = f"sync/{user_id}/{data_type}/{datetime.utcnow().isoformat()}.json"
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=json.dumps(data),
            ContentType='application/json'
        )
        return True
    
    async def download_sync_data(self, user_id: str, data_type: str) -> Optional[dict]:
        """Download latest sync data from S3."""
        prefix = f"sync/{user_id}/{data_type}/"
        response = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        # Get most recent
        ...
    
    async def list_sync_history(self, user_id: str) -> List[dict]:
        """List all sync snapshots for a user."""
        ...
```

### 5.2 Google Drive

```python
# marshmallow/providers/gdrive_provider.py

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload

class GoogleDriveSyncProvider:
    """Google Drive sync provider using API v3."""
    
    SCOPES = ['https://www.googleapis.com/auth/drive.appdata']
    
    def __init__(self, credentials: Credentials):
        self.service = build('drive', 'v3', credentials=credentials)
    
    async def upload_sync_data(self, user_id: str, data_type: str, data: dict) -> str:
        """Upload sync data to Google Drive appDataFolder."""
        file_metadata = {
            'name': f'{data_type}.json',
            'parents': ['appDataFolder']
        }
        media = MediaInMemoryUpload(
            json.dumps(data).encode(),
            mimetype='application/json',
            resumable=True
        )
        file = self.service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        return file.get('id')
```

### 5.3 WebDAV (Nextcloud/ownCloud)

```python
# marshmallow/providers/webdav_provider.py

import httpx
from xml.etree import ElementTree

class WebDAVSyncProvider:
    """WebDAV sync provider for Nextcloud, ownCloud, etc."""
    
    def __init__(self, url: str, username: str, password: str):
        self.base_url = url.rstrip('/')
        self.auth = (username, password)
    
    async def upload_sync_data(self, user_id: str, data_type: str, data: dict) -> bool:
        """Upload sync data via WebDAV PUT."""
        path = f"/watchnexus/sync/{user_id}/{data_type}.json"
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.base_url}{path}",
                content=json.dumps(data),
                auth=self.auth,
                headers={'Content-Type': 'application/json'}
            )
            return response.status_code in (200, 201, 204)
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create `marshmallow.py` module with base classes
- [ ] Implement SyncEngine core with change detection
- [ ] Add S3 provider (simplest to implement)
- [ ] Basic API endpoints for manual sync

### Phase 2: Watch Progress (Week 3-4)
- [ ] Real-time watch progress sync
- [ ] Conflict resolution for progress
- [ ] WebSocket for instant updates
- [ ] Client SDK updates (all apps)

### Phase 3: Additional Providers (Week 5-6)
- [ ] Google Drive provider
- [ ] WebDAV provider
- [ ] Provider configuration UI

### Phase 4: Full Data Sync (Week 7-8)
- [ ] Playlist sync
- [ ] Settings sync
- [ ] Backup/restore functionality
- [ ] Conflict resolution UI

### Phase 5: Polish & Optimization (Week 9-10)
- [ ] Performance optimization (batching, compression)
- [ ] Offline queue for poor connectivity
- [ ] Sync analytics and monitoring
- [ ] Documentation and testing

---

## 7. Security Considerations

### 7.1 Data Encryption

```
CLIENT ──────► ENCRYPTED DATA ──────► CLOUD STORAGE

1. All sync data encrypted at rest using AES-256-GCM
2. Encryption key derived from user's password (PBKDF2)
3. Provider never sees unencrypted data
4. Optional: End-to-end encryption with user-held keys
```

### 7.2 Authentication

- OAuth2 for Google Drive
- API keys for S3
- Basic Auth over HTTPS for WebDAV
- JWT for WatchNexus Cloud

### 7.3 Privacy

- Minimal data collection
- User controls what syncs
- Easy data export/deletion
- GDPR compliant

---

## 8. UI/UX Design

### Settings Page: Cloud Sync

```
┌─────────────────────────────────────────────────────────────┐
│  ☁️  Cloud Sync (Marshmallow)                      [ON/OFF] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: ✅ Synced 2 minutes ago                            │
│  Provider: Google Drive                      [Change]       │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  WHAT TO SYNC                                               │
│                                                             │
│  ☑️  Watch Progress & History                               │
│      Sync your position in movies and shows                 │
│                                                             │
│  ☑️  Playlists                                              │
│      Sync your custom playlists                             │
│                                                             │
│  ☑️  Favorites & Watchlist                                  │
│      Sync your saved items                                  │
│                                                             │
│  ☐  Settings & Preferences                                  │
│      Sync app settings and quality profiles                 │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ACTIONS                                                    │
│                                                             │
│  [Sync Now]  [View Conflicts (0)]  [Backup]  [Restore]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Client App Changes

### Required Updates for Each Client

| Client | Changes Required |
|--------|-----------------|
| **Ruby (Android TV)** | Add sync service, background sync worker |
| **Sapphire (Android)** | Add sync service, WorkManager integration |
| **Ember (Fire TV)** | Same as Ruby |
| **Diamond (Kodi)** | Add sync plugin, periodic sync task |
| **Tanzanite (Roku)** | Add sync task, roRegistrySection for caching |
| **Web** | Add sync status indicator, conflict UI |

---

## 10. References & Resources

### Documentation
- [Google Drive API v3](https://developers.google.com/drive/api/v3/about-sdk)
- [AWS S3 Boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html)
- [WebDAV RFC 4918](https://tools.ietf.org/html/rfc4918)

### Open Source Inspiration
- [JellyPlex-Watched](https://github.com/luigi311/JellyPlex-Watched)
- [Trakt.tv Scrobbler](https://github.com/trakt/trakt-scrobbler)
- [Rclone](https://github.com/rclone/rclone)

### Similar Projects
- Plex Sync (proprietary)
- Jellyfin Plugin: Trakt
- Emby Connect

---

## 11. Open Questions

1. **WatchNexus Cloud Service**: Should we build an official cloud service, or rely entirely on user-provided storage?

2. **Pricing Model**: If we build WatchNexus Cloud:
   - Free tier: 5GB, basic sync
   - Pro tier: Unlimited, real-time sync, backup history

3. **Multi-Server Sync**: Support syncing between multiple WatchNexus servers (e.g., home + remote)?

4. **Trakt.tv Integration**: Integrate with Trakt for universal watch history?

---

*Marshmallow 🍡 - Sweet, fluffy, and connects everything together.*
