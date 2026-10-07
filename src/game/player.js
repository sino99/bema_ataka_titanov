import { T } from './tuning.js';
import { clamp, rrect, mkCanvas } from './util.js';

// кадры спрайт-листа: x, w, ax (центр торса по X в исходных пикселях)
const FR = {
  idle: [26, 160, 105],
  run: [[210, 262, 350], [472, 287, 610], [759, 257, 880], [1032, 260, 1150]],
  fly: [1298, 421, 1560],
  slash: [1719, 445, 1900],
};
const SY = 120, SH = 520, SBASE = 512;   // срез по Y; ноги на y=632 -> 512 в кадре
function slice(img, x, w, ax) {
  const c = mkCanvas(w - 4, SH), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, x + 2, SY, w - 4, SH, 0, 0, w - 4, SH);
  return { c, ax: ax - x - 2 };
}

const GROUND = T.groundY;
const BW = 14;   // полуширина хитбокса
const BH = 84;   // высота хитбокса
const CY = T.pcy;

const PLAYER_CACHE = { img: null, s: null };

export class Player {
  constructor(app, x) {
    this.face = app.faces && app.faces.bema;
    this.sheet = app.assets && app.assets.get && app.assets.get('playerSheet');
    this.reset(x);
  }

  reset(x) {
    this.x = x; this.y = GROUND; this.px = x; this.py = GROUND;
    this.vx = 0; this.vy = 0; this.facing = 1; this.onGround = true;
    this.gas = T.gasMax; this.dashT = 0; this.dashCd = 0; this.invuln = 0;
    this.legPh = 0; this.runPh = 0; this.sprites = null; this.t = 0; this.speed = 0; this.reeling = false;
    this.lastWhoosh = -9; this.dashAng = 0;
    this.hook = { st: 0, t: 0, dur: 0.1, sx: 0, sy: 0, tx: 0, ty: 0, tipx: 0, tipy: 0, titan: null, ox: 0, oy: 0, len: 0, held: false, holdT: 0, age: 0, anchored: false };
    this.trail = new Float32Array(28); this.trailN = 0; this.trailT = 0;
    this.capeT = 0;
  }

  get cx() { return this.x; }
  get cy() { return this.y - CY; }

  jump() {
    if (!this.onGround) return false;
    this.vy = -T.jumpV; this.onGround = false; this.y -= 3; return true;
  }

  // st: 1 летит, 3 промах
  fireHook(tx, ty, hit, titan, ox, oy, miss) {
    const h = this.hook;
    h.sx = this.x; h.sy = this.y - CY;
    h.tx = tx; h.ty = ty;
    h.st = miss ? 3 : 1; h.t = 0;
    const d = Math.hypot(tx - h.sx, ty - h.sy);
    h.dur = 0.08 + Math.min(0.04, d / 16000);
    h.titan = titan || null; h.ox = ox || 0; h.oy = oy || 0;
    h.tipx = h.sx; h.tipy = h.sy; h.anchored = false; h.holdT = 0; h.age = 0;
  }

  release() { this.hook.st = 0; this.hook.titan = null; }

  anchorPos() {
    const h = this.hook;
    if (h.titan) { h.tx = h.titan.x + h.ox; h.ty = GROUND + h.titan.yOff + h.oy; }
  }

  dash(G) {
    if (this.dashCd > 0 || this.dashT > 0) return false;
    let dx = this.vx, dy = this.vy;
    const sp = Math.hypot(dx, dy);
    if (sp < 120) { dx = this.facing; dy = this.onGround ? -0.2 : 0; }
    else { dx /= sp; dy /= sp; }
    const n = G.nearestNape(this.x, this.y - CY, T.dashAssist);
    if (n) {
      const ex = n.x - this.x, ey = n.y - (this.y - CY), el = Math.hypot(ex, ey) || 1;
      const ux = ex / el, uy = ey / el;
      if (sp < 120 || ux * dx + uy * dy > 0.1) { dx = ux; dy = uy; }
    }
    const nl = Math.hypot(dx, dy) || 1; dx /= nl; dy /= nl;
    const s = Math.max(T.dashSpeed, sp);
    this.vx = dx * s; this.vy = dy * s;
    this.dashT = T.dashTime; this.dashCd = T.dashCooldown;
    this.gas = Math.max(0, this.gas - T.dashGas);
    this.facing = dx >= 0 ? 1 : -1;
    this.dashAng = Math.atan2(dy, dx);
    if (this.onGround && dy < 0) { this.onGround = false; this.y -= 3; }
    this.release();
    return true;
  }

  update(dt, G) {
    this.px = this.x; this.py = this.y;
    this.t += dt;
    if (this.dashT > 0) this.dashT -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    const h = this.hook;

    // --- крюк ---
    if (h.st === 1 || h.st === 3) {
      h.t += dt;
      if (h.st === 1) this.anchorPos();
      let k = h.t / h.dur;
      if (h.st === 3 && k > 1) k = 2 - k;
      if (k < 0) k = 0;
      const sx = this.x, sy = this.y - CY;
      h.tipx = sx + (h.tx - sx) * Math.min(1, k); h.tipy = sy + (h.ty - sy) * Math.min(1, k);
      if (h.st === 1 && h.t >= h.dur) {
        h.st = 2; h.age = 0; h.anchored = true;
        h.holdT = h.held ? 0 : T.tapHold;
        h.len = Math.max(30, Math.hypot(h.tx - this.x, h.ty - (this.y - CY)));
        G.onAttach();
      } else if (h.st === 3 && h.t >= h.dur * 2) h.st = 0;
    }
    this.reeling = false;
    if (h.st === 2) {
      if (h.titan && h.titan.state !== 'walk') this.release();
      else {
        this.anchorPos();
        h.age += dt;
        if (h.held) h.holdT = 0; else h.holdT -= dt;
        if (!h.held && h.holdT <= 0) this.release();
        else {
          const dx = h.tx - this.x, dy = h.ty - (this.y - CY);
          const dist = Math.hypot(dx, dy);
          if (dist > 1) {
            if (this.gas > 0 && dist > 36 && this.dashT <= 0) {
              const nx = dx / dist, ny = dy / dist;
              this.vx += nx * T.reelAccel * dt; this.vy += ny * T.reelAccel * dt;
              this.gas = Math.max(0, this.gas - T.gasDrain * dt);
              this.reeling = true;
              if (this.speed > 650 && G.time - this.lastWhoosh > 0.7) { this.lastWhoosh = G.time; G.play('whoosh'); }
            }
            if (dist < h.len) h.len = Math.max(30, dist);
          }
        }
      }
    }

    // --- управление (кнопки / клавиатура) ---
    const dir = (G.keys.right ? 1 : 0) - (G.keys.left ? 1 : 0);
    if (dir) {
      if (this.onGround) { if (this.vx * dir < T.runMax) this.vx += dir * T.runAccel * dt; }
      else this.vx += dir * (h.st === 2 ? T.airAccelHooked : T.airAccel) * dt;
    } else if (this.onGround && !this.reeling && this.dashT <= 0) {
      this.vx *= Math.exp(-9 * dt);
    }

    // --- физика ---
    this.vy += T.gravity * (this.dashT > 0 ? 0.15 : 1) * dt;
    const drag = 1 - T.airDrag * dt;
    if (!this.onGround) { this.vx *= drag; this.vy *= drag; }
    let sp = Math.hypot(this.vx, this.vy);
    const cap = this.dashT > 0 ? Math.max(T.maxSpeed, T.dashSpeed + 100) : T.maxSpeed;
    if (sp > cap) { const f = cap / sp; this.vx *= f; this.vy *= f; sp = cap; }
    this.speed = sp;

    const wasGround = this.onGround;
    const vyBefore = this.vy;
    this.x += this.vx * dt; this.y += this.vy * dt;

    // ограничение троса
    if (h.st === 2) {
      const dx = this.x - h.tx, dy = (this.y - CY) - h.ty;
      const d = Math.hypot(dx, dy);
      if (d > h.len && d > 0) {
        const nx = dx / d, ny = dy / d, over = d - h.len;
        this.x -= nx * over; this.y -= ny * over;
        const vr = this.vx * nx + this.vy * ny;
        if (vr > 0) { this.vx -= nx * vr; this.vy -= ny * vr; }
      }
    }

    // столкновения
    this.onGround = false;
    const solids = G.solids;
    for (let i = 0; i < solids.length; i++) {
      const r = solids[i];
      if (this.x + BW > r.x && this.x - BW < r.x + r.w && this.y > r.y && this.y - BH < r.y + r.h) {
        const prevBottom = this.py, prevTop = this.py - BH;
        if (prevBottom <= r.y + 3) {
          this.y = r.y; if (this.vy > 0) this.vy = 0; this.onGround = true;
        } else if (this.px + BW <= r.x + 3) {
          if (this.y - r.y < 70) { this.y = r.y; if (this.vy > 0) this.vy = 0; this.onGround = true; }
          else { this.x = r.x - BW; if (this.vx > 0) this.vx = 0; }
        } else if (this.px - BW >= r.x + r.w - 3) {
          if (this.y - r.y < 70) { this.y = r.y; if (this.vy > 0) this.vy = 0; this.onGround = true; }
          else { this.x = r.x + r.w + BW; if (this.vx < 0) this.vx = 0; }
        } else if (prevTop >= r.y + r.h - 3) {
          this.y = r.y + r.h + BH; if (this.vy < 0) this.vy = 0;
        } else {
          this.y = r.y; if (this.vy > 0) this.vy = 0; this.onGround = true;
        }
      }
    }
    if (this.y >= GROUND) { this.y = GROUND; if (this.vy > 0) this.vy = 0; this.onGround = true; }
    if (this.x < 20) { this.x = 20; if (this.vx < 0) this.vx = 0; }
    if (this.x > G.levelW - 20) { this.x = G.levelW - 20; if (this.vx > 0) this.vx = 0; }

    if (this.onGround) {
      if (!wasGround && vyBefore > 350) G.landed(this.x, this.y, vyBefore);
      this.gas = Math.min(T.gasMax, this.gas + T.gasRefill * dt);
      this.legPh += Math.abs(this.vx) * dt * 0.045;
      this.runPh += (4 + Math.abs(this.vx) / 70) * dt;
    }

    // направление взгляда
    if (h.st === 2 && !this.onGround) this.facing = h.tx >= this.x ? 1 : -1;
    else if (Math.abs(this.vx) > 30) this.facing = this.vx > 0 ? 1 : -1;

    // шлейф
    this.trailT += dt;
    if (this.trailT > 0.025) {
      this.trailT = 0;
      const tr = this.trail;
      for (let i = tr.length - 2; i >= 2; i -= 2) { tr[i] = tr[i - 2]; tr[i + 1] = tr[i - 1]; }
      tr[0] = this.x; tr[1] = this.y - CY;
      if (this.trailN < tr.length / 2) this.trailN++;
    }
  }

  drawRope(ctx, t) {
    const h = this.hook;
    if (h.st === 0) return;
    const sx = this.x + this.facing * 4, sy = this.y - 50;
    let ex, ey;
    if (h.st === 2) { ex = h.tx; ey = h.ty; } else { ex = h.tipx; ey = h.tipy; }
    const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const wob = h.st === 2 ? 9 * Math.exp(-h.age * 5) : 3;
    const N = 10;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? 'rgba(30,20,20,0.9)' : '#e8e2d2';
      ctx.lineWidth = pass === 0 ? 3.6 : 1.6;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      for (let i = 1; i <= N; i++) {
        const k = i / N, o = Math.sin(k * Math.PI) * wob * Math.sin(t * 38 + k * 9);
        ctx.lineTo(sx + dx * k + nx * o, sy + dy * k + ny * o);
      }
      ctx.stroke();
    }
    // наконечник
    ctx.fillStyle = '#cfd6dd';
    ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#4a4f57'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  drawTrail(ctx) {
    if (this.speed < 480) return;
    const a = Math.min(1, (this.speed - 480) / 500);
    const tr = this.trail;
    ctx.lineCap = 'round';
    for (let i = 0; i < this.trailN - 1; i++) {
      const f = 1 - i / this.trailN;
      ctx.strokeStyle = `rgba(255,236,200,${0.5 * a * f})`;
      ctx.lineWidth = 14 * f;
      ctx.beginPath(); ctx.moveTo(tr[i * 2], tr[i * 2 + 1]); ctx.lineTo(tr[i * 2 + 2], tr[i * 2 + 3]); ctx.stroke();
    }
  }

  drawOld(ctx) {
    const t = this.t, x = this.x, y = this.y;
    this.drawTrail(ctx);
    const air = !this.onGround;
    const bob = this.onGround ? Math.abs(Math.sin(this.legPh)) * (Math.abs(this.vx) > 40 ? 2.5 : 0) : 0;
    const f = this.facing;

    // плащ (мировые координаты)
    {
      const neckX = x - f * 3, neckY = y - 46 - bob;
      let tx = -this.vx * 0.04 - f * 6, ty = 30 - this.vy * 0.03 + (this.onGround ? 0 : -6);
      const l = Math.hypot(tx, ty);
      if (l > 52) { tx *= 52 / l; ty *= 52 / l; }
      const fl = Math.sin(t * 16) * 4 * (0.4 + Math.min(1, this.speed / 600));
      const ex = neckX + tx, ey = neckY + ty;
      const px = -ty / (Math.hypot(tx, ty) || 1), py = tx / (Math.hypot(tx, ty) || 1);
      ctx.fillStyle = '#3d6b3a';
      ctx.beginPath();
      ctx.moveTo(neckX - 7, neckY); ctx.lineTo(neckX + 7, neckY);
      ctx.quadraticCurveTo(neckX + tx * 0.6 + px * 14, neckY + ty * 0.6 + py * 14 + fl, ex + px * 14, ey + py * 14);
      ctx.lineTo(ex - px * 14 + fl, ey - py * 14);
      ctx.quadraticCurveTo(neckX + tx * 0.6 - px * 14, neckY + ty * 0.6 - py * 14, neckX - 7, neckY);
      ctx.fill();
      ctx.fillStyle = '#2b4f2b';
      ctx.beginPath();
      ctx.moveTo(neckX, neckY); ctx.lineTo(ex + px * 14, ey + py * 14); ctx.lineTo(ex - px * 14 + fl, ey - py * 14); ctx.closePath();
      ctx.fill();
      // эмблема «крылья свободы» (упрощённо)
      const mx = neckX + tx * 0.5, my = neckY + ty * 0.5;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.atan2(ty, tx) - 1.57);
      ctx.fillStyle = '#f2efe6'; ctx.beginPath(); ctx.ellipse(-3, 0, 2.6, 7, 0.6, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#2d4a8c'; ctx.beginPath(); ctx.ellipse(3, 0, 2.6, 7, -0.6, 0, 6.2832); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    if (this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.35;
    ctx.translate(x, y);
    ctx.scale(f, 1);
    if (air) {
      const rot = clamp(0.6 * (this.vx * f) / 900 + 0.35 * this.vy / 900, -0.5, 0.9);
      ctx.translate(0, -30); ctx.rotate(rot); ctx.translate(0, 30);
    }

    const sw = this.onGround ? Math.sin(this.legPh) * 8 : 0;
    // ноги
    ctx.lineCap = 'round';
    const legs = air ? [[-7, -2], [5, -9]] : [[-4 - sw, 0], [4 + sw, 0]];
    for (let i = 0; i < 2; i++) {
      const lx = legs[i][0], ly = legs[i][1] - (this.onGround && ((i === 0 && sw > 0) || (i === 1 && sw < 0)) ? 3 : 0);
      ctx.strokeStyle = '#efece3'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(i === 0 ? -3 : 3, -22 - bob); ctx.lineTo(lx, ly - 4); ctx.stroke();
      ctx.fillStyle = '#4a2c1c'; ctx.beginPath(); ctx.ellipse(lx + 2, ly - 2, 7, 4, 0, 0, 6.2832); ctx.fill();
    }
    // баллоны газа
    ctx.fillStyle = '#9aa5ae';
    rrect(ctx, -15, -28 - bob, 5, 12, 2); ctx.fill();
    rrect(ctx, 10, -28 - bob, 5, 12, 2); ctx.fill();
    // клинки
    ctx.strokeStyle = '#dfe6ec'; ctx.lineWidth = 2.4;
    if (this.dashT > 0 || this.hook.st === 2) {
      ctx.beginPath(); ctx.moveTo(8, -34); ctx.lineTo(40, -38); ctx.moveTo(8, -30); ctx.lineTo(38, -26); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(12, -22); ctx.lineTo(24, -7); ctx.moveTo(-12, -22); ctx.lineTo(-24, -7); ctx.stroke();
    }
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(8, -36, 6, 7);
    // торс
    ctx.translate(0, -bob);
    ctx.fillStyle = '#c9a06a'; rrect(ctx, -10, -46, 20, 26, 6); ctx.fill();
    ctx.strokeStyle = '#6b4226'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-9, -44); ctx.lineTo(9, -24); ctx.moveTo(9, -44); ctx.lineTo(-9, -24); ctx.stroke();
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(-10, -26, 20, 4);
    ctx.fillStyle = '#e0c060'; ctx.fillRect(-2, -26, 4, 4);
    // рука
    ctx.strokeStyle = '#b98f58'; ctx.lineWidth = 6;
    const hooked = this.hook.st === 2 || this.hook.st === 1;
    const hx = (this.dashT > 0 || hooked) ? 22 : 11, hy = (this.dashT > 0 || hooked) ? -48 : -32;
    ctx.beginPath(); ctx.moveTo(4, -42); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#f0c9a0'; ctx.beginPath(); ctx.arc(hx, hy, 3.6, 0, 6.2832); ctx.fill();
    // голова
    ctx.save();
    ctx.translate(2, -58 + Math.sin(t * 6) * (this.onGround ? 1 : 0.5));
    ctx.scale(f, 1);
    ctx.fillStyle = '#3b2a22'; ctx.beginPath(); ctx.arc(0, 0, 23.5, 0, 6.2832); ctx.fill();
    if (this.face) ctx.drawImage(this.face, -22, -22, 44, 44);
    else { ctx.fillStyle = '#f0c9a0'; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 6.2832); ctx.fill(); }
    ctx.restore();
    ctx.restore();
  }


  buildSprites() {
    const img = this.sheet;
    if (!img || !img.complete || !img.naturalWidth) return null;
    if (PLAYER_CACHE.img === img) return PLAYER_CACHE.s;
    const s = { idle: slice(img, ...FR.idle), run: FR.run.map((r) => slice(img, ...r)), fly: slice(img, ...FR.fly), slash: slice(img, ...FR.slash) };
    PLAYER_CACHE.img = img; PLAYER_CACHE.s = s;
    return s;
  }

  draw(ctx) {
    const S = this.sprites || (this.sprites = this.buildSprites());
    if (!S) { this.drawOld(ctx); return; }
    this.drawTrail(ctx);
    const f = this.facing, air = !this.onGround;
    let fr;
    if (this.dashT > 0) fr = S.slash;
    else if (air || this.hook.st === 2) fr = S.fly;
    else if (Math.abs(this.vx) > 40) fr = S.run[Math.floor(this.runPh) & 3];
    else fr = S.idle;
    const sc = T.spriteScale;
    let tilt = 0;
    if (fr === S.fly || fr === S.slash) {
      const vx = this.vx * f;
      tilt = clamp(Math.atan2(this.vy, Math.abs(vx) + 250) * 0.6, -0.35, 0.35);
    } else if (fr === S.idle) tilt = 0;
    let hurt = 0;
    if (this.invuln > T.invuln - 0.35) hurt = (this.invuln - (T.invuln - 0.35)) / 0.35;
    tilt -= hurt * 0.3;
    const breathe = fr === S.idle ? Math.sin(this.t * 3) * 0.012 : 0;
    ctx.save();
    if (this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(this.x, this.y - 55);
    ctx.scale(f, 1);
    ctx.rotate(tilt);
    ctx.translate(0, 55);
    ctx.scale(sc, sc * (1 + breathe));
    ctx.drawImage(fr.c, -fr.ax, -SBASE);
    ctx.restore();
  }

  drawSlash(ctx, fx) {
    // дуга рывка-удара
    ctx.save();
    ctx.translate(fx.x, fx.y); ctx.rotate(fx.a);
    ctx.globalAlpha = fx.t / 0.25;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 64, -1.1, 1.1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,150,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 76, -0.9, 0.9); ctx.stroke();
    ctx.restore();
  }
}
