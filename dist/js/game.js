/* game.js: run state, level tables, spawning, combat, damage, clutch chain, revive. Depends on core.js and builders.js.
   UI functions (renderHUD, toast, popText, setState, sfx, buzz, hurtFx, popHeart, showGameOver, showWin, showLevel, openRevive) live in ui.js. */
'use strict';

/* ---------- persistent progress ---------- */
var P = { best: 0, bestDaily: { d: '', s: 0 }, totalDist: 0, runs: 0, maxLevel: 1, skin: 0, streak: 0, lastDaily: '', mute: false, fx: true, seenMonster: false, tut: 0, won: false, lefty: false, scores: [] };
var storageOk = true;
(function () { try { var s = localStorage.getItem('mi_gams_v2'); if (s) { var o = JSON.parse(s); for (var k in o) if (o.hasOwnProperty(k)) P[k] = o[k]; } } catch (e) { storageOk = false; } })();
function saveP() { try { localStorage.setItem('mi_gams_v2', JSON.stringify(P)); } catch (e) { storageOk = false; } }
function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

/* ---------- run state ---------- */
var state = 'menu', level = 1, dist = 0, baseDist = 0, bonus = 0, lives = 3, targetLane = 4, px = laneX(4), speed = 0, speedCur = 0, visSpeed = 15;
var invuln = 0, trauma = 0, clock = 0, gameClock = 0, lastRowZ = 0, nextHeartK = 1, levelTimer = 0, dyingTimer = 0, reviveT = 0, rescueCd = 0;
var items = [], bullets = [], fireballs = [], monster = null, respawnT = 0, bossC = -9;
var mode = 'normal', runSeed = null, endless = false, aimLane = 4, revived = false, cause = '', beaten = false, chalBeaten = false, chal = 0;
var chain = 0, chainT = 0, mult = 1, bestChain = 0, kills = 0, hearts = 0, prevBest = 0;
var timeScale = 1, tsTarget = 1, hitStop = 0, slowT = 0, fovPunch = 0, exposureKick = 0, hurtDip = 0, grabNext = 0, shotURL = null, dirty = 2;
var fxQueue = [], debris = [], restoreList = [];

function LC() { return Math.min(level, MAX_LEVEL); }
function speedFor(L) { var c = Math.min(L, MAX_LEVEL); return 15 + (c - 1) * 2.7 + Math.min(Math.max(L - MAX_LEVEL, 0), 8) * .5; }
function timeGap(L) { return 1.15 - (Math.min(L, MAX_LEVEL) - 1) * .048; }
function curGap() { return speedFor(level) * timeGap(level); }
function levelStart(L) { return L <= MAX_LEVEL ? CUM[L - 1] : CUM[MAX_LEVEL] + (L - 11) * 500; }
function levelEnd(L) { return L <= MAX_LEVEL ? CUM[L] : CUM[MAX_LEVEL] + (L - 10) * 500; }
function spawnZ() { return -Math.max(110, speedFor(level) * 3.5); }
function score() { return Math.max(0, Math.floor(dist - baseDist)) + bonus; }
var WTAB = { 1: [1, 0, 0], 2: [.85, .15, 0], 3: [.7, .3, 0], 4: [.55, .45, 0], 5: [.45, .55, 0], 6: [.35, .55, .1], 7: [.25, .5, .25], 8: [.2, .45, .35], 9: [.15, .4, .45], 10: [.1, .35, .55] };
function pickWidth() { var t = WTAB[LC()], r = rnd(); return r < t[0] ? 1 : (r < t[0] + t[1] ? 2 : 3); }
var RANKS = ['لسه بتتعلم', 'لسه بتتعلم', 'بتفهم الدنيا', 'بتفهم الدنيا', 'شاطر', 'شاطر', 'محترف', 'محترف', 'وحش الوحوش', 'أسطورة'];
function rankFor(L) { return L > MAX_LEVEL ? 'أسطورة بلا نهاية' : RANKS[clamp(L, 1, MAX_LEVEL) - 1]; }

/* ---------- items ---------- */
function removeItem(it) {
  if (it.kind === 'obs') releaseObs(it.obj, it.type); else releaseHeart(it.obj);
  var i = items.indexOf(it); if (i >= 0) items.splice(i, 1);
}
function clearObstacles() { for (var i = items.length - 1; i >= 0; i--) if (items[i].kind === 'obs') { releaseObs(items[i].obj, items[i].type); items.splice(i, 1); } }
function clearAll() { for (var i = items.length - 1; i >= 0; i--) removeItem(items[i]); }
function heartNear(lane, z) { for (var i = 0; i < items.length; i++) { var it = items[i]; if (it.kind === 'heart' && it.lane === lane && Math.abs(it.z - z) < 9) return true; } return false; }
function addItem(kind, lane, z, obj, type) {
  obj.position.set(laneX(lane), 0, z); obj.position.x = laneX(lane);
  var it = { kind: kind, type: type, lane: lane, x: laneX(lane), z: z, obj: obj, hit: false, clutch: false }; items.push(it); return it;
}
function addCluster(z, w, start) {
  var base = randInt(0, 4), L = LC();
  var slide = (w === 1 || L >= 8) && L >= 6 && rnd() < Math.min(.4, (L - 5) * .08), sl = null;
  if (slide) { var amp = LW * (1 + rnd() * .5); sl = { amp: amp, spd: Math.min(1.6 + rnd() + L * .08, 5.2 / amp), ph: rnd() * 6.28, t: 0 }; }
  for (var i = 0; i < w; i++) {
    var lane = start + i; if (heartNear(lane, z)) continue;
    var type = (base + i) % 5, it = addItem('obs', lane, z, acquireObs(type), type);
    if (sl) { it.slide = { amp: sl.amp, spd: sl.spd, ph: sl.ph, cx: it.x, t: 0 }; it.obj.userData.cue.visible = true; }
  }
}
function spawnRow(z) {
  var w = pickWidth(), start, L = LC();
  if (mode === 'daily') { aimLane = clamp(aimLane + randInt(-2, 2), 0, LANES - 1); start = clamp(aimLane - randInt(0, w - 1), 0, LANES - w); }
  else if (rnd() < .72) start = clamp(targetLane - randInt(0, w - 1), 0, LANES - w); else start = randInt(0, LANES - w);
  addCluster(z, w, start);
  if (L >= 5 && rnd() < Math.min(.5, (L - 4) * .09)) {
    var w2 = (L >= 9 && rnd() < .5) ? 2 : 1, s2, tries = 0;
    do { s2 = randInt(0, LANES - w2); tries++; } while (tries < 6 && s2 < start + w && s2 + w2 > start);
    if (!(s2 < start + w && s2 + w2 > start)) addCluster(z, w2, s2);
  }
}
function prepopulate(startZ) { var gap = curGap(), z = startZ, last = startZ, sz = spawnZ(); while (z > sz) { spawnRow(z); last = z; z -= gap; } lastRowZ = last; }
function spawnHeart(zAbs) {
  var lane = randInt(1, LANES - 2), z = -(zAbs - dist);
  for (var i = items.length - 1; i >= 0; i--) { var it = items[i]; if (it.kind === 'obs' && it.lane === lane && Math.abs(it.z - z) < 11) removeItem(it); }
  addItem('heart', lane, z, acquireHeart(), -1);
}
function nextHeartDist() {
  var best = 1e9; for (var i = 0; i < items.length; i++) if (items[i].kind === 'heart') best = Math.min(best, -items[i].z);
  if (best < 1e9) return Math.max(1, Math.ceil(best));
  var at = nextHeartK * HEART_EVERY; if (!endless && at > FINISH) return -1; return Math.max(1, Math.ceil(at - dist));
}

/* ---------- boss ---------- */
var MON_Z = -30;
function monStats(L) {
  var c = Math.min(L, MAX_LEVEL), k = c - 3, ex = Math.max(0, L - MAX_LEVEL);
  return { hp: Math.min(28, Math.round(3 + k * 1.9 + ex * 1.5)), vx: 4.5 + k * 1.5, sw: Math.max(.42, 1.45 - k * .14), shoot: Math.max(1.05, 2.7 - k * .24),
    fbv: Math.min(36, 26 + k * 2.2), aim: Math.min(.8, .15 + k * .1), tele: Math.max(.55, .95 - (c - 6) * .07), chargeCd: Math.max(3.4, 8 - (c - 6)), respawn: Math.max(3, 8 - k * .6) };
}
function renderBoss() {
  var v = monster ? Math.max(0, Math.round(monster.hp / monster.maxHp * 100)) : -1;
  if (v === bossC) return; bossC = v;
  $('boss').hidden = (v < 0); if (v >= 0) $('bossBar').style.width = v + '%';
}
function hideWarns() { for (var i = 0; i < warnMeshes.length; i++) warnMeshes[i].visible = false; }
function clearCombat() {
  if (monster) { monsterProto.g.visible = false; monster = null; }
  var i; for (i = 0; i < bullets.length; i++) release(bulletPool, bullets[i].o);
  for (i = 0; i < fireballs.length; i++) release(firePool, fireballs[i].o);
  bullets.length = 0; fireballs.length = 0; hideWarns(); respawnT = 2.5; renderBoss();
}
function spawnMonster() {
  var st = monStats(level), lane = Math.floor(rndM() * (LANES - 4)) + 2, b = monsterProto;
  monster = { g: b.g, p: b.p, hp: st.hp, maxHp: st.hp, lane: lane, x: laneX(lane), tx: laneX(lane), z: -78, mode: 'enter', modeT: 0, t: 0, switchT: 1, shootT: 2.2, chargeT: st.chargeCd, flash: 0, holdT: 0, fireLanes: null };
  b.g.scale.setScalar(camera.userData.bossScale); b.g.position.set(monster.x, 0, monster.z); b.g.visible = true;
  trauma = Math.min(1, trauma + .5 * fxScale); fovPunch = 7 * fxScale; if (!RM) { tsTarget = .5; slowT = .5; } exposureKick = .5;
  sfx('roar', .9); buzz([30, 40, 80]); flashFx('boss');
  toast(P.seenMonster ? 'الوحش رجع' : 'الوحش وصل! دوس زر النار واضربه', P.seenMonster ? 1600 : 3600);
  if (!P.seenMonster) { P.seenMonster = true; saveP(); $('bFire').classList.add('intro'); }
  renderBoss();
}
function shootFire(st) {
  var m = monster, ls = m.fireLanes || [clamp(Math.round(m.x / LW + MID), 0, LANES - 1)];
  for (var i = 0; i < ls.length; i++) {
    var l = ls[i]; if (l < 0 || l >= LANES) continue;
    var f = acquire(firePool, buildFire); f.position.set(laneX(l), 1.3, m.z + 1.6);
    fireballs.push({ o: f, x: laneX(l), z: m.z + 1.6, v: st.fbv, delay: (ls.length > 1 && l !== ls[1]) ? .15 : 0 });
  }
  m.p.armL.hand.material.opacity = 1; m.p.armR.hand.material.opacity = 1;
  sfx('shoot', .35); m.fireLanes = null; hideWarns();
}
var lastFire = -9;
function fire(manual) {
  if (state !== 'playing' || level < 3) return;
  if (clock - lastFire < .26) return;
  lastFire = clock; fireT = .18;
  var b = acquire(bulletPool, buildBullet); b.position.set(px, 1.45, -.8);
  bullets.push({ o: b, x: px, z: -.8, pz: -.8 });
  burst(px, 1.45, -1, 0x9fe9ff, 3, 1.5, 1, 4);
  sfx('shoot', manual ? .6 : .45);
  if (manual) $('bFire').classList.remove('intro');
}
function killMonster() {
  var m = monster, st = monStats(level), pts = 300 + 50 * LC(), i;
  burst(m.x, 2.5, m.z, 0xffc857, 60, 7, 7); burst(m.x, 3.2, m.z, 0xff4466, 50, 6, 8); burst(m.x, 1.5, m.z, 0xb18cff, 40, 5, 6);
  shockwave(m.x, m.z, 0xffc857, 14, .7);
  monsterProto.g.visible = false; monster = null; hideWarns();
  for (i = 0; i < fireballs.length; i++) release(firePool, fireballs[i].o);
  fireballs.length = 0;
  bonus += pts; kills++; trauma = Math.min(1, trauma + .8 * fxScale); exposureKick = .9; fovPunch = 5 * fxScale;
  sfx('explode', 1); buzz([20, 30, 60]);
  if (lives < MAX_LIVES) spawnHeart(dist + 30 + Math.max(0, -m.z - 30));
  respawnT = st.respawn; renderBoss(); renderHUD(); popText('+' + pts + ' أسقطت الوحش', 'gold');
}
function damageMonster(b) {
  var m = monster; m.hp--; m.flash = .14;
  burst(b.x, 2.4, m.z + 1.2, 0xffc857, 14, 4, 3); sfx('hit', .25);
  if (m.hp <= 0) killMonster(); else renderBoss();
}
function updateCombat(dt) {
  if (state !== 'playing') return;
  var m = monster, st, i;
  if (!m) { if (level >= 3) { respawnT -= dt; if (respawnT <= 0) spawnMonster(); } hideWarns(); }
  else {
    st = monStats(level); m.t += dt;
    if (m.mode === 'enter') { m.z = Math.min(MON_Z, m.z + 42 * dt); if (m.z >= MON_Z) { m.mode = 'patrol'; shockwave(m.x, m.z, 0xff4466, 10, .5); trauma = Math.min(1, trauma + .3 * fxScale); } }
    else if (m.mode === 'patrol') {
      m.switchT -= dt; m.shootT -= dt; m.chargeT -= dt; m.holdT -= dt;
      if (m.holdT <= 0 && m.switchT <= 0) { m.switchT = st.sw * (.8 + rndM() * .5); m.lane = (rndM() < st.aim) ? targetLane : Math.floor(rndM() * LANES); m.tx = laneX(m.lane); }
      if (!m.fireLanes && m.shootT < .35) {
        var ln = clamp(Math.round(m.x / LW + MID), 0, LANES - 1); m.fireLanes = (LC() >= 8) ? [ln - 1, ln, ln + 1] : [ln]; m.holdT = .35; m.tx = m.x;
        for (i = 0; i < m.fireLanes.length; i++) { var l = m.fireLanes[i], wmesh = warnMeshes[i]; if (l < 0 || l >= LANES) continue; wmesh.visible = true; wmesh.scale.set(LW * .9, .02, 28); wmesh.position.set(laneX(l), .05, m.z + 14); }
      }
      if (m.shootT <= 0) { m.shootT = st.shoot * (.85 + rndM() * .3); shootFire(st); }
      if (LC() >= 6 && m.chargeT <= 0 && !m.fireLanes) { m.mode = 'tele'; m.modeT = st.tele; m.lane = targetLane; m.tx = laneX(m.lane); }
    } else if (m.mode === 'tele') { m.modeT -= dt; if (m.modeT <= 0) { m.mode = 'charge'; sfx('whoosh', .7); } }
    else if (m.mode === 'charge') {
      var z0 = m.z; m.z += 52 * dt;
      if (invuln <= 0 && z0 < 1.7 && m.z > -1.7 && Math.abs(px - m.x) < 1.05) damage(px, 'charge');
      if (m.z > 5) m.mode = 'return';
    } else if (m.mode === 'return') {
      m.z -= 34 * dt;
      if (m.z <= MON_Z) { m.z = MON_Z; m.mode = 'patrol'; m.chargeT = st.chargeCd * (.8 + rndM() * .4); m.shootT = Math.max(m.shootT, .8); }
    }
    if (m.mode !== 'charge') { var dx = m.tx - m.x, step = st.vx * dt; if (Math.abs(dx) <= step) m.x = m.tx; else m.x += (dx > 0 ? step : -step); }
    m.g.position.set(m.x, Math.abs(Math.sin(m.t * 3)) * .12, m.z);
    var sw = Math.sin(m.t * 3.2); m.p.armL.sh.rotation.x = sw * .5; m.p.armR.sh.rotation.x = -sw * .5;
    var pre = (m.mode === 'patrol' && m.shootT < .4) || m.mode === 'tele', es = pre ? 1.9 : 1 + .15 * Math.sin(m.t * 8);
    m.p.eyes[0].scale.set(.16 * es, .1 * es, .1 * es); m.p.eyes[1].scale.set(.16 * es, .1 * es, .1 * es); m.p.eyeGlow.material.opacity = pre ? 1 : .6;
    m.p.armL.hand.material.opacity *= Math.exp(-dt * 6); m.p.armR.hand.material.opacity *= Math.exp(-dt * 6);
    m.p.ring.rotation.z += dt * 2;
    var bs = camera.userData.bossScale; if (m.flash > 0) { m.flash -= dt; m.g.scale.setScalar(bs * 1.06); } else m.g.scale.setScalar(bs);
    if (m.mode === 'tele' || m.mode === 'charge') {
      var len = 6 - m.z, wm = warnMeshes[3]; wm.visible = true; wm.scale.set(LW * .92, .02, len); wm.position.set(m.x, .05, m.z + len / 2);
    } else warnMeshes[3].visible = false;
    warnMat.opacity = .25 + .3 * Math.abs(Math.sin(clock * 16));
    if (state === 'playing' && Math.abs(px - m.x) < 1.3 && m.mode !== 'charge' && m.mode !== 'enter') fire(false);
  }
  if (state !== 'playing') return;
  for (i = bullets.length - 1; i >= 0; i--) {
    var b = bullets[i]; b.pz = b.z; b.z -= 95 * dt; b.o.position.z = b.z;
    var gone = false;
    if (monster && monster.mode !== 'enter') { var lo = Math.min(b.z, b.pz), hi = Math.max(b.z, b.pz); if (hi >= monster.z - 1.7 && lo <= monster.z + 1.7 && Math.abs(b.x - monster.x) < 1.5) { damageMonster(b); gone = true; } }
    if (gone || b.z < -120) { release(bulletPool, b.o); bullets.splice(i, 1); }
  }
  for (i = fireballs.length - 1; i >= 0; i--) {
    var f = fireballs[i]; if (f.delay > 0) { f.delay -= dt; continue; }
    var fz0 = f.z; f.z += f.v * dt; f.o.position.z = f.z; f.o.userData.ring.rotation.z += dt * 8;
    if (Math.random() < .5) burst(f.x, 1.3, f.z - .4, 0xff7a3d, 1, .6, .5, 0);
    if (f.z > 10) { release(firePool, f.o); fireballs.splice(i, 1); continue; }
    if (invuln <= 0 && fz0 < .9 && f.z > -.9 && Math.abs(px - f.x) < .7) { release(firePool, f.o); fireballs.splice(i, 1); damage(f.x, 'fire'); if (state !== 'playing') return; }
  }
  renderBoss();
}

/* ---------- movement, near-miss chain, damage, death, revive ---------- */
function move(dir) {
  if (state !== 'playing') return;
  var n = clamp(targetLane + dir, 0, LANES - 1);
  if (n === targetLane) return;
  for (var i = 0; i < items.length; i++) { var it = items[i]; if (it.kind === 'obs' && !it.hit && Math.abs(it.x - px) < .9 && it.z < -1 && -it.z < speed * .30) it.clutch = true; }
  var x0 = laneX(targetLane); targetLane = n; squash = 1;
  dashFx(x0, laneX(n)); sfx('whoosh', .22); buzz(8); if (P.tut < 2) { P.tut = 2; saveP(); $('tut').hidden = true; }
}
function clutch() {
  chain++; chainT = 3; mult = chain >= 11 ? 5 : chain >= 7 ? 4 : chain >= 4 ? 3 : chain >= 2 ? 2 : 1; bestChain = Math.max(bestChain, chain);
  var pts = 25 * mult; bonus += pts; exposureKick = Math.max(exposureKick, .2);
  popText('+' + pts + (mult > 1 ? ' ×' + mult : '') + ' بالمللي', mult >= 3 ? 'gold' : ''); beep(500 + 40 * Math.min(chain, 12), .08, 'triangle', .08);
  burst(px, 1.2, 0, 0x9fe9ff, 8, 3, 3, 8);
}
function damage(x, why) {
  lives--; invuln = Math.max(1.0, Math.min(1.6, 30 / Math.max(speed, 1))); cause = why || cause;
  trauma = Math.min(1, trauma + .5 * fxScale); hitStop = RM ? .04 : .07; fovPunch = -6 * fxScale; hurtDip = .25; chain = 0; chainT = 0; mult = 1;
  hurtFx(); burst(x, 1, 0, 0xffc857, 40, 6, 6); burst(x, 1.2, 0, 0xff4466, 26, 5, 5); shockwave(x, 0, 0xff4466, 6, .4);
  sfx('hit', 1); buzz([60, 40, 90]); renderHUD();
  if (lives <= 0) { lives = 0; renderHUD(); die(); }
}
function die() {
  setState('dying'); dyingTimer = 1.25; if (!RM) { tsTarget = .25; slowT = .7; } grabNext = 7;
  sfx('gameover', 1); buzz(180); explodeRunner();
  var sc = score(); saveRun(sc);
}
function explodeRunner() {
  var limbs = [player.head, player.legL.t, player.legR.t, player.armL.t, player.armR.t];
  root.updateMatrixWorld(true); restoreList.length = 0; debris.length = 0;
  limbs.forEach(function (o) {
    restoreList.push({ o: o, p: o.parent, pos: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
    scene.attach(o);
    debris.push({ o: o, vx: (Math.random() - .5) * 10, vy: 4 + Math.random() * 6, vz: (Math.random() - .5) * 6 - 2, rx: (Math.random() - .5) * 14, rz: (Math.random() - .5) * 14 });
  });
  player.bubble.visible = false;
}
function restoreRunner() {
  for (var i = 0; i < restoreList.length; i++) { var r = restoreList[i]; r.p.add(r.o); r.o.position.copy(r.pos); r.o.quaternion.copy(r.q); r.o.scale.copy(r.s); }
  restoreList.length = 0; debris.length = 0; root.rotation.set(0, 0, 0); root.position.y = 0; body.rotation.set(0, 0, 0);
}
function updateDebris(dt) {
  for (var i = 0; i < debris.length; i++) {
    var d = debris[i]; d.vy -= 18 * dt; d.o.position.x += d.vx * dt; d.o.position.z += d.vz * dt; d.o.position.y += d.vy * dt;
    if (d.o.position.y < .15) { d.o.position.y = .15; d.vy = -d.vy * .35; d.vx *= .7; d.vz *= .7; d.rx *= .5; d.rz *= .5; }
    d.o.rotation.x += d.rx * dt; d.o.rotation.z += d.rz * dt;
  }
}
function hit(it) { it.hit = true; removeItem(it); damage(it.x, OBS_NAMES[it.type]); }
function pickHeart(it) {
  burst(it.x, 1.3, 0, 0xff5c8a, 36, 4, 5, 6); burst(it.x, 1.3, 0, 0xffd36a, 16, 3, 5, 6); removeItem(it); hearts++; exposureKick = Math.max(exposureKick, .35);
  if (lives < MAX_LIVES) { lives++; renderHUD(); popHeart(lives - 1); sfx('heart', .9); buzz(15); popText('قلب +1', ''); }
  else { bonus += 100; sfx('heart', .7); popText('+100 مكافأة', 'gold'); }
}
function reviveNow() {
  revived = true; lives = 2; invuln = 2.5; cause = ''; restoreRunner();
  for (var i = items.length - 1; i >= 0; i--) if (items[i].z > -60) removeItem(items[i]);
  clearCombat(); tsTarget = 1; timeScale = 1; setState('playing'); sfx('levelup', .6); renderHUD(); toast('كمّل يا بطل', 1400);
}

/* ---------- run flow ---------- */
var runEntry = null;
function saveRun(sc) {
  if (mode === 'daily') { var d = todayKey(); if (P.bestDaily.d !== d || sc > P.bestDaily.s) P.bestDaily = { d: d, s: Math.max(sc, P.bestDaily.d === d ? P.bestDaily.s : 0) }; }
  else if (sc > P.best) P.best = sc;
  /* a revived run replaces its own earlier entry instead of appearing twice */
  if (runEntry) { var ri = P.scores.indexOf(runEntry); if (ri >= 0) P.scores.splice(ri, 1); }
  runEntry = { s: sc, l: level, d: todayKey(), m: mode };
  P.scores.push(runEntry); P.scores.sort(function (a, b) { return b.s - a.s; }); P.scores.length = Math.min(P.scores.length, 8);
  P.maxLevel = Math.max(P.maxLevel, level); saveP();
}
function startGame(opts) {
  if (state === 'playing') return;
  opts = opts || {}; mode = opts.daily ? 'daily' : 'normal';
  if (mode === 'daily') { var d = todayKey(); runSeed = hashStr('mi-gams-' + d); if (P.lastDaily !== d) { P.streak = (P.lastDaily && daysBetween(P.lastDaily, d) === 1) ? P.streak + 1 : 1; P.lastDaily = d; } }
  else runSeed = null;
  seedRun(runSeed);
  prevBest = (mode === 'daily') ? (P.bestDaily.d === todayKey() ? P.bestDaily.s : 0) : P.best;
  restoreRunner(); clearAll(); clearCombat();
  level = opts.startLevel || 1; endless = false; dist = baseDist = levelStart(level); bonus = 0; lives = 3; targetLane = 4; aimLane = 4; px = laneX(4);
  invuln = 1.2; trauma = 0; nextHeartK = Math.floor(dist / HEART_EVERY) + 1; levelTimer = 0; revived = false; cause = ''; beaten = false; chalBeaten = false;
  chain = 0; chainT = 0; mult = 1; bestChain = 0; kills = 0; hearts = 0; rescueCd = 0; timeScale = 1; tsTarget = 1; hitStop = 0; slowT = 0; shotURL = null; fxQueue.length = 0; runEntry = null;
  speedCur = speedFor(level) * .35; speed = speedCur; setPalette(level); applySkin(P.skin);
  prepopulate(-48); P.runs++; saveP(); renderHUD();
  if (P.tut < 2) $('tut').hidden = false;
  setState('playing'); music(true); sfx('levelup', .4); lockScreen();
}
function daysBetween(a, b) { var pa = a.split('-'), pb = b.split('-'); return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 864e5); }
function togglePause() {
  if (state === 'playing') setState('paused');
  else if (state === 'paused') { setState('playing'); invuln = Math.max(invuln, 1.5); }
}
function endLevel() {
  var L = LC(), pts = 100 * L; bonus += pts; sfx('levelup', .9); buzz([30, 40, 30]); exposureKick = .6;
  for (var i = 0; i < 6; i++) fxQueue.push({ t: .15 * i, x: (Math.random() - .5) * 12, y: 6 + Math.random() * 6, z: -25 - Math.random() * 25, c: [0xffc857, 0xffffff, palTo.accent][i % 3] });
  P.totalDist += levelEnd(level) - levelStart(level); P.maxLevel = Math.max(P.maxLevel, level + 1); saveP();
  if (level >= MAX_LEVEL && !endless) { clearObstacles(); clearCombat(); var sc = score(); P.won = true; saveRun(sc); showWin(sc); setState('win'); return; }
  var nl = level + 1, hint = { 3: 'من هنا الوحش هيظهر ومعاك زر النار', 6: 'الوحش بقى بيندفع ناحيتك، خلي بالك من الخط الأحمر', 8: 'الوحش بيضرب تلات كرات نار مرة واحدة' }[nl];
  if (hint) { clearObstacles(); clearCombat(); levelTimer = 2.2; showLevel(level, nl, pts, hint); setState('level'); }
  else { nextLevel(); toast('المستوى ' + nl + ' | +' + pts, 1300); }
  renderHUD();
}
function nextLevel() {
  level++; setPalette(level); invuln = Math.max(invuln, 1.2); respawnT = 2.2;
  if (state === 'level') { prepopulate(-50); setState('playing'); }
  renderHUD();
}
function continueEndless() { endless = true; level = MAX_LEVEL + 1; invuln = 1.5; respawnT = 3; setPalette(level); prepopulate(-50); setState('playing'); toast('بلا نهاية: السرعة بتزيد كل 500 متر', 2200); renderHUD(); }
function gameOver() {
  var sc = score();
  restoreRunner(); unlockScreen(); music(false);
  showGameOver({ score: sc, isNew: sc > prevBest && sc > 0, prev: prevBest, level: level, cause: cause, kills: kills, hearts: hearts, chain: bestChain, mode: mode });
  setState('over');
}
