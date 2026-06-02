#!/usr/bin/env python3
"""Generate installer brand assets (watchnexus.ico + PNGs) if missing or --force."""
from __future__ import annotations

import argparse
import struct
import zlib
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit("Pillow required: pacman -S python-pillow  (or pip install pillow)") from exc

RESOURCES = Path(__file__).resolve().parent
BG = (7, 6, 11, 255)
ACCENT = (99, 179, 237, 255)


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf", "Arial Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _brand_mark(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)
    # stylised trident mark
    cx, cy = size // 2, size // 2
    w = max(2, size // 32)
    arm = size // 3
    draw.line([(cx, cy - arm), (cx, cy + arm)], fill=ACCENT, width=w)
    draw.line([(cx - arm // 2, cy - arm // 3), (cx, cy - arm)], fill=ACCENT, width=w)
    draw.line([(cx + arm // 2, cy - arm // 3), (cx, cy - arm)], fill=ACCENT, width=w)
    draw.ellipse(
        [cx - arm // 4, cy + arm // 4, cx + arm // 4, cy + arm // 2],
        outline=ACCENT,
        width=w,
    )
    return img


def _png(path: Path, size: tuple[int, int]) -> None:
    img = _brand_mark(min(size))
    if size != (img.width, img.height):
        img = img.resize(size, Image.Resampling.LANCZOS)
    img.save(path, "PNG")


def _ico(path: Path) -> None:
    sizes = [16, 24, 32, 48, 64, 128, 256]
    images = [_brand_mark(s).convert("RGBA") for s in sizes]

    # Minimal ICO writer (PNG-compressed entries via Pillow)
    images[0].save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[1:],
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    targets = {
        RESOURCES / "watchnexus.ico": lambda p: _ico(p),
        RESOURCES / "watchnexus.png": lambda p: _png(p, (256, 256)),
        RESOURCES / "watchnexus-logo.png": lambda p: _png(p, (400, 120)),
        RESOURCES / "watchnexus-banner.png": lambda p: _png(p, (300, 70)),
        RESOURCES / "installer-left.png": lambda p: _png(p, (164, 314)),
    }

    for path, maker in targets.items():
        if path.exists() and not args.force:
            continue
        print(f"  generating {path.name}")
        maker(path)

    print(f"  brand assets ready in {RESOURCES}")


if __name__ == "__main__":
    main()
