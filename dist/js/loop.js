/* loop.js: per-frame update, camera rig, frame timing (hit-stop, slow motion, quality governor), input. Depends on core, builders, game. */
'use strict';

/* ---------- held-direction input read once per frame (no orphan intervals) ---------- */
var hold = { dir: 0, t: 0, fire: false, fireT: 0 };
function releaseAllHolds() { hold.dir = 0; hold.fire = false; ['bLeft', 'bRight', 'bFire'].forEach(function (id) { $(id).classList.remove('down'); }); }

var camPos = new T.Vector3(0, 5.2, 9.4), camLook = new T.Vector3(0, 1.2, -12), _tp = new T.Vector3(), _tl = new T.Vector3();
function update(dt, raw) {
  clock += raw;
  var i, it, dz = 0, lean = clamp((laneX(targetLane) - px) * .1, -.35, .35);
  tickPalette(raw);
  planet.rotation.y += raw * .02; planetRing.rotation.z += raw * .04; stars.material.opacity = .75 + .2 * Math.sin(clock * .9);
  if (state === 'menu' || state === 'level' || state === 'over' || state === 'win') {
    if (state === 'menu' || state === 'level') { stepWorld(8 * dt); animRunner(dt, 8, 0, clock); px += (laneX(targetLane) - px) * Math.min(1, dt * 10); }
    if (state === 'level') { levelTimer -= dt; var c = Math.max(1, Math.ceil(levelTimer)); if (String(c) !== $('lvCount').textContent) $('lvCount').textContent = c; if (levelTimer <= 0) nextLevel(); }
    visSpeed += (8 - visSpeed) * Math.min(1, raw * 3);
  } else if (state === 'playing') {
    gameClock += dt;
    speedCur += (speedFor(level) - speedCur) * (1 - Math.exp(-dt * 2.5)); speed = speedCur;
    visSpeed += (speed - visSpeed) * (1 - Math.exp(-dt * 3));
    dz = speed * dt; dist += dz; stepWorld(dz);
    /* held direction repeats every 150 ms */
    if (hold.dir) { hold.t -= dt; if (hold.t <= 0) { move(hold.dir); hold.t = .15; } }
    if (hold.fire) fire(true);
    px += (laneX(targetLane) - px) * Math.min(1, dt * 15);
    if (invuln > 0) invuln -= dt;
    if (chainT > 0) { chainT -= dt; if (chainT <= 0) { chain = 0; mult = 1; } }
    lastRowZ += dz;
    var sz = spawnZ();
    if (lastRowZ - sz >= curGap()) { spawnRow(sz); lastRowZ = sz; }
    while ((endless || nextHeartK * HEART_EVERY <= FINISH) && dist - sz >= nextHeartK * HEART_EVERY) { spawnHeart(nextHeartK * HEART_EVERY); nextHeartK++; }
    rescueCd -= dt;
    if (lives <= 2 && rescueCd <= 0) { var hd = nextHeartDist(); if (hd < 0 || hd > 150) { spawnHeart(dist + 150); rescueCd = 12; } }
    for (i = items.length - 1; i >= 0; i--) {
      it = items[i]; var z0 = it.z; it.z += dz; it.obj.position.z = it.z;
      var tk = it.obj.userData.tick; if (tk) tk(gameClock, dt);
      if (it.slide) { it.slide.t += dt; it.x = clamp(it.slide.cx + Math.sin(it.slide.t * it.slide.spd + it.slide.ph) * it.slide.amp, laneX(0), laneX(LANES - 1)); it.obj.position.x = it.x; }
      if (it.z > 10) { removeItem(it); continue; }
      if (it.kind === 'obs') {
        if (invuln <= 0 && z0 < .95 && it.z > -.95 && Math.abs(px - it.x) < .72) { hit(it); if (state !== 'playing') break; continue; }
        if (it.clutch && !it.hit && it.z >= .95 && z0 < .95) { it.clutch = false; clutch(); }
      } else if (z0 < 1.1 && it.z > -1.1 && Math.abs(px - it.x) < .95) pickHeart(it);
    }
    if (state === 'playing') {
      updateCombat(dt);
      animRunner(dt, speed, lean, clock);
      player.bubble.visible = invuln > 0;
      if (invuln > 0) { var bf = Math.min(1, invuln / .3); player.bubble.material.opacity = (.1 + .1 * Math.abs(Math.sin(clock * 31))) * bf; player.bubble.scale.setScalar(.8 + .5 * bf); player.bubbleRing.rotation.z += dt * 3; }
      var sc = score();
      if (!beaten && prevBest > 0 && sc > prevBest) { beaten = true; toast('كسرت رقمك', 1500); sfx('levelup', .5); popText('رقم جديد', 'gold'); }
      if (!chalBeaten && chal > 0 && sc > chal) { chalBeaten = true; toast('عدّيت صاحبك، كمّل', 1800); popText('عدّيته', 'gold'); }
      if (dist >= levelEnd(level)) { dist = levelEnd(level); endLevel(); }
    }
  } else if (state === 'dying') {
    dyingTimer -= raw; dz = speed * dt * .3; stepWorld(dz);
    for (i = 0; i < items.length; i++) { items[i].z += dz; items[i].obj.position.z = items[i].z; }
    updateDebris(dt); body.rotation.x = Math.min(1.3, body.rotation.x + dt * 3); root.position.y = Math.max(-.3, root.position.y - dt * .5);
    if (dyingTimer <= 0) { tsTarget = 1; if (!revived) { reviveT = 4; openRevive(); setState('revive'); } else gameOver(); }
  } else if (state === 'revive') {
    reviveT -= raw; updateReviveRing(reviveT); if (reviveT <= 0) gameOver();
  }
  /* fireworks queue */
  for (i = fxQueue.length - 1; i >= 0; i--) { fxQueue[i].t -= raw; if (fxQueue[i].t <= 0) { var f = fxQueue[i]; burst(f.x, f.y, f.z, f.c, 50, 6, 3, 5); burst(f.x, f.y, f.z, 0xffffff, 12, 3, 2, 4); fxQueue.splice(i, 1); } }
  /* player placement and lights */
  root.position.x = px; if (state !== 'dying' && state !== 'revive') root.position.y = 0;
  player.shadow.visible = state !== 'dying' && state !== 'revive';
  glow.position.set(px, 2.2, 1.4);
  sun.position.set(px + 7, 22, 8); sun.target.position.set(px, 0, -12); sun.target.updateMatrixWorld();
  updateParts(raw, dz); updateFx(raw, dz);
  /* camera */
  trauma = Math.max(0, trauma - raw * 1.4);
  var s2 = trauma * trauma, nx = (Math.sin(clock * 37.1) + Math.sin(clock * 23.7 + 1.3)) * .5, ny = (Math.sin(clock * 41.3 + .7) + Math.sin(clock * 19.1)) * .5;
  var u = camera.userData, k = clamp((visSpeed - 15) / 24.3, 0, 1);
  if (state === 'menu') { _tp.set(px + Math.sin(clock * .3) * (RM ? 0 : 1.6), 2.8, 10.5); _tl.set(px, -3.2, -8); camera.fov += (42 - camera.fov) * Math.min(1, raw * 3); }
  else { _tp.set(px * .72, u.y, u.z); _tl.set(px * .88, 1.2, -12); camera.fov += (u.fov + k * 9 * fxScale + fovPunch - camera.fov) * Math.min(1, raw * 8); }
  fovPunch *= Math.exp(-raw * 6);
  var sm = 1 - Math.exp(-raw * (state === 'menu' ? 2 : 6));
  camPos.lerp(_tp, sm); camLook.lerp(_tl, sm);
  camera.position.set(camPos.x + nx * s2 * .45, camPos.y + ny * s2 * .35, camPos.z); camera.lookAt(camLook); camera.rotation.z += Math.sin(clock * 29) * s2 * .05 - lean * .08;
  camera.updateProjectionMatrix();
  speedLines.material.opacity = (state === 'playing' ? k * .55 : 0) * fxScale;
  exposureKick *= Math.exp(-raw * 6); hurtDip = Math.max(0, hurtDip - raw * 1.6);
  renderer.toneMappingExposure = 1.15 + exposureKick - hurtDip;
}

/* ---------- frame loop ---------- */
var last = 0, hudT = 0, slowFrames = 0, startedAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!last) { last = now; return; }
  var rawMs = now - last; last = now; if (rawMs > 100) rawMs = 16; var raw = clamp(rawMs / 1000, 0, .05), dt;
  if (hitStop > 0) { hitStop -= raw; dt = 0; } else { timeScale += (tsTarget - timeScale) * Math.min(1, raw * 10); dt = raw * timeScale; }
  if (slowT > 0 && (slowT -= raw) <= 0) tsTarget = 1;
  if (state === 'paused') { dt = 0; }
  update(dt, state === 'paused' ? 0 : raw);
  hudT += raw; if (hudT >= .1 || dirty) { hudT = 0; renderHUD(); }
  /* static states: render at reduced rate to save battery */
  var idle = (state === 'over' || state === 'win' || state === 'paused');
  if (idle && !dirty) { slowFrames++; if (slowFrames % 3) return; } else slowFrames = 0;
  if (dirty > 0) dirty--;
  renderer.render(scene, camera);
  if (grabNext > 0) { grabNext--; if (grabNext === 0) { try { shotURL = canvas.toDataURL('image/jpeg', .86); } catch (e) { shotURL = null; } } }
  /* quality governor: drop a tier when frames stay slow while playing */
  if (state === 'playing') {
    Q.ema += (rawMs - Q.ema) * .06;
    if (Q.cool > 0) Q.cool--;
    else if (Q.ema > 21) { if (++Q.over > 45 && Q.tier < 3) { Q.tier++; applyTier(); Q.over = 0; Q.cool = 240; } } else Q.over = 0;
  }
}

/* ---------- input ---------- */
function bindHold(el, dir) {
  var pid = null;
  function down(e) {
    e.preventDefault(); if (pid !== null) return; pid = e.pointerId; try { el.setPointerCapture(e.pointerId); } catch (x) { }
    el.classList.add('down'); unlockAudio();
    if (dir) { move(dir); hold.dir = dir; hold.t = .15; } else { fire(true); hold.fire = true; }
  }
  function up(e) { if (e && e.pointerId !== pid) return; pid = null; el.classList.remove('down'); if (dir) { if (hold.dir === dir) hold.dir = 0; } else hold.fire = false; }
  el.addEventListener('pointerdown', down);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { el.addEventListener(n, up); });
  el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}
bindHold($('bLeft'), -1); bindHold($('bRight'), 1); bindHold($('bFire'), 0);
var sw = null;
canvas.addEventListener('pointerdown', function (e) { if (sw) return; sw = { id: e.pointerId, x: e.clientX, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch (x) { } unlockAudio(); });
canvas.addEventListener('pointermove', function (e) {
  if (!sw || e.pointerId !== sw.id) return; var dx = e.clientX - sw.x;
  if (Math.abs(dx) > 28) { move(dx > 0 ? 1 : -1); sw.x = e.clientX; sw.moved = true; }
});
canvas.addEventListener('pointerup', function (e) {
  if (!sw || e.pointerId !== sw.id) return;
  if (!sw.moved && Math.abs(e.clientX - sw.x0) < 10 && performance.now() - sw.t < 260 && sw.y0 > 110) {
    if (state === 'paused') togglePause();
    else { var r = canvas.getBoundingClientRect(); move(e.clientX < r.left + r.width / 2 ? -1 : 1); }
  }
  sw = null;
});
['pointercancel', 'lostpointercapture'].forEach(function (n) { canvas.addEventListener(n, function (e) { if (sw && e.pointerId === sw.id) sw = null; }); });
document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
window.addEventListener('keydown', function (e) {
  var c = e.code; unlockAudio();
  if (c === 'ArrowLeft' || c === 'KeyA') { if (!e.repeat) { move(-1); hold.dir = -1; hold.t = .22; } e.preventDefault(); }
  else if (c === 'ArrowRight' || c === 'KeyD') { if (!e.repeat) { move(1); hold.dir = 1; hold.t = .22; } e.preventDefault(); }
  else if (c === 'Space' || c === 'KeyF' || c === 'KeyJ') { if (state === 'playing') { fire(true); hold.fire = true; e.preventDefault(); } }
  else if (c === 'KeyP' || c === 'Escape') { if (state === 'playing' || state === 'paused') { togglePause(); e.preventDefault(); } }
  else if (c === 'Enter' && e.target === document.body) {
    if (state === 'menu' || state === 'over' || state === 'win') startGame(); else if (state === 'level') nextLevel(); else if (state === 'revive') reviveNow();
  }
});
window.addEventListener('keyup', function (e) {
  var c = e.code;
  if ((c === 'ArrowLeft' || c === 'KeyA') && hold.dir === -1) hold.dir = 0;
  if ((c === 'ArrowRight' || c === 'KeyD') && hold.dir === 1) hold.dir = 0;
  if (c === 'Space' || c === 'KeyF' || c === 'KeyJ') hold.fire = false;
});
function autoPause() { if (state === 'playing') setState('paused'); releaseAllHolds(); if (state !== 'menu') { saveP(); } }
document.addEventListener('visibilitychange', function () { if (document.hidden) autoPause(); else { unlockAudio(); if (state === 'playing' || state === 'paused') lockScreen(); } });
window.addEventListener('blur', autoPause);
window.addEventListener('pagehide', autoPause);
canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); autoPause(); }, false);
canvas.addEventListener('webglcontextrestored', function () { buildEnv(); floorTex.needsUpdate = true; floorEm.needsUpdate = true; skyTex.needsUpdate = true; dirty = 2; }, false);

/* ---------- wake lock ---------- */
var wl = null;
function lockScreen() { try { if (!navigator.wakeLock || wl) return; navigator.wakeLock.request('screen').then(function (s) { wl = s; s.addEventListener('release', function () { wl = null; }); }).catch(function () { }); } catch (e) { } }
function unlockScreen() { try { if (wl) { wl.release().catch(function () { }); wl = null; } } catch (e) { } }
