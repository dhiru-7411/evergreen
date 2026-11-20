"""Generates client/public/og-default.png, the 1200x630 image shown in link
previews (LinkedIn, Slack, WhatsApp, X...). Run once after design changes:

    python3 scripts/make-og-image.py

Uses Pillow and macOS system fonts (Georgia, Arial)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PAPER, INK, SOFT, BRAND, MINT = "#f7f5ef", "#18241e", "#4d5a53", "#1f4d3a", "#cfe8d6"
FRESH, AGING, STALE = ("#2f7d5b", "#e1f1e7"), ("#a76a0b", "#fbf0d9"), ("#b1442a", "#fae4dd")
FONTS = Path("/System/Library/Fonts/Supplemental")

serif_bold = lambda size: ImageFont.truetype(str(FONTS / "Georgia Bold.ttf"), size)
sans = lambda size: ImageFont.truetype(str(FONTS / "Arial.ttf"), size)
sans_bold = lambda size: ImageFont.truetype(str(FONTS / "Arial Bold.ttf"), size)

img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)

# Left brand bar
d.rectangle([0, 0, 18, H], fill=BRAND)

# Logo: the favicon tree, scaled from its 32x32 viewBox
def logo(x, y, s):
    k = s / 32
    d.rounded_rectangle([x, y, x + s, y + s], radius=8 * k, fill=BRAND)
    pts = [(16, 5), (10, 13), (13.5, 13), (9, 19), (13.5, 19), (8, 25), (24, 25), (18.5, 19), (23, 19), (18.5, 13), (22, 13)]
    d.polygon([(x + px * k, y + py * k) for px, py in pts], fill=MINT)
    d.rectangle([x + 14.5 * k, y + 25 * k, x + 17.5 * k, y + 28 * k], fill=MINT)

logo(90, 80, 84)
d.text((196, 92), "Evergreen", font=serif_bold(56), fill=INK)

d.text((90, 225), "Learn what's current.", font=serif_bold(82), fill=INK)
d.text(
    (92, 340),
    "Live versions, the alternatives worth knowing, and step-by-step\npaths built from official docs, with every fact cited.",
    font=sans(32), fill=SOFT, spacing=12,
)

# Freshness pills
x = 92
for label, (fg, bg) in (("FRESH", FRESH), ("AGING", AGING), ("STALE", STALE)):
    f = sans_bold(24)
    w = d.textlength(label, font=f) + 64
    d.rounded_rectangle([x, 480, x + w, 530], radius=25, fill=bg)
    d.ellipse([x + 20, 499, x + 32, 511], fill=fg)
    d.text((x + 42, 492), label, font=f, fill=fg)
    x += w + 16

out = Path(__file__).resolve().parent.parent / "client" / "public" / "og-default.png"
img.save(out, optimize=True)
print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
