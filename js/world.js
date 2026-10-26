// BeetleBoy SP · The world (world.html): a dark little piece of the network
// where everyone signed in walks around as a Remicat while the RemiliaNET chat
// runs beside it. A junction under the power lines, a club with a shared
// screen, a terminal that sells hats, a yard with a ball, and the lab where the
// beetle game runs (password login only, the remilia sign-in cannot craft).
// world.php keeps positions, emotes, the ball, the screen and the coins.

const WORLD_W = 1800, WORLD_H = 1200;
const W_SPEED = 170;                 // world units a second
const W_POLL = 1000;
const W_ACTIVE = 180_000;            // input this recent counts as "here" for coins
const PEN = [120, 860, 600, 1100];   // the yard's ball pen, as in world.php
const BALL_K = 1.4, BALL_R = 10;

const ZONES = [
  { id: 'club', name: 'CLUB', x: 60, y: 40, w: 600, h: 380, door: 'bottom', col: '#ff2a3a' },
  { id: 'shop', name: 'TERMINAL', x: 1140, y: 40, w: 600, h: 380, door: 'bottom', col: '#9cffb0' },
  { id: 'yard', name: 'YARD', x: 60, y: 780, w: 600, h: 380, door: 'top', col: '#e8d68a' },
  { id: 'lab', name: 'LAB', x: 1140, y: 780, w: 600, h: 380, door: 'top', col: '#9cffb0' },
];
const JUNCTION = { id: 'junction', name: 'JUNCTION' };
const CLUB_SCREEN = { x: 200, y: 52, w: 320, h: 180 };          // the club screen, 16:9
const LAB_DOOR = { x: 1370, y: 772, w: 140, h: 24 };
const POLES = [[700, 450], [1100, 450], [700, 750], [1100, 750], [300, 600], [1500, 600]];
const LAMPS = [[900, 470], [900, 730], [480, 600], [1320, 600]];
const EMOTE_ICON = { wave: '👋', heart: '❤️', laugh: '😂', spark: '✨', sleep: '💤', dance: '🎵', what: '❓' };
const GLITCH_LINES = ['PRESENT DAY', 'PRESENT TIME', 'you are connected', 'layer 01', 'who is here?', 'the network remembers', 'no carrier'];

const world = {
  me: '', cats: new Map(), canvas: null, ctx: null, z: 1, dpr: 1, cw: 0, ch: 0,
  cam: { x: 0, y: 0 }, sprite: null, tinted: new Map(), timer: null, raf: 0, last: 0,
  target: null, keys: new Set(), failing: 0, busy: false, err: '',
  coins: null, wear: {}, owned: [], catalog: null, zone: null, active: Date.now(),
  ball: { x: 360, y: 980, vx: 0, vy: 0, t0: 0 }, kickAt: 0, tv: null, tvAt: 0,
  out: {}, bg: null, noise: [], scan: null, glitch: null, nextGlitch: 0, solids: [],
};

// ── the map: walls with a doorway toward the street, a few solid things ─────
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
  s.push([1220, 90, 260, 90], [1540, 90, 140, 120]);                           // terminal monitors
  s.push([1200, 860, 200, 40], [1480, 860, 200, 40], [1200, 960, 200, 40], [1480, 960, 200, 40]); // server racks
  for (const [x, y] of POLES) s.push([x - 8, y - 8, 16, 16]);
  world.solids = s.map(([x, y, w, h]) => ({ x, y, w, h }));
}
const z0 = id => ZONES.find(z => z.id === id);
const labLocked = () => rnAuth();
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const zoneAt = (x, y) => ZONES.find(z => inRect(x, y, z)) || JUNCTION;

// the cat's feet are a small box; bump it against walls one axis at a time
function blocked(x, y) {
  if (x < 20 || x > WORLD_W - 20 || y < 30 || y > WORLD_H - 8) return true;
  const box = { x: x - 13, y: y - 8, w: 26, h: 10 };
  const hit = r => box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y;
  if (labLocked() && hit(LAB_DOOR)) return 'lab';
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
  const body = { ...(at ? { x: Math.round(at.x), y: Math.round(at.y) } : {}), ...extra };
  if (Date.now() - world.active < W_ACTIVE) body.a = 1;
  const d = await worldPost(body);
  if (!d?.people) {
    if (++world.failing === 5) worldNote(`The world is not answering right now (${world.err || '?'}).`);
    return;
  }
  if (world.failing >= 5) worldNote('');
  world.failing = 0;
  world.me = d.me;
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

  // the ball: my own kick stays as I predicted it until the server agrees
  if (performance.now() - world.kickAt > 1500 && d.ball) world.ball = { x: d.ball.x, y: d.ball.y, vx: d.ball.vx, vy: d.ball.vy, t0: clock - d.ball.age };
  tvUpdate(d.tv ? { v: d.tv.v, at: clock - d.tv.age, by: d.tv.by } : null);
  worldCount();
}

// people who chatted in the last ten minutes but are not in the world stand
// at the edge of the junction, flickering
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
    const x = 720 + (i % 7) * 60 + (i >= 7 ? 30 : 0), y = i >= 7 ? 520 : 470;
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
function worldToast(t) {
  const el = document.getElementById('w-toast');
  el.textContent = t; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── moving ───────────────────────────────────────────────────────────────────
function worldStep(dt, clock) {
  const me = world.cats.get(world.me);
  if (me && world.keys.size) {
    const k = world.keys;
    const vx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    const vy = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
    if (vx || vy) world.target = { x: me.x + vx * 40, y: me.y + vy * 40 };
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
    if (mine) {
      // slide along walls: try both axes, then each on its own
      const bx = blocked(c.x + mx, c.y), by = blocked(c.x, c.y + my), bb = blocked(c.x + mx, c.y + my);
      if (!bb) { c.x += mx; c.y += my; }
      else if (!bx) c.x += mx;
      else if (!by) c.y += my;
      else { world.target = null; c.tx = c.x; c.ty = c.y; c.moving = false; }
      if ([bx, by, bb].includes('lab')) labDenied();
    } else { c.x += mx; c.y += my; }
    if (Math.abs(dx) > Math.abs(dy)) { c.dir = 'side'; c.flip = dx < 0; } else c.dir = dy < 0 ? 'up' : 'down';
    if (c.w?.trail && Math.random() < dt * 14) c.trail.push({ x: c.x + (Math.random() - 0.5) * 16, y: c.y - 6 - Math.random() * 18, t: clock });
  }
  if (me) {
    const z = zoneAt(me.x, me.y);
    if (z !== world.zone) enterZone(z);
    kickCheck(me, clock);
  }
}

let deniedAt = 0;
function labDenied() {
  if (Date.now() - deniedAt < 4000) return;
  deniedAt = Date.now();
  worldToast('The lab needs the password login: remilia sign-in cannot play the beetle game.');
}

function enterZone(z) {
  world.zone = z;
  const el = document.getElementById('w-zone');
  el.textContent = z.name; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  const act = document.getElementById('w-act');
  const acts = { club: '▶ Screen', shop: '◉ Shop', lab: labLocked() ? '🔒 Lab' : '⌁ Jack in' };
  act.textContent = acts[z.id] || '';
  act.classList.toggle('hidden', !acts[z.id]);
  tvActive();
}

function worldAct() {
  const z = world.zone?.id;
  if (z === 'club') openScreen();
  else if (z === 'shop') openShop();
  else if (z === 'lab') labLocked() ? labDenied() : openLab();
}

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
  g.fillStyle = '#0a090e'; g.fillRect(0, 0, WORLD_W, WORLD_H);
  // grit
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${rnd(0.02, 0.06)})`; g.fillRect(rnd(0, WORLD_W) | 0, rnd(0, WORLD_H) | 0, 2, 2); }
  // the streets: one across, one down the middle
  g.fillStyle = '#141219';
  g.fillRect(0, 440, WORLD_W, 320); g.fillRect(680, 0, 440, WORLD_H);
  g.fillStyle = 'rgba(232,214,138,0.18)';
  for (let x = 0; x < WORLD_W; x += 60) if (x < 660 || x > 1120) g.fillRect(x, 598, 30, 4);
  for (let y = 0; y < WORLD_H; y += 60) if (y < 420 || y > 780) g.fillRect(898, y, 4, 30);
  // the crossing
  g.fillStyle = 'rgba(220,220,230,0.07)';
  for (let x = 700; x < 1100; x += 28) { g.fillRect(x, 452, 16, 52); g.fillRect(x, 696, 16, 52); }
  for (let y = 520; y < 690; y += 28) { g.fillRect(692, y, 52, 16); g.fillRect(1056, y, 52, 16); }

  // floors
  const floor = (z, fn) => { g.save(); g.beginPath(); g.rect(z.x, z.y, z.w, z.h); g.clip(); fn(z); g.restore(); };
  floor(z0('club'), z => {
    for (let y = z.y; y < z.y + z.h; y += 30) for (let x = z.x; x < z.x + z.w; x += 30) {
      g.fillStyle = ((x + y) / 30) % 2 ? '#130a12' : '#0d070d'; g.fillRect(x, y, 30, 30);
    }
  });
  floor(z0('shop'), z => {
    g.fillStyle = '#0b0e0e'; g.fillRect(z.x, z.y, z.w, z.h);
    g.strokeStyle = 'rgba(156,255,176,0.05)';
    for (let x = z.x; x < z.x + z.w; x += 24) { g.beginPath(); g.moveTo(x, z.y); g.lineTo(x, z.y + z.h); g.stroke(); }
    for (let y = z.y; y < z.y + z.h; y += 24) { g.beginPath(); g.moveTo(z.x, y); g.lineTo(z.x + z.w, y); g.stroke(); }
  });
  floor(z0('lab'), z => {
    g.fillStyle = '#070c09'; g.fillRect(z.x, z.y, z.w, z.h);
    g.strokeStyle = 'rgba(156,255,176,0.07)';
    for (let x = z.x; x < z.x + z.w; x += 40) { g.beginPath(); g.moveTo(x, z.y); g.lineTo(x, z.y + z.h); g.stroke(); }
    for (let y = z.y; y < z.y + z.h; y += 40) { g.beginPath(); g.moveTo(z.x, y); g.lineTo(z.x + z.w, y); g.stroke(); }
    // cables across the floor
    g.strokeStyle = '#020403'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      g.beginPath(); g.moveTo(rnd(z.x, z.x + z.w), z.y + 20);
      g.bezierCurveTo(rnd(z.x, z.x + z.w), rnd(z.y, z.y + z.h), rnd(z.x, z.x + z.w), rnd(z.y, z.y + z.h), 1440 + rnd(-30, 30), 1070);
      g.stroke();
    }
    g.lineWidth = 1;
  });
  floor(z0('yard'), z => {
    g.fillStyle = '#0c0f0a'; g.fillRect(z.x, z.y, z.w, z.h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd(60, 110) | 0},${rnd(90, 130) | 0},${rnd(40, 70) | 0},${rnd(0.05, 0.16)})`; g.fillRect(rnd(z.x, z.x + z.w) | 0, rnd(z.y, z.y + z.h) | 0, 2, 3); }
  });

  // walls: a lit top and a dark face below it
  for (const s of world.solids) {
    if (s.w === 16 && s.h === 16) continue;               // poles are drawn with the wires
    g.fillStyle = '#05040a'; g.fillRect(s.x, s.y + s.h, s.w, 10);
    g.fillStyle = '#1b1922'; g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = '#2a2733'; g.fillRect(s.x, s.y, s.w, 2);
  }
  // terminal: old monitors stacked up
  const crt = (x, y, w, h) => {
    g.fillStyle = '#c9c3b0'; g.fillRect(x, y, w, h);
    g.fillStyle = '#8f8a7a'; g.fillRect(x, y + h - 6, w, 6);
    g.fillStyle = '#050806'; g.fillRect(x + 6, y + 6, w - 12, h - 18);
  };
  [[1226, 96], [1290, 96], [1354, 96], [1418, 96], [1546, 96], [1610, 96], [1546, 150], [1610, 150]].forEach(([x, y]) => crt(x, y, 58, 48));
  [[1226, 140], [1290, 140], [1354, 140], [1418, 140]].forEach(([x, y]) => crt(x, y, 58, 40));
  g.fillStyle = '#25212c'; g.fillRect(1300, 250, 280, 26);
  g.fillStyle = '#3a3445'; g.fillRect(1300, 250, 280, 3);
  // lab: racks
  for (const [x, y] of [[1200, 860], [1480, 860], [1200, 960], [1480, 960]]) {
    g.fillStyle = '#0d0f12'; g.fillRect(x, y, 200, 40);
    g.fillStyle = '#1c2026';
    for (let i = 0; i < 10; i++) g.fillRect(x + 4 + i * 20, y + 4, 16, 32);
  }
  // the chair you jack in from
  g.fillStyle = '#1a1620'; g.fillRect(1418, 1050, 44, 34);
  g.fillStyle = '#2b2533'; g.fillRect(1418, 1050, 44, 6);
  // yard fence posts
  g.fillStyle = '#2a2622';
  for (let x = PEN[0] - 12; x <= PEN[2] + 12; x += 40) { g.fillRect(x, PEN[1] - 22, 4, 10); g.fillRect(x, PEN[3] + 12, 4, 10); }
  // the club: a speaker stack either side of the screen, a bar along the right
  g.fillStyle = '#0a090c';
  g.fillRect(140, 70, 44, 90); g.fillRect(536, 70, 44, 90);
  g.fillStyle = '#1d1a22';
  for (const x of [162, 558]) for (const y of [92, 132]) { g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#1d1720'; g.fillRect(600, 80, 30, 260);
  world.bg = c;
}

function worldDraw(now) {
  const g = world.ctx, z = world.z, s = z * world.dpr;
  const clock = now / 1000;
  const vw = world.cw / z, vh = world.ch / z;
  const me = world.cats.get(world.me);
  if (me) {
    world.cam.x = vw >= WORLD_W ? (WORLD_W - vw) / 2 : Math.max(0, Math.min(WORLD_W - vw, me.x - vw / 2));
    world.cam.y = vh >= WORLD_H ? (WORLD_H - vh) / 2 : Math.max(0, Math.min(WORLD_H - vh, me.y - vh / 2));
  }
  const cx = Math.round(world.cam.x * s) / s, cy = Math.round(world.cam.y * s) / s;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#050407'; g.fillRect(0, 0, world.canvas.width, world.canvas.height);
  g.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  g.imageSmoothingEnabled = false;
  g.drawImage(world.bg, 0, 0);

  drawLive(g, clock);

  if (world.target && me?.moving) {
    g.strokeStyle = '#ff2a3a'; g.globalAlpha = 0.6;
    g.beginPath(); g.ellipse(world.target.x, world.target.y, 10, 4, 0, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  }

  // things that stand on the floor, back to front
  const b = ballAt(clock);
  const things = [...world.cats.values()].map(c => ({ y: c.y, c }));
  things.push({ y: b.y, ball: b });
  things.sort((a, b2) => a.y - b2.y);
  for (const t of things) t.ball ? drawBall(g, t.ball, clock) : drawCat(g, t.c, clock);
  for (const c of world.cats.values()) if (c.bubble && Date.now() < c.bubble.until) drawBubble(g, c.bubble, Math.round(c.x), Math.round(c.y) - 58, cx, vw);

  drawWires(g, clock, cx, cy);
  drawLights(g, clock);
  drawSigns(g, clock);

  // the screen effects, in device pixels
  g.setTransform(1, 0, 0, 1, 0, 0);
  post(g, now);
  if (world.tvEl) placeTv(cx, cy);
}

// blinking LEDs, the monitors, the screen, the lab door
function drawLive(g, t) {
  // terminal monitors: green text that scrolls
  const mons = [[1226, 96, 58, 48], [1290, 96, 58, 48], [1354, 96, 58, 48], [1418, 96, 58, 48], [1546, 96, 58, 48], [1610, 96, 58, 48], [1546, 150, 58, 48], [1610, 150, 58, 48],
    [1226, 140, 58, 40], [1290, 140, 58, 40], [1354, 140, 58, 40], [1418, 140, 58, 40]];
  mons.forEach(([x, y, w, h], i) => {
    const on = (Math.sin(t * 0.7 + i * 1.7) > -0.8);
    if (!on) return;
    g.fillStyle = 'rgba(156,255,176,0.10)'; g.fillRect(x + 6, y + 6, w - 12, h - 18);
    g.fillStyle = 'rgba(156,255,176,0.55)';
    for (let l = 0; l < 4; l++) {
      const len = ((Math.sin(i * 9 + l * 3 + Math.floor(t * 2 + i)) + 1) / 2) * (w - 20);
      g.fillRect(x + 9, y + 9 + l * ((h - 22) / 4), len, 2);
    }
  });
  // rack LEDs
  for (const [x, y] of [[1200, 860], [1480, 860], [1200, 960], [1480, 960]]) for (let i = 0; i < 10; i++) {
    const k = Math.sin(t * (3 + i % 4) + i * 7 + x) > 0.3;
    g.fillStyle = k ? '#9cffb0' : '#1f4a2c'; g.fillRect(x + 8 + i * 20, y + 10, 3, 3);
    g.fillStyle = Math.sin(t * 5 + i * 3 + y) > 0.8 ? '#ff2a3a' : '#3a1418'; g.fillRect(x + 8 + i * 20, y + 18, 3, 3);
  }
  // the club screen
  const S = CLUB_SCREEN;
  g.fillStyle = '#000'; g.fillRect(S.x - 6, S.y - 6, S.w + 12, S.h + 12);
  if (!world.tvEl || !world.tvShown) {
    g.drawImage(world.noise[Math.floor(t * 20) % world.noise.length], 0, 0, 128, 72, S.x, S.y, S.w, S.h);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(S.x, S.y, S.w, S.h);
    g.font = wf(13, 'bold'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e9e4ff';
    g.fillText(world.tv ? (world.zone?.id === 'club' ? '▶ press Screen to watch along' : '▶ something is playing') : 'NO SIGNAL', S.x + S.w / 2, S.y + S.h / 2);
    if (world.tv?.by) { g.font = wf(10); g.fillStyle = 'rgba(233,228,255,0.7)'; g.fillText(`put on by ${world.tv.by}`, S.x + S.w / 2, S.y + S.h / 2 + 20); }
  }
  // the dance floor lights up while the screen plays
  if (world.tv) {
    const club = z0('club');
    for (let i = 0; i < 6; i++) {
      const px = club.x + 60 + ((Math.sin(t * 0.9 + i * 2.1) + 1) / 2) * (club.w - 120);
      const py = club.y + 260 + ((Math.cos(t * 1.1 + i * 1.3) + 1) / 2) * 100;
      const gr = g.createRadialGradient(px, py, 0, px, py, 60);
      gr.addColorStop(0, i % 2 ? 'rgba(255,42,58,0.18)' : 'rgba(150,90,255,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(px - 60, py - 60, 120, 120);
    }
  }
  // the lab door: taped off for the remilia sign-in
  if (labLocked()) {
    const D = LAB_DOOR;
    g.fillStyle = 'rgba(255,42,58,0.12)'; g.fillRect(D.x, D.y - 4, D.w, D.h + 8);
    g.save(); g.beginPath(); g.rect(D.x, D.y + 6, D.w, 10); g.clip();
    for (let x = D.x - 20; x < D.x + D.w + 20; x += 20) { g.fillStyle = (x / 20) % 2 ? '#ff2a3a' : '#e9e4ff'; g.beginPath(); g.moveTo(x, D.y + 16); g.lineTo(x + 10, D.y + 6); g.lineTo(x + 20, D.y + 6); g.lineTo(x + 10, D.y + 16); g.fill(); }
    g.restore();
    g.font = wf(12, 'bold'); g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillStyle = Math.sin(t * 4) > -0.3 ? '#ff2a3a' : '#7a121c';
    g.fillText('🔒 ACCESS DENIED', D.x + D.w / 2, D.y - 6);
  }
  // trails fade where they were dropped
  for (const c of world.cats.values()) {
    c.trail = c.trail.filter(p => t - p.t < 1.2);
    for (const p of c.trail) {
      const a = 1 - (t - p.t) / 1.2;
      if (c.w?.trail === 't_hearts') { g.globalAlpha = a; g.font = wf(9); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', p.x, p.y - (t - p.t) * 12); g.fillStyle = '#ff5a78'; }
      else { g.globalAlpha = a * 0.8; g.fillStyle = Math.random() < 0.5 ? '#e9e4ff' : '#6b6680'; g.fillRect(p.x, p.y, 2, 2); }
    }
    g.globalAlpha = 1;
  }
}

function drawBall(g, b, t) {
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.ellipse(b.x, b.y + 2, 10, 4, 0, 0, Math.PI * 2); g.fill();
  const hop = Math.min(8, b.speed / 60) * Math.abs(Math.sin(t * 9));
  g.fillStyle = '#c3122f';
  g.beginPath(); g.arc(b.x, b.y - BALL_R - hop, BALL_R, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
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
  const flick = c.ghost ? (Math.sin(t * 11 + c.t0 * 5) > 0.85 ? 0.12 : 0.38) : 1;
  g.globalAlpha = flick;
  // shadow, with the red spots shadows have out here
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.beginPath(); g.ellipse(x, y, 15, 5, 0, 0, Math.PI * 2); g.fill();
  if (!c.ghost) {
    g.fillStyle = '#b3001e';
    for (const [ox, oy, r] of [[-6, 0, 1.6], [4, -1, 1.2], [8, 1, 1]]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill(); }
  }
  if (c.w?.hold === 'balloon') drawBalloon(g, x, y - hop, t + c.t0);
  g.save();
  g.translate(x, y - hop);
  if (flip) g.scale(-1, 1);
  g.drawImage(sheet, sx, sy, 48, 48, -24, -46, 48, 48);
  g.restore();
  if (c.w?.hat) drawHat(g, c.w.hat, x, y - hop - 38, dir, t);
  if (c.w?.hold && c.w.hold !== 'balloon') drawHold(g, c.w.hold, x, y - hop, flip);
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

function drawHat(g, id, x, y, dir, t) {
  g.save();
  switch (id) {
    case 'antenna':
      g.strokeStyle = '#d8d4e8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 3, y + 4); g.lineTo(x + 7, y - 10); g.stroke();
      g.fillStyle = Math.sin(t * 6) > 0 ? '#ff2a3a' : '#7a121c'; g.beginPath(); g.arc(x + 7, y - 11, 2.5, 0, Math.PI * 2); g.fill();
      break;
    case 'bow':
      g.fillStyle = '#ff2a3a';
      g.beginPath(); g.moveTo(x + 6, y + 2); g.lineTo(x - 2, y - 4); g.lineTo(x - 2, y + 7); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x + 6, y + 2); g.lineTo(x + 14, y - 4); g.lineTo(x + 14, y + 7); g.closePath(); g.fill();
      g.fillStyle = '#9e0d1f'; g.fillRect(x + 4, y, 4, 4);
      break;
    case 'headset':
      g.strokeStyle = '#1a1820'; g.lineWidth = 3; g.beginPath(); g.arc(x, y + 8, 14, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.fillStyle = '#2b2733'; g.fillRect(x - 17, y + 4, 6, 10); g.fillRect(x + 11, y + 4, 6, 10);
      g.fillStyle = '#ff2a3a'; g.fillRect(x - 16, y + 7, 2, 2);
      break;
    case 'halo':
      g.strokeStyle = '#ffe9a0'; g.lineWidth = 2; g.shadowColor = '#ffe9a0'; g.shadowBlur = 8;
      g.beginPath(); g.ellipse(x, y - 6 + Math.sin(t * 2) * 1.5, 11, 3.5, 0, 0, Math.PI * 2); g.stroke();
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
  g.strokeStyle = 'rgba(233,228,255,0.6)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x + 10, y - 14); g.quadraticCurveTo(x + 16, y - 40, bx, by + 11); g.stroke();
  g.fillStyle = '#ff2a3a'; g.beginPath(); g.ellipse(bx, by, 9, 11, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(bx - 3, by - 4, 2.5, 0, Math.PI * 2); g.fill();
}
function drawHold(g, id, x, y, flip) {
  const hx = x + (flip ? -15 : 15), hy = y - 14;
  if (id === 'phone') {
    g.fillStyle = '#c9c3b0'; g.fillRect(hx - 3, hy - 9, 7, 13);
    g.fillStyle = '#9cffb0'; g.fillRect(hx - 2, hy - 7, 5, 4);
  } else if (id === 'teddy') {
    g.fillStyle = '#9a7652';
    g.beginPath(); g.arc(hx, hy - 6, 5, 0, Math.PI * 2); g.arc(hx, hy + 2, 6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(hx - 4, hy - 10, 2, 0, Math.PI * 2); g.arc(hx + 4, hy - 10, 2, 0, Math.PI * 2); g.fill();
  }
}

// text keeps at least its size on screen when the world is drawn small (phones)
const wf = (px, weight = '') => `${weight} ${Math.round(px / Math.min(1, world.z))}px ui-monospace, "DejaVu Sans Mono", Menlo, monospace`;

function label(g, c, x, y) {
  g.font = wf(10);
  g.textAlign = 'center'; g.textBaseline = 'top';
  const name = (c.d || c.u).slice(0, 18) + (c.u === world.me ? ' (you)' : '');
  const m = g.measureText(name), w = m.width + 8, h = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent + 3;
  g.fillStyle = 'rgba(0,0,0,0.7)';
  g.fillRect(x - w / 2, y + 5, w, h);
  g.fillStyle = c.ghost ? '#8a86a0' : `hsl(${nameHue(c.d || c.u)} 75% 75%)`;
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
  g.fillStyle = '#e9e4ff'; g.strokeStyle = '#000'; g.lineWidth = 1;
  roundRect(g, bx, by, lw, lh, 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - 4, by + lh); g.lineTo(x, by + lh + 5); g.lineTo(x + 4, by + lh); g.closePath(); g.fill();
  if (img) { g.imageSmoothingEnabled = true; g.drawImage(img, bx + (lw - iw) / 2, by + 4, iw, ih); g.imageSmoothingEnabled = false; }
  g.fillStyle = '#0a0910';
  const ty = by + 4 + (img ? ih + 4 : 0);
  lines.forEach((l, i) => g.fillText(l, bx + lw / 2, ty + lh1 / 2 + i * lh1));
}

// power lines overhead: they sit a little above the world, so they drift
// slower than the ground when the camera moves
function drawWires(g, t, camX, camY) {
  const px = camX * 0.06, py = camY * 0.06;
  g.save(); g.translate(px, py);
  for (const [x, y] of POLES) {
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x - px - 4, y - py - 2, 30, 6);     // shadow on the street
    g.fillStyle = '#030205'; g.fillRect(x - 3, y - 150, 6, 150);
    g.fillRect(x - 26, y - 140, 52, 4); g.fillRect(x - 20, y - 122, 40, 3);
    g.fillRect(x + 6, y - 112, 12, 16);                                              // transformer
  }
  g.strokeStyle = '#030205'; g.lineWidth = 1.6;
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

function drawLights(g, t) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  LAMPS.forEach(([x, y], i) => {
    const flicker = Math.sin(t * 13 + i * 5) > 0.97 ? 0.3 : 1;
    const gr = g.createRadialGradient(x, y, 0, x, y, 130);
    gr.addColorStop(0, `rgba(216,192,112,${0.14 * flicker})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - 130, y - 130, 260, 260);
  });
  // the terminal and the lab glow a little green, the club a little red
  for (const [x, y, c] of [[1440, 180, '156,255,176'], [1440, 1000, '156,255,176'], [360, 260, '255,42,58']]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, 260);
    gr.addColorStop(0, `rgba(${c},0.07)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - 260, y - 260, 520, 520);
  }
  g.restore();
}

function drawSigns(g, t) {
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const z of ZONES) {
    const sx = z.x + z.w / 2, sy = z.door === 'bottom' ? z.y + z.h + 22 : z.y - 22;
    const dim = Math.sin(t * 7 + z.x) > 0.96;
    g.font = wf(16, 'bold');
    g.shadowColor = z.col; g.shadowBlur = dim ? 0 : 10;
    g.fillStyle = dim ? '#3a3440' : z.col;
    g.fillText(z.name.split('').join(' '), sx, sy);
  }
  g.restore();
}

// scanlines, grain, a dark edge and now and then a glitch
function post(g, now) {
  const W = world.canvas.width, H = world.canvas.height;
  g.globalAlpha = 0.07;
  const n = world.noise[Math.floor(now / 50) % world.noise.length];
  g.fillStyle = g.createPattern(n, 'repeat'); g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.fillStyle = world.scan; g.fillRect(0, 0, W, H);
  g.fillStyle = world.vignette; g.fillRect(0, 0, W, H);
  if (now > world.nextGlitch) {
    if (!world.glitch) world.glitch = { until: now + 160 + Math.random() * 200, line: GLITCH_LINES[Math.floor(Math.random() * GLITCH_LINES.length)] };
    if (now < world.glitch.until) {
      for (let i = 0; i < 3; i++) {
        const y = Math.random() * H, h = 4 + Math.random() * 30 * world.dpr, dx = (Math.random() - 0.5) * 40 * world.dpr;
        g.drawImage(world.canvas, 0, y, W, h, dx, y, W, h);
      }
      g.font = `${14 * world.dpr}px ui-monospace, monospace`; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = 'rgba(255,42,58,0.85)';
      g.fillText(world.glitch.line, 14 * world.dpr, H - 40 * world.dpr);
    } else { world.glitch = null; world.nextGlitch = now + 15000 + Math.random() * 25000; }
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
  world.canvas.width = Math.round(cw * world.dpr); world.canvas.height = Math.round(ch * world.dpr);
  world.z = Math.max(0.5, Math.min(1.6, ch / 560, cw / 480));
  const g = world.ctx;
  const sc = document.createElement('canvas'); sc.width = 1; sc.height = Math.max(2, Math.round(3 * world.dpr));
  const sg = sc.getContext('2d'); sg.fillStyle = 'rgba(0,0,0,0.18)'; sg.fillRect(0, 0, 1, Math.max(1, Math.round(world.dpr)));
  world.scan = g.createPattern(sc, 'repeat');
  const W = world.canvas.width, H = world.canvas.height;
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.65)');
  world.vignette = v;
}

// ── the club screen: a YouTube video everyone in the club watches together ──
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

// the player only runs while you stand in the club and said yes to YouTube
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
  await loadYt();
  if (world.player || !world.tv || world.zone?.id !== 'club') return;
  const el = document.createElement('div'); el.id = 'w-tv';
  const inner = document.createElement('div'); el.appendChild(inner);
  document.getElementById('world').appendChild(el);
  world.tvEl = el;
  world.player = new YT.Player(inner, {
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

// ── the terminal: hats, fur and things to carry ─────────────────────────────
const SLOT_NAMES = { hat: 'On your head', col: 'Fur', hold: 'To carry', trail: 'Trail' };
function openShop() {
  document.getElementById('w-shop').classList.remove('hidden');
  if (!world.catalog) document.getElementById('w-shop-list').innerHTML = '<p class="w-dim">Connecting…</p>';
  else renderShop();
  worldSend({ shopinfo: 1 }, true);
}
function renderShop() {
  const list = document.getElementById('w-shop-list');
  const me = world.cats.get(world.me);
  const groups = {};
  for (const it of world.catalog) (groups[it.slot] ??= []).push(it);
  list.innerHTML = Object.entries(groups).map(([slot, items]) => `<h3>${SLOT_NAMES[slot] || slot}</h3><div class="w-items">${items.map(it => {
    const own = world.owned.includes(it.id), on = world.wear[slot] === it.id;
    const btn = on ? `<button type="button" data-off="${slot}">Take off</button>`
      : own ? `<button type="button" data-wear="${it.id}" data-slot="${slot}">Wear</button>`
      : `<button type="button" data-buy="${it.id}" ${world.coins < it.price ? 'disabled' : ''}>◉ ${it.price}</button>`;
    return `<div class="w-item${on ? ' on' : ''}"><canvas width="64" height="64" data-prev="${it.id}" data-slot="${slot}"></canvas><span>${esc(it.name)}</span>${btn}</div>`;
  }).join('')}</div>`).join('');
  // a little picture of your own cat wearing it
  list.querySelectorAll('canvas[data-prev]').forEach(cv => {
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const fake = { u: me?.u || '', d: me?.d || '', w: { ...world.wear, [cv.dataset.slot]: cv.dataset.prev }, x: 32, y: 56, dir: 'down', moving: false, t0: 0, trail: [] };
    g.save(); g.translate(0, 0);
    const z = world.z; world.z = 1;
    drawCatPreview(g, fake);
    world.z = z;
    g.restore();
  });
  setCoins(world.coins);
}
function drawCatPreview(g, c) {
  const sheet = catSheet(furOf(c, 0));
  if (c.w.hold === 'balloon') drawBalloon(g, 26, 62, 0);
  g.drawImage(sheet, 48, 0, 48, 48, 8, 12, 48, 48);
  if (c.w.hat) drawHat(g, c.w.hat, 32, 20, 'down', 0);
  if (c.w.hold && c.w.hold !== 'balloon') drawHold(g, c.w.hold, 32, 58, false);
  if (c.w.trail) { g.fillStyle = c.w.trail === 't_hearts' ? '#ff5a78' : '#e9e4ff'; for (let i = 0; i < 6; i++) g.fillRect(4 + i * 3, 30 + (i % 3) * 7, 2, 2); }
}

// ── the lab: the beetle game in a window over the world ──────────────────────
function openLab() {
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
  document.getElementById('w-shop').classList.add('hidden');
  document.getElementById('w-screen').classList.add('hidden');
  document.getElementById('w-emotes').classList.add('hidden');
  if (!document.getElementById('w-lab').classList.contains('hidden')) closeLab();
}

function worldLeave() {
  const { access } = getTokens();
  if (access && world.me) navigator.sendBeacon?.('world.php', JSON.stringify({ token: access, leave: true }));
}

function startWorld() {
  if (world.started) return;
  world.started = true;
  worldFit();
  enterZone(JUNCTION);
  worldTick();
  world.timer = setInterval(worldTick, W_POLL);
  world.raf = requestAnimationFrame(worldFrame);
}

function setupWorld() {
  world.canvas = document.getElementById('w-canvas');
  world.ctx = world.canvas.getContext('2d');
  world.sprite = new Image();
  world.sprite.src = 'icons/remicat.png';
  for (let i = 0; i < 4; i++) world.noise.push(noiseTile(255));
  buildSolids();
  buildBackground();
  world.canvas.addEventListener('pointerdown', e => {
    const r = world.canvas.getBoundingClientRect();
    world.active = Date.now();
    world.target = { x: world.cam.x + (e.clientX - r.left) / world.z, y: world.cam.y + (e.clientY - r.top) / world.z };
    document.getElementById('w-emotes').classList.add('hidden');
    worldTick();
  });
  document.getElementById('w-act').addEventListener('click', worldAct);
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
  document.getElementById('w-shop').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'w-shop-close' || e.target.id === 'w-shop') return closePanels();
    if (b.dataset.buy) worldSend({ buy: b.dataset.buy, shopinfo: 1 }, true);
    if (b.dataset.wear) { world.wear[b.dataset.slot] = b.dataset.wear; worldSend({ wear: { [b.dataset.slot]: b.dataset.wear }, shopinfo: 1 }, true); renderShop(); }
    if (b.dataset.off) { delete world.wear[b.dataset.off]; worldSend({ wear: { [b.dataset.off]: null }, shopinfo: 1 }, true); renderShop(); }
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
