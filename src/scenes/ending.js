// Концовка: титан повержен -> звёзды-портрет -> полароиды -> письмо -> финал
import { buildStarTargets, drawStars, initFlight, updateFlight } from '../core/starPortrait.js';
import { createSky, makeSoftPhoto } from '../core/sky.js';
import { rrect, wrapText, drawCover, clamp01, easeOutCubic } from '../core/ui.js';

const CX = 640, CY = 330, PH = 520;
const P0_LEN = 8;        // закат: сколько секунд максимум
const FLY_DONE = 8.5;    // сколько секунд собираются звёзды до полароидов
const KEYS = ['bema1', 'bema2', 'bema3', 'bema4', 'bema5', 'bema6'];
// центры полароидов (две строки по три)
const SLOTS = [[300, 190], [640, 175], [980, 190], [300, 520], [640, 535], [980, 520]];
const CPS = 28;   // символов письма в секунду
const INK = '#1f2a5a';
const BTN = { x: 640, y: 560, w: 300, h: 64 };

const rnd = (a, b) => a + Math.random() * (b - a);

function makeHeart(color, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const s = size / 32;
  g.scale(s, s); g.fillStyle = color;
  g.beginPath(); g.moveTo(16, 28);
  g.bezierCurveTo(-4, 14, 4, 0, 16, 9);
  g.bezierCurveTo(28, 0, 36, 14, 16, 28);
  g.fill();
  return c;
}

// Векторное сердце с мягким свечением (центр x,y; size = ширина)
function drawHeartIcon(ctx, x, y, size, color = '#ff6b8b', glow = 'rgba(255,90,130,0.8)') {
  ctx.save();
  ctx.translate(x, y); ctx.scale(size / 32, size / 32); ctx.translate(-16, -16);
  ctx.shadowColor = glow; ctx.shadowBlur = size * 0.7;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(16, 28);
  ctx.bezierCurveTo(-4, 14, 4, 0, 16, 9);
  ctx.bezierCurveTo(28, 0, 36, 14, 16, 28);
  ctx.fill();
  ctx.restore();
}

function makePolaroid(app, key, caption) {
  const img = app.assets.get(key);
  const PW = 250, PHt = 306, PAD = 24;
  const c = document.createElement('canvas'); c.width = PW + PAD * 2; c.height = PHt + PAD * 2;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
  g.fillStyle = '#fbf7ef'; g.fillRect(PAD, PAD, PW, PHt);
  g.shadowBlur = 0; g.shadowOffsetY = 0;
  // квадрат из фото (у bema5/6 внизу плашка — не берём y>800)
  const effH = (key === 'bema5' || key === 'bema6') ? Math.min(img.height, 800) : img.height;
  const side = Math.min(img.width, effH);
  const sx = (img.width - side) / 2, sy = key === 'bema1' ? 0 : (effH - side) / 2;
  g.drawImage(img, sx, sy, side, side, PAD + 15, PAD + 15, PW - 30, PW - 30);
  g.fillStyle = '#1f2a5a'; g.font = '700 25px Caveat, cursive'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const lines = wrapText(g, caption, PW - 28);
  const y0 = PAD + PW - 15 + 26 - (lines.length > 1 ? 6 : 0);
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, PAD + PW / 2, y0 + i * 24));
  return c;
}

export function createScene(app) {
  const { W, H } = app;
  const cfg = app.config.endingPortrait;
  let T = 0, phase = 0, pT = 0;       // общие часы, фаза, время в фазе
  let stars = null, photo = null, photoW = 0;
  let starFade = 0, twinkle = false;
  const sky = createSky(W, H, 400);
  const colossal = app.assets.get('colossal');

  // портрет-звёзды
  {
    const img = app.assets.get(cfg.img);
    stars = buildStarTargets(img, cfg.crop, { cx: CX, cy: CY, height: PH });
    initFlight(stars, W, H);
    photoW = PH * cfg.crop.w / cfg.crop.h;
    photo = makeSoftPhoto(img, cfg.crop, photoW * 1.4, PH * 1.4);
  }

  // полароиды
  const pols = KEYS.map((k, i) => {
    const side = i % 2 ? 1 : -1;
    return {
      cv: makePolaroid(app, k, app.config.photoCaptions[k] || ''),
      tx: SLOTS[i][0], ty: SLOTS[i][1], rot: rnd(-0.1, 0.1),
      sx: CX + side * 1100, sy: rnd(-200, H + 200), srot: rnd(-1.5, 1.5),
      delay: i * 0.3, ph: Math.random() * 6.28
    };
  });

  // письмо
  const msgParas = app.config.loveMessage.split('\n');
  const signText = msgParas.length > 1 ? msgParas.pop() : '';
  const bodyText = msgParas.join('\n');
  let letterLines = null, letterTyped = 0, letterTotal = 0;
  let fontReady = false;
  try {
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('700 34px Caveat', 'Абв'), document.fonts.load('700 44px Caveat', 'Sino')])
        .then(() => { fontReady = true; pols.forEach((p, i) => { p.cv = makePolaroid(app, KEYS[i], app.config.photoCaptions[KEYS[i]] || ''); }); }, () => { fontReady = true; });
    } else fontReady = true;
  } catch (e) { fontReady = true; }

  // сердца
  const hearts = [makeHeart('#ff6b8b'), makeHeart('#ff9db4'), makeHeart('#ffd1dc'), makeHeart('#e8486f')];
  const parts = [];
  for (let i = 0; i < 70; i++) parts.push({ x: rnd(0, W), y: rnd(0, H), v: rnd(30, 90), s: rnd(14, 38), a: rnd(0.3, 0.9),
    ph: rnd(0, 6.28), k: i % 4, r: rnd(-0.5, 0.5) });

  app.audio.play('win');

  function setPhase(p) { phase = p; pT = 0; }
  function next() {
    if (phase === 0) { if (pT > 1.5) setPhase(1); }
    else if (phase === 1) { if (pT < FLY_DONE - 0.5) pT = FLY_DONE - 0.5; }
    else if (phase === 2) { if (pT > 3.8) { setPhase(3); app.audio.play('whoosh'); } }
    else if (phase === 3) {
      if (pT < 1.2) return;
      if (letterTotal && letterTyped < letterTotal) letterTyped = letterTotal; else if (letterTotal) { setPhase(4); app.audio.play('win'); }
    }
  }
  function pointerDown(x, y) {
    if (phase === 4) {
      if (pT > 1 && Math.abs(x - BTN.x) < BTN.w / 2 + 20 && Math.abs(y - BTN.y) < BTN.h / 2 + 20) {
        app.audio.play('click'); app.goTo('intro');
      }
      return;
    }
    next();
  }
  function keyDown(code) { if (code === 'Space' || code === 'Enter') pointerDown(BTN.x, BTN.y); }

  function update(dt) {
    T += dt; pT += dt;
    sky.update(dt);
    if (phase === 0 && pT > P0_LEN) setPhase(1);
    if (phase >= 1) {
      const ft = phase === 1 ? pT : phase === 2 ? FLY_DONE + 0 : 99; // после фазы 1 звёзды остаются на месте
      updateFlight(stars, Math.min(ft, 40));
      if (phase === 1 && pT >= FLY_DONE) setPhase(2);
      twinkle = phase >= 1 && pT + (phase > 1 ? 10 : 0) > 6.3;
      if (twinkle) for (let i = 0; i < stars.length; i++) {
        const s = stars[i]; s.pulse = 1 + 0.32 * Math.sin(T * (2 + (i % 5) * 0.5) + s.phase);
      }
    }
    const target = phase === 4 ? 0.4 : phase >= 2 ? 0.3 : 1;
    starFade += (target - starFade) * Math.min(1, dt * 2.5);
    if (phase === 3 && letterTotal) letterTyped = Math.min(letterTotal, letterTyped + CPS * dt * (pT > 0.8 ? 1 : 0));
    if (phase === 4) for (const p of parts) {
      p.y -= p.v * dt; p.x += Math.sin(T * 0.8 + p.ph) * 20 * dt; p.r += dt * 0.2;
      if (p.y < -50) { p.y = H + 40; p.x = rnd(0, W); }
    }
  }

  const alphaFn = (s) => Math.min(1, s.fp * 4 + 0.05) * (0.55 + 0.45 * s.score) * starFade;

  function render(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

    // --- закат ---
    if (phase === 0 || (phase === 1 && pT < 1.5)) {
      const fadeOut = phase === 1 ? 1 - pT / 1.5 : 1;
      const fadeIn = clamp01(T / 0.8);
      ctx.globalAlpha = fadeOut * fadeIn;
      drawCover(ctx, colossal, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(15,4,20,0.78)'); g.addColorStop(1, 'rgba(140,50,10,0.5)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      // тексты
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const a1 = clamp01((pT - 0.6) / 0.9) * (1 - clamp01((pT - 3.4) / 0.7));
      const a2 = clamp01((pT - 4.0) / 0.9);
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 16;
      if (phase === 0 && a1 > 0) {
        ctx.globalAlpha = a1; ctx.fillStyle = '#fff1d6'; ctx.font = '64px "Ruslan Display", serif';
        ctx.fillText('Колоссальный титан повержен', W / 2, H / 2);
      }
      if (phase === 0 && a2 > 0) {
        ctx.globalAlpha = a2; ctx.fillStyle = '#fff1d6'; ctx.font = '54px "Ruslan Display", serif';
        ctx.fillText('Человечество спасено —', W / 2, H / 2 - 40);
        ctx.fillText('благодаря Беме', W / 2, H / 2 + 34);
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
    }

    // --- ночь ---
    if (phase >= 1) {
      const na = phase === 1 ? clamp01(pT / 1.5) : 1;
      sky.render(ctx, na);
      const ft = phase === 1 ? pT : 99;
      const pa = (phase === 1 ? clamp01((ft - 5) / 3) : 1) * (phase >= 2 && phase < 4 ? 0.2 : 0.5);
      if (pa > 0) {
        ctx.globalAlpha = pa * (phase === 4 ? 0.8 : 1);
        ctx.drawImage(photo, CX - photoW / 2, CY - PH / 2, photoW, PH);
        ctx.globalAlpha = 1;
      }
      drawStars(ctx, stars, alphaFn);
    }

    if (phase === 2 || phase === 3) drawPolaroids(ctx);
    if (phase === 3) drawLetter(ctx);
    if (phase === 4) drawFinale(ctx);

    if (phase === 2 && pT > 3.8) hint(ctx, 'нажми, чтобы продолжить');
  }

  function hint(ctx, text) {
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(T * 3);
    ctx.fillStyle = '#fff'; ctx.font = '400 18px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, W / 2, H - 14); ctx.globalAlpha = 1;
  }

  function drawPolaroids(ctx) {
    for (let i = 0; i < pols.length; i++) {
      const p = pols[i];
      let x, y, rot, a = 1;
      if (phase === 2) {
        const k = clamp01((pT - 0.2 - p.delay) / 1.1);
        const e = easeOutCubic(k);
        x = p.sx + (p.tx - p.sx) * e; y = p.sy + (p.ty - p.sy) * e; rot = p.srot + (p.rot - p.srot) * e;
        a = clamp01(k * 4);
      } else {
        const k = easeOutCubic(clamp01(pT / 0.9));
        const side = p.tx < CX ? -1 : p.tx > CX ? 1 : (i % 2 ? 1 : -1);
        x = p.tx + side * 1000 * k; y = p.ty + 60 * k; rot = p.rot + side * 0.5 * k; a = 1 - k;
      }
      if (a <= 0) continue;
      y += Math.sin(T * 1.2 + p.ph) * 5; rot += Math.sin(T * 0.9 + p.ph) * 0.015;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot);
      ctx.drawImage(p.cv, -p.cv.width / 2, -p.cv.height / 2);
      ctx.restore();
    }
  }

  const LH = 42, LFONT = '700 34px Caveat, "Segoe Script", cursive', SFONT = '700 44px Caveat, "Segoe Script", cursive';
  function layoutLetter(ctx, tw) {
    ctx.font = LFONT;
    const lines = wrapText(ctx, bodyText, tw).map((t) => ({ t, w: null }));
    let n = 0;
    for (const l of lines) {
      l.start = n; n += l.t.length;
      l.cum = [0]; for (let i = 1; i <= l.t.length; i++) l.cum.push(ctx.measureText(l.t.slice(0, i)).width);
    }
    letterLines = lines;
    ctx.font = SFONT;
    letterLines.sign = { t: signText, start: n, w: ctx.measureText(signText).width, cum: [0] };
    for (let i = 1; i <= signText.length; i++) letterLines.sign.cum.push(ctx.measureText(signText.slice(0, i)).width);
    letterTotal = n + signText.length;
  }

  function drawLetter(ctx) {
    const k = easeOutCubic(clamp01((pT - 0.3) / 0.7));
    if (k <= 0) return;
    const cw = 860, ch = 540, PADX = 64;
    const tw = cw - PADX * 2;
    if (!letterLines && (fontReady || pT > 2.5)) layoutLetter(ctx, tw);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(W / 2, H / 2 + (1 - k) * 40); ctx.rotate(-1.5 * Math.PI / 180);
    const x0 = -cw / 2, y0 = -ch / 2;
    // бумага
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 12;
    const pg = ctx.createLinearGradient(0, y0, 0, y0 + ch);
    pg.addColorStop(0, '#fbf5e6'); pg.addColorStop(1, '#f1e6cc');
    ctx.fillStyle = pg; ctx.fillRect(x0, y0, cw, ch);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // линейки
    const top = y0 + 78;
    ctx.strokeStyle = 'rgba(90,120,170,0.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let y = top + 10; y < y0 + ch - 24; y += LH) { ctx.moveTo(x0 + 28, y); ctx.lineTo(x0 + cw - 28, y); }
    ctx.stroke();
    // поле слева
    ctx.strokeStyle = 'rgba(200,90,90,0.3)'; ctx.beginPath(); ctx.moveTo(x0 + 46, y0 + 16); ctx.lineTo(x0 + 46, y0 + ch - 16); ctx.stroke();

    if (letterLines) {
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = INK;
      const typed = letterTyped;
      ctx.font = LFONT;
      for (let li = 0; li < letterLines.length; li++) {
        const l = letterLines[li], by = top + li * LH;
        for (let i = 0; i < l.t.length; i++) {
          const a = clamp01((typed - (l.start + i)) / 3);
          if (a <= 0) break;
          ctx.globalAlpha = k * a;
          ctx.fillText(l.t[i], x0 + PADX + l.cum[i], by - (1 - a) * 3);
        }
      }
      const sg = letterLines.sign;
      if (sg.t) {
        ctx.save();
        const sy = top + letterLines.length * LH + 34;
        ctx.translate(x0 + cw - PADX - sg.w, sy); ctx.rotate(-0.05);
        ctx.font = SFONT;
        for (let i = 0; i < sg.t.length; i++) {
          const a = clamp01((typed - (sg.start + i)) / 3);
          if (a <= 0) break;
          ctx.globalAlpha = k * a;
          ctx.fillText(sg.t[i], sg.cum[i], 0);
        }
        ctx.restore();
      }
    }
    ctx.restore();
    if (letterTotal && letterTyped >= letterTotal) hint(ctx, 'нажми, чтобы продолжить');
  }

  function drawFinale(ctx) {
    // сердца
    for (const p of parts) {
      ctx.globalAlpha = p.a * clamp01(pT / 1.5);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.r * 3) * 0.4);
      ctx.drawImage(hearts[p.k], -p.s / 2, -p.s / 2, p.s, p.s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const a1 = easeOutCubic(clamp01(pT / 1.2));
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.save(); ctx.globalAlpha = a1; ctx.translate(W / 2, 270); ctx.scale(0.9 + 0.1 * a1, 0.9 + 0.1 * a1);
    ctx.shadowColor = 'rgba(255,200,120,0.85)'; ctx.shadowBlur = 30;
    ctx.fillStyle = '#fff3d6'; ctx.font = '84px "Ruslan Display", serif';
    ctx.fillText('Shinzou wo Sasageyo!', 0, 0);
    ctx.restore();
    const a2 = clamp01((pT - 1.2) / 1);
    if (a2 > 0) {
      ctx.globalAlpha = a2; ctx.fillStyle = '#ffdfe6'; ctx.font = '700 38px Nunito, sans-serif';
      ctx.shadowColor = 'rgba(255,90,130,0.7)'; ctx.shadowBlur = 18;
      const msg = 'Моё сердце отдано тебе';
      ctx.fillText(msg, W / 2 - 22, 360);
      const mw = ctx.measureText(msg).width;
      ctx.shadowBlur = 0;
      drawHeartIcon(ctx, W / 2 - 22 + mw / 2 + 30, 348, 30);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    const a3 = clamp01((pT - 2.2) / 0.8);
    if (a3 > 0) {
      const p = 1 + 0.04 * Math.sin(T * 3.2);
      ctx.save(); ctx.globalAlpha = a3; ctx.translate(BTN.x, BTN.y); ctx.scale(p, p);
      ctx.shadowColor = 'rgba(255,210,120,0.7)'; ctx.shadowBlur = 16;
      rrect(ctx, -BTN.w / 2, -BTN.h / 2, BTN.w, BTN.h, BTN.h / 2);
      ctx.fillStyle = 'rgba(20,16,10,0.6)'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#e8c36a'; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff3d0'; ctx.font = '900 24px Nunito, sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText('Сыграть снова', 0, 1);
      ctx.restore();
    }
  }

  return { update, render, pointerDown, keyDown, destroy() {} };
}
