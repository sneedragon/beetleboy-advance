// BeetleBoy SP · The world (world.html): a small place on the network, half
// up in the clouds and half under the power lines, where everyone signed in
// walks around as a Remicat while the RemiliaNET chat runs beside it.
// A plaza with a wishing well, Cyberia with a shared screen and a dance
// floor, the terminal with the wardrobe and a capsule machine, a park with a
// ball, and the beetle garden where the beetle game runs (password login only,
// the remilia sign-in cannot craft). Beetles wander about to be caught.
// world.php keeps positions, emotes, the ball, the screen, beetles and coins.

const WORLD_W = 2820, WORLD_H = 2120;
const W_SPEED = 170;                 // world units a second
const W_SKATE = 255;                 // others on a board (world.php lets nobody go faster than 260)
// my board rolls on its own: push, coast, carve, ollie (units a second, radians a second)
const SK = { max: 250, push: 260, drag: 0.35, brake: 620, turn: 5.5, pop: 240, grav: 950, flip: 2.6 };
const W_POLL = 1000;
const W_ACTIVE = 180_000;            // input this recent counts as "here" for coins
const PEN = [100, 1240, 470, 1460];   // the park's ball pitch, as in world.php
const GOAL = [1310, 1390];          // the goal mouths at both ends of the pitch
const BALL_K = 1.4, BALL_R = 10;

// the map is a grid of 450 x 290 blocks round the plaza; walls have doorways
// as [from, to] per side, set a little toward the plaza
const ZONES = [
  // a corner cut out of the Jade Arches: the kitchen's back door, and a way down into Cyberia
  { id: 'alley', name: 'BACK ALLEY', x: 60, y: 190, w: 180, h: 140, walls: ['top', 'right'], gaps: { right: [[236, 306]] }, sign: 'none', col: '#8c86a3' },
  { id: 'jade', name: 'JADE ARCHES', x: 60, y: 40, w: 900, h: 290, gaps: { right: [[190, 300]], bottom: [[100, 200]] }, sign: 'top', col: '#2fae7a' },
  { id: 'slots', name: 'SLOTS', x: 1410, y: 40, w: 900, h: 290, gaps: { left: [[190, 300]] }, col: '#ffb43d' },
  { id: 'club', name: 'CYBERIA', x: 60, y: 330, w: 900, h: 580, gaps: { bottom: [[610, 770]], top: [[100, 200]] }, col: '#ff3d6e', dark: true },
  { id: 'shop', name: 'TERMINAL', x: 1410, y: 330, w: 900, h: 580, gaps: { bottom: [[1550, 1710]] }, col: '#5b63e6' },
  { id: 'church', name: 'CHURCH', x: 2310, y: 910, w: 450, h: 290, gaps: { left: [[985, 1125]] }, col: '#d9cfae' },
  { id: 'park', name: 'PARK', x: 60, y: 1200, w: 450, h: 580, walls: ['left', 'top', 'bottom'], hedge: true, gaps: { top: [[330, 470]] }, col: '#4f9d58' },
  { id: 'garden', name: 'BEETLE GARDEN', x: 510, y: 1200, w: 450, h: 290, hedge: true, gaps: { top: [[780, 920]] }, col: '#2f9a5e' },
  { id: 'farm', name: 'FARM', x: 510, y: 1490, w: 450, h: 290, walls: ['left', 'bottom', 'right'], hedge: true, gaps: { right: [[1530, 1650]] }, sign: 'bottom', col: '#c9a13b' },
  { id: 'skate', name: 'SKATE PARK', x: 1410, y: 1200, w: 450, h: 580, walls: [], gaps: {}, col: '#8c86a3' },
  { id: 'library', name: 'LIBRARY', x: 1860, y: 1200, w: 450, h: 290, gaps: { top: [[1930, 2070]] }, col: '#b07a42' },
];
const PLAZA = { id: 'plaza', name: 'PLAZA' };
const CLUB_SCREEN = { x: 290, y: 350, w: 420, h: 236 };          // the club screen, 16:9
const DANCE = { x: 220, y: 620, w: 570, h: 180 };               // the floor that sings
const GARDEN_GATE = { x: 780, y: 1192, w: 140, h: 24 };
const GARDEN_GATES = [GARDEN_GATE];                               // the only way into the garden
const WELL = { x: 1185, y: 1045 };
const TREES = [[130, 1560], [440, 1580], [270, 1720], [560, 1270], [910, 1440], [1000, 1930], [1370, 2020], [1000, 380], [1370, 860], [2280, 1000]];
const POLES = [[978, 320], [1392, 320], [978, 892], [1392, 892], [80, 1180], [2290, 1180], [978, 1760], [1392, 1760]];
const POND = { x: 1185, y: 620, rx: 78, ry: 50 };                 // fishing, as in world.php
// the bit of shore nearest to me: you can fish from all round the pond
function pondShore() {
  const me = world.cats?.get(world.me);
  const a = me ? Math.atan2((me.y - POND.y) / POND.ry, (me.x - POND.x) / POND.rx) : Math.PI / 2;
  return { x: Math.round(POND.x + Math.cos(a) * (POND.rx + 26)), y: Math.round(POND.y + Math.sin(a) * (POND.ry + 26)) };
}
const EMOTE_ICON = { wave: '👋', heart: '❤️', laugh: '😹', spark: '💫', sleep: '💤', dance: '🎵', what: '❓', hug: '🤗', high5: '🙌', gift: '🎁' };
const FISH_ICON = { minnow: '🐟', koi: '🎏', puffer: '🐡', jelly: '🪼', eel: '🪱', angel: '🐠', boot: '👢', disk: '💾', golden: '👑',
  shrimp: '🦐', crab: '🦀', frog: '🐸', shell: '🐚', squid: '🦑', duck: '🦆', turtle: '🐢', lobster: '🦞', whale: '🐋' };
const STALL = { x: 1440, y: 716, w: 120, h: 50, at: { x: 1500, y: 806 } };   // the terminal's buy counter, as in world.php
const BIN = { x: 74, y: 216, w: 88, h: 52, at: { x: 118, y: 296 } };  // the dumpster in the back alley, as in world.php
const MAILBOX = { x: 1360, y: 930, w: 26, h: 64, at: { x: 1373, y: 1030 } };  // walk up to it for your messages
const BOARD = { x: 992, y: 838, w: 160, h: 92, at: { x: 1072, y: 962 } };    // the notice board: patch notes and the best players
const BOUTIQUE = { x: 1450, y: 360, w: 300, h: 44 };                          // the clothes rail
const GACHA = { x: 2190, y: 362, w: 80, h: 112 };                             // the capsule machine
const SLOTS = [0, 1, 2, 3, 4, 5].map(i => ({ x: 1520 + i * 120, y: 62, w: 76, h: 104 }));   // the slot machines, as in world.php
// furniture: [x, y, w, h, kind], solid and drawn in buildBackground()
const FURNITURE = [
  [216, 360, 56, 120, 'speaker'], [728, 360, 56, 120, 'speaker'],
  [880, 400, 64, 300, 'bar'], ...[420, 480, 540, 600, 660].map(y => [852, y, 18, 12, 'stool']),
  [80, 420, 44, 130, 'sofa'], [80, 600, 44, 130, 'sofa'], [140, 462, 46, 46, 'table'], [140, 642, 46, 46, 'table'],
  [100, 852, 180, 40, 'couch'], [150, 800, 70, 34, 'table'], [800, 852, 140, 40, 'couch'],
  [1790, 352, 70, 100, 'booth'], [1480, 470, 24, 14, 'mannequin'], [1700, 470, 24, 14, 'mannequin'], [1880, 360, 40, 96, 'mirror'],
  [2080, 852, 180, 40, 'couch'], [2130, 790, 80, 38, 'table'], [1840, 852, 150, 40, 'couch'],
  // the terminal hall: a row of old computers with chairs, server racks humming on the wall, two arcade cabinets, a wall of screens
  ...[1640, 1740, 1840, 1940].flatMap(x => [[x, 586, 64, 30, 'crt'], [x + 21, 634, 22, 16, 'chair']]),
  [2246, 540, 44, 70, 'rack'], [2246, 626, 44, 70, 'rack'], [2246, 712, 44, 70, 'rack'],
  [1440, 548, 46, 58, 'arcade'], [1498, 548, 46, 58, 'arcade'], [1960, 342, 200, 40, 'screens'],
  [110, 1736, 110, 26, 'bench'], [330, 1736, 110, 26, 'bench'],
];
// the seats: where a cat sits on each sofa, couch, bench and stool, and which way it looks
const SEATS = [];
for (const [x, y, w, h, k] of FURNITURE) {
  if (k === 'sofa') for (const i of [0, 2]) SEATS.push({ x: x + 28, y: y + 12 + (i + 0.5) * (h - 12) / 3, dir: 'side' });
  if (k === 'couch' || k === 'bench') for (let n = Math.max(2, Math.floor(w / 46)), i = 0; i < n; i++) SEATS.push({ x: x + (i + 0.5) * w / n, y: y + h - (k === 'bench' ? 4 : 10), dir: 'down' });
  if (k === 'stool') SEATS.push({ x: x + w / 2, y: y + h / 2 + 4, dir: 'side' });
  if (k === 'chair') SEATS.push({ x: x + w / 2, y: y + h - 2, dir: 'up' });
}
// where you stand to sit down and get up again: the first free place beside the seat, worked out once the walls are in
function seatSpots() {
  for (const st of SEATS) {
    st.at = [[0, 30], [0, -30], [30, 0], [-30, 0], [0, 44], [0, -44], [44, 0], [-44, 0]].map(([dx, dy]) => ({ x: st.x + dx, y: st.y + dy })).find(p => !blocked(p.x, p.y)) || { x: st.x, y: st.y + 30 };
  }
}
SEATS.spots = () => SEATS.forEach((st, i) => SPOTS.push({ id: 'seat' + i, r: { x: st.x - 14, y: st.y - 30, w: 28, h: 34 }, get at() { return st.at; }, near: 34, col: '#8a90f0',
  text: () => '🪑 Sit down', hide: () => !!world.sit || !!world.skate, act: () => sitDown(st) }));
const STALL_SOLID = [STALL.x, STALL.y, STALL.w, STALL.h], BIN_SOLID = [BIN.x + 2, BIN.y + 8, BIN.w - 4, BIN.h - 10];
// the place floats in the sky: you can walk on these and nowhere else
const PLATFORMS = [[960, 40, 450, 2030], [60, 910, 2250, 290], ...ZONES.map(z => [z.x, z.y, z.w, z.h])]
  .map(([x, y, w, h]) => ({ x, y, w, h }));
const GLITCH_LINES = ['PRESENT DAY', 'PRESENT TIME', 'you are connected', 'layer 777', 'who is here?', 'the network remembers', 'no carrier'];
const FORTUNES = [
  'Someone on the network is thinking of you.', 'You are connected. You always were.', 'The wires hum your name tonight.',
  'Something small and golden is wandering nearby.', 'Close your eyes. Layer 777 will still be here.',
  'Today is a good day to wave at a stranger.', 'Heaven is a server you have not logged into yet.',
  'Every message you send stays with someone.', 'The sky is loading. Please wait.', 'You are not alone in here.',
  'Light comes down the wires to find you.', 'A cat somewhere just waved at you.', 'Rest. The network keeps watch.',
  'What you lost will come back as a signal.', 'Present day, present time, and you are here.', 'The angels are buffering.',
  'Make a friend before the screen goes dark.', 'The well heard you. It always does.',
];

// things you can walk up to and use: the prompt floats above them
const SPOTS = [
  { id: 'screen', r: CLUB_SCREEN, at: { x: 500, y: 610 }, zone: 'club', col: '#ff3d6e', text: () => world.tv ? '▶ Watch along' : '▶ Put on a video', act: () => openScreen() },
  { id: 'shop', r: BOUTIQUE, at: { x: 1600, y: 440 }, col: '#5b63e6', text: () => '★ Boutique', act: () => openShop() },
  { id: 'capsule', r: GACHA, at: { x: 2230, y: 510 }, col: '#d65bb6', text: () => '★ 30 Capsule', act: () => openCapsule() },
  { id: 'well', r: { x: WELL.x - 38, y: WELL.y - 34, w: 76, h: 56 }, at: { x: WELL.x, y: WELL.y + 60 }, col: '#7fb8ff', text: () => '✧ Wish (★ 1)', act: () => makeWish() },
  { id: 'board', r: BOARD, at: BOARD.at, col: '#e8a33d', text: () => '📋 Notice board', act: () => openBoard() },
  { id: 'game', r: { x: 675, y: 1314, w: 120, h: 56 }, at: { x: 735, y: 1296 }, col: '#2f9a5e', text: () => '🪲 Play the beetle game', act: () => openLab(), hide: () => labLocked() },
  { id: 'pond', r: { x: POND.x - POND.rx, y: POND.y - POND.ry, w: POND.rx * 2, h: POND.ry * 2 }, get at() { return pondShore(); }, col: '#3f7fdc', text: () => world.fishing ? '🎣 Reel in' : '🎣 Fish', act: () => castLine() },
  { id: 'stall', r: STALL, at: STALL.at, col: '#e8a33d', text: () => '★ Sell what you found', act: () => openBag('things') },
  { id: 'mail', r: MAILBOX, at: MAILBOX.at, col: '#d8443c', text: () => world.unread ? `✉ Mailbox (${world.unread} new)` : '✉ Mailbox', act: () => window.dmOpen?.(), hide: () => !window.dmOpen },
  { id: 'bin', r: BIN, at: BIN.at, col: '#8c86a3', text: () => '🗑 Dig in the dumpster', act: () => dig() },
  { id: 'gate', r: { x: 780, y: 1160, w: 140, h: 60 }, at: { x: 850, y: 1172 }, col: '#c23a4a', text: () => '🔒 Password sign-in only', act: () => labDenied(true), hide: () => !labLocked() },
  ...SLOTS.map((r, i) => ({ id: 'slot' + i, r, at: { x: r.x + r.w / 2, y: r.y + r.h + 30 }, near: 50, col: '#ffb43d', text: () => '🎰 Play the slots', act: () => openSlots(i) })),
];

// beetles: every browser works out the same ones from the clock (bugAt() in world.php)
const BUG_LIFE = 90;     // how many fly about comes from world.php: more when more people are here
const BUG_AREAS = [[560, 1240, 930, 1460], [110, 1500, 480, 1750], [120, 1250, 460, 1450], [120, 940, 920, 1170], [1450, 940, 2270, 1170], [1450, 1240, 1830, 1750], [990, 1230, 1380, 2040], [990, 120, 1380, 520]];
// tin, bronze, mithril, adamantite, diamond (BUGS in world.php); diamond is one in 500
const BUG_KINDS = [['green'], ['purple', 'ladybug', 'cucumber'],
  ['monarch', 'pond', 'giraffe_weevil', 'pillbug', 'imperial_tortoise', 'christmas', 'skull', 'bumblebee', 'golden_tiger', 'blue_longicorn'],
  ['goliath', 'bombardier', 'death_feigning', 'pondhawk', 'stag', 'sabertooth_longhorn', 'sunset_moth'],
  ['golden', 'widow', 'candycane_tiger_moth', 'mars_rhino', 'harlequin']];
const BUG_TIER = ['tin', 'brz', 'mth', 'adm', 'dia'];
const bugTier = r => r < 0.002 ? 4 : r < 0.02 ? 3 : r < 0.12 ? 2 : r < 0.42 ? 1 : 0;
const hrand = n => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
function bugAt(k, t) {
  const g = Math.floor((t + k * 13) / BUG_LIFE), s = g * 31 + k * 7;
  const [x0, y0, x1, y1] = BUG_AREAS[k % BUG_AREAS.length], r = hrand(s + 3);
  return {
    id: `${k}:${g}`, kind: bugTier(r), s,
    x: x0 + hrand(s + 1) * (x1 - x0) + 36 * Math.sin(t * (0.3 + hrand(s + 4) * 0.4) + s),
    y: y0 + hrand(s + 2) * (y1 - y0) + 24 * Math.sin(t * (0.25 + hrand(s + 5) * 0.4) + s * 2),
  };
}

const world = {
  me: '', cats: new Map(), canvas: null, ctx: null, top: null, tctx: null, z: 1, dpr: 1, cw: 0, ch: 0,
  cam: { x: 0, y: 0 }, sprite: null, tinted: new Map(), timer: null, raf: 0, last: 0,
  target: null, pending: null, near: null, prompt: null, keys: new Set(), failing: 0, busy: false, err: '',
  coins: null, wear: {}, owned: [], catalog: null, zone: null, active: Date.now(),
  ball: { x: 285, y: 1350, vx: 0, vy: 0, t0: 0 }, kickAt: 0, tv: null, tvAt: 0,
  out: {}, bg: null, noise: [], scan: null, haze: null, glitch: null, nextGlitch: 0, solids: [],
  skew: 0, gone: new Set(), catching: new Set(), bugImg: {}, splashes: [], tile: '', dm: 0,
  tvq: [], lastSeen: new Map(), looked: false, fx: new Map(), toss: new Map(), seenIn: new Set(), aim: null, fishing: null, sky: null,
};

// ── the map: walls with a doorway toward the plaza, a few solid things ──────
function buildSolids() {
  const s = [], T = 16;
  // a wall along one side, with its doorways left open
  const side = (z, k) => {
    const v = k === 'top' || k === 'bottom', a = v ? z.x : z.y, len = v ? z.w : z.h;
    const at = { top: z.y, bottom: z.y + z.h - T, left: z.x, right: z.x + z.w - T }[k];
    let p = a;
    for (const [g0, g1] of [...(z.gaps[k] || []), [a + len, a + len]]) {
      const kind = z.id === 'garden' ? 'fence' : z.hedge && 'hedge';           // the garden's iron fence is too tall to jump
      if (g0 > p) s.push(v ? [p, at, g0 - p, T, kind] : [at, p, T, g0 - p, kind]);
      p = g1;
    }
  };
  for (const z of ZONES) for (const k of z.walls || ['top', 'bottom', 'left', 'right']) side(z, k);
  s.push([CLUB_SCREEN.x - 10, z0('club').y, CLUB_SCREEN.w + 20, CLUB_SCREEN.h + 20]);        // the screen stands against the club wall
  s.push([BOUTIQUE.x, BOUTIQUE.y, BOUTIQUE.w, BOUTIQUE.h, 'prop'], [GACHA.x, GACHA.y + 40, GACHA.w, GACHA.h - 40, 'prop']);   // the clothes rail, the capsule machine
  s.push([BOARD.x + 6, BOARD.y + BOARD.h - 20, BOARD.w - 12, 20, 'prop']);               // the notice board's legs
  for (const r of SLOTS) s.push([r.x, r.y + 30, r.w, r.h - 30, 'prop']);       // the slot machines
  for (const r of FURNITURE) s.push([...r.slice(0, 4), 'prop']);               // sofas, the bar, couches, benches
  s.push([WELL.x - 34, WELL.y - 18, 68, 36]);
  // the pond is round, so it blocks as three stacked bands rather than one box: you can walk round its edge
  for (const k of [0.4, 0.72, 0.94]) { const hw = POND.rx * Math.sqrt(1 - k * k) - 4, hh = POND.ry * k - 4; s.push([POND.x - hw, POND.y - hh, hw * 2, hh * 2, 'pond']); }
  for (const [x, y] of TREES) s.push([x - 18, y - 6, 36, 16]);
  s.push([675, 1330, 120, 40, 'prop']);                                        // the workbench
  s.push([...STALL_SOLID, 'prop'], BIN_SOLID, [MAILBOX.x + 8, MAILBOX.y + 50, 10, 14]);
  for (const [x, y] of POLES) s.push([x - 8, y - 8, 16, 16]);
  window.placeSolids?.(s);                                                     // the new places (places.js)
  world.solids = s.map(([x, y, w, h, k]) => ({ x, y, w, h, k }));
  seatSpots();
}
const z0 = id => ZONES.find(z => z.id === id);
const labLocked = () => rnAuth();
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const zoneAt = (x, y) => ZONES.find(z => inRect(x, y, z)) || PLAZA;
const netNow = () => Date.now() / 1000 + world.skew;

// the cat's feet are a small box; bump it against walls one axis at a time
// air: up on the board, over hedges, tables, benches and the pond
const LOW = new Set(['prop', 'hedge', 'pond']);
function blocked(x, y, skip, air) {
  if (x < 20 || x > WORLD_W - 20 || y < 30 || y > WORLD_H - 8) return true;
  const box = { x: x - 13, y: y - 8, w: 26, h: 10 };
  const hit = r => box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y;
  if (labLocked() && GARDEN_GATES.some(hit)) return 'lab';
  // the edge, and the sky below: every corner of the cat stands on some platform
  const on = (px, py) => PLATFORMS.some(p => px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h);
  if (!on(x - 12, y - 14) || !on(x + 12, y - 14) || !on(x - 12, y + 4) || !on(x + 12, y + 4)) return true;
  return world.solids.some(r => r !== skip && !(air && LOW.has(r.k)) && hit(r));
}

// ── the cat sprite, recoloured ───────────────────────────────────────────────
const CAT_ANIM = {
  walk: { down: [0, 1, 2, 1], side: [8, 7, 6, 7], up: [9, 10, 11, 10] },
  idle: { down: [1, 0, 1, 2], side: [7, 7, 7, 6], up: [10, 10, 10, 9] },
};
function hslRgb(h, s, l) {
  const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}
function furOf(c, t) {
  switch (c.w?.col) {
    case 'c_red': return [355, 0.85, 0.5];
    case 'c_void': return [260, 0.25, 0.16];
    case 'c_ghost': return [220, 0.15, 0.9];
    case 'c_sky': return [205, 0.7, 0.78];
    case 'c_glitch': return [Math.floor(t * 2) % 12 * 30, 0.8, 0.6];
    case 'c_mint': return [160, 0.55, 0.7];
    case 'c_gold': return [45, 0.9, 0.55 + Math.round(Math.sin(t * 3) * 2) / 40];
    case 'c_night': return [235, 0.45, 0.22];
    case 'c_pink': return [330, 0.75, 0.78];
    case 'c_rainbow': return [Math.floor(t * 40) % 360, 0.8, 0.62];
    default: return [nameHue(c.d || c.u), 0.7, c.ghost ? 0.7 : 0.6];
  }
}
function catSheet([h, s, l]) {
  const k = `${h}/${s}/${l}`;
  if (world.tinted.has(k)) return world.tinted.get(k);
  const img = world.sprite;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const [r, gg, b] = hslRgb(h, s, l);
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 3] && d.data[i] > 200 && d.data[i + 2] < 60) { d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; }
  }
  g.putImageData(d, 0, 0);
  world.tinted.set(k, c);
  return c;
}

// ── talking to world.php ─────────────────────────────────────────────────────
async function worldPost(body) {
  const { access } = getTokens();
  if (!access) return null;
  try {
    const r = await fetch('world.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: access, ...body }) });
    if (!r.ok) world.err = `${r.status}`;
    // only renew a token that has run out (refresh tokens are single use)
    if (r.status === 401 && jwtExp(access) * 1000 < Date.now() + 30000) { await tryRefresh(access); return null; }
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { world.err = e.message; return null; }
}

// extra things for the next tick (an emote, a kick, a purchase…)
function worldSend(extra, now = false) { Object.assign(world.out, extra); if (now) worldTick(); }

async function worldTick() {
  if (document.hidden) return;
  if (world.busy) { world.again = true; return; }        // a click or a purchase goes out right after
  world.busy = true;
  try { await worldTickNow(); } finally { world.busy = false; }
  if (world.again) { world.again = false; worldTick(); }
}

async function worldTickNow() {
  const me = world.cats.get(world.me);
  const at = world.target || me;
  const extra = world.out; world.out = {};
  // a catch, a sale or a dig counts where I am now, not where I am walking to
  const pos = (extra.catch || extra.sell || extra.dig || world.skate) && me ? me : at;
  const body = { ...(pos ? { x: Math.round(pos.x), y: Math.round(pos.y) } : {}), ...(me ? { cx: Math.round(me.x), cy: Math.round(me.y) } : {}), ...extra };
  if (Date.now() - world.active < W_ACTIVE) body.a = 1;
  if (world.skate) body.sk = 1;
  if (world.sit) body.si = 1;
  const d = await worldPost(body);
  if (!d?.people) {
    if (extra.catch) world.catching.delete(extra.catch);
    if (++world.failing === 5) worldNote(`The world is not answering right now (${world.err || '?'}).`);
    return;
  }
  if (world.failing >= 5) worldNote('');
  world.failing = 0;
  world.me = d.me;
  if (d.now) world.skew = d.now - Date.now() / 1000;
  if (d.bn) world.bn = d.bn;
  const clock = performance.now() / 1000;
  const here = new Set();
  if (clock - (world.lastTick ?? -1e9) > 30) world.looked = false;     // back from a hidden tab: just look around
  world.lastTick = clock;
  for (const p of d.people) {
    here.add(p.u);
    let c = world.cats.get(p.u);
    if (!c || c.ghost) {
      c = { u: p.u, d: p.d, x: p.x, y: p.y, tx: p.x, ty: p.y, dir: 'down', flip: false, moving: false, t0: Math.random() * 4, bubble: c?.bubble, trail: [] };
      world.cats.set(p.u, c);
    }
    c.d = p.d; c.l = +p.l || 0; c.w = p.w || {}; c.st = p.st || ''; c.sk = p.u === world.me ? world.skate : !!p.sk; c.si = p.u === world.me ? !!world.sit : !!p.si;
    // someone new walked in (not on my first look, and not back from a short break)
    if (world.looked && p.u !== world.me && clock - (world.lastSeen.get(p.u) ?? -1e9) > 300) {
      worldToast(`👋 ${p.d || p.u} logged on${p.st ? ` · ${p.st}` : ''}`, 3500);
      sfx('react');
    }
    world.lastSeen.set(p.u, clock);
    if (p.u !== world.me) { c.tx = p.x; c.ty = p.y; }
    if (p.e && (!c.emote || c.emote.k !== p.e[0] || Math.abs(c.emote.at - (clock - p.e[1])) > 1.5)) c.emote = { k: p.e[0], at: clock - p.e[1] };
  }
  for (const [u, c] of world.cats) if (!c.ghost && !here.has(u)) world.cats.delete(u);
  world.looked = true;
  placeEchoes();
  if (d.status != null) worldToast(d.status ? 'Status set' : 'Status cleared');

  setCoins(d.coins);
  world.wear = d.wear || {};
  if (d.catalog) { world.catalog = d.catalog; world.owned = d.owned || []; if (!document.getElementById('w-shop').classList.contains('hidden')) renderShop(); if (!document.getElementById('w-toys').classList.contains('hidden')) renderToys(); renderHot(); renderHotPick(); }
  if (d.bonus) worldToast(`+${d.bonus} stars for showing up today`);
  if (d.xpcoins) worldToast(`+${d.xpcoins} stars from the beetle game`);
  if (d.owned && !d.catalog) world.owned = d.owned;
  if (d.shop === 'bought') { worldToast(world.lastBuy?.startsWith('k_') ? 'Unlocked. You find it with your toys now.' : 'Bought and put on'); sfx('claim'); renderToys(); }
  if (d.shop === 'poor') worldToast('Not enough stars yet');
  if (d.tv_err) worldToast(d.tv_err);
  if (d.capsule) capsuleResult(d);
  if (d.wish) wishResult(d.wish, d.wishgift);
  if (d.tv_queued) worldToast(`Added to the queue (${d.tv_queued} waiting)`);
  world.tvq = d.tvq || [];
  if (!document.getElementById('w-screen').classList.contains('hidden')) renderQueue();
  if (d.fish) fishResult(d);
  if (d.fw === 'poor') worldToast('A firework costs 2 stars.');
  if (d.touch === 'far') worldToast('Walk up to them first.');
  if (d.touch === 'gone') worldToast('They are not here right now.');
  if (d.gift) giftResult(d.gift);
  if (d.dig) digResult(d);
  if (d.sell) sellResult(d.sell);
  if (d.quests) renderQuests(d.quests);
  if (d.quest) d.quest.forEach(([name, n], i) => setTimeout(() => { worldToast(`📜 ${name}: +${n} stars`, 4000); sfx('claim'); }, 1200 + i * 4200));
  if (d.inv || d.catalog) window.renderBag?.(d.inv);
  if (d.trade) tradeResult(d.trade);
  renderOffers(d.trades || []);
  if (d.prof) window.cardStats?.(d.prof);
  for (const i of d.in || []) gotIn(i, clock);
  syncFx(d.fx || [], clock);
  syncToss(d.toss || [], clock);
  world.gone = new Set(d.gone || []);
  if (extra.catch) {
    world.catching.delete(extra.catch);
    if (d.caught === extra.catch) {
      world.gone.add(extra.catch);
      worldToast(`Caught ${aName(itemName('b:' + d.bug))}! It is in your bag.`);
      const me = world.cats.get(world.me);
      if (me) world.splashes.push({ x: me.x, y: me.y - 56, t: clock, text: '+1 🪲', col: '#2f9a5e' });
      sfx('claim');
    } else if (d.caught === 'gone') { world.gone.add(extra.catch); worldToast('Someone was quicker.'); }
    else if (d.caught === 'far') world.catchWait = performance.now() + 600;
  }
  if (d.dm != null && d.dm !== world.dm) { world.dm = d.dm; window.dmPoke?.(d.dm); }
  window.placesTick?.(d, extra, clock);                // the farm, the kitchen, the goals (places.js)
  window.hubTick?.(d);                                 // levels, the board, the slots (hub.js)

  // the ball: my own kick stays as I predicted it until the server agrees
  if (performance.now() - world.kickAt > 1500 && d.ball) syncBall(d.ball, clock);
  tvUpdate(d.tv ? { v: d.tv.v, k: d.tv.k, at: clock - d.tv.age, by: d.tv.by } : null);
  worldCount();
}

// people who chatted in the last ten minutes but are not in the world stand
// around the well, flickering
function placeEchoes() {
  const since = Date.now() / 1000 - 600;
  const seen = new Map();
  for (const p of pagePosts.values()) {
    const u = p.user?.username;
    if (u && p.time > since && !muted.has(u)) seen.set(u, p.user.displayname || u);
  }
  for (const [u, c] of world.cats) if (c.ghost && !seen.has(u)) world.cats.delete(u);
  const echoes = [...seen].filter(([u]) => !world.cats.has(u) || world.cats.get(u).ghost).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 14);
  echoes.forEach(([u, d], i) => {
    const a = (i / Math.max(8, echoes.length)) * Math.PI * 2 - Math.PI / 2;
    const x = WELL.x + Math.cos(a) * (i % 2 ? 150 : 128), y = WELL.y + 10 + Math.sin(a) * (i % 2 ? 100 : 84);
    const c = world.cats.get(u);
    if (c) { c.x = c.tx = x; c.y = c.ty = y; c.d = d; return; }
    world.cats.set(u, { u, d, x, y, tx: x, ty: y, dir: 'down', flip: false, moving: false, ghost: true, t0: Math.random() * 4, trail: [] });
  });
}

function worldCount() {
  const n = [...world.cats.values()].filter(c => !c.ghost).length;
  const el = document.getElementById('w-count');
  if (el) el.textContent = n ? `${n} online` : '';
  // the list in the people panel, rebuilt only when someone comes, goes or changes their status
  const list = [...world.cats.values()].filter(c => !c.ghost).sort((a, b) => (b.u === world.me) - (a.u === world.me) || (a.d || a.u).localeCompare(b.d || b.u));
  const html = list.map(c => `<div class="cp-person" data-user="${esc(c.u)}"><span class="w-on"></span>` +
    `<span class="chat-user" style="--name-h:${nameHue(c.d || c.u)}">${esc(c.d || c.u)}${c.u === world.me ? ' (you)' : ''}</span>` +
    (c.st ? `<span class="cp-ago">${esc(c.st)}</span>` : '') + '</div>').join('') || '<p class="cp-empty">Nobody in the world right now.</p>';
  const box = document.getElementById('cp-online');
  if (box && box.dataset.h !== html) { box.innerHTML = html; box.dataset.h = html; }
}
function setCoins(n) {
  if (n == null) return;
  const el = document.getElementById('w-coins');
  if (world.coins != null && n > world.coins) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); }
  world.coins = n;
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.6 7.1.9-5.2 4.9 1.4 7.1L12 17.8l-6.4 3.5 1.4-7.1L1.8 9.3l7.1-.9z"/></svg>${n.toLocaleString()}`;
  const sc = document.getElementById('w-shop-coins');
  if (sc) sc.textContent = `★ ${n.toLocaleString()}`;
}
function worldNote(t) { const el = document.getElementById('w-note'); if (el) el.textContent = t; }
let toastTimer = 0;
function worldToast(t, ms = 3200) {
  const el = document.getElementById('w-toast');
  el.textContent = t; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ── moving ───────────────────────────────────────────────────────────────────
function worldStep(dt, clock) {
  const me = world.cats.get(world.me);
  if (me && world.sit && (world.keys.size || world.target || world.skate)) standUp(me);
  if (me && world.sit) { me.x = me.tx = world.sit.x; me.y = me.ty = world.sit.y; me.dir = world.sit.dir; me.flip = !!world.sit.flip; me.moving = false; }
  if (me && world.keys.size && !world.skate) {
    const k = world.keys;
    const vx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    const vy = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
    if (vx || vy) { world.target = { x: me.x + vx * 40, y: me.y + vy * 40 }; world.pending = null; world.keyWalk = true; }
  } else if (me && world.keyWalk) {
    // let go of the arrows: stop where you are, not a few steps on
    world.keyWalk = false; world.target = null; me.tx = me.x; me.ty = me.y;
  }
  for (const c of world.cats.values()) {
    const mine = c === me;
    if (mine && world.skate) { skateStep(c, dt, clock); continue; }
    if (mine && world.target) { c.tx = world.target.x; c.ty = world.target.y; }
    const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy);
    if (!mine && dist > 500) { c.x = c.tx; c.y = c.ty; c.moving = false; continue; }
    const step = (c.sk ? W_SKATE : W_SPEED) * dt;
    c.moving = dist > 1;
    if (!c.moving) continue;
    const mx = step >= dist ? dx : dx / dist * step, my = step >= dist ? dy : dy / dist * step;
    if (mine && blocked(c.x, c.y) !== true) {
      // slide along walls: try both axes, then each on its own
      const bx = blocked(c.x + mx, c.y), by = blocked(c.x, c.y + my), bb = blocked(c.x + mx, c.y + my);
      if (!bb) { c.x += mx; c.y += my; }
      else if (!bx) c.x += mx;
      else if (!by) c.y += my;
      else { world.target = null; c.tx = c.x; c.ty = c.y; c.moving = false; }
      if ([bx, by, bb].includes('lab')) labDenied();
    } else { c.x += mx; c.y += my; }          // someone else, or me stuck inside something: let them out
    if (Math.abs(dx) > Math.abs(dy)) { c.dir = 'side'; c.flip = dx < 0; } else c.dir = dy < 0 ? 'up' : 'down';
    if (c.w?.trail && Math.random() < dt * trailOf(c)[0]) c.trail.push({ x: c.x + (Math.random() - 0.5) * 16, y: c.y - 6 - Math.random() * 18, t: clock, r: Math.random() });
  }
  if (!me) return;
  const z = zoneAt(me.x, me.y);
  if (z !== world.zone) enterZone(z);
  kickCheck(me, clock);
  catchCheck(me);
  danceCheck(me);
  fishCheck(me, clock);
  // the nearest thing to use, and walking up to the one I tapped
  // a spot with a zone (the club screen) works from anywhere in that room
  const inSpot = s => s.zone && z.id === s.zone;
  world.near = SPOTS.filter(s => !s.hide?.()).map(s => ({ s, d: inSpot(s) ? 200 : Math.hypot(s.at.x - me.x, s.at.y - me.y) })).filter(o => o.d < (o.s.near || 110) || inSpot(o.s)).sort((a, b) => a.d - b.d)[0]?.s || null;
  const p = world.pending;
  if (p) {
    const d = Math.hypot(p.at.x - me.x, p.at.y - me.y);
    if (d < 30 || inSpot(p) || (!me.moving && d < (p.near || 110))) { world.pending = null; p.act(); }
    else if (!me.moving) world.pending = null;
  }
}

// ── the skateboard ───────────────────────────────────────────────────────────
// it keeps rolling: push toward where you steer, carve round slowly, turn hard
// against the roll to powerslide; ollie, and pop a trick in the air
const angDiff = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
function skateStep(me, dt, t) {
  const b = world.sb;
  me.tx = me.x; me.ty = me.y;
  if (t < b.bail) { me.moving = false; return; }
  let want = null, gas = false;
  const k = world.keys;
  const kx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0), ky = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
  if (kx || ky) { want = Math.atan2(ky, kx); gas = true; world.target = null; world.pending = null; }
  else if (world.target) {
    const dx = world.target.x - me.x, dy = world.target.y - me.y, d = Math.hypot(dx, dy);
    if (d < 22 || (d < 70 && b.v < 30)) { world.target = null; b.v = Math.min(b.v, 40); }
    else { want = Math.atan2(dy, dx); gas = d > b.v * b.v / (2 * SK.brake) + 40; if (!gas && !b.z) b.v = Math.max(0, b.v - SK.brake * dt); }
  }
  if (b.z > 0 || b.vz > 0) {
    // in the air: no steering, the trick turns
    b.vz -= SK.grav * dt; b.z = Math.max(0, b.z + b.vz * dt);
    if (b.trick) b.spin += SK.flip * dt;
    if (b.z === 0) land(me, t);
  } else if (want != null) {
    const da = angDiff(want, b.h);
    // the arrows point where you want to go: back against the roll powerslides,
    // and once slow you kick the board round; anything else carves over
    if (Math.abs(da) > 2.4 && b.v > 70) { b.v = Math.max(0, b.v - SK.brake * dt); b.slide = t; }
    else {
      if (b.v < 70 && Math.abs(da) > 1.6) b.h = want;
      else { const r = SK.turn * (b.v < 70 ? 2 : 1) * dt; b.h += Math.max(-r, Math.min(r, da)); }
      if (gas && Math.abs(angDiff(want, b.h)) < Math.PI / 2) { b.v = Math.min(SK.max, b.v + SK.push * dt); b.kick = t; }
    }
  }
  if (!b.z) { b.v -= b.v * SK.drag * dt; if (b.v < 6 && !gas) b.v = 0; }
  const mx = Math.cos(b.h) * b.v * dt, my = Math.sin(b.h) * b.v * dt;
  // high enough in the air, you clear the pond, hedges, tables and benches
  const air = b.z > 4;
  if (mx || my) {
    if (!blocked(me.x + mx, me.y + my, null, air)) { me.x += mx; me.y += my; }
    else if (b.v > 190 && !b.z) return bail(me, t, 'Bail!');
    else if (!blocked(me.x + mx, me.y, null, air)) { me.x += mx; b.v *= 0.6; b.h = Math.atan2(0, Math.cos(b.h)); }
    else if (!blocked(me.x, me.y + my, null, air)) { me.y += my; b.v *= 0.6; b.h = Math.atan2(Math.sin(b.h), 0); }
    else { b.v = 0; world.target = null; }
    if ([blocked(me.x + mx, me.y)].includes('lab')) labDenied();
  }
  window.skateRamp?.(me, b, t);                       // kickers and the rail in the skate park (places.js)
  me.moving = b.v > 5;
  const cs = Math.cos(b.h), sn = Math.sin(b.h);
  if (Math.abs(cs) > Math.abs(sn) * 0.8) { me.dir = 'side'; me.flip = cs < 0; } else me.dir = sn < 0 ? 'up' : 'down';
  if (me.w?.trail && me.moving && Math.random() < dt * trailOf(me)[0]) me.trail.push({ x: me.x + (Math.random() - 0.5) * 16, y: me.y - 6 - Math.random() * 18, t, r: Math.random() });
}
const TRICKS = { flip: 'Kickflip', shove: 'Pop shove-it' };
// Space / ⤴ ollies and flips, Shift / ↻ shoves it; either one pops you up from the ground
function ollie(trick = 'flip') {
  const b = world.sb, t = performance.now() / 1000;
  if (!world.skate || t < b.bail) return;
  if (!b.z && b.vz <= 0) { b.vz = SK.pop; b.z = 0.1; b.trick = trick === 'shove' ? 'shove' : ''; b.spin = 0; sfx('click'); return; }
  if (!b.trick && b.vz > -60) { b.trick = trick; b.spin = 0; }
}
function land(me, t) {
  const b = world.sb;
  b.vz = 0;
  const box = { x: me.x - 13, y: me.y - 8, w: 26, h: 10 };
  const under = world.solids.find(r => LOW.has(r.k) && box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y);
  // coming down on a table or a bench: the board pops off it and carries on
  if (under && under.k !== 'pond' && !blocked(me.x, me.y, null, true)) { b.vz = 160; b.z = 0.1; return; }
  if (blocked(me.x, me.y)) {               // into the pond
    const s = SPOTS.find(x => x.id === 'pond');
    me.x = s.at.x; me.y = s.at.y;
    return bail(me, t, 'Splash!');
  }
  if (!b.trick) return;
  if (b.spin < 0.85) return bail(me, t, 'Bail!');
  b.combo = t - (b.lastTrick || 0) < 3 ? b.combo + 1 : 1; b.lastTrick = t;
  world.splashes.push({ x: me.x, y: me.y - 64, t, text: TRICKS[b.trick] + (b.combo > 1 ? ` ×${b.combo}` : ''), col: '#ff3d6e' });
  sfx('claim');
  b.trick = ''; b.spin = 0;
}
function bail(me, t, text) {
  const b = world.sb;
  b.bail = t + 1.1; b.v = 0; b.z = 0; b.vz = 0; b.trick = ''; b.spin = 0; b.combo = 0;
  world.target = null; me.moving = false;
  world.splashes.push({ x: me.x, y: me.y - 60, t, text, col: '#c23a4a' });
  sfx('click');
}

let deniedAt = 0;
function labDenied(force) {
  if (!force && Date.now() - deniedAt < 4000) return;
  deniedAt = Date.now();
  worldToast('The beetle garden is for the password sign-in: the remilia.net sign-in cannot play the beetle game.', 4500);
}

function enterZone(z) {
  world.zone = z;
  const el = document.getElementById('w-zone');
  el.textContent = z.name; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  tvActive();
}

// sit down on a seat, and get up again in front of it
function sitDown(seat) {
  const me = world.cats.get(world.me);
  if (!me || world.skate) return;
  if (world.cats.size && [...world.cats.values()].some(c => c !== me && c.si && Math.hypot(c.x - seat.x, c.y - seat.y) < 8)) return worldToast('Someone is sitting there.');
  world.target = null; world.keyWalk = false;
  world.sit = seat; me.si = true;
  worldTick?.();
}
function standUp(me) {
  const s = world.sit;
  world.sit = null; me.si = false;
  me.x = me.tx = s.at.x; me.y = me.ty = s.at.y;
}
function worldAct() { if (world.near) { world.pending = null; world.near.act(); } }

// ── the ball ─────────────────────────────────────────────────────────────────
function fold(p, a, b) { const l = b - a; let q = (p - a) % (2 * l); if (q < 0) q += 2 * l; return a + (q <= l ? q : 2 * l - q); }
function ballAt(clock) {
  const b = world.ball, d = (1 - Math.exp(-BALL_K * Math.max(0, clock - b.t0))) / BALL_K;
  const speed = Math.hypot(b.vx, b.vy) * Math.exp(-BALL_K * Math.max(0, clock - b.t0));
  const k = b.ox || b.oy ? Math.max(0, 1 - (clock - b.oAt) / 0.35) : 0;
  if (b.goal === undefined) b.goal = ballGoal(b);
  if (b.goal && clock >= b.goal.t) return { x: b.goal.side === 'r' ? PEN[2] + 14 : PEN[0] - 14, y: b.goal.y, speed: 0, inGoal: b.goal.side };
  return { x: fold(b.x + b.vx * d, PEN[0], PEN[2]) + (b.ox || 0) * k, y: fold(b.y + b.vy * d, PEN[1], PEN[3]) + (b.oy || 0) * k, speed };
}
// the first time the ball rolls into a goal, or null: it meets a goal line at
// x = edge + n·L as if the pitch were unfolded, and counts if the mouth is there (goalOf() in world.php)
function ballGoal(b) {
  if (!b.vx) return null;
  const L = PEN[2] - PEN[0];
  for (let n = 0; n < 12; n++) {
    const d = ((b.vx > 0 ? PEN[2] + n * L : PEN[0] - n * L) - b.x) / b.vx;
    if (d < 0) continue;
    if (BALL_K * d >= 0.97) break;                       // it stops before it gets there
    const y = fold(b.y + b.vy * d, PEN[1], PEN[3]);
    if (y > GOAL[0] + 4 && y < GOAL[1] - 4) return { t: b.t0 - Math.log(1 - BALL_K * d) / BALL_K, side: (b.vx > 0) === (n % 2 === 0) ? 'r' : 'l', y };
  }
  return null;
}
// a kick from the server: start from where the ball is drawn now and let the
// difference melt away, and leave it alone when only the network jitters
function syncBall(s, clock) {
  const b = world.ball, t0 = clock - s.age;
  const same = b.sx === s.x && b.sy === s.y && b.svx === s.vx && b.svy === s.vy;
  if (same && Math.abs(b.t0 - t0) < 0.25) return;
  const was = ballAt(clock);
  world.ball = { x: s.x, y: s.y, vx: s.vx, vy: s.vy, t0, sx: s.x, sy: s.y, svx: s.vx, svy: s.vy, ox: 0, oy: 0, oAt: clock };
  if (!same) {
    const now = ballAt(clock);
    const ox = was.x - now.x, oy = was.y - now.y;
    if (Math.hypot(ox, oy) < 160) Object.assign(world.ball, { ox, oy });
  }
}
function kickCheck(me, clock) {
  if (!me.moving || performance.now() - world.kickAt < 450) return;
  const b = ballAt(clock);
  if (b.inGoal) return;
  const dx = b.x - me.x, dy = b.y - (me.y - 6), dist = Math.hypot(dx, dy);
  if (dist > 26) return;
  const v = 420 + Math.random() * 160;
  const vx = dx / (dist || 1) * v, vy = dy / (dist || 1) * v;
  world.kickAt = performance.now();
  world.ball = { x: b.x, y: b.y, vx, vy, t0: clock, sx: world.ball.sx, sy: world.ball.sy, svx: world.ball.svx, svy: world.ball.svy };
  worldSend({ kick: { vx: Math.round(vx), vy: Math.round(vy) } }, true);
  sfx('click');
}

// ── beetles to catch ─────────────────────────────────────────────────────────
function liveBugs() {
  const t = netNow(), out = [];
  for (let k = 0; k < (world.bn || 6); k++) {
    const b = bugAt(k, t);
    if (!world.gone.has(b.id)) out.push(b);
  }
  return out;
}
function catchCheck(me) {
  if (world.catching.size || performance.now() < (world.catchWait || 0)) return;
  for (const b of liveBugs()) {
    if (Math.hypot(b.x - me.x, b.y - me.y) > 30) continue;
    world.catching.add(b.id);
    worldSend({ catch: b.id }, true);
    return;
  }
}

// ── the dance floor in Cyberia: each tile has a note ─────────────────────────
let chimeCtx = null;
function chime(i) {
  if (SFX.isMuted?.()) return;
  try {
    chimeCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const f = 330 * 2 ** ([0, 2, 4, 7, 9, 12, 14, 16, 19, 21][i % 10] / 12);
    const t = chimeCtx.currentTime, o = chimeCtx.createOscillator(), g = chimeCtx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(chimeCtx.destination); o.start(t); o.stop(t + 1);
  } catch {}
}
const danceTile = c => inRect(c.x, c.y, DANCE) ? `${Math.floor((c.x - DANCE.x) / 30)},${Math.floor((c.y - DANCE.y) / 30)}` : '';
function danceCheck(me) {
  const t = danceTile(me);
  if (t && t !== world.tile) { const [a, b] = t.split(',').map(Number); chime(a + (DANCE.h / 30 - 1 - b) * 2); }
  world.tile = t;
}

// ── drawing ──────────────────────────────────────────────────────────────────
function noiseTile(alpha) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = Math.random() < 0.5 ? alpha : 0; }
  g.putImageData(d, 0, 0);
  return c;
}

// the sky, as on remilia.net: blue with clouds, dithered down to a few colours
const SKY = ['#2b62c4', '#3a74d6', '#4d88e3', '#68a0ec', '#8cbaf3', '#b6d4f8', '#dfecfc', '#ffffff'];
const SKY_HUE = 216;                 // the hue of the sky above; the slider in the settings turns it
const hexRgb = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
function hueShift([r, g, b], dh) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [r, g, b].map(v => Math.round(v * 255));
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return hslRgb(((h * 60 + dh) % 360 + 360) % 360, s, l);
}
const skyCol = () => world.dark ? '#050407' : `rgb(${hueShift(hexRgb('#4d88e3'), world.hue - SKY_HUE).join(',')})`;
const NIGHT = ['#05040a', '#0a0918', '#111028', '#1a1838', '#26234a', '#35305c', '#4a4470', '#6a6290'];
function buildSky(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), d = g.createImageData(w, h);
  const pal = world.dark ? NIGHT.map(hexRgb) : SKY.map(x => hueShift(hexRgb(x), world.hue - SKY_HUE));
  const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const seed = 7.31;
  const vn = (x, y) => {          // value noise
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const r = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7 + seed) * 43758.5453; return v - Math.floor(v); };
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = x / w * 9, ny = y / h * 11;
    let f = 0, a = 0.5, k = 1;
    for (let o = 0; o < 5; o++) { f += vn(nx * k, ny * k * 1.8) * a; a /= 2; k *= 2.03; }
    const cloud = Math.max(0, Math.min(1, (f - 0.5) / 0.2));
    const v = world.dark ? 0.04 + (y / h) * 0.2 + cloud * 0.55 : 0.08 + (y / h) * 0.32 + cloud * 0.75;
    const i = Math.max(0, Math.min(pal.length - 1, Math.floor(v * (pal.length - 1) + B[(y & 3) * 4 + (x & 3)] / 16)));
    const o = (y * w + x) * 4, col = pal[i];
    d.data[o] = col[0]; d.data[o + 1] = col[1]; d.data[o + 2] = col[2]; d.data[o + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  if (world.dark) for (let i = 0; i < w * h / 900; i++) {
    g.fillStyle = hrand(i) < 0.15 ? '#fff3c4' : '#c9c6e8';
    g.fillRect((hrand(i * 3.1) * w) | 0, (hrand(i * 7.7) * h) | 0, 1, 1);
  }
  return c;
}

// everything that never moves, drawn once at one pixel per world unit
// the look out here: a dither, a + at every crossing, the flower with five petals and a star in it
function dither(g, r, col) {
  g.fillStyle = col;
  for (let y = r.y; y < r.y + r.h; y += 2) for (let x = r.x + (y / 2 % 2) * 2; x < r.x + r.w; x += 4) if (((x * 7 + y * 13) >> 3) % 3) g.fillRect(x, y, 1, 1);
}
function plusGrid(g, r, step, col) {
  g.fillStyle = col;
  for (let y = Math.ceil(r.y / step) * step; y < r.y + r.h; y += step) for (let x = Math.ceil(r.x / step) * step; x < r.x + r.w; x += step) { g.fillRect(x - 3, y, 7, 1); g.fillRect(x, y - 3, 1, 7); }
}
function flowerStar(g, cx, cy, R, petal, star) {
  g.fillStyle = petal;
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; g.beginPath(); g.ellipse(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5 * 0.7, R * 0.42, R * 0.42 * 0.7, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = star; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? R * 0.14 : R * 0.34; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7); }
  g.closePath(); g.fill();
}
function buildBackground() {
  const c = document.createElement('canvas'); c.width = WORLD_W; c.height = WORLD_H;
  const g = c.getContext('2d');
  // the same every time (mulberry32), so the grass does not jump about on a redraw
  let seed = 777;
  const rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rnd = (a, b) => a + rand() * (b - a);
  const sky = buildSky(WORLD_W / 2, WORLD_H / 2);
  world.sky = sky;
  g.imageSmoothingEnabled = false;
  g.drawImage(sky, 0, 0, WORLD_W, WORLD_H);
  try { document.body.style.setProperty('--sky', `url(${sky.toDataURL()})`); } catch {}
  // the platforms: grey plastic slabs with a lit edge, a side and a shadow on the clouds
  const P = PLATFORMS;
  const D = world.dark;
  g.fillStyle = D ? 'rgba(0,0,0,0.5)' : 'rgba(16,40,110,0.28)';
  for (const p of P) roundRect(g, p.x + 14, p.y + 36, p.w, p.h, 14), g.fill();
  for (const p of P) {
    const side = g.createLinearGradient(0, p.y + p.h - 10, 0, p.y + p.h + 22);
    side.addColorStop(0, D ? '#2a2733' : '#9da3b6'); side.addColorStop(1, D ? '#05040a' : '#6d7389');
    g.fillStyle = side; roundRect(g, p.x, p.y + 10, p.w, p.h + 12, 12); g.fill();
  }
  for (const p of P) {
    const top = g.createLinearGradient(0, p.y, 0, p.y + p.h);
    top.addColorStop(0, D ? '#16152a' : '#e9e8f8'); top.addColorStop(1, D ? '#10101e' : '#cfd6f0');
    g.fillStyle = top; roundRect(g, p.x, p.y, p.w, p.h, 12); g.fill();
  }
  // seams in the plastic, and the lit rim
  g.save();
  g.beginPath(); for (const p of P) g.rect(p.x + 6, p.y + 6, p.w - 12, p.h - 12); g.clip();
  // an old screen's dither over the plastic, and a + at every crossing instead of seams
  const all = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
  dither(g, all, D ? 'rgba(140,150,255,0.05)' : 'rgba(35,40,106,0.06)');
  plusGrid(g, all, 40, D ? 'rgba(140,150,255,0.16)' : 'rgba(35,40,106,0.22)');
  g.restore();
  g.fillStyle = D ? 'rgba(232,214,138,0.18)' : 'rgba(80,90,130,0.16)';
  // the middle lines of the streets, round the plaza and the pond
  for (let x = 90; x < 2300; x += 60) if (x < 940 || x > 1410) g.fillRect(x, 1054, 30, 3);
  for (let y = 60; y < 2060; y += 60) if ((y < 500 || y > 720) && (y < 880 || y > 1210)) g.fillRect(1184, y, 3, 30);
  // the plaza: rings around the well
  for (let r = 200; r > 40; r -= 40) {
    g.strokeStyle = D ? `rgba(120,140,255,${0.03 + (200 - r) / 3000})` : `rgba(60,100,200,${0.06 + (200 - r) / 1500})`; g.lineWidth = 2;
    g.beginPath(); g.ellipse(WELL.x, WELL.y, r, r * 0.7, 0, 0, Math.PI * 2); g.stroke();
  }
  // the pond: a hole in the platform with the sky showing through
  g.save();
  g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2); g.clip();
  g.drawImage(sky, (POND.x - POND.rx - 4) / 2, (POND.y + 80) / 2, POND.rx + 4, POND.ry + 4, POND.x - POND.rx - 4, POND.y - POND.ry - 4, POND.rx * 2 + 8, POND.ry * 2 + 8);
  g.restore();
  g.strokeStyle = D ? '#2a2733' : '#9da3b6'; g.lineWidth = 4; g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = D ? '#4a4460' : '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(POND.x, POND.y - 2, POND.rx + 2, POND.ry + 1, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();

  // floors
  const floor = (z, fn) => { g.save(); g.beginPath(); roundRect(g, z.x, z.y, z.w, z.h, 12); g.clip(); fn(z); g.restore(); };
  floor(z0('club'), z => {
    g.fillStyle = '#120d1a'; g.fillRect(z.x, z.y, z.w, z.h);
    for (let y = z.y; y < z.y + z.h; y += 30) for (let x = z.x; x < z.x + z.w; x += 30) {
      g.fillStyle = ((x + y) / 30) % 2 ? '#1a1326' : '#100b18'; g.fillRect(x, y, 30, 30);
    }
    // the dance floor stands out: glassy tiles in a neon frame
    for (let y = DANCE.y; y < DANCE.y + DANCE.h; y += 30) for (let x = DANCE.x; x < DANCE.x + DANCE.w; x += 30) {
      g.fillStyle = ((x + y) / 30) % 2 ? '#2a1f3d' : '#221833'; g.fillRect(x + 1, y + 1, 28, 28);
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 2, y + 2, 26, 6);
    }
    g.strokeStyle = 'rgba(255,90,200,0.55)'; g.lineWidth = 3; g.strokeRect(DANCE.x - 4, DANCE.y - 4, DANCE.w + 8, DANCE.h + 8);
    g.strokeStyle = 'rgba(90,220,255,0.35)'; g.lineWidth = 1; g.strokeRect(DANCE.x - 9, DANCE.y - 9, DANCE.w + 18, DANCE.h + 18);
  });
  floor(z0('shop'), z => {
    // dithered from lavender at the top to sky blue, a + at every crossing, like an old system screen
    const fl = g.createLinearGradient(0, z.y, 0, z.y + z.h);
    fl.addColorStop(0, D ? '#0b0c18' : '#e6e2f7'); fl.addColorStop(1, D ? '#0a1020' : '#cfdcf5');
    g.fillStyle = fl; g.fillRect(z.x, z.y, z.w, z.h);
    dither(g, z, D ? 'rgba(120,140,255,0.06)' : 'rgba(35,40,106,0.07)');
    plusGrid(g, z, 32, D ? 'rgba(120,140,255,0.22)' : 'rgba(35,40,106,0.3)');
    // a raised walkway of navy panels down the middle, and the flower with its star set into the floor
    g.fillStyle = D ? 'rgba(40,50,120,0.25)' : 'rgba(35,40,106,0.08)'; g.fillRect(1550, 680, 760, 120);
    flowerStar(g, 2000, 742, 46, D ? 'rgba(160,180,255,0.35)' : 'rgba(35,40,106,0.25)', D ? 'rgba(255,215,90,0.5)' : 'rgba(255,190,40,0.7)');
  });
  floor(z0('slots'), z => {
    // a casino carpet: deep red with gold diamonds
    g.fillStyle = D ? '#2a0c14' : '#7a1a2a'; g.fillRect(z.x, z.y, z.w, z.h);
    g.fillStyle = D ? 'rgba(255,180,61,0.12)' : 'rgba(255,200,90,0.28)';
    for (let y = z.y; y < z.y + z.h; y += 28) for (let x = z.x + ((y - z.y) / 28 % 2) * 14; x < z.x + z.w; x += 28) {
      g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.fill();
    }
  });
  const grass = (z, base, n, flowers) => {
    g.fillStyle = base; g.fillRect(z.x, z.y, z.w, z.h);
    for (let i = 0; i < n; i++) { g.fillStyle = D ? `rgba(${rnd(30, 50) | 0},${rnd(60, 90) | 0},${rnd(30, 50) | 0},${rnd(0.2, 0.4)})` : `rgba(${rnd(70, 120) | 0},${rnd(140, 180) | 0},${rnd(80, 110) | 0},${rnd(0.12, 0.3)})`; g.fillRect(rnd(z.x, z.x + z.w) | 0, rnd(z.y, z.y + z.h) | 0, 2, 4); }
    for (let i = 0; i < flowers; i++) {
      const x = rnd(z.x + 20, z.x + z.w - 20), y = rnd(z.y + 20, z.y + z.h - 20);
      g.fillStyle = D ? ['#8a86a8', '#7a5a70', '#8a8050', '#6a6290'][i % 4] : ['#ffffff', '#ffd6ea', '#fff3b0', '#d9d4ff'][i % 4];
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) g.fillRect(x + ox, y + oy, 2, 2);
      g.fillStyle = '#e8b84a'; g.fillRect(x, y, 2, 2);
    }
  };
  floor(z0('park'), z => {
    grass(z, D ? '#0c0f0a' : '#cfe6c6', 2600, 50);
    // flower beds in the meadow below the pitch
    for (const [x, y] of [[180, 1516], [320, 1630]]) {
      g.fillStyle = D ? '#1a140f' : '#a0805e'; roundRect(g, x, y, 120, 44, 12); g.fill();
      for (let i = 0; i < 18; i++) { g.fillStyle = D ? ['#5a4a70', '#6a3a4a', '#6a6040'][i % 3] : ['#ff7aa8', '#ffd34d', '#c7a6ff', '#ffffff'][i % 4]; g.fillRect(x + 8 + rnd(0, 100), y + 6 + rnd(0, 28), 5, 5); }
    }
  });
  floor(z0('garden'), z => {
    grass(z, D ? '#0d110b' : '#cde5c4', 1400, 30);
    // stepping stones from the gate to the workbench
    g.fillStyle = D ? 'rgba(120,115,140,0.35)' : 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(846 - i * 26 + (i % 2 ? 8 : -8), 1232 + i * 24, 16, 8, 0, 0, Math.PI * 2); g.fill(); }
    // beds of the flowers the beetles like
    for (const [x, y] of [[820, 1340], [540, 1400], [690, 1412]]) {
      g.fillStyle = D ? '#1a140f' : '#9b7a56'; roundRect(g, x, y, 110, 46, 14); g.fill();
      for (let i = 0; i < 18; i++) { g.fillStyle = D ? ['#5a4a70', '#6a3a4a', '#6a6040'][i % 3] : ['#ff9fc2', '#ffe27a', '#b9a6ff', '#ffffff', '#ff7a5a'][i % 5]; g.fillRect(x + 8 + rnd(0, 90), y + 6 + rnd(0, 30), 5, 5); }
    }
  });

  window.placeFloors?.(g, floor, grass, rnd, D);                 // the new places (places.js)

  // walls: a lit top and a face below it; Cyberia stays dark, the garden has a hedge
  const club = z0('club'), jade = z0('jade'), alley = z0('alley');
  for (const s of world.solids) {
    if (s.k === 'hedge') {
      g.fillStyle = 'rgba(20,50,20,0.3)'; g.fillRect(s.x, s.y + s.h, s.w, 6);
      g.fillStyle = D ? '#14261a' : '#4f9d58'; roundRect(g, s.x, s.y - 6, s.w, s.h + 6, 6); g.fill();
      g.fillStyle = D ? '#1d3524' : '#6fbf6e';
      for (let i = 0; i < (s.w + s.h) / 9; i++) g.fillRect(s.x + rnd(0, s.w - 4), s.y - 6 + rnd(0, s.h), 4, 3);
      continue;
    }
    if (s.k === 'fence') {                                  // the garden: tall iron railings over a stone base, no jumping these
      g.fillStyle = 'rgba(20,20,40,0.3)'; g.fillRect(s.x, s.y + s.h, s.w, 8);
      g.fillStyle = D ? '#4a4562' : '#b9bccb'; g.fillRect(s.x, s.y + s.h - 12, s.w, 12);
      g.fillStyle = D ? '#6e6890' : '#e6e8f0'; g.fillRect(s.x, s.y + s.h - 12, s.w, 2);
      g.fillStyle = D ? '#a9a3cc' : '#3a3550';               // pale railings at night, so they show against the dark
      g.fillRect(s.x, s.y - 26, s.w, 3); g.fillRect(s.x, s.y - 8, s.w, 2);
      const vert = s.h > s.w;
      for (let i = 2; i < (vert ? s.h : s.w); i += 9) {
        const bx = vert ? s.x + s.w / 2 - 1 : s.x + i, by = vert ? s.y + i : s.y;
        g.fillRect(bx, by - 30, 2, vert ? 20 : s.h + 18);
        g.beginPath(); g.moveTo(bx - 2, by - 30); g.lineTo(bx + 1, by - 36); g.lineTo(bx + 4, by - 30); g.fill();
      }
      continue;
    }
    if (s.k === 'prop') continue;                          // drawn by places.js
    if (s.w === 16 && s.h === 16) continue;               // poles are drawn with the wires
    if (s.k === 'pond') continue;
    const dark = inRect(s.x + 1, s.y + 1, club);
    if ([STALL_SOLID, BIN_SOLID].some(([x, y]) => s.x === x && s.y === y)) continue;
    if (inRect(s.x + 1, s.y + 1, alley)) {                  // the back alley: old brick
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(s.x, s.y + s.h, s.w, 8);
      g.fillStyle = D ? '#2a1a1a' : '#7a4a3e'; g.fillRect(s.x, s.y, s.w, s.h);
      g.fillStyle = D ? '#1a0f10' : '#5a3228';
      for (let y = s.y; y < s.y + s.h; y += 6) for (let x = s.x + ((y - s.y) / 6 % 2) * 6; x < s.x + s.w; x += 12) g.fillRect(x, y, 1, 6);
      for (let y = s.y + 5; y < s.y + s.h; y += 6) g.fillRect(s.x, y, s.w, 1);
      continue;
    }
    if (inRect(s.x + 1, s.y + 1, jade)) {                   // the Jade Arches: red lacquer, a gold rail
      g.fillStyle = D ? 'rgba(0,0,0,0.5)' : 'rgba(80,10,10,0.25)'; g.fillRect(s.x, s.y + s.h, s.w, 8);
      g.fillStyle = D ? '#4a0f14' : '#a81e26'; g.fillRect(s.x, s.y, s.w, s.h);
      g.fillStyle = D ? '#8a6a1a' : '#f2cf5a'; g.fillRect(s.x, s.y, s.w, 3); g.fillRect(s.x, s.y + s.h - 3, s.w, 1);
      continue;
    }
    g.fillStyle = dark ? 'rgba(10,6,16,0.6)' : D ? 'rgba(0,0,0,0.5)' : 'rgba(40,50,90,0.22)'; g.fillRect(s.x, s.y + s.h, s.w, 8);
    // old grey computer plastic with a navy stripe and a screw now and then
    g.fillStyle = dark ? '#221a2e' : D ? '#1d1c26' : '#d6d5cf'; g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = dark ? '#3a2d4a' : D ? '#2c2a38' : '#f1f0ea'; g.fillRect(s.x, s.y, s.w, 2);
    if (!dark) {
      g.fillStyle = D ? '#05040a' : '#a9a89f'; g.fillRect(s.x, s.y + s.h - 2, s.w, 2);
      g.fillStyle = D ? '#2a3070' : '#23286a';
      if (s.h >= 10 && s.w > s.h) g.fillRect(s.x, s.y + Math.floor(s.h / 2) - 1, s.w, 2);
      else if (s.w >= 10) g.fillRect(s.x + Math.floor(s.w / 2) - 1, s.y, 2, s.h);
      g.fillStyle = D ? '#4a4858' : '#8f8e86';
      if (s.w > s.h) for (let x = s.x + 20; x < s.x + s.w - 10; x += 80) g.fillRect(x, s.y + 3, 2, 2);
      else for (let y = s.y + 20; y < s.y + s.h - 10; y += 80) g.fillRect(s.x + 3, y, 2, 2);
    }
  }
  drawFurniture(g, D);
  drawTerminal(g, D);
  drawNotice(g, D);
  // the well: a soft halo on the plaza and the flower round it, light falls on it from above
  const halo = g.createRadialGradient(WELL.x, WELL.y, 20, WELL.x, WELL.y, 190);
  halo.addColorStop(0, D ? 'rgba(170,180,255,0.22)' : 'rgba(255,255,255,0.75)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo; g.beginPath(); g.ellipse(WELL.x, WELL.y, 190, 133, 0, 0, Math.PI * 2); g.fill();
  flowerStar(g, WELL.x, WELL.y + 4, 130, D ? 'rgba(140,160,255,0.08)' : 'rgba(35,40,106,0.07)', D ? 'rgba(255,215,90,0.12)' : 'rgba(255,190,40,0.18)');
  g.fillStyle = D ? 'rgba(140,160,255,0.35)' : 'rgba(35,40,106,0.35)'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('天 使 の 井 戸', WELL.x, WELL.y + 118);
  g.fillStyle = 'rgba(80,80,140,0.18)'; g.beginPath(); g.ellipse(WELL.x, WELL.y + 14, 44, 16, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = D ? '#2a2733' : '#e9e7f2'; g.beginPath(); g.ellipse(WELL.x, WELL.y, 38, 22, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = D ? '#1b1922' : '#c9c6dc'; g.fillRect(WELL.x - 38, WELL.y, 76, 12);
  g.beginPath(); g.ellipse(WELL.x, WELL.y + 12, 38, 22, 0, 0, Math.PI); g.fill();
  // garden: tree trunks, the workbench with jars of beetles on it
  for (const [x, y] of TREES) { g.fillStyle = '#7a5a44'; g.fillRect(x - 8, y - 40, 16, 46); g.fillStyle = 'rgba(40,80,40,0.25)'; g.beginPath(); g.ellipse(x, y + 6, 40, 12, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#b48a64'; g.fillRect(675, 1330, 120, 40);
  g.fillStyle = '#d4ab82'; g.fillRect(675, 1330, 120, 5);
  g.fillStyle = '#8a6646'; g.fillRect(681, 1370, 6, 10); g.fillRect(783, 1370, 6, 10);
  // the dumpster in the back alley: dented steel, the lid propped open, a bag spilling out
  const bn = BIN;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(bn.x + 4, bn.y + bn.h - 2, bn.w, 8);
  g.fillStyle = D ? '#173328' : '#2f6b52'; g.fillRect(bn.x, bn.y + 12, bn.w, bn.h - 12);
  g.fillStyle = D ? '#0e2219' : '#245640'; for (let x = bn.x + 10; x < bn.x + bn.w - 4; x += 16) g.fillRect(x, bn.y + 16, 3, bn.h - 22);
  g.fillStyle = D ? '#24453a' : '#3f8a6a'; g.fillRect(bn.x - 3, bn.y + 10, bn.w + 6, 5);
  g.fillStyle = D ? '#4a3a2a' : '#8a5a3a'; g.fillRect(bn.x + 6, bn.y + bn.h - 12, 10, 6); g.fillRect(bn.x + bn.w - 22, bn.y + 22, 8, 5);   // rust
  g.fillStyle = D ? '#1a1820' : '#2a2833';
  g.beginPath(); g.moveTo(bn.x - 2, bn.y + 10); g.lineTo(bn.x + 6, bn.y - 6); g.lineTo(bn.x + bn.w + 6, bn.y - 6); g.lineTo(bn.x + bn.w + 2, bn.y + 10); g.fill();   // the lid
  g.fillStyle = D ? '#22202a' : '#3a3848'; g.beginPath(); g.ellipse(bn.x + 30, bn.y + 8, 14, 8, 0, 0, Math.PI * 2); g.fill();   // a bin bag
  g.fillStyle = '#f2f2f2'; g.fillRect(bn.x + 50, bn.y + 26, 18, 12);                                  // a sticker
  g.fillStyle = '#d63a6a'; g.fillRect(bn.x + 58, bn.y + 28, 2, 8); g.fillRect(bn.x + 55, bn.y + 31, 8, 2);
  g.fillStyle = D ? '#d9d6e6' : '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('拾', bn.x + 22, bn.y + 32);
  // the mailbox: a red box on a post (the flag is drawn live)
  const mb = MAILBOX;
  g.fillStyle = 'rgba(30,30,60,0.25)'; g.fillRect(mb.x + 4, mb.y + mb.h - 3, mb.w - 4, 6);
  g.fillStyle = D ? '#3a3648' : '#8a8fa3'; g.fillRect(mb.x + 10, mb.y + 34, 6, mb.h - 34);
  g.fillStyle = D ? '#8a2a28' : '#d8443c';
  g.beginPath(); g.moveTo(mb.x, mb.y + 38); g.lineTo(mb.x, mb.y + 10); g.arc(mb.x + mb.w / 2, mb.y + 10, mb.w / 2, Math.PI, 0); g.lineTo(mb.x + mb.w, mb.y + 38); g.fill();
  g.fillStyle = D ? '#5c1c1b' : '#a8302a'; g.fillRect(mb.x, mb.y + 34, mb.w, 4);
  g.fillStyle = D ? '#1a1820' : '#3a2a2a'; g.fillRect(mb.x + 6, mb.y + 16, mb.w - 12, 3);
  g.fillStyle = D ? '#c9b07a' : '#ffe6a8'; g.font = wf(9, 'bold'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✉', mb.x + mb.w / 2, mb.y + 27);
  window.placeProps?.(g, D, rnd);
  world.bg = c;
}
// the furniture in FURNITURE, one look per kind
function drawFurniture(g, D) {
  const shop = z0('shop');
  const shade = (x, y, w, h) => { g.fillStyle = 'rgba(20,20,50,0.22)'; g.fillRect(x + 3, y + h, w, 6); };
  for (const [x, y, w, h, k] of FURNITURE) {
    if (k === 'speaker') {
      g.fillStyle = '#07050a'; g.fillRect(x, y, w, h);
      g.fillStyle = '#1d1a22';
      for (let cy = y + 22; cy < y + h - 10; cy += 40) { g.beginPath(); g.arc(x + w / 2, cy, w / 2 - 8, 0, Math.PI * 2); g.fill(); }
    } else if (k === 'bar') {
      g.fillStyle = '#1a1022'; g.fillRect(x + 46, y, w - 46, h);                 // the shelf on the wall
      const cols = ['#5be0c0', '#ff3d6e', '#ffd34d', '#8f7cff', '#ff9a3d'];
      for (let by = y + 12; by < y + h - 16; by += 26) for (let i = 0; i < 3; i++) {
        g.fillStyle = cols[(by / 26 + i) % 5 | 0]; g.globalAlpha = 0.75; g.fillRect(x + 54 + i * 12, by, 7, 16); g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(10,6,16,0.6)'; g.fillRect(x, y + h, 40, 8);
      g.fillStyle = '#2a1f33'; g.fillRect(x, y, 40, h);                         // the counter
      g.fillStyle = '#4a3658'; g.fillRect(x, y, 40, 4); g.fillRect(x, y, 4, h);
      g.fillStyle = 'rgba(255,61,110,0.5)'; g.fillRect(x - 2, y + 8, 2, h - 16);   // a neon strip along the front
    } else if (k === 'sofa' || k === 'couch') {
      g.fillStyle = 'rgba(10,6,16,0.6)'; g.fillRect(x, y + h, w, 6);
      // the club's couches are plum, the terminal's a cool blue
      const [c1, c2] = inRect(x, y, shop) ? (D ? ['#1f2a44', '#2c3b5e'] : ['#5b63e6', '#8a90f0']) : ['#5a1838', '#7a2850'];
      g.fillStyle = c1; roundRect(g, x, y, w, h, 8); g.fill();
      g.fillStyle = c2;
      if (k === 'sofa') { roundRect(g, x + 14, y + 6, w - 18, h - 12, 6); g.fill(); g.fillStyle = c1; for (let i = 1; i < 3; i++) g.fillRect(x + 14, y + 6 + i * (h - 12) / 3, w - 18, 2); }
      else { roundRect(g, x + 6, y + 4, w - 12, h - 16, 6); g.fill(); g.fillStyle = c1; for (let i = 1; i < 4; i++) g.fillRect(x + 6 + i * (w - 12) / 4, y + 4, 2, h - 16); }
    } else if (k === 'table') {
      g.fillStyle = 'rgba(10,6,16,0.6)'; g.fillRect(x + 4, y + h, w - 8, 6);
      g.fillStyle = inRect(x, y, shop) && !D ? '#c9cbe0' : '#231a2c'; roundRect(g, x, y, w, h, 10); g.fill();
      g.fillStyle = inRect(x, y, shop) && !D ? '#e6e7f2' : '#3a2d4a'; roundRect(g, x + 3, y + 3, w - 6, 6, 3); g.fill();
      g.fillStyle = 'rgba(91,224,192,0.8)'; g.fillRect(x + w / 2 - 8, y + h / 2 - 6, 6, 10);
      g.fillStyle = 'rgba(255,61,110,0.8)'; g.fillRect(x + w / 2 + 4, y + h / 2 - 4, 6, 8);
    } else if (k === 'stool') {
      g.fillStyle = '#3a2d4a'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a4870'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2 - 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2); g.fill();
    } else if (k === 'booth') {
      // a changing booth: a frame with a curtain drawn half across
      shade(x, y, w, h);
      g.fillStyle = D ? '#2a2440' : '#e9e7f2'; g.fillRect(x, y, w, h);
      g.fillStyle = D ? '#5a5670' : '#9da3b6'; g.fillRect(x, y, w, 5); g.fillRect(x, y, 4, h); g.fillRect(x + w - 4, y, 4, h);
      g.fillStyle = D ? '#6a2448' : '#d65bb6'; g.fillRect(x + 4, y + 5, w * 0.62, h - 5);
      g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 1; i < 5; i++) g.fillRect(x + 4 + i * w * 0.62 / 5, y + 5, 2, h - 5);
      g.fillStyle = D ? '#8a86a8' : '#ffd34d'; g.beginPath(); g.arc(x + w - 14, y + h / 2, 3, 0, Math.PI * 2); g.fill();
    } else if (k === 'mirror') {
      shade(x, y, w, h);
      g.fillStyle = D ? '#5a5670' : '#c9a13b'; roundRect(g, x, y, w, h, w / 2); g.fill();
      const m = g.createLinearGradient(x, y, x + w, y + h);
      m.addColorStop(0, D ? '#3a4a66' : '#dff2ff'); m.addColorStop(1, D ? '#1d2436' : '#9cc8e8');
      g.fillStyle = m; roundRect(g, x + 4, y + 4, w - 8, h - 8, w / 2 - 4); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 12, y + 30); g.lineTo(x + 26, y + 14); g.moveTo(x + 12, y + 44); g.lineTo(x + 30, y + 24); g.stroke(); g.lineWidth = 1;
    } else if (k === 'mannequin') {
      g.fillStyle = 'rgba(20,20,50,0.22)'; g.beginPath(); g.ellipse(x + w / 2, y + h, 16, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = D ? '#4a4460' : '#8c86a3'; g.fillRect(x + w / 2 - 2, y - 20, 4, 30); g.fillRect(x + 2, y + h - 4, w - 4, 4);
      g.fillStyle = D ? '#6a5a8a' : '#c7a6ff'; roundRect(g, x, y - 52, w, 34, 8); g.fill();
      g.fillStyle = D ? '#8a86a8' : '#f4f2fa'; g.beginPath(); g.arc(x + w / 2, y - 62, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff3d6e'; g.fillRect(x + w / 2 - 12, y - 74, 24, 6);
    } else if (k === 'crt') {
      // a grey plastic desk with a beige CRT on it, green text on the screen, a keyboard
      shade(x, y, w, h);
      g.fillStyle = D ? '#24222c' : '#a9a89f'; g.fillRect(x, y + 10, w, h - 10);
      g.fillStyle = D ? '#2c2a36' : '#d6d5cf'; g.fillRect(x, y + 6, w, 8);
      g.fillStyle = D ? '#3a3846' : '#c9c6b8'; roundRect(g, x + 14, y - 22, 36, 30, 4); g.fill();
      g.fillStyle = D ? '#06120a' : '#1c2a14'; g.fillRect(x + 18, y - 18, 28, 20);
      g.fillStyle = D ? '#5be0a0' : '#9ef07a'; for (let i = 0; i < 4; i++) g.fillRect(x + 21, y - 15 + i * 4, 6 + ((x / 20 + i * 7) % 16), 2);
      g.fillStyle = D ? '#3a3846' : '#e9e7dc'; g.fillRect(x + 16, y + 8, 32, 5);
      g.fillStyle = D ? '#24222c' : '#8f8e86'; for (let i = 0; i < 7; i++) g.fillRect(x + 18 + i * 4, y + 9, 3, 1);
    } else if (k === 'chair') {
      g.fillStyle = 'rgba(20,20,50,0.25)'; g.beginPath(); g.ellipse(x + w / 2, y + h + 2, 9, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = D ? '#14131a' : '#3a3d48'; g.fillRect(x + w / 2 - 1, y + h - 4, 2, 6);
      g.fillStyle = D ? '#1f2a5a' : '#23286a'; roundRect(g, x, y, w, h - 4, 4); g.fill();
      g.fillStyle = D ? '#2c3a7a' : '#3a4296'; g.fillRect(x + 2, y + 1, w - 4, 3);
    } else if (k === 'rack') {
      // a server rack: black, rows of blinking lights, a CJK label
      shade(x, y, w, h);
      g.fillStyle = D ? '#07060c' : '#2a2d38'; g.fillRect(x, y, w, h);
      g.fillStyle = D ? '#14131a' : '#3a3d48'; for (let ry = y + 4; ry < y + h - 6; ry += 9) g.fillRect(x + 4, ry, w - 8, 7);
      for (let ry = y + 6, i = 0; ry < y + h - 6; ry += 9, i++) { g.fillStyle = ['#5be0c0', '#ffd34d', '#ff3d6e', '#7fb8ff'][(i + x) % 4]; g.fillRect(x + 7, ry, 2, 2); g.fillRect(x + 12, ry, 2, 2); }
      g.fillStyle = D ? '#9aa0c8' : '#d6d5cf'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('鯖', x + w - 10, y + h - 8);
    } else if (k === 'arcade') {
      shade(x, y, w, h);
      g.fillStyle = D ? '#1a1530' : '#3a2f8a'; g.fillRect(x, y, w, h);
      g.fillStyle = D ? '#2a2050' : '#5a4fd0'; g.fillRect(x, y, 4, h); g.fillRect(x + w - 4, y, 4, h);
      g.fillStyle = '#ff3d6e'; g.fillRect(x + 4, y + 2, w - 8, 8);
      g.fillStyle = '#ffffff'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('甲虫戦士', x + w / 2, y + 6.5);
      g.fillStyle = '#0b0620'; g.fillRect(x + 7, y + 13, w - 14, 22);
      g.fillStyle = '#5be0c0'; g.fillRect(x + 12, y + 26, 6, 4); g.fillStyle = '#ffd34d'; g.fillRect(x + 26, y + 18, 4, 4); g.fillStyle = '#ff3d6e'; g.fillRect(x + 30, y + 28, 3, 3);
      g.fillStyle = D ? '#2c2a36' : '#d6d5cf'; g.fillRect(x + 4, y + 38, w - 8, 10);
      g.fillStyle = '#14131a'; g.fillRect(x + 11, y + 40, 2, 5); g.fillStyle = '#ff3d6e'; g.beginPath(); g.arc(x + 12, y + 40, 2.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x + 28, y + 43, 2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5be0c0'; g.beginPath(); g.arc(x + 34, y + 42, 2, 0, Math.PI * 2); g.fill();
    } else if (k === 'screens') {
      // a wall of old monitors in a grey frame; hubLive-style static, drawn once
      g.fillStyle = D ? '#14131a' : '#8f919c'; g.fillRect(x, y, w, h);
      for (let i = 0; i < 5; i++) {
        const sx = x + 4 + i * 39;
        g.fillStyle = D ? '#2c2a36' : '#d6d5cf'; g.fillRect(sx, y + 3, 36, h - 6);
        const sc = g.createLinearGradient(0, y + 6, 0, y + h - 6);
        sc.addColorStop(0, ['#7fb8ff', '#c7a6ff', '#5be0c0', '#ffd6ea', '#9ef07a'][i]); sc.addColorStop(1, '#1b2a6a');
        g.fillStyle = sc; g.fillRect(sx + 3, y + 6, 30, h - 12);
        g.fillStyle = 'rgba(0,0,0,0.15)'; for (let ly = y + 7; ly < y + h - 6; ly += 2) g.fillRect(sx + 3, ly, 30, 1);
      }
      g.fillStyle = '#ffffff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('終 端', x + 98, y + h / 2);
    } else if (k === 'bench') {
      shade(x, y, w, h);
      g.fillStyle = D ? '#3a2a1e' : '#8a6646'; g.fillRect(x + 6, y + h - 6, 6, 8); g.fillRect(x + w - 12, y + h - 6, 6, 8);
      g.fillStyle = D ? '#5a4030' : '#c99a6a';
      for (let i = 0; i < 3; i++) g.fillRect(x, y + i * 8, w, 6);
      g.fillStyle = D ? '#6a5040' : '#e0b886'; g.fillRect(x, y, w, 2);
    }
  }
}

// the terminal: the boutique's rail and sign, and the buy counter by the door
function drawTerminal(g, D) {
  // the boutique: a long glass case on a grey plastic base, clothes floating on lit plinths inside
  const r = BOUTIQUE;
  g.fillStyle = 'rgba(20,20,50,0.22)'; g.fillRect(r.x + 4, r.y + r.h, r.w, 6);
  g.fillStyle = D ? '#24222c' : '#a9a89f'; g.fillRect(r.x, r.y + r.h - 12, r.w, 12);
  g.fillStyle = D ? '#2c2a36' : '#d6d5cf'; g.fillRect(r.x, r.y + r.h - 14, r.w, 3);
  g.fillStyle = D ? 'rgba(120,140,255,0.12)' : 'rgba(200,220,255,0.55)'; g.fillRect(r.x, r.y - 6, r.w, r.h - 8);
  g.strokeStyle = D ? '#5a5670' : '#23286a'; g.lineWidth = 2; g.strokeRect(r.x + 1, r.y - 5, r.w - 2, r.h + 6); g.lineWidth = 1;
  const cols = ['#ff3d6e', '#5b63e6', '#ffd34d', '#2fae7a', '#c7a6ff', '#ff9a3d', '#5be0c0', '#f4f2fa', '#8a2a5a'];
  for (let i = 0; i < 9; i++) {
    const x = r.x + 14 + i * 32, y = r.y;
    g.fillStyle = D ? 'rgba(91,224,192,0.25)' : 'rgba(255,255,255,0.9)'; g.fillRect(x - 2, y + r.h - 18, 22, 4);
    g.fillStyle = cols[i];
    if (i % 3 === 2) { g.beginPath(); g.moveTo(x + 5, y + 2); g.lineTo(x + 13, y + 2); g.lineTo(x + 18, y + 22); g.lineTo(x, y + 22); g.closePath(); g.fill(); }
    else { g.fillRect(x + 2, y + 2, 14, 18); g.fillRect(x - 2, y + 2, 4, 9); g.fillRect(x + 16, y + 2, 4, 9); }
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x + 8, y + 3, 2, 17);
  }
  g.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(r.x + 30 + i * 74, r.y - 4); g.lineTo(r.x + 44 + i * 74, r.y - 4); g.lineTo(r.x + 24 + i * 74, r.y + r.h - 16); g.lineTo(r.x + 10 + i * 74, r.y + r.h - 16); g.fill(); }
  // a sign on the wall: navy plate, CJK and its name
  const sign = (x, y, w, text, col) => {
    g.fillStyle = D ? '#1b1922' : '#23286a'; roundRect(g, x, y, w, 20, 3); g.fill();
    g.strokeStyle = col; g.lineWidth = 1; roundRect(g, x + 2, y + 2, w - 4, 16, 2); g.stroke();
    g.fillStyle = col; g.font = 'bold 11px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + w / 2, y + 11);
  };
  sign(1520, 334, 160, '服  BOUTIQUE', '#c7a6ff');
  // the buy counter: a grey kiosk with a green screen and a coin slot
  const st = STALL;
  g.fillStyle = 'rgba(30,30,60,0.25)'; g.fillRect(st.x + 4, st.y + st.h, st.w, 8);
  g.fillStyle = D ? '#14131a' : '#8f919c'; roundRect(g, st.x, st.y + 4, st.w, st.h - 4, 6); g.fill();
  g.fillStyle = D ? '#2c2a36' : '#d6d5cf'; roundRect(g, st.x, st.y, st.w, st.h - 8, 6); g.fill();
  g.fillStyle = D ? '#3a3846' : '#f1f0ea'; g.fillRect(st.x + 6, st.y + 1, st.w - 12, 2);
  g.fillStyle = D ? '#0a0c08' : '#5a6040'; g.fillRect(st.x + 10, st.y + 8, 62, 26);
  g.fillStyle = D ? '#1e2a14' : '#b7c48a'; g.fillRect(st.x + 12, st.y + 10, 58, 22);
  g.fillStyle = D ? '#9ef07a' : '#2a3418'; g.font = 'bold 10px "Pixelify Sans", monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('買取 ★', st.x + 16, st.y + 17); g.fillText('> SELL_', st.x + 16, st.y + 27);
  g.fillStyle = D ? '#14131a' : '#3a3d48'; g.fillRect(st.x + 84, st.y + 12, 22, 4); g.fillRect(st.x + 88, st.y + 24, 14, 8);
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(st.x + 95, st.y + 8, 4, 0, Math.PI * 2); g.fill();
  sign(st.x, st.y - 34, st.w, '★ WE BUY ★', '#ffd34d');
}
// the notice board on the plaza: cork with papers pinned to it
// the notice board: an old grey terminal on two posts, a navy title bar and a green screen (hub.js writes the best three on it)
function drawNotice(g, D) {
  const b = BOARD, sh = b.h - 18;
  g.fillStyle = 'rgba(30,30,60,0.25)'; g.fillRect(b.x + 8, b.y + b.h - 2, b.w - 8, 6);
  g.fillStyle = D ? '#24222c' : '#7d7f8c'; g.fillRect(b.x + 18, b.y + sh - 4, 8, 22); g.fillRect(b.x + b.w - 26, b.y + sh - 4, 8, 22);
  g.fillStyle = D ? '#14131a' : '#8f919c'; roundRect(g, b.x, b.y + 3, b.w, sh, 7); g.fill();
  g.fillStyle = D ? '#2c2a36' : '#d6d5cf'; roundRect(g, b.x, b.y, b.w, sh - 3, 7); g.fill();
  g.fillStyle = D ? '#3a3846' : '#f1f0ea'; g.fillRect(b.x + 6, b.y + 1, b.w - 12, 2);
  g.fillStyle = '#23286a'; g.fillRect(b.x + 6, b.y + 6, b.w - 12, 13);
  g.fillStyle = '#ffffff'; g.font = 'bold 9px "Pixelify Sans", monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('掲示板  NOTICE', b.x + 22, b.y + 13);
  // the flower and its star, small, on the title bar
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; g.beginPath(); g.arc(b.x + 14 + Math.cos(a) * 2.6, b.y + 12.5 + Math.sin(a) * 2.6, 2, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ffd75a'; g.fillRect(b.x + 13, b.y + 11.5, 2, 2);
  for (const [x, c] of [[b.x + b.w - 30, '#d8443c'], [b.x + b.w - 20, '#ffb43d'], [b.x + b.w - 10, '#2fae7a']]) { g.fillStyle = c; g.beginPath(); g.arc(x, b.y + 12.5, 2.5, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = D ? '#0a0c08' : '#5a6040'; roundRect(g, b.x + 6, b.y + 22, b.w - 12, sh - 31, 3); g.fill();
  g.fillStyle = D ? '#1e2a14' : '#b7c48a'; g.fillRect(b.x + 8, b.y + 24, b.w - 16, sh - 35);
  g.fillStyle = D ? 'rgba(200,232,106,0.06)' : 'rgba(60,70,30,0.12)'; for (let y = b.y + 25; y < b.y + sh - 11; y += 2) g.fillRect(b.x + 8, y, b.w - 16, 1);
  g.strokeStyle = D ? '#4a4858' : '#a9a9b3'; g.lineWidth = 1;
  for (const [x, y] of [[b.x + 4, b.y + sh - 6], [b.x + b.w - 4, b.y + sh - 6]]) { g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x + 2, y); g.moveTo(x, y - 2); g.lineTo(x, y + 2); g.stroke(); }
}

function worldDraw(now) {
  const g = world.ctx, gt = world.tctx, z = world.z, s = z * world.dpr;
  const clock = now / 1000;
  const vw = world.cw / z, vh = world.ch / z;
  const me = world.cats.get(world.me);
  if (me) {
    world.cam.x = vw >= WORLD_W ? (WORLD_W - vw) / 2 : Math.max(0, Math.min(WORLD_W - vw, me.x - vw / 2));
    world.cam.y = vh >= WORLD_H ? (WORLD_H - vh) / 2 : Math.max(0, Math.min(WORLD_H - vh, me.y - vh / 2));
  }
  const cx = Math.round(world.cam.x * s) / s, cy = Math.round(world.cam.y * s) / s;
  // the floor goes on the bottom canvas, under the club video
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = world.skyCol; g.fillRect(0, 0, world.canvas.width, world.canvas.height);
  g.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  g.imageSmoothingEnabled = false;
  g.drawImage(world.bg, 0, 0);
  drawLive(g, clock);
  window.hubLive?.(g, clock);
  drawFishing(g, clock);
  drawBugs(g, netNow());
  if (world.target && me?.moving) {
    g.strokeStyle = '#ff3d6e'; g.globalAlpha = 0.6;
    g.beginPath(); g.ellipse(world.target.x, world.target.y, 10, 4, 0, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  }

  // everyone and everything above it goes on the top canvas, over the video
  gt.setTransform(1, 0, 0, 1, 0, 0);
  gt.clearRect(0, 0, world.top.width, world.top.height);
  gt.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  gt.imageSmoothingEnabled = false;
  const b = ballAt(clock);
  const things = [...world.cats.values()].map(c => ({ y: c.y, c }));
  things.push({ y: b.y, ball: b });
  things.sort((a, b2) => a.y - b2.y);
  window.placesLive?.(gt, clock, 'under');
  for (const t of things) t.ball ? drawBall(gt, t.ball, clock) : drawCat(gt, t.c, clock);
  window.placesLive?.(gt, clock, 'over');
  drawTrees(gt, me);
  drawWires(gt, clock);
  drawLights(gt, clock, cx, cy, vw, vh);
  drawSigns(gt, clock);
  drawToys(gt, clock);
  drawPrompt(gt, clock);
  for (const c of world.cats.values()) if (c.bubble && Date.now() < c.bubble.until) drawBubble(gt, c.bubble, Math.round(c.x), Math.round(c.y) - 58, cx, vw);
  drawSplashes(gt, clock);
  drawBite(gt, clock);

  gt.setTransform(1, 0, 0, 1, 0, 0);
  post(gt, now);
  if (world.tvEl) placeTv(cx, cy);
}

// the capsule machine: a glass dome full of capsules on a pink stand with a crank
function drawGacha(g, t) {
  const M = GACHA, cx = M.x + M.w / 2, cy = M.y + 36, R = 34;
  g.fillStyle = 'rgba(20,20,50,0.25)'; g.beginPath(); g.ellipse(cx + 4, M.y + M.h + 2, 40, 8, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e14d9c'; roundRect(g, M.x + 6, M.y + 58, M.w - 12, M.h - 58, 10); g.fill();
  g.fillStyle = '#b8347b'; g.fillRect(M.x + 6, M.y + M.h - 10, M.w - 12, 10);
  g.fillStyle = '#ffd34d'; roundRect(g, M.x + 2, M.y + 54, M.w - 4, 10, 5); g.fill();
  g.fillStyle = '#3a1630'; roundRect(g, M.x + 14, M.y + 88, 24, 16, 5); g.fill();                     // the chute
  g.fillStyle = '#fff'; roundRect(g, M.x + 46, M.y + 70, 22, 14, 4); g.fill();                         // the price
  g.fillStyle = '#b8347b'; g.font = wf(8, 'bold'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★30', M.x + 57, M.y + 77);
  g.fillStyle = '#2a1424'; g.fillRect(M.x + 22, M.y + 72, 8, 2);                                     // the coin slot
  const a = t * 0.8;                                                                                   // the crank turns slowly
  g.fillStyle = '#f4f2fa'; g.beginPath(); g.arc(M.x + 57, M.y + 96, 7, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8c86a3'; g.lineWidth = 3; g.beginPath(); g.moveTo(M.x + 57, M.y + 96); g.lineTo(M.x + 57 + Math.cos(a) * 9, M.y + 96 + Math.sin(a) * 9); g.stroke(); g.lineWidth = 1;
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(220,235,255,0.55)'; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  const caps = [['#ffd34d', -18, 18], ['#7fd1ff', 0, 22], ['#ff8fb8', 18, 18], ['#a9f0b0', -26, 4], ['#c7a6ff', -9, 6], ['#ff9a3d', 9, 4], ['#5be0c0', 26, 6], ['#ff3d6e', -16, -10], ['#ffd34d', 2, -12], ['#7fd1ff', 18, -8], ['#c7a6ff', 0, 30], ['#ff8fb8', -30, 22], ['#a9f0b0', 30, 22]];
  caps.forEach(([c, ox, oy], i) => {
    const x = cx + ox, y = cy + oy + Math.sin(t * 2 + i) * 0.8;
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = c; g.beginPath(); g.arc(x, y, 8, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x - 8, y - 1, 16, 2);
  });
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R - 8, Math.PI * 1.1, Math.PI * 1.4); g.stroke(); g.lineWidth = 1;
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(cx, M.y, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e14d9c'; g.beginPath(); g.arc(cx, M.y, 3, 0, Math.PI * 2); g.fill();
}
// the slot machines: lit cabinets whose reels show beetles from the beetle game
const SLOT_SYMS = ['green', 'ladybug', 'pillbug', 'stag', 'goliath', 'golden'];   // as in world.php
function drawSlots(g, t) {
  SLOTS.forEach((r, i) => {
    const { x, y, w, h } = r, spin = world.slotSpin?.i === i && t < world.slotSpin.until;
    g.fillStyle = 'rgba(10,0,6,0.35)'; g.fillRect(x + 4, y + h, w, 8);
    const body = g.createLinearGradient(x, y, x + w, y);
    body.addColorStop(0, '#5a0f22'); body.addColorStop(0.5, '#b0203e'); body.addColorStop(1, '#5a0f22');
    g.fillStyle = body; roundRect(g, x, y, w, h, 10); g.fill();
    g.strokeStyle = '#ffb43d'; g.lineWidth = 2; roundRect(g, x + 1, y + 1, w - 2, h - 2, 9); g.stroke(); g.lineWidth = 1;
    // the marquee: bulbs chase round it
    g.fillStyle = '#2a0610'; roundRect(g, x + 6, y + 6, w - 12, 16, 5); g.fill();
    for (let b = 0; b < 7; b++) { g.fillStyle = (Math.floor(t * 6) + b + i) % 3 ? '#ffe9a8' : '#ff5a3d'; g.beginPath(); g.arc(x + 12 + b * 9, y + 14, 2.5, 0, Math.PI * 2); g.fill(); }
    // four reels of three beetles behind glass, with the winning row lit
    const gx = x + 6, gy = y + 26, cw = 15.5, ch = 13;
    g.fillStyle = '#120a30'; g.fillRect(gx - 1, gy - 1, w - 10, ch * 3 + 4);
    const last = world.slotSpin?.i === i && world.slotSpin.reels;
    for (let k = 0; k < 4; k++) for (let r = 0; r < 3; r++) {
      const rx = gx + k * (cw + 0.5), ry = gy + r * (ch + 0.5);
      const sym = spin ? SLOT_SYMS[Math.floor(t * 18 + k * 2 + r * 3) % 6]
        : last && r === 1 ? last[k] : SLOT_SYMS[(i * 3 + k * 2 + r * 5 + Math.floor(t / 4 + i)) % 6];
      g.fillStyle = r === 1 ? '#fffaf0' : '#e4ddfa'; g.fillRect(rx, ry, cw, ch);
      const img = world.bugImg[sym];
      if (img?.complete && img.naturalWidth) g.drawImage(img, rx + 2, ry + (spin ? (t * 300 + k * 3) % 6 - 3 : 0), 12, 12);
    }
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(gx, gy, w - 12, 3);
    g.fillStyle = (Math.floor(t * 3) % 2 || !spin) ? 'rgba(255,61,110,0.85)' : 'rgba(91,224,192,0.85)'; g.fillRect(gx - 2, gy + ch * 1.5 + 0.5, w - 8, 1);
    // buttons and the tray
    ['#ffd34d', '#ff3d6e', '#5be0c0'].forEach((c, b) => { g.fillStyle = c; g.fillRect(x + 12 + b * 20, y + 70, 12, 7); });
    g.fillStyle = '#2a0610'; roundRect(g, x + 12, y + 86, w - 24, 12, 4); g.fill();
    // the lever
    g.fillStyle = '#c9c6dc'; g.fillRect(x + w, y + (spin ? 50 : 30), 4, spin ? 20 : 40);
    g.fillStyle = '#ff3d6e'; g.beginPath(); g.arc(x + w + 2, y + (spin ? 50 : 28), 6, 0, Math.PI * 2); g.fill();
  });
}
// the screen, the dance floor, the well, the capsule machine, the slots
function drawLive(g, t) {
  // a shaft of light falls on the well and the terminal's flower, with motes drifting up in it
  for (const [bx, by, bw] of [[WELL.x, WELL.y, 56], [2000, 742, 40]]) {
    const a = 0.16 + Math.sin(t * 0.8 + bx) * 0.05;
    const sh = g.createLinearGradient(0, by - 260, 0, by + 10);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, world.dark ? `rgba(170,180,255,${a})` : `rgba(255,250,220,${a * 2.2})`);
    g.fillStyle = sh; g.beginPath(); g.moveTo(bx - bw * 0.4, by - 260); g.lineTo(bx + bw * 0.4, by - 260); g.lineTo(bx + bw, by + 10); g.lineTo(bx - bw, by + 10); g.fill();
    g.fillStyle = world.dark ? 'rgba(200,210,255,0.7)' : 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 6; i++) { const k = (t * 0.15 + i / 6 + bx) % 1; g.fillRect(bx + Math.sin(i * 2.3 + t) * bw * 0.6 * (1 - k * 0.5), by - k * 240, 2, 2); }
  }
  // the mailbox flag goes up when there is something new for me
  const mb = MAILBOX, up = world.unread > 0;
  g.fillStyle = world.dark ? '#4a4460' : '#6d7389'; g.fillRect(mb.x + mb.w, mb.y - 6, 2, 36);
  g.fillStyle = up ? '#ffd34d' : (world.dark ? '#6a5236' : '#e8a33d');
  if (up) g.fillRect(mb.x + mb.w + 2, mb.y - 6 + Math.round(Math.sin(t * 4)), 10, 7);
  else g.fillRect(mb.x + mb.w + 2, mb.y + 20, 4, 10);
  // the club screen
  const S = CLUB_SCREEN;
  g.fillStyle = '#000'; g.fillRect(S.x - 6, S.y - 6, S.w + 12, S.h + 12);
  if (!world.tvEl || !world.tvShown) {
    g.drawImage(world.noise[Math.floor(t * 20) % world.noise.length], 0, 0, 128, 72, S.x, S.y, S.w, S.h);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(S.x, S.y, S.w, S.h);
    g.font = wf(13, 'bold'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e9e4ff';
    g.fillText(world.tv ? (world.tvEl ? 'tuning in…' : '▶ something is playing') : 'NO SIGNAL', S.x + S.w / 2, S.y + S.h / 2);
    if (world.tv?.by) { g.font = wf(10); g.fillStyle = 'rgba(233,228,255,0.7)'; g.fillText(`put on by ${world.tv.by}`, S.x + S.w / 2, S.y + S.h / 2 + 20); }
  }
  // the dance floor: tiles light up under anyone standing on them
  const lit = new Set([...world.cats.values()].filter(c => !c.ghost).map(danceTile));
  for (let ty = 0; ty < DANCE.h / 30; ty++) for (let tx = 0; tx < DANCE.w / 30; tx++) {
    const on = lit.has(`${tx},${ty}`);
    const pulse = world.tv ? (Math.sin(t * 3 + tx * 0.7 + ty) + 1) / 2 : 0;
    const a = on ? 0.55 : pulse * 0.12;
    if (a < 0.02) continue;
    g.fillStyle = `hsla(${(tx * 24 + ty * 40 + t * 20) % 360} 90% 65% / ${a})`;
    g.fillRect(DANCE.x + tx * 30 + 1, DANCE.y + ty * 30 + 1, 28, 28);
  }
  // spots from the mirror ball sweep over the floor while something plays
  if (world.tv) for (let i = 0; i < 9; i++) {
    const a = t * 0.6 + i * 0.7, x = DANCE.x + DANCE.w / 2 + Math.cos(a) * (120 + i * 30), y = DANCE.y + DANCE.h / 2 + Math.sin(a * 1.3) * (60 + i * 6);
    g.fillStyle = `hsla(${(i * 40 + t * 30) % 360} 90% 75% / 0.35)`; g.beginPath(); g.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); g.fill();
  }
  // the well: water with light in it
  const wg = g.createRadialGradient(WELL.x, WELL.y, 2, WELL.x, WELL.y, 30);
  wg.addColorStop(0, '#ffffff'); wg.addColorStop(0.5, '#bfe0ff'); wg.addColorStop(1, '#8fb5f0');
  g.fillStyle = wg; g.beginPath(); g.ellipse(WELL.x, WELL.y, 30, 15, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1;
  for (let i = 0; i < 2; i++) { const r = ((t * 12 + i * 15) % 30); g.globalAlpha = 1 - r / 30; g.beginPath(); g.ellipse(WELL.x, WELL.y, r, r / 2, 0, 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1;
  drawGacha(g, t);
  drawSlots(g, t);
  // the workbench glows when the beetle game is open to you
  if (!labLocked()) {
    const gr = g.createRadialGradient(735, 1340, 0, 735, 1340, 90);
    gr.addColorStop(0, `rgba(170,255,190,${0.25 + Math.sin(t * 2) * 0.08})`); gr.addColorStop(1, 'rgba(170,255,190,0)');
    g.fillStyle = gr; g.fillRect(645, 1250, 180, 180);
  }
  for (let i = 0; i < 4; i++) {        // jars on the bench
    g.fillStyle = 'rgba(230,245,255,0.85)'; g.fillRect(687 + i * 26, 1314, 16, 20);
    g.fillStyle = ['#3d9e4a', '#c43a3a', '#d4a531', '#6b4fc4'][i]; g.fillRect(692 + i * 26, 1324 + Math.round(Math.sin(t * 3 + i) * 2), 6, 5);
  }
  // the gate of the garden, closed for the remilia sign-in
  if (labLocked()) {
    const D = GARDEN_GATE;
    g.fillStyle = '#8c86a3';
    for (let x = D.x + 4; x < D.x + D.w; x += 14) g.fillRect(x, D.y - 18, 4, 40);
    g.fillRect(D.x, D.y - 12, D.w, 4); g.fillRect(D.x, D.y + 10, D.w, 4);
    g.fillStyle = '#c23a4a'; g.fillRect(D.x + D.w / 2 - 9, D.y - 4, 18, 14);
    g.strokeStyle = '#c23a4a'; g.lineWidth = 2; g.beginPath(); g.arc(D.x + D.w / 2, D.y - 4, 6, Math.PI, 0); g.stroke();
  }
  // trails fade where they were dropped
  for (const c of world.cats.values()) {
    const life = trailOf(c)[1], kind = c.w?.trail;
    c.trail = c.trail.filter(p => t - p.t < life);
    for (const p of c.trail) {
      const age = t - p.t;
      if (kind === 't_bubbles') {
        g.globalAlpha = 1 - age / life; g.strokeStyle = '#9fd4ff'; g.lineWidth = 1;
        g.beginPath(); g.arc(p.x + Math.sin(age * 4 + p.r * 6) * 3, p.y - age * 16, 2 + p.r * 2.5, 0, Math.PI * 2); g.stroke();
      } else if (kind === 't_notes') {
        g.globalAlpha = 1 - age / life; g.font = wf(10); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = `hsl(${(p.r * 360) | 0} 70% 55%)`; g.fillText(p.r < 0.5 ? '♪' : '♫', p.x + Math.sin(age * 3) * 4, p.y - age * 14);
      } else if (kind === 't_sparks') {
        g.globalAlpha = 1 - age / life; g.fillStyle = p.r < 0.3 ? '#ffffff' : '#ffe36a';
        const r = 3 * (1 - age / life);
        g.fillRect(p.x - r, p.y, r * 2 + 1, 1); g.fillRect(p.x, p.y - r, 1, r * 2 + 1);
      } else if (kind === 't_snow') {
        g.globalAlpha = 1 - age / life; g.fillStyle = '#ffffff';
        const sx = p.x + Math.sin(age * 2 + p.r * 6) * 5, sy = p.y - 6 + age * 8;
        g.fillRect(sx - 2, sy, 5, 1); g.fillRect(sx, sy - 2, 1, 5); g.fillRect(sx - 1, sy - 1, 3, 3);
      } else if (kind === 't_flames') {
        const k = age / life, r = 4 * (1 - k) + 1;
        g.globalAlpha = 1 - k; g.fillStyle = k < 0.3 ? '#fff3a0' : k < 0.6 ? '#ffa030' : '#e8402a';
        g.beginPath(); g.arc(p.x + (p.r - 0.5) * 6, p.y - age * 30, r, 0, Math.PI * 2); g.fill();
      } else if (kind === 't_hearts') { g.globalAlpha = 1 - age / 1.2; g.font = wf(9); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff5a78'; g.fillText('♥', p.x, p.y - age * 12); }
      else if (c.w?.trail === 't_feathers') {
        g.globalAlpha = 1 - age / 2.2; g.save(); g.translate(p.x + Math.sin(age * 3 + p.r * 6) * 6, p.y + age * 10); g.rotate(Math.sin(age * 2 + p.r) * 0.8);
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, 0, 2, 5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#c9c6dc'; g.fillRect(-0.5, -4, 1, 8); g.restore();
      } else { g.globalAlpha = (1 - age / 1.2) * 0.8; g.fillStyle = Math.random() < 0.5 ? '#6b6680' : '#2a2635'; g.fillRect(p.x, p.y, 2, 2); }
    }
    g.globalAlpha = 1;
  }
}

function drawBugs(g, t) {
  for (const b of liveBugs()) {
    const names = BUG_KINDS[b.kind], img = world.bugImg[names[Math.floor(hrand(b.s + 9) * names.length)]];
    if (!img?.complete || !img.naturalWidth) continue;
    const n = bugAt(+b.id.split(':')[0], t + 0.2);
    const ang = Math.atan2(n.y - b.y, n.x - b.x) + Math.PI / 2;
    const size = b.kind >= 3 ? 26 + (b.kind - 3) * 4 : 22;
    g.fillStyle = 'rgba(40,40,70,0.2)'; g.beginPath(); g.ellipse(b.x, b.y + 3, size / 2.6, size / 6, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(b.x, b.y - 4); g.rotate(ang + Math.sin(t * 14 + b.s) * 0.08);
    g.imageSmoothingEnabled = true; g.drawImage(img, -size / 2, -size / 2, size, size); g.imageSmoothingEnabled = false;
    g.restore();
    if (b.kind >= 3 && Math.sin(t * 4 + b.s) > 0.6) { g.fillStyle = b.kind === 4 ? '#cfe0ff' : '#fff6c0'; g.fillRect(b.x + 8, b.y - 16, 2, 6); g.fillRect(b.x + 6, b.y - 14, 6, 2); }
  }
}

function drawBall(g, b, t) {
  g.fillStyle = 'rgba(40,40,80,0.25)';
  g.beginPath(); g.ellipse(b.x, b.y + 2, 10, 4, 0, 0, Math.PI * 2); g.fill();
  const hop = Math.min(8, b.speed / 60) * Math.abs(Math.sin(t * 9));
  g.fillStyle = '#e8435f';
  g.beginPath(); g.arc(b.x, b.y - BALL_R - hop, BALL_R, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath(); g.arc(b.x - 3, b.y - BALL_R - hop - 4, 3, 0, Math.PI * 2); g.fill();
}

function drawCat(g, c, t) {
  const fur = furOf(c, t);
  const sheet = catSheet(fur);
  const em = c.emote && t - c.emote.at < 4 ? c.emote.k : null;
  const dancing = em === 'dance', sleeping = em === 'sleep';
  let dir = c.dir, flip = c.flip;
  if (dancing && !c.moving) { const b = Math.floor((t - c.emote.at) * 4) % 4; dir = ['down', 'side', 'up', 'side'][b]; flip = b === 3; }
  const walk = c.moving && !c.sk;           // on the board the cat stands still and rolls
  const seq = CAT_ANIM[walk ? 'walk' : 'idle'][dir];
  const f = sleeping && !c.moving ? 1 : seq[Math.floor((t + c.t0) * (walk ? 8 : 2)) % seq.length];
  const sx = (f % 3) * 48, sy = Math.floor(f / 3) * 48;
  const x = Math.round(c.x);
  const sb = world.skate && c === world.cats.get(world.me) ? world.sb : null, down = sb && t < sb.bail;
  const sit = c.si && !c.moving && !c.sk;
  const hop = (dancing && !c.moving ? Math.round(Math.abs(Math.sin((t - c.emote.at) * 8)) * 6) : 0) + (c.sk && !down ? 7 + Math.round(sb?.z || 0) : 0) - (sit ? 8 : 0);
  const y = Math.round(c.y);
  const flick = c.ghost ? (Math.sin(t * 11 + c.t0 * 5) > 0.85 ? 0.15 : 0.45) : 1;
  g.globalAlpha = flick;
  // shadow, with the red spots shadows have out here
  g.fillStyle = 'rgba(40,36,80,0.28)';
  if (!sit) { g.beginPath(); g.ellipse(x, y, 15, 5, 0, 0, Math.PI * 2); g.fill(); }
  if (!c.ghost && !sit) {
    g.fillStyle = 'rgba(200,0,40,0.55)';
    for (const [ox, oy, r] of [[-6, 0, 1.6], [4, -1, 1.2], [8, 1, 1]]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill(); }
  }
  if (c.sk) drawBoard(g, x, y, sb ? sb.h : dir === 'side' ? (flip ? Math.PI : 0) : Math.PI / 2, c.moving, t + c.t0, sb);
  if (c.w?.back === 'wings') drawWings(g, x, y - hop, t + c.t0, c.moving);
  if (c.w?.back && c.w.back !== 'wings' && dir !== 'up') drawBack(g, c.w.back, x, y - hop, dir, flip, t + c.t0, c.moving);
  if (c.w?.hold === 'balloon') drawBalloon(g, x, y - hop, t + c.t0);
  if (c.w?.hold === 'umbrella') drawUmbrella(g, x, y - hop, t + c.t0);
  g.save();
  g.translate(x, y - hop);
  if (flip) g.scale(-1, 1);
  // sitting, the legs are tucked under on the seat
  if (sit) g.drawImage(sheet, sx, sy, 48, 40, -24, -46, 48, 40); else g.drawImage(sheet, sx, sy, 48, 48, -24, -46, 48, 48);
  g.restore();
  if (c.w?.back && c.w.back !== 'wings' && dir === 'up') drawBack(g, c.w.back, x, y - hop, dir, flip, t + c.t0, c.moving);
  if (c.w?.back && dir === 'down') drawStraps(g, c.w.back, x, y - hop);
  if (c.w?.hat) drawHat(g, c.w.hat, x, y - hop - 38, dir, t, flip);
  if (c.w?.hold && c.w.hold !== 'balloon' && c.w.hold !== 'umbrella') drawHold(g, c.w.hold, x, y - hop, flip, t);
  label(g, c, x, y);
  if (c.splat && t - c.splat < 1.5) { const a = t - c.splat; for (let i = 0; i < 4; i++) cloudPuff(g, x - 9 + i * 6, y - 30 - hop + Math.sin(i * 2) * 5, 5, 1 - a / 1.5); }
  g.globalAlpha = 1;
  if (em?.startsWith('show:')) {
    // held up high for a moment: it goes up, stays, and goes back in the bag
    const age = t - c.emote.at, p = itemPic(em.slice(5)), up = Math.min(1, age * 5) * 12;
    g.globalAlpha = Math.min(1, (4 - age) * 2);
    if (p.img?.complete && p.img.naturalWidth) g.drawImage(p.img, x - 16, y - 78 - hop - up, 32, 32);
    else if (p.txt) { g.font = wf(24); g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(p.txt, x, y - 48 - hop - up); }
    g.globalAlpha = 1;
  } else if (em) {
    const age = t - c.emote.at;
    g.globalAlpha = Math.min(1, (4 - age) * 2);
    g.font = wf(18); g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(EMOTE_ICON[em] || '', x + (em === 'sleep' ? 14 : 0), y - 50 - hop - Math.min(10, age * 12));
    g.globalAlpha = 1;
  }
}

function drawBoard(g, x, y, h, moving, t, sb) {
  const down = sb && t < sb.bail, z = down ? 0 : (sb?.z || 0);
  // a bail leaves the board rolling off to one side
  const bx = down ? x + 18 + (1.1 - (sb.bail - t)) * 30 : x, by = y - 3 - z;
  const spin = sb?.trick ? sb.spin : 0;
  g.save();
  g.translate(bx, by); g.scale(1, 0.6);
  g.rotate(h + (sb?.trick === 'shove' ? spin * Math.PI : 0) + (down ? 0.6 : 0));
  // a kickflip turns the deck over along its length
  const roll = sb?.trick === 'flip' ? Math.cos(Math.min(1, spin) * Math.PI * 2) : 1;
  g.scale(1, roll || 0.05);
  g.fillStyle = '#2a2433';
  for (const [ox, oy] of [[-12, -7], [-12, 7], [12, -7], [12, 7]]) { g.beginPath(); g.arc(ox, oy, 3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = roll < 0 ? '#3a3446' : '#ff3d6e'; roundRect(g, -20, -6, 40, 12, 6); g.fill();
  if (roll >= 0) { g.fillStyle = '#ffd34d'; g.fillRect(-14, -1, 28, 2); }
  g.restore();
  if (moving && !z && Math.sin(t * 20) > 0.3) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - Math.cos(h) * 26 - 2, y - 2 - Math.sin(h) * 14, 4, 1); }
  if (sb && t - (sb.slide || 0) < 0.1) { g.fillStyle = '#ffd34d'; for (let i = 0; i < 3; i++) g.fillRect(x - 14 + Math.random() * 28, y - 2 + Math.random() * 4, 2, 2); }
}

function drawWings(g, x, y, t, moving) {
  const flap = Math.sin(t * (moving ? 10 : 2.5)) * (moving ? 0.35 : 0.12);
  for (const side of [-1, 1]) {
    g.save(); g.translate(x + side * 6, y - 26); g.scale(side, 1); g.rotate(-0.35 - flap);
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = 'rgba(160,160,210,0.8)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -16, 24, -14); g.quadraticCurveTo(20, -6, 22, -2); g.quadraticCurveTo(14, 0, 18, 6); g.quadraticCurveTo(8, 8, 0, 4); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}

// a cape, a backpack or a jetpack: behind the cat, in front when it walks away
function drawBack(g, id, x, y, dir, flip, t, moving) {
  const bx = dir === 'side' ? x + (flip ? 8 : -8) : x;
  g.save();
  if (id === 'cape') {
    const sway = Math.sin(t * (moving ? 9 : 2)) * (moving ? 3 : 1), back = dir === 'side' ? (flip ? 6 : -6) : 0, wide = dir === 'down' ? 6 : 0;
    g.fillStyle = '#c23a4a';
    g.beginPath(); g.moveTo(x - 10, y - 26); g.lineTo(x + 10, y - 26); g.lineTo(x + 13 + wide + back + sway, y - 3); g.lineTo(x - 13 - wide + back + sway, y - 3); g.closePath(); g.fill();
    g.fillStyle = '#8e2433'; g.fillRect(x - 10, y - 27, 20, 3);
  } else if (id === 'backpack') {
    g.fillStyle = '#e8a33d'; roundRect(g, bx - 8, y - 30, 16, 18, 4); g.fill();
    g.fillStyle = '#c4822a'; g.fillRect(bx - 6, y - 20, 12, 5);
    g.fillStyle = '#fff3d0'; g.fillRect(bx - 1, y - 19, 2, 2);
  } else if (id === 'jetpack') {
    for (const o of dir === 'down' ? [-16, 16] : [-5, 5]) {
      g.fillStyle = '#9da3b6'; roundRect(g, bx + o - 4, y - 34, 8, 20, 3); g.fill();
      g.fillStyle = '#6d7389'; g.fillRect(bx + o - 3, y - 15, 6, 3);
      if (moving) {
        const fl = 6 + Math.abs(Math.sin(t * 30 + o)) * 6;
        g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(bx + o - 3, y - 12); g.lineTo(bx + o + 3, y - 12); g.lineTo(bx + o, y - 12 + fl); g.closePath(); g.fill();
        g.fillStyle = '#fff3b0'; g.beginPath(); g.moveTo(bx + o - 1.5, y - 12); g.lineTo(bx + o + 1.5, y - 12); g.lineTo(bx + o, y - 12 + fl * 0.5); g.closePath(); g.fill();
      }
    }
  }
  g.restore();
}
// what of a back item shows on a cat facing you
function drawStraps(g, id, x, y) {
  if (id === 'backpack') {
    g.fillStyle = '#c4822a';
    g.fillRect(x - 9, y - 19, 3, 11); g.fillRect(x + 6, y - 19, 3, 11);
  } else if (id === 'cape') {
    g.fillStyle = '#8e2433'; g.fillRect(x - 9, y - 19, 18, 3);
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x, y - 17.5, 2.2, 0, Math.PI * 2); g.fill();
  } else if (id === 'jetpack') {
    g.fillStyle = '#6d7389'; g.fillRect(x - 12, y - 18, 24, 3);
  }
}
function drawUmbrella(g, x, y, t) {
  const ux = x + 4, uy = y - 64 + Math.sin(t * 1.5) * 1;
  g.strokeStyle = '#4a4560'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ux, uy); g.lineTo(x + 12, y - 14); g.stroke();
  g.fillStyle = '#7b5be6'; g.beginPath(); g.arc(ux, uy + 4, 26, Math.PI, 0); g.closePath(); g.fill();
  g.fillStyle = '#a58cf5';
  for (const o of [-13, 13]) { g.beginPath(); g.moveTo(ux, uy - 22); g.quadraticCurveTo(ux + o * 0.6, uy - 10, ux + o, uy + 4); g.lineTo(ux + o * 0.4, uy + 4); g.closePath(); g.fill(); }
  g.fillStyle = '#4a4560'; g.fillRect(ux - 1, uy - 26, 2, 4);
}

function drawHat(g, id, x, y, dir, t, flip = false) {
  g.save();
  switch (id) {
    case 'cap':
      g.fillStyle = '#3b6fe0'; g.beginPath(); g.arc(x, y + 8, 13, Math.PI, 0); g.fill();
      g.fillStyle = '#2a52b0';
      if (dir === 'side') g.fillRect(flip ? x - 20 : x + 6, y + 5, 14, 3);
      else if (dir === 'down') { g.beginPath(); g.ellipse(x, y + 8, 14, 3.5, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#fff'; g.fillRect(x - 1, y - 6, 2, 2);
      break;
    case 'mccap': {
      // a black crew cap with golden arches, and a headset mic round the cheek
      g.fillStyle = '#16151a'; g.beginPath(); g.arc(x, y + 8, 13.5, Math.PI, 0); g.fill();
      g.fillStyle = '#2a2830'; g.fillRect(x - 13, y + 5, 26, 3);
      g.fillStyle = '#0c0b0f';
      if (dir === 'side') g.fillRect(flip ? x - 21 : x + 7, y + 5, 15, 3);
      else if (dir === 'down') { g.beginPath(); g.ellipse(x, y + 8, 15, 4, 0, 0, Math.PI * 2); g.fill(); }
      if (dir !== 'up') {
        g.strokeStyle = '#ffc72c'; g.lineWidth = 1.6; g.beginPath();
        const ax = dir === 'side' ? x + (flip ? -4 : 4) : x;
        g.moveTo(ax - 5, y + 3); g.quadraticCurveTo(ax - 4.5, y - 4, ax - 2.5, y - 4); g.quadraticCurveTo(ax - 0.5, y - 4, ax, y + 1);
        g.quadraticCurveTo(ax + 0.5, y - 4, ax + 2.5, y - 4); g.quadraticCurveTo(ax + 4.5, y - 4, ax + 5, y + 3); g.stroke();
      }
      if (dir !== 'up') {
        const mx = dir === 'side' ? x + (flip ? 9 : -9) : x - 12;
        g.strokeStyle = '#2a2830'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(mx, y + 8); g.quadraticCurveTo(mx - 1, y + 20, mx + (dir === 'side' ? (flip ? -6 : 6) : 7), y + 22); g.stroke();
        g.fillStyle = '#3a3842'; g.beginPath(); g.arc(mx, y + 9, 2.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#d63a3a'; g.fillRect(mx + (dir === 'side' ? (flip ? -8 : 5) : 6), y + 21, 3, 2);
      }
      break;
    }
    case 'pumpkinhat': {
      // a carved pumpkin worn like a helmet, with a curly stem and a leaf
      g.fillStyle = '#c95a10'; g.beginPath(); g.ellipse(x, y + 4, 17, 13, 0, Math.PI, 0); g.lineTo(x + 17, y + 9); g.lineTo(x - 17, y + 9); g.fill();
      g.fillStyle = '#ff8a1e';
      for (const o of [-9, 0, 9]) { g.beginPath(); g.ellipse(x + o, y + 3, 6, 12, 0, Math.PI, 0); g.lineTo(x + o + 6, y + 9); g.lineTo(x + o - 6, y + 9); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 11, y - 5, 3, 7);
      if (dir !== 'up') {                                        // the carved grin glows from inside
        const fx = dir === 'side' ? x + (flip ? -5 : 5) : x;
        g.fillStyle = '#ffe36a';
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(fx + s * 7, y + 1); g.lineTo(fx + s * 3, y + 1); g.lineTo(fx + s * 5, y - 4); g.fill(); }
        g.fillRect(fx - 6, y + 5, 12, 2);
      }
      g.strokeStyle = '#4f6b22'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y - 8); g.quadraticCurveTo(x + 1, y - 15, x + 5, y - 16); g.stroke();
      g.fillStyle = '#6fa83a'; g.beginPath(); g.ellipse(x - 5, y - 11, 5, 2.5, -0.5, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'beanie':
      g.fillStyle = '#e04a5a'; g.beginPath(); g.arc(x, y + 9, 14, Math.PI, 0); g.fill();
      g.fillStyle = '#b5303f'; g.fillRect(x - 14, y + 5, 28, 5);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y - 6, 3.5, 0, Math.PI * 2); g.fill();
      break;
    case 'shades':
      if (dir === 'up') break;
      g.fillStyle = '#15131b';
      if (dir === 'side') g.fillRect(x + (flip ? -12 : 4), y + 14, 9, 5);
      else { g.fillRect(x - 13, y + 14, 10, 5); g.fillRect(x + 3, y + 14, 10, 5); g.fillRect(x - 3, y + 15, 6, 1); }
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + (dir === 'side' ? (flip ? -10 : 6) : -11), y + 15, 2, 1);
      break;
    case 'flowers':
      for (let i = -2; i <= 2; i++) {
        const fx = x + i * 6, fy = y + 4 - (2 - Math.abs(i)) * 1.5;
        g.fillStyle = ['#ff8fb8', '#fff3b0', '#c7a6ff', '#ffffff', '#ff8fb8'][i + 2];
        for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { g.beginPath(); g.arc(fx + ox, fy + oy, 1.8, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#e8b84a'; g.fillRect(fx - 1, fy - 1, 2, 2);
      }
      break;
    case 'tophat':
      g.fillStyle = '#1d1a24'; g.fillRect(x - 13, y + 3, 26, 3);
      g.fillStyle = '#2a2633'; g.fillRect(x - 8, y - 14, 16, 18);
      g.fillStyle = '#c23a4a'; g.fillRect(x - 8, y - 1, 16, 3);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x - 6, y - 12, 2, 10);
      break;
    case 'horns':
      g.fillStyle = '#d23b4f';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * 4, y + 5); g.quadraticCurveTo(x + s * 12, y + 2, x + s * 10, y - 8); g.lineTo(x + s * 11, y + 5); g.closePath(); g.fill(); }
      break;
    case 'antenna':
      g.strokeStyle = '#3a3445'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 3, y + 4); g.lineTo(x + 7, y - 10); g.stroke();
      g.fillStyle = Math.sin(t * 6) > 0 ? '#ff2a3a' : '#7a121c'; g.beginPath(); g.arc(x + 7, y - 11, 2.5, 0, Math.PI * 2); g.fill();
      break;
    case 'bow':
      g.fillStyle = '#ff2a5a';
      g.beginPath(); g.moveTo(x + 6, y + 2); g.lineTo(x - 2, y - 4); g.lineTo(x - 2, y + 7); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x + 6, y + 2); g.lineTo(x + 14, y - 4); g.lineTo(x + 14, y + 7); g.closePath(); g.fill();
      g.fillStyle = '#b50d33'; g.fillRect(x + 4, y, 4, 4);
      break;
    case 'headset':
      g.strokeStyle = '#2a2633'; g.lineWidth = 3; g.beginPath(); g.arc(x, y + 8, 14, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.fillStyle = '#3b3646'; g.fillRect(x - 17, y + 4, 6, 10); g.fillRect(x + 11, y + 4, 6, 10);
      g.fillStyle = '#ff2a3a'; g.fillRect(x - 16, y + 7, 2, 2);
      break;
    case 'halo':
      g.strokeStyle = '#ffd860'; g.lineWidth = 2; g.shadowColor = '#fff2a0'; g.shadowBlur = 8;
      g.beginPath(); g.ellipse(x, y - 6 + Math.sin(t * 2) * 1.5, 11, 3.5, 0, 0, Math.PI * 2); g.stroke();
      break;
    case 'star': {
      const sy = y - 12 + Math.sin(t * 2.4) * 2;
      g.fillStyle = '#ffe36a'; g.shadowColor = '#fff6c0'; g.shadowBlur = 10;
      g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.5 : 6, a = i * Math.PI / 5 - Math.PI / 2 + t * 0.8; g.lineTo(x + Math.cos(a) * r, sy + Math.sin(a) * r); }
      g.closePath(); g.fill();
      break;
    }
    case 'feather':
      g.translate(x - 8, y + 2); g.rotate(-0.5 + Math.sin(t * 1.5) * 0.08);
      g.fillStyle = '#ffffff'; g.strokeStyle = '#b9b5d2'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, -9, 3.5, 10, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, 2); g.lineTo(0, -18); g.stroke();
      break;
    case 'bear':
      g.fillStyle = '#c9a47a';
      g.beginPath(); g.arc(x, y + 9, 15, Math.PI, 0); g.fill();
      g.beginPath(); g.arc(x - 11, y - 2, 5, 0, Math.PI * 2); g.arc(x + 11, y - 2, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e6c9a5'; g.beginPath(); g.arc(x - 11, y - 2, 2.5, 0, Math.PI * 2); g.arc(x + 11, y - 2, 2.5, 0, Math.PI * 2); g.fill();
      break;
    case 'party': {
      g.fillStyle = '#5b8cff'; g.beginPath(); g.moveTo(x - 8, y + 5); g.lineTo(x + 8, y + 5); g.lineTo(x + 2, y - 16); g.closePath(); g.fill();
      g.fillStyle = '#ffe36a'; for (const [ox, oy] of [[-3, 1], [3, -3], [0, -8]]) g.fillRect(x + ox - 1, y + oy - 1, 3, 3);
      g.fillStyle = '#ff5a8a'; g.beginPath(); g.arc(x + 2, y - 17, 3, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'mushroom':
      g.fillStyle = '#e8eadf'; g.fillRect(x - 4, y + 2, 8, 6);
      g.fillStyle = '#d8344a'; g.beginPath(); g.ellipse(x, y + 3, 15, 10, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#fff'; for (const [ox, oy, r] of [[-8, -1, 2.5], [0, -5, 3], [7, -1, 2]]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill(); }
      break;
    case 'ufo': {
      const uy = y - 16 + Math.sin(t * 2.2) * 2.5;
      g.fillStyle = `rgba(160,255,190,${0.18 + Math.sin(t * 5) * 0.06})`; g.beginPath(); g.moveTo(x - 4, uy + 3); g.lineTo(x + 4, uy + 3); g.lineTo(x + 9, y + 8); g.lineTo(x - 9, y + 8); g.closePath(); g.fill();
      g.fillStyle = '#b8f3ff'; g.beginPath(); g.ellipse(x, uy - 2, 5, 4, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#9aa3b8'; g.beginPath(); g.ellipse(x, uy, 12, 3.5, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 3; i++) { g.fillStyle = Math.floor(t * 4 + i) % 3 ? '#ffe36a' : '#ff5a5a'; g.fillRect(x - 7 + i * 6, uy, 2, 2); }
      break;
    }
    case 'wishhalo': {
      const hy = y - 6 + Math.sin(t * 2) * 1.5;
      g.strokeStyle = '#b9e8ff'; g.lineWidth = 2; g.shadowColor = '#e4f6ff'; g.shadowBlur = 10;
      g.beginPath(); g.ellipse(x, hy, 12, 4, 0, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 5; i++) {
        const a = t * 1.6 + i * Math.PI * 2 / 5, sx = x + Math.cos(a) * 14, sy = hy + Math.sin(a) * 4.5 - 1;
        g.fillStyle = `hsl(${(i * 72 + t * 60) % 360} 90% 78%)`;
        g.fillRect(sx - 2, sy, 5, 1); g.fillRect(sx, sy - 2, 1, 5);
      }
      break;
    }
    case 'crown':
      g.fillStyle = '#e8c547';
      g.beginPath(); g.moveTo(x - 9, y + 4); g.lineTo(x - 9, y - 4); g.lineTo(x - 4, y); g.lineTo(x, y - 7); g.lineTo(x + 4, y); g.lineTo(x + 9, y - 4); g.lineTo(x + 9, y + 4); g.closePath(); g.fill();
      g.fillStyle = '#ff2a3a'; g.fillRect(x - 1, y, 2, 2);
      break;
  }
  g.restore();
}
function drawBalloon(g, x, y, t) {
  const bx = x + 18 + Math.sin(t * 1.3) * 3, by = y - 70 + Math.sin(t * 1.7) * 2;
  g.strokeStyle = 'rgba(90,86,120,0.6)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x + 10, y - 14); g.quadraticCurveTo(x + 16, y - 40, bx, by + 11); g.stroke();
  g.fillStyle = '#ff3d6e'; g.beginPath(); g.ellipse(bx, by, 9, 11, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(bx - 3, by - 4, 2.5, 0, Math.PI * 2); g.fill();
}
function drawHold(g, id, x, y, flip, t = 0) {
  const hx = x + (flip ? -15 : 15), hy = y - 14;
  if (id === 'phone') {
    g.fillStyle = '#c9c3b0'; g.fillRect(hx - 3, hy - 9, 7, 13);
    g.fillStyle = '#9cffb0'; g.fillRect(hx - 2, hy - 7, 5, 4);
  } else if (id === 'teddy') {
    g.fillStyle = '#9a7652';
    g.beginPath(); g.arc(hx, hy - 6, 5, 0, Math.PI * 2); g.arc(hx, hy + 2, 6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(hx - 4, hy - 10, 2, 0, Math.PI * 2); g.arc(hx + 4, hy - 10, 2, 0, Math.PI * 2); g.fill();
  } else if (id === 'rod') {
    const tx = hx + (flip ? -14 : 14), ty = hy - 30;
    g.strokeStyle = '#7a5a44'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, hy + 4); g.lineTo(tx, ty); g.stroke();
    g.strokeStyle = 'rgba(40,36,60,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.sin(t * 2) * 2, ty + 22); g.stroke();
    g.fillStyle = '#ff3d6e'; g.fillRect(tx - 1 + Math.sin(t * 2) * 2, ty + 22, 3, 3);
  } else if (id === 'icecream') {
    g.fillStyle = '#d9a35c'; g.beginPath(); g.moveTo(hx - 4, hy - 4); g.lineTo(hx + 4, hy - 4); g.lineTo(hx, hy + 6); g.closePath(); g.fill();
    g.fillStyle = '#ffc6dc'; g.beginPath(); g.arc(hx, hy - 6, 4.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.fillRect(hx - 2, hy - 9, 2, 2);
  } else if (id === 'flower') {
    g.strokeStyle = '#3d8a46'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx, hy + 6); g.lineTo(hx, hy - 8); g.stroke();
    g.fillStyle = '#ff8fb8'; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + Math.sin(t) * 0.2; g.beginPath(); g.arc(hx + Math.cos(a) * 3.5, hy - 11 + Math.sin(a) * 3.5, 2.6, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(hx, hy - 11, 2, 0, Math.PI * 2); g.fill();
  } else if (id === 'wand') {
    const tx = hx + (flip ? -5 : 5), ty = hy - 16;
    g.strokeStyle = '#6a4fb0'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx, hy + 5); g.lineTo(tx, ty); g.stroke();
    g.fillStyle = '#ffe36a'; g.shadowColor = '#fff6c0'; g.shadowBlur = 8; g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 2 : 5, a = i * Math.PI / 5 - Math.PI / 2 + t; g.lineTo(tx + Math.cos(a) * r, ty + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.shadowBlur = 0;
    if (Math.sin(t * 7) > 0.5) { g.fillStyle = '#fff'; g.fillRect(tx + 6, ty - 6, 2, 2); }
  } else if (id === 'lantern') {
    const gr = g.createRadialGradient(hx, hy, 0, hx, hy, 26);
    gr.addColorStop(0, `rgba(255,220,140,${0.45 + Math.sin(t * 5) * 0.05})`); gr.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = gr; g.fillRect(hx - 26, hy - 26, 52, 52);
    g.strokeStyle = '#5a5070'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx, hy - 12); g.lineTo(hx, hy - 7); g.stroke();
    g.fillStyle = '#5a5070'; g.fillRect(hx - 4, hy - 7, 8, 2); g.fillRect(hx - 4, hy + 5, 8, 2);
    g.fillStyle = '#ffd98a'; g.fillRect(hx - 3, hy - 5, 6, 10);
  }
}

// how often a trail drops something, and how long it stays
const TRAILS = { t_feathers: [5, 2.2], t_notes: [4, 1.6], t_bubbles: [6, 1.6], t_sparks: [18, 0.9], t_snow: [8, 2], t_flames: [22, 0.6] };
const trailOf = c => TRAILS[c.w?.trail] || [14, 1.2];

// text keeps at least its size on screen when the world is drawn small (phones)
const wf = (px, weight = '') => `${weight} ${Math.round(px / Math.min(1, world.z))}px "Pixelify Sans", ui-monospace, Menlo, monospace`;

function label(g, c, x, y) {
  g.font = wf(10);
  g.textAlign = 'center'; g.textBaseline = 'top';
  const name = (c.d || c.u).slice(0, 18) + (c.u === world.me ? ' (you)' : '');
  const m = g.measureText(name), w = m.width + 8, h = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent + 3;
  // the level sits in a little navy badge in front of the name
  const lv = c.ghost || !window.lvOf ? 0 : lvOf(c.u === world.me && HUB.lxp != null ? HUB.lxp : c.l).lv;
  const lt = lv ? String(lv) : '';
  g.font = wf(8, 'bold');
  const bw = lt ? g.measureText(lt).width + 6 : 0;
  g.font = wf(10);
  const x0 = x - (w + bw) / 2;
  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.fillRect(x0 + bw, y + 5, w, h);
  g.fillStyle = c.ghost ? '#8a86a0' : `hsl(${nameHue(c.d || c.u)} 60% 38%)`;
  g.fillText(name, x0 + bw + w / 2, y + 7);
  if (lt) {
    g.fillStyle = '#23286a'; g.fillRect(x0, y + 5, bw, h);
    g.fillStyle = '#c9e86a'; g.font = wf(8, 'bold'); g.fillText(lt, x0 + bw / 2, y + 7 + (h - 13) / 2 + 1);
  }
  if (!c.st) return;
  g.font = wf(8);
  const st = c.st.length > 30 ? c.st.slice(0, 29) + '…' : c.st;
  const sw = g.measureText(st).width + 6;
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - sw / 2, y + 5 + h, sw, h - 3);
  g.fillStyle = '#4a4660'; g.fillText(st, x, y + 6 + h);
}

function drawBubble(g, b, x, y, camX, vw) {
  g.font = wf(11);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = [];
  for (const w of b.text ? b.text.split(/\s+/) : []) {
    const l = lines[lines.length - 1];
    if (l === undefined || ((l + ' ' + w).length > 26 && lines.length < 2)) lines.push(w);
    else if ((l + ' ' + w).length > 26) { if (!l.endsWith('…')) lines[1] += '…'; }
    else lines[lines.length - 1] = l + ' ' + w;
  }
  const img = b.img?.complete && b.img.naturalWidth ? b.img : null;
  const k = img ? Math.min(80 / img.naturalWidth, 60 / img.naturalHeight) : 0;
  const iw = img ? img.naturalWidth * k : 0, ih = img ? img.naturalHeight * k : 0;
  const m = g.measureText('Mg'), lh1 = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent + 1;
  const lw = Math.max(iw, ...lines.map(l => g.measureText(l).width)) + 12;
  const lh = lines.length * lh1 + (img ? ih + (lines.length ? 4 : 0) : 0) + 8;
  const bx = Math.max(camX + 2, Math.min(camX + vw - lw - 2, x - lw / 2)), by = y - lh;
  g.fillStyle = '#ffffff'; g.strokeStyle = '#a9a4c8'; g.lineWidth = 1;
  roundRect(g, bx, by, lw, lh, 3); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - 4, by + lh); g.lineTo(x, by + lh + 5); g.lineTo(x + 4, by + lh); g.closePath(); g.fill();
  if (img) { g.imageSmoothingEnabled = true; g.drawImage(img, bx + (lw - iw) / 2, by + 4, iw, ih); g.imageSmoothingEnabled = false; }
  g.fillStyle = '#211d2e';
  const ty = by + 4 + (img ? ih + 4 : 0);
  lines.forEach((l, i) => g.fillText(l, bx + lw / 2, ty + lh1 / 2 + i * lh1));
}

// the tree tops in the garden: you walk under them, they go see-through
function drawTrees(g, me) {
  for (const [x, y] of TREES) {
    const under = me && Math.abs(me.x - x) < 60 && me.y < y + 10 && me.y > y - 110;
    g.globalAlpha = under ? 0.45 : 0.95;
    const cols = world.dark ? ['#1d3a24', '#16301d', '#1a3521', '#24462c'] : ['#5fae6a', '#4f9d5c', '#58a764', '#76c27f'];
    for (const [ox, oy, r, c] of [[0, -70, 46, cols[0]], [-26, -52, 30, cols[1]], [28, -54, 32, cols[2]], [6, -88, 28, cols[3]]]) {
      g.fillStyle = c; g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = world.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(x - 10, y - 92, 14, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

// power lines overhead, from pole to pole and off the edge of the map
function drawWires(g, t) {
  g.save();
  for (const [x, y] of POLES) {
    g.fillStyle = 'rgba(40,40,80,0.18)'; g.fillRect(x - 4, y - 2, 30, 6);              // shadow on the ground
    g.fillStyle = world.dark ? '#4a4460' : '#36314a'; g.fillRect(x - 3, y - 150, 6, 150);
    g.fillRect(x - 26, y - 140, 52, 4); g.fillRect(x - 20, y - 122, 40, 3);
    g.fillRect(x + 6, y - 112, 12, 16);                                              // transformer
  }
  g.strokeStyle = world.dark ? 'rgba(120,112,150,0.55)' : 'rgba(54,49,74,0.7)'; g.lineWidth = 1.2;
  const sag = (x1, y1, x2, y2, d) => { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + d + Math.sin(t * 0.8 + x1) * 1.5, x2, y2); g.stroke(); };
  const links = [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [2, 6], [3, 7], [6, 7]];
  for (const [a, b] of links) {
    const [x1, y1] = POLES[a], [x2, y2] = POLES[b];
    for (const [o, h] of [[-24, 140], [24, 140], [-18, 122], [18, 122]]) sag(x1 + o, y1 - h, x2 + o, y2 - h, 26);
  }
  // and off the edge of the map, to wherever the rest of the network is
  for (const [i, ex, ey] of [[4, -60, 1300], [5, WORLD_W + 60, 1000], [0, 800, -80], [1, 1600, -80], [6, 900, WORLD_H + 200], [7, 1500, WORLD_H + 200]]) {
    const [x, y] = POLES[i];
    sag(x - 24, y - 140, ex, ey - 140, 40); sag(x + 24, y - 140, ex + 30, ey - 130, 40);
  }
  g.restore();
}

// light from above: soft shafts that sway, motes drifting up, Cyberia's glow
function drawLights(g, t, cx, cy, vw, vh) {
  if (world.dark) return drawNight(g, t);
  g.save();
  g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 14; i++) {
    const x = 200 + i * 360 + Math.sin(t * 0.13 + i * 2) * 60;
    const gr = g.createLinearGradient(x, 0, x + 260, WORLD_H);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,250,235,${0.12 + Math.sin(t * 0.4 + i) * 0.04})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 70, 0); g.lineTo(x + 330, WORLD_H); g.lineTo(x + 200, WORLD_H); g.closePath(); g.fill();
  }
  // above the well a column of light goes up into the sky
  const wl = g.createLinearGradient(0, WELL.y - 260, 0, WELL.y);
  wl.addColorStop(0, 'rgba(200,225,255,0)'); wl.addColorStop(1, `rgba(220,235,255,${0.35 + Math.sin(t * 1.3) * 0.08})`);
  g.fillStyle = wl; g.fillRect(WELL.x - 26, WELL.y - 260, 52, 260);
  g.restore();
  g.save();
  for (let i = 0; i < 90; i++) {
    const x = (hrand(i + 1) * WORLD_W + Math.sin(t * 0.3 + i) * 30) % WORLD_W;
    const y = WORLD_H - ((hrand(i + 50) * WORLD_H + t * (8 + hrand(i + 9) * 14)) % WORLD_H);
    if (x < cx - 10 || x > cx + vw + 10 || y < cy - 10 || y > cy + vh + 10) continue;
    g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + i);
    g.fillStyle = i % 5 ? '#ffffff' : '#ffe9b0';
    g.fillRect(x, y, 2, 2);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(510, 620, 0, 510, 620, 520);
  gr.addColorStop(0, 'rgba(255,61,110,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(60, 330, 900, 580);
  g.restore();
}

// at night the poles carry street lamps, and the well glows
function drawNight(g, t) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [i, [x, y]] of POLES.entries()) {
    const f = Math.sin(t * 13 + i * 5) > 0.9925 ? 0.4 : 1;         // a flicker now and then
    const gr = g.createRadialGradient(x, y + 4, 0, x, y + 4, 120);
    gr.addColorStop(0, `rgba(255,214,140,${0.22 * f})`); gr.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = gr; g.fillRect(x - 120, y - 116, 240, 240);
    g.fillStyle = `rgba(255,236,190,${0.9 * f})`; g.fillRect(x - 5, y - 152, 10, 4);
  }
  const wl = g.createRadialGradient(WELL.x, WELL.y, 0, WELL.x, WELL.y, 90);
  wl.addColorStop(0, `rgba(120,170,255,${0.25 + Math.sin(t * 1.3) * 0.06})`); wl.addColorStop(1, 'rgba(120,170,255,0)');
  g.fillStyle = wl; g.fillRect(WELL.x - 90, WELL.y - 90, 180, 180);
  const gr = g.createRadialGradient(510, 620, 0, 510, 620, 520);
  gr.addColorStop(0, 'rgba(255,61,110,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(60, 330, 900, 580);
  g.restore();
}

function drawSigns(g, t) {
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const z of ZONES) {
    if (z.sign === 'none') continue;
    const sx = z.x + z.w / 2, sy = (z.gaps.bottom && z.sign !== 'top') || z.sign === 'bottom' ? z.y + z.h + 22 : z.y - 24;
    const dim = Math.sin(t * 7 + z.x) > 0.97;
    g.font = wf(15, 'bold');
    g.shadowColor = world.dark ? z.col : '#ffffff'; g.shadowBlur = dim ? 0 : 8;
    g.fillStyle = dim ? '#b9b5cc' : z.col;
    g.fillText(z.name.split('').join(' '), sx, sy);
  }
  g.restore();
}

// the prompt over the nearest thing to use: tap it, or press E
function drawPrompt(g, t) {
  const s = world.near;
  world.prompt = null;
  if (!s) return;
  const text = s.text() + (matchMedia('(pointer: fine)').matches ? '  [E]' : '');
  g.font = wf(12, 'bold');
  const m = g.measureText(text), w = m.width + 20, h = (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) + 12;
  // above the thing, or below it when you stand above it, so it never hides your cat
  const below = s.at.y < s.r.y;
  const x = s.r.x + s.r.w / 2, y = (below ? s.r.y + s.r.h + 18 : s.r.y - 12 - h) + Math.sin(t * 3) * 2;
  g.save();
  g.shadowColor = s.col; g.shadowBlur = 14;
  g.fillStyle = 'rgba(255,255,255,0.95)'; roundRect(g, x - w / 2, y, w, h, h / 2); g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = s.col; g.lineWidth = 1.5; roundRect(g, x - w / 2, y, w, h, h / 2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath();
  if (below) { g.moveTo(x - 5, y); g.lineTo(x, y - 6); g.lineTo(x + 5, y); } else { g.moveTo(x - 5, y + h); g.lineTo(x, y + h + 6); g.lineTo(x + 5, y + h); }
  g.fill();
  g.fillStyle = '#211d2e'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, x, y + h / 2 + 1);
  g.restore();
  world.prompt = { x: x - w / 2, y: y - 6, w, h: h + 12, s };
}

// coins dropping into the well, and the like
function drawSplashes(g, t) {
  world.splashes = world.splashes.filter(p => t - p.t < 1.4);
  for (const p of world.splashes) {
    const a = t - p.t;
    g.globalAlpha = 1 - a / 1.4;
    g.font = wf(12, 'bold'); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = p.col || '#d4a531';
    g.fillText(p.text, p.x, p.y - a * 30);
  }
  g.globalAlpha = 1;
}

// a soft haze at the edges, faint scanlines and grain, now and then a glitch
function post(g, now) {
  const W = world.top.width, H = world.top.height;
  g.globalAlpha = 0.035;
  const n = world.noise[Math.floor(now / 50) % world.noise.length];
  g.fillStyle = g.createPattern(n, 'repeat'); g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.fillStyle = world.scan; g.fillRect(0, 0, W, H);
  g.fillStyle = world.haze; g.fillRect(0, 0, W, H);
  if (now > world.nextGlitch) {
    if (!world.glitch) world.glitch = { until: now + 160 + Math.random() * 200, line: GLITCH_LINES[Math.floor(Math.random() * GLITCH_LINES.length)] };
    if (now < world.glitch.until) {
      for (let i = 0; i < 3; i++) {
        const y = Math.random() * H, h = 4 + Math.random() * 30 * world.dpr, dx = (Math.random() - 0.5) * 40 * world.dpr;
        g.drawImage(world.canvas, 0, y, W, h, dx, y, W, h);
      }
      g.font = `${14 * world.dpr}px ui-monospace, monospace`; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = 'rgba(200,0,40,0.85)';
      g.fillText(world.glitch.line, 14 * world.dpr, H - 40 * world.dpr);
    } else { world.glitch = null; world.nextGlitch = now + 20000 + Math.random() * 30000; }
  }
}

function worldFrame(now) {
  const dt = Math.min(0.1, (now - (world.last || now)) / 1000);
  world.last = now;
  worldStep(dt, now / 1000);
  worldDraw(now);
  world.raf = requestAnimationFrame(worldFrame);
}

function worldFit() {
  const wrap = document.getElementById('world');
  const cw = wrap.clientWidth, ch = wrap.clientHeight;
  if (!cw || !ch) return;
  world.dpr = window.devicePixelRatio || 1;
  world.cw = cw; world.ch = ch;
  for (const c of [world.canvas, world.top]) { c.width = Math.round(cw * world.dpr); c.height = Math.round(ch * world.dpr); }
  world.z = Math.max(0.5, Math.min(1.6, ch / 560, cw / 480));
  const g = world.tctx;
  const sc = document.createElement('canvas'); sc.width = 1; sc.height = Math.max(2, Math.round(3 * world.dpr));
  const sg = sc.getContext('2d'); sg.fillStyle = 'rgba(60,50,110,0.05)'; sg.fillRect(0, 0, 1, Math.max(1, Math.round(world.dpr)));
  world.scan = g.createPattern(sc, 'repeat');
  const W = world.top.width, H = world.top.height;
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, world.dark ? 'rgba(5,4,10,0.6)' : 'rgba(214,232,255,0.5)');
  world.haze = v;
}

// ── the club screen: a YouTube video everyone in Cyberia watches together ───
// Nothing from YouTube loads until you press "Watch along" once.
const LS_TV_OK = 'bb_world_tv';
let ytReady = null;
function loadYt() {
  ytReady ??= new Promise(res => {
    window.onYouTubeIframeAPIReady = res;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  });
  return ytReady;
}
const tvOk = () => { try { return localStorage.getItem(LS_TV_OK) === '1'; } catch { return false; } };

function tvUpdate(tv) {
  const was = world.tv?.k;           // the same video queued twice is still a new start
  world.tv = tv;
  if (tv?.k !== was) tvActive(true);
}

// the player keeps running once you said yes to YouTube, so the video never
// starts over: you hear it in the club and it fades as you walk away
async function tvActive(changed = false) {
  const want = world.tv && tvOk();
  if (!want) {
    if (world.player) { try { world.player.destroy(); } catch {} world.player = null; }
    if (world.tvEl) { world.tvEl.remove(); world.tvEl = null; }
    world.tvShown = false;
    return;
  }
  if (world.player && !changed) return;
  const tv = world.tv;
  const start = Math.max(0, performance.now() / 1000 - tv.at);
  if (world.player?.loadVideoById) { world.player.loadVideoById({ videoId: tv.v, startSeconds: start }); return; }
  if (!world.tvEl) {
    // between the floor canvas and the canvas with everyone on it
    const el = document.createElement('div'); el.id = 'w-tv';
    el.appendChild(document.createElement('div'));
    document.getElementById('world').insertBefore(el, world.top);
    world.tvEl = el;
  }
  if (world.tvLoading) return;
  world.tvLoading = true;
  await loadYt();
  world.tvLoading = false;
  if (world.player || !world.tv || !world.tvEl) return;
  world.player = new YT.Player(world.tvEl.firstChild, {
    host: 'https://www.youtube-nocookie.com', videoId: world.tv.v,
    playerVars: { autoplay: 1, start: Math.floor(Math.max(0, performance.now() / 1000 - world.tv.at)), playsinline: 1, rel: 0, modestbranding: 1, controls: 0, disablekb: 1 },
    events: {
      onReady: e => { world.tvShown = true; world.tvVol = -1; e.target.playVideo(); },
      onStateChange: e => { if (e.data === 1) tvReportLength(); if (e.data === 0) tvEnded(); },
    },
  });
}
// the server moves to the next video when this one ends, so tell it how long it is
function tvReportLength() {
  const d = world.player?.getDuration?.(), k = world.tv?.k;
  if (!d || !k || world.tvLen === k) return;
  world.tvLen = k;
  worldSend({ tvdur: { v: world.tv.v, d: Math.round(d) } });
}
// and when it has ended, so the next one starts even if the length never arrived
function tvEnded() {
  if (world.tv && world.tvEnd !== world.tv.k) { world.tvEnd = world.tv.k; worldSend({ tvend: world.tv.v }, true); }
}

// keep the video on the screen in the world, and in step with everyone else
function placeTv(cx, cy) {
  const z = world.z, el = world.tvEl;
  el.style.left = `${(CLUB_SCREEN.x - cx) * z}px`; el.style.top = `${(CLUB_SCREEN.y - cy) * z}px`;
  el.style.width = `${CLUB_SCREEN.w * z}px`; el.style.height = `${CLUB_SCREEN.h * z}px`;
  const p = world.player, me = world.cats.get(world.me);
  if (p?.setVolume && me) {
    // loud in the club, still there on the plaza, gone by the far end of the map
    const c = z0('club'), d = Math.hypot(Math.max(c.x - me.x, 0, me.x - c.x - c.w), Math.max(c.y - me.y, 0, me.y - c.y - c.h));
    const vol = world.zone?.id === 'club' ? 70 : Math.round(Math.max(0, 1 - d / 1000) * 50);
    if (Math.abs(vol - world.tvVol) >= 4 || (vol === 0) !== (world.tvVol === 0)) {
      world.tvVol = vol;
      try { if (vol) { p.unMute(); p.setVolume(vol); } else p.mute(); } catch {}
    }
  }
  if (p?.getCurrentTime && performance.now() - world.tvAt > 10000 && world.tv) {
    world.tvAt = performance.now();
    const should = performance.now() / 1000 - world.tv.at, is = p.getCurrentTime();
    const dur = p.getDuration?.() || 0;
    if (Math.abs(should - is) > 3 && (!dur || should < dur)) p.seekTo(should, true);
    const st = p.getPlayerState?.();
    if (st === 2) p.playVideo();
    if (st === 1) tvReportLength();
    if (st === 0) tvEnded();
  }
}

const ytTitles = new Map();
async function ytTitle(v) {
  if (ytTitles.has(v)) return ytTitles.get(v);
  ytTitles.set(v, '');
  if (!tvOk()) return '';
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://youtu.be/' + v)}`);
    const t = r.ok ? (await r.json()).title || '' : '';
    ytTitles.set(v, t);
    if (t) renderQueue();
    return t;
  } catch { return ''; }
}
function renderQueue() {
  const now = document.getElementById('w-tv-now'), q = document.getElementById('w-tv-q');
  const row = (v, by, cls = '') => {
    const t = ytTitles.get(v); if (t == null) ytTitle(v);
    return `<li class="${cls}">${tvOk() ? `<img src="https://i.ytimg.com/vi/${v}/default.jpg" alt="">` : '<span class="w-tv-blank"></span>'}<span><b>${esc(t || v)}</b><small>${esc(by)}</small></span></li>`;
  };
  now.innerHTML = world.tv ? `<ul class="w-tv-list">${row(world.tv.v, `Playing now · put on by ${world.tv.by}`, 'on')}</ul>` : '<p class="w-dim">Nothing is playing.</p>';
  q.innerHTML = world.tvq.length ? `<h3>Up next</h3><ul class="w-tv-list">${world.tvq.map(x => row(x.v, x.by)).join('')}</ul>` : '';
  document.getElementById('w-tv-play').textContent = world.tv ? 'Add to queue' : 'Play';
  document.getElementById('w-tv-skip').classList.toggle('hidden', !world.tv);
  document.getElementById('w-tv-stop').classList.toggle('hidden', !world.tv);
}

function openScreen() {
  const box = document.getElementById('w-screen');
  box.classList.remove('hidden');
  document.getElementById('w-tv-consent').classList.toggle('hidden', tvOk());
  document.getElementById('w-tv-url').value = '';
  renderQueue();
}

// ── the terminal: the wardrobe and the capsule machine ──────────────────────
const SLOT_NAMES = { hat: 'On your head', back: 'On your back', col: 'Fur', hold: 'To carry', trail: 'Trail', toy: 'Toys' };
function openShop() {
  document.getElementById('w-shop').classList.remove('hidden');
  if (!world.catalog) document.getElementById('w-shop-list').innerHTML = '<p class="w-dim">Connecting…</p>';
  else renderShop();
  worldSend({ shopinfo: 1 }, true);
}
function renderShop() {
  const list = document.getElementById('w-shop-list');
  const groups = {};
  for (const it of world.catalog) if (it.price >= 0 || world.owned.includes(it.id)) (groups[it.slot] ??= []).push(it);
  list.innerHTML = Object.entries(groups).map(([slot, items]) => `<h3>${SLOT_NAMES[slot] || slot}</h3><div class="w-items">${items.map(it => {
    const own = world.owned.includes(it.id), on = world.wear[slot] === it.id;
    if (slot === 'toy') return `<div class="w-item${own ? ' on' : ''}"><span class="w-toyicon">${TOY_ICON[it.id.slice(2)]}</span><span>${esc(it.name)}</span>${own ? '<span class="w-dim">Unlocked</span>'
      : `<button type="button" data-buy="${it.id}" ${world.coins < it.price ? 'disabled' : ''}>★ ${it.price}</button>`}</div>`;
    const btn = on ? `<button type="button" data-off="${slot}">Take off</button>`
      : own ? `<button type="button" data-wear="${it.id}" data-slot="${slot}">Wear</button>`
      : !it.price ? '<span class="w-dim">from a capsule</span>'
      : `<button type="button" data-buy="${it.id}" ${world.coins < it.price ? 'disabled' : ''}>★ ${it.price}</button>`;
    return `<div class="w-item${on ? ' on' : ''}${!own && !it.price ? ' locked' : ''}"><canvas width="64" height="64" data-prev="${it.id}" data-slot="${slot}"></canvas><span>${esc(it.name)}</span>${btn}</div>`;
  }).join('')}</div>`).join('');
  list.querySelectorAll('canvas[data-prev]').forEach(cv => previewCat(cv, { [cv.dataset.slot]: cv.dataset.prev }));
  list.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => { world.lastBuy = b.dataset.buy; }));
  setCoins(world.coins);
}
// a little picture of your own cat wearing something
function previewCat(cv, extra) {
  const me = world.cats.get(world.me);
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  const z = world.z; world.z = 1;
  drawCatPreview(g, { u: me?.u || '', d: me?.d || '', w: { ...world.wear, ...extra } });
  world.z = z;
}
function drawCatPreview(g, c) {
  const sheet = catSheet(furOf(c, 0));
  if (c.w.back === 'wings') drawWings(g, 32, 58, 0, false);
  else if (c.w.back) drawBack(g, c.w.back, 32, 58, 'side', true, 0, c.w.back === 'jetpack');
  if (c.w.hold === 'balloon') drawBalloon(g, 26, 62, 0);
  if (c.w.hold === 'umbrella') { g.save(); g.translate(32, 58); g.scale(0.8, 0.8); drawUmbrella(g, 0, 0, 0); g.restore(); }
  g.drawImage(sheet, 48, 0, 48, 48, 8, 12, 48, 48);
  if (c.w.hat) drawHat(g, c.w.hat, 32, 20, 'down', 0);
  if (c.w.hold && c.w.hold !== 'balloon' && c.w.hold !== 'umbrella') drawHold(g, c.w.hold, 32, 58, false);
  if (c.w.trail) {
    const col = { t_hearts: '#ff5a78', t_feathers: '#b9b5d2', t_bubbles: '#9fd4ff', t_notes: '#a58cf5', t_sparks: '#ffd34d', t_snow: '#dfe8ff', t_flames: '#ff8a30' }[c.w.trail] || '#6b6680';
    g.fillStyle = col; for (let i = 0; i < 6; i++) g.fillRect(4 + i * 3, 30 + (i % 3) * 7, 2, 2);
  }
}

function openCapsule() {
  document.getElementById('w-capsule').classList.remove('hidden');
  document.getElementById('w-cap-got').classList.add('hidden');
  document.getElementById('w-cap-turn').disabled = false;
  cap.t0 = 0; cap.res = null; cap.open = 0;
  if (!cap.raf) cap.raf = requestAnimationFrame(capsuleDraw);
  if (!world.catalog) worldSend({ shopinfo: 1 }, true);
}
// capsule colour tells how rare the prize is
const CAP_COL = ['#a9f0b0', '#7fd1ff', '#c7a6ff', '#ffd34d'];
const CAP_TIER_NAME = ['Common', 'Rare', 'Epic', 'Legendary'];
function capsuleResult(d) {
  const btn = document.getElementById('w-cap-turn');
  btn.disabled = false;
  if (d.capsule === 'poor') { cap.t0 = 0; return worldToast('The capsule machine takes 30 stars.'); }
  const tier = d.capsule_tier || 0;
  cap.res = { col: CAP_COL[tier] };
  // the prize shows once the capsule has popped open
  const wait = Math.max(0, (cap.t0 + 1.75) * 1000 - performance.now());
  setTimeout(() => {
    const got = document.getElementById('w-cap-got');
    got.classList.remove('hidden');
    got.querySelector('span').innerHTML = `<small style="color:${CAP_COL[tier]}">${CAP_TIER_NAME[tier]}</small><b>${esc(d.capsule_name)}</b>${d.capsule_dup ? 'You have this one already, so the spare is in your bag. Sell it at the stall or trade it.' : 'You are wearing it now.'}`;
    if (tier >= 2 && !d.capsule_dup) { sfx(tier === 3 ? 'jackpot' : 'rare'); const m = world.cats.get(world.me); if (m) world.fx.set(`cap${performance.now()}`, { x: m.x, y: m.y - 30, hue: tier === 3 ? 45 : 270, kind: 'confetti', t0: performance.now() / 1000 }); }
    const slot = world.catalog?.find(i => i.id === d.capsule)?.slot || 'hat';
    previewCat(got.querySelector('canvas'), { [slot]: d.capsule });
  }, wait);
}

// ── the well ─────────────────────────────────────────────────────────────────
function makeWish() {
  if (world.coins != null && world.coins < 1) return worldToast('The well takes a star. Come back with one.');
  worldSend({ wish: 1 }, true);
}
function wishResult(r, gift) {
  if (r === 'poor') return worldToast('The well takes a star. Come back with one.');
  if (r !== 'ok') return;
  const t = performance.now() / 1000;
  if (gift) {
    for (let i = 0; i < 4; i++) world.fx.set(`wish${t}${i}`, { x: WELL.x + (i - 1.5) * 50, y: WELL.y - 60 - (i % 2) * 30, hue: 190 + i * 40, kind: i % 2 ? 'confetti' : 'fw', t0: t + i * 0.3 - 0.8 });
    world.splashes.push({ x: WELL.x, y: WELL.y - 30, t, text: '✧ Wish halo ✧' });
    worldToast('✧ The well grants your wish. A halo of little stars, and only the well has them. You are wearing it now.', 9000);
    sfx('claim'); return;
  }
  world.splashes.push({ x: WELL.x, y: WELL.y - 20, t, text: '★ -1' });
  const me = world.cats.get(world.me);
  if (me) me.emote = { k: 'spark', at: t };
  worldSend({ emote: 'spark' });
  worldToast(`✧ ${FORTUNES[Math.floor(Math.random() * FORTUNES.length)]}`, 5000);
  sfx('claim');
}

// ── the beetle game, in a window over the garden ────────────────────────────
function openLab() {
  if (labLocked()) return labDenied(true);
  const box = document.getElementById('w-lab');
  if (!box.querySelector('iframe')) box.insertAdjacentHTML('beforeend', '<iframe src="index.html" title="Beetle game"></iframe>');
  box.classList.remove('hidden');
}
function closeLab() {
  const box = document.getElementById('w-lab');
  box.classList.add('hidden');
  box.querySelector('iframe')?.remove();
  worldSend({ xp: 1 }, true);         // crafting earns coins: ask for them right away
}

// ── someone else's cat: wave, mention, message ──────────────────────────────
function catAt(x, y) {
  let best = null;
  for (const c of world.cats.values()) {
    if (c.u === world.me) continue;
    if (Math.abs(c.x - x) < 18 && y > c.y - 46 && y < c.y + 8 && (!best || c.y > best.y)) best = c;
  }
  return best;
}
// ── things that happen to you: hugs, high fives, coins ───────────────────────
function gotIn([k, from, age, n], clock) {
  const key = `${k}|${from}|${Math.round(netNow() - age)}`;
  if (world.seenIn.has(key)) return;
  world.seenIn.add(key);
  const t = { hug: `${from} hugged you 🤗`, high5: `${from} gave you a high five 🙌`, gift: `${from} gave you ★ ${n} 🎁`,
    tradeok: `${from} took your trade 🔁`, tradeno: `${from} did not take your trade` }[k];
  if (!t) return;
  if (k.startsWith('trade')) { worldToast(t, 4500); if (k === 'tradeok') { sfx('claim'); worldSend({ inv: 1 }); } return; }
  worldToast(t, 4500);
  sfx('claim');
  const me = world.cats.get(world.me);
  if (me) { me.emote = { k, at: clock }; if (k === 'gift') world.splashes.push({ x: me.x, y: me.y - 60, t: clock, text: `★ +${n}` }); }
}
// trade offers to me (take it or not) and mine that still wait for an answer
let offerKey = '';
const bugChip = k => k ? `<span class="w-bugchip">${itemIcon(k)}${esc(itemName(k))}</span>` : '';
function renderOffers(list) {
  const key = JSON.stringify(list);
  if (key === offerKey) return;
  offerKey = key;
  const el = document.getElementById('w-offer');
  el.innerHTML = list.map(o => {
    const who = `<b>${esc(o.d || o.u)}</b>`;
    if (!o.in) return `<div>🔁 Waiting for ${who} to answer <button type="button" data-offer="${o.id}" data-ok="0">Take back</button></div>`;
    const t = o.give && o.want ? `${who} offers ${bugChip(o.give)} for your ${bugChip(o.want)}`
      : o.give ? `${who} wants to give you ${bugChip(o.give)}` : `${who} asks for your ${bugChip(o.want)}`;
    return `<div>🔁 ${t} <span class="w-row"><button type="button" class="w-main" data-offer="${o.id}" data-ok="1">Accept</button><button type="button" data-offer="${o.id}" data-ok="0">No thanks</button></span></div>`;
  }).join('');
  el.classList.toggle('hidden', !list.length);
  if (list.some(o => o.in && !renderOffers.seen?.has(o.id))) sfx('react');
  renderOffers.seen = new Set(list.map(o => o.id));
}
function tradeResult(r) {
  const t = { sent: 'Offer sent. It stays open for two minutes.', done: 'Traded 🔁 It is in your bag.', declined: 'Turned down.', withdrawn: 'Offer taken back.',
    nohave: 'One of you does not have that any more.', gone: 'That offer is gone.', many: 'You have three offers open already.', bad: 'Pick something first.' }[r];
  if (t) worldToast(t);
  if (r === 'done') sfx('claim');
}
function giftResult(r) {
  const t = { ok: 'Sent 🎁', poor: 'You do not have that many stars.', cap: 'That is all you can give away today.', wait: 'Wait a moment before the next gift.', gone: 'They are not here right now.', bad: 'Between 1 and 100 coins.' }[r];
  if (t) worldToast(t);
  if (r === 'ok') sfx('claim');
}
// walk up to someone, then hug them or high five
function touch(u, k) {
  const c = world.cats.get(u), me = world.cats.get(world.me);
  if (!c || c.ghost || !me) return worldToast('They are not in the world right now.');
  const side = me.x < c.x ? -1 : 1;
  const at = { x: c.x + side * 30, y: c.y };
  const go = () => {
    me.emote = { k, at: performance.now() / 1000 };
    worldSend({ touch: { to: u, k }, x: Math.round(me.x), y: Math.round(me.y) }, true);
  };
  if (Math.hypot(me.x - c.x, me.y - c.y) < 70) return go();
  world.target = at; world.pending = { at, act: go };
}
function gift(u, n) { worldSend({ gift: { to: u, n } }, true); }

// ── toys: cloudballs to throw, fireworks for everyone ───────────────────────
const TOYS = { toss: 'Tap where to throw the cloudball', fw: 'Tap the sky for a firework (★ 2)', confetti: 'Tap where the confetti goes', bubbles: 'Tap where to blow bubbles',
  hearts: 'Tap where the hearts go', snow: 'Tap where it should snow', notes: 'Tap where the music plays', petals: 'Tap where the petals fly', lanterns: 'Tap where the lanterns rise' };
const TOY_ICON = { hearts: '💗', snow: '❄', notes: '🎶', petals: '🌸', lanterns: '🏮' };
const TOY_NAME = { toss: '☁ Cloudball', fw: '🎆 Firework', confetti: '🎉 Confetti', bubbles: '🫧 Bubbles',
  hearts: '💗 Hearts', snow: '❄ Snow', notes: '🎶 Music', petals: '🌸 Petals', lanterns: '🏮 Lanterns' };
// the toys you unlock at the terminal: locked ones show what they cost
function renderToys() {
  const box = document.getElementById('w-toys');
  box.querySelectorAll('[data-unlock], [data-toy].w-extra').forEach(b => b.remove());
  const fish = box.querySelector('[data-toy="fish"]');
  for (const k of Object.keys(TOY_ICON)) {
    const it = world.catalog?.find(i => i.id === 'k_' + k);
    fish.insertAdjacentHTML('beforebegin', world.owned.includes('k_' + k)
      ? `<button type="button" class="w-extra" data-toy="${k}">${TOY_NAME[k]}</button>`
      : `<button type="button" class="w-locked" data-unlock="${k}" title="Unlock it at the terminal">🔒 ${TOY_NAME[k]}${it ? ` ★ ${it.price}` : ''}</button>`);
  }
  showHeld();
}
function setAim(k) {
  world.aim = world.aim === k ? null : k;
  worldNote(world.aim ? TOYS[world.aim] : '');
  showHeld();
}
function setSkate(on) {
  world.skate = on;
  const m = world.cats.get(world.me);
  world.sb = { v: 0, h: m?.flip ? Math.PI : 0, z: 0, vz: 0, spin: 0, trick: '', bail: 0, combo: 0 };
  if (on && !world.toldSkate) { world.toldSkate = true; worldToast('Arrows or a tap: where you want to roll. Space or ⤴ to ollie, again in the air for a kickflip. Shift or ↻ for a shove-it.', 6000); }
  const me = world.cats.get(world.me);
  if (me) me.sk = on;
  worldSend({}, true);
  showHeld();
}
// what you have in your paws, with a button to put it away
function showHeld() {
  document.querySelectorAll('#w-toys [data-toy]').forEach(b => b.classList.toggle('on', b.dataset.toy === world.aim || (b.dataset.toy === 'skate' && !!world.skate)));
  document.getElementById('w-toy-btn').classList.toggle('on', !!(world.aim || world.skate));
  document.getElementById('w-held').innerHTML =
    (world.aim ? `<button type="button" data-drop="aim" title="Put it away">${TOY_NAME[world.aim]} <b>✕</b></button>` : '') +
    (world.skate ? '<button type="button" data-ollie title="Ollie (Space), again in the air for a kickflip">⤴ Ollie</button><button type="button" data-shove title="Pop shove-it (Shift)">↻</button><button type="button" data-drop="skate" title="Get off the board">🛹 <b>✕</b></button>' : '');
}
function pickToy(k) {
  if (TOY_ICON[k] && !world.owned.includes('k_' + k)) return worldToast('Unlock it at the terminal in the shop.');
  if (k === 'fish') { const s = SPOTS.find(x => x.id === 'pond'); world.pending = s; world.target = { ...s.at }; return; }
  if (k === 'skate') return setSkate(!world.skate);
  setAim(k);
}
function emote(k) {
  world.active = Date.now();
  const me = world.cats.get(world.me);
  if (me) me.emote = { k, at: performance.now() / 1000 };
  worldSend({ emote: k }, true);
}
// hold a thing up so everyone sees it; it stays in the bag
function showItem(k) {
  const own = k.startsWith('w:') ? world.owned.includes(k.slice(2)) || BAG.d?.have?.[k] > 0 : !BAG.d || BAG.d.have?.[k] > 0;
  if (!own) return worldToast(`You have no ${itemName(k)} any more.`);
  world.active = Date.now();
  const me = world.cats.get(world.me);
  if (me) me.emote = { k: 'show:' + k, at: performance.now() / 1000 };
  worldSend({ show: k }, true);
}

// ── the hotbar: six slots for toys, emotes and things, on the keys 1 to 6 ────
const LS_HOT = 'bb_world_hot', HOT_N = 6;
const EMOTE_KEYS = ['wave', 'heart', 'laugh', 'spark', 'dance', 'sleep', 'what'];   // EMOTES in world.php
const HOT_TOY = { toss: '☁', fw: '🎆', confetti: '🎉', bubbles: '🫧', skate: '🛹', fish: '🎣', ...TOY_ICON };
const HOT = (() => {
  let h = null;
  try { h = JSON.parse(localStorage.getItem(LS_HOT)); } catch {}
  if (!Array.isArray(h)) h = ['toy:skate', 'toy:toss', 'em:wave', 'em:heart'];
  return Array.from({ length: HOT_N }, (_, i) => typeof h[i] === 'string' ? h[i] : null);
})();
function saveHot() { try { localStorage.setItem(LS_HOT, JSON.stringify(HOT)); } catch {} }
const hotKind = s => s.slice(0, s.indexOf(':')), hotId = s => s.slice(s.indexOf(':') + 1);
function hotFace(s) {
  const t = hotKind(s), k = hotId(s);
  if (t === 'toy') return esc(HOT_TOY[k] || '?');
  if (t === 'em') return esc(EMOTE_ICON[k] || '?');
  return itemIcon(k);
}
function hotTitle(s) {
  const t = hotKind(s), k = hotId(s);
  return t === 'toy' ? (TOY_NAME[k] || { skate: '🛹 Skateboard', fish: '🎣 Go fishing' }[k] || k) : t === 'em' ? k : `Hold up ${itemName(k)}`;
}
function renderHot() {
  const el = document.getElementById('w-hot');
  if (!el) return;
  el.classList.toggle('edit', !!world.hotEdit);
  el.innerHTML = HOT.map((s, i) => `<button type="button" data-hot="${i}" class="${s ? '' : 'empty'}${s && s === 'toy:skate' && world.skate ? ' on' : ''}" title="${s ? esc(hotTitle(s)) : 'Empty: tap to fill'} (${i + 1})"><sub>${i + 1}</sub>${s ? hotFace(s) : '+'}</button>`).join('')
    + `<button type="button" data-hotedit class="w-hot-edit${world.hotEdit ? ' on' : ''}" title="Change what is in the slots">${world.hotEdit ? '✓' : '✎'}</button>`;
}
function useHot(i) {
  const s = HOT[i];
  if (!s) return openHotPick(i);
  const t = hotKind(s), k = hotId(s);
  if (t === 'toy') pickToy(k);
  else if (t === 'em') emote(k);
  else showItem(k);
  renderHot();
}
function openHotPick(i) {
  world.hotSlot = i;
  document.getElementById('w-hotpick').classList.remove('hidden');
  if (!BAG.d || !world.catalog) worldSend(world.catalog ? { inv: 1 } : { inv: 1, shopinfo: 1 }, true);
  renderHotPick();
}
function renderHotPick() {
  const el = document.getElementById('w-hotpick');
  if (el.classList.contains('hidden')) return;
  const toys = Object.keys(HOT_TOY).filter(k => !TOY_ICON[k] || world.owned.includes('k_' + k));
  const d = BAG.d, things = d ? [...new Set([...Object.keys(d.have).filter(k => d.have[k] > 0 && k[0] !== 'w'),
    ...(world.catalog || []).filter(it => it.slot !== 'toy' && world.owned.includes(it.id)).map(it => 'w:' + it.id)])] : null;
  const label = s => hotKind(s) === 'toy' ? hotTitle(s).replace(/^\S+ /, '') : hotKind(s) === 'em' ? pretty(hotId(s)) : itemName(hotId(s));
  const opt = s => `<button type="button" data-put="${esc(s)}" class="${HOT[world.hotSlot] === s ? 'on' : ''}">${hotFace(s)}<span>${esc(label(s))}</span></button>`;
  el.querySelector('.w-box').innerHTML = `
    <header><h2>Slot ${world.hotSlot + 1}</h2><button type="button" data-c="close">✕</button></header>
    <h3>Toys</h3><div class="w-hotgrid">${toys.map(k => opt('toy:' + k)).join('')}</div>
    <h3>Emotes</h3><div class="w-hotgrid">${Object.keys(EMOTE_ICON).filter(k => EMOTE_KEYS.includes(k)).map(k => opt('em:' + k)).join('')}</div>
    <h3>Hold up for everyone to see</h3>${things ? things.length ? `<div class="w-hotgrid">${things.map(k => opt('i:' + k)).join('')}</div>` : '<p class="w-dim">Your bag is empty.</p>' : '<p class="w-dim">Opening your bag…</p>'}
    <div class="wc-acts"><button type="button" data-put="">Leave it empty</button></div>`;
}

function useToy(x, y) {
  const me = world.cats.get(world.me);
  if (!me) return;
  const clock = performance.now() / 1000;
  if (world.aim === 'toss') {
    const d = Math.hypot(x - me.x, y - me.y), k = Math.min(1, 420 / (d || 1));
    const tx = me.x + (x - me.x) * k, ty = me.y + (y - me.y) * k;
    world.toss.set(`me${clock}`, { x0: me.x, y0: me.y - 20, x1: tx, y1: ty, t0: clock, u: world.me, mine: true });
    me.flip = x < me.x; me.dir = 'side';
    worldSend({ toss: { x: Math.round(tx), y: Math.round(ty) } }, true);
  } else if (world.aim === 'fw') {
    if (world.coins != null && world.coins < 2) return worldToast('A firework costs 2 stars.');
    worldSend({ fw: { x: Math.round(x), y: Math.round(y) } }, true);
  } else if (world.aim === 'confetti' || world.aim === 'bubbles' || TOY_ICON[world.aim]) {
    worldSend({ party: { k: world.aim, x: Math.round(x), y: Math.round(y) } }, true);
  }
}
function syncFx(list, clock) {
  const keep = new Set();
  for (const [x, y, age, hue, kind = 'fw'] of list) {
    const k = `${x},${y},${hue},${kind}`; keep.add(k);
    if (world.fx.has(k)) continue;
    world.fx.set(k, { x, y, hue, kind, t0: clock - age });
    if (age < 1) setTimeout(() => chime(kind === 'fw' ? 7 + (hue % 5) : kind === 'bubbles' ? 12 + (hue % 3) : 4 + (hue % 4)), Math.max(0, ((kind === 'fw' ? 0.8 : 0) - age) * 1000));
  }
  for (const k of world.fx.keys()) if (!keep.has(k) && clock - world.fx.get(k).t0 > 4) world.fx.delete(k);
}
function syncToss(list, clock) {
  for (const [x0, y0, x1, y1, age, u] of list) {
    const k = `${x0},${y0},${x1},${y1},${u}`;
    if (world.toss.has(k)) continue;
    if (u === world.me) {           // my own throw is drawn already
      world.toss.set(k, { done: true, t0: clock - age });
      continue;
    }
    world.toss.set(k, { x0, y0, x1, y1, t0: clock - age, u });
  }
  for (const [k, f] of world.toss) if (clock - f.t0 > 5) world.toss.delete(k);
}
// fireworks go up, burst and fall; cloudballs fly in an arc and go poof
function drawToys(g, t) {
  for (const f of world.fx.values()) {
    const a = t - f.t0;
    if (a < 0 || a > 3.6) continue;
    if (f.kind === 'confetti') {
      for (let i = 0; i < 40; i++) {
        const ang = -Math.PI / 2 + (hrand(i + f.hue) - 0.5) * 2.4, sp = 90 + hrand(i * 7 + f.hue) * 110;
        const r = sp * (1 - Math.exp(-a * 3));
        const x = f.x + Math.cos(ang) * r + Math.sin(a * 5 + i) * 4, y = f.y + Math.sin(ang) * r + a * a * 18;
        g.globalAlpha = Math.max(0, 1 - a / 3.6);
        g.fillStyle = `hsl(${(f.hue + i * 47) % 360} 90% 62%)`;
        g.fillRect(x, y, Math.abs(Math.sin(a * 8 + i)) * 4 + 1, 3);
      }
      g.globalAlpha = 1;
      continue;
    }
    if (f.kind === 'bubbles') {
      g.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const st = hrand(i + f.hue) * 0.8, b = a - st, life = 2.2 + hrand(i * 3) * 0.8;
        if (b < 0 || b > life) continue;
        const x = f.x + (hrand(i * 5 + f.hue) - 0.5) * 50 + Math.sin(b * 3 + i) * 6, y = f.y - b * (30 + hrand(i * 9) * 25);
        const r = 3 + hrand(i * 11) * 5;
        g.globalAlpha = b > life - 0.15 ? 0.3 : 0.85;
        g.strokeStyle = `hsl(${(f.hue + i * 25) % 360} 80% 80%)`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x - r * 0.5, y - r * 0.5, 2, 2);
      }
      g.globalAlpha = 1;
      continue;
    }
    if (f.kind === 'hearts' || f.kind === 'notes' || f.kind === 'petals') {
      const n = f.kind === 'petals' ? 26 : 12;
      for (let i = 0; i < n; i++) {
        const st = hrand(i + f.hue) * 0.6, b = a - st;
        if (b < 0 || b > 3) continue;
        g.globalAlpha = Math.max(0, 1 - b / 3);
        if (f.kind === 'petals') {
          const x = f.x + (hrand(i * 5 + f.hue) - 0.5) * 40 + b * (40 + hrand(i * 3) * 50) + Math.sin(b * 3 + i) * 10, y = f.y - 20 + b * 22 + Math.cos(b * 2 + i) * 8;
          g.save(); g.translate(x, y); g.rotate(b * 3 + i); g.fillStyle = i % 3 ? '#ffb3cf' : '#ffe0ea';
          g.beginPath(); g.ellipse(0, 0, 3.5, 2, 0, 0, Math.PI * 2); g.fill(); g.restore();
        } else {
          const x = f.x + (hrand(i * 5 + f.hue) - 0.5) * 60 + Math.sin(b * 3 + i) * 8, y = f.y - b * (28 + hrand(i * 9) * 20);
          g.font = wf(10 + hrand(i * 7) * 8); g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = f.kind === 'hearts' ? `hsl(${340 + hrand(i) * 25} 90% 65%)` : `hsl(${(f.hue + i * 40) % 360} 70% 60%)`;
          g.fillText(f.kind === 'hearts' ? '♥' : '♪♫♬'[i % 3], x, y);
        }
      }
      g.globalAlpha = 1;
      continue;
    }
    if (f.kind === 'snow') {
      g.globalAlpha = Math.min(1, a * 3) * Math.max(0, 1 - (a - 2.6));
      g.fillStyle = 'rgba(235,240,255,0.9)';
      for (const [ox, oy, r] of [[-18, 0, 13], [0, -6, 16], [18, 0, 12]]) { g.beginPath(); g.arc(f.x + ox, f.y - 70 + oy, r, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 24; i++) {
        const b = (a + hrand(i + f.hue) * 1.4) % 1.4;
        const x = f.x + (hrand(i * 3 + f.hue) - 0.5) * 56 + Math.sin(b * 4 + i) * 3, y = f.y - 60 + b * 50;
        g.fillRect(x - 1, y - 1, 2, 2);
      }
      g.globalAlpha = 1;
      continue;
    }
    if (f.kind === 'lanterns') {
      for (let i = 0; i < 6; i++) {
        const st = i * 0.25, b = a - st;
        if (b < 0) continue;
        const x = f.x + (i - 2.5) * 16 + Math.sin(b * 1.5 + i) * 6, y = f.y - b * 50 - hrand(i + f.hue) * 10;
        g.globalAlpha = Math.max(0, 1 - b / 3.2);
        const gr = g.createRadialGradient(x, y, 0, x, y, 16);
        gr.addColorStop(0, 'rgba(255,190,90,0.5)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
        g.fillStyle = gr; g.fillRect(x - 16, y - 16, 32, 32);
        g.fillStyle = '#ff9a3c'; g.fillRect(x - 4, y - 6, 8, 11);
        g.fillStyle = '#ffe2a0'; g.fillRect(x - 2, y - 3, 4, 6);
      }
      g.globalAlpha = 1;
      continue;
    }
    if (a < 0.8) {
      const y = f.y + 260 * (1 - a / 0.8);
      g.fillStyle = '#fff6c0'; g.fillRect(f.x - 1, y, 3, 8);
      g.fillStyle = 'rgba(255,220,160,0.5)'; g.fillRect(f.x, y + 8, 1, 18);
      continue;
    }
    const b = a - 0.8;
    for (let i = 0; i < 36; i++) {
      const ang = i / 36 * Math.PI * 2 + hrand(i + f.hue) * 0.2, sp = 70 + hrand(i * 3 + f.hue) * 50;
      const r = sp * (1 - Math.exp(-b * 2.2));
      const x = f.x + Math.cos(ang) * r, y = f.y + Math.sin(ang) * r + b * b * 10;
      g.globalAlpha = Math.max(0, 1 - b / 2.8) * (Math.sin(t * 30 + i) > -0.6 ? 1 : 0.3);
      g.fillStyle = `hsl(${(f.hue + (i % 3) * 30) % 360} 95% ${i % 4 ? 65 : 90}%)`;
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
  }
  const me = world.cats.get(world.me);
  for (const f of world.toss.values()) {
    if (f.done) continue;
    const a = (t - f.t0) / 0.7;
    if (a < 0 || a > 2.2) continue;
    if (a < 1) {
      const x = f.x0 + (f.x1 - f.x0) * a, y = f.y0 + (f.y1 - f.y0) * a - Math.sin(a * Math.PI) * 70;
      g.fillStyle = 'rgba(30,50,110,0.2)'; g.beginPath(); g.ellipse(f.x0 + (f.x1 - f.x0) * a, f.y0 + 20 + (f.y1 - f.y0) * a, 7, 3, 0, 0, Math.PI * 2); g.fill();
      cloudPuff(g, x, y, 7, 1);
      continue;
    }
    if (!f.landed) {
      f.landed = true;
      for (const c of world.cats.values()) {
        if (c.u === f.u || c.ghost || Math.hypot(c.x - f.x1, c.y - 20 - f.y1) > 30) continue;
        c.splat = t;
        if (c === me) worldToast(`${world.cats.get(f.u)?.d || 'Someone'} hit you with a cloudball ☁`);
        else if (f.mine) sfx('react');
      }
    }
    const b = a - 1;
    for (let i = 0; i < 6; i++) cloudPuff(g, f.x1 + Math.cos(i) * b * 26, f.y1 + Math.sin(i) * b * 14, 5 * (1 - b / 1.2), 1 - b / 1.2);
  }
}
function cloudPuff(g, x, y, r, alpha) {
  if (r <= 0 || alpha <= 0) return;
  g.globalAlpha = alpha;
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.arc(x - r * 0.8, y + r * 0.3, r * 0.7, 0, Math.PI * 2); g.arc(x + r * 0.8, y + r * 0.3, r * 0.7, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(140,186,243,0.6)'; g.fillRect(x - r, y + r * 0.6, r * 2, 1);
  g.globalAlpha = 1;
}

// ── the pond ─────────────────────────────────────────────────────────────────
function castLine() {
  const me = world.cats.get(world.me);
  if (!me) return;
  if (world.fishing) {
    // reeling in early, or right when it bites
    const f = world.fishing, now = performance.now() / 1000;
    if (now >= f.bite && now < f.bite + 1.6) { worldSend({ fish: 1 }, true); f.reeled = true; }
    else { world.fishing = null; worldToast('Nothing on the line.'); }
    return;
  }
  const now = performance.now() / 1000;
  if (now - (world.lastCast || 0) < 8) return worldToast('Let the water settle a moment.');
  world.lastCast = now;
  me.dir = 'up';
  world.fishing = { t0: now, bite: now + 2.5 + Math.random() * 3, x: POND.x + (Math.random() - 0.5) * 90, y: POND.y + (Math.random() - 0.5) * 30 };
  worldToast('Wait for it to bite, then tap again.', 2500);
}
function fishCheck(me, t) {
  const f = world.fishing;
  if (!f) return;
  if (!me || Math.hypot(me.x - POND.x, me.y - POND.y) > 240) { world.fishing = null; return; }
  if (!f.told && t >= f.bite) { f.told = true; sfx('click'); }
  if (t > f.bite + 1.6 && !f.reeled) { world.fishing = null; worldToast('It got away.'); }
}
function fishResult(d) {
  world.fishing = null;
  const t = performance.now() / 1000;
  if (d.fish === 'none') return worldToast('It got away.');
  if (d.fish === 'wait' || d.fish === 'far') return;
  if (d.fish === 'junk') {
    world.splashes.push({ x: POND.x, y: POND.y - 20, t, text: '?', col: '#fff' });
    worldToast(`You fished up ${aName(itemName('j:' + d.junk))}. It is in your bag.`, 4000);
    return sfx('click');
  }
  world.splashes.push({ x: POND.x, y: POND.y - 20, t, text: FISH_ICON[d.fish] || '🐟', col: '#fff' });
  worldToast(`You caught ${/^[AEIOU]/.test(d.fish_name) ? 'an' : 'a'} ${d.fish_name}! ${FISH_ICON[d.fish] || ''}`, 4000);
  sfx('claim');
}
function drawFishing(g, t) {
  // the water moves a little
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1;
  for (let i = 0; i < 3; i++) { const r = (t * 8 + i * 12) % 36; g.globalAlpha = 1 - r / 36; g.beginPath(); g.ellipse(POND.x - 36 + i * 34, POND.y + (i - 1) * 8, r, r / 3, 0, 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1;
  const f = world.fishing, me = world.cats.get(world.me);
  if (!f || !me) return;
  const bite = t >= f.bite, dip = bite ? Math.abs(Math.sin(t * 14)) * 3 : Math.sin(t * 2) * 1;
  g.strokeStyle = '#4a4560'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(me.x + 10, me.y - 30); g.lineTo(me.x + 20, me.y - 62); g.stroke();
  g.strokeStyle = 'rgba(40,36,60,0.7)'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(me.x + 20, me.y - 62); g.quadraticCurveTo((me.x + f.x) / 2, me.y - 70, f.x, f.y + dip); g.stroke();
  g.fillStyle = '#ff3d6e'; g.beginPath(); g.arc(f.x, f.y + dip - 2, 3, Math.PI, 0); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(f.x, f.y + dip - 2, 3, 0, Math.PI); g.fill();
}

// it bites: rings on the water and a big ! over the float, above names and all
function drawBite(g, t) {
  const f = world.fishing;
  if (!f || t < f.bite || f.reeled) return;
  const a = t - f.bite;
  g.strokeStyle = '#ff3d6e'; g.lineWidth = 2;
  for (let i = 0; i < 2; i++) { const r = ((a * 30 + i * 14) % 28) + 4; g.globalAlpha = 1 - r / 32; g.beginPath(); g.ellipse(f.x, f.y, r, r / 2.4, 0, 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1;
  const y = f.y - 34 - Math.abs(Math.sin(a * 9)) * 5;
  g.fillStyle = '#ff3d6e'; g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.beginPath(); g.arc(f.x, y, 11, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.font = wf(15, 'bold'); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('!', f.x, y + 1);
}

// ── things you find: names and pictures for beetles, fish, junk and trinkets ─
const pretty = k => k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
function itemName(k) {
  const [t, id] = [k.slice(0, 1), k.slice(2)];
  if (t === 'f') return BAG.d?.fishnames?.[id] || pretty(id);
  if (t === 'w') return world.catalog?.find(i => i.id === id)?.name || pretty(id);
  if (t === 'c') return pretty(id);
  return (typeof NAMES !== 'undefined' && NAMES[id]) || pretty(id);
}
const aName = n => `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}`;
function itemIcon(k) {
  const [t, id] = [k.slice(0, 1), k.slice(2)];
  if (t === 'f') return `<i class="w-fish">${FISH_ICON[id] || '🐟'}</i>`;
  if (t === 'c') return `<i class="w-fish">${window.CROP_ICON?.[id] || '🌱'}</i>`;
  if (t === 'w') return `<img src="${cosIcon(id)}" alt="">`;
  const src = t === 'b' ? `icons/beetles/${id}.png` : typeof IMAGES !== 'undefined' && IMAGES[id];
  return src ? `<img src="${esc(src)}" alt="">` : '<i class="w-fish">?</i>';
}

// a picture of a thing for the canvas: held up over a cat's head
const ITEM_PIC = {};
function itemPic(k) {
  if (ITEM_PIC[k]) return ITEM_PIC[k];
  const [t, id] = [k.slice(0, 1), k.slice(2)];
  if (t === 'f') return (ITEM_PIC[k] = { txt: FISH_ICON[id] || '🐟' });
  if (t === 'c') return (ITEM_PIC[k] = { txt: window.CROP_ICON?.[id] || '🌱' });
  const src = t === 'w' ? (world.catalog ? cosIcon(id) : null) : t === 'b' ? `icons/beetles/${id}.png` : typeof IMAGES !== 'undefined' && IMAGES[id];
  if (!src) return { txt: '?' };
  const img = new Image(); img.src = src;
  return (ITEM_PIC[k] = { img });
}

// something to wear, drawn on your cat, kept once the cat sprite is there
const COS_ICON = {};
function cosIcon(id) {
  if (COS_ICON[id]) return COS_ICON[id];
  const slot = world.catalog?.find(i => i.id === id)?.slot, cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  if (slot) previewCat(cv, { hat: null, back: null, hold: null, trail: null, [slot]: id });
  const url = cv.toDataURL();
  if (slot && world.cats.get(world.me)) COS_ICON[id] = url;
  return url;
}
const COS_TIER = ['common', 'rare', 'epic', 'legendary'];
const itemRar = k => {
  if (k.startsWith('b:')) return bugRar(k.slice(2));
  if (!k.startsWith('w:')) { const r = BAG.d?.rar?.[k]; return r ? `<small style="color:${RARITY_HEX[r] || 'var(--dim)'}">${esc(RARITY_NAMES[r] || '')}</small>` : ''; }
  const t = world.catalog?.find(i => i.id === k.slice(2))?.tier;
  return t != null ? `<small style="color:${CAP_COL[t]}">${esc(COS_TIER[t])}</small>` : '';
};

// the dumpster in the back alley: once every while there is something in it
function dig() {
  const me = world.cats.get(world.me);
  if (!me) return;
  worldSend({ dig: 1 }, true);
}
function digResult(d) {
  if (d.dig === 'far') return;
  if (d.dig === 'wait') return worldToast(`Nothing new in the dumpster yet. Come back in ${Math.ceil(d.dig_in / 60)} min.`);
  worldToast(`You found ${aName(itemName(d.dig))} in the dumpster. It is in your bag.`, 4000);
  sfx('claim');
}
function sellResult(r) {
  if (r === 'far') return worldToast('Walk up to the stall to sell.');
  if (r === 'none') return worldToast('Nothing to sell there.');
  worldToast(`Sold ${r.n} for ★ ${r.coins}`);
  sfx('claim');
}

// ── quests: three for today, and some you do once ───────────────────────────
function openQuests() {
  closePanels();
  document.getElementById('w-quests').classList.remove('hidden');
  if (!world.quests) document.getElementById('w-quests-list').innerHTML = '<p class="w-dim">Looking…</p>';
  worldSend({ quests: 1 }, true);
}
function renderQuests(q) {
  world.quests = q;
  const box = document.getElementById('w-quests-list');
  if (!box) return;
  const row = (name, coins, done, n, of) => `<li class="${done ? 'done' : ''}"><span>${done ? '✓' : of > 1 ? `${n}/${of}` : '·'}</span><b>${esc(name)}</b><em>★ ${coins}</em></li>`;
  box.innerHTML = `<h3>Today</h3><ul class="w-quest">${q.daily.map(x => row(x.name, x.coins, x.done, x.n, x.of)).join('')}</ul>
    <h3>Once</h3><ul class="w-quest">${q.once.map(x => row(x.name, x.coins, x.done, 0, 1)).join('')}</ul>
    <p class="w-dim">New ones for today every morning.</p>`;
}

// ── your bag: what you wear, what you found, the beetles and fish you know ─
const BAG = { tab: 'wear', d: null };
function openBag(tab) {
  closePanels();
  if (typeof tab === 'string') BAG.tab = tab;
  document.getElementById('w-bag').classList.remove('hidden');
  if (!world.catalog) worldSend({ shopinfo: 1 });
  worldSend({ inv: 1 }, true);
  drawBag(BAG.d);
}
window.openBag = openBag;
window.renderBag = d => { if (d) { BAG.d = d; world.owned = d.owned || world.owned; } drawBag(BAG.d); window.cardInv?.(); renderHot(); renderHotPick(); };
const RAR_ORDER = ['jnk', 'tin', 'brz', 'mth', 'adm', 'dia'];
const BAG_GROUPS = [['w', 'Spare clothes'], ['b', 'Beetles'], ['f', 'Fish'], ['t', 'Trinkets'], ['c', 'Crops'], ['j', 'Junk']];
const bugTierOf = k => BUG_TIER[BUG_KINDS.findIndex(ks => ks.includes(k))];
const bugRar = k => { const r = BUG_TIER[BUG_KINDS.findIndex(ks => ks.includes(k))]; return `<small style="color:${RARITY_HEX[r]}">${esc(RARITY_NAMES[r] || '')}</small>`; };
const nearStall = () => { const me = world.cats.get(world.me); return me && Math.hypot(me.x - STALL.at.x, me.y - STALL.at.y) < 120; };
function drawBag(d) {
  const box = document.getElementById('w-bag-list');
  if (!box || document.getElementById('w-bag').classList.contains('hidden')) return;
  document.querySelectorAll('#w-bag [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === BAG.tab));
  if (!d) { box.innerHTML = '<p class="w-dim">Opening your bag…</p>'; return; }
  if (BAG.tab === 'wear') {
    const items = (world.catalog || []).filter(it => it.slot !== 'toy' && world.owned.includes(it.id));
    box.innerHTML = items.length ? `<div class="w-items">${items.map(it => {
      const on = world.wear[it.slot] === it.id;
      return `<div class="w-item${on ? ' on' : ''}"><canvas width="64" height="64" data-prev="${esc(it.id)}" data-slot="${esc(it.slot)}"></canvas><span>${esc(it.name)}</span>${itemRar('w:' + it.id)}
        ${on ? `<button type="button" data-off="${esc(it.slot)}">Take off</button>` : `<button type="button" data-wear="${esc(it.id)}" data-slot="${esc(it.slot)}">Wear</button>`}</div>`;
    }).join('')}</div>` : '<p class="w-dim">Nothing yet. The terminal in the shop and the capsule machine have things to wear.</p>';
    box.querySelectorAll('canvas[data-prev]').forEach(cv => previewCat(cv, { [cv.dataset.slot]: cv.dataset.prev }));
  } else if (BAG.tab === 'things') {
    // only what you have right now, in groups, the rarest first
    const near = nearStall(), keys = Object.keys(d.have).filter(k => d.have[k] > 0);
    const rank = k => k[0] === 'w' ? (world.catalog?.find(i => i.id === k.slice(2))?.tier ?? -1) : RAR_ORDER.indexOf(d.rar?.[k] || (k[0] === 'b' ? bugTierOf(k.slice(2)) : ''));
    const groups = BAG_GROUPS.map(([t, h]) => [t, h, keys.filter(k => k[0] === t).sort((a, b) => rank(b) - rank(a) || itemName(a).localeCompare(itemName(b)))]).filter(g => g[2].length);
    box.innerHTML = groups.length ? groups.map(([t, h, ks]) => `<div class="w-bag-h"><h3>${h}</h3>${near && t !== 'w' && t !== 't' ? `<button type="button" data-sellall="${t}">Sell all</button>` : ''}</div>
      <div class="w-items">${ks.map(k => `<div class="w-item">${itemIcon(k)}<span>${esc(itemName(k))}</span>${itemRar(k)}<b>× ${d.have[k]}</b>
      ${near ? `<button type="button" data-sell="${esc(k)}">Sell ★ ${(d.prices[k] || 0) * d.have[k]}</button>` : `<small class="w-dim">★ ${d.prices[k] || 0} each</small>`}</div>`).join('')}</div>`).join('')
      + (near ? '' : '<p class="w-dim">The stall east of the well buys all of it.</p>')
      : '<p class="w-dim">Your bag is empty. Catch beetles in the park and the garden, fish at the pond, dig in the dumpster behind the Jade Arches.</p>';
  } else {
    // the album: everything you have ever found, and shadows of what is still out there
    const seen = new Set(d.seen), bugs = BUG_KINDS.flat(), fish = Object.keys(d.fishnames);
    const gotB = bugs.filter(k => seen.has('b:' + k)).length, gotF = fish.filter(id => d.fish[id]).length;
    const rarTag = r => r ? `<small style="color:${RARITY_HEX[r] || 'var(--dim)'}">${esc(RARITY_NAMES[r] || '')}</small>` : '';
    box.innerHTML = `<div class="w-bag-h"><h3>Beetles</h3><span class="w-dim">${gotB} of ${bugs.length}</span></div>
      <div class="w-items">${bugs.map(k => `<div class="w-item${seen.has('b:' + k) ? '' : ' locked'}"><img src="${esc(`icons/beetles/${k}.png`)}" alt=""><span>${seen.has('b:' + k) ? esc(itemName('b:' + k)) : '???'}</span>${bugRar(k)}</div>`).join('')}</div>
      <div class="w-bag-h"><h3>Fish</h3><span class="w-dim">${gotF} of ${fish.length}</span></div>
      <div class="w-items">${fish.map(id => d.fish[id]
        ? `<div class="w-item"><i class="w-fish">${FISH_ICON[id] || '🐟'}</i><span>${esc(d.fishnames[id])}</span>${rarTag(d.fishrar?.[id])}<small class="w-dim">caught ${d.fish[id]}</small></div>`
        : `<div class="w-item locked"><i class="w-fish">?</i><span>???</span>${rarTag(d.fishrar?.[id])}</div>`).join('')}</div>
      <p class="w-dim">Beetles fly around the park and the garden, fish live in the pond west of the well.</p>`;
  }
}

// ── dark mode: the night street from the first version ──────────────────────
// it follows the system until you flip the switch yourself
const LS_DARK = 'bb_world_dark';    // '1' night, '0' day, unset: like the system
const sysDark = matchMedia('(prefers-color-scheme: dark)');
function darkPref() {
  let s = null; try { s = localStorage.getItem(LS_DARK); } catch {}
  return s === '1' ? true : s === '0' ? false : sysDark.matches;
}
function setDark(on, save = true) {
  world.dark = on;
  if (save) try { localStorage.setItem(LS_DARK, on ? '1' : '0'); } catch {}
  document.body.classList.toggle('w-dark', on);
  const b = document.getElementById('w-dark-btn');
  if (b) { b.classList.toggle('off', on); b.title = on ? 'Turn the lights on' : 'Turn the lights off'; }
  document.getElementById('w-hue')?.classList.toggle('hidden', on);
  paintSky();
  worldFit();
}
function paintSky() {
  world.skyCol = skyCol();
  document.body.style.setProperty('--sky-col', world.skyCol);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', world.skyCol);
  if (world.bg) buildBackground();
}

// the sky colour, as on remilia.net: a rainbow and a round knob
const LS_HUE = 'bb_world_hue';
function setupHue() {
  const track = document.querySelector('#w-hue .hue-track'), knob = track.querySelector('.hue-selector');
  const show = () => {
    knob.style.left = `clamp(22px, ${(world.hue / 360 * 100).toFixed(2)}%, 100% - 22px)`;
    knob.style.backgroundColor = `rgb(${hslRgb(world.hue, 0.8, 0.5).join(', ')})`;
    knob.setAttribute('aria-valuenow', Math.round(world.hue));
  };
  let t = 0;
  const set = h => {
    world.hue = Math.max(0, Math.min(359, Math.round(h)));
    show();
    try { localStorage.setItem(LS_HUE, world.hue); } catch {}
    clearTimeout(t); t = setTimeout(paintSky, 120);        // the sky takes a moment to redraw
  };
  const at = e => { const r = track.getBoundingClientRect(); set((e.clientX - r.left - 22) / Math.max(1, r.width - 44) * 360); };
  track.addEventListener('pointerdown', e => { track.setPointerCapture(e.pointerId); at(e); });
  track.addEventListener('pointermove', e => { if (track.hasPointerCapture(e.pointerId)) at(e); });
  knob.addEventListener('keydown', e => {
    const d = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 }[e.key];
    if (d) { e.preventDefault(); set(world.hue + d); }
  });
  track.addEventListener('dblclick', () => set(SKY_HUE));
  show();
}

// ── the capsule machine: the handle turns, a capsule drops, wobbles and pops ─
const cap = { t0: 0, res: null, raf: 0 };
function capsuleDraw(now) {
  const cv = document.getElementById('w-cap-cv');
  if (!cv || document.getElementById('w-capsule').classList.contains('hidden')) { cap.raf = 0; return; }
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, t = now / 1000, a = cap.t0 ? t - cap.t0 : -1;
  g.clearRect(0, 0, W, H);
  g.imageSmoothingEnabled = false;
  // the machine, as it stands in the terminal: a glass globe of capsules on a pink body with a gold band
  const mx = W / 2, cy = 70, R = 56;
  const shake = a >= 0 && a < 0.9 ? Math.sin(a * 40) * 2 : 0;
  g.fillStyle = 'rgba(20,20,50,0.18)'; g.beginPath(); g.ellipse(mx + 4, 206, 66, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e14d9c'; roundRect(g, mx - 60, 120, 120, 84, 12); g.fill();
  g.fillStyle = '#b8347b'; g.fillRect(mx - 60, 190, 120, 14);
  g.fillStyle = '#ffd34d'; roundRect(g, mx - 66, 114, 132, 14, 7); g.fill();
  g.fillStyle = '#fff'; roundRect(g, mx - 52, 136, 40, 20, 5); g.fill();                              // the price
  g.fillStyle = '#b8347b'; g.font = wf(13, 'bold'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★30', mx - 32, 146.5);
  g.fillStyle = '#2a1424'; g.fillRect(mx - 50, 162, 18, 3);                                           // the coin slot
  g.save(); g.beginPath(); g.arc(mx, cy, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(220,235,255,0.7)'; g.fillRect(mx - R, cy - R, R * 2, R * 2);
  const caps = [['#ffd34d', -30, 30], ['#7fd1ff', 0, 38], ['#ff8fb8', 30, 30], ['#a9f0b0', -44, 8], ['#c7a6ff', -15, 10], ['#ff9a3d', 15, 6], ['#5be0c0', 44, 10], ['#ff3d6e', -27, -16], ['#ffd34d', 4, -20], ['#7fd1ff', 30, -14], ['#c7a6ff', -8, -42], ['#ff8fb8', 24, -40], ['#a9f0b0', -38, -36]];
  caps.forEach(([c, ox, oy], i) => {
    const x = mx + ox + shake * (i % 2 ? 1 : -1), y = cy + oy + Math.sin(t * 2 + i) * 1.2;
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = c; g.beginPath(); g.arc(x, y, 13, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x - 13, y - 1, 26, 2);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x - 7, y - 9, 3, 3);
  });
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3; g.beginPath(); g.arc(mx, cy, R, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6; g.beginPath(); g.arc(mx, cy, R - 12, Math.PI * 1.1, Math.PI * 1.4); g.stroke(); g.lineWidth = 1;
  g.fillStyle = '#ffd34d'; roundRect(g, mx - 66, 114, 132, 14, 7); g.fill();
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(mx, cy - R, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e14d9c'; g.beginPath(); g.arc(mx, cy - R, 4, 0, Math.PI * 2); g.fill();
  // the crank
  g.save(); g.translate(mx - 18, 180); g.rotate(a >= 0 ? Math.min(1, a / 0.8) * Math.PI * 2 : 0);
  g.fillStyle = '#f4f2fa'; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#8c86a3'; g.fillRect(-2, -2, 18, 5); g.beginPath(); g.arc(16, 0, 4, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = '#3a1630'; roundRect(g, mx + 8, 160, 34, 26, 6); g.fill();                             // the chute
  // the capsule falls out, wobbles until we know what is inside, then opens
  const col = cap.res?.col || '#ffd34d';
  if (a >= 0.8) {
    const b = a - 0.8, ready = cap.res && b > 0.9;
    const y = Math.min(232, 186 + b * b * 400);
    if (!cap.drop) { cap.drop = 1; sfx('capsuleDrop'); }
    if (b > 0.15 && !cap.wob) { cap.wob = 1; sfx('wobble'); }
    if (!ready || !cap.open) {
      if (ready && !cap.open) { cap.open = t; sfx('pop'); }
      const wob = Math.sin(b * 22) * (b > 0.15 ? 0.25 : 0);
      g.save(); g.translate(mx + 25, y); g.rotate(wob);
      g.fillStyle = col; g.beginPath(); g.arc(0, 0, 14, Math.PI, 0); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.stroke();
      g.restore();
    }
    if (cap.open) {
      const c = t - cap.open;
      // the halves fly off, confetti, the prize in a glow
      g.globalAlpha = Math.max(0, 1 - c);
      g.fillStyle = col; g.beginPath(); g.arc(mx + 25 - c * 60, 232 - c * 40, 14, Math.PI, 0); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(mx + 25 + c * 60, 232 - c * 30, 14, 0, Math.PI); g.fill();
      g.globalAlpha = 1;
      for (let i = 0; i < 40; i++) {
        const ang = hrand(i) * Math.PI * 2, sp = 60 + hrand(i + 7) * 90;
        const x = mx + Math.cos(ang) * sp * Math.min(1, c * 1.5), y2 = 150 + Math.sin(ang) * sp * Math.min(1, c * 1.5) + c * c * 40;
        g.globalAlpha = Math.max(0, 1 - c / 2.2);
        g.fillStyle = `hsl(${i * 37 % 360} 90% 65%)`; g.fillRect(x, y2, 4, 2 + (i % 3));
      }
      g.globalAlpha = 1;
    }
  }
  cap.raf = requestAnimationFrame(capsuleDraw);
}
function capsuleSpin() {
  cap.t0 = performance.now() / 1000; cap.res = null; cap.open = 0; cap.drop = 0; cap.wob = 0;
  document.getElementById('w-cap-got').classList.add('hidden');
  sfx('crank');
  if (!cap.raf) cap.raf = requestAnimationFrame(capsuleDraw);
}

// ── input ────────────────────────────────────────────────────────────────────
const W_KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
function worldKey(e, down) {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // Enter jumps into the chat field (a button inside a panel keeps its own Enter)
  if (down && e.key === 'Enter' && !t?.closest?.('.w-box, #w-dm, #w-lab')) { e.preventDefault(); document.getElementById('chat-input')?.focus(); return; }
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  world.active = Date.now();
  if (down && key === 'e') { worldAct(); return; }
  if (key === ' ' && world.skate) { e.preventDefault(); if (down && !e.repeat) ollie(); return; }
  if (key === 'Shift' && world.skate) { if (down && !e.repeat) ollie('shove'); return; }
  if (down && key === 'Escape') { closePanels(); return; }
  if (/^[1-6]$/.test(key)) { if (down && !e.repeat) useHot(+key - 1); return; }
  const k = W_KEYS[key];
  if (!k) return;
  e.preventDefault();
  if (down) world.keys.add(k); else world.keys.delete(k);
}
function closePanels() {
  for (const id of ['w-shop', 'w-screen', 'w-capsule', 'w-emotes', 'w-toys', 'w-bag', 'w-card', 'w-quests', 'w-hotpick']) document.getElementById(id)?.classList.add('hidden');
  window.placesClose?.();
  window.hubClose?.();
  if (world.aim) setAim(world.aim);
  if (!document.getElementById('w-lab').classList.contains('hidden')) closeLab();
}

// a tap: on a prompt or a thing, walk up and use it; on a cat, its menu; else walk there
function worldPointer(e) {
  const r = world.top.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  const x = world.cam.x + sx / world.z, y = world.cam.y + sy / world.z;
  world.active = Date.now();
  document.getElementById('w-emotes').classList.add('hidden');
  document.getElementById('w-toys').classList.add('hidden');
  const c = catAt(x, y);
  if (world.aim && !(c && e.pointerType === 'mouse' && e.shiftKey)) { useToy(x, y); return; }
  const p = world.prompt;
  if (p && inRect(x, y, p)) { world.pending = null; p.s.act(); return; }
  if (c) { openProfile(c.u, c.d); return; }
  const spot = SPOTS.find(s => !s.hide?.() && inRect(x, y, { x: s.r.x - 8, y: s.r.y - 8, w: s.r.w + 16, h: s.r.h + 16 }));
  if (spot) { world.pending = spot; world.target = { ...spot.at }; }
  else { world.pending = null; world.target = { x, y }; }
  worldTick();
}
function worldHover(e) {
  const r = world.top.getBoundingClientRect();
  const x = world.cam.x + (e.clientX - r.left) / world.z, y = world.cam.y + (e.clientY - r.top) / world.z;
  const over = (world.prompt && inRect(x, y, world.prompt)) || catAt(x, y) || SPOTS.some(s => !s.hide?.() && inRect(x, y, s.r));
  world.top.style.cursor = world.aim ? 'crosshair' : over ? 'pointer' : 'default';
}

function worldLeave() {
  const { access } = getTokens();
  if (access && world.me) navigator.sendBeacon?.('world.php', JSON.stringify({ token: access, leave: true }));
}

function startWorld() {
  if (world.started) return;
  world.started = true;
  worldFit();
  enterZone(PLAZA);
  worldTick();
  world.timer = setInterval(worldTick, W_POLL);
  world.raf = requestAnimationFrame(worldFrame);
  window.dmStart?.();
}

function setupWorld() {
  world.canvas = document.getElementById('w-canvas');
  world.ctx = world.canvas.getContext('2d');
  world.top = document.getElementById('w-top');
  world.tctx = world.top.getContext('2d');
  world.sprite = new Image();
  world.sprite.src = 'icons/remicat.png';
  for (const k of BUG_KINDS.flat()) { const i = new Image(); i.src = `icons/beetles/${k}.png`; world.bugImg[k] = i; }
  for (let i = 0; i < 4; i++) world.noise.push(noiseTile(255));
  buildSolids();
  try { const h = localStorage.getItem(LS_HUE); world.hue = h ? +h : SKY_HUE; } catch { world.hue = SKY_HUE; }
  setupHue();
  setDark(darkPref(), false);
  sysDark.addEventListener('change', () => { if (darkPref() !== world.dark) setDark(darkPref(), false); });
  buildBackground();
  world.top.addEventListener('pointerdown', worldPointer);
  world.top.addEventListener('pointermove', worldHover);
  document.getElementById('w-emote-btn').addEventListener('click', () => { document.getElementById('w-toys').classList.add('hidden'); document.getElementById('w-emotes').classList.toggle('hidden'); });
  document.fonts?.load('12px "Pixelify Sans"');
  document.getElementById('w-emotes').addEventListener('click', e => {
    const k = e.target.closest('button')?.dataset.emote;
    if (!k) return;
    emote(k);
    document.getElementById('w-emotes').classList.add('hidden');
  });
  document.getElementById('w-toy-btn').addEventListener('click', () => {
    renderToys(); document.getElementById('w-toys').classList.toggle('hidden');
    if (!world.catalog) worldSend({ shopinfo: 1 }, true);
  });
  document.getElementById('w-toys').addEventListener('click', e => {
    if (e.target.closest('[data-unlock]')) { document.getElementById('w-toys').classList.add('hidden'); return worldToast('Unlock it at the terminal in the shop.'); }
    const k = e.target.closest('[data-toy]')?.dataset.toy;
    if (!k) return;
    document.getElementById('w-toys').classList.add('hidden');
    pickToy(k);
  });
  renderHot();
  document.getElementById('w-hot').addEventListener('click', e => {
    if (e.target.closest('[data-hotedit]')) { world.hotEdit = !world.hotEdit; return renderHot(); }
    const b = e.target.closest('[data-hot]');
    if (!b) return;
    const i = +b.dataset.hot;
    if (world.hotEdit || !HOT[i]) openHotPick(i); else useHot(i);
  });
  document.getElementById('w-hotpick').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.c === 'close') return document.getElementById('w-hotpick').classList.add('hidden');
    if (!('put' in b.dataset)) return;
    HOT[world.hotSlot] = b.dataset.put || null; saveHot();
    document.getElementById('w-hotpick').classList.add('hidden');
    renderHot();
  });
  document.getElementById('w-held').addEventListener('click', e => {
    if (e.target.closest('[data-ollie]')) return ollie();
    if (e.target.closest('[data-shove]')) return ollie('shove');
    const k = e.target.closest('[data-drop]')?.dataset.drop;
    if (k === 'aim') setAim(world.aim);
    if (k === 'skate') setSkate(false);
  });
  document.getElementById('w-count').addEventListener('click', e => { e.stopPropagation(); document.body.classList.add('cp-side-open'); });
  document.getElementById('w-offer').addEventListener('click', e => {
    const b = e.target.closest('[data-offer]');
    if (!b) return;
    b.disabled = true;
    worldSend({ tradeans: { id: +b.dataset.offer, ok: b.dataset.ok === '1' }, inv: 1 }, true);
  });
  document.getElementById('w-bag-btn').addEventListener('click', () => openBag());
  document.getElementById('w-dark-btn').addEventListener('click', () => setDark(!world.dark));
  document.getElementById('w-quest-btn').addEventListener('click', openQuests);
  document.getElementById('w-quests').addEventListener('click', e => { if (e.target.id === 'w-quests' || e.target.closest('#w-quests-close')) closePanels(); });
  document.getElementById('w-bag').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (e.target.id === 'w-bag') return closePanels();
    if (!b) return;
    if (b.id === 'w-bag-close') return closePanels();
    if (b.dataset.tab) { BAG.tab = b.dataset.tab; drawBag(BAG.d); }
    if (b.dataset.wear) { world.wear[b.dataset.slot] = b.dataset.wear; worldSend({ wear: { [b.dataset.slot]: b.dataset.wear } }, true); drawBag(BAG.d); }
    if (b.dataset.off) { delete world.wear[b.dataset.off]; worldSend({ wear: { [b.dataset.off]: null } }, true); drawBag(BAG.d); }
    if (b.dataset.sell) { b.disabled = true; worldSend({ sell: { k: b.dataset.sell, n: BAG.d.have[b.dataset.sell] }, inv: 1 }, true); }
    if (b.dataset.sellall) { b.disabled = true; worldSend({ sell: { all: b.dataset.sellall }, inv: 1 }, true); }
  });
  document.getElementById('w-shop').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (e.target.id === 'w-shop') return closePanels();
    if (!b) return;
    if (b.id === 'w-shop-close') return closePanels();
    if (b.dataset.buy) worldSend({ buy: b.dataset.buy, shopinfo: 1 }, true);
    if (b.dataset.wear) { world.wear[b.dataset.slot] = b.dataset.wear; worldSend({ wear: { [b.dataset.slot]: b.dataset.wear }, shopinfo: 1 }, true); renderShop(); }
    if (b.dataset.off) { delete world.wear[b.dataset.off]; worldSend({ wear: { [b.dataset.off]: null }, shopinfo: 1 }, true); renderShop(); }
  });
  document.getElementById('w-capsule').addEventListener('click', e => {
    const id = e.target.id;
    if (id === 'w-capsule' || id === 'w-cap-close') closePanels();
    if (id === 'w-cap-turn') { e.target.disabled = true; capsuleSpin(); worldSend({ capsule: 1, shopinfo: 1 }, true); }
  });
  document.getElementById('w-screen').addEventListener('click', e => {
    const id = e.target.id;
    if (id === 'w-screen' || id === 'w-screen-close') closePanels();
    if (id === 'w-tv-yes') { try { localStorage.setItem(LS_TV_OK, '1'); } catch {} document.getElementById('w-tv-consent').classList.add('hidden'); tvActive(true); }
    if (id === 'w-tv-play') { const i = document.getElementById('w-tv-url'), v = i.value.trim(); if (v) { worldSend({ tv: v }, true); i.value = ''; } }
    if (id === 'w-tv-skip') worldSend({ tvskip: 1 }, true);
    if (id === 'w-tv-stop') { worldSend({ tv: '' }, true); closePanels(); }
  });
  document.getElementById('w-tv-url').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('w-tv-play').click(); });
  document.getElementById('w-lab-close').addEventListener('click', closeLab);
  document.addEventListener('keydown', e => worldKey(e, true));
  document.addEventListener('keyup', e => worldKey(e, false));
  document.getElementById('chat-input').addEventListener('keydown', () => { world.active = Date.now(); });
  window.addEventListener('blur', () => world.keys.clear());
  window.addEventListener('resize', () => world.started && worldFit());
  window.addEventListener('pagehide', worldLeave);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) worldTick(); });
}

// the world starts with the chat page, once someone is signed in
const _worldStart = start;
start = async function () {
  await _worldStart();
  if (state.user?.username) startWorld();
};

// ── speech bubbles from the chat ─────────────────────────────────────────────
// as in the room: each message pops up once, and my own one only once
const worldSeen = new Set();
const worldMine = new Map();
const _worldAppend = appendChatPosts;
appendChatPosts = function (posts, isInit, prepend = false) {
  _worldAppend(posts, isInit, prepend);
  for (const p of posts) {
    const fresh = !worldSeen.has(p.id);
    worldSeen.add(p.id);
    if (!fresh || isInit || prepend) continue;
    const u = p.user?.username;
    if (!u || muted.has(u)) continue;
    const text = bodyToPlainText(p.body || '').trim();
    const pic = (p.media || []).map(m => m.kind === 'video' ? m.thumb : m.url).find(Boolean);
    const key = `${u}\n${text}\n${(p.media || []).length}`;
    if (p.id <= 0) worldMine.set(key, Date.now());
    else if (Date.now() - (worldMine.get(key) || 0) < 60_000) { worldMine.delete(key); continue; }
    placeEchoes();
    const c = world.cats.get(u);
    if (!c || (!text && !pic)) continue;
    let img = null;
    if (pic) { img = new Image(); img.src = pic; }
    c.bubble = { text, img, until: Date.now() + (pic ? 8000 : 6000) };
  }
  if (!isInit) placeEchoes();
};

document.addEventListener('DOMContentLoaded', setupWorld);
