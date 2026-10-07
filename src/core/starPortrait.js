// Портрет из звёзд: фотографический «штрих-звёздный» сэмплинг (плотность ~ яркость кожи).

const WARM = [255, 240, 220];
const HAIR_RGB = [150, 165, 255];
export const SAMPLE_W = 240;

// Параметры анатомии в долях кропа (подобраны под фото bema.jpg, crop 250,320,440,540)
const HEAD = { cx: 0.43, cy: 0.485, rxL: 0.43, rxR: 0.43, ry: 0.455 };   // внешний эллипс: голова + волосы
const FACE = { cx: 0.545, cy: 0.575, rx: 0.25, ry: 0.28 };                // внутренний эллипс лица (не фон)

const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Общий анализ: яркость, маска «не фон», флаг волос
export function analyzePortrait(img, crop, sw = SAMPLE_W) {
  const sh = Math.max(1, Math.round(sw * crop.h / crop.w));
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, sw, sh);
  const px = g.getImageData(0, 0, sw, sh).data;
  const n = sw * sh;
  const L = new Float32Array(n), mask = new Float32Array(n), hair = new Uint8Array(n), inFace = new Float32Array(n);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = y * sw + x, u = x / sw, v = y / sh;
    const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2];
    const l = (0.299 * r + 0.587 * gg + 0.114 * b) / 255;
    L[i] = l;
    const rx = u < HEAD.cx ? HEAD.rxL : HEAD.rxR;
    const dd = Math.hypot((u - HEAD.cx) / rx, (v - HEAD.cy) / HEAD.ry);
    let m = 1 - sstep(0.66, 1.0, dd);
    const df = Math.hypot((u - FACE.cx) / FACE.rx, (v - FACE.cy) / FACE.ry);
    inFace[i] = 1 - sstep(0.85, 1.05, df);
    // очень светлый малонасыщенный фон вне внутреннего лица
    const sat = (Math.max(r, gg, b) - Math.min(r, gg, b)) / 255;
    const bgLike = sstep(0.6, 0.78, l) * (1 - sstep(0.10, 0.24, sat));
    m *= 1 - bgLike * (1 - inFace[i]);
    mask[i] = m;
    // волосы: тёмное, вне лица, выше глаз или слева (пряди)
    if (m > 0.3 && l < 0.26 && inFace[i] < 0.5 && (v < 0.5 || u < 0.34)) hair[i] = 1;
  }
  return { sw, sh, px, L, mask, hair, inFace };
}

function percentile(vals, p) {
  const a = Float32Array.from(vals).sort();
  return a[Math.min(a.length - 1, Math.floor(a.length * p))];
}

export function buildStarTargets(img, crop, opts = {}) {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
  const maxStars = opts.maxStars || (coarse ? 3500 : 6000);
  const cx = opts.cx ?? 640, cy = opts.cy ?? 330, height = opts.height ?? 500;

  const { sw, sh, px, L, mask, hair, inFace } = analyzePortrait(img, crop);

  // контраст-стретч по 5/95 перцентилям внутри маски лица
  const inside = [];
  for (let i = 0; i < sw * sh; i++) if (mask[i] > 0.5) inside.push(L[i]);
  const lo = percentile(inside, 0.05), hi = percentile(inside, 0.95);
  const Ls = new Float32Array(sw * sh);
  for (let i = 0; i < Ls.length; i++) Ls[i] = Math.pow(Math.min(1, Math.max(0, (L[i] - lo) / Math.max(1e-3, hi - lo))), 1.3);

  // слабый край (Собель по растянутой яркости)
  const E = new Float32Array(sw * sh);
  let emax = 1e-6;
  for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
    const i = y * sw + x;
    const gx = -Ls[i - sw - 1] - 2 * Ls[i - 1] - Ls[i + sw - 1] + Ls[i - sw + 1] + 2 * Ls[i + 1] + Ls[i + sw + 1];
    const gy = -Ls[i - sw - 1] - 2 * Ls[i - sw] - Ls[i - sw + 1] + Ls[i + sw - 1] + 2 * Ls[i + sw] + Ls[i + sw + 1];
    const e = Math.hypot(gx, gy); E[i] = e; if (e > emax) emax = e;
  }
  const En = new Float32Array(sw * sh);
  for (let i = 0; i < En.length; i++) En[i] = Math.min(1, (E[i] / emax) * 2.0);

  // плотность на пиксель
  const dens = new Float32Array(sw * sh);
  for (let i = 0; i < dens.length; i++) {
    if (hair[i]) { dens[i] = 0.38 * mask[i]; continue; }
    dens[i] = (0.75 * Ls[i] + 0.25 * En[i] * (0.4 + 0.6 * mask[i])) * mask[i];
  }

  // сетка с джиттером: одна кандидатура на ячейку
  const CS = 2;
  const gw = Math.ceil(sw / CS), gh = Math.ceil(sh / CS);
  const cells = [];
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let d = 0, cnt = 0, hcnt = 0, ri = 0, gi = 0, bi = 0, e = 0;
    for (let yy = gy * CS; yy < Math.min(sh, gy * CS + CS); yy++) for (let xx = gx * CS; xx < Math.min(sw, gx * CS + CS); xx++) {
      const i = yy * sw + xx; d += dens[i]; cnt++; hcnt += hair[i]; e += En[i];
      ri += px[i * 4]; gi += px[i * 4 + 1]; bi += px[i * 4 + 2];
    }
    d /= cnt;
    if (d < 0.01) continue;
    cells.push({ gx, gy, d, hair: hcnt * 2 > cnt, r: ri / cnt, g: gi / cnt, b: bi / cnt, e: e / cnt });
  }
  // подбираем k, чтобы ожидаемое число звёзд ≈ maxStars
  let k = 1, klo = 0, khi = 50;
  for (let it = 0; it < 24; it++) {
    k = (klo + khi) / 2;
    let sum = 0; for (const c of cells) sum += Math.min(1, c.d * k);
    if (sum > maxStars) khi = k; else klo = k;
  }

  const stars = [];
  const scale = height / sh;
  const ox = cx - (sw * scale) / 2, oy = cy - height / 2;
  for (const c of cells) {
    const p = Math.min(1, c.d * k);
    if (Math.random() > p) continue;
    const x = (c.gx + 0.1 + Math.random() * 0.8) * CS, y = (c.gy + 0.1 + Math.random() * 0.8) * CS;
    let r, g, b, size, score, bucket;
    if (c.hair) {
      r = HAIR_RGB[0]; g = HAIR_RGB[1]; b = HAIR_RGB[2];
      size = 0.55 + Math.random() * 0.45; score = 0.05; bucket = 8;
    } else {
      r = c.r * 0.65 + WARM[0] * 0.35; g = c.g * 0.65 + WARM[1] * 0.35; b = c.b * 0.65 + WARM[2] * 0.35;
      score = Math.min(1, c.d * 1.2);
      size = 0.5 + score * 1.1 + c.e * 0.3;
      if (r - g > 40) bucket = 9; // губы
    }
    stars.push({ x: ox + x * scale, y: oy + y * scale, size, r: r | 0, g: g | 0, b: b | 0, score, bucket });
  }
  return stars;
}

// Фото для подложки: кроп, обрезанный той же маской, что и звёзды (совпадает по геометрии)
export function makePortraitPhoto(img, crop, w, h) {
  const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h);
  const g = c.getContext('2d');
  g.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height);
  const { sw, sh, mask, hair } = analyzePortrait(img, crop);
  const mc = document.createElement('canvas'); mc.width = sw; mc.height = sh;
  const mg = mc.getContext('2d'); const id = mg.createImageData(sw, sh);
  for (let i = 0; i < sw * sh; i++) { id.data[i * 4 + 3] = Math.round(255 * Math.pow(mask[i], 1.6)); }
  void hair;
  mg.putImageData(id, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.drawImage(mc, 0, 0, c.width, c.height);
  return c;
}

// --- спрайты свечения ---
export function makeGlowSprite(radius, color = [255, 255, 255]) {
  const d = Math.ceil(radius * 2);
  const c = document.createElement('canvas'); c.width = c.height = d;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  const rgb = `${color[0]},${color[1]},${color[2]}`;
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.18, `rgba(${rgb},0.75)`);
  gr.addColorStop(0.45, `rgba(${rgb},0.2)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, d, d);
  return c;
}

// 8 цветовых корзин (от холодного белого к тёплому золотому)
const BUCKET_COLORS = [
  [255, 255, 255], [255, 248, 235], [255, 240, 220], [255, 232, 200],
  [255, 224, 180], [250, 214, 160], [235, 205, 170], [220, 215, 235], [140, 160, 255], [255, 165, 185]
];
let buckets = null;
function getBuckets() {
  if (!buckets) buckets = BUCKET_COLORS.map((col) => makeGlowSprite(16, col));
  return buckets;
}
export function bucketOf(s) {
  // по цвету звезды: тёплые -> ближе к золотым, холодные -> к последним
  const t = (s.r - s.b) / 80; // 0..~1
  const i = Math.round(Math.max(0, Math.min(1, t)) * 5);
  return s.bucket ?? (s.bucket = i);
}

// alphaFn(star, index) -> 0..1 ; или null для 1. Масштаб: size звезды * 5 => диаметр свечения
export function drawStars(ctx, stars, alphaFn, sizeMul = 1) {
  const B = getBuckets();
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const a = alphaFn ? alphaFn(s, i) : 1;
    if (a <= 0.01) continue;
    const d = s.size * 5 * sizeMul * (s.pulse || 1);
    ctx.globalAlpha = a > 1 ? 1 : a;
    ctx.drawImage(B[bucketOf(s)], (s.dx ?? s.x) - d / 2, (s.dy ?? s.y) - d / 2, d, d);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

// Для сцены: общий помощник — звёзды получают поля для анимации прилёта
export function initFlight(stars, W, H, rnd = Math.random) {
  for (const s of stars) {
    const ang = rnd() * Math.PI * 2, dist = 0.7 + rnd() * 0.9;
    s.sx = W / 2 + Math.cos(ang) * W * dist; s.sy = H / 2 + Math.sin(ang) * H * dist;
    s.delay = rnd() * 1.8; s.dur = 1.6 + rnd() * 1.0;
    s.curve = (rnd() - 0.5) * 260; s.phase = rnd() * Math.PI * 2;
    s.dx = s.sx; s.dy = s.sy; s.pulse = 1;
  }
}

const eo = (t) => 1 - Math.pow(1 - t, 3);
// Обновить dx,dy/alpha по времени t (сек от начала прилёта); возвращает true когда все прилетели
export function updateFlight(stars, t) {
  let all = true;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    let p = (t - s.delay) / s.dur;
    if (p < 0) p = 0; else if (p > 1) p = 1; else if (p < 1) all = false;
    const e = eo(p);
    const dx = s.x - s.sx, dy = s.y - s.sy, len = Math.hypot(dx, dy) || 1;
    const off = Math.sin(e * Math.PI) * s.curve * (1 - e);
    s.dx = s.sx + dx * e + (-dy / len) * off;
    s.dy = s.sy + dy * e + (dx / len) * off;
    s.fp = p;
  }
  return all;
}
