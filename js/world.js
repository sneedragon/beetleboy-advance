// BeetleBoy SP · The world (world.html): a small place on the network, half
// up in the clouds and half under the power lines, where everyone signed in
// walks around as a Remicat while the RemiliaNET chat runs beside it.
// A plaza with a wishing well, Cyberia with a shared screen and a dance
// floor, the terminal with the wardrobe and a capsule machine, a park with a
// ball, and the beetle garden where the beetle game runs (password login only,
// the remilia sign-in cannot craft). Beetles wander about to be caught.
// world.php keeps positions, emotes, the ball, the screen, beetles and coins.

const WORLD_W = 1800, WORLD_H = 1200;
const W_SPEED = 170;                 // world units a second
const W_POLL = 1000;
const W_ACTIVE = 180_000;            // input this recent counts as "here" for coins
const PEN = [120, 860, 600, 1100];   // the park's ball pen, as in world.php
const BALL_K = 1.4, BALL_R = 10;

const ZONES = [
  { id: 'club', name: 'CYBERIA', x: 60, y: 40, w: 600, h: 380, door: 'bottom', col: '#ff3d6e', dark: true },
  { id: 'shop', name: 'TERMINAL', x: 1140, y: 40, w: 600, h: 380, door: 'bottom', col: '#5b63e6' },
  { id: 'park', name: 'PARK', x: 60, y: 780, w: 600, h: 380, door: 'top', col: '#4f9d58' },
  { id: 'garden', name: 'BEETLE GARDEN', x: 1140, y: 780, w: 600, h: 380, door: 'top', col: '#2f9a5e' },
];
const PLAZA = { id: 'plaza', name: 'PLAZA' };
const CLUB_SCREEN = { x: 200, y: 52, w: 320, h: 180 };          // the club screen, 16:9
const DANCE = { x: 90, y: 270, w: 540, h: 120 };                 // the floor that sings
const GARDEN_GATE = { x: 1370, y: 772, w: 140, h: 24 };
const WELL = { x: 900, y: 600 };
const TREES = [[1250, 892], [1650, 892]];
const POLES = [[700, 450], [1100, 450], [700, 750], [1100, 750], [300, 600], [1500, 600]];
const EMOTE_ICON = { wave: '👋', heart: '❤️', laugh: '😂', spark: '✨', sleep: '💤', dance: '🎵', what: '❓' };
const GLITCH_LINES = ['PRESENT DAY', 'PRESENT TIME', 'you are connected', 'layer 01', 'who is here?', 'the network remembers', 'no carrier'];
const FORTUNES = [
  'Someone on the network is thinking of you.', 'You are connected. You always were.', 'The wires hum your name tonight.',
  'Something small and golden is wandering nearby.', 'Close your eyes. Layer 01 will still be here.',
  'Today is a good day to wave at a stranger.', 'Heaven is a server you have not logged into yet.',
  'Every message you send stays with someone.', 'The sky is loading. Please wait.', 'You are not alone in here.',
  'Light comes down the wires to find you.', 'A cat somewhere just waved at you.', 'Rest. The network keeps watch.',
  'What you lost will come back as a signal.', 'Present day, present time, and you are here.', 'The angels are buffering.',
  'Make a friend before the screen goes dark.', 'The well heard you. It always does.',
];

// things you can walk up to and use: the prompt floats above them
const SPOTS = [
  { id: 'screen', r: { x: 200, y: 52, w: 320, h: 180 }, at: { x: 360, y: 300 }, col: '#ff3d6e', text: () => world.tv ? '▶ Watch along' : '▶ Put on a video', act: () => openScreen() },
  { id: 'shop', r: { x: 1300, y: 236, w: 280, h: 40 }, at: { x: 1440, y: 310 }, col: '#5b63e6', text: () => '◉ Wardrobe', act: () => openShop() },
  { id: 'capsule', r: { x: 1650, y: 214, w: 56, h: 92 }, at: { x: 1640, y: 350 }, col: '#d65bb6', text: () => '◉ 30 Capsule', act: () => openCapsule() },
  { id: 'well', r: { x: 862, y: 566, w: 76, h: 56 }, at: { x: 900, y: 660 }, col: '#7fb8ff', text: () => '✧ Wish (◉ 1)', act: () => makeWish() },
  { id: 'game', r: { x: 1380, y: 984, w: 120, h: 56 }, at: { x: 1440, y: 960 }, col: '#2f9a5e', text: () => '🪲 Play the beetle game', act: () => openLab(), hide: () => labLocked() },
  { id: 'gate', r: { x: 1370, y: 740, w: 140, h: 60 }, at: { x: 1440, y: 740 }, col: '#c23a4a', text: () => '🔒 Password sign-in only', act: () => labDenied(true), hide: () => !labLocked() },
];

// beetles: every browser works out the same ones from the clock (bugAt() in world.php)
const BUG_N = 7, BUG_LIFE = 90;
const BUG_AREAS = [[1180, 830, 1700, 1130], [1180, 830, 1700, 1130], [1180, 830, 1700, 1130], [140, 820, 620, 1120], [720, 480, 1080, 720], [60, 450, 660, 740], [1140, 450, 1740, 740]];
const BUG_KINDS = [['green', 'ladybug', 'pillbug', 'cucumber'], ['stag', 'purple', 'harlequin', 'blue_longicorn'], ['golden', 'golden_tiger']];
const BUG_COINS = [1, 2, 5];
const hrand = n => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
function bugAt(k, t) {
  const g = Math.floor((t + k * 13) / BUG_LIFE), s = g * 31 + k * 7;
  const [x0, y0, x1, y1] = BUG_AREAS[k], r = hrand(s + 3);
  return {
    id: `${k}:${g}`, kind: r < 0.06 ? 2 : r < 0.3 ? 1 : 0, s,
    x: x0 + hrand(s + 1) * (x1 - x0) + 36 * Math.sin(t * (0.3 + hrand(s + 4) * 0.4) + s),
    y: y0 + hrand(s + 2) * (y1 - y0) + 24 * Math.sin(t * (0.25 + hrand(s + 5) * 0.4) + s * 2),
  };
}

const world = {
  me: '', cats: new Map(), canvas: null, ctx: null, top: null, tctx: null, z: 1, dpr: 1, cw: 0, ch: 0,
  cam: { x: 0, y: 0 }, sprite: null, tinted: new Map(), timer: null, raf: 0, last: 0,
  target: null, pending: null, near: null, prompt: null, keys: new Set(), failing: 0, busy: false, err: '',
  coins: null, wear: {}, owned: [], catalog: null, zone: null, active: Date.now(),
  ball: { x: 360, y: 980, vx: 0, vy: 0, t0: 0 }, kickAt: 0, tv: null, tvAt: 0,
  out: {}, bg: null, noise: [], scan: null, haze: null, glitch: null, nextGlitch: 0, solids: [],
  skew: 0, gone: new Set(), catching: new Set(), bugImg: {}, splashes: [], tile: '', dm: 0,
};

// ── the map: walls with a doorway toward the plaza, a few solid things ──────
function buildSolids() {
  const s = [], T = 16;
  for (const z of ZONES) {
    const gap = 150, gx = z.x + (z.w - gap) / 2;
    const top = z.door === 'top', bottom = z.door === 'bottom';
    const hz = (y, open) => open ? [[z.x, y, gx - z.x, T], [gx + gap, y, z.x + z.w - gx - gap, T]] : [[z.x, y, z.w, T]];
    s.push(...hz(z.y, top), ...hz(z.y + z.h - T, bottom));
    s.push([z.x, z.y, T, z.h], [z.x + z.w - T, z.y, T, z.h]);
  }
  s.push([CLUB_SCREEN.x - 10, z0('club').y, CLUB_SCREEN.w + 20, CLUB_SCREEN.h + 20]);        // the screen stands against the club wall
  s.push([1220, 90, 260, 90], [1540, 90, 92, 120]);                            // terminal monitors
  s.push([1300, 236, 280, 40], [1650, 214, 56, 92]);                           // the counter, the capsule machine
  s.push([WELL.x - 34, WELL.y - 18, 68, 36]);
  for (const [x, y] of TREES) s.push([x - 18, y - 6, 36, 16]);
  s.push([1380, 990, 120, 40]);                                                // the workbench
  for (const [x, y] of POLES) s.push([x - 8, y - 8, 16, 16]);
  world.solids = s.map(([x, y, w, h]) => ({ x, y, w, h }));
}
const z0 = id => ZONES.find(z => z.id === id);
const labLocked = () => rnAuth();
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const zoneAt = (x, y) => ZONES.find(z => inRect(x, y, z)) || PLAZA;
const netNow = () => Date.now() / 1000 + world.skew;

// the cat's feet are a small box; bump it against walls one axis at a time
function blocked(x, y) {
  if (x < 20 || x > WORLD_W - 20 || y < 30 || y > WORLD_H - 8) return true;
  const box = { x: x - 13, y: y - 8, w: 26, h: 10 };
  const hit = r => box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y;
  if (labLocked() && hit(GARDEN_GATE)) return 'lab';
  return world.solids.some(hit);
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
  // a catch counts where I am now, not where I am walking to
  const pos = extra.catch && me ? me : at;
  const body = { ...(pos ? { x: Math.round(pos.x), y: Math.round(pos.y) } : {}), ...extra };
  if (Date.now() - world.active < W_ACTIVE) body.a = 1;
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
  const clock = performance.now() / 1000;
  const here = new Set();
  for (const p of d.people) {
    here.add(p.u);
    let c = world.cats.get(p.u);
    if (!c || c.ghost) {
      c = { u: p.u, d: p.d, x: p.x, y: p.y, tx: p.x, ty: p.y, dir: 'down', flip: false, moving: false, t0: Math.random() * 4, bubble: c?.bubble, trail: [] };
      world.cats.set(p.u, c);
    }
    c.d = p.d; c.w = p.w || {};
    if (p.u !== world.me) { c.tx = p.x; c.ty = p.y; }
    if (p.e && (!c.emote || c.emote.k !== p.e[0] || Math.abs(c.emote.at - (clock - p.e[1])) > 1.5)) c.emote = { k: p.e[0], at: clock - p.e[1] };
  }
  for (const [u, c] of world.cats) if (!c.ghost && !here.has(u)) world.cats.delete(u);
  placeEchoes();

  setCoins(d.coins);
  world.wear = d.wear || {};
  if (d.catalog) { world.catalog = d.catalog; world.owned = d.owned || []; if (!document.getElementById('w-shop').classList.contains('hidden')) renderShop(); }
  if (d.bonus) worldToast(`+${d.bonus} coins for showing up today`);
  if (d.xpcoins) worldToast(`+${d.xpcoins} coins from the beetle game`);
  if (d.shop === 'bought') { worldToast('Bought and put on'); sfx('claim'); }
  if (d.shop === 'poor') worldToast('Not enough coins yet');
  if (d.tv_err) worldToast(d.tv_err);
  if (d.capsule) capsuleResult(d);
  if (d.wish) wishResult(d.wish);
  world.gone = new Set(d.gone || []);
  if (extra.catch) {
    world.catching.delete(extra.catch);
    if (d.caught === extra.catch) {
      const b = bugAt(+extra.catch.split(':')[0], netNow());
      world.gone.add(extra.catch);
      const what = ['a beetle', 'a rare beetle', 'a golden beetle'][b.kind];
      worldToast(d.bug_coins ? `Caught ${what}: +${d.bug_coins}` : `Caught ${what}! (no more beetle coins today)`);
      sfx('claim');
    }
  }
  if (d.dm != null && d.dm !== world.dm) { world.dm = d.dm; window.dmPoke?.(d.dm); }

  // the ball: my own kick stays as I predicted it until the server agrees
  if (performance.now() - world.kickAt > 1500 && d.ball) world.ball = { x: d.ball.x, y: d.ball.y, vx: d.ball.vx, vy: d.ball.vy, t0: clock - d.ball.age };
  tvUpdate(d.tv ? { v: d.tv.v, at: clock - d.tv.age, by: d.tv.by } : null);
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
  if (el) el.textContent = n ? `${n} here` : '';
}
function setCoins(n) {
  if (n == null) return;
  const el = document.getElementById('w-coins');
  if (world.coins != null && n > world.coins) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); }
  world.coins = n;
  el.textContent = `◉ ${n.toLocaleString()}`;
  const sc = document.getElementById('w-shop-coins');
  if (sc) sc.textContent = `◉ ${n.toLocaleString()}`;
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
  if (me && world.keys.size) {
    const k = world.keys;
    const vx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    const vy = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
    if (vx || vy) { world.target = { x: me.x + vx * 40, y: me.y + vy * 40 }; world.pending = null; }
  }
  for (const c of world.cats.values()) {
    const mine = c === me;
    if (mine && world.target) { c.tx = world.target.x; c.ty = world.target.y; }
    const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy);
    if (!mine && dist > 500) { c.x = c.tx; c.y = c.ty; c.moving = false; continue; }
    const step = W_SPEED * dt;
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
    if (c.w?.trail && Math.random() < dt * (c.w.trail === 't_feathers' ? 5 : 14)) c.trail.push({ x: c.x + (Math.random() - 0.5) * 16, y: c.y - 6 - Math.random() * 18, t: clock, r: Math.random() });
  }
  if (!me) return;
  const z = zoneAt(me.x, me.y);
  if (z !== world.zone) enterZone(z);
  kickCheck(me, clock);
  catchCheck(me);
  danceCheck(me);
  // the nearest thing to use, and walking up to the one I tapped
  world.near = SPOTS.filter(s => !s.hide?.()).map(s => ({ s, d: Math.hypot(s.at.x - me.x, s.at.y - me.y) })).filter(o => o.d < 110).sort((a, b) => a.d - b.d)[0]?.s || null;
  const p = world.pending;
  if (p) {
    const d = Math.hypot(p.at.x - me.x, p.at.y - me.y);
    if (d < 30 || (!me.moving && d < 110)) { world.pending = null; p.act(); }
    else if (!me.moving) world.pending = null;
  }
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

function worldAct() { if (world.near) { world.pending = null; world.near.act(); } }

// ── the ball ─────────────────────────────────────────────────────────────────
function fold(p, a, b) { const l = b - a; let q = (p - a) % (2 * l); if (q < 0) q += 2 * l; return a + (q <= l ? q : 2 * l - q); }
function ballAt(clock) {
  const b = world.ball, d = (1 - Math.exp(-BALL_K * Math.max(0, clock - b.t0))) / BALL_K;
  const speed = Math.hypot(b.vx, b.vy) * Math.exp(-BALL_K * Math.max(0, clock - b.t0));
  return { x: fold(b.x + b.vx * d, PEN[0], PEN[2]), y: fold(b.y + b.vy * d, PEN[1], PEN[3]), speed };
}
function kickCheck(me, clock) {
  if (!me.moving || performance.now() - world.kickAt < 450) return;
  const b = ballAt(clock);
  const dx = b.x - me.x, dy = b.y - (me.y - 6), dist = Math.hypot(dx, dy);
  if (dist > 26) return;
  const v = 420 + Math.random() * 160;
  const vx = dx / (dist || 1) * v, vy = dy / (dist || 1) * v;
  world.kickAt = performance.now();
  world.ball = { x: b.x, y: b.y, vx, vy, t0: clock };
  worldSend({ kick: { vx: Math.round(vx), vy: Math.round(vy) } }, true);
  sfx('click');
}

// ── beetles to catch ─────────────────────────────────────────────────────────
function liveBugs() {
  const t = netNow(), out = [];
  for (let k = 0; k < BUG_N; k++) {
    const b = bugAt(k, t);
    if (!world.gone.has(b.id)) out.push(b);
  }
  return out;
}
function catchCheck(me) {
  if (world.catching.size) return;
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
  if (t && t !== world.tile) { const [a, b] = t.split(',').map(Number); chime(a + (3 - b) * 2); }
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

// everything that never moves, drawn once at one pixel per world unit
function buildBackground() {
  const c = document.createElement('canvas'); c.width = WORLD_W; c.height = WORLD_H;
  const g = c.getContext('2d');
  const rnd = (a, b) => a + Math.random() * (b - a);
  // the sky the place floats in
  const sky = g.createLinearGradient(0, 0, 0, WORLD_H);
  sky.addColorStop(0, '#dfe5f8'); sky.addColorStop(0.5, '#ece8f6'); sky.addColorStop(1, '#f6e9f0');
  g.fillStyle = sky; g.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let i = 0; i < 70; i++) {
    const x = rnd(0, WORLD_W), y = rnd(0, WORLD_H), r = rnd(60, 190);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // the walkways: pale glass, with a faint circuit in it
  const walk = (x, y, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(120,128,200,0.16)'; g.lineWidth = 1;
    for (let gx = x; gx <= x + w; gx += 40) { g.beginPath(); g.moveTo(gx + 0.5, y); g.lineTo(gx + 0.5, y + h); g.stroke(); }
    for (let gy = y; gy <= y + h; gy += 40) { g.beginPath(); g.moveTo(x, gy + 0.5); g.lineTo(x + w, gy + 0.5); g.stroke(); }
    g.fillStyle = 'rgba(150,160,230,0.35)'; g.fillRect(x, y, w, 2); g.fillRect(x, y + h - 2, w, 2);
  };
  walk(0, 440, WORLD_W, 320); walk(680, 0, 440, WORLD_H);
  g.fillStyle = 'rgba(120,128,200,0.22)';
  for (let x = 0; x < WORLD_W; x += 60) if (x < 640 || x > 1160) g.fillRect(x, 598, 30, 3);
  for (let y = 0; y < WORLD_H; y += 60) if (y < 420 || y > 780) g.fillRect(898, y, 3, 30);
  // the plaza: rings around the well
  for (let r = 260; r > 60; r -= 40) {
    g.strokeStyle = `rgba(150,160,230,${0.1 + (260 - r) / 1200})`; g.lineWidth = 2;
    g.beginPath(); g.ellipse(WELL.x, WELL.y, r, r * 0.7, 0, 0, Math.PI * 2); g.stroke();
  }

  // floors
  const floor = (z, fn) => { g.save(); g.beginPath(); g.rect(z.x, z.y, z.w, z.h); g.clip(); fn(z); g.restore(); };
  floor(z0('club'), z => {
    g.fillStyle = '#120d1a'; g.fillRect(z.x, z.y, z.w, z.h);
    for (let y = z.y; y < z.y + z.h; y += 30) for (let x = z.x; x < z.x + z.w; x += 30) {
      g.fillStyle = ((x + y) / 30) % 2 ? '#1a1326' : '#100b18'; g.fillRect(x, y, 30, 30);
    }
  });
  floor(z0('shop'), z => {
    g.fillStyle = '#efedf5'; g.fillRect(z.x, z.y, z.w, z.h);
    g.strokeStyle = 'rgba(91,99,230,0.08)';
    for (let x = z.x; x < z.x + z.w; x += 24) { g.beginPath(); g.moveTo(x, z.y); g.lineTo(x, z.y + z.h); g.stroke(); }
    for (let y = z.y; y < z.y + z.h; y += 24) { g.beginPath(); g.moveTo(z.x, y); g.lineTo(z.x + z.w, y); g.stroke(); }
    // cables to the monitors
    g.strokeStyle = 'rgba(40,36,56,0.5)'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(1230 + i * 40, 180); g.bezierCurveTo(1240 + i * 30, 300, rnd(1160, 1300), 340, 1156, 360 + i * 6); g.stroke(); }
    g.lineWidth = 1;
  });
  const grass = (z, base, n, flowers) => {
    g.fillStyle = base; g.fillRect(z.x, z.y, z.w, z.h);
    for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${rnd(70, 120) | 0},${rnd(140, 180) | 0},${rnd(80, 110) | 0},${rnd(0.12, 0.3)})`; g.fillRect(rnd(z.x, z.x + z.w) | 0, rnd(z.y, z.y + z.h) | 0, 2, 4); }
    for (let i = 0; i < flowers; i++) {
      const x = rnd(z.x + 20, z.x + z.w - 20), y = rnd(z.y + 20, z.y + z.h - 20);
      g.fillStyle = ['#ffffff', '#ffd6ea', '#fff3b0', '#d9d4ff'][i % 4];
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) g.fillRect(x + ox, y + oy, 2, 2);
      g.fillStyle = '#e8b84a'; g.fillRect(x, y, 2, 2);
    }
  };
  floor(z0('park'), z => grass(z, '#dcebd5', 2600, 40));
  floor(z0('garden'), z => {
    grass(z, '#cde5c4', 3600, 70);
    // stepping stones to the workbench
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(1440 + (i % 2 ? 10 : -10), 810 + i * 34, 16, 8, 0, 0, Math.PI * 2); g.fill(); }
  });

  // walls: a lit top and a face below it; Cyberia stays dark
  const club = z0('club');
  for (const s of world.solids) {
    if (s.w === 16 && s.h === 16) continue;               // poles are drawn with the wires
    const dark = inRect(s.x + 1, s.y + 1, club);
    g.fillStyle = dark ? 'rgba(10,6,16,0.6)' : 'rgba(80,80,130,0.18)'; g.fillRect(s.x, s.y + s.h, s.w, 8);
    g.fillStyle = dark ? '#221a2e' : '#d9d6e8'; g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = dark ? '#3a2d4a' : '#ffffff'; g.fillRect(s.x, s.y, s.w, 2);
  }
  // terminal: old beige monitors stacked up
  const crt = (x, y, w, h) => {
    g.fillStyle = '#d8d1bd'; g.fillRect(x, y, w, h);
    g.fillStyle = '#a69f8b'; g.fillRect(x, y + h - 6, w, 6);
    g.fillStyle = '#0d1410'; g.fillRect(x + 6, y + 6, w - 12, h - 18);
  };
  MONITORS.forEach(([x, y, w, h]) => crt(x, y, w, h));
  g.fillStyle = '#c9c4da'; g.fillRect(1300, 236, 280, 40);
  g.fillStyle = '#f4f2fa'; g.fillRect(1300, 236, 280, 4);
  // the well
  g.fillStyle = 'rgba(80,80,140,0.18)'; g.beginPath(); g.ellipse(WELL.x, WELL.y + 14, 44, 16, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e9e7f2'; g.beginPath(); g.ellipse(WELL.x, WELL.y, 38, 22, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9c6dc'; g.fillRect(WELL.x - 38, WELL.y, 76, 12);
  g.beginPath(); g.ellipse(WELL.x, WELL.y + 12, 38, 22, 0, 0, Math.PI); g.fill();
  // garden: tree trunks, the workbench with jars of beetles on it
  for (const [x, y] of TREES) { g.fillStyle = '#7a5a44'; g.fillRect(x - 8, y - 40, 16, 46); g.fillStyle = 'rgba(40,80,40,0.25)'; g.beginPath(); g.ellipse(x, y + 6, 40, 12, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#b48a64'; g.fillRect(1380, 990, 120, 40);
  g.fillStyle = '#d4ab82'; g.fillRect(1380, 990, 120, 5);
  g.fillStyle = '#8a6646'; g.fillRect(1386, 1030, 6, 10); g.fillRect(1488, 1030, 6, 10);
  // park fence posts
  g.fillStyle = '#b9b2c9';
  for (let x = PEN[0] - 12; x <= PEN[2] + 12; x += 40) { g.fillRect(x, PEN[1] - 22, 4, 10); g.fillRect(x, PEN[3] + 12, 4, 10); }
  // Cyberia: a speaker stack either side of the screen, a bar along the right
  g.fillStyle = '#07050a';
  g.fillRect(140, 70, 44, 90); g.fillRect(536, 70, 44, 90);
  g.fillStyle = '#1d1a22';
  for (const x of [162, 558]) for (const y of [92, 132]) { g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#2a1f33'; g.fillRect(600, 80, 30, 260);
  world.bg = c;
}
const MONITORS = [[1226, 96, 58, 48], [1290, 96, 58, 48], [1354, 96, 58, 48], [1418, 96, 58, 48], [1546, 96, 40, 48], [1588, 96, 40, 48], [1546, 150, 40, 48], [1588, 150, 40, 48],
  [1226, 140, 58, 40], [1290, 140, 58, 40], [1354, 140, 58, 40], [1418, 140, 58, 40]];

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
  g.fillStyle = '#e6e6f6'; g.fillRect(0, 0, world.canvas.width, world.canvas.height);
  g.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  g.imageSmoothingEnabled = false;
  g.drawImage(world.bg, 0, 0);
  drawLive(g, clock);
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
  for (const t of things) t.ball ? drawBall(gt, t.ball, clock) : drawCat(gt, t.c, clock);
  drawTrees(gt, me);
  drawWires(gt, clock, cx, cy);
  drawLights(gt, clock, cx, cy, vw, vh);
  drawSigns(gt, clock);
  drawPrompt(gt, clock);
  for (const c of world.cats.values()) if (c.bubble && Date.now() < c.bubble.until) drawBubble(gt, c.bubble, Math.round(c.x), Math.round(c.y) - 58, cx, vw);
  drawSplashes(gt, clock);

  gt.setTransform(1, 0, 0, 1, 0, 0);
  post(gt, now);
  if (world.tvEl) placeTv(cx, cy);
}

// the monitors, the screen, the dance floor, the well, the capsule machine
function drawLive(g, t) {
  MONITORS.forEach(([x, y, w, h], i) => {
    if (Math.sin(t * 0.7 + i * 1.7) < -0.8) return;
    g.fillStyle = 'rgba(156,255,176,0.12)'; g.fillRect(x + 6, y + 6, w - 12, h - 18);
    g.fillStyle = 'rgba(156,255,176,0.6)';
    for (let l = 0; l < 4; l++) {
      const len = ((Math.sin(i * 9 + l * 3 + Math.floor(t * 2 + i)) + 1) / 2) * (w - 20);
      g.fillRect(x + 9, y + 9 + l * ((h - 22) / 4), len, 2);
    }
  });
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
  // the well: water with light in it
  const wg = g.createRadialGradient(WELL.x, WELL.y, 2, WELL.x, WELL.y, 30);
  wg.addColorStop(0, '#ffffff'); wg.addColorStop(0.5, '#bfe0ff'); wg.addColorStop(1, '#8fb5f0');
  g.fillStyle = wg; g.beginPath(); g.ellipse(WELL.x, WELL.y, 30, 15, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1;
  for (let i = 0; i < 2; i++) { const r = ((t * 12 + i * 15) % 30); g.globalAlpha = 1 - r / 30; g.beginPath(); g.ellipse(WELL.x, WELL.y, r, r / 2, 0, 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1;
  // the capsule machine
  const M = { x: 1650, y: 214 };
  g.fillStyle = '#e14d9c'; g.fillRect(M.x, M.y + 46, 56, 46);
  g.fillStyle = '#b8347b'; g.fillRect(M.x, M.y + 86, 56, 6);
  g.fillStyle = '#fff'; g.fillRect(M.x + 18, M.y + 62, 20, 14);
  g.fillStyle = 'rgba(220,235,255,0.75)'; g.beginPath(); g.arc(M.x + 28, M.y + 30, 26, Math.PI, 0); g.fill(); g.fillRect(M.x + 2, M.y + 30, 52, 16);
  [['#ffd34d', 14, 36], ['#7fd1ff', 28, 30], ['#ff8fb8', 40, 38], ['#a9f0b0', 22, 42], ['#c7a6ff', 36, 22]].forEach(([c, ox, oy], i) => {
    g.fillStyle = c; g.beginPath(); g.arc(M.x + ox, M.y + oy + Math.sin(t * 2 + i) * 0.6, 5, 0, Math.PI * 2); g.fill();
  });
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(M.x + 12, M.y + 12, 4, 10);
  // the workbench glows when the beetle game is open to you
  if (!labLocked()) {
    const gr = g.createRadialGradient(1440, 1000, 0, 1440, 1000, 90);
    gr.addColorStop(0, `rgba(170,255,190,${0.25 + Math.sin(t * 2) * 0.08})`); gr.addColorStop(1, 'rgba(170,255,190,0)');
    g.fillStyle = gr; g.fillRect(1350, 910, 180, 180);
  }
  for (let i = 0; i < 4; i++) {        // jars on the bench
    g.fillStyle = 'rgba(230,245,255,0.85)'; g.fillRect(1392 + i * 26, 974, 16, 20);
    g.fillStyle = ['#3d9e4a', '#c43a3a', '#d4a531', '#6b4fc4'][i]; g.fillRect(1397 + i * 26, 984 + Math.round(Math.sin(t * 3 + i) * 2), 6, 5);
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
    c.trail = c.trail.filter(p => t - p.t < (c.w?.trail === 't_feathers' ? 2.2 : 1.2));
    for (const p of c.trail) {
      const age = t - p.t;
      if (c.w?.trail === 't_hearts') { g.globalAlpha = 1 - age / 1.2; g.font = wf(9); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff5a78'; g.fillText('♥', p.x, p.y - age * 12); }
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
    const size = b.kind === 2 ? 26 : 22;
    g.fillStyle = 'rgba(40,40,70,0.2)'; g.beginPath(); g.ellipse(b.x, b.y + 3, size / 2.6, size / 6, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(b.x, b.y - 4); g.rotate(ang + Math.sin(t * 14 + b.s) * 0.08);
    g.imageSmoothingEnabled = true; g.drawImage(img, -size / 2, -size / 2, size, size); g.imageSmoothingEnabled = false;
    g.restore();
    if (b.kind === 2 && Math.sin(t * 4 + b.s) > 0.6) { g.fillStyle = '#fff6c0'; g.fillRect(b.x + 8, b.y - 16, 2, 6); g.fillRect(b.x + 6, b.y - 14, 6, 2); }
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
  const seq = CAT_ANIM[c.moving ? 'walk' : 'idle'][dir];
  const f = sleeping && !c.moving ? 1 : seq[Math.floor((t + c.t0) * (c.moving ? 8 : 2)) % seq.length];
  const sx = (f % 3) * 48, sy = Math.floor(f / 3) * 48;
  const x = Math.round(c.x);
  const hop = dancing && !c.moving ? Math.round(Math.abs(Math.sin((t - c.emote.at) * 8)) * 6) : 0;
  const y = Math.round(c.y);
  const flick = c.ghost ? (Math.sin(t * 11 + c.t0 * 5) > 0.85 ? 0.15 : 0.45) : 1;
  g.globalAlpha = flick;
  // shadow, with the red spots shadows have out here
  g.fillStyle = 'rgba(40,36,80,0.28)';
  g.beginPath(); g.ellipse(x, y, 15, 5, 0, 0, Math.PI * 2); g.fill();
  if (!c.ghost) {
    g.fillStyle = 'rgba(200,0,40,0.55)';
    for (const [ox, oy, r] of [[-6, 0, 1.6], [4, -1, 1.2], [8, 1, 1]]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill(); }
  }
  if (c.w?.back === 'wings') drawWings(g, x, y - hop, t + c.t0, c.moving);
  if (c.w?.hold === 'balloon') drawBalloon(g, x, y - hop, t + c.t0);
  g.save();
  g.translate(x, y - hop);
  if (flip) g.scale(-1, 1);
  g.drawImage(sheet, sx, sy, 48, 48, -24, -46, 48, 48);
  g.restore();
  if (c.w?.hat) drawHat(g, c.w.hat, x, y - hop - 38, dir, t);
  if (c.w?.hold && c.w.hold !== 'balloon') drawHold(g, c.w.hold, x, y - hop, flip, t);
  label(g, c, x, y);
  g.globalAlpha = 1;
  if (em) {
    const age = t - c.emote.at;
    g.globalAlpha = Math.min(1, (4 - age) * 2);
    g.font = wf(18); g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(EMOTE_ICON[em] || '', x + (em === 'sleep' ? 14 : 0), y - 50 - hop - Math.min(10, age * 12));
    g.globalAlpha = 1;
  }
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

function drawHat(g, id, x, y, dir, t) {
  g.save();
  switch (id) {
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
  } else if (id === 'lantern') {
    const gr = g.createRadialGradient(hx, hy, 0, hx, hy, 26);
    gr.addColorStop(0, `rgba(255,220,140,${0.45 + Math.sin(t * 5) * 0.05})`); gr.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = gr; g.fillRect(hx - 26, hy - 26, 52, 52);
    g.strokeStyle = '#5a5070'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx, hy - 12); g.lineTo(hx, hy - 7); g.stroke();
    g.fillStyle = '#5a5070'; g.fillRect(hx - 4, hy - 7, 8, 2); g.fillRect(hx - 4, hy + 5, 8, 2);
    g.fillStyle = '#ffd98a'; g.fillRect(hx - 3, hy - 5, 6, 10);
  }
}

// text keeps at least its size on screen when the world is drawn small (phones)
const wf = (px, weight = '') => `${weight} ${Math.round(px / Math.min(1, world.z))}px ui-monospace, "DejaVu Sans Mono", Menlo, monospace`;

function label(g, c, x, y) {
  g.font = wf(10);
  g.textAlign = 'center'; g.textBaseline = 'top';
  const name = (c.d || c.u).slice(0, 18) + (c.u === world.me ? ' (you)' : '');
  const m = g.measureText(name), w = m.width + 8, h = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent + 3;
  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.fillRect(x - w / 2, y + 5, w, h);
  g.fillStyle = c.ghost ? '#8a86a0' : `hsl(${nameHue(c.d || c.u)} 60% 38%)`;
  g.fillText(name, x, y + 7);
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
    for (const [ox, oy, r, c] of [[0, -70, 46, '#5fae6a'], [-26, -52, 30, '#4f9d5c'], [28, -54, 32, '#58a764'], [6, -88, 28, '#76c27f']]) {
      g.fillStyle = c; g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(x - 10, y - 92, 14, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

// power lines overhead: they sit a little above the world, so they drift
// slower than the ground when the camera moves
function drawWires(g, t, camX, camY) {
  const px = camX * 0.06, py = camY * 0.06;
  g.save(); g.translate(px, py);
  for (const [x, y] of POLES) {
    g.fillStyle = 'rgba(40,40,80,0.18)'; g.fillRect(x - px - 4, y - py - 2, 30, 6);     // shadow on the ground
    g.fillStyle = '#36314a'; g.fillRect(x - 3, y - 150, 6, 150);
    g.fillRect(x - 26, y - 140, 52, 4); g.fillRect(x - 20, y - 122, 40, 3);
    g.fillRect(x + 6, y - 112, 12, 16);                                              // transformer
  }
  g.strokeStyle = 'rgba(54,49,74,0.7)'; g.lineWidth = 1.2;
  const sag = (x1, y1, x2, y2, d) => { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + d + Math.sin(t * 0.8 + x1) * 1.5, x2, y2); g.stroke(); };
  const links = [[0, 1], [2, 3], [0, 2], [1, 3], [4, 0], [4, 2], [1, 5], [3, 5]];
  for (const [a, b] of links) {
    const [x1, y1] = POLES[a], [x2, y2] = POLES[b];
    for (const [o, h] of [[-24, 140], [24, 140], [-18, 122], [18, 122]]) sag(x1 + o, y1 - h, x2 + o, y2 - h, 26);
  }
  // and off the edge of the map, to wherever the rest of the network is
  for (const [i, ex, ey] of [[4, -60, 400], [4, -60, 720], [5, WORLD_W + 60, 380], [5, WORLD_W + 60, 760], [0, 640, -80], [1, 1160, -80], [2, 640, WORLD_H + 200], [3, 1160, WORLD_H + 200]]) {
    const [x, y] = POLES[i];
    sag(x - 24, y - 140, ex, ey - 140, 40); sag(x + 24, y - 140, ex + 30, ey - 130, 40);
  }
  g.restore();
}

// light from above: soft shafts that sway, motes drifting up, Cyberia's glow
function drawLights(g, t, cx, cy, vw, vh) {
  g.save();
  g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) {
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
  for (let i = 0; i < 46; i++) {
    const x = (hrand(i + 1) * WORLD_W + Math.sin(t * 0.3 + i) * 30) % WORLD_W;
    const y = WORLD_H - ((hrand(i + 50) * WORLD_H + t * (8 + hrand(i + 9) * 14)) % WORLD_H);
    if (x < cx - 10 || x > cx + vw + 10 || y < cy - 10 || y > cy + vh + 10) continue;
    g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + i);
    g.fillStyle = i % 5 ? '#ffffff' : '#ffe9b0';
    g.fillRect(x, y, 2, 2);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(360, 260, 0, 360, 260, 260);
  gr.addColorStop(0, 'rgba(255,61,110,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(100, 40, 520, 380);
  g.restore();
}

function drawSigns(g, t) {
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const z of ZONES) {
    const sx = z.x + z.w / 2, sy = z.door === 'bottom' ? z.y + z.h + 22 : z.y - 24;
    const dim = Math.sin(t * 7 + z.x) > 0.97;
    g.font = wf(15, 'bold');
    g.shadowColor = '#ffffff'; g.shadowBlur = dim ? 0 : 8;
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
  v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(236,232,255,0.6)');
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
  const was = world.tv?.v;
  world.tv = tv;
  if (tv?.v !== was) tvActive(true);
}

// the player only runs while you are in Cyberia and said yes to YouTube
async function tvActive(changed = false) {
  const want = world.tv && tvOk() && world.zone?.id === 'club';
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
  await loadYt();
  if (world.player || !world.tv || world.zone?.id !== 'club' || !world.tvEl) return;
  world.player = new YT.Player(world.tvEl.firstChild, {
    host: 'https://www.youtube-nocookie.com', videoId: tv.v,
    playerVars: { autoplay: 1, start: Math.floor(start), playsinline: 1, rel: 0, modestbranding: 1 },
    events: { onReady: e => { world.tvShown = true; e.target.playVideo(); } },
  });
}

// keep the video on the screen in the world, and in step with everyone else
function placeTv(cx, cy) {
  const z = world.z, el = world.tvEl;
  el.style.left = `${(CLUB_SCREEN.x - cx) * z}px`; el.style.top = `${(CLUB_SCREEN.y - cy) * z}px`;
  el.style.width = `${CLUB_SCREEN.w * z}px`; el.style.height = `${CLUB_SCREEN.h * z}px`;
  if (world.player?.getCurrentTime && performance.now() - world.tvAt > 10000 && world.tv) {
    world.tvAt = performance.now();
    const should = performance.now() / 1000 - world.tv.at, is = world.player.getCurrentTime();
    const dur = world.player.getDuration?.() || 0;
    if (Math.abs(should - is) > 4 && (!dur || should < dur)) world.player.seekTo(should, true);
  }
}

function openScreen() {
  const box = document.getElementById('w-screen');
  box.classList.remove('hidden');
  document.getElementById('w-tv-consent').classList.toggle('hidden', tvOk());
  document.getElementById('w-tv-url').value = '';
  document.getElementById('w-tv-now').textContent = world.tv ? `Playing now, put on by ${world.tv.by}.` : 'Nothing is playing.';
}

// ── the terminal: the wardrobe and the capsule machine ──────────────────────
const SLOT_NAMES = { hat: 'On your head', back: 'On your back', col: 'Fur', hold: 'To carry', trail: 'Trail' };
function openShop() {
  document.getElementById('w-shop').classList.remove('hidden');
  if (!world.catalog) document.getElementById('w-shop-list').innerHTML = '<p class="w-dim">Connecting…</p>';
  else renderShop();
  worldSend({ shopinfo: 1 }, true);
}
function renderShop() {
  const list = document.getElementById('w-shop-list');
  const groups = {};
  for (const it of world.catalog) (groups[it.slot] ??= []).push(it);
  list.innerHTML = Object.entries(groups).map(([slot, items]) => `<h3>${SLOT_NAMES[slot] || slot}</h3><div class="w-items">${items.map(it => {
    const own = world.owned.includes(it.id), on = world.wear[slot] === it.id;
    const btn = on ? `<button type="button" data-off="${slot}">Take off</button>`
      : own ? `<button type="button" data-wear="${it.id}" data-slot="${slot}">Wear</button>`
      : !it.price ? '<span class="w-dim">from a capsule</span>'
      : `<button type="button" data-buy="${it.id}" ${world.coins < it.price ? 'disabled' : ''}>◉ ${it.price}</button>`;
    return `<div class="w-item${on ? ' on' : ''}${!own && !it.price ? ' locked' : ''}"><canvas width="64" height="64" data-prev="${it.id}" data-slot="${slot}"></canvas><span>${esc(it.name)}</span>${btn}</div>`;
  }).join('')}</div>`).join('');
  list.querySelectorAll('canvas[data-prev]').forEach(cv => previewCat(cv, { [cv.dataset.slot]: cv.dataset.prev }));
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
  if (c.w.hold === 'balloon') drawBalloon(g, 26, 62, 0);
  g.drawImage(sheet, 48, 0, 48, 48, 8, 12, 48, 48);
  if (c.w.hat) drawHat(g, c.w.hat, 32, 20, 'down', 0);
  if (c.w.hold && c.w.hold !== 'balloon') drawHold(g, c.w.hold, 32, 58, false);
  if (c.w.trail) { g.fillStyle = c.w.trail === 't_hearts' ? '#ff5a78' : c.w.trail === 't_feathers' ? '#b9b5d2' : '#6b6680'; for (let i = 0; i < 6; i++) g.fillRect(4 + i * 3, 30 + (i % 3) * 7, 2, 2); }
}

function openCapsule() {
  document.getElementById('w-capsule').classList.remove('hidden');
  document.getElementById('w-cap-got').classList.add('hidden');
  document.getElementById('w-cap-turn').disabled = false;
  if (!world.catalog) worldSend({ shopinfo: 1 }, true);
}
function capsuleResult(d) {
  const btn = document.getElementById('w-cap-turn');
  btn.disabled = false;
  if (d.capsule === 'poor') return worldToast('The capsule machine takes 30 coins.');
  if (d.capsule === 'all') return worldToast('You have everything the capsule machine has. More soon.');
  const got = document.getElementById('w-cap-got');
  got.classList.remove('hidden');
  got.querySelector('span').textContent = `${d.capsule_name}! You are wearing it now.`;
  const slot = world.catalog?.find(i => i.id === d.capsule)?.slot || 'hat';
  previewCat(got.querySelector('canvas'), { [slot]: d.capsule });
  sfx('claim');
}

// ── the well ─────────────────────────────────────────────────────────────────
function makeWish() {
  if (world.coins != null && world.coins < 1) return worldToast('The well takes a coin. Come back with one.');
  worldSend({ wish: 1 }, true);
}
function wishResult(r) {
  if (r === 'poor') return worldToast('The well takes a coin. Come back with one.');
  if (r !== 'ok') return;
  const t = performance.now() / 1000;
  world.splashes.push({ x: WELL.x, y: WELL.y - 20, t, text: '◉ -1' });
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
function openWho(c, sx, sy) {
  const box = document.getElementById('w-who');
  box.dataset.u = c.u; box.dataset.d = c.d || c.u;
  box.querySelector('strong').textContent = c.d || c.u;
  box.querySelector('[data-who="dm"]').classList.toggle('hidden', !window.dmOpen);
  box.classList.remove('hidden');
  const wrap = document.getElementById('world');
  box.style.left = `${Math.max(8, Math.min(wrap.clientWidth - box.offsetWidth - 8, sx - box.offsetWidth / 2))}px`;
  box.style.top = `${Math.max(8, sy - box.offsetHeight - 60)}px`;
}

// ── input ────────────────────────────────────────────────────────────────────
const W_KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
function worldKey(e, down) {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  world.active = Date.now();
  if (down && key === 'e') { worldAct(); return; }
  if (down && key === 'Escape') { closePanels(); return; }
  const k = W_KEYS[key];
  if (!k) return;
  e.preventDefault();
  if (down) world.keys.add(k); else world.keys.delete(k);
}
function closePanels() {
  for (const id of ['w-shop', 'w-screen', 'w-capsule', 'w-emotes', 'w-who']) document.getElementById(id).classList.add('hidden');
  if (!document.getElementById('w-lab').classList.contains('hidden')) closeLab();
}

// a tap: on a prompt or a thing, walk up and use it; on a cat, its menu; else walk there
function worldPointer(e) {
  const r = world.top.getBoundingClientRect();
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  const x = world.cam.x + sx / world.z, y = world.cam.y + sy / world.z;
  world.active = Date.now();
  document.getElementById('w-emotes').classList.add('hidden');
  document.getElementById('w-who').classList.add('hidden');
  const p = world.prompt;
  if (p && inRect(x, y, p)) { world.pending = null; p.s.act(); return; }
  const c = catAt(x, y);
  if (c) { openWho(c, sx, sy); return; }
  const spot = SPOTS.find(s => !s.hide?.() && inRect(x, y, { x: s.r.x - 8, y: s.r.y - 8, w: s.r.w + 16, h: s.r.h + 16 }));
  if (spot) { world.pending = spot; world.target = { ...spot.at }; }
  else { world.pending = null; world.target = { x, y }; }
  worldTick();
}
function worldHover(e) {
  const r = world.top.getBoundingClientRect();
  const x = world.cam.x + (e.clientX - r.left) / world.z, y = world.cam.y + (e.clientY - r.top) / world.z;
  const over = (world.prompt && inRect(x, y, world.prompt)) || catAt(x, y) || SPOTS.some(s => !s.hide?.() && inRect(x, y, s.r));
  world.top.style.cursor = over ? 'pointer' : 'crosshair';
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
  buildBackground();
  world.top.addEventListener('pointerdown', worldPointer);
  world.top.addEventListener('pointermove', worldHover);
  document.getElementById('w-emote-btn').addEventListener('click', () => document.getElementById('w-emotes').classList.toggle('hidden'));
  document.getElementById('w-emotes').addEventListener('click', e => {
    const k = e.target.closest('button')?.dataset.emote;
    if (!k) return;
    world.active = Date.now();
    const me = world.cats.get(world.me);
    if (me) me.emote = { k, at: performance.now() / 1000 };
    worldSend({ emote: k }, true);
    document.getElementById('w-emotes').classList.add('hidden');
  });
  document.getElementById('w-who').addEventListener('click', e => {
    const box = document.getElementById('w-who'), act = e.target.closest('[data-who]')?.dataset.who;
    if (!act) return;
    box.classList.add('hidden');
    if (act === 'dm') window.dmOpen?.(box.dataset.u, box.dataset.d);
    if (act === 'wave') { const me = world.cats.get(world.me); if (me) me.emote = { k: 'wave', at: performance.now() / 1000 }; worldSend({ emote: 'wave' }, true); }
    if (act === 'mention') { const i = document.getElementById('chat-input'); i.value = `${i.value}${i.value && !i.value.endsWith(' ') ? ' ' : ''}~${box.dataset.u} `; i.focus(); }
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
    if (id === 'w-cap-turn') { e.target.disabled = true; worldSend({ capsule: 1, shopinfo: 1 }, true); }
  });
  document.getElementById('w-screen').addEventListener('click', e => {
    const id = e.target.id;
    if (id === 'w-screen' || id === 'w-screen-close') closePanels();
    if (id === 'w-tv-yes') { try { localStorage.setItem(LS_TV_OK, '1'); } catch {} document.getElementById('w-tv-consent').classList.add('hidden'); tvActive(true); }
    if (id === 'w-tv-play') { const v = document.getElementById('w-tv-url').value.trim(); if (v) { worldSend({ tv: v }, true); closePanels(); } }
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
