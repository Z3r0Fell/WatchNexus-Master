"""
WatchNexus Security Module (Bastion)
Provides audit logging, IP filtering, API key management, and session tracking.
"""
import uuid
import json
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict
from pydantic import BaseModel
import logging

logger = logging.getLogger("bastion")


class AuditLog:
    def __init__(self, action: str, user_id: str, ip: str = "", details: str = ""):
        self.id = str(uuid.uuid4())
        self.action = action
        self.user_id = user_id
        self.ip = ip
        self.details = details
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self):
        return {
            "id": self.id,
            "action": self.action,
            "user_id": self.user_id,
            "ip": self.ip,
            "details": self.details,
            "timestamp": self.timestamp,
        }


class IpRule:
    def __init__(self, ip: str, rule_type: str = "block", reason: str = ""):
        self.id = str(uuid.uuid4())
        self.ip = ip
        self.rule_type = rule_type  # "block" or "allow"
        self.reason = reason
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.hits = 0

    def to_dict(self):
        return {
            "id": self.id,
            "ip": self.ip,
            "rule_type": self.rule_type,
            "reason": self.reason,
            "created_at": self.created_at,
            "hits": self.hits,
        }


class ApiKey:
    def __init__(self, name: str, permissions: List[str] = None):
        self.id = str(uuid.uuid4())
        self.name = name
        self.key = f"wnx_{secrets.token_hex(24)}"
        self.key_hash = hashlib.sha256(self.key.encode()).hexdigest()
        self.permissions = permissions or ["read"]
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.last_used = None
        self.is_active = True

    def to_dict(self, show_key=False):
        d = {
            "id": self.id,
            "name": self.name,
            "key_preview": self.key[:8] + "..." + self.key[-4:],
            "permissions": self.permissions,
            "created_at": self.created_at,
            "last_used": self.last_used,
            "is_active": self.is_active,
        }
        if show_key:
            d["key"] = self.key
        return d


class SecurityModule:
    """Bastion security module with in-memory audit trail and IP rules."""

    def __init__(self):
        self.audit_logs: List[AuditLog] = []
        self.ip_rules: List[IpRule] = []
        self.api_keys: List[ApiKey] = []
        self.sessions: Dict[str, dict] = {}
        self._rate_limits: Dict[str, List[float]] = {}

    def log_audit(self, action: str, user_id: str, ip: str = "", details: str = ""):
        log = AuditLog(action, user_id, ip, details)
        self.audit_logs.insert(0, log)
        if len(self.audit_logs) > 10000:
            self.audit_logs = self.audit_logs[:10000]
        return log

    def get_audit_logs(self, page: int = 1, page_size: int = 50, action: str = None, user_id: str = None):
        logs = self.audit_logs
        if action:
            logs = [l for l in logs if l.action == action]
        if user_id:
            logs = [l for l in logs if l.user_id == user_id]
        total = len(logs)
        start = (page - 1) * page_size
        return {
            "logs": [l.to_dict() for l in logs[start:start + page_size]],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def add_ip_rule(self, ip: str, rule_type: str = "block", reason: str = ""):
        rule = IpRule(ip, rule_type, reason)
        self.ip_rules.append(rule)
        return rule

    def remove_ip_rule(self, rule_id: str):
        self.ip_rules = [r for r in self.ip_rules if r.id != rule_id]

    def create_api_key(self, name: str, permissions: List[str] = None):
        key = ApiKey(name, permissions)
        self.api_keys.append(key)
        return key

    def revoke_api_key(self, key_id: str):
        for key in self.api_keys:
            if key.id == key_id:
                key.is_active = False
                return True
        return False

    def track_session(self, session_id: str, user_id: str, ip: str = "", user_agent: str = ""):
        self.sessions[session_id] = {
            "id": session_id,
            "user_id": user_id,
            "ip": ip,
            "user_agent": user_agent,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "last_active": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
        }

    def revoke_session(self, session_id: str):
        if session_id in self.sessions:
            self.sessions[session_id]["is_active"] = False
            return True
        return False

    def get_stats(self):
        active_sessions = sum(1 for s in self.sessions.values() if s["is_active"])
        return {
            "total_audit_logs": len(self.audit_logs),
            "ip_rules_count": len(self.ip_rules),
            "blocked_ips": sum(1 for r in self.ip_rules if r.rule_type == "block"),
            "allowed_ips": sum(1 for r in self.ip_rules if r.rule_type == "allow"),
            "active_api_keys": sum(1 for k in self.api_keys if k.is_active),
            "total_api_keys": len(self.api_keys),
            "active_sessions": active_sessions,
            "total_sessions": len(self.sessions),
            "owasp_headers": True,
            "rate_limiting": True,
            "csrf_protection": True,
        }


# Singleton
_security_module = None

def get_security_module() -> SecurityModule:
    global _security_module
    if _security_module is None:
        _security_module = SecurityModule()
    return _security_module
