"""
Discord Notifications Plugin for WatchNexus
Sends notifications to Discord channels via webhooks.
"""

import httpx
import logging
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from gadgets import NotificationProvider

logger = logging.getLogger(__name__)


class DiscordNotifyPlugin(NotificationProvider):
    """
    Discord notification provider for WatchNexus.
    Sends rich embeds to Discord channels via webhooks.
    """
    
    @property
    def name(self) -> str:
        return "Discord Notifications"
    
    @property
    def plugin_id(self) -> str:
        return "discord-notify"
    
    @property
    def version(self) -> str:
        return "1.0.0"
    
    @property
    def description(self) -> str:
        return "Send notifications to Discord channels via webhooks"
    
    @property
    def author(self) -> str:
        return "WatchNexus"
    
    def get_settings_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "webhook_url": {
                    "type": "string",
                    "title": "Webhook URL",
                    "description": "Discord webhook URL"
                },
                "username": {
                    "type": "string",
                    "title": "Bot Username",
                    "default": "WatchNexus"
                },
                "avatar_url": {
                    "type": "string",
                    "title": "Avatar URL"
                },
                "notify_on_download": {
                    "type": "boolean",
                    "title": "Notify on Download",
                    "default": True
                },
                "notify_on_library": {
                    "type": "boolean",
                    "title": "Notify on Library Update",
                    "default": True
                }
            }
        }
    
    async def initialize(self) -> bool:
        """Initialize the plugin."""
        webhook_url = self._settings.get("webhook_url")
        
        if not webhook_url:
            logger.warning("Discord webhook URL not configured")
            return True  # Still initialize, just won't send
        
        logger.info("Discord Notifications plugin initialized")
        return True
    
    async def shutdown(self):
        """Cleanup when plugin is disabled."""
        logger.info("Discord Notifications plugin shutdown")
    
    async def send(
        self,
        title: str,
        message: str,
        level: str = "info",
        **kwargs
    ) -> bool:
        """
        Send notification to Discord.
        
        Args:
            title: Notification title
            message: Notification message
            level: Notification level (info, success, warning, error)
            **kwargs: Additional options (image_url, fields, etc.)
        
        Returns:
            True if sent successfully
        """
        webhook_url = self._settings.get("webhook_url")
        
        if not webhook_url:
            logger.warning("Cannot send Discord notification: webhook not configured")
            return False
        
        # Color based on level
        colors = {
            "info": 0x3B82F6,      # Blue
            "success": 0x22C55E,   # Green
            "warning": 0xF59E0B,   # Orange
            "error": 0xEF4444,     # Red
        }
        
        # Build embed
        embed = {
            "title": title,
            "description": message,
            "color": colors.get(level, colors["info"]),
            "footer": {
                "text": "WatchNexus",
            },
        }
        
        # Add optional image
        if kwargs.get("image_url"):
            embed["thumbnail"] = {"url": kwargs["image_url"]}
        
        # Add optional fields
        if kwargs.get("fields"):
            embed["fields"] = kwargs["fields"]
        
        # Build payload
        payload = {
            "username": self._settings.get("username", "WatchNexus"),
            "embeds": [embed],
        }
        
        if self._settings.get("avatar_url"):
            payload["avatar_url"] = self._settings["avatar_url"]
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook_url,
                    json=payload,
                    timeout=10.0
                )
                
                if response.status_code in [200, 204]:
                    logger.info(f"Discord notification sent: {title}")
                    return True
                else:
                    logger.error(f"Discord webhook error: {response.status_code}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to send Discord notification: {e}")
            return False
    
    def get_api_routes(self):
        """Register custom API routes."""
        return [
            {
                "path": "/discord-notify/test",
                "method": "POST",
                "handler": self._test_webhook,
                "description": "Test Discord webhook"
            }
        ]
    
    async def _test_webhook(self):
        """Test the Discord webhook configuration."""
        success = await self.test()
        return {"success": success}


# Export the plugin class
Plugin = DiscordNotifyPlugin
