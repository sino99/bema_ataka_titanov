import { T } from './tuning.js';
import { clamp, easeOutCubic, rand, mkCanvas } from './util.js';

const GROUND = T.groundY;
// тёмная, немного обесцвеченная кожа: [светлая, тёмная]
const SKINS = [['#b89880', '#5a4038'], ['#ae8e78', '#523a33'], ['#c2a38a', '#684c43'], ['#a98a73', '#4c352f']];
const HAIR = ['#3a2a22', '#5b3a26', '#1f1a1a', '#7a5a3a'];
const GRADS = {};
let gctx = null;
// градиенты в «единицах титана» (рост = 100) кэшируются один раз на цвет кожи
function grads(si) {
  if (GRADS[si]) return GRADS[si];
  if (!gctx) gctx = mkCanvas(4, 4).getContext('2d');
  const [S, D] = SKINS[si];
  const body = gctx.createLinearGradient(-16, 0, 16, 0);
  body.addColorStop(0, S); body.addColorStop(0.5, S); body.addColorStop(1, D);
  const limbG = gctx.createLinearGradient(-8, 0, 8, 0);
  limbG.addColorStop(0, S); limbG.addColorStop(1, D);
  const head = gctx.createRadialGradient(-4, -92, 1, 0, -92, 15);
  head.addColorStop(0, S); head.addColorStop(1, D);
  return (GRADS[si] = { body, limbG, head });
}

export class Titan {
  constructor(o) {
    this.kind = o.kind || 'titan';
    this.dummy = this.kind === 'dummy';
    this.x = o.x; this.h = o.h || 560;
    this.abn = !!o.abnormal;
    this.speed = this.dummy ? 0 : (o.speed || (this.abn ? 100 : rand(35, 60)));
    this.wave = o.wave || 0;
    const si = (o.skin || 0) % 4;
    this.si = si;
    this.skin = SKINS[si][0]; this.dark = SKINS[si][1];
    this.hair = (o.hair || 0) % 3; this.hairCol = HAIR[si];
    this.hs = this.dummy ? 1 : (this.abn ? 1.2 : (o.big ? 1.45 : 1 + (si % 2) * 0.16));   // размер головы
    this.lean = this.dummy ? -0.05 : (this.abn ? -0.5 : -0.2);
    this.lookX = 0; this.lookY = 0; this.steamT = Math.random() * 2; this.dip = 0;
    this.state = 'walk'; this.dieT = 0;
    this.phase = Math.random() * 6; this.yOff = 0;
    this.lurch = 0; this.nextLurch = rand(2, 4);
    this.reach = this.h * (this.abn ? 0.5 : 0.42);
    this.grab = { st: 0, t: 0, ang: Math.PI, cd: rand(0.6, 1.8), hx: 0, hy: 0, e: 0, hit: false };
    this.stepCnt = Math.floor(this.phase / Math.PI);
    this.napeOn = true; this.nx = 0; this.ny = 0; this.sx = 0; this.sy = 0;
    this.pulse = Math.random() * 6;
    this._o = { x: 0, y: 0 };
    this.updateNape();
  }

  // точка тела (единицы: рост = 100) -> мир, с учётом наклона и просадки корпуса
  upperPt(lx, ly, out) {
    const u = this.h / 100, th = this.lean;
    const px = lx, py = ly + 46, c = Math.cos(th), s = Math.sin(th);
    out.x = this.x + u * (px * c - py * s);
    out.y = GROUND + this.yOff + u * (px * s + py * c - 46 + this.dip);
  }

  hcx() { return -4 - (this.hs - 1) * 3; }

  updateNape() {
    if (this.dummy) {
      this.nx = this.x + 0.13 * this.h; this.ny = GROUND - 0.72 * this.h;
      this.sx = this.x - 0.04 * this.h; this.sy = GROUND - 0.68 * this.h;
      return;
    }
    this.dip = 2.4 * Math.pow(1 - Math.abs(Math.sin(this.phase)), 2);
    const hs = this.hs, ry = 8.5 * hs, rx = 7.5 * hs, hcy = -100 + ry, o = this._o;
    this.upperPt(this.hcx() + rx * 0.8, hcy + ry * 0.8, o); this.nx = o.x; this.ny = o.y;
    this.upperPt(-2, -100 + 2 * ry + 4, o); this.sx = o.x; this.sy = o.y;
  }

  contains(px, py, pad) {
    const hw = 0.24 * this.h + pad;
    return px > this.x - hw && px < this.x + hw && py > GROUND + this.yOff - this.h - pad && py < GROUND + this.yOff + pad;
  }

  die() { this.state = 'dying'; this.dieT = 0; this.napeOn = false; this.grab.st = 0; }

  update(dt, G) {
    this.pulse += dt;
    if (this.state === 'dying') { this.dieT += dt; if (this.dieT > 2) this.state = 'gone'; return; }
    if (this.state !== 'walk') return;
    if (!this.dummy) {
      let sp = this.speed;
      if (this.abn) {
        this.nextLurch -= dt;
        if (this.lurch > 0) {
          this.lurch -= dt; sp *= 2.4;
          this.yOff = -Math.sin(Math.PI * clamp(1 - this.lurch / 0.6, 0, 1)) * 70;
        } else {
          this.yOff = 0;
          if (this.nextLurch <= 0) { this.lurch = 0.6; this.nextLurch = rand(3, 5); }
        }
      }
      if (this.grab.st === 1 || this.grab.st === 2) sp *= 0.25;
      this.x -= sp * dt;
      this.phase += sp * dt * 14 / this.h * (this.abn ? 1.4 : 1);
      const n = Math.floor(this.phase / Math.PI);
      if (n !== this.stepCnt) { this.stepCnt = n; if (this.yOff === 0) G.onStep(this); }
      if (this.x < T.wallX + 30) { this.state = 'gone'; G.onWall(this); return; }
    }
    this.updateNape();
    if (this.dummy) return;

    // глаза следят, пар поднимается от тела
    {
      const p0 = G.player;
      const lx = clamp((p0.x - this.x) / 500, -1, 1), ly = clamp((p0.y - 60 - this.ny) / 400, -1, 1);
      const k = 1 - Math.exp(-2 * dt);
      this.lookX += (lx - this.lookX) * k; this.lookY += (ly - this.lookY) * k;
      this.steamT -= dt;
      if (this.steamT <= 0) {
        this.steamT = rand(0.5, 1.0);
        G.particles.steam(this.x + rand(-0.1, 0.1) * this.h, this.ny + this.h * rand(0.0, 0.25), 1, 20, 70, 12 + this.h / 70);
      }
    }

    // --- захват ---
    const g = this.grab, p = G.player;
    const pcx = p.x, pcy = p.y - 45;
    if (g.st === 0) {
      g.cd -= dt;
      if (g.cd <= 0 && G.canHurt()) {
        const d = Math.hypot(pcx - this.sx, pcy - this.sy);
        if (d < this.reach + T.grabTrigger) {
          g.st = 1; g.t = 0; g.ang = Math.atan2(pcy - this.sy, pcx - this.sx); g.hit = false;
        }
      }
    } else if (g.st === 1) {
      g.t += dt;
      if (g.t < T.grabTelegraph - 0.35) g.ang = Math.atan2(pcy - this.sy, pcx - this.sx);
      g.e = easeOutCubic(Math.min(1, g.t / T.grabTelegraph)) * 0.85;
      if (g.t >= T.grabTelegraph) { g.st = 2; g.t = 0; g.hit = false; }
    } else if (g.st === 2) {
      g.t += dt; g.e = 1;
      const hx = this.sx + Math.cos(g.ang) * this.reach, hy = this.sy + Math.sin(g.ang) * this.reach;
      g.hx = hx; g.hy = hy;
      if (!g.hit && G.canHurt() && Math.hypot(pcx - hx, pcy - hy) < T.grabRadius + 16) {
        g.hit = true; G.hurtPlayer(hx, hy, 1);
      }
      if (g.t >= T.grabActive) { g.st = 3; g.t = 0; }
    } else {
      g.t += dt; g.e = Math.max(0, 1 - g.t / 0.35);
      if (g.t > 0.35) { g.st = 0; g.cd = T.grabCooldown; g.e = 0; }
    }
  }

  // ---------------- рисование ----------------
  draw(ctx, time) {
    if (this.state === 'gone') return;
    const u = this.h / 100;
    ctx.save();
    ctx.translate(this.x, GROUND + this.yOff);
    // тень на земле
    ctx.fillStyle = 'rgba(10,0,10,0.32)';
    ctx.beginPath(); ctx.ellipse(0, -this.yOff + 2, this.h * 0.26, this.h * 0.025 + 5, 0, 0, 6.2832); ctx.fill();
    if (this.state === 'dying') {
      const k = Math.min(1, this.dieT / 1.2);
      ctx.rotate(easeOutCubic(k) * 1.45);
      ctx.globalAlpha = this.dieT > 1.2 ? Math.max(0, 1 - (this.dieT - 1.2) / 0.8) : 1;
    }
    ctx.scale(u, u);
    if (this.dummy) this.drawDummy(ctx);
    else this.drawTitan(ctx, time);
    ctx.restore();

    if (this.state === 'walk') {
      if (this.napeOn) this.drawNape(ctx);
      if (this.grab.st === 1) this.drawWarn(ctx, time);
    }
  }

  drawNape(ctx) {
    const pu = 0.5 + 0.5 * Math.sin(this.pulse * 6);
    const r = 30 + pu * 10;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,200,90,0.35)';
    ctx.beginPath(); ctx.arc(this.nx, this.ny, r + 14, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,190,0.7)';
    ctx.beginPath(); ctx.arc(this.nx, this.ny, r * 0.55, 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = `rgba(255,230,150,${0.5 + pu * 0.4})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(this.nx, this.ny, T.napeRadius - pu * 6, 0, 6.2832); ctx.stroke();
  }

  drawWarn(ctx, time) {
    const x = this.x - this.h * 0.05, y = this.sy - this.h * 0.3 - 20;
    const s = 1.15 + 0.14 * Math.sin(time * 28);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#e0243a'; ctx.beginPath(); ctx.arc(0, 0, 28, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 38px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 2);
    ctx.restore();
  }

  drawTitan(ctx, time) {
    const ph = this.phase, sw = Math.sin(ph);
    const G = grads(this.si);
    const S = SKINS[this.si][0], D = SKINS[this.si][1];
    const abn = this.abn, g = this.grab, hs = this.hs;
    const th = abn ? 0.75 : 1;
    const HIP = -46;

    // --- ноги (колено вперёд) ---
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let side = 1; side >= -1; side -= 2) {
      const a = ph + (side > 0 ? 0 : Math.PI);
      const s2 = Math.sin(a), c2 = Math.cos(a);
      const fx = s2 * 14 * (abn ? 1.3 : 1), fy = -Math.max(0, c2) * 7 * (abn ? 1.5 : 1);
      const hx = side * 3.5, kx = (hx + fx) / 2 - 5, ky = -24 + fy * 0.5 - (abn ? 6 : 0);
      const col = side > 0 ? D : S;
      ctx.strokeStyle = col; ctx.lineWidth = 11 * th;
      ctx.beginPath(); ctx.moveTo(hx, HIP + 2); ctx.lineTo(kx, ky); ctx.stroke();
      ctx.lineWidth = 8 * th;
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx - 1, fy - 2); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(fx - 3, fy - 1, 7, 2.6, 0, 0, 6.2832); ctx.fill();
    }

    ctx.save();
    ctx.translate(0, this.dip);
    ctx.translate(0, HIP); ctx.rotate(this.lean); ctx.translate(0, -HIP);
    const ry = 8.5 * hs, rx = 7.5 * hs;
    const shY = -100 + 2 * ry + 4;      // линия плеч
    const hcx = this.hcx(), hcy = -100 + ry;

    // задняя рука
    {
      const swg = sw * 8;
      const hx = 8 + swg + (abn ? -8 : 0), hy = abn ? -8 - Math.max(0, swg) * 0.4 : -22 + Math.abs(swg) * 0.2;
      const ex = hx * 0.5 + 4, ey = (shY + hy) / 2;
      ctx.strokeStyle = D; ctx.lineWidth = 6.5 * th;
      ctx.beginPath(); ctx.moveTo(7, shY + 3); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = D; ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, 6.2832); ctx.fill();
    }

    // набедренная повязка
    ctx.fillStyle = '#4e3a34';
    ctx.beginPath(); ctx.moveTo(-10 * th, HIP - 4); ctx.lineTo(10 * th, HIP - 4); ctx.lineTo(9 * th, HIP + 9); ctx.lineTo(-9 * th, HIP + 9); ctx.fill();

    // торс: широкие плечи, узкая талия, свет/тень
    ctx.fillStyle = G.body;
    ctx.beginPath();
    ctx.moveTo(-14 * th, shY + 1);
    ctx.quadraticCurveTo(-1, shY - 5, 14 * th, shY + 1);
    ctx.quadraticCurveTo(13 * th, (shY + HIP) / 2, 9 * th, HIP);
    ctx.lineTo(-9 * th, HIP);
    ctx.quadraticCurveTo(-13 * th, (shY + HIP) / 2, -14 * th, shY + 1);
    ctx.fill();
    // ключицы, рёбра, пресс
    ctx.strokeStyle = 'rgba(40,16,16,0.32)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-11, shY + 4); ctx.quadraticCurveTo(-5, shY + 2, -1, shY + 5);
    ctx.moveTo(11, shY + 4); ctx.quadraticCurveTo(5, shY + 2, 1, shY + 5);
    for (let i = 0; i < 4; i++) {
      const y2 = shY + 10 + i * 4.2;
      ctx.moveTo(-9 + i * 0.6, y2); ctx.quadraticCurveTo(-4, y2 + 2.4, -0.6, y2 + 1);
      ctx.moveTo(9 - i * 0.6, y2); ctx.quadraticCurveTo(4, y2 + 2.4, 0.6, y2 + 1);
    }
    ctx.moveTo(0, shY + 6); ctx.lineTo(0, HIP - 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(30,10,12,0.18)';
    ctx.beginPath(); ctx.ellipse(8, (shY + HIP) / 2, 5 * th, 14, 0, 0, 6.2832); ctx.fill();

    // шея
    ctx.fillStyle = G.limbG;
    ctx.beginPath(); ctx.ellipse(hcx + 3, shY - 1, 6, 6, 0, 0, 6.2832); ctx.fill();

    // передняя рука
    const rest = [-12 - sw * 9, abn ? -8 : -22];
    if (g.st === 0 || this.state === 'dying') {
      const hx = rest[0] - 2, hy = rest[1];
      const ex = hx * 0.5 - 4, ey = (shY + hy) / 2;
      ctx.strokeStyle = G.limbG; ctx.lineWidth = 7 * th;
      ctx.beginPath(); ctx.moveTo(-7, shY + 3); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = S; ctx.beginPath(); ctx.ellipse(hx, hy + 1, 4.2, 5, 0, 0, 6.2832); ctx.fill();
    } else {
      const e = g.e, rU = this.reach / (this.h / 100);
      const ang = g.ang - this.lean;   // угол задан в мире — компенсируем наклон корпуса
      const tx = -7 + Math.cos(ang) * rU * e, ty = shY + 3 + Math.sin(ang) * rU * e;
      const hx = (rest[0] - 2) * (1 - e) + tx * e, hy = rest[1] * (1 - e) + ty * e;
      const mx = (-7 + hx) / 2, my = (shY + 3 + hy) / 2 + 4 * (1 - e);
      ctx.strokeStyle = G.limbG; ctx.lineWidth = 8.5 * th;
      ctx.beginPath(); ctx.moveTo(-7, shY + 3); ctx.lineTo(mx, my); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = S; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = D; ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = -1; i <= 2; i++) {
        const aa = ang + i * 0.5;
        ctx.moveTo(hx + Math.cos(aa) * 3, hy + Math.sin(aa) * 3); ctx.lineTo(hx + Math.cos(aa) * 9, hy + Math.sin(aa) * 9);
      }
      ctx.stroke();
      ctx.strokeStyle = '#ff2638'; ctx.lineWidth = 2.6 + 0.8 * Math.sin(time * 30);
      ctx.beginPath(); ctx.arc(hx, hy, 11.5, 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,60,70,0.5)';
      ctx.beginPath(); ctx.arc(hx, hy, 15, 0, 6.2832); ctx.stroke();
    }

    // --- голова ---
    ctx.save();
    if (abn) {
      ctx.translate(hcx, hcy);
      ctx.rotate(Math.sin(time * 23 + this.phase) * 0.07 + (Math.sin(time * 5.3) > 0.85 ? 0.2 : 0));
      ctx.translate(-hcx, -hcy);
    }
    // волосы сзади (пряди)
    if (this.hair >= 1) {
      ctx.strokeStyle = this.hairCol; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      const n = this.hair === 2 ? 9 : 5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = -1.2 + i * 0.3, sx0 = hcx + rx * 0.5 + Math.cos(a) * rx * 0.6, sy0 = hcy + Math.sin(a) * ry * 0.9;
        ctx.moveTo(sx0, sy0);
        ctx.quadraticCurveTo(sx0 + 4 + i, sy0 + 6, sx0 + 4 + i * 1.4 + Math.sin(time * 2 + i) * 1.2, sy0 + (this.hair === 2 ? 22 : 12) - i * 0.5);
      }
      ctx.stroke();
    }
    ctx.fillStyle = G.head;
    ctx.beginPath(); ctx.ellipse(hcx, hcy, rx, ry, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = S; ctx.beginPath(); ctx.ellipse(hcx - rx * 0.1, hcy + ry * 0.55, rx * 0.85, ry * 0.55, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = D; ctx.beginPath(); ctx.ellipse(hcx + rx * 0.75, hcy + 0.5, 1.6, 2.6, 0, 0, 6.2832); ctx.fill(); // ухо
    if (this.hair >= 1) {
      ctx.fillStyle = this.hairCol;
      ctx.beginPath(); ctx.ellipse(hcx + rx * 0.2, hcy - ry * 0.55, rx * 0.95, ry * 0.5, 0, Math.PI, 0); ctx.fill();
    }
    // широкие немигающие глаза с крошечными зрачками
    const ey = hcy - ry * 0.15, ex1 = hcx - rx * 0.55, ex2 = hcx + rx * 0.1;
    const er = 2.1 * Math.min(1.25, hs) * (abn ? 1.2 : 1);
    // глубокие тёмные глазницы
    ctx.fillStyle = 'rgba(28,8,6,0.78)';
    ctx.beginPath();
    ctx.ellipse(ex1, ey + 0.3, er * 1.9, er * 1.5, 0, 0, 6.2832);
    ctx.moveTo(ex2 + er * 1.9, ey + 0.3); ctx.ellipse(ex2, ey + 0.3, er * 1.9, er * 1.5, 0, 0, 6.2832);
    ctx.fill();
    // маленькие тусклые глаза, мёртвый взгляд
    const ew = er * 0.85;
    ctx.fillStyle = '#d8cfb2';
    ctx.beginPath(); ctx.arc(ex1, ey, ew, 0, 6.2832); ctx.moveTo(ex2 + ew, ey); ctx.arc(ex2, ey, ew, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#050303';
    const pxo = this.lookX * ew * 0.45, pyo = this.lookY * ew * 0.4;
    ctx.beginPath(); ctx.arc(ex1 + pxo, ey + pyo, 0.5, 0, 6.2832); ctx.moveTo(ex2 + pxo + 0.5, ey + pyo); ctx.arc(ex2 + pxo, ey + pyo, 0.5, 0, 6.2832); ctx.fill();
    // морщины под глазами
    ctx.strokeStyle = 'rgba(40,14,10,0.55)'; ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ex1 - er * 1.3, ey + er * 1.5); ctx.quadraticCurveTo(ex1, ey + er * 2.3, ex1 + er * 1.3, ey + er * 1.4);
    ctx.moveTo(ex2 - er * 1.3, ey + er * 1.4); ctx.quadraticCurveTo(ex2, ey + er * 2.3, ex2 + er * 1.3, ey + er * 1.5);
    ctx.stroke();
    // тяжёлые надбровья: к переносице вниз, глаза «смотрят исподлобья»
    ctx.strokeStyle = '#1e0d0a'; ctx.lineWidth = 2.3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex1 - er * 1.6, ey - er * 1.9); ctx.lineTo(ex1 + er * 1.2, ey - er * 0.7);
    ctx.moveTo(ex2 + er * 1.6, ey - er * 1.9); ctx.lineTo(ex2 - er * 1.2, ey - er * 0.7);
    ctx.stroke();
    // нос
    ctx.fillStyle = D; ctx.beginPath(); ctx.ellipse(hcx - rx * 0.95, hcy + ry * 0.25, 1.1, 1.8, 0, 0, 6.2832); ctx.fill();
    // безгубая широкая ухмылка с зубами
    const mx0 = hcx - rx * 0.95, mx1 = hcx + rx * 0.6, my0 = hcy + ry * 0.42;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(mx0, my0 - 0.6);
    ctx.quadraticCurveTo((mx0 + mx1) / 2, my0 + ry * 0.75, mx1, my0 - 0.9);
    ctx.quadraticCurveTo((mx0 + mx1) / 2, my0 + ry * 0.2, mx0, my0 - 0.6);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#2a090c'; ctx.fillRect(mx0 - 1, my0 - 2, mx1 - mx0 + 2, ry);
    ctx.fillStyle = '#7a2a28'; // дёсны
    ctx.fillRect(mx0 - 1, my0 - 2.6, mx1 - mx0 + 2, 1.4);
    ctx.fillStyle = '#e4dcc4';
    ctx.fillRect(mx0 - 1, my0 - 2, mx1 - mx0 + 2, ry * 0.2 + 1.2);
    ctx.fillRect(mx0 - 1, my0 + ry * 0.28, mx1 - mx0 + 2, ry * 0.15);
    ctx.fillStyle = '#6a4a42';
    for (let x = mx0; x < mx1; x += (mx1 - mx0) / 10) ctx.fillRect(x, my0 - 2, 0.35, ry * 0.2 + 1.2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(40,12,12,0.7)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(mx0, my0 - 0.6); ctx.quadraticCurveTo((mx0 + mx1) / 2, my0 + ry * 0.75, mx1, my0 - 0.9); ctx.stroke();
    ctx.restore();   // голова
    ctx.restore();   // корпус
  }

  drawDummy(ctx) {
    const W = '#a8794a', DK = '#6b4a2e', OL = '#4a2e1a';
    // столб
    ctx.fillStyle = DK; ctx.fillRect(-3, -62, 6, 62);
    ctx.fillStyle = '#3a2412'; ctx.fillRect(-9, -3, 18, 3);
    // тело из досок
    ctx.fillStyle = W; ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(2, -58, 15, 18, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-1, -82, 14, 14, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
    // руки-обрубки
    ctx.beginPath(); ctx.rect(-26, -70, 22, 6); ctx.rect(10, -70, 18, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(60,30,10,0.35)';
    for (let i = -14; i < 18; i += 6) ctx.fillRect(i, -74, 0.8, 34);
    ctx.fillStyle = DK; ctx.fillRect(-14, -52, 32, 3);
    // нарисованное лицо
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath(); ctx.arc(-9, -85, 2.6, 0, 6.2832); ctx.arc(-3, -85, 2.6, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-9, -85, 1.1, 0, 6.2832); ctx.arc(-3, -85, 1.1, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#8a1a1a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-13, -78); ctx.quadraticCurveTo(-7, -71, 0, -78); ctx.stroke();
    // мишень на затылке
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#d0262e';
      ctx.beginPath(); ctx.arc(13, -72, 7 - i * 2.3, 0, 6.2832); ctx.fill();
    }
  }
}
