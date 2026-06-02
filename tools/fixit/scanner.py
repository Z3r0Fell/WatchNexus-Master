"""Scans project for source files with metadata."""

import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "../.."))
EXCLUDE = {"node_modules", "bin", "obj", "build", ".next", ".git", "__pycache__",
           ".venv", "venv", "env", ".opencode", ".yarn", "Migrations"}

LANGUAGE = {
    ".cs": "csharp", ".js": "javascript", ".jsx": "jsx",
    ".ts": "typescript", ".tsx": "tsx", ".py": "python",
    ".css": "css", ".sh": "bash", ".ps1": "powershell",
}

CATEGORY = {
    "controller": lambda p: p.endswith("Controller.cs"),
    "service": lambda p: "/services/" in p,
    "component": lambda p: "/components/" in p,
    "page": lambda p: "/pages/" in p,
    "provider": lambda p: "Provider" in p or "Context" in p,
    "test": lambda p: "test" in p.lower() or "spec" in p.lower(),
}


def categorize(rel: str) -> str:
    for cat, fn in CATEGORY.items():
        if fn(rel):
            return cat
    return "other"


def scan() -> list[dict]:
    files = []
    for root, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE and not d.startswith(".")]
        for name in names:
            ext = os.path.splitext(name)[1].lower()
            lang = LANGUAGE.get(ext)
            if not lang:
                continue
            full = os.path.join(root, name)
            rel = os.path.relpath(full, ROOT)
            if any(f"/{ex}/" in f"/{rel}/" or rel.startswith(f"{ex}/") for ex in EXCLUDE):
                continue
            try:
                with open(full, "r", errors="replace") as f:
                    content = f.read()
            except Exception:
                content = ""
            files.append({
                "path": full, "rel": rel, "name": name,
                "ext": ext, "lang": lang, "category": categorize(rel),
                "lines": content.count("\n") + 1,
                "content": content,
            })
    return files
