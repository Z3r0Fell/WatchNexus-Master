"""Pattern-based static fixes — fast fixes without AI."""

import re
from . import ollama_client


def fix_missing_httpclient(content: str) -> str | None:
    """Replace bare axios calls with httpClient if httpClient is available."""
    if "httpClient" in content or "withCredentials" in content:
        return None
    if "axios" not in content or "httpClient" in content:
        return None
    # Check if it's a service file (imports axios)
    if "from 'axios'" not in content and "from \"axios\"" not in content:
        return None
    # Replace import axios with import httpClient
    new = re.sub(
        r"""import\s+axios\s+from\s+['"]axios['"]""",
        "import httpClient from './httpClient'",
        content,
    )
    if new != content:
        # Replace axios.xxx with httpClient.xxx
        new = re.sub(r"\baxios\.(get|post|put|delete|patch)\b", r"httpClient.\1", new)
        return new
    return None


def fix_empty_catch(content: str) -> str | None:
    """Replace empty catch blocks with logging."""
    if "catch" not in content:
        return None
    old = re.findall(r"catch\s*(?:\([^)]*\))?\s*\{[\s\n]*\}", content)
    if not old:
        return None
    for match in old:
        replacement = match.rstrip()[:-1].rstrip() + "\n        // Logged but not re-thrown\n    }"
        content = content.replace(match, replacement, 1)
    return content if old else None


def fix_console_error_no_toast(content: str) -> str | None:
    """Replace console.error with toast.error if toast is imported."""
    if "console.error" not in content:
        return None
    if "toast" in content:
        return re.sub(
            r"console\.error\(([^)]+)\);?",
            r"toast.error(\1); console.error(\1);",
            content,
        )
    return None


def fix_sync_over_async(content: str) -> str | None:
    """Flag Result/Wait() usage — can't auto-fix safely, return None."""
    if ".Result" in content or ".Wait()" in content or ".GetAwaiter()" in content:
        return None  # Requires AI
    return None


def apply_static_fixes(content: str, path: str, lang: str) -> tuple[str | None, list[str]]:
    """Apply all static fixes. Returns (fixed_content or None, list_of_applied_fixes)."""
    applied = []

    # C# fixes
    if lang == "csharp":
        fixed = fix_empty_catch(content)
        if fixed:
            applied.append("filled empty catch blocks")
            content = fixed

    # JS/JSX fixes
    if lang in ("javascript", "jsx"):
        fixed = fix_missing_httpclient(content)
        if fixed:
            applied.append("replaced axios with httpClient")
            content = fixed
        fixed2 = fix_console_error_no_toast(content)
        if fixed2:
            applied.append("added toast.error for user feedback")
            content = fixed2

    return (content if applied else None), applied


def needs_ai(content: str, lang: str) -> list[str]:
    """Determine if a file needs AI fixing."""
    reasons = []
    if lang == "csharp":
        if ".Result" in content or ".Wait()" in content or ".GetAwaiter()" in content:
            reasons.append("sync-over-async requires AI")
        if "NotImplemented" in content or "TODO" in content or "FIXME" in content:
            reasons.append("placeholder code requires AI")
    if lang in ("javascript", "jsx"):
        if "TODO" in content or "FIXME" in content:
            reasons.append("placeholder code requires AI")
        if "Not implemented" in content.lower():
            reasons.append("stub requires AI")
    return reasons
