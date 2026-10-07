// Pointer Events + клавиатура -> логические координаты сцены (1280x720)
export function setupInput(app, getScene) {
  const cv = app.canvas;
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * app.W / r.width, (e.clientY - r.top) * app.H / r.height];
  };
  const call = (n, ...a) => { const s = getScene(); if (s && typeof s[n] === 'function') s[n](...a); };
  let unlocked = false;
  const unlock = () => { if (!unlocked) { unlocked = true; app.audio.unlock(); } };

  cv.addEventListener('pointerdown', (e) => {
    unlock();
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    const [x, y] = pos(e); call('pointerDown', x, y, e.pointerId); e.preventDefault();
  });
  cv.addEventListener('pointermove', (e) => { const [x, y] = pos(e); call('pointerMove', x, y, e.pointerId); });
  const up = (e) => { const [x, y] = pos(e); call('pointerUp', x, y, e.pointerId); };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    unlock(); call('keyDown', e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => call('keyUp', e.code));
}
