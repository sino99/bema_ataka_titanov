import { rand, FONT_BODY } from './util.js';

const MAX = 400;
// 0 белый пар, 1 серый пар, 2 пыль, 3 уголёк, 4 искра, 5 дерево, 6 красный, 7 голубоватый
const PCOL = ['#ffffff', '#e9e3de', '#c8a47e', '#ffb347', '#fff3b0', '#8a5a34', '#ff6a3d', '#cfd8e8'];

export class Particles {
  constructor() {
    this.a = [];
    for (let i = 0; i < MAX; i++) {
      this.a.push({ on: false, k: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 4, grow: 0, col: 0, al: 1, g: 0, drag: 0 });
    }
    this.cur = 0;
  }

  add(k, x, y, vx, vy, life, size, grow, col, al, g, drag) {
    const p = this.a[this.cur];
    this.cur = (this.cur + 1) % MAX;
    p.on = true; p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.size = size; p.grow = grow; p.col = col;
    p.al = al; p.g = g; p.drag = drag;
  }

  steam(x, y, n, spread = 90, up = 140, size = 22) {
    for (let i = 0; i < n; i++) {
      this.add(0, x + rand(-14, 14), y + rand(-14, 14), rand(-spread, spread), -rand(10, up),
        rand(0.9, 1.9), rand(size * 0.6, size * 1.2), rand(20, 36), Math.random() < 0.7 ? 0 : 1, 0.85, -25, 0.8);
    }
  }
  dust(x, y, n, spread = 120) {
    for (let i = 0; i < n; i++) {
      this.add(0, x + rand(-18, 18), y - rand(0, 6), rand(-spread, spread), -rand(10, 70),
        rand(0.4, 0.9), rand(6, 13), rand(14, 26), 2, 0.7, 0, 2.2);
    }
  }
  sparks(x, y, n, col = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = rand(150, 520);
      this.add(1, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.2, 0.5), 2.2, 0, col, 1, 300, 1.5);
    }
  }
  chips(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.add(0, x + rand(-20, 20), y + rand(-40, 40), rand(-220, 220), -rand(80, 380),
        rand(0.6, 1.2), rand(3, 6), 0, 5, 1, 900, 0.3);
    }
  }
  ember(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.add(0, x, y, rand(-60, 60), -rand(40, 140), rand(0.6, 1.2), rand(2, 4), -2, 3, 1, -20, 0.5);
    }
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      const p = this.a[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.vy += p.g * dt;
      if (p.drag) { const f = 1 - Math.min(0.95, p.drag * dt); p.vx *= f; p.vy *= f; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.size += p.grow * dt;
      if (p.size < 0.3) p.size = 0.3;
    }
  }

  draw(ctx) {
    let lastCol = -1;
    for (let i = 0; i < MAX; i++) {
      const p = this.a[i];
      if (!p.on) continue;
      const f = p.life / p.max;
      if (p.col !== lastCol) { ctx.fillStyle = PCOL[p.col]; ctx.strokeStyle = PCOL[p.col]; lastCol = p.col; }
      if (p.k === 1) {
        ctx.globalAlpha = f * p.al;
        ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, (1 - f) * 8) * f * p.al;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

export class Floaters {
  constructor() { this.a = []; }
  add(x, y, text, color = '#fff', size = 34, life = 1.6) {
    if (this.a.length > 12) this.a.shift();
    this.a.push({ x, y, text, color, size, life, t: 0 });
  }
  update(dt) {
    for (let i = this.a.length - 1; i >= 0; i--) {
      const f = this.a[i];
      f.t += dt; f.y -= 42 * dt;
      if (f.t > f.life) this.a.splice(i, 1);
    }
  }
  draw(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of this.a) {
      const k = f.t / f.life;
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.6 : 1.2 - Math.min(0.2, (k - 0.12) * 0.5);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `800 ${Math.round(f.size * pop)}px ${FONT_BODY}`;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(40,10,20,0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
