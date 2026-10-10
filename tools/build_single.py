"""Build the single-file version of the game (the one that travels on WhatsApp).

Reads dist/index.html and inlines the stylesheet, the five game scripts, the audio
clips (base64) and the favicon, so the result needs only the three.js CDN.

Usage:
  python tools/build_single.py                 -> "MOHAMED ISMAIL GAMS.html" next to this repo's dist/
  python tools/build_single.py --url https://example.com/gams/
      also rewrites og:image and og:url to absolute links (both in the single file
      and in dist/index.html) so a shared link gets a picture preview.
"""
import base64
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
OUT = os.path.join(ROOT, "MOHAMED ISMAIL GAMS.html")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def data_uri(path, mime):
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))


def between(html, tag):
    start = "<!-- build:%s -->" % tag
    end = "<!-- endbuild -->"
    i = html.index(start)
    j = html.index(end, i) + len(end)
    return i, j


site_url = ""
if "--url" in sys.argv:
    site_url = sys.argv[sys.argv.index("--url") + 1].rstrip("/") + "/"

html = read(os.path.join(DIST, "index.html"))

if site_url:
    html = html.replace('content="icons/og-image.jpg"', 'content="%sicons/og-image.jpg"' % site_url)
    if '<meta property="og:url"' not in html:
        html = html.replace('<meta property="og:type" content="website">',
                            '<meta property="og:type" content="website">\n<meta property="og:url" content="%s">' % site_url)
    with open(os.path.join(DIST, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

# 1. stylesheet, with the fonts embedded when tools/fetch_vendor.py has run (true offline file)
css = read(os.path.join(DIST, "css", "game.css"))
VENDOR = os.path.join(ROOT, "assets", "vendor")
fonts_json = os.path.join(VENDOR, "fonts.json")
font_css = ""
if os.path.exists(fonts_json):
    with open(fonts_json, encoding="utf-8") as f:
        entries = json.load(f)
    # Google serves one variable file for several weights; merge identical files into a weight range
    groups = {}
    for m in entries:
        with open(os.path.join(VENDOR, "fonts", m["file"]), "rb") as fb:
            key = (m["family"], m["range"], hashlib.sha256(fb.read()).hexdigest())
        groups.setdefault(key, {"m": m, "weights": []})["weights"].append(m["weight"])
    for key, g in groups.items():
        m, ws = g["m"], sorted(g["weights"])
        weight = "%d %d" % (ws[0], ws[-1]) if ws[0] != ws[-1] else "%d" % ws[0]
        uri = data_uri(os.path.join(VENDOR, "fonts", m["file"]), "font/woff2")
        font_css += ("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;src:url(%s) format('woff2');unicode-range:%s}\n"
                     % (m["family"], weight, uri, m["range"]))
    # drop the Google Fonts link and its preconnects: everything is inline now
    html = re.sub(r'<link rel="preconnect" href="https://fonts\.[^"]+"[^>]*>\n', "", html)
    html = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\n', "", html)
i, j = between(html, "css")
html = html[:i] + "<style>\n" + font_css + css + "\n</style>" + html[j:]

# 1b. three.js inline when downloaded, so the file needs no network at all
three_path = os.path.join(VENDOR, "three.min.js")
if os.path.exists(three_path):
    three = read(three_path).replace("</script", "<\\/script")
    html = re.sub(r'<link rel="preload" as="script" href="https://cdnjs[^>]*>\n', "", html)
    html = re.sub(r'<script src="https://cdnjs\.cloudflare\.com/ajax/libs/three\.js/r128/three\.min\.js"[^>]*></script>',
                  lambda _m: "<script>\n" + three + "\n</script>", html)

# 2. PWA links become a data-URI favicon only (manifest and service worker need a host)
i, j = between(html, "pwa")
fav = data_uri(os.path.join(DIST, "icons", "favicon-64.png"), "image/png")
html = html[:i] + '<link rel="icon" type="image/png" href="%s">' % fav + html[j:]

# 3. scripts: audio as data URIs, then the five files in order, guarded by the three.js check
audio = {}
for name in ["music", "hit", "heart", "shoot", "explode", "levelup", "gameover", "roar", "whoosh"]:
    audio[name] = data_uri(os.path.join(DIST, "audio", name + ".mp3"), "audio/mpeg")
audio_js = "window.AUDIO_SRC={" + ",".join('%s:"%s"' % (k, v) for k, v in audio.items()) + "};"
share_js = 'window.SHARE_URL=%s;' % ('"%s"' % site_url if site_url else "''")
parts = []
for name in ["core", "builders", "game", "loop", "ui"]:
    src = read(os.path.join(DIST, "js", name + ".js"))
    src = src.replace("</script", "<\\/script")
    parts.append("/* ===== %s.js ===== */\n%s" % (name, src))
game_js = "\n".join(parts)
# The game code lives inside bootGame() so the jsDelivr fallback (index.html's loadFallback) can start it
# after cdnjs failed; without a fallback success its onerror shows the failure message.
inline = (
    "<script>window.SINGLE_FILE=true;" + share_js + audio_js + "</script>\n"
    "<script>\nfunction bootGame(){\nif(!window.THREE || window.__booted) return; window.__booted=true;\n"
    + game_js +
    "\n}\nif(window.THREE) bootGame();\n</script>"
)
i, j = between(html, "js")
html = html[:i] + inline + html[j:]

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("wrote", OUT, os.path.getsize(OUT), "bytes")
