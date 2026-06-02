#!/usr/bin/env python3
"""
FixIt — Autonomous code repair for WatchNexus.

Purely local — uses installed Ollama models only.
No cloud APIs, no external dependencies.

Usage:
  python3 fixit.py                           # Fix all files
  python3 fixit.py --static-only             # Pattern fixes only (fast)
  python3 fixit.py --lang csharp             # Only C# files
  python3 fixit.py --file BridgeController   # Specific file
  python3 fixit.py --scan                    # Scan only
  python3 fixit.py --limit 10                # First 10 files
  python3 fixit.py --verify                  # Fix then build
"""

import os
import sys
import time
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "tools"))
from fixit import scanner, repairer, ollama_client


def banner():
    print(r"""
  ╔══════════════════════════════════════╗
  ║     ⚡ FixIt — Local Code Repair     ║
  ║     Models: qwen2.5-coder (7b+14b)   ║
  ╚══════════════════════════════════════╝
""")


def main():
    p = argparse.ArgumentParser(description="FixIt — local-only code repair")
    p.add_argument("--limit", type=int, default=0, help="Max files")
    p.add_argument("--lang", type=str, help="Filter: csharp, javascript, jsx, python")
    p.add_argument("--file", type=str, help="Specific file name or path")
    p.add_argument("--scan", action="store_true", help="Scan only")
    p.add_argument("--static-only", action="store_true", help="Pattern fixes only, no AI")
    p.add_argument("--verify", action="store_true", help="Build after fixing")
    p.add_argument("--models", action="store_true", help="Show available models")
    args = p.parse_args()

    if args.models:
        print("Available local models:")
        os.system("ollama list")
        return

    banner()

    if args.verify and not args.static_only:
        print("  Pre-loading models...")
        try:
            ollama_client.generate("warmup", tier="default", timeout=30)
            ollama_client.generate("warmup", tier="heavy", timeout=60)
            print("  Models loaded")
        except ollama_client.AllModelsFailed as e:
            print(f"  ⚠ {e}")

    start = time.time()
    print("📁 Scanning...")
    files = scanner.scan()
    print(f"   Found {len(files)} source files")

    if args.lang:
        files = [f for f in files if f["lang"] == args.lang]
        print(f"   Language: {args.lang}")
    if args.file:
        files = [f for f in files if args.file in f["rel"] or args.file == f["name"]]
        print(f"   File: {args.file}")

    cats = {}
    for f in files:
        cats.setdefault(f["category"], 0)
        cats[f["category"]] += 1
    for k, v in sorted(cats.items()):
        print(f"     {k}: {v}")

    if args.scan:
        return

    priority = {"controller": 0, "service": 1, "page": 2, "component": 3, "provider": 4, "other": 5}
    files.sort(key=lambda f: (priority.get(f["category"], 99), f["rel"]))

    repairer.run(files, use_ai=not args.static_only, limit=args.limit)

    elapsed = time.time() - start
    print(f"   Time: {elapsed:.0f}s")

    if args.verify:
        print("\n🧪 Building...")
        os.chdir(os.path.dirname(__file__))
        r1 = os.system("dotnet build src/watchnexus/core/WatchNexus.Core.csproj -c Release --no-restore 2>&1 | tail -3")
        r2 = os.system("cd frontend && CI=false npm run build 2>&1 | tail -3")
        print(f"   C#:      {'✅ PASS' if r1 == 0 else '❌ FAIL'}")
        print(f"   Frontend: {'✅ PASS' if r2 == 0 else '❌ FAIL'}")


if __name__ == "__main__":
    main()
