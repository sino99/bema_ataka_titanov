import { createAssets } from './assets.js';
import { createAudio } from './audio.js';
import { makeFace } from './faceSprite.js';
import { setupInput } from './input.js';

const FADE = 0.4; // половина перехода: затемнение, потом проявление

export function createApp(canvas, registry, config) {
  const W = 1280, H = 720;
  const ctx = canvas.getContext('2d');
  const app = {
    canvas, ctx, W, H, config, time: 0, bs: 1,
    assets: createAssets(), audio: createAudio(), faces: {}, goTo: null, start: null
  };
  let scene = null;
  let trans = null; // { t, name, params, swapped }

  function resize() {
    const k = Math.min(innerWidth / W, innerHeight / H);
    canvas.style.width = Math.floor(W * k) + 'px';
    canvas.style.height = Math.floor(H * k) + 'px';
    app.bs = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * app.bs);
    canvas.height = Math.round(H * app.bs);
  }
  addEventListener('resize', resize);
  resize();

  function swap(name, params) {
    if (scene && scene.destroy) scene.destroy();
    scene = null;
    scene = (registry[name] || registry.intro)(app, params || {});
  }
  app.goTo = (name, params) => {
    if (trans) return;
    trans = { t: 0, name, params, swapped: false };
  };

  setupInput(app, () => (trans && !trans.swapped ? null : scene));

  function buildFaces() {
    const f = config.faces;
    app.faces.bema = makeFace(app.assets.get(f.bema.img), f.bema.cx, f.bema.cy, f.bema.r, 256);
    app.faces.bemaAlt = makeFace(app.assets.get(f.bemaAlt.img), f.bemaAlt.cx, f.bemaAlt.cy, f.bemaAlt.r, 256);
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    app.time += dt;
    if (trans) {
      trans.t += dt;
      if (!trans.swapped && trans.t >= FADE) { swap(trans.name, trans.params); trans.swapped = true; }
      if (trans.t >= FADE * 2) trans = null;
    }
    if (scene && scene.update) scene.update(dt);
    ctx.setTransform(app.bs, 0, 0, app.bs, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (scene && scene.render) scene.render(ctx);
    if (trans) {
      const a = trans.t < FADE ? trans.t / FADE : 1 - (trans.t - FADE) / FADE;
      ctx.setTransform(app.bs, 0, 0, app.bs, 0, 0);
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // debug: { name, params } — прямой переход после загрузки ассетов
  app.start = (debug) => {
    if (debug) {
      app.assets.promise.then(() => { buildFaces(); swap(debug.name, debug.params); });
    } else {
      // интро само показывает прогресс загрузки; лица строятся по готовности ассетов
      app.assets.promise.then(buildFaces);
      swap('intro', {});
    }
    requestAnimationFrame(frame);
  };
  return app;
}
