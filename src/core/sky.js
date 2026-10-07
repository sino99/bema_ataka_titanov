// Ночное небо: градиент + 3 слоя мерцающих звёзд + падающие звёзды (общий для интро и концовки)
import { makeGlowSprite } from './starPortrait.js';

export function createSky(W, H, count = 400) {
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const g = bg.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#02030a'); gr.addColorStop(0.55, '#0b1430'); gr.addColorStop(1, '#2a1a4a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);

  const glow = makeGlowSprite(8);
  const stars = [];
  for (let i = 0; i < count; i++) {
    const layer = i % 3; // 0 дальний .. 2 ближний
    stars.push({
      x: Math.random() * W, y: Math.random() * H, layer,
      size: 1.2 + layer * 1.1 + Math.random(), a: 0.25 + Math.random() * 0.5,
      ph: Math.random() * 6.28, sp: 0.8 + Math.random() * 2.2, v: 1.5 + layer * 3
    });
  }
  const shooters = [];
  for (let i = 0; i < 3; i++) shooters.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  let t = 0, nextShot = 1.5;

  return {
    update(dt) {
      t += dt;
      for (const s of stars) { s.x -= s.v * dt; if (s.x < -4) s.x += W + 8; }
      nextShot -= dt;
      if (nextShot <= 0) {
        nextShot = 2 + Math.random() * 3.5;
        const sh = shooters.find((q) => !q.on);
        if (sh) {
          sh.on = true; sh.life = 0;
          sh.x = Math.random() * W * 0.8 + 200; sh.y = Math.random() * H * 0.35;
          const sp = 900 + Math.random() * 400; sh.vx = -sp * 0.8; sh.vy = sp * 0.45;
        }
      }
      for (const q of shooters) if (q.on) {
        q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.life > 0.9) q.on = false;
      }
    },
    render(ctx, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(bg, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const a = s.a * (0.6 + 0.4 * Math.sin(t * s.sp + s.ph)) * alpha;
        ctx.globalAlpha = a;
        const d = s.size * 3;
        ctx.drawImage(glow, s.x - d / 2, s.y - d / 2, d, d);
      }
      ctx.globalAlpha = alpha;
      ctx.lineCap = 'round';
      for (const q of shooters) if (q.on) {
        const f = 1 - q.life / 0.9;
        const len = 0.09;
        const grd = ctx.createLinearGradient(q.x, q.y, q.x - q.vx * len, q.y - q.vy * len);
        grd.addColorStop(0, `rgba(255,255,255,${f})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grd; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * len, q.y - q.vy * len); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  };
}

// Фото под звёздами с той же маской, что и у звёздного портрета
import { makePortraitPhoto } from './starPortrait.js';
export function makeSoftPhoto(img, crop, w, h) { return makePortraitPhoto(img, crop, w, h); }
