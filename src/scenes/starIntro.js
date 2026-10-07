// Интро: звёзды собираются в лицо Бемы
import { buildStarTargets, drawStars, initFlight, updateFlight } from '../core/starPortrait.js';
import { createSky, makeSoftPhoto } from '../core/sky.js';
import { rrect } from '../core/ui.js';

const CX = 640, CY = 290, PH = 500;      // портрет
const TITLE_Y = 612, SUB_Y = 650, BTN = { x: 640, y: 690, w: 240, h: 56 };
const FLY_START = 2;                      // не раньше 2 секунд
const TITLE = 'Бема';

export function createScene(app) {
  const { W, H } = app;
  const sky = createSky(W, H, 400);
  let t = 0, fly0 = -1, stars = null, photo = null, photoW = 0;
  let skipped = false, warp = -1, goneOut = false;
  let allIn = false;
  const cfg = app.config.starPortrait;

  function prepare() {
    const img = app.assets.get(cfg.img);
    stars = buildStarTargets(img, cfg.crop, { cx: CX, cy: CY, height: PH });
    initFlight(stars, W, H);
    photoW = PH * cfg.crop.w / cfg.crop.h;
    photo = makeSoftPhoto(img, cfg.crop, photoW * 1.4, PH * 1.4); // x1.4 для резкости на retina
    fly0 = Math.max(FLY_START, t);
  }

  const flyT = () => (fly0 < 0 ? -1 : t - fly0);
  const btnVisible = () => flyT() >= 8.6 && warp < 0;
  const btnHit = (x, y) => Math.abs(x - BTN.x) < BTN.w / 2 + 20 && Math.abs(y - BTN.y) < BTN.h / 2 + 18;

  function pointerDown(x, y) {
    if (warp >= 0) return;
    if (fly0 < 0) return;
    if (!btnVisible()) {
      // пропуск анимации
      if (!skipped && flyT() < 8.6) { skipped = true; fly0 = t - 8.6; }
      return;
    }
    if (btnHit(x, y)) startWarp();
  }
  function goFullscreen() {
    if (!(typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches)) return;
    try {
      const el = document.documentElement;
      const rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (rq) { const r = rq.call(el); if (r && r.catch) r.catch(() => {}); }
    } catch (e) { /* ignore */ }
    try {
      const o = screen.orientation;
      if (o && o.lock) { const r = o.lock('landscape'); if (r && r.catch) r.catch(() => {}); }
    } catch (e) { /* ignore */ }
  }
  function keyDown(code) {
    if (code === 'Enter' || code === 'Space') pointerDown(BTN.x, BTN.y);
  }
  function startWarp() {
    app.audio.unlock(); app.audio.play('whoosh');
    goFullscreen();
    warp = 0;
  }

  function update(dt) {
    t += dt;
    sky.update(dt * (warp >= 0 ? 1 + warp * 8 : 1));
    if (fly0 < 0 && app.assets.loaded && t >= FLY_START) prepare();
    if (stars) {
      const ft = flyT();
      allIn = updateFlight(stars, ft);
      if (ft > 6.3) { // мерцание
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          s.pulse = 1 + 0.32 * Math.sin(t * (2 + (i % 5) * 0.5) + s.phase);
        }
      }
    }
    if (warp >= 0) {
      warp += dt;
      if (warp > 0.75 && !goneOut) { goneOut = true; app.goTo('story', { chapter: 'prologue' }); }
    }
  }

  // alpha звезды при прилёте: проявляется в начале пути
  const alphaFn = (s) => Math.min(1, s.fp * 4 + 0.05) * (0.55 + 0.45 * s.score);

  function render(ctx) {
    sky.render(ctx);
    const ft = flyT();
    const w = Math.max(0, warp);

    // прогресс загрузки
    if (!app.assets.loaded || t < FLY_START + 0.3) {
      const a = app.assets.loaded ? Math.max(0, 1 - (t - FLY_START) / 0.3) : 1;
      ctx.globalAlpha = 0.7 * a;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(490, 676, 300, 3);
      ctx.fillStyle = '#f7e3a8'; ctx.fillRect(490, 676, 300 * Math.max(0.03, app.assets.progress), 3);
      ctx.globalAlpha = 0.6 * a; ctx.fillStyle = '#fff';
      ctx.font = '400 16px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('собираем звёзды…', 640, 664);
      ctx.globalAlpha = 1;
    }

    if (stars) {
      // фото под звёздами
      if (ft > 5 && photo) {
        const pa = Math.min(1, (ft - 5) / 3) * 0.5 * (1 - Math.min(1, w * 1.5));
        ctx.globalAlpha = pa;
        ctx.drawImage(photo, CX - photoW / 2, CY - PH / 2, photoW, PH);
        ctx.globalAlpha = 1;
      }
      if (warp < 0) {
        drawStars(ctx, stars, alphaFn);
      } else {
        drawWarp(ctx, w);
      }
      drawTitle(ctx, ft, w);
      if (warp < 0 && btnVisible()) drawButton(ctx);
    }

    if (warp >= 0) {
      const a = Math.max(0, Math.min(1, (warp - 0.15) / 0.6));
      ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
  }

  function drawWarp(ctx, w) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let i = pass; i < stars.length; i += 2) {
        const s = stars[i];
        const dx = s.x - CX, dy = s.y - (H / 2), l = Math.hypot(dx, dy) || 1;
        const ux = dx / l, uy = dy / l;
        const dist = w * w * 2600 + w * 200 * (1 + (i % 7) * 0.2);
        const x1 = s.x + ux * dist, y1 = s.y + uy * dist;
        const x0 = s.x + ux * dist * 0.55, y0 = s.y + uy * dist * 0.55;
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      }
      ctx.strokeStyle = pass ? 'rgba(255,225,170,0.8)' : 'rgba(255,255,255,0.9)';
      ctx.lineWidth = pass ? 1.4 : 2.2;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawTitle(ctx, ft, w) {
    if (ft < 5.5) return;
    const fade = 1 - Math.min(1, w * 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '84px "Ruslan Display", serif';
    // посимвольно
    let total = 0; const ws = [];
    for (const ch of TITLE) { const m = ctx.measureText(ch).width; ws.push(m); total += m; }
    let x = 640 - total / 2, i = 0;
    for (const ch of TITLE) {
      const a = Math.max(0, Math.min(1, (ft - 5.5 - i * 0.28) / 0.45));
      if (a > 0) {
        ctx.globalAlpha = a * fade;
        ctx.shadowColor = 'rgba(255,215,140,0.9)'; ctx.shadowBlur = 22;
        ctx.fillStyle = '#fff6df';
        ctx.fillText(ch, x, TITLE_Y - (1 - a) * 12);
      }
      x += ws[i++];
    }
    ctx.shadowBlur = 0;
    const sa = Math.max(0, Math.min(1, (ft - 7.2) / 1.0)) * fade;
    if (sa > 0) {
      ctx.globalAlpha = sa * 0.9; ctx.textAlign = 'center';
      ctx.font = '400 22px Nunito, sans-serif'; ctx.fillStyle = '#e9ddc4';
      ctx.fillText('Разведкорпус ждёт тебя', 640, SUB_Y);
    }
    ctx.globalAlpha = 1;
  }

  function drawButton(ctx) {
    const p = 1 + 0.04 * Math.sin(t * 3.2);
    const a = Math.min(1, (flyT() - 8.6) / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(BTN.x, BTN.y); ctx.scale(p, p);
    const w = BTN.w, h = BTN.h, r = h / 2;
    ctx.shadowColor = 'rgba(255,210,120,0.7)'; ctx.shadowBlur = 16 + 8 * Math.sin(t * 3.2);
    rrect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fillStyle = 'rgba(20,16,10,0.55)'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#e8c36a'; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff3d0'; ctx.font = '900 22px Nunito, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Начать', 0, 1);
    ctx.restore();
  }

  return { update, render, pointerDown, keyDown, destroy() {} };
}
