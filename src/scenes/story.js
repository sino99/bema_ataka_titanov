// Сюжетные сцены в стиле визуальной новеллы. Тексты правятся в CHAPTERS.
import { createSky } from '../core/sky.js';
import { rrect, wrapText, drawCover, clamp01 } from '../core/ui.js';

// type 'slide': арт на весь экран + текст по центру внизу
// type 'line' : реплика (who: sino | bema | narrator)
// bg: 'wall' | 'colossal' | null (тёмное звёздное небо); у реплик без bg берётся предыдущий фон
const CHAPTERS = {
  prologue: {
    next: ['game', { level: 1 }],
    steps: [
      { type: 'slide', bg: 'wall', text: '845 год. Человечество живёт за тремя огромными Стенами, прячась от титанов…' },
      { type: 'slide', bg: 'colossal', text: 'Но однажды над Стеной появился Колоссальный титан.' },
      { type: 'slide', bg: null, text: 'У человечества осталась одна надежда — кадет Бема, лучшая выпускница 104-го кадетского корпуса.' },
      { type: 'line', who: 'sino', text: 'Бема. Покажи, чему тебя научили. И не испачкай форму.' },
      { type: 'line', who: 'bema', text: 'Есть, капитан! Сердце отдаю человечеству!' },
      { type: 'line', who: 'sino', text: 'Тренировка. Зажми палец на крыше или титане — трос притянет тебя. Лети прямо через затылок.' }
    ]
  },
  beforeLevel2: {
    next: ['game', { level: 2 }],
    steps: [
      { type: 'line', who: 'sino', bg: 'wall', text: 'Неплохо. Для новичка.' },
      { type: 'slide', bg: 'colossal', text: 'Тревога! Колоссальный пробил ворота Троста! Титаны в городе!' },
      { type: 'line', who: 'sino', text: 'Не зевай. Держись рядом со Стеной и возвращайся целой.' },
      { type: 'line', who: 'bema', text: 'Они не пройдут. Не сегодня.' }
    ]
  },
  beforeLevel3: {
    next: ['game', { level: 3 }],
    steps: [
      { type: 'line', who: 'sino', bg: null, text: 'Ты спасла половину города. Я впечатлён. Совсем чуть-чуть.' },
      { type: 'slide', bg: 'wall', text: 'Земля дрожит. Над Стеной снова поднимается он…' },
      { type: 'line', who: 'sino', text: 'Целься в затылок, Бема. Осторожно с паром. Человечество рассчитывает на тебя.' },
      { type: 'line', who: 'bema', text: 'Посвящаю своё сердце!' }
    ]
  }
};

const CPS = 35; // символов в секунду

// Капитан Сино — силуэт: тёмный круг, плечи, лицо, причёска undercut, платок
function makeCaptainFace() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.clip();
  const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, '#3a4256'); bg.addColorStop(1, '#161a26');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  g.fillStyle = '#1f2a22'; // плечи (зелёный плащ)
  g.beginPath(); g.ellipse(S / 2, S + 10, 112, 80, 0, 0, 7); g.fill();
  g.fillStyle = '#f2f2f2'; // платок
  g.beginPath(); g.moveTo(98, 188); g.lineTo(158, 188); g.lineTo(128, 236); g.closePath(); g.fill();
  g.fillStyle = '#d9b8a0'; // шея и лицо
  g.fillRect(110, 150, 36, 44);
  g.beginPath(); g.ellipse(S / 2, 112, 48, 58, 0, 0, 7); g.fill();
  g.fillStyle = '#0f1014'; // волосы: короткие, сверху длиннее
  g.beginPath(); g.ellipse(S / 2, 78, 54, 40, 0, Math.PI, 0); g.fill();
  g.fillRect(74, 74, 108, 14);
  g.beginPath(); g.moveTo(74, 80); g.lineTo(84, 112); g.lineTo(92, 84); g.fill();
  g.beginPath(); g.moveTo(182, 80); g.lineTo(172, 112); g.lineTo(164, 84); g.fill();
  g.fillStyle = '#0f1014'; // глаза-щёлки
  g.fillRect(104, 112, 16, 3); g.fillRect(136, 112, 16, 3);
  g.fillRect(114, 142, 28, 2);
  g.restore();
  g.strokeStyle = 'rgba(255,240,220,0.85)'; g.lineWidth = 3;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.stroke();
  return g.canvas;
}

export function createScene(app, params) {
  const { W, H } = app;
  const chap = CHAPTERS[params.chapter] || CHAPTERS.prologue;
  const steps = chap.steps;
  let idx = 0, typed = 0, lines = null, t = 0;
  let sky = null;
  const captain = makeCaptainFace();
  let bgNow = steps[0].bg ?? null, bgPrev = null, bgFade = 1;
  let done = false;

  const SKIP = { x: 16, y: 16, w: 170, h: 58 };

  function enter(i) {
    idx = i; typed = 0; lines = null;
    const nb = steps[i].bg;
    if (nb !== undefined && nb !== bgNow) { bgPrev = bgNow; bgNow = nb; bgFade = 0; }
  }
  function finish() {
    if (done) return; done = true;
    app.goTo(chap.next[0], chap.next[1]);
  }
  function advance() {
    const total = steps[idx].text.length;
    if (typed < total) { typed = total; return; }
    app.audio.play('click');
    if (idx + 1 >= steps.length) finish(); else enter(idx + 1);
  }
  enter(0);

  function pointerDown(x, y) {
    if (done) return;
    if (x >= SKIP.x && x <= SKIP.x + SKIP.w && y >= SKIP.y && y <= SKIP.y + SKIP.h + 6) { finish(); return; }
    advance();
  }
  function keyDown(code) {
    if (code === 'Space' || code === 'Enter') advance();
    else if (code === 'Escape') finish();
  }

  function update(dt) {
    t += dt;
    typed = Math.min(steps[idx].text.length, typed + CPS * dt);
    if (bgFade < 1) bgFade = Math.min(1, bgFade + dt * 2.5);
    if (!sky) sky = createSky(W, H, 300);
    sky.update(dt);
  }

  function drawBg(ctx, key, alpha) {
    ctx.globalAlpha = alpha;
    if (key) {
      drawCover(ctx, app.assets.get(key), W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    } else if (sky) sky.render(ctx, alpha);
    ctx.globalAlpha = 1;
  }

  let vig = null;
  function drawVignette(ctx) {
    if (!vig) {
      vig = document.createElement('canvas'); vig.width = 320; vig.height = 180;
      const g = vig.getContext('2d');
      const r = g.createRadialGradient(160, 90, 60, 160, 90, 200);
      r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.75)');
      g.fillStyle = r; g.fillRect(0, 0, 320, 180);
    }
    ctx.drawImage(vig, 0, 0, W, H);
  }

  function render(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (bgFade < 1 && bgPrev !== undefined) drawBg(ctx, bgPrev, 1);
    drawBg(ctx, bgNow, bgFade);
    drawVignette(ctx);

    const st = steps[idx];
    ctx.textBaseline = 'alphabetic';
    const n = Math.floor(typed);
    const isLine = st.type === 'line';
    const boxX = 60, boxW = W - 120, boxH = isLine ? 176 : 190, boxY = H - boxH - 30;

    // панель
    rrect(ctx, boxX, boxY, boxW, boxH, 22);
    ctx.fillStyle = 'rgba(8,10,18,0.78)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(232,195,106,0.6)'; ctx.stroke();

    let tx, tw, align;
    ctx.font = (isLine ? '700 28px' : '700 30px') + ' Nunito, sans-serif';
    if (isLine && st.who !== 'narrator') {
      const face = st.who === 'bema' ? app.faces.bema : captain;
      const R = 62, fx = boxX + 30 + R, fy = boxY + boxH / 2;
      if (face) ctx.drawImage(face, fx - R, fy - R, R * 2, R * 2);
      tx = boxX + 30 + R * 2 + 30; tw = boxW - (tx - boxX) - 36; align = 'left';
      ctx.fillStyle = '#e8c36a'; ctx.font = '900 20px Nunito, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(st.who === 'bema' ? 'Бема' : 'Капитан Сино', tx, boxY + 38);
      ctx.font = '700 28px Nunito, sans-serif';
    } else {
      tx = W / 2; tw = boxW - 80; align = 'center';
    }
    if (!lines) lines = wrapText(ctx, st.text, tw);
    ctx.fillStyle = '#fff'; ctx.textAlign = align;
    const lh = 38, top0 = isLine && st.who !== 'narrator' ? boxY + 82 : boxY + (boxH - lines.length * lh) / 2 + 28;
    let left = n;
    for (let i = 0; i < lines.length && left > 0; i++) {
      const s = lines[i], part = s.length + 1 <= left ? s : s.slice(0, left);
      left -= s.length + 1;
      ctx.fillText(part, tx, top0 + i * lh);
    }

    // подсказка «дальше»
    if (typed >= st.text.length) {
      const a = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.globalAlpha = a; ctx.fillStyle = '#e8c36a';
      const ax = boxX + boxW - 36, ay = boxY + boxH - 30;
      ctx.beginPath(); ctx.moveTo(ax - 10, ay - 6); ctx.lineTo(ax + 10, ay - 6); ctx.lineTo(ax, ay + 8); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // «Пропустить»
    rrect(ctx, SKIP.x, SKIP.y, SKIP.w, SKIP.h, 29);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '700 19px Nunito, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Пропустить ›', SKIP.x + SKIP.w / 2, SKIP.y + SKIP.h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    void clamp01;
  }

  return { update, render, pointerDown, keyDown, destroy() {} };
}
