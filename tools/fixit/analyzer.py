"""File analyzer — detects issues in source files."""

import re
from .ollama_client import analyze_code as ai_analyze

# Patterns that indicate incomplete code
PLACEHOLDER_PATTERNS = [
    r"\bTODO\b",
    r"\bFIXME\b",
    r"\bHACK\b",
    r"\bXXX\b",
    r"throw\s+new\s+(NotImplementedException|NotSupportedException)",
    r"console\.(log|error)\(['\"`]TODO",
    r"\/\/\s*(TODO|FIXME|HACK|XXX)",
    r"#\s*(TODO|FIXME|HACK)",
    r"<!--\s*(TODO|FIXME)",
    r"\{\s*\/\*\s*(TODO|FIXME)",
    r"placeholder",
    r"stub",
    r"scaffold",
    r"not\s+implemented",
    r"to\s+do",
    r"come\s+back\s+to",
    r"temp_workaround",
    r"temporary\s+fix",
    r"\/\/\s*@ts-ignore",
    r"@ts-expect-error",
]

# Empty catch blocks
EMPTY_CATCH = re.compile(r"catch\s*(\[\w+\])?\s*\{[\s\n]*\}")

# console.error without user feedback
CONSOLE_ERROR = re.compile(r"console\.error")

# JavaScript: missing withCredentials
MISSING_CREDENTIALS = re.compile(r"axios\.(get|post|put|delete|patch)\(")

# C#: empty catch
CS_EMPTY_CATCH = re.compile(r"catch\s*\([^)]*\)\s*\{[\s\n]*\}")

# C#: sync-over-async pattern
SYNC_OVER_ASYNC = re.compile(r"\.Result\b|\.Wait\(\)|\.GetAwaiter\(\)\.GetResult\(\)")

# C#: N+1 query pattern (Select inside loop without Include)
NPLUS_ONE = re.compile(r"foreach.*\.Include")

# Missing React import
MISSING_REACT_IMPORT = re.compile(r"import\s+React")

# Hardcoded secrets
HARDCODED_SECRET = re.compile(r"['\"][A-Za-z0-9_\-]{40,}['\"]")


def detect_placeholder_issues(content: str) -> list[dict]:
    """Find lines with placeholder/stub patterns."""
    issues = []
    for i, line in enumerate(content.split("\n"), 1):
        for pattern in PLACEHOLDER_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                issues.append({
                    "type": "placeholder",
                    "line": i,
                    "detail": line.strip()[:120],
                    "severity": "medium",
                })
                break
    return issues


def detect_empty_catch(content: str, language: str) -> list[dict]:
    """Find empty catch blocks."""
    issues = []
    if language == "csharp":
        for m in CS_EMPTY_CATCH.finditer(content):
            line = content[:m.start()].count("\n") + 1
            issues.append({
                "type": "empty_catch",
                "line": line,
                "detail": "Empty catch block — hides errors",
                "severity": "high",
            })
    return issues


def detect_sync_over_async(content: str) -> list[dict]:
    """Find sync-over-async patterns."""
    issues = []
    for m in SYNC_OVER_ASYNC.finditer(content):
        line = content[:m.start()].count("\n") + 1
        issues.append({
            "type": "sync_over_async",
            "line": line,
            "detail": f"Sync over async: {m.group()}",
            "severity": "high",
        })
    return issues


def detect_missing_credentials(content: str) -> list[dict]:
    """Find axios calls missing withCredentials."""
    issues = []
    if "withCredentials" not in content and "httpClient" not in content:
        for m in MISSING_CREDENTIALS.finditer(content):
            line = content[:m.start()].count("\n") + 1
            issues.append({
                "type": "missing_credentials",
                "line": line,
                "detail": "axios call without withCredentials",
                "severity": "high",
            })
            break  # One warning per file is enough
    return issues


def detect_console_error(content: str) -> list[dict]:
    """Flag console.error without user-facing toast."""
    issues = []
    for m in CONSOLE_ERROR.finditer(content):
        # Check if toast is used in the same file
        if "toast" not in content and "sonner" not in content:
            line = content[:m.start()].count("\n") + 1
            issues.append({
                "type": "console_error_no_toast",
                "line": line,
                "detail": "console.error() without user-facing toast notification",
                "severity": "low",
            })
    return issues


def detect_hardcoded_secrets(content: str) -> list[dict]:
    """Find potential hardcoded secrets."""
    issues = []
    for m in HARDCODED_SECRET.finditer(content):
        line = content[:m.start()].count("\n") + 1
        issues.append({
            "type": "hardcoded_secret",
            "line": line,
            "detail": "Potential hardcoded secret/token",
            "severity": "critical",
        })
    return issues


def analyze_file(file_info: dict) -> list[dict]:
    """Run all static analysis checks on a file."""
    content = file_info.get("content", "")
    language = file_info.get("language", "")
    issues = []

    issues.extend(detect_placeholder_issues(content))
    issues.extend(detect_empty_catch(content, language))
    issues.extend(detect_sync_over_async(content))

    if language in ("javascript", "jsx"):
        issues.extend(detect_missing_credentials(content))
        issues.extend(detect_console_error(content))

    issues.extend(detect_hardcoded_secrets(content))

    return issues


def analyze_with_ai(file_info: dict, existing_issues: list[dict]) -> list[dict]:
    """Use AI to find deeper issues that static analysis misses."""
    content = file_info.get("content", "")
    language = file_info.get("language", "")
    path = file_info.get("rel_path", "")

    # Skip if file is small enough and has no obvious issues
    if not existing_issues and len(content) < 500:
        return existing_issues

    # Skip generated/compiled files
    if "Migrations/" in path or ".g.cs" in path or ".designer" in path.lower():
        return existing_issues

    try:
        analysis = ai_analyze(content, path, language)
        if analysis and "NO ISSUES FOUND" not in analysis:
            for line in analysis.split("\n"):
                line = line.strip()
                if line and (line[0].isdigit() or line.startswith("-")):
                    existing_issues.append({
                        "type": "ai_detected",
                        "line": 0,
                        "detail": line[:200],
                        "severity": "medium",
                        "ai_analysis": True,
                    })
    except Exception:
        pass  # AI is optional — skip on failure

    return existing_issues
