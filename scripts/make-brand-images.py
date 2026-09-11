#!/usr/bin/env python3
"""Generate the site's brand PNGs from the design brief in docs/growth/01-technical-seo-fixes.md.

Outputs (all written to src/static/):
  og-image.png   1200x630  social share card (checkerboard left, wordmark right)
  icon-512.png   512x512   PWA icon, full-bleed (maskable-safe: artwork inside the inner 80%)
  icon-192.png   192x192   PWA icon, same artwork
  logo.png       512x512   square logo for Organization.logo (rounded dark tile, red piece)

Requires Python 3 and Pillow 10. Fonts come from src/static/fonts/poppins-*.ttf.
Run from anywhere:  python scripts/make-brand-images.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "src" / "static"
FONTS = STATIC / "fonts"

BG = (0x1C, 0x19, 0x17)          # --bg, matches theme-color
BOARD_LIGHT = (0xD4, 0xA7, 0x6A)  # --board-light
BOARD_DARK = (0x7C, 0x5E, 0x3C)   # --board-dark
RED = (0xEF, 0x44, 0x44)          # --accent / red piece
RED_DEEP = (0xDC, 0x26, 0x26)
RED_LIGHT = (0xF8, 0x71, 0x71)
BLACK_PIECE = (0x3D, 0x35, 0x30)  # --surface2, the "black" piece
BLACK_DEEP = (0x1C, 0x19, 0x17)
BLACK_LIGHT = (0x57, 0x4D, 0x46)
TEXT = (0xFA, 0xFA, 0xF9)         # --text
TEXT_DIM = (0xA8, 0xA2, 0x9E)     # --text-dim

SS = 2  # supersampling factor for smooth circles


def font(weight: int, size: int) -> ImageFont.FreeTypeFont:
    path = FONTS / f"poppins-{weight}.ttf"
    if not path.exists():
        sys.exit(f"Missing font {path}")
    return ImageFont.truetype(str(path), size)


def piece(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, color: str, under: tuple) -> None:
    """Draw a checkers piece as three concentric rings, the favicon artwork.

    `under` is the opaque colour of the square beneath; the drop shadow is that colour
    darkened, drawn opaque, so no alpha holes are punched into the layer."""
    outer, mid, inner = (RED, RED_DEEP, RED_LIGHT) if color == "red" else (BLACK_PIECE, BLACK_DEEP, BLACK_LIGHT)
    shadow = tuple(int(c * 0.55) for c in under[:3])
    draw.ellipse([cx - r, cy - r + r * 0.12, cx + r, cy + r + r * 0.12], fill=shadow)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=outer)
    draw.ellipse([cx - r * 0.64, cy - r * 0.64, cx + r * 0.64, cy + r * 0.64], fill=mid)
    draw.ellipse([cx - r * 0.32, cy - r * 0.32, cx + r * 0.32, cy + r * 0.32], fill=inner)


def checkerboard(size: int, radius: int) -> Image.Image:
    """8x8 board at the starting position. Red at the bottom (rows 5-7), as on the site."""
    s = size * SS
    cell = s / 8
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for row in range(8):
        for col in range(8):
            dark = (row + col) % 2 == 1
            x0, y0 = col * cell, row * cell
            d.rectangle([x0, y0, x0 + cell, y0 + cell], fill=BOARD_DARK if dark else BOARD_LIGHT)
            if dark and row < 3:
                piece(d, x0 + cell / 2, y0 + cell / 2, cell * 0.36, "black", BOARD_DARK)
            elif dark and row > 4:
                piece(d, x0 + cell / 2, y0 + cell / 2, cell * 0.36, "red", BOARD_DARK)
    # rounded corners
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=radius * SS, fill=255)
    img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)


def shadowed(base: Image.Image, layer: Image.Image, pos: tuple[int, int], blur: int = 28, offset: int = 14) -> None:
    """Paste `layer` onto `base` with a soft drop shadow."""
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    alpha = layer.getchannel("A").point(lambda a: int(a * 0.7))
    tint = Image.new("RGBA", layer.size, (0, 0, 0, 255))
    tint.putalpha(alpha)
    shadow.paste(tint, (pos[0], pos[1] + offset), tint)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow)
    base.alpha_composite(layer, pos)


def make_og() -> Image.Image:
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H), BG + (255,))
    # Safe area 1080x540 centred: x 60..1140, y 45..585. All text stays inside it.
    board_size = 456
    board = checkerboard(board_size, radius=18)
    shadowed(img, board, (84, (H - board_size) // 2))

    d = ImageDraw.Draw(img)
    x, right = 600, 1140  # text column inside the safe area
    # Wordmark on two lines: "Pure" in red, "Checkers" in off-white. Shrink until it fits.
    size = 112
    while size > 40:
        f_word = font(700, size)
        if d.textlength("Checkers", font=f_word) <= right - x:
            break
        size -= 4
    f_tag = font(500, 34)
    y = 150
    d.text((x, y), "Pure", font=f_word, fill=RED)
    d.text((x, y + size * 1.02), "Checkers", font=f_word, fill=TEXT)
    y_tag = y + size * 2.3
    d.rounded_rectangle([x + 6, y_tag - 14, x + 86, y_tag - 9], radius=3, fill=RED)
    d.text((x + 4, y_tag + 8), "Free online checkers.", font=f_tag, fill=TEXT_DIM)
    d.text((x + 4, y_tag + 54), "No ads, no paywalls.", font=f_tag, fill=TEXT_DIM)
    return img


def make_icon(size: int, rounded: bool) -> Image.Image:
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.18), fill=BG + (255,))
    else:
        d.rectangle([0, 0, s, s], fill=BG + (255,))
    # Faint 2x2 board behind the piece, kept inside the maskable safe zone (inner 80%)
    pad = s * 0.18
    cell = (s - 2 * pad) / 2
    for row in range(2):
        for col in range(2):
            dark = (row + col) % 2 == 1
            x0, y0 = pad + col * cell, pad + row * cell
            d.rounded_rectangle(
                [x0, y0, x0 + cell, y0 + cell],
                radius=int(s * 0.03),
                fill=(BOARD_DARK if dark else BOARD_LIGHT) + (255,),
            )
    piece(d, s / 2, s / 2, s * 0.26, "red", BOARD_LIGHT)
    return img.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, name: str, limit_kb: int = 300) -> None:
    out = STATIC / name
    img.convert("RGBA").save(out, "PNG", optimize=True)
    kb = os.path.getsize(out) / 1024
    if kb > limit_kb:
        # Quantise to a palette if the optimised RGBA file is still too large.
        img.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT).save(out, "PNG", optimize=True)
        kb = os.path.getsize(out) / 1024
    print(f"{name}: {img.size[0]}x{img.size[1]}  {kb:.0f} KB")
    if kb > limit_kb:
        sys.exit(f"{name} is over {limit_kb} KB")


def main() -> None:
    STATIC.mkdir(parents=True, exist_ok=True)
    save(make_og(), "og-image.png")
    save(make_icon(512, rounded=False), "icon-512.png")
    save(make_icon(192, rounded=False), "icon-192.png")
    save(make_icon(512, rounded=True), "logo.png")


if __name__ == "__main__":
    main()
