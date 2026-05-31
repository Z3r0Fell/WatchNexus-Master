"""Ollama client — purely local models, zero cloud calls.

Strategy: surgical fixes only — send broken sections, get back replacements.
Full-file rewrites don't work on these models (truncation)."""

import json
import urllib.request
from typing import Optional

BASE = "http://localhost:11434"
KEEP_ALIVE = "10m"

# Model tiers:
#   heavy  → qwen2.5-coder:14b (9GB, surgical code fixes)
#   default → qwen2.5-coder:7b (4.7GB, fast analysis)
#   quick   → qwen3.5:4b       (3.4GB, lightweight fallback)

class AllModelsFailed(Exception):
    pass


def _call(model: str, prompt: str, system: str = "", timeout: int = 180) -> Optional[str]:
    payload = {
        "model": model,
        "prompt": prompt,
        "system": system or None,
        "stream": False,
        "keep_alive": KEEP_ALIVE,
        "options": {"num_ctx": 8192, "temperature": 0.1},
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE}/api/generate", data=data,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode()).get("response", "").strip()
    except Exception:
        return None


def _strip_fences(text: str) -> str:
    """Remove markdown code fences if present."""
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (opening fence, possibly with language)
        result = "\n".join(lines[1:])
        if result.endswith("```"):
            result = result[:-3].rstrip()
        if result.endswith("```"):
            result = result[:-3].rstrip()
        return result.strip()
    return text


def generate(prompt: str, system: str = "", tier: str = "default", timeout: int = 180) -> str:
    """Generate using local models only. Falls through tiers on failure."""
    chains = {
        "heavy":  ["qwen2.5-coder:14b", "qwen2.5-coder:7b", "qwen3.5:4b"],
        "default": ["qwen2.5-coder:7b", "qwen3.5:4b"],
        "quick":  ["qwen3.5:4b", "llama3.2:3b"],
    }
    for model in chains.get(tier, chains["default"]):
        result = _call(model, prompt, system, timeout)
        if result:
            return _strip_fences(result)
    raise AllModelsFailed(
        f"All local models failed. Check 'ollama list'.\n"
        f"Tried: {chains.get(tier, chains['default'])}"
    )


# ─── Analysis (full file scan) ──────────────────────────────────

def analyze_file(content: str, path: str, language: str) -> str:
    """Analyze a file for issues using the 7b model (fast)."""
    # Truncate very large files
    if len(content) > 7000:
        content = content[:3500] + "\n// ... [truncated middle] ...\n" + content[-3000:]
    prompt = f"""Analyze this {language} file at `{path}`.

List every issue that would prevent it from working:
- Missing imports
- Incomplete code (TODO, stubs)
- Type errors
- Broken patterns
- Syntax problems

```{language}
{content}
```

If it's fine, say "OK". Otherwise list issues with line numbers."""
    return generate(prompt, "Be concise and specific.", tier="default", timeout=120)


# ─── Surgical fix (send broken section + context, get replacement) ──

def generate_fix(broken_code: str, file_path: str, language: str, issue: str, context: str = "") -> str:
    """Generate a replacement for a broken code section using the 14b model.
    
    Args:
        broken_code: The specific code section that's broken
        file_path: Path for context
        language: Programming language
        issue: Description of what's wrong
        context: Surrounding code for context (optional)
    """
    prompt = f"""Fix this broken code section from `{file_path}` ({language}).

ISSUE: {issue}

BROKEN CODE:
```
{broken_code}
```

{f"CONTEXT (surrounding code):\n```\n{context}\n```" if context else ""}

Return ONLY the fixed code. No markdown fences, no explanations, no backticks."""

    return generate(prompt, "You are an expert developer. Return ONLY the fixed code.", tier="heavy", timeout=120)
