import { LEVELS } from '../game/levels.js';
import { T } from '../game/tuning.js';
import { createWorld } from '../game/world.js';
import { Player } from '../game/player.js';
import { Titan } from '../game/titan.js';
import { Colossal } from '../game/colossal.js';
import { Particles, Floaters } from '../game/particles.js';
import { drawHud, drawControls, drawTitleCard, drawOverlay, hitButton, controlAt } from '../game/hud.js';
import { clamp, pick, rand, segDist, mkCanvas } from '../game/util.js';

const GROUND = T.groundY;
const CHEERS = ['Сасагэё!', 'Отлично, Бема!', 'Ещё один!', 'Капитан доволен'];
const HINTS = [
  'Зажми «Трос» — героиня зацепится сама',
  'Отпусти «Трос», чтобы лететь по инерции',
  'Лети через светящийся затылок!',
  'Кнопка «Удар» — рывок к затылку',
];

let vignetteCanvas = null;
function getVignette() {
  if (vignetteCanvas) return vignetteCanvas;
  vignetteCanvas = mkCanvas(640, 360);
  const g = vignetteCanvas.getContext('2d');
  const rg = g.createRadialGradient(320, 180, 120, 320, 180, 400);
  rg.addColorStop(0, 'rgba(20,5,25,0)'); rg.addColorStop(1, 'rgba(20,5,25,0.5)');
  g.fillStyle = rg; g.fillRect(0, 0, 640, 360);
  return vignetteCanvas;
}

export function createScene(app, params) {
  const levelNo = clamp((params && params.level) | 0 || 1, 1, LEVELS.length);
  const level = LEVELS[levelNo - 1];
  const W = app.W || 1280, H = app.H || 720;
  const zoom = level.zoom || 1;
  const viewW = W / zoom, viewH = H / zoom;
  const play = (n) => { try { app.audio && app.audio.play(n); } catch (e) { /* ignore */ } };

  const world = createWorld(level, W);
  const particles = new Particles();
  const floaters = new Floaters();
  const player = new Player(app, level.playerX);
  const titans = [];
  const boss = level.boss ? new Colossal(level.bossX) : null;
  const pending = level.spawns.map((s) => ({ s, done: false }));
  const vignette = getVignette();

  let state = 'title';          // title | play | winning | win | lose
  let stateT = 0, overlayT = 0, winT = 0;
  let paused = false, destroyed = false;
  let time = 0, levelT = 0;
  let score = 0, kills = 0, hearts = level.hearts || T.hearts;
  let wallHp = level.wallHp;
  let slowT = 0, forceScale = null, flash = 0, hurtFlash = 0, whiteA = 0;
  let shakeAmp = 0, shx = 0, shy = 0;
  let camX = 0, camY = H - viewH;
  let hookId = null, dashId = null;
  let hintStage = 0, hintT = 7, attachedOnce = false;
  let lastStep = -9, bossShown = 3, loseReason = '';
  const keys = { left: false, right: false };
  const kb = { left: false, right: false, hook: false };   // клавиатура
  const cnt = { left: 0, right: 0, hook: 0, dash: 0, jump: 0 };   // экранные кнопки (счётчик пальцев)
  const ctlPtr = new Map();     // pointerId -> кнопка
  const aim = { on: false, x: 0, y: 0, tt: null, kind: 0 };   // авто-цель троса
  let lastAuto = -9, gasLock = false;
  const PCY = T.pcy;
  const later = [];
  const fx = [];            // дуги рывка
  const wp = { x: 0, y: 0 };
  const tmpN = { x: 0, y: 0 };
  const lineAng = []; for (let i = 0; i < 18; i++) lineAng.push(Math.random() * 6.2832);

  const st = {
    overlay: 'none', overlayT: 0, hearts: 0, maxHearts: 3, gas: 100, remaining: 0, counter: level.counter,
    showWall: level.showWall, wallHp: 0, wallMax: level.wallHp, boss: null, hint: '', arrow: null,
    dashCd: 0, chapter: level.chapter, name: level.name, stateT: 0, score: 0, kills: 0, loseReason: '', heartsLeft: null,
  };
  if (boss) st.boss = { name: 'Колоссальный титан', max: boss.maxHp, shown: boss.hp };

  const shake = (a) => { if (a > shakeAmp) shakeAmp = a; };
  const slow = (s) => { if (s > slowT) slowT = s; };
  const canHurt = () => state === 'play' && player.invuln <= 0;

  function toWorld(sx, sy) {
    wp.x = sx / zoom + camX; wp.y = sy / zoom + camY;
  }

  // ---------- события ----------
  function hurtPlayer(sx, sy, power) {
    if (!canHurt()) return;
    play('hit');
    if (!level.invincible) hearts--;
    const dir = player.x >= sx ? 1 : -1;
    player.vx = dir * 640 * power; player.vy = -520 * Math.min(1.2, power);
    player.onGround = false; player.y -= 4;
    player.invuln = T.invuln; player.dashT = 0;
    player.release();
    shake(20); hurtFlash = 1;
    particles.sparks(player.x, player.y - PCY, 12, 6);
    floaters.add(player.x, player.y - 150, 'Ай!', '#ff9a9a', 32, 1);
    if (hearts <= 0) lose('Бема ранена. Нужно отдохнуть.');
  }

  function onStep(t) {
    const d = Math.abs(t.x - player.x), k = t.h / 500;
    if (d < 1500 && time - lastStep > 0.22) { lastStep = time; play('titanStep'); }
    if (d < 1100) shake((1 - d / 1100) * 9 * k + 1);
    if (d < 1300) particles.dust(t.x - t.h * 0.05, GROUND, Math.min(8, 3 + ((k * 3) | 0)), 150 * k);
  }

  function onWall(t) {
    particles.dust(T.wallX + 20, GROUND - 20, 14, 220);
    particles.steam(T.wallX + 30, GROUND - 100, 6, 100, 100, 30);
    shake(22);
    if (level.wallDamage) {
      wallHp--;
      floaters.add(T.wallX + 120, 380, 'Стена повреждена!', '#ffb08a', 30, 1.6);
      if (wallHp <= 0) lose('Стена пала!');
    }
  }

  function onAttach() {
    attachedOnce = true;
    if (hintStage === 0) hintStage = 1;
    player.hook.age = 0;
  }

  function landed(x, y, vy) {
    particles.dust(x, y, Math.min(10, 4 + (vy / 250) | 0), 160);
    if (vy > 700) shake(4);
  }

  function nearestNape(x, y, r) {
    let best = null, bd = r;
    for (const t of titans) {
      if (t.state !== 'walk' || !t.napeOn) continue;
      const d = Math.hypot(t.nx - x, t.ny - y);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) { tmpN.x = best.nx; tmpN.y = best.ny; return tmpN; }
    if (boss && boss.napeOn) {
      const d = Math.hypot(boss.nx - x, boss.ny - y);
      if (d < r + 120) { tmpN.x = boss.nx; tmpN.y = boss.ny; return tmpN; }
    }
    return null;
  }

  const G = {
    player, particles, keys, solids: world.solids, levelW: level.width, time: 0,
    play, shake, canHurt, hurtPlayer, onStep, onWall, onAttach, landed, nearestNape,
  };

  function later_(sec, fn) { later.push({ t: sec, fn }); }

  function killTitan(t) {
    t.die();
    score += T.scorePerTitan; kills++;
    play('slash'); later_(0.1, () => play('titanDie'));
    particles.steam(t.nx, t.ny, t.dummy ? 8 : 26, 150, 200, 26);
    if (t.dummy) particles.chips(t.x, GROUND - t.h * 0.6, 22);
    particles.sparks(t.nx, t.ny, 14);
    floaters.add(t.nx, t.ny - 50, '+' + T.scorePerTitan, '#ffe27a', 40, 1.5);
    floaters.add(player.x, player.y - 150, pick(CHEERS), '#ffffff', 34, 1.8);
    flash = Math.max(flash, 0.75); shake(24); slow(T.slowTime);
    if (hintStage === 2) { hintStage = 3; hintT = 8; }
    if (player.hook.titan === t) player.release();
  }

  function hitBoss() {
    const dead = boss.hit(G);
    play('slash'); later_(0.1, () => play('titanDie'));
    particles.steam(boss.nx, boss.ny, 40, 220, 260, 34);
    particles.sparks(boss.nx, boss.ny, 24);
    floaters.add(boss.nx, boss.ny - 80, '+' + (dead ? 1000 : 300), '#ffe27a', 48, 1.8);
    floaters.add(player.x, player.y - 150, dead ? 'Сасагэё!!!' : pick(CHEERS), '#ffffff', 38, 2);
    score += dead ? 1000 : 300;
    flash = 1; shake(dead ? 50 : 38); slow(dead ? 0.6 : 0.45);
    if (dead) { play('steam'); play('win'); }
  }

  function lose(reason) {
    if (state !== 'play') return;
    state = 'lose'; overlayT = 0; loseReason = reason || '';
    player.release(); hookId = null;
    play('lose');
  }

  function winLevel(fast) {
    if (state !== 'play') return;
    state = 'winning'; winT = fast ? 1.0 : 0;
    player.release(); hookId = null;
  }

  function nextAction() {
    play('click');
    if (levelNo === 1) app.goTo('story', { chapter: 'beforeLevel2' });
    else if (levelNo === 2) app.goTo('story', { chapter: 'beforeLevel3' });
    else app.goTo('ending');
  }

  // ---------- крюк ----------
  function tryHook(wx, wy) {
    const p = player, hx = p.x, hy = p.y - PCY;
    let ax = 0, ay = 0, tt = null, found = false, bd = 1e9;
    // 1) затылок — «залипание»
    for (const t of titans) {
      if (t.state !== 'walk' || !t.napeOn) continue;
      const d = Math.hypot(wx - t.nx, wy - t.ny);
      if (d < T.napeSnap && d < bd && Math.hypot(t.nx - hx, t.ny - hy) < T.hookRange + 150) {
        bd = d; found = true; tt = t; ax = t.nx; ay = t.ny;
      }
    }
    if (!found && boss && boss.napeOn) {
      const d = Math.hypot(wx - boss.nx, wy - boss.ny);
      if (d < T.napeSnap + 70 && Math.hypot(boss.nx - hx, boss.ny - hy) < T.hookRange + 250) { found = true; ax = boss.nx; ay = boss.ny; }
    }
    // 2) тела титанов
    if (!found) {
      for (const t of titans) {
        if (t.state !== 'walk' || !t.contains(wx, wy, T.buildingPad)) continue;
        const hw = 0.24 * t.h;
        const cx = clamp(wx, t.x - hw, t.x + hw), cy = clamp(wy, GROUND + t.yOff - t.h, GROUND + t.yOff);
        const d = Math.hypot(cx - hx, cy - hy);
        if (d <= T.hookRange && Math.hypot(wx - cx, wy - cy) < bd) { bd = Math.hypot(wx - cx, wy - cy); found = true; tt = t; ax = cx; ay = cy; }
      }
    }
    // 3) здания (якорь на крыше)
    if (!found) {
      const pad = T.buildingPad, S = world.solids;
      for (let i = 0; i < S.length; i++) {
        const b = S[i];
        if (wx < b.x - pad || wx > b.x + b.w + pad || wy < b.y - pad || wy > b.y + b.h) continue;
        const cx = clamp(wx, b.x + 10, b.x + b.w - 10), cy = b.y;
        if (Math.hypot(cx - hx, cy - hy) > T.hookRange) continue;
        const d = Math.hypot(wx - cx, wy - cy);
        if (d < bd) { bd = d; found = true; tt = null; ax = cx; ay = cy; }
      }
    }
    // 4) босс
    if (!found && boss && boss.contains(wx, wy, 30)) {
      if (Math.hypot(wx - hx, wy - hy) <= T.hookRange + 100) { found = true; ax = wx; ay = wy; }
    }
    // 5) луч
    let miss = false;
    if (!found) {
      const dx = wx - hx, dy = wy - hy, dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl, uy = dy / dl;
      for (let s = 20; s <= T.rayRange; s += 10) {
        const x = hx + ux * s, y = hy + uy * s;
        let hit = y >= GROUND;
        if (!hit) for (const b of world.solids) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) { hit = true; break; }
        if (!hit) for (const t of titans) if (t.state === 'walk' && t.contains(x, y, 0)) { hit = true; tt = t; break; }
        if (!hit && boss && boss.contains(x, y, 0)) hit = true;
        if (hit) { found = true; ax = x; ay = y; break; }
      }
      if (!found) { miss = true; const m = Math.min(dl, T.rayRange * 0.6); ax = hx + ux * m; ay = hy + uy * m; }
    }
    if (tt) player.fireHook(ax, ay, true, tt, ax - tt.x, ay - (GROUND + tt.yOff), false);
    else player.fireHook(ax, ay, true, null, 0, 0, miss);
    play('hook');
  }


  // ---------- авто-трос ----------
  // приоритеты: 1) затылок титана рядом спереди/сверху, 2) самая высокая крыша впереди, 3) любая ближайшая опора
  function pickAim() {
    const p = player, hx = p.x, hy = p.y - PCY;
    const fd = Math.abs(p.vx) > 60 ? Math.sign(p.vx) : p.facing;
    aim.on = false; aim.tt = null;
    let bd = 1e9;
    for (const t of titans) {
      if (t.state !== 'walk' || !t.napeOn) continue;
      const d = Math.hypot(t.nx - hx, t.ny - hy);
      if (d > T.autoRange + 120) continue;
      const ahead = (t.nx - hx) * fd > -220;
      const sc = d + (ahead ? 0 : 400);
      if (sc < bd) { bd = sc; aim.on = true; aim.x = t.nx; aim.y = t.ny; aim.tt = t; aim.kind = 1; }
    }
    if (!aim.on && boss && boss.napeOn && Math.hypot(boss.nx - hx, boss.ny - hy) < T.autoRange + 320) {
      aim.on = true; aim.x = boss.nx; aim.y = boss.ny; aim.kind = 1;
    }
    if (aim.on) return;
    let bs = 1e9, nearD = 1e9, nx = 0, ny = 0;
    const S = world.buildings;
    for (let i = 0; i < S.length; i++) {
      const b = S[i];
      const ax = clamp(hx + fd * 140, b.x + 14, b.x + b.w - 14), ay = b.y;
      const d = Math.hypot(ax - hx, ay - hy);
      if (d > T.autoRange || d < 40) continue;
      if (d < nearD) { nearD = d; nx = ax; ny = ay; }
      const ahead = (ax - hx) * fd > 30;
      if (!ahead || ay > hy - 20) continue;
      const sc = ay + d * 0.35;
      if (sc < bs) { bs = sc; aim.on = true; aim.x = ax; aim.y = ay; aim.kind = 2; }
    }
    if (!aim.on && nearD < 1e8) { aim.on = true; aim.x = nx; aim.y = ny; aim.kind = 3; }
  }

  function fireAuto() {
    if (!aim.on) return;
    const t = aim.tt;
    if (t) player.fireHook(aim.x, aim.y, true, t, aim.x - t.x, aim.y - (GROUND + t.yOff), false);
    else player.fireHook(aim.x, aim.y, true, null, 0, 0, false);
    player.hook.held = true;
    play('hook'); lastAuto = time;
  }

  function updateAuto() {
    const h = player.hook;
    if (state !== 'play') return;
    if (!(cnt.hook > 0 || kb.hook)) return;
    if (player.gas <= 0.5) gasLock = true;
    else if (player.gas > 18) gasLock = false;
    if (gasLock) { if (h.st === 2) player.release(); return; }   // без газа не виснем на тросе
    h.held = true;
    if (h.st === 0 && time - lastAuto > 0.12) fireAuto();
    else if (h.st === 2 && !h.titan && h.age > 0.35) {
      const md = Math.abs(player.vx) > 60 ? Math.sign(player.vx) : player.facing;
      const dd = Math.hypot(h.tx - player.x, h.ty - (player.y - PCY));
      if ((h.tx - player.x) * md < -60 || dd < 70) player.release();   // дошла до опоры / она позади — перецеливаемся
    }
  }

  function press(b) {
    if (state !== 'play') return;
    if (b === 'dash') doDash();
    else if (b === 'jump') { if (player.jump()) play('whoosh'); }
    else cnt[b]++;
    syncKeys();
  }
  function releaseBtn(b) {
    if (b === 'dash' || b === 'jump') return;
    cnt[b] = Math.max(0, cnt[b] - 1);
    if (b === 'hook' && cnt.hook === 0 && !kb.hook && hookId === null) player.hook.held = false;
    syncKeys();
  }
  function syncKeys() {
    keys.left = kb.left || cnt.left > 0;
    keys.right = kb.right || cnt.right > 0;
  }

  function doDash() {
    if (state !== 'play') return;
    if (player.dash(G)) {
      play('whoosh');
      fx.push({ x: player.x + Math.cos(player.dashAng) * 30, y: player.y - PCY + Math.sin(player.dashAng) * 30, a: player.dashAng, t: 0.25 });
      if (fx.length > 6) fx.shift();
      particles.sparks(player.x, player.y - PCY, 6);
      if (hintStage === 3) hintT = 0;
    }
  }

  // ---------- спавн ----------
  function spawnTitan(s) {
    const t = new Titan({
      kind: s.kind, x: s.x, h: s.h, abnormal: s.abnormal, skin: s.skin, hair: s.hair, wave: s.wave,
      speed: s.speed,
    });
    titans.push(t);
  }

  function updateSpawns() {
    let wave1Clear = true;
    for (const p of pending) if (p.s.wave === 1 && !p.done) wave1Clear = false;
    if (wave1Clear) for (const t of titans) if (t.wave === 1 && t.state === 'walk') wave1Clear = false;
    for (const p of pending) {
      if (p.done) continue;
      const s = p.s;
      let go;
      if (s.wave === 2) go = wave1Clear || levelT > (level.waveTimeout || 25);
      else if (s.at != null) go = levelT >= s.at;
      else go = true;
      if (go) { p.done = true; spawnTitan(s); }
    }
  }
  // начальные титаны/манекены появляются сразу
  updateSpawns();

  function remaining() {
    let n = 0;
    for (const p of pending) if (!p.done) n++;
    for (const t of titans) if (t.state === 'walk') n++;
    return n;
  }

  // ---------- камера ----------
  function updateCam(dt, snap) {
    const tx = clamp(player.x + clamp(player.vx * 0.25, -180, 180) - viewW * 0.42, 0, Math.max(0, level.width - viewW));
    const ty = (H - viewH) + clamp((player.y - 300) * 0.8, -300, 0);
    const k = snap ? 1 : 1 - Math.exp(-5 * dt);
    camX += (tx - camX) * k; camY += (ty - camY) * k;
  }
  updateCam(0, true);

  // ---------- update ----------
  function update(dt) {
    if (destroyed) return;
    dt = Math.min(dt, 0.05);
    time += dt; G.time = time;
    world.updateAmbient(dt);
    if (paused) return;
    stateT += dt;

    for (let i = later.length - 1; i >= 0; i--) {
      later[i].t -= dt;
      if (later[i].t <= 0) { const f = later[i].fn; later.splice(i, 1); f(); }
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 3);
    if (hurtFlash > 0) hurtFlash = Math.max(0, hurtFlash - dt * 2.5);
    if (shakeAmp > 0.3) { shakeAmp *= Math.exp(-7 * dt); shx = (Math.random() - 0.5) * shakeAmp; shy = (Math.random() - 0.5) * shakeAmp; }
    else { shakeAmp = 0; shx = 0; shy = 0; }

    if (state === 'title') {
      particles.update(dt);
      if (stateT >= T.titleCard) { state = 'play'; stateT = 0; }
      updateCam(dt, true);
      return;
    }
    if (state === 'lose') {
      overlayT += dt;
      particles.update(dt * 0.4); floaters.update(dt);
      return;
    }
    if (state === 'win') {
      overlayT += dt;
      particles.update(dt); floaters.update(dt);
      if (whiteA > 0) whiteA = Math.max(0, whiteA - dt * 0.8);
      return;
    }

    // замедление времени
    if (boss && boss.dead) forceScale = boss.deathT < 3.5 ? 0.35 : null;
    let scale = forceScale != null ? forceScale : (slowT > 0 ? T.slowScale : 1);
    if (slowT > 0) slowT -= dt;
    const sdt = dt * scale;

    if (state === 'winning') {
      winT += dt;
      if (winT > 1.6) { state = 'win'; overlayT = 0; stateT = 0; play('win'); }
    }

    levelT += sdt;
    if (state === 'play') updateSpawns();

    if (state === 'play') { pickAim(); updateAuto(); }
    player.update(sdt, G);
    for (let i = 0; i < titans.length; i++) titans[i].update(sdt, G);
    if (boss) boss.update(sdt, G);

    // убийство
    if (state === 'play') {
      const fast = player.speed > T.killSpeed || player.dashT > 0;
      if (fast) {
        const ax = player.px, ay = player.py - PCY, bx = player.x, by = player.y - PCY;
        for (let i = 0; i < titans.length; i++) {
          const t = titans[i];
          if (t.state === 'walk' && t.napeOn && segDist(ax, ay, bx, by, t.nx, t.ny) < T.napeRadius + 12) killTitan(t);
        }
        if (boss && boss.napeOn && segDist(ax, ay, bx, by, boss.nx, boss.ny) < boss.nr + 12) hitBoss();
      }
    }

    // убрать ушедших
    for (let i = titans.length - 1; i >= 0; i--) if (titans[i].state === 'gone') titans.splice(i, 1);
    // дым от падающих титанов
    for (const t of titans) {
      if (t.state === 'dying' && Math.random() < sdt * 40) particles.steam(t.x + rand(-40, 60), GROUND - rand(20, t.h * 0.6), 1, 80, 120, 22);
    }

    particles.update(sdt); floaters.update(sdt);
    for (let i = fx.length - 1; i >= 0; i--) { fx[i].t -= dt; if (fx[i].t <= 0) fx.splice(i, 1); }
    if (boss) bossShown += (boss.hp - bossShown) * (1 - Math.exp(-6 * dt));
    if (boss && boss.finished && state === 'play') { whiteA = 1; winLevel(true); }
    else if (boss && boss.dead) whiteA = Math.max(whiteA, clamp((boss.deathT - 3) / 2, 0, 1));
    if (boss && boss.finished && state === 'winning') whiteA = 1;

    // подсказки уровня 1
    if (level.hints && state === 'play') {
      if (hintStage === 1 && attachedOnce && player.hook.st === 0 && !player.hook.held) hintStage = 2;
      if (hintStage === 3 && hintT > 0) hintT -= dt;
    }

    updateCam(dt, false);

    // условия
    if (state === 'play') {
      if (!boss && remaining() === 0) winLevel(false);
    }
    if (state === 'win') { /* handled above */ }

    // шлейф дыма газа
    if (player.reeling && Math.random() < 0.5) particles.add(0, player.x, player.y - 28, rand(-30, 30), rand(-20, 30), 0.5, 4, 14, 1, 0.5, 0, 1);
  }

  // ---------- render ----------
  function drawAim(ctx) {
    const hx = player.x, hy = player.y - PCY, held = cnt.hook > 0 || kb.hook;
    const pu = 0.5 + 0.5 * Math.sin(time * 8);
    ctx.save();
    ctx.globalAlpha = held ? 0.8 : 0.5;
    ctx.setLineDash([3, 12]); ctx.lineDashOffset = -time * 40; ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff4cf'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(aim.x, aim.y); ctx.stroke();
    ctx.setLineDash([]);
    const r = 16 + pu * 3;
    ctx.strokeStyle = aim.kind === 1 ? '#ffd35a' : '#fff4cf'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(aim.x, aim.y, r, 0, 6.2832); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * 1.5708; ctx.moveTo(aim.x + Math.cos(a) * (r - 4), aim.y + Math.sin(a) * (r - 4)); ctx.lineTo(aim.x + Math.cos(a) * (r + 8), aim.y + Math.sin(a) * (r + 8)); }
    ctx.stroke();
    ctx.restore();
  }

  function render(ctx) {
    ctx.clearRect(0, 0, W, H);
    world.drawBackground(ctx, camX, camY, zoom, time);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-(camX + shx), -(camY + shy));
    world.drawGround(ctx, camX, viewW);
    if (boss) boss.draw(ctx);
    world.drawWalls(ctx, camX, viewW, level.wallDamage ? level.wallHp - wallHp : 0);
    world.drawBuildings(ctx, camX, viewW);
    const vis = (t) => t.x + t.h * 0.6 > camX && t.x - t.h * 0.6 < camX + viewW;
    for (const t of titans) if (t.state === 'dying' && vis(t)) t.draw(ctx, time);
    for (const t of titans) if (t.state === 'walk' && vis(t)) t.draw(ctx, time);
    if (state === 'play' && aim.on && player.hook.st === 0) drawAim(ctx);
    player.drawRope(ctx, time);
    player.draw(ctx);
    for (const f of fx) player.drawSlash(ctx, f);
    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    // линии скорости
    if (player.speed > 650 && state !== 'title') {
      const a = Math.min(0.45, (player.speed - 650) / 900);
      ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < lineAng.length; i++) {
        const an = lineAng[i] + Math.floor(time * 12 + i) * 0.37;
        const r0 = 330 + ((i * 53 + Math.floor(time * 20) * 31) % 120), r1 = r0 + 140 + (i % 3) * 40;
        ctx.moveTo(W / 2 + Math.cos(an) * r0 * 1.3, H / 2 + Math.sin(an) * r0);
        ctx.lineTo(W / 2 + Math.cos(an) * r1 * 1.3, H / 2 + Math.sin(an) * r1);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    world.drawEmbers(ctx);
    ctx.drawImage(vignette, 0, 0, W, H);
    if (hurtFlash > 0) { ctx.fillStyle = `rgba(255,30,40,${hurtFlash * 0.35})`; ctx.fillRect(0, 0, W, H); }
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`; ctx.fillRect(0, 0, W, H); }
    if (whiteA > 0) { ctx.fillStyle = `rgba(255,255,255,${whiteA})`; ctx.fillRect(0, 0, W, H); }

    // состояние HUD
    st.hearts = hearts; st.maxHearts = level.hearts || T.hearts; st.gas = player.gas;
    st.remaining = remaining(); st.wallHp = wallHp; st.dashCd = Math.max(0, player.dashCd);
    st.stateT = stateT; st.score = score; st.kills = kills; st.loseReason = loseReason;
    st.heartsLeft = level.invincible ? null : hearts;
    if (st.boss) st.boss.shown = bossShown;
    st.hint = level.hints && state === 'play' ? (hintStage < 3 ? HINTS[hintStage] : (hintT > 0 ? HINTS[3] : '')) : '';
    st.arrow = null;
    if (state === 'play') {
      let bestD = 1e9, side = 0;
      for (const t of titans) {
        if (t.state !== 'walk') continue;
        const sx = (t.x - camX) * zoom;
        if (sx > -40 && sx < W + 40) continue;
        const d = Math.abs(t.x - player.x);
        if (d < bestD) { bestD = d; side = sx < 0 ? -1 : 1; }
      }
      if (side) st.arrow = { side, dist: Math.round(bestD / 50) };
    }
    st.overlay = paused ? 'pause' : state === 'lose' ? 'lose' : state === 'win' ? 'win' : 'none';
    st.overlayT = overlayT;

    st.held = { left: keys.left, right: keys.right, hook: cnt.hook > 0 || kb.hook, dash: false, jump: false };
    st.autoTarget = aim.on && state === 'play';
    if (state !== 'title' || stateT > 0) { drawHud(ctx, app, st, time); if (state !== 'title') drawControls(ctx, st, time); }
    if (state === 'title') drawTitleCard(ctx, st);
    drawOverlay(ctx, st, time);
  }

  // ---------- ввод ----------
  function doButton(b) {
    play('click');
    if (b === 'resume') paused = false;
    else if (b === 'restart' || b === 'retry') app.goTo('game', { level: levelNo });
    else if (b === 'next') nextAction();
  }

  function pointerDown(x, y, id) {
    if (destroyed) return;
    st.overlay = paused ? 'pause' : state === 'lose' ? 'lose' : state === 'win' ? 'win' : 'none';
    st.overlayT = overlayT;
    if (state === 'title') { if (stateT > 0.8) stateT = T.titleCard; return; }
    if (st.overlay !== 'none') { const b = hitButton(x, y, st); if (b) doButton(b); return; }
    if (state === 'winning') return;
    const b = hitButton(x, y, st);
    if (b === 'pause') { paused = true; play('click'); return; }
    if (b && b !== 'pause') { if (state === 'play') { ctlPtr.set(id, b); press(b); } return; }
    if (state !== 'play') return;
    hookId = id;
    toWorld(x, y);
    player.hook.held = true;
    tryHook(wp.x, wp.y);
  }
  function pointerMove(x, y, id) {
    const old = ctlPtr.get(id);
    if (!old || (old !== 'left' && old !== 'right')) return;
    const nb = controlAt(x, y);
    if (nb && nb !== old && (nb === 'left' || nb === 'right')) {   // палец скользит между стрелками
      releaseBtn(old); ctlPtr.set(id, nb); press(nb);
    }
  }
  function pointerUp(x, y, id) {
    if (ctlPtr.has(id)) { releaseBtn(ctlPtr.get(id)); ctlPtr.delete(id); }
    if (id === hookId) { hookId = null; if (cnt.hook === 0 && !kb.hook) player.hook.held = false; }
    if (id === dashId) dashId = null;
  }

  function keyDown(code) {
    if (destroyed) return;
    if (code === 'Escape' || code === 'KeyP') {
      if (state === 'play' || state === 'winning') { paused = !paused; play('click'); }
      return;
    }
    if (state === 'title') { if (stateT > 0.8 && (code === 'Space' || code === 'Enter')) stateT = T.titleCard; return; }
    if (state === 'win' && overlayT > 0.6 && (code === 'Space' || code === 'Enter')) { nextAction(); return; }
    if (state === 'lose' && overlayT > 0.7 && (code === 'Space' || code === 'Enter' || code === 'KeyR')) { app.goTo('game', { level: levelNo }); return; }
    if (paused) return;
    if (code === 'Space') doDash();
    else if (code === 'KeyA' || code === 'ArrowLeft') { kb.left = true; syncKeys(); }
    else if (code === 'KeyD' || code === 'ArrowRight') { kb.right = true; syncKeys(); }
    else if ((code === 'KeyW' || code === 'ArrowUp') && state === 'play') player.jump();
    else if (code === 'KeyE' || code === 'ShiftLeft' || code === 'ShiftRight') kb.hook = true;
  }
  function keyUp(code) {
    if (code === 'KeyA' || code === 'ArrowLeft') { kb.left = false; syncKeys(); }
    else if (code === 'KeyD' || code === 'ArrowRight') { kb.right = false; syncKeys(); }
    else if (code === 'KeyE' || code === 'ShiftLeft' || code === 'ShiftRight') { kb.hook = false; if (cnt.hook === 0 && hookId === null) player.hook.held = false; }
  }

  function destroy() {
    destroyed = true;
    titans.length = 0; later.length = 0; fx.length = 0;
    hookId = null; dashId = null; ctlPtr.clear();
  }

  return { update, render, pointerDown, pointerMove, pointerUp, keyDown, keyUp, destroy };
}
