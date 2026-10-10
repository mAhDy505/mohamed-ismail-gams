/* core.js: constants, seeded random, renderer, scene, materials, world geometry.
   Loaded first. Later scripts (builders, game, loop, ui) use the globals defined here. */
'use strict';
var $ = function (id) { return document.getElementById(id); };
var T = window.THREE;

/* ---------- constants ---------- */
var LANES = 10, LW = 1.5, MID = (LANES - 1) / 2, TRACK_W = LANES * LW;
var MAX_LEVEL = 10, MAX_LIVES = 5, HEART_EVERY = 320, TILE = 15;
/* cumulative metres at the end of each level (index = level). Short early levels, the boss at level 3 arrives near 0:40. */
var CUM = [0, 300, 600, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500];
var FINISH = CUM[MAX_LEVEL];
function laneX(i) { return (i - MID) * LW; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function fmt(n) { return (n | 0).toString().replace(/\B(?=(\d{3})+$)/g, ','); }

/* ---------- seeded random: rnd() drives the track, rndM() the monster, so a daily seed gives everyone the same road ---------- */
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var rnd = Math.random, rndM = Math.random, rndH = Math.random;
/* rndH feeds heart lanes only, so a skill-dependent heart (rescue, boss drop) never shifts the shared daily road */
function seedRun(s) { if (s == null) { rnd = Math.random; rndM = Math.random; rndH = Math.random; } else { rnd = mulberry(s); rndM = mulberry((s ^ 0x9E3779B9) | 0); rndH = mulberry((s ^ 0x85EBCA6B) | 0); } }
function randInt(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
var fixedRnd = mulberry(1337); /* art-directed look: the same reflections and windows for everyone */

/* ---------- device and quality ---------- */
var coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches);
var fxScale = RM ? .25 : 1;
var TIERS = [{ dpr: 2 }, { dpr: 1.5 }, { dpr: 1.2 }, { dpr: .9 }];
var Q = { tier: coarse ? 1 : 0, ema: 16, over: 0, cool: 0, base: 1e9, pending: false };

var app = $('app'), canvas = $('gl');
var renderer;
try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: !coarse, stencil: false, alpha: false, powerPreference: 'high-performance' }); }
catch (e) { window.fail('متصفحك مش بيدعم الرسومات ثلاثية الأبعاد. افتح اللعبة في كروم أو سفاري.'); throw e; }
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = !coarse;
renderer.shadowMap.type = T.PCFShadowMap;
function applyTier() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[Q.tier].dpr)); resize(); }

/* ---------- scene, palette per level ---------- */
var scene = new T.Scene();
var PAL = [
  { sky: ['#01030a', '#071030', '#0b1428'], fog: 0x0b1428, hemi: 0x9ab8ff, accent: 0x3be3ff, css: '59,227,255' },
  { sky: ['#06010f', '#22083e', '#160a2c'], fog: 0x160a2c, hemi: 0xd9a0ff, accent: 0xff4fd8, css: '255,79,216' },
  { sky: ['#0a0402', '#34180a', '#22110a'], fog: 0x22110a, hemi: 0xffc890, accent: 0xffb347, css: '255,179,71' },
  { sky: ['#0b0104', '#36060f', '#24060c'], fog: 0x24060c, hemi: 0xff9aa8, accent: 0xff4466, css: '255,68,102' },
  { sky: ['#02010c', '#160d42', '#100a2c'], fog: 0x100a2c, hemi: 0xb9a0ff, accent: 0xe6b85c, css: '230,184,92' }
];
function palFor(L) { return PAL[Math.min(4, Math.floor((clamp(L, 1, 10) - 1) / 2))]; }
var pal = PAL[0];
scene.fog = new T.Fog(pal.fog, 55, 150);
var skyC = document.createElement('canvas'); skyC.width = 16; skyC.height = 256;
var skyTex = new T.CanvasTexture(skyC); skyTex.encoding = T.sRGBEncoding; skyTex.generateMipmaps = false; skyTex.minFilter = T.LinearFilter;
function paintSky(p) {
  var x = skyC.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, p.sky[0]); g.addColorStop(.35, p.sky[1]); g.addColorStop(.52, p.sky[2]); g.addColorStop(1, p.sky[2]);
  x.fillStyle = g; x.fillRect(0, 0, 16, 256); skyTex.needsUpdate = true;
}
paintSky(pal); scene.background = skyTex;
var camera = new T.PerspectiveCamera(62, 1, .3, 420);
camera.userData = { y: 5.2, z: 9.4, fov: 60, bossScale: 1.3 };

/* ---------- reflection environment (seeded, neon strips so metals pick up the track colours) ---------- */
function buildEnv() {
  var c = document.createElement('canvas'); c.width = 512; c.height = 256; var x = c.getContext('2d');
  var g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#0a1230'); g.addColorStop(.3, '#223a6e'); g.addColorStop(.48, '#9fb6d8'); g.addColorStop(.5, '#e8f0ff');
  g.addColorStop(.53, '#1b2238'); g.addColorStop(1, '#070a12');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  var r = mulberry(4242), cols = ['#ffffff', '#3be3ff', '#ffd27a', '#ff4fd8', '#3be3ff'];
  for (var i = 0; i < 22; i++) {
    x.fillStyle = cols[i % 5]; x.globalAlpha = .5 + r() * .45;
    var w = 4 + r() * 18, h = 30 + r() * 90; x.fillRect(r() * 512, 10 + r() * 100, w, h);
  }
  x.globalAlpha = 1;
  var t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding;
  var pm = new T.PMREMGenerator(renderer);
  if (scene.environment) scene.environment.dispose();
  scene.environment = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose();
}
buildEnv();

/* ---------- lights ---------- */
var hemi = new T.HemisphereLight(pal.hemi, 0x20122a, .55); scene.add(hemi);
var sun = new T.DirectionalLight(0xfff0d0, 1.7);
sun.castShadow = !coarse;
sun.shadow.mapSize.set(1024, 1024);
var sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 80;
sun.shadow.bias = -0.0006;
scene.add(sun); scene.add(sun.target);
var glow = new T.PointLight(pal.accent, 1.4, 9, 2); scene.add(glow);

/* ---------- materials and geometry ---------- */
function M(color, metal, rough, extra) { return new T.MeshStandardMaterial(Object.assign({ color: color, metalness: metal, roughness: rough }, extra || {})); }
function G(color, extra) { return new T.MeshBasicMaterial(Object.assign({ color: color, toneMapped: false }, extra || {})); }
var mat = {
  chrome: M(0xdfe7f3, 1, .12), steel: M(0x8794a8, 1, .28), dark: M(0x1b2230, .9, .4, { envMapIntensity: .35 }), gold: M(0xf0bf5e, 1, .2),
  crimson: M(0xc4203f, .9, .28), violet: M(0x6a4cff, .95, .22), copper: M(0xc86b3c, 1, .25), teal: M(0x1fb5c9, .95, .2),
  deepViolet: M(0x4a1fb0, .95, .22),
  gCyan: G(0x3be3ff), gGold: G(0xffc857), gRed: G(0xff4466), gViolet: G(0xb18cff), gOrange: G(0xff8a3d), gWhite: G(0xffffff), gPink: G(0xff5c8a)
};
var geo = {
  box: new T.BoxGeometry(1, 1, 1), cyl: new T.CylinderGeometry(1, 1, 1, 14), cone: new T.ConeGeometry(1, 1, 10),
  sph: new T.SphereGeometry(1, 12, 8), sphHi: new T.SphereGeometry(1, 22, 16),
  tor: new T.TorusGeometry(1, .07, 6, 32), torT: new T.TorusGeometry(1, .14, 8, 28),
  oct: new T.OctahedronGeometry(1), taper: new T.CylinderGeometry(.35, .62, 2.4, 8), hex: new T.CylinderGeometry(1, 1, 1, 6),
  plane: new T.PlaneGeometry(1, 1)
};
/* one mesh per part, used for animated parts and the player */
function add(parent, g, m, s, p, cast, rot) {
  var o = new T.Mesh(g, m); o.scale.set(s[0], s[1], s[2]); o.position.set(p[0], p[1], p[2]);
  if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
  o.castShadow = (cast === true) && !coarse; parent.add(o); return o;
}
/* merged builder: collects parts per material and emits one mesh per material (5 draws instead of 13 per obstacle) */
var _m4 = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3();
function Builder() { this.b = []; }
Builder.prototype.add = function (g, m, s, p, rot) {
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0); _q.setFromEuler(_e); _v.set(p[0], p[1], p[2]); _s.set(s[0], s[1], s[2]);
  _m4.compose(_v, _q, _s);
  var src = g.index ? g.toNonIndexed() : g.clone(); src.applyMatrix4(_m4);
  var bucket = null; for (var i = 0; i < this.b.length; i++) if (this.b[i].m === m) bucket = this.b[i];
  if (!bucket) { bucket = { m: m, parts: [] }; this.b.push(bucket); }
  bucket.parts.push(src); return this;
};
Builder.prototype.finish = function (parent, cast) {
  for (var i = 0; i < this.b.length; i++) {
    var parts = this.b[i].parts, pos = [], nor = [], uv = [], k, p;
    for (k = 0; k < parts.length; k++) {
      p = parts[k]; pos.push.apply(pos, p.attributes.position.array);
      if (p.attributes.normal) nor.push.apply(nor, p.attributes.normal.array);
      if (p.attributes.uv) uv.push.apply(uv, p.attributes.uv.array);
    }
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    if (nor.length === pos.length) out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    if (uv.length === pos.length / 3 * 2) out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    var mesh = new T.Mesh(out, this.b[i].m); mesh.castShadow = (cast === true) && !coarse; parent.add(mesh);
  }
  return parent;
};

/* ---------- glow sprites (fake bloom) ---------- */
var glowTex = (function () {
  var c = document.createElement('canvas'); c.width = 64; c.height = 64; var x = c.getContext('2d');
  var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
})();
function glowSprite(hex, size, op, fogged) {
  var s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: hex, transparent: true, opacity: op == null ? .8 : op, blending: T.AdditiveBlending, depthWrite: false, fog: !!fogged, toneMapped: false }));
  s.scale.set(size, size, 1); return s;
}
var blobTex = (function () {
  var c = document.createElement('canvas'); c.width = 64; c.height = 64; var x = c.getContext('2d');
  var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(.5, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
})();
var blobGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function blobShadow(size) {
  var m = new T.Mesh(blobGeo, new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.scale.set(size, 1, size * .8); m.position.y = .02; return m;
}

/* ---------- floor: diffuse map with baked sheen + emissive neon lines that scroll with it ---------- */
var floorTex, floorEm, floorMat;
(function () {
  var S = 512, c = document.createElement('canvas'), c2 = document.createElement('canvas'); c.width = c.height = S; c2.width = c2.height = S;
  var x = c.getContext('2d'), e = c2.getContext('2d'), lw = S / LANES, i, j;
  for (i = 0; i < LANES; i++) {
    var g = x.createLinearGradient(i * lw, 0, (i + 1) * lw, 0), a = i % 2 ? '#1b2333' : '#202a3c';
    g.addColorStop(0, '#141b29'); g.addColorStop(.5, a); g.addColorStop(1, '#141b29');
    x.fillStyle = g; x.fillRect(i * lw, 0, lw, S);
  }
  var sheen = x.createLinearGradient(0, 0, S, 0); sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(.5, 'rgba(180,220,255,.08)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = sheen; x.fillRect(0, 0, S, S);
  for (i = 0; i < 700; i++) { x.fillStyle = 'rgba(255,255,255,' + (fixedRnd() * .05) + ')'; x.fillRect(fixedRnd() * S, fixedRnd() * S, 1, 3 + fixedRnd() * 25); }
  x.fillStyle = 'rgba(0,0,0,.35)'; for (j = 0; j < 4; j++) x.fillRect(0, j * S / 4 - 1, S, 2);
  e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  e.fillStyle = 'rgba(120,210,255,.5)'; for (j = 0; j < 4; j++) e.fillRect(0, j * S / 4 + 1, S, 1);
  for (i = 0; i <= LANES; i++) {
    var edge = (i === 0 || i === LANES);
    e.fillStyle = edge ? 'rgba(255,200,100,1)' : 'rgba(110,200,255,.75)';
    e.fillRect(i * lw - (edge ? 2 : 1), 0, edge ? 4 : 1.5, S);
  }
  e.fillStyle = 'rgba(110,200,255,.55)';
  for (i = 0; i < LANES; i++) { var cx = i * lw + lw / 2; e.beginPath(); e.moveTo(cx, S / 2 - 17); e.lineTo(cx + 13, S / 2 + 3); e.lineTo(cx + 6, S / 2 + 3); e.lineTo(cx, S / 2 - 7); e.lineTo(cx - 6, S / 2 + 3); e.lineTo(cx - 13, S / 2 + 3); e.closePath(); e.fill(); }
  floorTex = new T.CanvasTexture(c); floorEm = new T.CanvasTexture(c2);
  [floorTex, floorEm].forEach(function (t) { t.wrapT = T.RepeatWrapping; t.wrapS = T.ClampToEdgeWrapping; t.repeat.set(1, 260 / TILE); t.encoding = T.sRGBEncoding; t.anisotropy = coarse ? 2 : Math.min(8, renderer.capabilities.getMaxAnisotropy()); });
  floorMat = new T.MeshStandardMaterial({ map: floorTex, emissiveMap: floorEm, emissive: 0xffffff, emissiveIntensity: .55, metalness: .6, roughness: .4, envMapIntensity: .8 });
  var plane = new T.Mesh(new T.PlaneGeometry(TRACK_W, 260), floorMat);
  plane.rotation.x = -Math.PI / 2; plane.position.set(0, 0, -100); plane.receiveShadow = !coarse; scene.add(plane);
  [-1, 1].forEach(function (s) {
    var rx = s * (TRACK_W / 2 + .35);
    var rail = new T.Mesh(geo.box, mat.chrome); rail.scale.set(.5, .7, 260); rail.position.set(rx, .35, -100); scene.add(rail);
    var strip = new T.Mesh(geo.box, s < 0 ? mat.gCyan : mat.gGold); strip.scale.set(.12, .08, 260); strip.position.set(rx, .72, -100); scene.add(strip);
  });
})();

/* ---------- towers: two leapfrogging segments, each side merged into 2 meshes, lit windows ---------- */
var TOWER_GAP = 16, TOWER_N = 11, SEG = TOWER_GAP * TOWER_N, towerSegs = [];
(function () {
  var wc = document.createElement('canvas'); wc.width = 64; wc.height = 128; var wx = wc.getContext('2d');
  wx.fillStyle = '#000'; wx.fillRect(0, 0, 64, 128);
  var wcols = ['#ffd9a0', '#3be3ff', '#ff4fd8', '#ffffff'];
  for (var r = 0; r < 12; r++) for (var c = 0; c < 4; c++) if (fixedRnd() < .32) { wx.fillStyle = wcols[Math.floor(fixedRnd() * 4)]; wx.globalAlpha = .5 + fixedRnd() * .5; wx.fillRect(c * 16 + 4, r * 10 + 3, 8, 5); }
  var winTex = new T.CanvasTexture(wc); winTex.wrapS = winTex.wrapT = T.RepeatWrapping; winTex.encoding = T.sRGBEncoding;
  var bodyMat = new T.MeshStandardMaterial({ color: 0x0c1322, metalness: .4, roughness: .7, envMapIntensity: .25, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: .9 });
  var strips = [mat.gCyan, mat.gGold, mat.gViolet, mat.gOrange];
  function makeSeg() {
    var grp = new T.Group();
    [-1, 1].forEach(function (s) {
      var body = new Builder(), lit = new Builder();
      for (var i = 0; i < TOWER_N; i++) {
        var w = 2 + fixedRnd() * 3, h = 7 + fixedRnd() * 20, d = 2.5 + fixedRnd() * 3;
        var x0 = s * (TRACK_W / 2 + 5 + fixedRnd() * 7 + w / 2), z0 = -i * TOWER_GAP - fixedRnd() * 6;
        var bg = new T.BoxGeometry(w, h, d), uv = bg.attributes.uv, nr = bg.attributes.normal; /* scale uv per face so windows stay the same size on every tower */
        for (var k = 0; k < uv.count; k++) { var ax = Math.abs(nr.getX(k)) > .5, ay = Math.abs(nr.getY(k)) > .5; uv.setXY(k, uv.getX(k) * (ax ? d : w) / 3, uv.getY(k) * (ay ? d : h) / 6); }
        body.add(bg, bodyMat, [1, 1, 1], [x0, h / 2, z0]);
        lit.add(geo.box, strips[Math.floor(fixedRnd() * 4)], [.08, h * .88, d * .3], [x0 - s * (w / 2 + .02), h / 2, z0]);
        lit.add(geo.box, mat.chrome, [w * 1.08, .25, d * 1.08], [x0, h, z0]);
        if (fixedRnd() < .6) { lit.add(geo.cyl, mat.chrome, [.06, 3, .06], [x0, h + 1.5, z0]); lit.add(geo.sph, strips[Math.floor(fixedRnd() * 4)], [.25, .25, .25], [x0, h + 3.1, z0]); }
      }
      body.finish(grp); lit.finish(grp);
    });
    return grp;
  }
  var a = makeSeg(), b = makeSeg(); a.position.z = 20; b.position.z = 20 - SEG; scene.add(a); scene.add(b); towerSegs.push(a, b);
})();
function stepWorld(dz) {
  floorTex.offset.y += dz / TILE;
  for (var i = 0; i < towerSegs.length; i++) { var t = towerSegs[i]; t.position.z += dz; if (t.position.z > SEG + 25) t.position.z -= 2 * SEG; }
}

/* ---------- backdrop: planet, atmosphere, horizon glow, stars ---------- */
var planet, planetRing, horizonGlow, atmo, stars;
(function () {
  var pl = new T.Group();
  planet = new T.Mesh(new T.SphereGeometry(26, 24, 16), new T.MeshStandardMaterial({ color: 0x9aa9c4, metalness: 1, roughness: .3, fog: false })); pl.add(planet);
  planetRing = new T.Mesh(new T.TorusGeometry(44, 1.1, 6, 64), new T.MeshStandardMaterial({ color: 0xe6b85c, metalness: 1, roughness: .25, fog: false }));
  planetRing.rotation.x = Math.PI / 2.6; pl.add(planetRing);
  atmo = glowSprite(pal.accent, 110, .35); pl.add(atmo);
  pl.position.set(-75, 48, -260); scene.add(pl);
  var hc = document.createElement('canvas'); hc.width = 4; hc.height = 64; var hx = hc.getContext('2d');
  var hg = hx.createLinearGradient(0, 0, 0, 64); hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(.6, 'rgba(255,255,255,.5)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  hx.fillStyle = hg; hx.fillRect(0, 0, 4, 64);
  horizonGlow = new T.Mesh(new T.PlaneGeometry(300, 46), new T.MeshBasicMaterial({ map: new T.CanvasTexture(hc), color: pal.accent, transparent: true, opacity: .3, blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  horizonGlow.position.set(0, 8, -238); scene.add(horizonGlow);
  var n = 420, pos = new Float32Array(n * 3);
  for (var k = 0; k < n; k++) { var a = fixedRnd() * Math.PI * 2, e = fixedRnd() * 1.2 + .08, r = 300; pos[k * 3] = Math.cos(a) * r; pos[k * 3 + 1] = Math.sin(e) * r * .8 + 20; pos[k * 3 + 2] = -Math.abs(Math.sin(a)) * r - 30; }
  var sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3));
  stars = new T.Points(sg, new T.PointsMaterial({ color: 0xcfe3ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: .9 })); scene.add(stars);
})();

/* ---------- palette transitions ---------- */
var palFrom = pal, palTo = pal, palT = 1, _c1 = new T.Color(), _c2 = new T.Color();
function setPalette(L) {
  var p = palFor(L); if (p === palTo) return;
  palFrom = palTo; palTo = p; palT = 0; paintSky(p);
  atmo.material.color.setHex(p.accent); horizonGlow.material.color.setHex(p.accent);
  document.documentElement.style.setProperty('--acc', p.css);
}
function tickPalette(dt) {
  if (palT >= 1) return; palT = Math.min(1, palT + dt * .7);
  _c1.setHex(palFrom.fog); _c2.setHex(palTo.fog); scene.fog.color.copy(_c1.lerp(_c2, palT));
  _c1.setHex(palFrom.hemi); _c2.setHex(palTo.hemi); hemi.color.copy(_c1.lerp(_c2, palT));
  _c1.setHex(palFrom.accent); _c2.setHex(palTo.accent); glow.color.copy(_c1.lerp(_c2, palT));
}

/* ---------- resize ---------- */
function resize() {
  var w = app.clientWidth || innerWidth, h = app.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  var a = w / h; camera.aspect = a;
  var u = camera.userData;
  u.fov = a < .75 ? 70 : (a < 1.1 ? 64 : 58);
  u.y = a < .75 ? 5.6 : (a < 1.1 ? 5.4 : 5.0); u.z = a < .75 ? 9.8 : (a < 1.1 ? 9.6 : 9.2);
  u.bossScale = a < .75 ? 1.7 : 1.3;
  camera.fov = u.fov; camera.updateProjectionMatrix();
}
var _rsT = null;
function scheduleResize() { requestAnimationFrame(resize); clearTimeout(_rsT); _rsT = setTimeout(resize, 220); }
window.addEventListener('resize', scheduleResize);
window.addEventListener('orientationchange', scheduleResize);
if (window.visualViewport) visualViewport.addEventListener('resize', scheduleResize);
window.__gameOk = true;
