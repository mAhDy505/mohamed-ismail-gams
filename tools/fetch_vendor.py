"""Download the third-party pieces the offline single file embeds: three.js r128 and the two web fonts.

Writes to assets/vendor/. three.min.js is fetched from two CDNs and must match byte for byte
before it is kept. Fonts come from Google Fonts as woff2 subsets (Cairo Arabic + Latin, Orbitron Latin).
Run once, then build_single.py picks the files up automatically.
"""
import hashlib
import json
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, "assets", "vendor")
FONTS = os.path.join(VENDOR, "fonts")
os.makedirs(FONTS, exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


# 1. three.js r128 from two sources, kept only if identical
a = get("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js")
b = get("https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js")
if a != b:
    raise SystemExit("three.min.js differs between cdnjs and jsDelivr; refusing to embed")
with open(os.path.join(VENDOR, "three.min.js"), "wb") as f:
    f.write(a)
print("three.min.js", len(a), "bytes sha256", hashlib.sha256(a).hexdigest()[:16])

# 2. fonts: parse the Google Fonts css for the woff2 subsets we want
css = get("https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Orbitron:wght@700;900&display=swap").decode("utf-8")
blocks = re.findall(r"/\* (\w+) \*/\s*@font-face \{(.*?)\}", css, re.S)
wanted = {"Cairo": {"arabic", "latin"}, "Orbitron": {"latin"}}
manifest = []
for subset, body in blocks:
    fam = re.search(r"font-family: '([^']+)'", body).group(1)
    weight = re.search(r"font-weight: (\d+)", body).group(1)
    rng = re.search(r"unicode-range: ([^;]+);", body).group(1).strip()
    url = re.search(r"url\(([^)]+\.woff2)\)", body).group(1)
    if subset not in wanted.get(fam, set()):
        continue
    name = "%s-%s-%s.woff2" % (fam.lower(), weight, subset)
    data = get(url)
    with open(os.path.join(FONTS, name), "wb") as f:
        f.write(data)
    manifest.append({"family": fam, "weight": int(weight), "range": rng, "file": name, "bytes": len(data)})
    print(name, len(data), "bytes")
with open(os.path.join(VENDOR, "fonts.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=1)
print("fonts:", len(manifest), "files,", sum(m["bytes"] for m in manifest), "bytes")
