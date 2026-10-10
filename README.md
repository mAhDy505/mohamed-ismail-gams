# MOHAMED ISMAIL GAMS

A phone-first 3D lane runner for the browser (three.js r128, Arabic UI). This folder holds the rebuilt game, the assets and the tools that produce the two deliverables.

## What ships

| File or folder | Purpose |
| --- | --- |
| `MOHAMED ISMAIL GAMS.html` | The single file to send on WhatsApp. Everything is inlined (styles, scripts, audio, favicon). Only three.js loads from a CDN, with a second CDN as fallback. |
| `dist/` | The hosted version: `index.html`, `css/`, `js/`, `audio/`, `icons/`, `manifest.webmanifest`, `sw.js`. Upload this folder as is to any static host. |
| `original.html` | The game as received, kept for comparison. |
| `assets/` | Source icon render and raw audio clips. |
| `tools/make_icons.py` | Builds the PWA icons, favicon and the Open Graph share image from `assets/icon-src.png`. |
| `tools/build_single.py` | Builds the single file from `dist/`. |

## Rebuild the single file

```bash
python tools/build_single.py
```

Once the game has a public address, pass it so shared links get a picture preview and the share card prints the right link:

```bash
python tools/build_single.py --url https://your-host.example/gams/
```

That rewrites `og:image` and `og:url` in both `dist/index.html` and the single file.

## Local test

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/dist/` for the hosted version or `http://127.0.0.1:8765/MOHAMED%20ISMAIL%20GAMS.html` for the single file. The service worker only registers on https or localhost.

## Hosting checklist (the step that makes it spread)

1. Pick the final hostname first. Best scores live in the browser per origin, so moving hosts later resets everyone.
2. Upload the `dist/` folder (GitHub Pages, Netlify Drop and Cloudflare Pages all work with no build step).
3. Run `python tools/build_single.py --url <the address>` and re-upload `dist/index.html`.
4. Paste the link into a WhatsApp chat with yourself and confirm the preview card shows the robot image.
5. On an Android phone open the link in Chrome and check the install prompt button appears on the menu.

## Game structure

- `js/core.js` constants, seeded random, renderer and quality tiers, palette per level, merged geometry helper, floor, towers, backdrop.
- `js/builders.js` obstacle builders (merged and pooled), heart with beam, boss prototype, projectile pools, particle system, speed lines, dash streaks, shock rings, runner model and skins.
- `js/game.js` persistent progress, run state, level tables, spawning, combat, near-miss chain, damage, death, revive, run flow.
- `js/loop.js` per-frame update, camera rig, frame timing (hit-stop, slow motion, quality governor), input, wake lock.
- `js/ui.js` audio, HUD, panels, share card, daily mode, skins and leaderboard rendering, PWA hooks, boot.

All five are classic scripts sharing one global scope and loading in that order.

## Modes and progression

- Campaign: 10 levels, cumulative distances 300, 600, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500 m. The boss appears from level 3, charges from level 6, triple-shots from level 8.
- Endless: offered after the first win, speed keeps rising to a cap.
- Daily race: the same seeded track for everyone on the same calendar day, with its own best score and a day streak.
- Checkpoints: start from level 4 after reaching level 5, from level 7 after reaching level 8.
- Skins unlock by lifetime metres: 0, 1,500, 4,000, 9,000 and 18,000 m.
- One free revive per run. Near misses chain into a multiplier up to x5.

## Saved data

One localStorage key, `mi_gams_v2`, holds best score, daily best, lifetime metres, runs, max level, skin, streak, mute, lefty layout, the local top scores and the tutorial flag.
