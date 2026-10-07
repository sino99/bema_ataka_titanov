// Мелкие помощники для рисования UI
export function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Перенос по словам (учитывает \n). Возвращает массив строк.
export function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (line && ctx.measureText(test).width > maxW) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

// Картинка «cover» на весь экран
export function drawCover(ctx, img, W, H) {
  if (!img || !img.width) return;
  const k = Math.max(W / img.width, H / img.height);
  const w = img.width * k, h = img.height * k;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
