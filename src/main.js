import './style.css';
import { config } from './config.js';
import { createApp } from './core/app.js';
import { createScene as intro } from './scenes/starIntro.js';
import { createScene as story } from './scenes/story.js';
import { createScene as game } from './scenes/game.js';
import { createScene as ending } from './scenes/ending.js';

const registry = { intro, story, game, ending };
const app = createApp(document.getElementById('game'), registry, config);

// Подсказка «поверни телефон»
const rot = document.getElementById('rotate');
let forced = false;
function checkRot() {
  const coarse = matchMedia('(pointer:coarse)').matches;
  rot.classList.toggle('show', coarse && !forced && innerHeight > innerWidth);
}
document.getElementById('rotate-skip').addEventListener('click', () => { forced = true; checkRot(); });
addEventListener('resize', checkRot);
addEventListener('orientationchange', checkRot);
checkRot();

// Кнопка звука
const mute = document.getElementById('mute');
mute.addEventListener('click', () => {
  app.audio.unlock();
  app.audio.setMuted(!app.audio.muted);
  mute.classList.toggle('off', !!app.audio.muted);
});

// Отладка: ?scene=game&level=2 | ?scene=ending | ?scene=story&chapter=beforeLevel3
const q = new URLSearchParams(location.search);
const sc = q.get('scene');
app.start(sc ? { name: sc, params: { level: +(q.get('level') || 1), chapter: q.get('chapter') || 'prologue' } } : null);
