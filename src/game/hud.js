import { T } from './tuning.js';
import { rrect, heartPath, FONT_BODY, FONT_TITLE } from './util.js';

export const PAUSE_BTN = { x: 1062, y: 52, r: 38 };      // правее — свободное место под кнопку звука
export const LEFT_BTN = { x: 104, y: 604, r: 60, id: 'left' };
export const RIGHT_BTN = { x: 252, y: 604, r: 60, id: 'right' };
export const HOOK_BTN = { x: 1158, y: 574, r: 82, id: 'hook' };
export const DASH_BTN = { x: 992, y: 628, r: 58, id: 'dash' };
export const JUMP_BTN = { x: 1010, y: 494, r: 44, id: 'jump' };
const CTRL = [LEFT_BTN, RIGHT_BTN, HOOK_BTN, DASH_BTN, JUMP_BTN];
const RESUME = { x: 490, y: 320, w: 300, h: 64 };
const RESTART = { x: 490, y: 404, w: 300, h: 64 };
const RETRY = { x: 500, y: 400, w: 280, h: 70 };
const NEXT = { x: 490, y: 500, w: 300, h: 72 };

const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const inCirc = (x, y, c, pad) => (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) <= (c.r + pad) * (c.r + pad);

export function hitButton(x, y, st) {
  if (st.overlay === 'pause') {
    if (inRect(x, y, RESUME)) return 'resume';
    if (inRect(x, y, RESTART)) return 'restart';
    return null;
  }
  if (st.overlay === 'lose') return st.overlayT > 0.7 && inRect(x, y, RETRY) ? 'retry' : null;
  if (st.overlay === 'win') return st.overlayT > 0.6 && inRect(x, y, NEXT) ? 'next' : null;
  if (inCirc(x, y, PAUSE_BTN, 8)) return 'pause';
  return controlAt(x, y);
}

// кнопки управления: ближайшая, в чей (увеличенный) круг попал палец
export function controlAt(x, y) {
  let best = null, bd = 1e9;
  for (const b of CTRL) {
    const d = Math.hypot(x - b.x, y - b.y);
    if (d <= b.r + 16 && d < bd) { bd = d; best = b.id; }
  }
  return best;
}

function text(ctx, s, x, y, size, color, align = 'center', weight = 800, stroke = 'rgba(30,8,18,0.85)') {
  ctx.font = `${weight} ${size}px ${FONT_BODY}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (stroke) { ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}

function button(ctx, r, label, primary) {
  rrect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (primary) { g.addColorStop(0, '#ffd777'); g.addColorStop(1, '#e08a2c'); }
  else { g.addColorStop(0, '#4b3a58'); g.addColorStop(1, '#2d2036'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = primary ? '#fff2c4' : '#c9b6d9'; ctx.stroke();
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 2, 28, primary ? '#3a1a0a' : '#fff', 'center', 800, null);
}

export function drawHud(ctx, app, st, time) {
  // портрет + сердца
  ctx.save();
  ctx.fillStyle = 'rgba(20,10,30,0.55)';
  ctx.beginPath(); ctx.arc(50, 50, 33, 0, 6.2832); ctx.fill();
  ctx.beginPath(); ctx.arc(50, 50, 29, 0, 6.2832); ctx.clip();
  if (app.faces && app.faces.bema) ctx.drawImage(app.faces.bema, 21, 21, 58, 58);
  ctx.restore();
  ctx.strokeStyle = '#f4d58d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(50, 50, 31, 0, 6.2832); ctx.stroke();
  for (let i = 0; i < st.maxHearts; i++) {
    const full = i < st.hearts;
    const hx = 112 + i * 36, hy = 40;
    heartPath(ctx, hx, hy, 13);
    ctx.fillStyle = full ? '#e63950' : 'rgba(30,15,30,0.55)'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = full ? '#fff' : 'rgba(255,255,255,0.35)'; ctx.stroke();
  }
  // газ
  const gx = 24, gy = 94, gw = 200, gh = 13, gk = Math.max(0, st.gas / T.gasMax);
  rrect(ctx, gx, gy, gw, gh, 6); ctx.fillStyle = 'rgba(15,10,25,0.6)'; ctx.fill();
  if (gk > 0.01) {
    rrect(ctx, gx, gy, Math.max(10, gw * gk), gh, 6);
    const gg = ctx.createLinearGradient(gx, 0, gx + gw, 0);
    if (gk < 0.25) { gg.addColorStop(0, '#ff7a45'); gg.addColorStop(1, '#ffb347'); }
    else { gg.addColorStop(0, '#4fd8c8'); gg.addColorStop(1, '#9af0e0'); }
    ctx.fillStyle = gg; ctx.fill();
  }
  rrect(ctx, gx, gy, gw, gh, 6); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
  text(ctx, 'ГАЗ', gx + gw + 10, gy + 7, 13, '#e8e0f0', 'left', 800, null);

  // центр: счётчик / босс
  if (st.boss) {
    const bw = 560, bx = 640 - bw / 2, by = 54;
    text(ctx, st.boss.name, 640, 30, 26, '#ffe3b0', 'center', 400, 'rgba(60,5,10,0.9)');
    ctx.font = `400 26px ${FONT_TITLE}`;
    rrect(ctx, bx, by, bw, 20, 10); ctx.fillStyle = 'rgba(15,5,10,0.7)'; ctx.fill();
    const k = Math.max(0, st.boss.shown / st.boss.max);
    if (k > 0.005) {
      rrect(ctx, bx, by, Math.max(14, bw * k), 20, 10);
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#ff5a3c'); g.addColorStop(1, '#ffb347');
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let i = 1; i < st.boss.max; i++) { ctx.beginPath(); ctx.moveTo(bx + bw * i / st.boss.max, by + 2); ctx.lineTo(bx + bw * i / st.boss.max, by + 18); ctx.stroke(); }
    rrect(ctx, bx, by, bw, 20, 10); ctx.lineWidth = 2.5; ctx.strokeStyle = '#f4d58d'; ctx.stroke();
  } else if (st.counter) {
    text(ctx, `${st.counter}: ${st.remaining}`, 640, 34, 24, '#fff4d8');
  }
  if (st.showWall) {
    const y = st.boss ? 96 : 66;
    text(ctx, 'СТЕНА', 640 - 66, y + 7, 13, '#e8d9c8', 'right', 800, null);
    for (let i = 0; i < st.wallMax; i++) {
      const bx = 640 - 50 + i * 36, ok = i < st.wallHp;
      rrect(ctx, bx, y, 30, 16, 3);
      ctx.fillStyle = ok ? '#cdb592' : 'rgba(40,25,30,0.7)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = ok ? '#fff1d8' : 'rgba(255,255,255,0.3)'; ctx.stroke();
      if (ok) { ctx.strokeStyle = 'rgba(90,60,50,0.5)'; ctx.beginPath(); ctx.moveTo(bx + 15, y); ctx.lineTo(bx + 15, y + 16); ctx.moveTo(bx, y + 8); ctx.lineTo(bx + 30, y + 8); ctx.stroke(); }
    }
  }

  // пауза (иконка рисуется)
  ctx.beginPath(); ctx.arc(PAUSE_BTN.x, PAUSE_BTN.y, PAUSE_BTN.r, 0, 6.2832);
  ctx.fillStyle = 'rgba(20,10,30,0.55)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#f4d58d'; ctx.stroke();
  ctx.fillStyle = '#fff';
  rrect(ctx, PAUSE_BTN.x - 13, PAUSE_BTN.y - 14, 9, 28, 3); ctx.fill();
  rrect(ctx, PAUSE_BTN.x + 4, PAUSE_BTN.y - 14, 9, 28, 3); ctx.fill();

  // подсказка
  if (st.hint) {
    const w = 640, h = 54, x = 640 - w / 2, y = 110;
    const pul = 1 + Math.sin(time * 5) * 0.015;
    ctx.save(); ctx.translate(640, y + h / 2); ctx.scale(pul, pul); ctx.translate(-640, -(y + h / 2));
    rrect(ctx, x, y, w, h, 27); ctx.fillStyle = 'rgba(25,12,35,0.78)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#f4d58d'; ctx.stroke();
    text(ctx, st.hint, 640, y + h / 2 + 1, 24, '#fff4d8', 'center', 800, null);
    ctx.restore();
  }

  // указатель на титанов вне экрана
  if (st.arrow) {
    const a = st.arrow, ax = a.side < 0 ? 40 : 1240, ay = 360;
    ctx.save(); ctx.translate(ax, ay); ctx.scale(a.side, 1);
    const pul = 0.6 + 0.4 * Math.sin(time * 6);
    ctx.fillStyle = `rgba(255,120,80,${0.6 + 0.4 * pul})`;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(10, -22); ctx.lineTo(10, 22); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
    text(ctx, `${a.dist} м`, ax + (a.side < 0 ? 0 : 0), ay + 40, 16, '#fff', 'center', 800);
  }
}

export function drawTitleCard(ctx, st) {
  const t = st.stateT, tc = T.titleCard;
  const a = Math.min(1, t / 0.4) * Math.min(1, Math.max(0, (tc - t) / 0.5));
  ctx.fillStyle = `rgba(15,6,24,${0.7 * Math.min(1, Math.max(0, (tc - t) / 0.5))})`;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.globalAlpha = a;
  const slide = (1 - Math.min(1, t / 0.5)) * 40;
  text(ctx, st.chapter, 640 - slide, 300, 34, '#f4d58d', 'center', 800, 'rgba(30,8,18,0.8)');
  ctx.font = `400 84px ${FONT_TITLE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,8,16,0.9)'; ctx.strokeText(st.name, 640 + slide, 380);
  const g = ctx.createLinearGradient(0, 340, 0, 420);
  g.addColorStop(0, '#fff4d0'); g.addColorStop(1, '#f2a84a');
  ctx.fillStyle = g; ctx.fillText(st.name, 640 + slide, 380);
  ctx.fillStyle = '#f4d58d'; ctx.fillRect(640 - 120 * Math.min(1, t / 0.7), 440, 240 * Math.min(1, t / 0.7), 3);
  ctx.globalAlpha = 1;
}

export function drawOverlay(ctx, st, time) {
  if (st.overlay === 'pause') {
    ctx.fillStyle = 'rgba(10,4,20,0.65)'; ctx.fillRect(0, 0, 1280, 720);
    ctx.font = `400 72px ${FONT_TITLE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff4d0'; ctx.fillText('Пауза', 640, 250);
    button(ctx, RESUME, 'Продолжить', true);
    button(ctx, RESTART, 'Заново', false);
  } else if (st.overlay === 'lose') {
    const a = Math.min(1, st.overlayT / 0.6);
    ctx.fillStyle = `rgba(20,4,10,${0.7 * a})`; ctx.fillRect(0, 0, 1280, 720);
    ctx.globalAlpha = a;
    ctx.font = `400 90px ${FONT_TITLE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,0,8,0.9)'; ctx.strokeText('Отступаем!', 640, 290);
    ctx.fillStyle = '#ff9a8a'; ctx.fillText('Отступаем!', 640, 290);
    text(ctx, st.loseReason || '', 640, 350, 24, '#ffe0d8');
    if (st.overlayT > 0.7) button(ctx, RETRY, 'Ещё раз', true);
    ctx.globalAlpha = 1;
  } else if (st.overlay === 'win') {
    const a = Math.min(1, st.overlayT / 0.6);
    ctx.fillStyle = `rgba(30,12,30,${0.62 * a})`; ctx.fillRect(0, 0, 1280, 720);
    ctx.globalAlpha = a;
    const s = 1 + Math.sin(time * 3) * 0.02;
    ctx.save(); ctx.translate(640, 250); ctx.scale(s, s);
    ctx.font = `400 110px ${FONT_TITLE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(60,20,0,0.9)'; ctx.strokeText('Победа!', 0, 0);
    const g = ctx.createLinearGradient(0, -50, 0, 50); g.addColorStop(0, '#fff6c8'); g.addColorStop(1, '#f0a030');
    ctx.fillStyle = g; ctx.fillText('Победа!', 0, 0);
    ctx.restore();
    text(ctx, `Очки: ${st.score}`, 640, 360, 34, '#fff4d8');
    text(ctx, `Побеждено: ${st.kills}`, 640, 408, 26, '#ffe3b0');
    if (st.heartsLeft != null) text(ctx, `Сердец осталось: ${st.heartsLeft}`, 640, 446, 22, '#ffd0d8');
    if (st.overlayT > 0.6) button(ctx, NEXT, 'Дальше ›', true);
    ctx.globalAlpha = 1;
  }
}

function ctrlBase(ctx, b, held, color, ready = true) {
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832);
  ctx.fillStyle = held ? 'rgba(255,225,150,0.5)' : 'rgba(30,16,42,0.42)'; ctx.fill();
  ctx.lineWidth = held ? 5 : 3.5; ctx.strokeStyle = held ? '#fff6d0' : (ready ? color : 'rgba(180,170,190,0.6)');
  ctx.globalAlpha = held ? 1 : 0.85; ctx.stroke(); ctx.globalAlpha = 1;
}

function label(ctx, b, s) {
  ctx.font = `800 15px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(30,8,18,0.8)'; ctx.strokeText(s, b.x, b.y + b.r + 15);
  ctx.fillStyle = '#f4ead8'; ctx.fillText(s, b.x, b.y + b.r + 15);
}

function chevron(ctx, x, y, dir, size) {
  ctx.beginPath(); ctx.moveTo(x + dir * -size * 0.45, y - size); ctx.lineTo(x + dir * size * 0.55, y); ctx.lineTo(x + dir * -size * 0.45, y + size); ctx.stroke();
}

// экранные кнопки: стрелки, Трос (крюк), Удар (скрещённые клинки), Прыжок (стрелка вверх)
export function drawControls(ctx, st, time) {
  const h = st.held || {};
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // движение
  for (const [b, dir] of [[LEFT_BTN, -1], [RIGHT_BTN, 1]]) {
    ctrlBase(ctx, b, h[b.id], '#e9dcc0');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.globalAlpha = h[b.id] ? 1 : 0.9;
    chevron(ctx, b.x, b.y, dir, 24);
    ctx.globalAlpha = 1;
  }
  // трос
  {
    const b = HOOK_BTN, held = h.hook;
    ctrlBase(ctx, b, held, '#ffe9a8');
    if (held && st.autoTarget) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,240,180,0.6)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 8 + Math.sin(time * 12) * 2, 0, 6.2832); ctx.stroke(); }
    ctx.save(); ctx.translate(b.x, b.y);
    // верёвка и крюк-кошка
    ctx.strokeStyle = '#d9d2c0'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-34, 34); ctx.quadraticCurveTo(-18, 22, -6, 10); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(10, -12); ctx.stroke();
    ctx.beginPath(); ctx.arc(16, -22, 14, Math.PI * 0.85, Math.PI * 2.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -12); ctx.lineTo(-6, -18); ctx.stroke();
    ctx.restore();
    label(ctx, b, 'Трос');
  }
  // удар
  {
    const d = DASH_BTN, ready = st.dashCd <= 0;
    ctrlBase(ctx, d, h.dash, '#ffe9a8', ready);
    if (!ready) {
      ctx.beginPath(); ctx.moveTo(d.x, d.y);
      ctx.arc(d.x, d.y, d.r - 2, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, st.dashCd / T.dashCooldown));
      ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
    }
    ctx.save(); ctx.translate(d.x, d.y);
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1);
      ctx.strokeStyle = '#eef3f8'; ctx.lineWidth = 5.5;
      ctx.beginPath(); ctx.moveTo(-20, 20); ctx.lineTo(20, -22); ctx.stroke();
      ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 7.5;
      ctx.beginPath(); ctx.moveTo(-22, 22); ctx.lineTo(-13, 13); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    label(ctx, d, 'Удар');
  }
  // прыжок
  {
    const b = JUMP_BTN;
    ctrlBase(ctx, b, h.jump, '#e9dcc0');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(b.x - 15, b.y - 2); ctx.lineTo(b.x, b.y - 17); ctx.lineTo(b.x + 15, b.y - 2);
    ctx.moveTo(b.x, b.y - 15); ctx.lineTo(b.x, b.y + 16); ctx.stroke();
    label(ctx, b, 'Прыжок');
  }
  ctx.restore();
}
