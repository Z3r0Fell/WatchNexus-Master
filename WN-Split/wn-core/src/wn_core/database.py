"""Database connection management"""
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

_client: Optional[AsyncIOMotorClient] = None
_db = None

class DatabaseManager:
    """Manages MongoDB connections"""
    
    def __init__(self, mongo_url: str, db_name: str):
        self.mongo_url = mongo_url
        self.db_name = db_name
        self.client = None
        self.db = None
    
    async def connect(self):
        self.client = AsyncIOMotorClient(self.mongo_url)
        self.db = self.client[self.db_name]
        return self.db
    
    async def disconnect(self):
        if self.client:
            self.client.close()

def get_database():
    """Get the current database instance"""
    global _db
    return _db
