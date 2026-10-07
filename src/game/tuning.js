// Все числа для настройки геймплея — в одном месте.
export const T = {
  groundY: 650,
  wallX: 170,            // лицевая грань стены (титаны, дошедшие сюда, бьют по стене)

  gravity: 1500,
  airDrag: 0.12,
  reelAccel: 2200,       // тяга троса, px/s^2
  maxSpeed: 1150,
  hookRange: 820,        // макс. дальность цепляния по точке внутри цели
  rayRange: 650,         // дальность луча, если тап в пустоту
  hookTime: 0.1,         // время полёта крюка
  tapHold: 0.3,          // минимальное время тяги после короткого тапа
  napeSnap: 90,          // радиус «залипания» тапа на затылок
  buildingPad: 45,       // допуск тапа рядом со зданием/титаном

  gasMax: 100,
  gasDrain: 12,          // расход при подтягивании, 1/с
  gasRefill: 45,         // восстановление на земле/крыше, 1/с
  dashGas: 8,

  dashSpeed: 700,
  dashTime: 0.22,
  dashCooldown: 0.6,

  killSpeed: 380,        // скорость для убийства при пролёте через затылок
  napeRadius: 45,        // радиус хитбокса затылка
  dashAssist: 380,       // автонаведение рывка на затылок в этом радиусе

  hearts: 3,
  invuln: 1.5,
  grabTrigger: 60,       // добавка к длине руки для начала захвата
  grabTelegraph: 0.9,
  grabActive: 0.25,
  grabCooldown: 3.2,
  grabRadius: 46,

  slowScale: 0.25,
  slowTime: 0.3,

  // управление с телефона
  runAccel: 3400,        // разгон на земле
  runMax: 380,
  airAccel: 950,         // управление в воздухе
  airAccelHooked: 480,
  jumpV: 620,
  pcy: 45,               // высота центра героини над ногами
  spriteScale: 0.24,     // масштаб спрайт-листа (118 px)
  autoRange: 780,        // дальность авто-троса
  titleCard: 2.2,
  scorePerTitan: 100,
};
