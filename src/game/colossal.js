import { T } from './tuning.js';
import { rand, mkCanvas } from './util.js';

const SEQ = [
  ['idle', 2.0], ['expose', 4.0], ['idle', 1.0], ['telegraph', 1.2], ['steam', 2.5], ['idle', 1.5],
];

function muscle(ctx, cx, cy, rx, ry, light, dark) {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.2832); ctx.clip();
  const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 10, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, light); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.strokeStyle = 'rgba(50,4,8,0.6)'; ctx.lineWidth = 4;
  for (let k = -4; k <= 4; k++) {
    ctx.beginPath();
    ctx.moveTo(cx + k * rx * 0.24, cy - ry);
    ctx.quadraticCurveTo(cx + k * rx * 0.42, cy, cx + k * rx * 0.2, cy + ry);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,170,140,0.25)'; ctx.lineWidth = 2;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath();
    ctx.moveTo(cx + k * rx * 0.24 + 6, cy - ry * 0.9);
    ctx.quadraticCurveTo(cx + k * rx * 0.42 + 6, cy, cx + k * rx * 0.2 + 6, cy + ry * 0.9);
    ctx.stroke();
  }
  const sh = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(20,0,6,0.55)');
  ctx.fillStyle = sh; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.restore();
}


const LI = '#d24a3a', DK = '#74201e';
let BODY = null, HEAD = null, GLOW = null;
// тело и голова рисуются один раз в offscreen (локальные координаты относительно cx / центра головы)
function bake() {
  if (BODY) return;
  BODY = mkCanvas(960, 620); HEAD = mkCanvas(380, 440); GLOW = mkCanvas(120, 120);
  let g = BODY.getContext('2d');
  g.translate(480, 0);               // x=0 -> cx ; y -> мировой y - 100
  g.translate(0, -100);
  muscle(g, 0, 430, 330, 210, LI, DK);
  muscle(g, -240, 400, 100, 120, LI, DK);
  muscle(g, 310, 400, 100, 120, LI, DK);
  muscle(g, -10, 290, 100, 85, '#b94232', DK);
  // трещины-сухожилия
  g.strokeStyle = 'rgba(30,0,4,0.55)'; g.lineWidth = 3;
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 70, 330); g.quadraticCurveTo(i * 70 + 14, 420, i * 55, 560); g.stroke(); }
  g = HEAD.getContext('2d');
  g.translate(190, 230);
  muscle(g, 0, 0, 150, 175, LI, DK);
  g.strokeStyle = '#3a0508'; g.lineWidth = 14; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-135, -52); g.lineTo(-70, -72); g.moveTo(-60, -72); g.lineTo(10, -56); g.stroke();
  for (const ex of [-100, -34]) {
    g.fillStyle = '#120204'; g.beginPath(); g.ellipse(ex, -28, 30, 19, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#ffe9a0'; g.beginPath(); g.ellipse(ex, -28, 18, 9, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex - 2, -29, 8, 4, 0, 0, 6.2832); g.fill();
  }
  g.fillStyle = '#2a0508'; g.beginPath(); g.ellipse(-128, 28, 8, 14, 0, 0, 6.2832); g.fill();
  const mx = -66, my = 104;
  g.fillStyle = '#1c0508'; g.beginPath(); g.ellipse(mx, my, 90, 40, 0, 0, 6.2832); g.fill();
  g.fillStyle = '#f0ebdc';
  for (let i = 0; i < 13; i++) {
    const tx = mx - 82 + i * 13.5, dyv = Math.sqrt(Math.max(0, 1 - Math.pow((tx - mx) / 90, 2))) * 38;
    g.fillRect(tx, my - dyv + 2, 11, 19); g.fillRect(tx, my + dyv - 21, 11, 19);
  }
  g.strokeStyle = '#c8bfae'; g.lineWidth = 2; g.beginPath(); g.ellipse(mx, my, 90, 40, 0, 0, 6.2832); g.stroke();
  g = GLOW.getContext('2d');
  const rg = g.createRadialGradient(60, 60, 2, 60, 60, 58);
  rg.addColorStop(0, 'rgba(255,255,220,1)'); rg.addColorStop(0.3, 'rgba(255,200,80,0.7)'); rg.addColorStop(1, 'rgba(255,100,20,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 120, 120);
}

export class Colossal {
  constructor(cx, cy = 80) {
    this.cx = cx; this.cy = cy;
    this.hp = 3; this.maxHp = 3;
    this.si = 0; this.state = 'idle'; this.st = SEQ[0][1];
    this.lean = 0; this.invuln = 0; this.hitFlash = 0;
    this.napeOn = false; this.nx = 0; this.ny = 0; this.nr = 75;
    this.t = 0; this.deathT = 0; this.finished = false;
    this.zone = { x: cx - 130, y: cy + 130, r: 440 };
    this.hx = cx; this.hy = cy;
    this.updatePos();
  }

  get dead() { return this.state === 'dead'; }

  updatePos() {
    const L = this.lean;
    this.hx = this.cx - 80 * L;
    this.hy = this.cy + 40 * L + Math.sin(this.t * 1.2) * 3;
    this.nx = this.hx + 100; this.ny = this.hy + 140;
  }

  contains(px, py, pad) {
    const dx = (px - this.hx) / (150 + pad), dy = (py - this.hy) / (175 + pad);
    if (dx * dx + dy * dy < 1) return true;
    return px > this.cx - 230 - pad && px < this.cx + 300 + pad && py > 250 - pad && py < 440;
  }

  advance(G) {
    this.si = (this.si + 1) % SEQ.length;
    this.state = SEQ[this.si][0]; this.st = SEQ[this.si][1];
    if (this.state === 'telegraph') { G.play('steam'); G.shake(6); }
    if (this.state === 'steam') { G.play('steam'); G.shake(10); }
  }

  hit(G) {
    this.hp--; this.invuln = 1.4; this.hitFlash = 1;
    if (this.hp <= 0) { this.state = 'dead'; this.deathT = 0; this.napeOn = false; return true; }
    this.si = 2; this.state = 'idle'; this.st = 1.8;
    return false;
  }

  update(dt, G) {
    this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt * 2;
    if (this.state === 'dead') {
      this.deathT += dt;
      this.lean += (1.2 - this.lean) * (1 - Math.exp(-1.5 * dt));
      this.updatePos();
      if (Math.random() < dt * 60) G.particles.steam(this.cx + rand(-250, 250), rand(60, 420), 1, 120, 200, 40);
      if (this.deathT > 5) this.finished = true;
      return;
    }
    if (this.invuln > 0) this.invuln -= dt;
    this.st -= dt;
    if (this.st <= 0) this.advance(G);
    const target = this.state === 'expose' ? 1 : 0;
    this.lean += (target - this.lean) * (1 - Math.exp(-4 * dt));
    this.updatePos();
    if (Math.random() < dt * 9) G.particles.steam(this.cx + rand(-280, 280), rand(120, 400), 1, 40, 110, 28);
    this.napeOn = this.state === 'expose' && this.lean > 0.7 && this.invuln <= 0;

    if (this.state === 'telegraph') {
      if (Math.random() < dt * 25) G.particles.steam(this.cx + rand(-200, 150), rand(80, 400), 1, 50, 120, 18);
    } else if (this.state === 'steam') {
      const n = dt * 150;
      const z = this.zone;
      for (let i = 0; i < n + Math.random(); i++) {
        const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * z.r;
        G.particles.steam(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r * 0.8, 1, 120, 60, 34);
      }
      const p = G.player, dx = p.x - z.x, dy = (p.y - 32) - z.y;
      if (dx * dx + dy * dy < z.r * z.r && G.canHurt()) G.hurtPlayer(z.x, z.y, 1.6);
    }
  }

  draw(ctx) {
    bake();
    const cx = this.cx, t = this.t, hx = this.hx, hy = this.hy;
    const dying = this.state === 'dead';
    const alpha = dying ? Math.max(0, 1 - Math.max(0, this.deathT - 2) / 2.5) : 1;
    const tele = this.state === 'telegraph';
    const glow = tele ? 0.35 + 0.35 * Math.sin(t * 20) : (this.state === 'steam' ? 0.25 : 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(BODY, cx - 480, 100);
    ctx.drawImage(HEAD, hx - 190, hy - 230);
    // светящиеся глаза
    ctx.globalCompositeOperation = 'lighter';
    const ep = 0.7 + 0.3 * Math.sin(t * 3) + (tele ? 0.4 : 0);
    ctx.globalAlpha = alpha * Math.min(1, ep);
    for (const ex of [-100, -34]) ctx.drawImage(GLOW, hx + ex - 52, hy - 28 - 52, 104, 104);
    ctx.globalAlpha = alpha;
    if (glow > 0) {
      ctx.fillStyle = `rgba(255,140,60,${glow * 0.5})`;
      ctx.beginPath(); ctx.ellipse(hx, hy, 150, 175, 0, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, 430, 310, 200, 0, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.hitFlash * 0.8})`;
      ctx.beginPath(); ctx.ellipse(hx, hy, 150, 175, 0, 0, 6.2832); ctx.fill();
    }
    ctx.restore();

    // зона пара
    const z = this.zone;
    if (tele) {
      ctx.save();
      ctx.setLineDash([18, 14]); ctx.lineDashOffset = -t * 40;
      ctx.strokeStyle = `rgba(255,90,60,${0.55 + 0.35 * Math.sin(t * 16)})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.2832); ctx.stroke();
      ctx.restore();
    } else if (this.state === 'steam') {
      const k = Math.min(1, this.st / 2.5);
      const g = ctx.createRadialGradient(z.x, z.y, 40, z.x, z.y, z.r);
      g.addColorStop(0, `rgba(255,255,255,${0.42 * (0.6 + 0.4 * k)})`);
      g.addColorStop(1, 'rgba(255,255,255,0.05)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.2832); ctx.fill();
    }

    // слабое место
    if (this.napeOn) {
      const pu = 0.5 + 0.5 * Math.sin(t * 7);
      const r = 46 + pu * 14;
      const g = ctx.createRadialGradient(this.nx, this.ny, 3, this.nx, this.ny, r + 20);
      g.addColorStop(0, 'rgba(255,250,210,0.95)'); g.addColorStop(0.4, 'rgba(255,190,70,0.8)'); g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.nx, this.ny, r + 20, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = `rgba(255,235,160,${0.6 + pu * 0.4})`; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(this.nx, this.ny, this.nr - pu * 8, 0, 6.2832); ctx.stroke();
    }
  }
}
