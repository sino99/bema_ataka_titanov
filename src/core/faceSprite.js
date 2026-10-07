// Круглая вырезка лица -> canvas size x size (прозрачно вне круга)
export function makeFace(img, cx, cy, r, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.save();
  g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); g.clip();
  g.drawImage(img, cx - r, cy - r, r * 2, r * 2, 0, 0, size, size);
  g.restore();
  g.strokeStyle = 'rgba(255,240,220,0.85)'; g.lineWidth = 3;
  g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); g.stroke();
  return c;
}
