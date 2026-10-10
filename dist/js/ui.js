/* ui.js: audio, HUD, panels and state machine, share card, daily challenge, skins, leaderboard, PWA, boot. Loaded last. */
'use strict';

/* ---------- audio: real clips through one AudioContext, unlocked on the first gesture ---------- */
var AUDIO_SRC = window.AUDIO_SRC || { music: 'audio/music.mp3', hit: 'audio/hit.mp3', heart: 'audio/heart.mp3', shoot: 'audio/shoot.mp3', explode: 'audio/explode.mp3', levelup: 'audio/levelup.mp3', gameover: 'audio/gameover.mp3', roar: 'audio/roar.mp3', whoosh: 'audio/whoosh.mp3' };
var ac = null, acFailed = false, masterGain = null, musicGain = null, sfxBuf = {}, musicSrc = null, musicOn = false, lastSfx = {};
function toBuffer(src) {
  if (src.slice(0, 5) === 'data:') { var b64 = src.slice(src.indexOf(',') + 1), bin = atob(b64), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return Promise.resolve(arr.buffer); }
  return fetch(src).then(function (r) { return r.arrayBuffer(); });
}
function initAudio() {
  if (ac || acFailed) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ac.createGain(); masterGain.gain.value = P.mute ? 0 : 1; masterGain.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = .5; musicGain.connect(masterGain);
    Object.keys(AUDIO_SRC).forEach(function (k) {
      toBuffer(AUDIO_SRC[k]).then(function (b) { return new Promise(function (res, rej) { ac.decodeAudioData(b, res, rej); }); })
        .then(function (buf) { sfxBuf[k] = buf; if (k === 'music' && musicOn) startMusic(); }).catch(function () { });
    });
  } catch (e) { acFailed = true; }
}
function unlockAudio() { initAudio(); if (ac && ac.state !== 'running') { var p = ac.resume(); if (p && p.catch) p.catch(function () { }); } }
function sfx(name, vol) {
  if (P.mute || !ac || !sfxBuf[name]) return;
  var t = ac.currentTime; if (lastSfx[name] && t - lastSfx[name] < .04) return; lastSfx[name] = t;
  try { var s = ac.createBufferSource(), g = ac.createGain(); s.buffer = sfxBuf[name]; g.gain.value = vol == null ? 1 : vol; s.connect(g); g.connect(masterGain); s.start(t); } catch (e) { }
}
function beep(f, d, type, vol, f2) {
  if (P.mute || !ac) return;
  try { var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(vol || .12, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + d); } catch (e) { }
}
function startMusic() {
  if (!ac || !sfxBuf.music || musicSrc) return;
  try { musicSrc = ac.createBufferSource(); musicSrc.buffer = sfxBuf.music; musicSrc.loop = true; musicSrc.loopStart = 0; musicSrc.loopEnd = sfxBuf.music.duration; musicSrc.connect(musicGain); musicSrc.start(); } catch (e) { musicSrc = null; }
}
function music(on) { musicOn = on; if (on) startMusic(); else if (musicSrc) { try { musicSrc.stop(); } catch (e) { } musicSrc = null; } }
function duck(level) { if (musicGain && ac) { musicGain.gain.cancelScheduledValues(ac.currentTime); musicGain.gain.linearRampToValueAtTime(level, ac.currentTime + .4); } }
function setMute(m) { P.mute = m; saveP(); if (masterGain) masterGain.gain.value = m ? 0 : 1; var ic = m ? ICON_MUTE : ICON_SOUND; $('bSound').innerHTML = ic; $('bSound2').innerHTML = ic + '<span>' + (m ? 'شغّل الصوت' : 'اقفل الصوت') + '</span>'; }
var tapped = false; /* browsers refuse vibration before the first tap; skip it quietly until then */
window.addEventListener('pointerdown', function () { tapped = true; }, { capture: true, passive: true });
function buzz(p) { if (P.mute || !tapped || !navigator.vibrate) return; try { navigator.vibrate(p); } catch (e) { } }

/* ---------- HUD ---------- */
var ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4.5" height="16" rx="1.2"/><rect x="14.5" y="4" width="4.5" height="16" rx="1.2"/></svg>';
var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';
var ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
var ICON_MUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6"/></svg>';
var livesEl = $('lives'), heartSvgs = [], scoreNode = document.createTextNode('0'), hc = {};
(function () {
  for (var i = 0; i < MAX_LIVES; i++) {
    var d = document.createElement('div'); d.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="url(#hg)" stroke="#ffd0da" stroke-width=".6" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    var s = d.firstChild; livesEl.appendChild(s); heartSvgs.push(s);
  }
  $('score').textContent = ''; $('score').appendChild(scoreNode);
})();
function renderHUD() {
  if (hc.lives !== lives) { for (var i = 0; i < MAX_LIVES; i++) heartSvgs[i].classList.toggle('off', i >= lives); hc.lives = lives; livesEl.setAttribute('aria-label', 'الأرواح ' + lives + ' من ' + MAX_LIVES); }
  var sc = score();
  if (hc.score !== sc) { scoreNode.nodeValue = fmt(sc); hc.score = sc; }
  if (hc.bonus !== bonus) { if (hc.bonus != null) { var se = $('score'); se.classList.remove('bump'); void se.offsetWidth; se.classList.add('bump'); } hc.bonus = bonus; }
  var lv = endless ? '∞' : (level + '/' + MAX_LEVEL); if (hc.lvl !== lv) { $('lvl').textContent = lv; hc.lvl = lv; }
  var pr = clamp((dist - levelStart(level)) / (levelEnd(level) - levelStart(level)), 0, 1), pc = Math.round(pr * 100);
  if (hc.bar !== pc) { $('bar').style.width = pc + '%'; hc.bar = pc; }
  var nh = nextHeartDist(); if (hc.heart !== nh) { $('heartTxt').textContent = nh < 0 ? '' : 'القلب الجاي بعد ' + nh + ' م'; hc.heart = nh; }
  var tgt = Math.max(chal, prevBest), tt = tgt > 0 && sc < tgt ? 'الهدف ' + fmt(tgt) : (tgt > 0 ? 'فوق الهدف' : '');
  if (hc.tgt !== tt) { $('bestHud').textContent = tt; hc.tgt = tt; }
  var cb = $('combo'); if (chain >= 2) { cb.classList.add('on'); $('comboN').textContent = '×' + mult + '  ' + chain; $('comboBar').style.transform = 'scaleX(' + clamp(chainT / 3, 0, 1) + ')'; } else cb.classList.remove('on');
}
function popHeart(i) { var s = heartSvgs[i]; s.classList.remove('pop'); void s.getBoundingClientRect(); s.classList.add('pop'); }
function hurtFx() { flashFx(''); livesEl.classList.remove('hurt'); void livesEl.offsetWidth; livesEl.classList.add('hurt'); }
function flashFx(kind) { var f = $('flash'); f.className = ''; void f.offsetWidth; f.className = 'go ' + (kind || ''); }
var toastTO = null;
function toast(msg, ms) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTO); toastTO = setTimeout(function () { t.hidden = true; }, ms || 2600); }
function popText(txt, cls) {
  var p = document.createElement('div'); p.className = 'pop ' + (cls || ''); p.textContent = txt; p.style.left = (44 + Math.random() * 12) + '%'; $('pops').appendChild(p);
  setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 950);
}

/* ---------- panels and state machine ---------- */
var PAN = { menu: 'pMenu', level: 'pLevel', over: 'pOver', win: 'pWin', revive: 'pRevive' };
function setState(s) {
  state = s; dirty = 2;
  Object.keys(PAN).forEach(function (k) { $(PAN[k]).hidden = (k !== s); });
  $('hud').hidden = (s === 'menu' || s === 'over' || s === 'win'); $('pad').hidden = !(s === 'playing' || s === 'paused' || s === 'dying');
  $('pauseTag').hidden = (s !== 'paused');
  var paused = (s === 'paused'), can = (s === 'playing' || s === 'paused');
  $('bPause').innerHTML = paused ? ICON_PLAY : ICON_PAUSE; $('bPause').disabled = !can; $('bPause').setAttribute('aria-label', paused ? 'كمّل' : 'وقّف');
  $('bFire').hidden = !(level >= 3 && s !== 'menu');
  if (s !== 'playing') releaseAllHolds();
  if (s === 'playing') duck(.5); else if (s === 'level') duck(.35); else duck(.18);
  if (!(s === 'playing' || s === 'paused')) $('tut').hidden = true;
  if (s === 'menu') { clearAll(); clearCombat(); unlockScreen(); renderMenu(); music(false); }
  if (s === 'win') unlockScreen();
  var cta = { menu: 'startBtn', level: 'nextBtn', over: 'againBtn', win: 'endlessBtn', revive: 'reviveBtn' }[s];
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (cta && !coarse) setTimeout(function () { try { $(cta).focus({ preventScroll: true }); } catch (e) { } }, 50);
}
function showLevel(done, next, pts, hint) { $('lvDone').textContent = done; $('lvNext').textContent = next; $('lvCount').textContent = 3; $('lvBonus').textContent = plus(pts) + ' مكافأة'; $('lvHint').textContent = hint || ''; }
var QUIPS = { spikes: 'الشوك مبيرحمش', crate: 'الصندوق كان أقرب مما تتخيل', saw: 'المنشار مبيهزرش', pylon: 'العمود واقف في وشك', gimbal: 'الكرة لفت عليك', fire: 'كرة النار جت في وشك', charge: 'الوحش داس عليك' };
function showGameOver(r) {
  $('finalScore').textContent = fmt(r.score); $('rankTxt').textContent = 'لقبك: ' + rankFor(r.level);
  var s = $('sorryTxt'), nb = $('newBest'); nb.hidden = !r.isNew;
  if (r.isNew) { s.textContent = 'رقم جديد ليك'; s.style.color = 'var(--gold)'; for (var i = 0; i < 5; i++) fxQueue.push({ t: .2 * i, x: (Math.random() - .5) * 10, y: 5 + Math.random() * 5, z: -14 - Math.random() * 20, c: [0xffc857, 0xffffff, 0x3be3ff][i % 3] }); }
  else { var gap = r.prev - r.score; s.style.color = ''; s.textContent = (r.prev > 0 && gap > 0 && gap <= r.prev * .25) ? 'قربت أوي، فاضل ' + fmt(gap) + ' نقطة وتكسر رقمك' : (QUIPS[r.cause] || 'معلش، المرة الجاية أحسن'); }
  $('overStats').innerHTML = '<div><small>المستوى</small><b>' + (endless ? '∞' : r.level) + '</b></div><div><small>الوحوش</small><b>' + r.kills + '</b></div><div><small>أطول سلسلة</small><b>' + r.chain + '</b></div>';
  $('bestOver').textContent = (r.mode === 'daily' ? 'أحسن نتيجة النهارده: ' : 'أحسن نتيجة ليك: ') + fmt(r.mode === 'daily' ? P.bestDaily.s : P.best) + (storageOk ? '' : ' (مش هتتحفظ على الصفحة دي)');
  $('modeOver').textContent = r.mode === 'daily' ? 'سباق اليوم ' + todayKey() : '';
}
function showWin(sc) { $('winScore').textContent = fmt(sc); $('rankWin').textContent = 'لقبك: ' + rankFor(MAX_LEVEL); $('bestWin').textContent = 'أحسن نتيجة ليك: ' + fmt(P.best); for (var i = 0; i < 10; i++) fxQueue.push({ t: .25 * i, x: (Math.random() - .5) * 14, y: 6 + Math.random() * 7, z: -18 - Math.random() * 30, c: [0xffc857, 0xffffff, 0xff4fd8, 0x3be3ff][i % 4] }); }
function openRevive() { updateReviveRing(4); }
function updateReviveRing(t) { var f = clamp(t / 4, 0, 1); $('ringFg').style.strokeDashoffset = String(245 * (1 - f)); $('reviveNum').textContent = Math.max(1, Math.ceil(t)); }

/* ---------- menu: modes, checkpoints, skins, leaderboard, streak, challenge ---------- */
var SKIN_AT = [0, 1500, 4000, 9000, 18000], menuMode = 'normal', startAt = 1;
function skinUnlocked(i) { return P.totalDist >= SKIN_AT[i]; }
function renderMenu() {
  $('bestMenu').textContent = P.best > 0 ? 'أحسن نتيجة ليك: ' + fmt(P.best) : 'أول مرة؟ اسحب يمين وشمال واتفادى الحواجز';
  $('chalTxt').hidden = !(chal > 0); if (chal > 0) $('chalTxt').textContent = 'صاحبك جاب ' + fmt(chal) + ' نقطة. تقدر تعدّيه؟';
  $('bCampaign').classList.toggle('on', menuMode === 'normal'); $('bDaily').classList.toggle('on', menuMode === 'daily');
  var d = todayKey(), dailyBest = P.bestDaily.d === d ? P.bestDaily.s : 0;
  var streakLive = P.streak > 1 && P.lastDaily && daysBetween(P.lastDaily, d) <= 1;
  $('streakTxt').textContent = menuMode === 'daily' ? ('كل الناس بتجري على نفس الطريق النهارده' + (dailyBest ? ' | أحسن نتيجة: ' + fmt(dailyBest) : '') + (streakLive ? ' | ' + P.streak + ' أيام ورا بعض' : '')) : '';
  $('cpRow').hidden = !(menuMode === 'normal' && P.maxLevel >= 5);
  $('cp4').classList.toggle('on', startAt === 4); $('cp7').classList.toggle('on', startAt === 7); $('cp1').classList.toggle('on', startAt === 1); $('cp7').hidden = P.maxLevel < 8;
  var sk = $('skins'); sk.innerHTML = '';
  SKINS.forEach(function (s, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'skin' + (P.skin === i ? ' on' : '') + (skinUnlocked(i) ? '' : ' lock'); b.style.background = s.css;
    b.setAttribute('aria-label', s.name); b.setAttribute('data-cost', fmt(SKIN_AT[i]) + ' م');
    b.addEventListener('click', function () { if (!skinUnlocked(i)) { toast('اجري ' + fmt(SKIN_AT[i] - P.totalDist) + ' متر كمان وتفتح ' + s.name, 2200); return; } P.skin = i; saveP(); applySkin(i); renderMenu(); sfx('heart', .5); });
    sk.appendChild(b);
  });
  $('skinName').textContent = SKINS[P.skin].name + ' | جريت ' + fmt(P.totalDist) + ' متر';
  var lb = $('lb'); lb.innerHTML = '';
  if (!P.scores.length) lb.innerHTML = '<li>لسه مفيش نتائج. يلا نلعب</li>';
  P.scores.slice(0, 5).forEach(function (r, i) { var li = document.createElement('li'); if (i === 0) li.className = 'me'; li.innerHTML = '<span>' + (i + 1) + '. المستوى ' + r.l + (r.m === 'daily' ? ' (اليوم)' : '') + '</span><b>' + fmt(r.s) + '</b>'; lb.appendChild(li); });
}

/* ---------- share: text + card image through the system share sheet, WhatsApp fallback ---------- */
function shareUrl() { var u = location.href.split('#')[0]; return (u.indexOf('http') === 0 ? u : (window.SHARE_URL || u)); }
function shareText(sc) { return 'جبت ' + fmt(sc) + ' نقطة ووصلت المستوى ' + (endless ? 'بلا نهاية' : level) + ' في MOHAMED ISMAIL GAMS. اتحداك تعدّيني'; }
function makeCard(sc, cb) {
  var c = document.createElement('canvas'); c.width = 1080; c.height = 1350; var x = c.getContext('2d');
  function draw(img) {
    x.fillStyle = '#05070d'; x.fillRect(0, 0, 1080, 1350);
    if (img) { var r = Math.max(1080 / img.width, 1350 / img.height), w = img.width * r, h = img.height * r; x.drawImage(img, (1080 - w) / 2, (1350 - h) / 2, w, h); }
    var g = x.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, 'rgba(5,7,13,.55)'); g.addColorStop(.45, 'rgba(5,7,13,.1)'); g.addColorStop(1, 'rgba(5,7,13,.92)'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
    x.textAlign = 'center'; x.fillStyle = '#eef3fb'; x.font = '900 58px Orbitron, Segoe UI, sans-serif'; x.fillText('MOHAMED ISMAIL', 540, 120); x.fillStyle = '#e6b85c'; x.fillText('GAMS', 540, 190);
    x.fillStyle = '#fff'; x.font = '900 230px Orbitron, Segoe UI, sans-serif'; x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 24; x.fillText(fmt(sc), 540, 980); x.shadowBlur = 0;
    x.fillStyle = '#b9c4d6'; x.font = '700 48px Cairo, Segoe UI, sans-serif'; x.direction = 'rtl'; x.fillText('المستوى ' + (endless ? 'بلا نهاية' : level) + ' | ' + rankFor(level), 540, 1060);
    x.fillStyle = '#e6b85c'; x.font = '900 54px Cairo, Segoe UI, sans-serif'; x.fillText('تقدر تعدّيني؟', 540, 1150);
    x.fillStyle = '#9fb0c8'; x.font = '700 32px Segoe UI, sans-serif'; x.direction = 'ltr'; x.fillText(shareUrl().replace(/^https?:\/\//, '') + '#c=' + sc, 540, 1270);
    c.toBlob(function (b) { cb(b); }, 'image/jpeg', .9);
  }
  if (shotURL) { var im = new Image(); im.onload = function () { draw(im); }; im.onerror = function () { draw(null); }; im.src = shotURL; } else draw(null);
}
function shareScore() {
  var sc = hc.score || score(), url = shareUrl() + '#c=' + sc, txt = shareText(sc);
  function fallback() { window.open('https://wa.me/?text=' + encodeURIComponent(txt + '\n' + url), '_blank'); }
  function notCancel(err) { return !(err && err.name === 'AbortError'); }
  function textOnly() { return navigator.share({ title: 'MOHAMED ISMAIL GAMS', text: txt, url: url }).catch(function (err) { if (notCancel(err)) fallback(); }); }
  if (!navigator.share) { fallback(); return; }
  /* the text and link also go to the clipboard: some share targets keep only the picture */
  try { if (navigator.clipboard) navigator.clipboard.writeText(txt + '\n' + url).catch(function () { }); } catch (e) { }
  makeCard(sc, function (blob) {
    var files = blob ? [new File([blob], 'mi-gams-score.jpg', { type: 'image/jpeg' })] : null;
    if (files && navigator.canShare && navigator.canShare({ files: files })) navigator.share({ title: 'MOHAMED ISMAIL GAMS', text: txt, url: url, files: files }).catch(function (err) { if (notCancel(err)) textOnly(); });
    else textOnly();
  });
}

/* ---------- wiring ---------- */
function startFromMenu() { startGame({ daily: menuMode === 'daily', startLevel: menuMode === 'daily' ? 1 : startAt }); }
$('startBtn').addEventListener('click', startFromMenu);
$('bCampaign').addEventListener('click', function () { menuMode = 'normal'; renderMenu(); });
$('bDaily').addEventListener('click', function () { menuMode = 'daily'; renderMenu(); });
[['cp1', 1], ['cp4', 4], ['cp7', 7]].forEach(function (p) { $(p[0]).addEventListener('click', function () { startAt = p[1]; renderMenu(); }); });
$('againBtn').addEventListener('click', function () { startGame({ daily: mode === 'daily', startLevel: mode === 'daily' ? 1 : startAt }); });
$('againBtn2').addEventListener('click', function () { startGame({}); });
$('homeBtn').addEventListener('click', function () { setState('menu'); });
$('homeBtn2').addEventListener('click', function () { setState('menu'); });
$('endlessBtn').addEventListener('click', continueEndless);
$('nextBtn').addEventListener('click', function () { if (state === 'level') nextLevel(); });
$('reviveBtn').addEventListener('click', function () { if (state === 'revive') reviveNow(); });
$('reviveNo').addEventListener('click', function () { if (state === 'revive') gameOver(); });
$('shareBtn').addEventListener('click', shareScore); $('shareBtn2').addEventListener('click', shareScore);
$('bPause').addEventListener('click', togglePause);
$('bResume').addEventListener('click', togglePause);
$('bRestart').addEventListener('click', function () { creditDist(); state = 'menu'; startGame({ daily: mode === 'daily', startLevel: mode === 'daily' ? 1 : startAt }); });
$('bHome').addEventListener('click', function () { creditDist(); music(false); setState('menu'); });
$('bSound').addEventListener('click', function () { unlockAudio(); setMute(!P.mute); });
$('bSound2').addEventListener('click', function () { unlockAudio(); setMute(!P.mute); });
$('bLefty').addEventListener('click', function () { P.lefty = !P.lefty; saveP(); document.body.classList.toggle('lefty', P.lefty); });
/* iOS counts touchend and click as user activation, not pointerdown, so every gesture end unlocks too */
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(function (n) { window.addEventListener(n, unlockAudio, { capture: true, passive: true }); });

/* ---------- PWA ---------- */
var deferredInstall = null;
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; $('installBtn').hidden = false; });
$('installBtn').addEventListener('click', function () { if (!deferredInstall) return; deferredInstall.prompt(); deferredInstall.userChoice.then(function () { deferredInstall = null; $('installBtn').hidden = true; }); });
if ('serviceWorker' in navigator && !window.SINGLE_FILE && (location.protocol === 'https:' || location.hostname === 'localhost')) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); }); }

/* ---------- boot ---------- */
(function () {
  try { var m = location.hash.match(/c=(\d{1,8})/); if (m) chal = Math.min(parseInt(m[1], 10), 99999999); } catch (e) { }
  document.body.classList.toggle('lefty', !!P.lefty);
  setMute(!!P.mute); applySkin(P.skin || 0);
  applyTier(); setState('menu');
  requestAnimationFrame(frame);
  setTimeout(prewarm, 900);
})();
