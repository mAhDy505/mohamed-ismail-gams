"""Build PWA icons, favicon and an Open Graph image from assets/icon-src.png.

Outputs go to dist/icons/. The source is a 1024x1024 render whose corners
outside the rounded square are white; every output replaces those corners
with the game's navy so no white shows on a phone home screen.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "icon-src.png")
OUT = os.path.join(ROOT, "dist", "icons")
NAVY = (11, 20, 40, 255)
os.makedirs(OUT, exist_ok=True)

src = Image.open(SRC).convert("RGBA")
S = src.width
assert src.width == src.height, "source icon must be square"

# Rounded-square mask that matches the render's own corner radius.
RADIUS = int(S * 0.225)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=RADIUS, fill=255)

# "any" icon: rounded square over navy (corners navy, never white).
base = Image.new("RGBA", (S, S), NAVY)
base.paste(src, (0, 0), mask)

# maskable icon: the whole picture shrunk into the 80% safe zone over navy,
# so a circular or squircle OS mask never cuts the robot's head.
inner = int(S * 0.82)
shrunk = base.resize((inner, inner), Image.LANCZOS)
maskable = Image.new("RGBA", (S, S), NAVY)
# a soft navy vignette behind it so the edge of the shrunk square is not a hard line
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((S * 0.06, S * 0.06, S * 0.94, S * 0.94), fill=(26, 44, 80, 255))
glow = glow.filter(ImageFilter.GaussianBlur(S * 0.08))
maskable.alpha_composite(glow)
maskable.paste(shrunk, ((S - inner) // 2, (S - inner) // 2), shrunk)


def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).convert("RGBA").save(os.path.join(OUT, name), optimize=True)


save(base, "icon-512.png", 512)
save(base, "icon-192.png", 192)
save(maskable, "maskable-512.png", 512)
save(maskable, "maskable-192.png", 192)
save(base, "apple-touch-icon.png", 180)
save(base, "favicon-32.png", 32)
save(base, "favicon-64.png", 64)

# Open Graph image 1200x630: icon on the left, title on the right.
W, H = 1200, 630
og = Image.new("RGBA", (W, H), NAVY)
d = ImageDraw.Draw(og)
# background: a darker top to lighter bottom band, plus faint lane lines
for y in range(H):
    t = y / H
    c = (int(4 + 10 * t), int(8 + 14 * t), int(18 + 30 * t), 255)
    d.line((0, y, W, y), fill=c)
for i in range(0, W, 60):
    d.line((i, H, W // 2 + (i - W // 2) * 0.25, H * 0.55), fill=(40, 90, 140, 70), width=1)

icon_sz = 420
og.paste(base.resize((icon_sz, icon_sz), Image.LANCZOS), (90, (H - icon_sz) // 2), base.resize((icon_sz, icon_sz), Image.LANCZOS))


def font(candidates, size):
    for c in candidates:
        p = os.path.join("C:/Windows/Fonts", c)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


title_f = font(["seguibl.ttf", "segoeuib.ttf", "arialbd.ttf"], 92)
sub_f = font(["segoeuib.ttf", "arialbd.ttf"], 40)
x0 = 560
y = 150
for line, col in (("MOHAMED", (238, 243, 251)), ("ISMAIL", (238, 243, 251)), ("GAMS", (240, 199, 101))):
    d.text((x0, y), line, font=title_f, fill=col)
    y += 104
d.text((x0, y + 10), "3D runner  |  play in the browser", font=sub_f, fill=(185, 196, 214))
og.convert("RGB").save(os.path.join(OUT, "og-image.jpg"), quality=86, optimize=True)

for f in sorted(os.listdir(OUT)):
    print(f, os.path.getsize(os.path.join(OUT, f)))
