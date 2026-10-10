/* builders.js: obstacles, pickups, boss, projectiles, particles, effects, player model. Depends on core.js. */
'use strict';

/* ---------- obstacle builders: static parts merged, moving parts separate ---------- */
function slideCue(g) { var s = glowSprite(0xff4466, 2.6, .55, true); s.position.y = .25; s.visible = false; g.add(s); g.userData.cue = s; return g; }
function buildSpikes() {
  var g = new T.Group(), b = new Builder();
  b.add(geo.box, mat.dark, [1.3, .3, 1.3], [0, .15, 0]);
  b.add(geo.box, mat.gRed, [1.34, .05, 1.34], [0, .33, 0]);
  for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) { var h = (i === 0 && j === 0) ? 1.45 : .95; b.add(geo.cone, mat.gold, [.17, h, .17], [i * .4, .35 + h / 2, j * .4]); }
  [[-.62, -.62], [.62, -.62], [-.62, .62], [.62, .62]].forEach(function (p) { b.add(geo.cyl, mat.chrome, [.07, .45, .07], [p[0], .52, p[1]]); });
  b.finish(g, true); return slideCue(g);
}
function buildCrate() {
  var g = new T.Group(), b = new Builder(), y = .68, o = .58, L = 1.28, t = .1, sx, sy, sz;
  b.add(geo.box, mat.crimson, [1.1, 1.1, 1.1], [0, y, 0]);
  for (sy = -1; sy <= 1; sy += 2) for (sz = -1; sz <= 1; sz += 2) b.add(geo.box, mat.chrome, [L, t, t], [0, y + sy * o, sz * o]);
  for (sx = -1; sx <= 1; sx += 2) for (sz = -1; sz <= 1; sz += 2) b.add(geo.box, mat.chrome, [t, L, t], [sx * o, y, sz * o]);
  for (sx = -1; sx <= 1; sx += 2) for (sy = -1; sy <= 1; sy += 2) b.add(geo.box, mat.chrome, [t, t, L], [sx * o, y + sy * o, 0]);
  b.add(geo.box, mat.gGold, [1.5, .1, .04], [0, y, .57], [0, 0, Math.PI / 4]);
  b.add(geo.box, mat.gGold, [1.5, .1, .04], [0, y, .57], [0, 0, -Math.PI / 4]);
  b.add(geo.box, mat.gOrange, [.3, .3, .06], [0, y, .58]);
  b.finish(g, true); return slideCue(g);
}
function buildSaw() {
  var g = new T.Group(), b = new Builder();
  b.add(geo.cyl, mat.chrome, [.58, .12, .58], [0, .06, 0]);
  b.add(geo.cyl, mat.steel, [.1, 1.1, .1], [0, .62, 0]);
  b.finish(g, true);
  var sp = new T.Group(), sb = new Builder(); sp.position.set(0, 1.2, 0); g.add(sp);
  sb.add(geo.cyl, mat.chrome, [.7, .1, .7], [0, 0, 0], [Math.PI / 2, 0, 0]);
  sb.add(geo.cyl, mat.dark, [.5, .13, .5], [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (var i = 0; i < 14; i++) { var a = i / 14 * Math.PI * 2; sb.add(geo.cone, mat.gold, [.12, .34, .12], [Math.cos(a) * .8, Math.sin(a) * .8, 0], [0, 0, a - Math.PI / 2]); }
  sb.add(geo.tor, mat.gRed, [.52, .52, .52], [0, 0, .08]);
  sb.add(geo.sph, mat.gRed, [.17, .17, .17], [0, 0, .1]);
  sb.finish(sp, true);
  var gl = glowSprite(0xff4466, 1.4, .5, true); gl.position.set(0, 1.2, .2); g.add(gl);
  g.userData.tick = function (t, dt) { sp.rotation.z -= dt * 10; };
  return slideCue(g);
}
function buildPylon() {
  var g = new T.Group(), b = new Builder();
  b.add(geo.hex, mat.chrome, [.8, .2, .8], [0, .1, 0]);
  b.add(geo.taper, mat.violet, [1, 1, 1], [0, 1.4, 0]);
  [.7, 1.3, 1.9].forEach(function (y, i) { var r = .58 - i * .08; b.add(geo.tor, mat.gCyan, [r, r, r], [0, y, 0], [Math.PI / 2, 0, 0]); });
  b.add(geo.tor, mat.gold, [.5, .5, .5], [0, 2.7, 0], [Math.PI / 2, 0, 0]);
  b.finish(g, true);
  var cr = add(g, geo.oct, mat.gViolet, [.34, .5, .34], [0, 3.05, 0]);
  var gl = glowSprite(0xb18cff, 1.8, .6, true); gl.position.y = 3.05; g.add(gl);
  g.userData.tick = function (t, dt) { cr.rotation.y += dt * 3; cr.position.y = 3.05 + Math.sin(t * 3) * .08; };
  return slideCue(g);
}
function buildGimbal() {
  var g = new T.Group(), b = new Builder();
  b.add(geo.cyl, mat.dark, [.34, .25, .34], [0, .125, 0]);
  b.add(geo.cyl, mat.steel, [.08, .9, .08], [0, .7, 0]);
  b.finish(g, true);
  var c = new T.Group(); c.position.set(0, 1.55, 0); g.add(c);
  var core = add(c, geo.sph, mat.gOrange, [.26, .26, .26], [0, 0, 0]);
  var gl = glowSprite(0xff8a3d, 1.6, .6, true); c.add(gl);
  var r1 = add(c, geo.torT, mat.gold, [.72, .72, .72], [0, 0, 0], true);
  var r2 = add(c, geo.torT, mat.copper, [.58, .58, .58], [0, 0, 0], true);
  var r3 = add(c, geo.torT, mat.chrome, [.45, .45, .45], [0, 0, 0], true);
  r2.rotation.x = Math.PI / 2; r3.rotation.y = Math.PI / 2;
  g.userData.tick = function (t, dt) { r1.rotation.x += dt * 2.2; r1.rotation.y += dt * .8; r2.rotation.y += dt * 2.8; r3.rotation.z += dt * 3.4; c.position.y = 1.55 + Math.sin(t * 2.5) * .1; core.scale.setScalar(.26 + Math.sin(t * 8) * .03); };
  return slideCue(g);
}
var builders = [buildSpikes, buildCrate, buildSaw, buildPylon, buildGimbal];
var OBS_NAMES = ['spikes', 'crate', 'saw', 'pylon', 'gimbal'];
var pool = [[], [], [], [], []];
function acquireObs(t) { var o = pool[t].pop(); if (!o) { o = builders[t](); scene.add(o); } o.visible = true; o.userData.cue.visible = false; return o; }
function releaseObs(o, t) { o.visible = false; pool[t].push(o); }
function prewarm() { for (var t = 0; t < 5; t++) while (pool[t].length < 8) { var o = builders[t](); o.visible = false; scene.add(o); pool[t].push(o); } }

/* ---------- heart pickup with a sky beam so it reads from 100 m away ---------- */
var heartGeo = (function () {
  var s = new T.Shape(), x = 0, y = 0;
  s.moveTo(x + .25, y + .25);
  s.bezierCurveTo(x + .25, y + .25, x + .2, y, x, y);
  s.bezierCurveTo(x - .3, y, x - .3, y + .35, x - .3, y + .35);
  s.bezierCurveTo(x - .3, y + .55, x - .1, y + .77, x + .25, y + .95);
  s.bezierCurveTo(x + .6, y + .77, x + .8, y + .55, x + .8, y + .35);
  s.bezierCurveTo(x + .8, y + .35, x + .8, y, x + .5, y);
  s.bezierCurveTo(x + .35, y, x + .25, y + .25, x + .25, y + .25);
  var g = new T.ExtrudeGeometry(s, { depth: .28, bevelEnabled: true, bevelThickness: .08, bevelSize: .07, bevelSegments: 2, curveSegments: 8 });
  g.translate(-.25, -.47, -.14); return g;
})();
var heartMat = M(0xff2a5a, 1, .18, { emissive: 0x7a0a28, emissiveIntensity: .9 });
var beamTex = (function () {
  var c = document.createElement('canvas'); c.width = 4; c.height = 128; var x = c.getContext('2d');
  var g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.85, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 4, 128); return new T.CanvasTexture(c);
})();
var beamGeo = new T.CylinderGeometry(.35, .35, 40, 10, 1, true);
function buildHeart() {
  var g = new T.Group(), pv = new T.Group(); g.add(pv);
  var h = new T.Mesh(heartGeo, heartMat); h.scale.setScalar(1.25); h.castShadow = !coarse; pv.add(h);
  var halo = new T.Mesh(geo.tor, mat.gGold); halo.scale.setScalar(.95); pv.add(halo);
  var halo2 = new T.Mesh(geo.tor, mat.gCyan); halo2.scale.setScalar(.82); halo2.rotation.x = Math.PI / 2; pv.add(halo2);
  pv.position.y = 1.2;
  var gl = glowSprite(0xff5c8a, 3.2, .55, true); gl.position.y = 1.2; g.add(gl);
  var beam = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ map: beamTex, color: 0xff5c8a, transparent: true, opacity: .32, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false, toneMapped: false }));
  beam.position.y = 20; g.add(beam);
  g.userData.tick = function (t, dt) { pv.rotation.y += dt * 2.4; pv.position.y = 1.2 + Math.sin(t * 3) * .14; halo2.rotation.z += dt * 2; gl.material.opacity = .45 + .2 * Math.sin(t * 6); };
  return g;
}
var heartPool = [];
function acquireHeart() { var o = heartPool.pop(); if (!o) { o = buildHeart(); scene.add(o); } o.visible = true; return o; }
function releaseHeart(o) { o.visible = false; heartPool.push(o); }

/* ---------- boss: built once, merged, re-used ---------- */
function buildMonster() {
  var g = new T.Group(), p = {}, b = new Builder(), i;
  [-.75, .75].forEach(function (x) {
    b.add(geo.cyl, mat.steel, [.38, 1.3, .38], [x, .95, 0]);
    b.add(geo.sph, mat.gold, [.44, .44, .44], [x, 1.6, 0]);
    b.add(geo.box, mat.dark, [.85, .3, 1.2], [x, .15, .2]);
    [-.24, .24].forEach(function (o) { b.add(geo.cone, mat.chrome, [.1, .4, .1], [x + o, .15, .92], [Math.PI / 2, 0, 0]); });
  });
  b.add(geo.sphHi, mat.deepViolet, [1.35, 1.2, 1.0], [0, 2.55, 0]);
  [-.55, 0, .55].forEach(function (y) { var f = 1 - Math.abs(y) * .35; b.add(geo.torT, mat.chrome, [1.3 * f, 1.0 * f, 1], [0, 2.55 + y, 0], [Math.PI / 2, 0, 0]); });
  b.add(geo.sph, mat.gOrange, [.34, .34, .22], [0, 2.65, .97]);
  b.add(geo.tor, mat.gold, [.52, .52, .52], [0, 2.65, .98]);
  var hy = 4.2, hz = .15;
  b.add(geo.sphHi, mat.crimson, [.74, .62, .68], [0, hy, hz]);
  b.add(geo.box, mat.dark, [.95, .26, .55], [0, hy - .36, hz + .42]);
  for (i = -2; i <= 2; i++) b.add(geo.cone, mat.chrome, [.06, .22, .06], [i * .17, hy - .17, hz + .7], [Math.PI, 0, 0]);
  [-1, 1].forEach(function (s) { b.add(geo.cone, mat.gold, [.18, 1.0, .18], [s * .52, hy + .6, hz - .05], [0, 0, -s * .5]); });
  for (i = 0; i < 5; i++) b.add(geo.cone, i % 2 ? mat.gold : mat.deepViolet, [.22, .95, .22], [0, 2.2 + i * .5, -1.0], [-.9, 0, 0]);
  b.finish(g);
  p.eyes = [add(g, geo.sph, mat.gRed, [.16, .1, .1], [-.32, hy + .12, hz + .6]), add(g, geo.sph, mat.gRed, [.16, .1, .1], [.32, hy + .12, hz + .6])];
  p.eyeGlow = glowSprite(0xff4466, 1.6, .7); p.eyeGlow.position.set(0, hy + .12, hz + .7); g.add(p.eyeGlow);
  var cg = glowSprite(0xff8a3d, 2.2, .6); cg.position.set(0, 2.65, 1.1); g.add(cg);
  function arm(s) {
    var sh = new T.Group(); sh.position.set(s * 1.6, 3.3, 0); g.add(sh);
    var ab = new Builder(); ab.add(geo.sph, mat.crimson, [.55, .55, .55], [0, 0, 0]); ab.add(geo.cyl, mat.steel, [.28, 1.3, .28], [0, -.7, 0]); ab.finish(sh);
    var el = new T.Group(); el.position.set(0, -1.35, 0); sh.add(el);
    var eb = new Builder(); eb.add(geo.sph, mat.gold, [.34, .34, .34], [0, 0, 0]); eb.add(geo.cyl, mat.chrome, [.24, 1.1, .24], [0, -.55, 0]);
    for (var k = -1; k <= 1; k++) eb.add(geo.cone, mat.gold, [.1, .5, .1], [k * .17, -1.3, .1], [Math.PI, 0, 0]);
    eb.finish(el);
    var hg = glowSprite(0xff8a3d, 1.2, .0); hg.position.set(0, -1.4, .2); el.add(hg);
    return { sh: sh, el: el, hand: hg };
  }
  p.armL = arm(-1); p.armR = arm(1);
  p.ring = add(g, geo.tor, mat.gRed, [1.9, 1.9, 1.9], [0, .06, 0], false, [Math.PI / 2, 0, 0]);
  p.shadow = blobShadow(4.2); g.add(p.shadow);
  g.visible = false; scene.add(g);
  return { g: g, p: p };
}
var monsterProto = buildMonster();

/* ---------- projectiles: pooled ---------- */
function buildFire() {
  var g = new T.Group();
  add(g, geo.sph, mat.gOrange, [.34, .34, .34], [0, 0, 0]);
  var gl = glowSprite(0xff7a3d, 2.4, .85); g.add(gl);
  g.userData.ring = add(g, geo.tor, mat.gRed, [.55, .55, .55], [0, 0, 0]);
  g.visible = false; scene.add(g); return g;
}
function buildBullet() {
  var g = new T.Group(), c = new T.Mesh(geo.cyl, mat.gCyan); c.scale.set(.08, 1.1, .08); c.rotation.x = Math.PI / 2; g.add(c);
  var h = new T.Mesh(geo.sph, mat.gWhite); h.scale.set(.15, .15, .15); h.position.z = -.55; g.add(h);
  var gl = glowSprite(0x3be3ff, 1.1, .8); gl.position.z = -.4; g.add(gl);
  g.visible = false; scene.add(g); return g;
}
var firePool = [], bulletPool = [];
function acquire(poolArr, maker) { var o = poolArr.pop() || maker(); o.visible = true; return o; }
function release(poolArr, o) { o.visible = false; poolArr.push(o); }

/* ---------- warn strips (boss charge and fireball lanes) ---------- */
var warnMat = new T.MeshBasicMaterial({ color: 0xff2a4a, transparent: true, opacity: .4, depthWrite: false, toneMapped: false, blending: T.AdditiveBlending });
var warnMeshes = [];
for (var _w = 0; _w < 4; _w++) { var wm = new T.Mesh(geo.box, warnMat); wm.visible = false; scene.add(wm); warnMeshes.push(wm); }

/* ---------- particles: one Points buffer, additive, no allocation at runtime ---------- */
var NP = 640, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pLife = new Float32Array(NP), pMax = new Float32Array(NP), pBase = new Float32Array(NP * 3), pGrav = new Float32Array(NP), pHead = 0;
var pGeo = new T.BufferGeometry();
pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3).setUsage(T.DynamicDrawUsage));
pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3).setUsage(T.DynamicDrawUsage));
for (var _i = 0; _i < NP; _i++) pPos[_i * 3 + 1] = -100;
var parts = new T.Points(pGeo, new T.PointsMaterial({ size: .5, map: glowTex, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false, toneMapped: false }));
parts.frustumCulled = false; scene.add(parts);
var _pc = new T.Color();
function burst(x, y, z, color, n, spread, up, grav) {
  _pc.setHex(color); spread = spread || 5; up = up == null ? 5 : up; grav = grav == null ? 14 : grav;
  for (var i = 0; i < n; i++) {
    var k = pHead; pHead = (pHead + 1) % NP;
    var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * spread;
    pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z;
    pVel[k * 3] = Math.cos(a) * sp; pVel[k * 3 + 1] = up * (.4 + Math.random()); pVel[k * 3 + 2] = Math.sin(a) * sp;
    pLife[k] = pMax[k] = .5 + Math.random() * .6; pGrav[k] = grav;
    pBase[k * 3] = _pc.r; pBase[k * 3 + 1] = _pc.g; pBase[k * 3 + 2] = _pc.b;
    pCol[k * 3] = _pc.r; pCol[k * 3 + 1] = _pc.g; pCol[k * 3 + 2] = _pc.b;
  }
}
function updateParts(dt, dz) {
  for (var k = 0; k < NP; k++) {
    if (pLife[k] <= 0) continue;
    pLife[k] -= dt; var i3 = k * 3;
    if (pLife[k] <= 0) { pPos[i3 + 1] = -100; pCol[i3] = pCol[i3 + 1] = pCol[i3 + 2] = 0; continue; }
    pVel[i3 + 1] -= pGrav[k] * dt;
    pPos[i3] += pVel[i3] * dt; pPos[i3 + 1] = Math.max(.05, pPos[i3 + 1] + pVel[i3 + 1] * dt); pPos[i3 + 2] += pVel[i3 + 2] * dt + dz;
    var f = pLife[k] / pMax[k]; pCol[i3] = pBase[i3] * f; pCol[i3 + 1] = pBase[i3 + 1] * f; pCol[i3 + 2] = pBase[i3 + 2] * f;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}

/* ---------- speed lines: one mesh of thin quads around the camera ---------- */
var speedLines = (function () {
  var N = 22, pos = [], uv = [], r0 = 2.2;
  for (var i = 0; i < N; i++) {
    var a = (i / N) * Math.PI * 2 + fixedRnd() * .3, r = r0 + fixedRnd() * 2.2, w = .012 + fixedRnd() * .02, z0 = -2.5 - fixedRnd() * 2, z1 = z0 - 4 - fixedRnd() * 5;
    var cx = Math.cos(a) * r, cy = Math.sin(a) * r * .8, wx = -Math.sin(a) * w, wy = Math.cos(a) * w;
    var p0 = [cx + wx, cy + wy, z0], p1 = [cx - wx, cy - wy, z0], p2 = [cx - wx, cy - wy, z1], p3 = [cx + wx, cy + wy, z1];
    pos.push.apply(pos, p0.concat(p1, p2, p0, p2, p3)); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  var m = new T.Mesh(g, new T.MeshBasicMaterial({ map: beamTex, color: 0xbfe9ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthTest: false, depthWrite: false, side: T.DoubleSide, fog: false, toneMapped: false }));
  m.frustumCulled = false; m.renderOrder = 5; camera.add(m); scene.add(camera); return m;
})();

/* ---------- dash streaks and shock rings ---------- */
var streakTex = (function () {
  var c = document.createElement('canvas'); c.width = 128; c.height = 4; var x = c.getContext('2d');
  var g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 4); return new T.CanvasTexture(c);
})();
var streaks = [];
for (var _k = 0; _k < 4; _k++) {
  var sm = new T.Mesh(blobGeo, new T.MeshBasicMaterial({ map: streakTex, color: 0x3be3ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  sm.visible = false; sm.position.y = .05; scene.add(sm); streaks.push({ o: sm, life: 0 });
}
function dashFx(x0, x1) {
  var s = null; for (var i = 0; i < streaks.length; i++) if (streaks[i].life <= 0) { s = streaks[i]; break; }
  if (!s) s = streaks[0];
  s.life = .25; s.o.visible = true; s.o.position.set((x0 + x1) / 2, .05, 0); s.o.scale.set(Math.abs(x1 - x0) + 1.2, 1, .5); s.o.material.opacity = .9;
  burst(x0, .3, 0, 0x9fe9ff, 6, 2, 2, 6);
}
var waveGeo = new T.RingGeometry(.9, 1, 40).rotateX(-Math.PI / 2), waves = [];
for (var _r = 0; _r < 3; _r++) {
  var rm = new T.Mesh(waveGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: T.DoubleSide }));
  rm.visible = false; rm.position.y = .06; scene.add(rm); waves.push({ o: rm, life: 0, max: 1 });
}
function shockwave(x, z, color, size, dur) {
  var w = null; for (var i = 0; i < waves.length; i++) if (waves[i].life <= 0) { w = waves[i]; break; }
  if (!w) w = waves[0];
  w.life = w.max = dur || .6; w.size = size || 8; w.o.visible = true; w.o.position.set(x, .06, z); w.o.material.color.setHex(color); w.o.scale.setScalar(.5);
}
function updateFx(dt, dz) {
  var i, s, w, f;
  for (i = 0; i < streaks.length; i++) { s = streaks[i]; if (s.life <= 0) continue; s.life -= dt; s.o.position.z += dz; s.o.material.opacity = Math.max(0, s.life / .25) * .9; if (s.life <= 0) s.o.visible = false; }
  for (i = 0; i < waves.length; i++) { w = waves[i]; if (w.life <= 0) continue; w.life -= dt; w.o.position.z += dz; f = 1 - w.life / w.max; w.o.scale.setScalar(.5 + f * w.size); w.o.material.opacity = (1 - f) * .8; if (w.life <= 0) w.o.visible = false; }
}

/* ---------- player ---------- */
var player = {}, root = new T.Group(), body = new T.Group(); root.add(body); scene.add(root);
var skinMats = { steel: mat.steel.clone(), gold: mat.gold.clone(), cyan: mat.gCyan.clone(), flame: mat.gOrange.clone(), chrome: mat.chrome.clone(), dark: mat.dark.clone() };
(function () {
  var sm = skinMats;
  add(body, geo.box, sm.steel, [.72, .78, .42], [0, 1.4, 0], true);
  add(body, geo.box, sm.gold, [.5, .44, .1], [0, 1.48, -.24], true);
  add(body, geo.sph, sm.cyan, [.1, .1, .06], [0, 1.48, -.3]);
  add(body, geo.box, sm.dark, [.56, .22, .36], [.0, .95, 0], true);
  add(body, geo.box, sm.gold, [.62, .06, .42], [0, 1.06, 0]);
  add(body, geo.box, sm.dark, [.5, .6, .22], [0, 1.42, .32], true);
  player.flames = [];
  [-.14, .14].forEach(function (x) {
    add(body, geo.cyl, sm.chrome, [.09, .22, .09], [x, 1.22, .42]);
    var f = add(body, geo.cone, sm.flame, [.08, .4, .08], [x, .92, .42], false, [Math.PI, 0, 0]); player.flames.push(f);
  });
  var fg = glowSprite(0xff8a3d, .9, .5); fg.position.set(0, .95, .45); body.add(fg); player.flameGlow = fg;
  var head = new T.Group(); head.position.set(0, 1.98, 0); body.add(head); player.head = head;
  add(head, geo.sphHi, sm.chrome, [.27, .27, .27], [0, 0, 0], true);
  add(head, geo.box, sm.cyan, [.4, .11, .1], [0, .02, -.22]);
  var vg = glowSprite(0x3be3ff, .7, .7); vg.position.set(0, .02, -.3); head.add(vg); player.visorGlow = vg;
  add(head, geo.box, sm.gold, [.07, .13, .42], [0, .27, 0]);
  add(head, geo.cyl, sm.dark, [.12, .1, .12], [0, -.27, 0]);
  function leg(x) {
    var th = new T.Group(); th.position.set(x, 1.0, 0); body.add(th);
    add(th, geo.cyl, sm.steel, [.13, .5, .13], [0, -.25, 0], true);
    add(th, geo.sph, sm.gold, [.15, .15, .15], [0, -.5, 0]);
    var sh = new T.Group(); sh.position.set(0, -.5, 0); th.add(sh);
    add(sh, geo.cyl, sm.chrome, [.11, .46, .11], [0, -.23, 0], true);
    add(sh, geo.box, sm.dark, [.24, .16, .4], [0, -.5, -.07], true);
    add(sh, geo.box, sm.gold, [.25, .05, .1], [0, -.45, -.26]);
    return { t: th, s: sh };
  }
  function arm(x) {
    var sh = new T.Group(); sh.position.set(x, 1.68, 0); body.add(sh);
    add(sh, geo.sph, sm.gold, [.19, .19, .19], [0, 0, 0]);
    add(sh, geo.cyl, sm.chrome, [.09, .4, .09], [0, -.2, 0], true);
    var el = new T.Group(); el.position.set(0, -.4, 0); sh.add(el);
    add(el, geo.cyl, sm.steel, [.08, .38, .08], [0, -.19, 0], true);
    add(el, geo.sph, sm.dark, [.1, .1, .1], [0, -.4, 0]);
    return { t: sh, s: el };
  }
  player.legL = leg(-.2); player.legR = leg(.2); player.armL = arm(-.45); player.armR = arm(.45);
  root.scale.setScalar(.95);
  player.shadow = blobShadow(1.6); scene.add(player.shadow); /* in the scene, not under the leaning root, so it stays flat on the floor */
  var bub = new T.Mesh(new T.SphereGeometry(1.5, 16, 12), new T.MeshBasicMaterial({ color: 0x3be3ff, transparent: true, opacity: .16, blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide, toneMapped: false, fog: false }));
  bub.position.y = 1.2; bub.visible = false; root.add(bub); player.bubble = bub;
  var ring = new T.Mesh(geo.tor, mat.gCyan); ring.scale.setScalar(.75); ring.position.y = -.1; ring.rotation.x = Math.PI / 2; bub.add(ring); player.bubbleRing = ring;
})();
/* skins: [name, steel, gold, cyan, flame] */
var SKINS = [
  { name: 'فضي', steel: 0x8794a8, gold: 0xf0bf5e, cyan: 0x3be3ff, flame: 0xff8a3d, css: 'linear-gradient(180deg,#f3f6fb,#8794a8 60%,#566278)' },
  { name: 'ذهبي', steel: 0xd9a84a, gold: 0xfff0c4, cyan: 0xfff0a0, flame: 0xffc857, css: 'linear-gradient(180deg,#fff0c4,#f0c765 55%,#a8741b)' },
  { name: 'قرمزي', steel: 0xb3243f, gold: 0xffd27a, cyan: 0xff9db2, flame: 0xff4466, css: 'linear-gradient(180deg,#ff9db2,#e0214a 55%,#8d0f2c)' },
  { name: 'بنفسجي', steel: 0x6a4cff, gold: 0xb18cff, cyan: 0xff4fd8, flame: 0xb18cff, css: 'linear-gradient(180deg,#d9c8ff,#6a4cff 55%,#2d1a8a)' },
  { name: 'كروم أسود', steel: 0x1b2230, gold: 0x3be3ff, cyan: 0x3be3ff, flame: 0x3be3ff, css: 'linear-gradient(180deg,#5d6b82,#1b2230 55%,#05070d)' }
];
function applySkin(i) {
  var s = SKINS[clamp(i, 0, SKINS.length - 1)];
  skinMats.steel.color.setHex(s.steel); skinMats.gold.color.setHex(s.gold); skinMats.cyan.color.setHex(s.cyan); skinMats.flame.color.setHex(s.flame);
  player.visorGlow.material.color.setHex(s.cyan); player.flameGlow.material.color.setHex(s.flame);
}
var phase = 0, fireT = 0, squash = 0;
function animRunner(dt, spd, lean, t) {
  phase += dt * (6 + spd * .22);
  var p = phase, s = Math.sin(p);
  player.legL.t.rotation.x = s * .95; player.legR.t.rotation.x = -s * .95;
  player.legL.s.rotation.x = -(.7 + .7 * Math.sin(p - 1.3)); player.legR.s.rotation.x = -(.7 + .7 * Math.sin(p + Math.PI - 1.3));
  player.armL.t.rotation.x = -s * .85; player.armR.t.rotation.x = s * .85;
  player.armL.s.rotation.x = .95 + .25 * Math.sin(p); player.armR.s.rotation.x = .95 - .25 * Math.sin(p);
  if (fireT > 0) { fireT -= dt; player.armR.t.rotation.x = 1.5; player.armR.s.rotation.x = .12; }
  body.position.y = Math.abs(Math.cos(p)) * .1;
  body.rotation.x = -.12 - Math.min(.1, spd * .003);
  root.rotation.z = -lean;
  squash = Math.max(0, squash - dt * 5);
  root.scale.set(.95 * (1 - squash * .12), .95 * (1 + squash * .14), .95);
  for (var i = 0; i < player.flames.length; i++) player.flames[i].scale.set(.08, .3 + .14 * Math.sin(t * 50 + i * 2) + .06 * Math.sin(t * 31), .08);
  player.flameGlow.material.opacity = .35 + .15 * Math.sin(t * 40);
}
