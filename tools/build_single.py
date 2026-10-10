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

# 1. stylesheet
css = read(os.path.join(DIST, "css", "game.css"))
i, j = between(html, "css")
html = html[:i] + "<style>\n" + css + "\n</style>" + html[j:]

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
inline = (
    "<script>window.SINGLE_FILE=true;" + share_js + audio_js + "</script>\n"
    "<script>\nfunction bootGame(){}\n"
    "if(!window.THREE){ fail('اللعبة مش قادرة تتحمّل. اتأكد إن النت شغال وجرّب تاني.'); }\n"
    "</script>\n"
    "<script>\nif(window.THREE){\n" + game_js + "\n}\n</script>"
)
i, j = between(html, "js")
html = html[:i] + inline + html[j:]

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)
print("wrote", OUT, os.path.getsize(OUT), "bytes")
