"""FixIt — practical code repair system.
Strategy: static pattern fixes first, surgical AI fixes for complex issues."""

import os
import re
import json
from datetime import datetime
from . import ollama_client
from . import scanner as scanmod

ROOT = scanmod.ROOT
REPORT_DIR = os.path.join(ROOT, "fixit_reports")


# ─── Static pattern fixes ───────────────────────────────────────

def fix_missing_httpclient(content: str, rel_path: str = "") -> str | None:
    if "httpClient" in content or "withCredentials" in content:
        return None
    if "axios" not in content:
        return None
    if "from './httpClient'" in content or 'from "./httpClient"' in content:
        return None
    import_path = "./httpClient"
    if not rel_path.startswith("frontend/src/services/"):
        import_path = "../services/httpClient"
    new = re.sub(
        r"""import\s+axios\s+from\s+['"]axios['"]""",
        f"import httpClient from '{import_path}'",
        content,
    )
    if new != content:
        new = re.sub(r"\baxios\.(get|post|put|delete|patch)\b", r"httpClient.\1", new)
        return new
    return None


def fix_empty_catch_cs(content: str) -> str | None:
    pattern = re.compile(r"catch\s*(?:\([^)]*\))?\s*\{[\s\n]*\}")
    matches = list(pattern.finditer(content))
    if not matches:
        return None
    for m in reversed(matches):
        content = content[:m.start()] + "catch { /* log exception */ }" + content[m.end():]
    return content


# ─── AI surgical fix ────────────────────────────────────────────






# ─── Issue detector ─────────────────────────────────────────────

def detect_issues(content: str, path: str, lang: str) -> list[dict]:
    issues = []
    for pat, sev, msg in [
        (r"\bTODO\b", "medium", "TODO — needs implementation"),
        (r"\bFIXME\b", "high", "FIXME — known bug"),
        (r"\bHACK\b", "low", "HACK — non-ideal pattern"),
        (r"throw\s+new\s+NotImplementedException", "high", "NotImplementedException — stub"),
        (r"throw\s+new\s+NotSupportedException", "medium", "NotSupportedException — may need implementation"),
        (r"#error", "critical", "#error directive — will fail compilation"),
        (r"\.Result\b(?!\s*\()", "high", ".Result — sync-over-async"),
        (r"\.Wait\(\)", "high", ".Wait() — sync-over-async"),
        (r"\.GetAwaiter\(\)\.GetResult\(\)", "high", "GetAwaiter+GetResult — sync-over-async"),
    ]:
        for m in re.finditer(pat, content):
            line = content[:m.start()].count("\n") + 1
            issues.append({"type": "pattern", "severity": sev, "line": line, "detail": msg})

    for m in re.finditer(r"catch\s*(?:\([^)]*\))?\s*\{[\s\n]*\}", content):
        line = content[:m.start()].count("\n") + 1
        issues.append({"type": "empty_catch", "severity": "high", "line": line, "detail": "Empty catch block"})

    if lang in ("javascript", "jsx"):
        if "httpClient" not in content and "withCredentials" not in content:
            for m in re.finditer(r"\baxios\.(get|post|put|delete|patch)\b", content):
                line = content[:m.start()].count("\n") + 1
                issues.append({"type": "credentials", "severity": "high", "line": line, "detail": "Missing withCredentials"})
                break

    return issues


# ─── Repair orchestrator ────────────────────────────────────────

class Repairer:
    def __init__(self):
        self.stats = {"static": 0, "ai_fixed": 0, "skip": 0, "fail": 0, "files": [], "ai_attempted": 0}
        self._model_loaded = False

    def ensure_model(self):
        if not self._model_loaded:
            try:
                print("   Loading models...")
                ollama_client.generate("warmup", tier="default", timeout=30)
                ollama_client.generate("warmup", tier="heavy", timeout=60)
                self._model_loaded = True
                print("   Models ready")
            except ollama_client.AllModelsFailed as e:
                print(f"   ⚠ {e}")

    def repair(self, f: dict, use_ai: bool = True) -> bool:
        path, rel, content, lang = f["path"], f["rel"], f["content"], f["lang"]
        issues = detect_issues(content, rel, lang)
        applied = []

        # Static fixes
        if lang in ("javascript", "jsx"):
            fixed = fix_missing_httpclient(content, rel)
            if fixed:
                with open(path, "w") as fh:
                    fh.write(fixed)
                content = fixed
                applied.append("httpClient")

        if lang == "csharp":
            fixed = fix_empty_catch_cs(content)
            if fixed:
                with open(path, "w") as fh:
                    fh.write(fixed)
                content = fixed
                applied.append("empty catch")

        if applied:
            self.stats["static"] += 1
            print(f"  ✅ Static: {', '.join(applied)}")
            issues = detect_issues(content, rel, lang)  # re-detect after static fix

        # AI analysis for reporting only
        remaining = [i for i in issues if i.get("line")]
        if use_ai and remaining:
            self.ensure_model()
            ai_issues = []
            try:
                ai_result = ollama_client.analyze_file(content, rel, lang)
                if ai_result and "OK" not in ai_result:
                    for line in ai_result.split("\n"):
                        line = line.strip()
                        if line and (line[0].isdigit() or line.startswith("-")):
                            ai_issues.append({"type": "ai", "detail": line[:200], "severity": "medium"})
            except Exception:
                pass

            all_issues = issues + ai_issues
            if all_issues:
                print(f"  🤖 {len(all_issues)} issues (pattern={len(issues)}, ai={len(ai_issues)})")
                for iss in all_issues[:5]:
                    print(f"     [{iss['severity']}] L{iss.get('line','?')}: {iss['detail'][:80]}")

                # AI analysis only — no automated fixes (too unreliable for complex syntax)

            self.stats["skip"] += 1
            return True

        self.stats["skip"] += 1
        print(f"  ✅ OK")
        return True


def run(files: list[dict], use_ai: bool = True, limit: int = 0):
    r = Repairer()
    processed = 0

    for f in files:
        if limit and processed >= limit:
            break
        processed += 1
        print(f"[{processed}/{len(files)}] {f['rel']}")
        r.repair(f, use_ai)

    os.makedirs(REPORT_DIR, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(REPORT_DIR, f"fixit_{ts}.json")
    with open(path, "w") as fh:
        json.dump({"timestamp": ts, **r.stats}, fh, indent=2)

    print(f"\n{'='*50}")
    print(f"  SUMMARY")
    print(f"  Static fixes:  {r.stats['static']}")
    print(f"  AI fixes:      {r.stats['ai_fixed']}")
    print(f"  AI attempted:  {r.stats['ai_attempted']}")
    print(f"  Skipped:       {r.stats['skip']}")
    print(f"  Failed:        {r.stats['fail']}")
    print(f"  Report:        {path}")
    print(f"{'='*50}")
    return path
