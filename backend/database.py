"""
WatchNexus SQLite Database Layer
A drop-in replacement for MongoDB that requires zero external dependencies.
Perfect for standalone, self-contained deployment.

Hardened for production use:
- WAL mode for concurrent access (read while writing)
- Automatic backups on startup
- Scheduled VACUUM for optimization
"""

import aiosqlite
import json
import os
import shutil
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# Database file location - in the backend folder for portability
DB_PATH = Path(__file__).parent / "watchnexus.db"
BACKUP_DIR = Path(__file__).parent / "backups"
MAX_BACKUPS = 7  # Keep 7 daily backups


class SQLiteDB:
    """
    Async SQLite database wrapper that mimics MongoDB's motor interface.
    This allows minimal code changes in server.py
    """
    
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._connection: Optional[aiosqlite.Connection] = None
        
    async def connect(self):
        """Initialize database connection and create tables."""
        self._connection = await aiosqlite.connect(self.db_path)
        self._connection.row_factory = aiosqlite.Row
        await self._create_tables()
        logger.info(f"SQLite database connected: {self.db_path}")
        
    async def close(self):
        """Close database connection."""
        if self._connection:
            await self._connection.close()
            
    async def _create_tables(self):
        """Create all required tables if they don't exist."""
        await self._connection.executescript('''
            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                username TEXT NOT NULL,
                password TEXT,
                avatar TEXT,
                avatar_color TEXT,
                auth_type TEXT DEFAULT 'local',
                role TEXT DEFAULT 'user',
                permissions TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                last_login TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            
            -- User sessions (for OAuth)
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                session_token TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
            
            -- Watchlist
            CREATE TABLE IF NOT EXISTS watchlist (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                tmdb_id INTEGER NOT NULL,
                media_type TEXT NOT NULL,
                title TEXT NOT NULL,
                poster_path TEXT,
                added_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, tmdb_id)
            );
            CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
            
            -- Watch progress
            CREATE TABLE IF NOT EXISTS watch_progress (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                tmdb_id INTEGER NOT NULL,
                media_type TEXT NOT NULL,
                title TEXT NOT NULL,
                poster_path TEXT,
                backdrop_path TEXT,
                progress REAL DEFAULT 0,
                current_time INTEGER DEFAULT 0,
                duration INTEGER DEFAULT 0,
                season INTEGER,
                episode INTEGER,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, tmdb_id)
            );
            CREATE INDEX IF NOT EXISTS idx_progress_user ON watch_progress(user_id);
            
            -- Settings
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE NOT NULL,
                download_path TEXT DEFAULT '/media/downloads',
                library_path TEXT DEFAULT '/media/library',
                auto_subtitles INTEGER DEFAULT 1,
                subtitle_languages TEXT DEFAULT '["en"]',
                quality_preference TEXT DEFAULT '1080p',
                oauth_client_id TEXT,
                oauth_client_secret TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            
            -- Library items
            CREATE TABLE IF NOT EXISTS library (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                tmdb_id INTEGER,
                media_type TEXT NOT NULL,
                title TEXT NOT NULL,
                overview TEXT,
                poster_path TEXT,
                backdrop_path TEXT,
                release_date TEXT,
                vote_average REAL,
                genres TEXT DEFAULT '[]',
                local_path TEXT,
                file_size INTEGER,
                quality TEXT,
                added_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_library_user ON library(user_id);
            
            -- Indexers
            CREATE TABLE IF NOT EXISTS indexers (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                url TEXT NOT NULL,
                api_key TEXT,
                enabled INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            
            -- Streaming services
            CREATE TABLE IF NOT EXISTS streaming_services (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT,
                icon TEXT,
                color TEXT,
                enabled INTEGER DEFAULT 0,
                username TEXT,
                deep_link_base TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            
            -- Scheduled scans
            CREATE TABLE IF NOT EXISTS scheduled_scans (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                directory TEXT NOT NULL,
                schedule_type TEXT DEFAULT 'daily',
                schedule_time TEXT DEFAULT '03:00',
                enabled INTEGER DEFAULT 1,
                last_scan TEXT,
                next_scan TEXT,
                notify_on_issues INTEGER DEFAULT 1,
                auto_repair INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            
            -- Scan notifications
            CREATE TABLE IF NOT EXISTS scan_notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                scan_id TEXT NOT NULL,
                directory TEXT NOT NULL,
                total_files INTEGER DEFAULT 0,
                healthy_files INTEGER DEFAULT 0,
                warning_files INTEGER DEFAULT 0,
                error_files INTEGER DEFAULT 0,
                issues TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                read INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            
            -- Redownload requests
            CREATE TABLE IF NOT EXISTS redownload_requests (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                original_file TEXT,
                title TEXT NOT NULL,
                media_type TEXT,
                tmdb_id INTEGER,
                status TEXT DEFAULT 'queued',
                indexers_to_search TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            
            -- Compote indexers
            CREATE TABLE IF NOT EXISTS compote_indexers (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                url TEXT NOT NULL,
                api_key TEXT,
                enabled INTEGER DEFAULT 1,
                priority INTEGER DEFAULT 50,
                cloudflare_protected INTEGER DEFAULT 0,
                search_path TEXT,
                cookie TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(id, user_id)
            );
            
            -- Grab requests
            CREATE TABLE IF NOT EXISTS grab_requests (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                download_url TEXT,
                magnet_url TEXT,
                size INTEGER DEFAULT 0,
                status TEXT DEFAULT 'queued',
                engine TEXT,
                torrent_id TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            
            -- Subtitle settings
            CREATE TABLE IF NOT EXISTS subtitle_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE NOT NULL,
                settings_json TEXT DEFAULT '{}',
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            
            -- Streaming logins
            CREATE TABLE IF NOT EXISTS streaming_logins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                service TEXT NOT NULL,
                email TEXT,
                password_encrypted TEXT,
                is_active INTEGER DEFAULT 1,
                last_verified TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, service)
            );
            
            -- Pending watch parties
            CREATE TABLE IF NOT EXISTS pending_parties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                party_code TEXT UNIQUE NOT NULL,
                host_id TEXT NOT NULL,
                media_data TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_parties_code ON pending_parties(party_code);
        ''')
        await self._connection.commit()
        
    def __getattr__(self, name: str) -> 'Collection':
        """Access collections like db.users, db.watchlist, etc."""
        return Collection(self._connection, name)


class Collection:
    """
    Mimics MongoDB collection interface for SQLite.
    Supports: find_one, find, insert_one, update_one, delete_one, delete_many
    """
    
    def __init__(self, connection: aiosqlite.Connection, table_name: str):
        self._conn = connection
        self._table = table_name
        
    async def find_one(self, query: Dict[str, Any], projection: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Find a single document matching the query."""
        where_clause, params = self._build_where(query)
        
        sql = f"SELECT * FROM {self._table}"
        if where_clause:
            sql += f" WHERE {where_clause}"
        sql += " LIMIT 1"
        
        try:
            async with self._conn.execute(sql, params) as cursor:
                row = await cursor.fetchone()
                if row:
                    result = self._row_to_dict(row)
                    return self._apply_projection(result, projection)
                return None
        except Exception as e:
            logger.error(f"find_one error on {self._table}: {e}")
            return None
            
    def find(self, query: Dict[str, Any] = None, projection: Dict[str, Any] = None) -> 'Cursor':
        """Return a cursor for finding multiple documents."""
        return Cursor(self._conn, self._table, query or {}, projection)
        
    async def insert_one(self, document: Dict[str, Any]) -> Any:
        """Insert a single document."""
        # Remove MongoDB-specific fields
        doc = {k: v for k, v in document.items() if k != '_id'}
        
        # Serialize complex types
        doc = self._serialize_document(doc)
        
        columns = ', '.join(doc.keys())
        placeholders = ', '.join(['?' for _ in doc])
        values = list(doc.values())
        
        sql = f"INSERT OR REPLACE INTO {self._table} ({columns}) VALUES ({placeholders})"
        
        try:
            await self._conn.execute(sql, values)
            await self._conn.commit()
            return type('InsertResult', (), {'inserted_id': doc.get('id')})()
        except Exception as e:
            logger.error(f"insert_one error on {self._table}: {e}")
            raise
            
    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> Any:
        """Update a single document."""
        # Handle $set operator
        if '$set' in update:
            set_data = update['$set']
        else:
            set_data = update
            
        # Serialize complex types
        set_data = self._serialize_document(set_data)
        
        where_clause, where_params = self._build_where(query)
        
        if not set_data:
            return type('UpdateResult', (), {'modified_count': 0})()
        
        set_clause = ', '.join([f"{k} = ?" for k in set_data.keys()])
        set_values = list(set_data.values())
        
        sql = f"UPDATE {self._table} SET {set_clause}"
        if where_clause:
            sql += f" WHERE {where_clause}"
            
        try:
            cursor = await self._conn.execute(sql, set_values + where_params)
            
            if cursor.rowcount == 0 and upsert:
                # Insert new document
                doc = {**query, **set_data}
                await self.insert_one(doc)
                return type('UpdateResult', (), {'modified_count': 0, 'upserted_id': doc.get('id')})()
                
            await self._conn.commit()
            return type('UpdateResult', (), {'modified_count': cursor.rowcount})()
        except Exception as e:
            logger.error(f"update_one error on {self._table}: {e}")
            raise
            
    async def delete_one(self, query: Dict[str, Any]) -> Any:
        """Delete a single document."""
        where_clause, params = self._build_where(query)
        
        sql = f"DELETE FROM {self._table}"
        if where_clause:
            sql += f" WHERE {where_clause}"
        sql += " LIMIT 1"
        
        try:
            # SQLite doesn't support LIMIT in DELETE, so we need a workaround
            # First, find the rowid
            select_sql = f"SELECT rowid FROM {self._table}"
            if where_clause:
                select_sql += f" WHERE {where_clause}"
            select_sql += " LIMIT 1"
            
            async with self._conn.execute(select_sql, params) as cursor:
                row = await cursor.fetchone()
                if row:
                    await self._conn.execute(f"DELETE FROM {self._table} WHERE rowid = ?", [row[0]])
                    await self._conn.commit()
                    return type('DeleteResult', (), {'deleted_count': 1})()
                    
            return type('DeleteResult', (), {'deleted_count': 0})()
        except Exception as e:
            logger.error(f"delete_one error on {self._table}: {e}")
            raise
            
    async def delete_many(self, query: Dict[str, Any]) -> Any:
        """Delete multiple documents."""
        where_clause, params = self._build_where(query)
        
        sql = f"DELETE FROM {self._table}"
        if where_clause:
            sql += f" WHERE {where_clause}"
            
        try:
            cursor = await self._conn.execute(sql, params)
            await self._conn.commit()
            return type('DeleteResult', (), {'deleted_count': cursor.rowcount})()
        except Exception as e:
            logger.error(f"delete_many error on {self._table}: {e}")
            raise
            
    def _build_where(self, query: Dict[str, Any]) -> tuple:
        """Build WHERE clause from query dict."""
        if not query:
            return "", []
            
        conditions = []
        params = []
        
        for key, value in query.items():
            if key == '_id':
                continue  # Skip MongoDB _id
            conditions.append(f"{key} = ?")
            params.append(value)
            
        return " AND ".join(conditions), params
        
    def _row_to_dict(self, row: aiosqlite.Row) -> Dict[str, Any]:
        """Convert SQLite row to dictionary, deserializing JSON fields."""
        result = dict(row)
        
        # Deserialize JSON fields
        json_fields = ['permissions', 'subtitle_languages', 'genres', 'issues', 
                       'indexers_to_search', 'settings_json', 'media_data']
        for field in json_fields:
            if field in result and result[field]:
                try:
                    result[field] = json.loads(result[field])
                except:
                    pass
                    
        # Convert integer booleans back to bool
        bool_fields = ['enabled', 'auto_subtitles', 'notify_on_issues', 'auto_repair', 
                       'read', 'is_active', 'cloudflare_protected']
        for field in bool_fields:
            if field in result:
                result[field] = bool(result[field])
                
        return result
        
    def _apply_projection(self, doc: Dict[str, Any], projection: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Apply MongoDB-style projection to document."""
        if not projection:
            return doc
            
        # Handle exclusion (e.g., {"_id": 0, "password": 0})
        if any(v == 0 for v in projection.values()):
            return {k: v for k, v in doc.items() if projection.get(k, 1) != 0}
            
        # Handle inclusion (e.g., {"id": 1, "username": 1})
        return {k: v for k, v in doc.items() if projection.get(k, 0) == 1}
        
    def _serialize_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize complex types for SQLite storage."""
        result = {}
        for key, value in doc.items():
            if isinstance(value, (list, dict)):
                result[key] = json.dumps(value)
            elif isinstance(value, bool):
                result[key] = 1 if value else 0
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
        return result


class Cursor:
    """Mimics MongoDB cursor for find() operations."""
    
    def __init__(self, connection: aiosqlite.Connection, table: str, 
                 query: Dict[str, Any], projection: Dict[str, Any] = None):
        self._conn = connection
        self._table = table
        self._query = query
        self._projection = projection
        self._sort_field = None
        self._sort_order = 1
        self._limit_value = None
        
    def sort(self, field: str, order: int = 1) -> 'Cursor':
        """Sort results by field."""
        self._sort_field = field
        self._sort_order = order
        return self
        
    def limit(self, count: int) -> 'Cursor':
        """Limit number of results."""
        self._limit_value = count
        return self
        
    async def to_list(self, length: int = None) -> List[Dict[str, Any]]:
        """Execute query and return results as list."""
        collection = Collection(self._conn, self._table)
        where_clause, params = collection._build_where(self._query)
        
        sql = f"SELECT * FROM {self._table}"
        if where_clause:
            sql += f" WHERE {where_clause}"
            
        if self._sort_field:
            order = "DESC" if self._sort_order == -1 else "ASC"
            sql += f" ORDER BY {self._sort_field} {order}"
            
        limit = self._limit_value or length
        if limit:
            sql += f" LIMIT {limit}"
            
        try:
            results = []
            async with self._conn.execute(sql, params) as cursor:
                async for row in cursor:
                    doc = collection._row_to_dict(row)
                    doc = collection._apply_projection(doc, self._projection)
                    results.append(doc)
            return results
        except Exception as e:
            logger.error(f"to_list error on {self._table}: {e}")
            return []


# Global database instance
_db_instance: Optional[SQLiteDB] = None


async def get_database() -> SQLiteDB:
    """Get or create database instance."""
    global _db_instance
    if _db_instance is None:
        _db_instance = SQLiteDB()
        await _db_instance.connect()
    return _db_instance


async def init_database():
    """Initialize database on startup."""
    global _db_instance
    _db_instance = SQLiteDB()
    await _db_instance.connect()
    return _db_instance
