const MANIFEST = {
  bema1: '/img/bema/bema1.jpg', bema2: '/img/bema/bema2.jpg', bema3: '/img/bema/bema3.jpg',
  bema4: '/img/bema/bema4.jpg', bema5: '/img/bema/bema5.jpg', bema6: '/img/bema/bema6.jpg', bemaStar: '/img/bema/bema.jpg',
  playerSheet: '/img/player_sheet.png', wall: '/img/story/wall.jpg', colossal: '/img/story/colossal.jpg'
};

export function createAssets() {
  const images = {};
  const keys = Object.keys(MANIFEST);
  let done = 0;
  const a = { progress: 0, loaded: false, get: (k) => images[k], promise: null };
  a.promise = Promise.all(keys.map((k) => new Promise((res) => {
    const img = new Image();
    const fin = () => { done++; a.progress = done / keys.length; res(); };
    img.onload = fin; img.onerror = fin;
    img.src = MANIFEST[k];
    images[k] = img;
  }))).then(() => { a.loaded = true; a.progress = 1; });
  return a;
}
