import { T } from './tuning.js';
import { mulberry, mkCanvas, rrect } from './util.js';

const GROUND = T.groundY;

function makeSky(level, W, H) {
  const c = mkCanvas(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H * 0.9);
  for (const [p, col] of level.sky.stops) gr.addColorStop(p, col);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const [sx, sy, sr] = level.sky.sun;
  let rg = g.createRadialGradient(sx, sy, 0, sx, sy, 460);
  rg.addColorStop(0, 'rgba(255,236,190,0.95)');
  rg.addColorStop(0.15, 'rgba(255,200,120,0.55)');
  rg.addColorStop(0.5, 'rgba(255,140,80,0.18)');
  rg.addColorStop(1, 'rgba(255,120,60,0)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff4cf';
  g.beginPath(); g.arc(sx, sy, sr, 0, 6.2832); g.fill();
  // тонкие полосы облаков
  const rng = mulberry(level.seed * 7);
  for (let i = 0; i < 9; i++) {
    const y = 120 + rng() * 360, x = rng() * W, w = 200 + rng() * 380;
    const lg = g.createLinearGradient(x, 0, x + w, 0);
    lg.addColorStop(0, 'rgba(255,190,140,0)');
    lg.addColorStop(0.5, 'rgba(255,190,140,0.16)');
    lg.addColorStop(1, 'rgba(255,190,140,0)');
    g.fillStyle = lg; g.fillRect(x, y, w, 6 + rng() * 9);
  }
  return c;
}

function makeCloud() {
  const c = mkCanvas(340, 120), g = c.getContext('2d');
  const puffs = [[80, 70, 50], [140, 56, 58], [205, 64, 52], [260, 76, 40], [110, 82, 44], [190, 84, 46]];
  for (const [x, y, r] of puffs) {
    const rg = g.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,214,170,0.55)');
    rg.addColorStop(0.7, 'rgba(240,150,120,0.28)');
    rg.addColorStop(1, 'rgba(220,120,110,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  return c;
}

function makeLayer(level, f, hl, base, painter, seed) {
  const w = Math.ceil(level.width * f + 1700 / Math.min(1, level.zoom || 1) + 200);
  const c = mkCanvas(w, hl), g = c.getContext('2d');
  painter(g, w, hl, mulberry(seed), base);
  return { c, f, h: hl, base };
}

function paintFarWall(g, w, h, rng, base) {
  const top = h - 250;
  const gr = g.createLinearGradient(0, top, 0, h);
  gr.addColorStop(0, base); gr.addColorStop(1, '#6a4560');
  g.fillStyle = gr; g.fillRect(0, top, w, 250);
  g.fillStyle = base;
  for (let x = 0; x < w; x += 46) g.fillRect(x, top - 14, 26, 15);
  g.fillStyle = 'rgba(60,20,50,0.18)';
  for (let y = top + 30; y < h; y += 32) g.fillRect(0, y, w, 2);
  for (let x = 300; x < w; x += 600 + rng() * 400) {
    g.fillStyle = base; g.fillRect(x, top - 60, 64, 70);
    for (let i = 0; i < 4; i++) g.fillRect(x + i * 18, top - 74, 12, 15);
  }
}

function paintCity(g, w, h, rng, base) {
  let x = 0;
  while (x < w) {
    const bw = 36 + rng() * 70, bh = 50 + rng() * 150;
    g.fillStyle = base;
    g.fillRect(x, h - bh, bw, bh);
    if (rng() < 0.35) { // шпиль
      const tw = 20 + rng() * 10;
      g.beginPath(); g.moveTo(x + bw / 2 - tw / 2, h - bh);
      g.lineTo(x + bw / 2, h - bh - 40 - rng() * 40); g.lineTo(x + bw / 2 + tw / 2, h - bh); g.fill();
    } else if (rng() < 0.5) {
      g.beginPath(); g.moveTo(x - 3, h - bh); g.lineTo(x + bw / 2, h - bh - 20 - rng() * 22); g.lineTo(x + bw + 3, h - bh); g.fill();
    }
    x += bw + rng() * 8;
  }
  g.fillRect(0, h - 4, w, 4);
}

function paintMid(g, w, h, rng, base) {
  let x = 0;
  while (x < w) {
    const bw = 70 + rng() * 80, bh = 60 + rng() * 90;
    const roof = rng() < 0.5 ? '#5a2830' : '#6a3030';
    g.fillStyle = base; g.fillRect(x, h - bh, bw, bh);
    g.fillStyle = roof;
    g.beginPath(); g.moveTo(x - 6, h - bh); g.lineTo(x + bw / 2, h - bh - 30 - rng() * 30); g.lineTo(x + bw + 6, h - bh); g.fill();
    g.fillStyle = 'rgba(255,196,107,0.8)';
    for (let i = 0; i < 3; i++) if (rng() < 0.35) g.fillRect(x + 12 + i * 24, h - bh + 18 + rng() * 30, 7, 10);
    if (rng() < 0.16) { // башня церкви
      const tx = x + bw, th = 170 + rng() * 60;
      g.fillStyle = base; g.fillRect(tx, h - th, 32, th);
      g.fillStyle = roof;
      g.beginPath(); g.moveTo(tx - 4, h - th); g.lineTo(tx + 16, h - th - 56); g.lineTo(tx + 36, h - th); g.fill();
      x += 34;
    }
    x += bw + 6 + rng() * 14;
  }
  g.fillStyle = base; g.fillRect(0, h - 6, w, 6);
}

// ---------- здания ----------
const WALLS = ['#5b3a3a', '#6a4538', '#4d3a48', '#6b5040', '#583a44'];
const ROOFS = ['#a9432f', '#8e3a2c', '#b5563a', '#9a3d38'];

function makeBuilding(x, w, h, rng) {
  const y = GROUND - h;
  const PAD = 6, TOP = 56;
  const c = mkCanvas(w + PAD * 2, h + TOP), g = c.getContext('2d');
  const wallC = WALLS[(rng() * WALLS.length) | 0], roofC = ROOFS[(rng() * ROOFS.length) | 0];
  const bx = PAD, by = TOP;
  const gr = g.createLinearGradient(0, by, 0, by + h);
  gr.addColorStop(0, wallC); gr.addColorStop(1, '#2a1822');
  g.fillStyle = gr; g.fillRect(bx, by, w, h);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(bx + w * 0.72, by, w * 0.28, h);
  g.fillStyle = 'rgba(255,170,100,0.14)'; g.fillRect(bx, by, w * 0.12, h);
  // окна
  const cols = Math.max(1, Math.floor((w - 16) / 34)), rows = Math.max(1, Math.floor((h - 70) / 48));
  for (let r = 0; r < rows; r++) {
    for (let cI = 0; cI < cols; cI++) {
      const wx = bx + 10 + cI * ((w - 20) / cols) + 4, wy = by + 34 + r * 48;
      const lit = rng() < 0.35;
      g.fillStyle = lit ? '#ffc46b' : '#2a1a24';
      g.fillRect(wx, wy, 16, 24);
      g.fillStyle = 'rgba(40,20,20,0.7)';
      g.fillRect(wx + 7, wy, 2, 24); g.fillRect(wx, wy + 11, 16, 2);
      if (lit) { g.fillStyle = 'rgba(255,196,107,0.18)'; g.fillRect(wx - 3, wy - 3, 22, 30); }
    }
  }
  // дверь
  g.fillStyle = '#2a1812';
  g.beginPath(); g.moveTo(bx + w / 2 - 12, by + h); g.lineTo(bx + w / 2 - 12, by + h - 26);
  g.arc(bx + w / 2, by + h - 26, 12, Math.PI, 0); g.lineTo(bx + w / 2 + 12, by + h); g.fill();
  // крыша: плоская кромка + черепица
  g.fillStyle = roofC; g.fillRect(bx - PAD, by - 2, w + PAD * 2, 18);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let tx = bx - PAD; tx < bx + w + PAD; tx += 12) g.fillRect(tx, by + 8, 6, 8);
  g.fillStyle = 'rgba(255,200,150,0.35)'; g.fillRect(bx - PAD, by - 2, w + PAD * 2, 3);
  // декор над крышей
  const d = rng();
  if (d < 0.4) { // труба
    g.fillStyle = '#4a2a2a'; g.fillRect(bx + w * 0.7, by - 30, 14, 30);
    g.fillStyle = '#2f1a1a'; g.fillRect(bx + w * 0.7 - 2, by - 34, 18, 6);
  } else if (d < 0.65) { // башенка с шпилем
    g.fillStyle = wallC; g.fillRect(bx + w * 0.3, by - 22, 26, 22);
    g.fillStyle = roofC;
    g.beginPath(); g.moveTo(bx + w * 0.3 - 4, by - 22); g.lineTo(bx + w * 0.3 + 13, by - 54); g.lineTo(bx + w * 0.3 + 30, by - 22); g.fill();
  }
  return { x, y, w, h, img: c, ix: x - PAD, iy: y - TOP, solid: true };
}

function makeStone(w, h, seed) {
  const M = 30;
  const c = mkCanvas(w, h + M), g = c.getContext('2d');
  const rng = mulberry(seed);
  const gr = g.createLinearGradient(0, 0, 0, h + M);
  gr.addColorStop(0, '#c9b49a'); gr.addColorStop(0.4, '#a89580'); gr.addColorStop(1, '#6f5f58');
  g.fillStyle = gr; g.fillRect(0, M, w, h);
  for (let x = 0; x < w; x += 62) { g.fillStyle = '#c4af95'; g.fillRect(x, 0, 38, M + 2); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 30, 2, 8, M); }
  g.strokeStyle = 'rgba(60,40,40,0.35)'; g.lineWidth = 2;
  let off = 0;
  for (let y = M + 36; y < h + M; y += 36) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    off = off ? 0 : 30;
    for (let x = off; x < w; x += 60 + ((rng() * 14) | 0)) { g.beginPath(); g.moveTo(x, y - 36); g.lineTo(x, y); g.stroke(); }
  }
  const og = g.createLinearGradient(0, M, 0, M + 300);
  og.addColorStop(0, 'rgba(255,160,80,0.28)'); og.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = og; g.fillRect(0, M, w, 300);
  return { c, M };
}

export function createWorld(level, W) {
  const rng = mulberry(level.seed);
  const solids = [];
  const dummyXs = level.spawns.filter((s) => s.kind === 'dummy').map((s) => s.x);

  let x = level.firstBuildingX;
  while (x < level.buildingsEnd) {
    const w = 110 + ((rng() * 80) | 0);
    let h = 190 + ((rng() * 150) | 0);
    if (level.towers && rng() < 0.25) h = 400 + ((rng() * 90) | 0);   // редкие высокие башни
    let bad = false;
    for (const dx of dummyXs) if (x + w > dx - 120 && x < dx + 120) { x = dx + 120; bad = true; break; }
    if (bad) continue;
    solids.push(makeBuilding(x, w, h, rng));
    x += w + 200 + rng() * 120;
  }
  const buildings = solids.slice();

  // левая стена
  const wallTop = 150;
  const leftStone = makeStone(570, GROUND + 70 - wallTop, 5);
  const leftWall = { x: -400, y: wallTop, w: 570, h: 720 - wallTop, solid: true, wall: true };
  solids.push(leftWall);

  let rightWall = null, rightStone = null;
  if (level.rightWall) {
    const rw = level.rightWall;
    rightStone = makeStone(rw.w, 720 - rw.top, 9);
    rightWall = { x: rw.x, y: rw.top, w: rw.w, h: 720 - rw.top, solid: true, wall: true };
    solids.push(rightWall);
  }

  const sky = makeSky(level, W, 720);
  const cloud = makeCloud();
  const layers = [
    makeLayer(level, 0.1, 320, level.cols[0], paintFarWall, level.seed + 1),
    makeLayer(level, 0.22, 260, level.cols[1], paintCity, level.seed + 2),
    makeLayer(level, 0.45, 300, level.cols[2], paintMid, level.seed + 3),
  ];
  layers[0].fy = 0.15; layers[1].fy = 0.3; layers[2].fy = 0.55;

  const clouds = [];
  for (let i = 0; i < 7; i++) clouds.push({ x: rng() * (W + 400), y: 60 + rng() * 260, s: 0.6 + rng() * 0.9, sp: 4 + rng() * 8 });

  const embers = [];
  if (level.embers) for (let i = 0; i < 55; i++) embers.push({ x: rng() * W, y: rng() * 720, v: 20 + rng() * 40, s: 1 + rng() * 2.2, ph: rng() * 6.28 });

  return {
    solids, buildings, leftWall, rightWall, level,
    updateAmbient(dt) {
      for (const e of embers) {
        e.y -= e.v * dt; e.x += Math.sin(e.ph + e.y * 0.02) * 18 * dt - 6 * dt;
        if (e.y < -10) { e.y = 730; e.x = Math.random() * W; }
        if (e.x < -10) e.x = W + 10;
      }
    },
    drawBackground(ctx, camX, camY, zoom, t) {
      ctx.drawImage(sky, 0, 0);
      for (const c of clouds) {
        const px = (((c.x + t * c.sp - camX * 0.05) % (W + 500)) + W + 500) % (W + 500) - 250;
        ctx.drawImage(cloud, px, c.y, 340 * c.s, 120 * c.s);
      }
      for (const L of layers) {
        const lx = -camX * L.f * zoom;
        const ly = (720 - L.h - camY * L.fy) * zoom;
        ctx.drawImage(L.c, lx, ly, L.c.width * zoom, L.c.height * zoom);
        ctx.fillStyle = L.base;
        const by = ly + L.h * zoom - 1;
        if (by < 720) ctx.fillRect(0, by, W, 720 - by);
      }
    },
    drawGround(ctx, camX, viewW) {
      const gr = ctx.createLinearGradient(0, GROUND, 0, GROUND + 90);
      gr.addColorStop(0, '#5a3430'); gr.addColorStop(1, '#2a1620');
      ctx.fillStyle = gr; ctx.fillRect(camX - 20, GROUND, viewW + 40, 2200);
      ctx.fillStyle = '#7a4a40'; ctx.fillRect(camX - 20, GROUND, viewW + 40, 4);
      ctx.fillStyle = 'rgba(20,8,14,0.35)';
      const st = Math.floor(camX / 90) * 90;
      for (let gx = st; gx < camX + viewW + 90; gx += 90) ctx.fillRect(gx + ((gx * 7) % 40), GROUND + 14 + ((gx * 3) % 30), 38, 5);
    },
    drawBuildings(ctx, camX, viewW) {
      for (const b of buildings) {
        if (b.ix + b.img.width < camX - 10 || b.ix > camX + viewW + 10) continue;
        ctx.drawImage(b.img, b.ix, b.iy);
      }
    },
    drawWalls(ctx, camX, viewW, lost) {
      if (camX < 200) {
        ctx.drawImage(leftStone.c, leftWall.x, leftWall.y - leftStone.M);
        // трещины и обломки
        ctx.strokeStyle = 'rgba(40,20,20,0.7)'; ctx.lineWidth = 3;
        for (let i = 0; i < lost; i++) {
          const cx = 130 - i * 8, cy = 330 + i * 120;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 24, cy + 30); ctx.lineTo(cx - 6, cy + 54);
          ctx.lineTo(cx - 40, cy + 90); ctx.moveTo(cx - 24, cy + 30); ctx.lineTo(cx - 60, cy + 40); ctx.stroke();
        }
        // знамя Разведкорпуса
        ctx.fillStyle = '#2f5a3a'; ctx.fillRect(70, 160, 40, 110);
        ctx.fillStyle = '#e9e3d2'; ctx.beginPath(); ctx.moveTo(78, 200); ctx.lineTo(102, 190); ctx.lineTo(96, 212); ctx.lineTo(80, 216); ctx.fill();
        ctx.fillStyle = '#2d4a8c'; ctx.beginPath(); ctx.moveTo(102, 200); ctx.lineTo(78, 190); ctx.lineTo(84, 212); ctx.lineTo(100, 216); ctx.fill();
      }
      if (rightWall && rightWall.x < camX + viewW + 20) {
        ctx.drawImage(rightStone.c, rightWall.x, rightWall.y - rightStone.M);
      }
    },
    drawEmbers(ctx) {
      if (!embers.length) return;
      ctx.fillStyle = '#ffb347';
      for (const e of embers) {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(e.ph + e.y * 0.05);
        ctx.fillRect(e.x, e.y, e.s, e.s);
      }
      ctx.globalAlpha = 1;
    },
  };
}
