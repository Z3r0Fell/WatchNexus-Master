"""
Ripen - WatchNexus Gadget Lifecycle Engine
Manages installation, activation, deactivation, and removal of gadgets.
Each gadget declares UI hooks (sidebar entries, routes, settings panels).
"""

import aiosqlite
import json
from datetime import datetime, timezone
from typing import Optional
from gadgets_catalogue import GADGETS_CATALOGUE

# Gadget UI hook definitions - what each gadget does when installed
GADGET_HOOKS = {
    # ==================== PAGE-CREATING GADGETS ====================
    "wn-gallery-viewer": {
        "sidebar": {"label": "Photos", "icon": "Image", "path": "/photos", "section": "media"},
        "route": "/photos",
        "page_type": "photos",
    },
    "wn-arcade-retroarch": {
        "sidebar": {"label": "Games", "icon": "Gamepad2", "path": "/games", "section": "media"},
        "route": "/games",
        "page_type": "games",
    },
    "wn-cadence-radio": {
        "sidebar": {"label": "Radio", "icon": "Radio", "path": "/radio", "section": "media"},
        "route": "/radio",
        "page_type": "radio",
    },
    "wn-rhythm-podcast": {
        "sidebar": {"label": "Podcasts", "icon": "Podcast", "path": "/podcasts", "section": "media"},
        "route": "/podcasts",
        "page_type": "podcasts",
    },
    "wn-mosaic-youtube": {
        "sidebar": {"label": "Web Video", "icon": "MonitorPlay", "path": "/web-video", "section": "media"},
        "route": "/web-video",
        "page_type": "web_video",
    },
    "wn-forecast-weather": {
        "dashboard_widget": "weather",
        "settings_panel": {"section": "general", "component": "WeatherSettings"},
    },
    "wn-aurora-screensaver": {
        "settings_panel": {"section": "playback", "component": "ScreensaverSettings"},
    },

    # ==================== SETTINGS-PANEL GADGETS ====================
    "wn-atlas-metadata": {
        "settings_panel": {"section": "library", "component": "AtlasMetadataConfig"},
        "provider_type": "metadata",
    },
    "wn-chronicle-nfo": {
        "settings_panel": {"section": "library", "component": "ChronicleNfoConfig"},
        "provider_type": "metadata",
    },
    "wn-sakura-anidb": {
        "settings_panel": {"section": "library", "component": "SakuraAnidbConfig"},
        "provider_type": "metadata",
    },
    "wn-vinyl-musicbrainz": {
        "settings_panel": {"section": "library", "component": "VinylMusicConfig"},
        "provider_type": "metadata",
    },
    "wn-almanac-fanart": {
        "settings_panel": {"section": "library", "component": "AlmanacFanartConfig"},
        "provider_type": "metadata",
    },
    "wn-lexicon-omdb": {
        "settings_panel": {"section": "library", "component": "LexiconOmdbConfig"},
        "provider_type": "metadata",
    },

    # Subtitles
    "wn-babel-opensubtitles": {
        "settings_panel": {"section": "subtitles", "component": "BabelSubtitleConfig"},
        "provider_type": "subtitle",
    },
    "wn-quill-subscene": {
        "settings_panel": {"section": "subtitles", "component": "QuillSubtitleConfig"},
        "provider_type": "subtitle",
    },
    "wn-verse-addic7ed": {
        "settings_panel": {"section": "subtitles", "component": "VerseSubtitleConfig"},
        "provider_type": "subtitle",
    },
    "wn-echo-subtitle-sync": {
        "settings_panel": {"section": "subtitles", "component": "EchoSyncConfig"},
        "provider_type": "subtitle",
    },

    # Notifications
    "wn-herald-discord": {
        "settings_panel": {"section": "notifications", "component": "DiscordNotifConfig"},
        "provider_type": "notification",
    },
    "wn-courier-telegram": {
        "settings_panel": {"section": "notifications", "component": "TelegramNotifConfig"},
        "provider_type": "notification",
    },
    "wn-signal-pushover": {
        "settings_panel": {"section": "notifications", "component": "PushoverNotifConfig"},
        "provider_type": "notification",
    },
    "wn-dispatch-email": {
        "settings_panel": {"section": "notifications", "component": "EmailNotifConfig"},
        "provider_type": "notification",
    },
    "wn-beacon-slack": {
        "settings_panel": {"section": "notifications", "component": "SlackNotifConfig"},
        "provider_type": "notification",
    },

    # Themes
    "wn-obsidian-theme": {"theme_preset": "obsidian"},
    "wn-arctic-theme": {"theme_preset": "arctic"},
    "wn-sakura-bloom-theme": {"theme_preset": "sakura_bloom"},
    "wn-retro-crt-theme": {"theme_preset": "retro_crt"},

    # Video
    "wn-prism-iptv": {
        "settings_panel": {"section": "iptv", "component": "PrismIptvConfig"},
        "enhances_page": "/iptv",
    },
    "wn-meridian-upnp": {
        "settings_panel": {"section": "streaming", "component": "MeridianUpnpConfig"},
        "provider_type": "streaming",
    },
    "wn-archive-trakt": {
        "settings_panel": {"section": "streaming", "component": "ArchiveTraktConfig"},
        "provider_type": "sync",
    },

    # Audio
    "wn-sonata-lyrics": {
        "enhances_page": "/music",
        "settings_panel": {"section": "playback", "component": "SonataLyricsConfig"},
    },

    # Indexers
    "wn-compass-torznab": {
        "settings_panel": {"section": "indexers", "component": "CompassTorznabConfig"},
        "provider_type": "indexer",
    },
    "wn-scope-newznab": {
        "settings_panel": {"section": "indexers", "component": "ScopeNewznabConfig"},
        "provider_type": "indexer",
    },
    "wn-rover-rss": {
        "settings_panel": {"section": "indexers", "component": "RoverRssConfig"},
        "provider_type": "indexer",
    },

    # System
    "wn-sentinel-health": {"enhances_page": "/settings/maintenance"},
    "wn-vault-backup": {
        "settings_panel": {"section": "maintenance", "component": "VaultBackupConfig"},
    },
    "wn-curator-cleanup": {
        "settings_panel": {"section": "maintenance", "component": "CuratorCleanupConfig"},
    },
    "wn-warden-auth-ldap": {
        "settings_panel": {"section": "users", "component": "WardenLdapConfig"},
        "provider_type": "auth",
    },

    # Programs
    "wn-forge-transcoder": {
        "settings_panel": {"section": "streaming", "component": "ForgeTranscoderConfig"},
    },
    "wn-matrix-remote": {
        "settings_panel": {"section": "general", "component": "MatrixRemoteConfig"},
    },
    "wn-nexus-api-bridge": {
        "settings_panel": {"section": "gelatin", "component": "NexusApiBridgeConfig"},
    },

    # Background services
    "wn-shepherd-watchdog": {"background_service": True},
    "wn-cron-scheduler": {
        "settings_panel": {"section": "maintenance", "component": "ClockworkSchedulerConfig"},
    },
    "wn-shortcut-context": {"context_menu": True},
    "wn-atlas-language-pack": {"resource_pack": "language"},
    "wn-icon-pack-neon": {"resource_pack": "icons"},
}


class RipenEngine:
    """Gadget Lifecycle Engine."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._initialized = False

    async def initialize(self):
        """Create the installed_gadgets table if it doesn't exist."""
        if self._initialized:
            return
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS installed_gadgets (
                    gadget_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    plugin_type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    config TEXT DEFAULT '{}',
                    installed_at TEXT NOT NULL,
                    updated_at TEXT
                )
            """)
            await db.commit()
        self._initialized = True

    async def get_installed(self) -> list:
        """Get all installed gadgets with their hooks."""
        await self.initialize()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM installed_gadgets")
            rows = await cursor.fetchall()
            result = []
            for row in rows:
                gadget = dict(row)
                gadget["config"] = json.loads(gadget.get("config", "{}"))
                gadget["hooks"] = GADGET_HOOKS.get(gadget["gadget_id"], {})
                # Merge catalogue data
                cat_item = next((g for g in GADGETS_CATALOGUE if g["id"] == gadget["gadget_id"]), None)
                if cat_item:
                    gadget["description"] = cat_item.get("description", "")
                    gadget["tags"] = cat_item.get("tags", [])
                    gadget["version"] = cat_item.get("version", "1.0.0")
                    gadget["author"] = cat_item.get("author", "WatchNexus Team")
                result.append(gadget)
            return result

    async def get_active_hooks(self) -> dict:
        """Get aggregated UI hooks from all active gadgets."""
        installed = await self.get_installed()
        hooks = {
            "sidebar_entries": [],
            "routes": [],
            "settings_panels": [],
            "dashboard_widgets": [],
            "theme_presets": [],
            "providers": {"metadata": [], "subtitle": [], "notification": [], "indexer": [], "streaming": [], "sync": [], "auth": []},
            "enhanced_pages": [],
            "background_services": [],
        }

        for gadget in installed:
            if gadget["status"] != "active":
                continue
            gid = gadget["gadget_id"]
            
            # Check if gadget is supported in the catalogue
            cat_item = next((g for g in GADGETS_CATALOGUE if g["id"] == gid), None)
            if cat_item and not cat_item.get("supported", False):
                # Skip unsupported gadgets - don't show them in UI
                continue
            
            gh = GADGET_HOOKS.get(gid, {})

            if "sidebar" in gh:
                hooks["sidebar_entries"].append({**gh["sidebar"], "gadget_id": gid})
            if "route" in gh:
                hooks["routes"].append({"path": gh["route"], "page_type": gh.get("page_type"), "gadget_id": gid})
            if "settings_panel" in gh:
                hooks["settings_panels"].append({**gh["settings_panel"], "gadget_id": gid, "gadget_name": gadget["name"]})
            if "dashboard_widget" in gh:
                hooks["dashboard_widgets"].append({"type": gh["dashboard_widget"], "gadget_id": gid})
            if "theme_preset" in gh:
                hooks["theme_presets"].append({"preset": gh["theme_preset"], "gadget_id": gid, "name": gadget["name"]})
            if "provider_type" in gh:
                ptype = gh["provider_type"]
                if ptype in hooks["providers"]:
                    hooks["providers"][ptype].append({"gadget_id": gid, "name": gadget["name"], "config": gadget.get("config", {})})
            if "enhances_page" in gh:
                hooks["enhanced_pages"].append({"page": gh["enhances_page"], "gadget_id": gid})
            if gh.get("background_service"):
                hooks["background_services"].append({"gadget_id": gid})

        return hooks

    async def install(self, gadget_id: str) -> dict:
        """Install a gadget from the catalogue."""
        await self.initialize()
        cat_item = next((g for g in GADGETS_CATALOGUE if g["id"] == gadget_id), None)
        if not cat_item:
            raise ValueError(f"Gadget '{gadget_id}' not found in catalogue")

        # Block installation of unsupported gadgets
        if not cat_item.get("supported", False):
            note = cat_item.get("compatibility_note", "This gadget requires a feature that is not yet available in WatchNexus.")
            raise ValueError(f"Cannot install: {note}")

        now = datetime.now(timezone.utc).isoformat()
        async with aiosqlite.connect(self.db_path) as db:
            # Check if already installed
            cursor = await db.execute("SELECT gadget_id FROM installed_gadgets WHERE gadget_id = ?", (gadget_id,))
            existing = await cursor.fetchone()
            if existing:
                raise ValueError(f"Gadget '{gadget_id}' is already installed")

            await db.execute(
                "INSERT INTO installed_gadgets (gadget_id, name, category, plugin_type, status, config, installed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (gadget_id, cat_item["name"], cat_item["category"], cat_item["plugin_type"], "active", "{}", now)
            )
            await db.commit()

        return {
            "gadget_id": gadget_id,
            "name": cat_item["name"],
            "status": "active",
            "hooks": GADGET_HOOKS.get(gadget_id, {}),
        }

    async def uninstall(self, gadget_id: str) -> bool:
        """Remove a gadget."""
        await self.initialize()
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("DELETE FROM installed_gadgets WHERE gadget_id = ?", (gadget_id,))
            await db.commit()
            return cursor.rowcount > 0

    async def activate(self, gadget_id: str) -> bool:
        """Activate an installed gadget."""
        await self.initialize()
        async with aiosqlite.connect(self.db_path) as db:
            now = datetime.now(timezone.utc).isoformat()
            cursor = await db.execute(
                "UPDATE installed_gadgets SET status = 'active', updated_at = ? WHERE gadget_id = ?",
                (now, gadget_id)
            )
            await db.commit()
            return cursor.rowcount > 0

    async def deactivate(self, gadget_id: str) -> bool:
        """Deactivate an installed gadget."""
        await self.initialize()
        async with aiosqlite.connect(self.db_path) as db:
            now = datetime.now(timezone.utc).isoformat()
            cursor = await db.execute(
                "UPDATE installed_gadgets SET status = 'inactive', updated_at = ? WHERE gadget_id = ?",
                (now, gadget_id)
            )
            await db.commit()
            return cursor.rowcount > 0

    async def update_config(self, gadget_id: str, config: dict) -> bool:
        """Update a gadget's configuration."""
        await self.initialize()
        async with aiosqlite.connect(self.db_path) as db:
            now = datetime.now(timezone.utc).isoformat()
            cursor = await db.execute(
                "UPDATE installed_gadgets SET config = ?, updated_at = ? WHERE gadget_id = ?",
                (json.dumps(config), now, gadget_id)
            )
            await db.commit()
            return cursor.rowcount > 0

    async def is_installed(self, gadget_id: str) -> bool:
        """Check if a gadget is installed."""
        await self.initialize()
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("SELECT gadget_id FROM installed_gadgets WHERE gadget_id = ?", (gadget_id,))
            return await cursor.fetchone() is not None


# Singleton
_ripen_engine: Optional[RipenEngine] = None

def get_ripen_engine(db_path: str = "database.db") -> RipenEngine:
    global _ripen_engine
    if _ripen_engine is None:
        _ripen_engine = RipenEngine(db_path)
    return _ripen_engine
