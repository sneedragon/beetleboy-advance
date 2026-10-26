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
const W_SKATE = 245;                 // on the skateboard (world.php lets nobody go faster than 260)
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
const POND = { x: 460, y: 610 };                                // fishing, as in world.php
const EMOTE_ICON = { wave: '👋', heart: '❤️', laugh: '😹', spark: '💫', sleep: '💤', dance: '🎵', what: '❓', hug: '🤗', high5: '🙌', gift: '🎁' };
const FISH_ICON = { minnow: '🐟', koi: '🎏', puffer: '🐡', jelly: '🪼', eel: '🪱', angel: '🐠', boot: '👢', disk: '💾', golden: '👑',
  shrimp: '🦐', crab: '🦀', frog: '🐸', shell: '🐚', squid: '🦑', duck: '🦆', turtle: '🐢', lobster: '🦞', whale: '🐋' };
const STALL = { x: 1250, y: 470, w: 100, h: 50, at: { x: 1300, y: 560 } };   // the stall buys what you found, as in world.php
const BIN = { x: 1600, y: 668, w: 48, h: 40, at: { x: 1624, y: 740 } };      // the lost and found box
const MAILBOX = { x: 1178, y: 612, w: 26, h: 64, at: { x: 1191, y: 712 } };  // walk up to it for your messages
const STALL_SOLID = [STALL.x, STALL.y + 14, STALL.w, 32], BIN_SOLID = [BIN.x + 2, BIN.y + 8, BIN.w - 4, BIN.h - 10];
// the place floats in the sky: you can walk on these and nowhere else
const PLATFORMS = [[30, 400, 1740, 400], [680, 10, 440, 1180], ...[[60, 40], [1140, 40], [60, 780], [1140, 780]].map(([x, y]) => [x, y, 600, 380])]
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
  { id: 'screen', r: { x: 200, y: 52, w: 320, h: 180 }, at: { x: 360, y: 300 }, col: '#ff3d6e', text: () => world.tv ? '▶ Watch along' : '▶ Put on a video', act: () => openScreen() },
  { id: 'shop', r: { x: 1300, y: 236, w: 280, h: 40 }, at: { x: 1440, y: 310 }, col: '#5b63e6', text: () => '★ Wardrobe', act: () => openShop() },
  { id: 'capsule', r: { x: 1650, y: 214, w: 56, h: 92 }, at: { x: 1640, y: 350 }, col: '#d65bb6', text: () => '★ 30 Capsule', act: () => openCapsule() },
  { id: 'well', r: { x: 862, y: 566, w: 76, h: 56 }, at: { x: 900, y: 660 }, col: '#7fb8ff', text: () => '✧ Wish (★ 1)', act: () => makeWish() },
  { id: 'game', r: { x: 1380, y: 984, w: 120, h: 56 }, at: { x: 1440, y: 960 }, col: '#2f9a5e', text: () => '🪲 Play the beetle game', act: () => openLab(), hide: () => labLocked() },
  { id: 'pond', r: { x: POND.x - 56, y: POND.y - 26, w: 112, h: 52 }, at: { x: POND.x, y: POND.y + 52 }, col: '#3f7fdc', text: () => world.fishing ? '🎣 Reel in' : '🎣 Fish', act: () => castLine() },
  { id: 'stall', r: STALL, at: STALL.at, col: '#e8a33d', text: () => '★ Sell what you found', act: () => openBag('things') },
  { id: 'mail', r: MAILBOX, at: MAILBOX.at, col: '#d8443c', text: () => world.unread ? `✉ Mailbox (${world.unread} new)` : '✉ Mailbox', act: () => window.dmOpen?.(), hide: () => !window.dmOpen },
  { id: 'bin', r: BIN, at: BIN.at, col: '#8c86a3', text: () => '📦 Lost and found', act: () => dig() },
  { id: 'gate', r: { x: 1370, y: 740, w: 140, h: 60 }, at: { x: 1440, y: 740 }, col: '#c23a4a', text: () => '🔒 Password sign-in only', act: () => labDenied(true), hide: () => !labLocked() },
];

// beetles: every browser works out the same ones from the clock (bugAt() in world.php)
const BUG_N = 4, BUG_LIFE = 90;
const BUG_AREAS = [[1180, 830, 1700, 1130], [1180, 830, 1700, 1130], [140, 820, 620, 1120], [720, 480, 1080, 720]];
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
  const [x0, y0, x1, y1] = BUG_AREAS[k], r = hrand(s + 3);
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
  ball: { x: 360, y: 980, vx: 0, vy: 0, t0: 0 }, kickAt: 0, tv: null, tvAt: 0,
  out: {}, bg: null, noise: [], scan: null, haze: null, glitch: null, nextGlitch: 0, solids: [],
  skew: 0, gone: new Set(), catching: new Set(), bugImg: {}, splashes: [], tile: '', dm: 0,
  tvq: [], lastSeen: new Map(), looked: false, fx: new Map(), toss: new Map(), seenIn: new Set(), aim: null, fishing: null, sky: null,
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
  s.push([POND.x - 52, POND.y - 22, 104, 44]);
  for (const [x, y] of TREES) s.push([x - 18, y - 6, 36, 16]);
  s.push([1380, 990, 120, 40]);                                                // the workbench
  s.push(STALL_SOLID, BIN_SOLID, [MAILBOX.x + 8, MAILBOX.y + 50, 10, 14]);
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
  if (!PLATFORMS.some(p => x > p.x + 12 && x < p.x + p.w - 12 && y > p.y + 14 && y < p.y + p.h - 4)) return true;    // the edge, and the sky below
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
    case 'c_mint': return [160, 0.55, 0.7];
    case 'c_gold': return [45, 0.9, 0.55 + Math.round(Math.sin(t * 3) * 2) / 40];
    case 'c_night': return [235, 0.45, 0.22];
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
  const pos = (extra.catch || extra.sell || extra.dig) && me ? me : at;
  const body = { ...(pos ? { x: Math.round(pos.x), y: Math.round(pos.y) } : {}), ...extra };
  if (Date.now() - world.active < W_ACTIVE) body.a = 1;
  if (world.skate) body.sk = 1;
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
  if (clock - (world.lastTick ?? -1e9) > 30) world.looked = false;     // back from a hidden tab: just look around
  world.lastTick = clock;
  for (const p of d.people) {
    here.add(p.u);
    let c = world.cats.get(p.u);
    if (!c || c.ghost) {
      c = { u: p.u, d: p.d, x: p.x, y: p.y, tx: p.x, ty: p.y, dir: 'down', flip: false, moving: false, t0: Math.random() * 4, bubble: c?.bubble, trail: [] };
      world.cats.set(p.u, c);
    }
    c.d = p.d; c.w = p.w || {}; c.st = p.st || ''; c.sk = p.u === world.me ? world.skate : !!p.sk;
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
  if (d.catalog) { world.catalog = d.catalog; world.owned = d.owned || []; if (!document.getElementById('w-shop').classList.contains('hidden')) renderShop(); }
  if (d.bonus) worldToast(`+${d.bonus} stars for showing up today`);
  if (d.xpcoins) worldToast(`+${d.xpcoins} stars from the beetle game`);
  if (d.shop === 'bought') { worldToast('Bought and put on'); sfx('claim'); }
  if (d.shop === 'poor') worldToast('Not enough stars yet');
  if (d.tv_err) worldToast(d.tv_err);
  if (d.capsule) capsuleResult(d);
  if (d.wish) wishResult(d.wish);
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
    }
  }
  if (d.dm != null && d.dm !== world.dm) { world.dm = d.dm; window.dmPoke?.(d.dm); }

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
  el.textContent = `★ ${n.toLocaleString()}`;
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
  const k = b.ox || b.oy ? Math.max(0, 1 - (clock - b.oAt) / 0.35) : 0;
  return { x: fold(b.x + b.vx * d, PEN[0], PEN[2]) + (b.ox || 0) * k, y: fold(b.y + b.vy * d, PEN[1], PEN[3]) + (b.oy || 0) * k, speed };
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
function buildBackground() {
  const c = document.createElement('canvas'); c.width = WORLD_W; c.height = WORLD_H;
  const g = c.getContext('2d');
  const rnd = (a, b) => a + Math.random() * (b - a);
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
    top.addColorStop(0, D ? '#1b1922' : '#eceef4'); top.addColorStop(1, D ? '#141219' : '#cdd1de');
    g.fillStyle = top; roundRect(g, p.x, p.y, p.w, p.h, 12); g.fill();
  }
  // seams in the plastic, and the lit rim
  g.save();
  g.beginPath(); for (const p of P) g.rect(p.x + 6, p.y + 6, p.w - 12, p.h - 12); g.clip();
  g.strokeStyle = D ? 'rgba(255,255,255,0.03)' : 'rgba(70,80,120,0.13)'; g.lineWidth = 1;
  for (let x = 0; x <= WORLD_W; x += 40) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, WORLD_H); g.stroke(); }
  for (let y = 0; y <= WORLD_H; y += 40) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(WORLD_W, y + 0.5); g.stroke(); }
  g.restore();
  g.fillStyle = D ? 'rgba(232,214,138,0.18)' : 'rgba(80,90,130,0.16)';
  for (let x = 40; x < WORLD_W - 40; x += 60) if (x < 640 || x > 1160) g.fillRect(x, 598, 30, 3);
  for (let y = 20; y < WORLD_H - 20; y += 60) if (y < 420 || y > 780) g.fillRect(898, y, 3, 30);
  // the plaza: rings around the well
  for (let r = 260; r > 60; r -= 40) {
    g.strokeStyle = D ? `rgba(120,140,255,${0.03 + (260 - r) / 3600})` : `rgba(60,100,200,${0.06 + (260 - r) / 1800})`; g.lineWidth = 2;
    g.beginPath(); g.ellipse(WELL.x, WELL.y, r, r * 0.7, 0, 0, Math.PI * 2); g.stroke();
  }
  // the pond: a hole in the platform with the sky showing through
  g.save();
  g.beginPath(); g.ellipse(POND.x, POND.y, 56, 26, 0, 0, Math.PI * 2); g.clip();
  g.drawImage(sky, (POND.x - 60) / 2, (POND.y + 80) / 2, 60, 30, POND.x - 60, POND.y - 30, 120, 60);
  g.restore();
  g.strokeStyle = D ? '#2a2733' : '#9da3b6'; g.lineWidth = 4; g.beginPath(); g.ellipse(POND.x, POND.y, 56, 26, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = D ? '#4a4460' : '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(POND.x, POND.y - 2, 58, 27, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();

  // floors
  const floor = (z, fn) => { g.save(); g.beginPath(); roundRect(g, z.x, z.y, z.w, z.h, 12); g.clip(); fn(z); g.restore(); };
  floor(z0('club'), z => {
    g.fillStyle = '#120d1a'; g.fillRect(z.x, z.y, z.w, z.h);
    for (let y = z.y; y < z.y + z.h; y += 30) for (let x = z.x; x < z.x + z.w; x += 30) {
      g.fillStyle = ((x + y) / 30) % 2 ? '#1a1326' : '#100b18'; g.fillRect(x, y, 30, 30);
    }
  });
  floor(z0('shop'), z => {
    g.fillStyle = D ? '#0b0e0e' : '#e4e5ea'; g.fillRect(z.x, z.y, z.w, z.h);
    g.strokeStyle = D ? 'rgba(80,200,140,0.07)' : 'rgba(40,60,140,0.08)';
    for (let x = z.x; x < z.x + z.w; x += 24) { g.beginPath(); g.moveTo(x, z.y); g.lineTo(x, z.y + z.h); g.stroke(); }
    for (let y = z.y; y < z.y + z.h; y += 24) { g.beginPath(); g.moveTo(z.x, y); g.lineTo(z.x + z.w, y); g.stroke(); }
    // cables to the monitors
    g.strokeStyle = D ? 'rgba(90,84,110,0.5)' : 'rgba(40,36,56,0.5)'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(1230 + i * 40, 180); g.bezierCurveTo(1240 + i * 30, 300, rnd(1160, 1300), 340, 1156, 360 + i * 6); g.stroke(); }
    g.lineWidth = 1;
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
  floor(z0('park'), z => grass(z, D ? '#0c0f0a' : '#cfe6c6', 2600, 40));
  floor(z0('garden'), z => {
    grass(z, D ? '#0d110b' : '#cde5c4', 3600, 70);
    // stepping stones to the workbench
    g.fillStyle = D ? 'rgba(120,115,140,0.35)' : 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(1440 + (i % 2 ? 10 : -10), 810 + i * 34, 16, 8, 0, 0, Math.PI * 2); g.fill(); }
  });

  // walls: a lit top and a face below it; Cyberia stays dark
  const club = z0('club');
  for (const s of world.solids) {
    if (s.w === 16 && s.h === 16) continue;               // poles are drawn with the wires
    if (s.x === POND.x - 52 && s.y === POND.y - 22) continue;
    const dark = inRect(s.x + 1, s.y + 1, club);
    if ([STALL_SOLID, BIN_SOLID].some(([x, y]) => s.x === x && s.y === y)) continue;
    g.fillStyle = dark ? 'rgba(10,6,16,0.6)' : D ? 'rgba(0,0,0,0.5)' : 'rgba(40,50,90,0.22)'; g.fillRect(s.x, s.y + s.h, s.w, 8);
    g.fillStyle = dark ? '#221a2e' : D ? '#1b1922' : '#c3c6d2'; g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = dark ? '#3a2d4a' : D ? '#2a2733' : '#ffffff'; g.fillRect(s.x, s.y, s.w, 2);
    if (!dark) { g.fillStyle = D ? '#05040a' : '#9da3b6'; g.fillRect(s.x, s.y + s.h - 2, s.w, 2); }
  }
  // terminal: old beige monitors stacked up
  const crt = (x, y, w, h) => {
    g.fillStyle = '#d8d1bd'; g.fillRect(x, y, w, h);
    g.fillStyle = '#a69f8b'; g.fillRect(x, y + h - 6, w, 6);
    g.fillStyle = '#0d1410'; g.fillRect(x + 6, y + 6, w - 12, h - 18);
  };
  MONITORS.forEach(([x, y, w, h]) => crt(x, y, w, h));
  g.fillStyle = D ? '#24212e' : '#c9c4da'; g.fillRect(1300, 236, 280, 40);
  g.fillStyle = D ? '#3a3648' : '#f4f2fa'; g.fillRect(1300, 236, 280, 4);
  // the well
  g.fillStyle = 'rgba(80,80,140,0.18)'; g.beginPath(); g.ellipse(WELL.x, WELL.y + 14, 44, 16, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = D ? '#2a2733' : '#e9e7f2'; g.beginPath(); g.ellipse(WELL.x, WELL.y, 38, 22, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = D ? '#1b1922' : '#c9c6dc'; g.fillRect(WELL.x - 38, WELL.y, 76, 12);
  g.beginPath(); g.ellipse(WELL.x, WELL.y + 12, 38, 22, 0, 0, Math.PI); g.fill();
  // garden: tree trunks, the workbench with jars of beetles on it
  for (const [x, y] of TREES) { g.fillStyle = '#7a5a44'; g.fillRect(x - 8, y - 40, 16, 46); g.fillStyle = 'rgba(40,80,40,0.25)'; g.beginPath(); g.ellipse(x, y + 6, 40, 12, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#b48a64'; g.fillRect(1380, 990, 120, 40);
  g.fillStyle = '#d4ab82'; g.fillRect(1380, 990, 120, 5);
  g.fillStyle = '#8a6646'; g.fillRect(1386, 1030, 6, 10); g.fillRect(1488, 1030, 6, 10);
  // park fence posts
  g.fillStyle = D ? '#3a3648' : '#b9b2c9';
  for (let x = PEN[0] - 12; x <= PEN[2] + 12; x += 40) { g.fillRect(x, PEN[1] - 22, 4, 10); g.fillRect(x, PEN[3] + 12, 4, 10); }
  // Cyberia: a speaker stack either side of the screen, a bar along the right
  g.fillStyle = '#07050a';
  g.fillRect(140, 70, 44, 90); g.fillRect(536, 70, 44, 90);
  g.fillStyle = '#1d1a22';
  for (const x of [162, 558]) for (const y of [92, 132]) { g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#2a1f33'; g.fillRect(600, 80, 30, 260);
  // the stall: a counter under a striped awning, with a scale on it
  const st = STALL;
  g.fillStyle = 'rgba(30,30,60,0.25)'; g.fillRect(st.x + 4, st.y + 44, st.w, 8);
  g.fillStyle = D ? '#5a4030' : '#b48a64'; g.fillRect(st.x, st.y + 14, st.w, 32);
  g.fillStyle = D ? '#7a5a44' : '#d4ab82'; g.fillRect(st.x, st.y + 14, st.w, 4);
  g.fillStyle = D ? '#3a3648' : '#9da3b6'; g.fillRect(st.x + 4, st.y - 26, 4, 40); g.fillRect(st.x + st.w - 8, st.y - 26, 4, 40);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? (D ? '#2a2733' : '#ffffff') : '#e8a33d'; g.fillRect(st.x - 4 + i * 18, st.y - 34, 18, 12); }
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? (D ? '#2a2733' : '#ffffff') : '#e8a33d'; g.beginPath(); g.arc(st.x + 5 + i * 18, st.y - 22, 9, 0, Math.PI); g.fill(); }
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(st.x + 30, st.y + 10, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c99a1a'; g.fillRect(st.x + 28, st.y + 8, 4, 4);
  g.fillStyle = D ? '#4a4460' : '#6d7389'; g.fillRect(st.x + 62, st.y + 2, 20, 12); g.fillRect(st.x + 70, st.y - 4, 4, 6);
  // the lost and found: a cardboard box, flaps open
  const bn = BIN;
  g.fillStyle = 'rgba(30,30,60,0.25)'; g.fillRect(bn.x + 4, bn.y + bn.h - 2, bn.w, 6);
  g.fillStyle = D ? '#6a5236' : '#c9a06a'; g.fillRect(bn.x, bn.y + 8, bn.w, bn.h - 8);
  g.fillStyle = D ? '#4a3a26' : '#a87f4c'; g.fillRect(bn.x, bn.y + 8, bn.w, 4);
  g.fillStyle = D ? '#7a6042' : '#dcb47e';
  g.beginPath(); g.moveTo(bn.x, bn.y + 8); g.lineTo(bn.x - 8, bn.y); g.lineTo(bn.x + 14, bn.y); g.lineTo(bn.x + 18, bn.y + 8); g.fill();
  g.beginPath(); g.moveTo(bn.x + bn.w, bn.y + 8); g.lineTo(bn.x + bn.w + 8, bn.y); g.lineTo(bn.x + bn.w - 14, bn.y); g.lineTo(bn.x + bn.w - 18, bn.y + 8); g.fill();
  g.fillStyle = '#ff8fb8'; g.fillRect(bn.x + 12, bn.y + 4, 6, 6);
  g.fillStyle = '#7fd1ff'; g.fillRect(bn.x + 26, bn.y + 2, 5, 8);
  // the mailbox: a red box on a post (the flag is drawn live)
  const mb = MAILBOX;
  g.fillStyle = 'rgba(30,30,60,0.25)'; g.fillRect(mb.x + 4, mb.y + mb.h - 3, mb.w - 4, 6);
  g.fillStyle = D ? '#3a3648' : '#8a8fa3'; g.fillRect(mb.x + 10, mb.y + 34, 6, mb.h - 34);
  g.fillStyle = D ? '#8a2a28' : '#d8443c';
  g.beginPath(); g.moveTo(mb.x, mb.y + 38); g.lineTo(mb.x, mb.y + 10); g.arc(mb.x + mb.w / 2, mb.y + 10, mb.w / 2, Math.PI, 0); g.lineTo(mb.x + mb.w, mb.y + 38); g.fill();
  g.fillStyle = D ? '#5c1c1b' : '#a8302a'; g.fillRect(mb.x, mb.y + 34, mb.w, 4);
  g.fillStyle = D ? '#1a1820' : '#3a2a2a'; g.fillRect(mb.x + 6, mb.y + 16, mb.w - 12, 3);
  g.fillStyle = D ? '#c9b07a' : '#ffe6a8'; g.font = wf(9, 'bold'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✉', mb.x + mb.w / 2, mb.y + 27);
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
  g.fillStyle = world.skyCol; g.fillRect(0, 0, world.canvas.width, world.canvas.height);
  g.setTransform(s, 0, 0, s, -cx * s, -cy * s);
  g.imageSmoothingEnabled = false;
  g.drawImage(world.bg, 0, 0);
  drawLive(g, clock);
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
  for (const t of things) t.ball ? drawBall(gt, t.ball, clock) : drawCat(gt, t.c, clock);
  drawTrees(gt, me);
  drawWires(gt, clock);
  drawLights(gt, clock, cx, cy, vw, vh);
  drawSigns(gt, clock);
  drawToys(gt, clock);
  drawPrompt(gt, clock);
  for (const c of world.cats.values()) if (c.bubble && Date.now() < c.bubble.until) drawBubble(gt, c.bubble, Math.round(c.x), Math.round(c.y) - 58, cx, vw);
  drawSplashes(gt, clock);

  gt.setTransform(1, 0, 0, 1, 0, 0);
  post(gt, now);
  if (world.tvEl) placeTv(cx, cy);
}

// the monitors, the screen, the dance floor, the well, the capsule machine
function drawLive(g, t) {
  // the mailbox flag goes up when there is something new for me
  const mb = MAILBOX, up = world.unread > 0;
  g.fillStyle = world.dark ? '#4a4460' : '#6d7389'; g.fillRect(mb.x + mb.w, mb.y - 6, 2, 36);
  g.fillStyle = up ? '#ffd34d' : (world.dark ? '#6a5236' : '#e8a33d');
  if (up) g.fillRect(mb.x + mb.w + 2, mb.y - 6 + Math.round(Math.sin(t * 4)), 10, 7);
  else g.fillRect(mb.x + mb.w + 2, mb.y + 20, 4, 10);
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
  const hop = (dancing && !c.moving ? Math.round(Math.abs(Math.sin((t - c.emote.at) * 8)) * 6) : 0) + (c.sk ? 7 : 0);
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
  if (c.sk) drawBoard(g, x, y, dir, c.moving, t + c.t0);
  if (c.w?.back === 'wings') drawWings(g, x, y - hop, t + c.t0, c.moving);
  if (c.w?.back && c.w.back !== 'wings' && dir !== 'up') drawBack(g, c.w.back, x, y - hop, dir, flip, t + c.t0, c.moving);
  if (c.w?.hold === 'balloon') drawBalloon(g, x, y - hop, t + c.t0);
  if (c.w?.hold === 'umbrella') drawUmbrella(g, x, y - hop, t + c.t0);
  g.save();
  g.translate(x, y - hop);
  if (flip) g.scale(-1, 1);
  g.drawImage(sheet, sx, sy, 48, 48, -24, -46, 48, 48);
  g.restore();
  if (c.w?.back && c.w.back !== 'wings' && dir === 'up') drawBack(g, c.w.back, x, y - hop, dir, flip, t + c.t0, c.moving);
  if (c.w?.back && dir === 'down') drawStraps(g, c.w.back, x, y - hop);
  if (c.w?.hat) drawHat(g, c.w.hat, x, y - hop - 38, dir, t, flip);
  if (c.w?.hold && c.w.hold !== 'balloon' && c.w.hold !== 'umbrella') drawHold(g, c.w.hold, x, y - hop, flip, t);
  label(g, c, x, y);
  if (c.splat && t - c.splat < 1.5) { const a = t - c.splat; for (let i = 0; i < 4; i++) cloudPuff(g, x - 9 + i * 6, y - 30 - hop + Math.sin(i * 2) * 5, 5, 1 - a / 1.5); }
  g.globalAlpha = 1;
  if (em) {
    const age = t - c.emote.at;
    g.globalAlpha = Math.min(1, (4 - age) * 2);
    g.font = wf(18); g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(EMOTE_ICON[em] || '', x + (em === 'sleep' ? 14 : 0), y - 50 - hop - Math.min(10, age * 12));
    g.globalAlpha = 1;
  }
}

function drawBoard(g, x, y, dir, moving, t) {
  const side = dir === 'side', w = side ? 38 : 14, h = side ? 6 : 30, by = y - 4 - (side ? 0 : 10);
  g.fillStyle = '#2a2433';
  for (const [ox, oy] of side ? [[-13, 4], [13, 4]] : [[-8, -10], [8, -10], [-8, 10], [8, 10]]) { g.beginPath(); g.arc(x + ox, by + oy, 3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ff3d6e'; roundRect(g, x - w / 2, by - h / 2, w, h, 3); g.fill();
  g.fillStyle = '#ffd34d'; g.fillRect(x - w / 2 + 3, by - h / 2 + 1, w - 6, 2);
  if (moving && Math.sin(t * 20) > 0.3) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - w / 2 - 6, by + 3, 4, 1); }
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
const TRAILS = { t_feathers: [5, 2.2], t_notes: [4, 1.6], t_bubbles: [6, 1.6], t_sparks: [18, 0.9] };
const trailOf = c => TRAILS[c.w?.trail] || [14, 1.2];

// text keeps at least its size on screen when the world is drawn small (phones)
const wf = (px, weight = '') => `${weight} ${Math.round(px / Math.min(1, world.z))}px "Pixelify Sans", ui-monospace, Menlo, monospace`;

function label(g, c, x, y) {
  g.font = wf(10);
  g.textAlign = 'center'; g.textBaseline = 'top';
  const name = (c.d || c.u).slice(0, 18) + (c.u === world.me ? ' (you)' : '');
  const m = g.measureText(name), w = m.width + 8, h = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent + 3;
  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.fillRect(x - w / 2, y + 5, w, h);
  g.fillStyle = c.ghost ? '#8a86a0' : `hsl(${nameHue(c.d || c.u)} 60% 38%)`;
  g.fillText(name, x, y + 7);
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
  if (world.dark) return drawNight(g, t);
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

// at night the poles carry street lamps, and the well glows
function drawNight(g, t) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [i, [x, y]] of POLES.entries()) {
    const f = Math.sin(t * 13 + i * 5) > 0.97 ? 0.4 : 1;
    const gr = g.createRadialGradient(x, y + 4, 0, x, y + 4, 120);
    gr.addColorStop(0, `rgba(255,214,140,${0.22 * f})`); gr.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = gr; g.fillRect(x - 120, y - 116, 240, 240);
    g.fillStyle = `rgba(255,236,190,${0.9 * f})`; g.fillRect(x - 5, y - 152, 10, 4);
  }
  const wl = g.createRadialGradient(WELL.x, WELL.y, 0, WELL.x, WELL.y, 90);
  wl.addColorStop(0, `rgba(120,170,255,${0.25 + Math.sin(t * 1.3) * 0.06})`); wl.addColorStop(1, 'rgba(120,170,255,0)');
  g.fillStyle = wl; g.fillRect(WELL.x - 90, WELL.y - 90, 180, 180);
  const gr = g.createRadialGradient(360, 260, 0, 360, 260, 260);
  gr.addColorStop(0, 'rgba(255,61,110,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
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
    // loud on the dance floor, gone by the middle of the plaza
    const d = Math.hypot(me.x - (CLUB_SCREEN.x + CLUB_SCREEN.w / 2), me.y - 260);
    const vol = world.zone?.id === 'club' ? 70 : Math.round(Math.max(0, Math.min(1, 1 - (d - 286) / 462)) * 42);
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
      : `<button type="button" data-buy="${it.id}" ${world.coins < it.price ? 'disabled' : ''}>★ ${it.price}</button>`;
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
  else if (c.w.back) drawBack(g, c.w.back, 32, 58, 'side', true, 0, c.w.back === 'jetpack');
  if (c.w.hold === 'balloon') drawBalloon(g, 26, 62, 0);
  if (c.w.hold === 'umbrella') { g.save(); g.translate(32, 58); g.scale(0.8, 0.8); drawUmbrella(g, 0, 0, 0); g.restore(); }
  g.drawImage(sheet, 48, 0, 48, 48, 8, 12, 48, 48);
  if (c.w.hat) drawHat(g, c.w.hat, 32, 20, 'down', 0);
  if (c.w.hold && c.w.hold !== 'balloon' && c.w.hold !== 'umbrella') drawHold(g, c.w.hold, 32, 58, false);
  if (c.w.trail) {
    const col = { t_hearts: '#ff5a78', t_feathers: '#b9b5d2', t_bubbles: '#9fd4ff', t_notes: '#a58cf5', t_sparks: '#ffd34d' }[c.w.trail] || '#6b6680';
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
const CAP_COL = ['#ffd34d', '#7fd1ff', '#ff8fb8', '#a9f0b0', '#c7a6ff'];
function capsuleResult(d) {
  const btn = document.getElementById('w-cap-turn');
  btn.disabled = false;
  if (d.capsule === 'poor') { cap.t0 = 0; return worldToast('The capsule machine takes 30 stars.'); }
  if (d.capsule === 'all') { cap.t0 = 0; return worldToast('You have everything the capsule machine has. More soon.'); }
  cap.res = { col: CAP_COL[(d.capsule.length + d.capsule.charCodeAt(0)) % CAP_COL.length] };
  // the prize shows once the capsule has popped open
  const wait = Math.max(0, (cap.t0 + 1.75) * 1000 - performance.now());
  setTimeout(() => {
    const got = document.getElementById('w-cap-got');
    got.classList.remove('hidden');
    got.querySelector('span').innerHTML = `<b>${esc(d.capsule_name)}</b>You are wearing it now.`;
    const slot = world.catalog?.find(i => i.id === d.capsule)?.slot || 'hat';
    previewCat(got.querySelector('canvas'), { [slot]: d.capsule });
  }, wait);
}

// ── the well ─────────────────────────────────────────────────────────────────
function makeWish() {
  if (world.coins != null && world.coins < 1) return worldToast('The well takes a star. Come back with one.');
  worldSend({ wish: 1 }, true);
}
function wishResult(r) {
  if (r === 'poor') return worldToast('The well takes a star. Come back with one.');
  if (r !== 'ok') return;
  const t = performance.now() / 1000;
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
    nohave: 'One of you does not have that beetle any more.', gone: 'That offer is gone.', many: 'You have three offers open already.', bad: 'Pick a beetle first.' }[r];
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
const TOYS = { toss: 'Tap where to throw the cloudball', fw: 'Tap the sky for a firework (★ 2)', confetti: 'Tap where the confetti goes', bubbles: 'Tap where to blow bubbles' };
const TOY_NAME = { toss: '☁ Cloudball', fw: '🎆 Firework', confetti: '🎉 Confetti', bubbles: '🫧 Bubbles' };
function setAim(k) {
  world.aim = world.aim === k ? null : k;
  worldNote(world.aim ? TOYS[world.aim] : '');
  showHeld();
}
function setSkate(on) {
  world.skate = on;
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
    (world.skate ? '<button type="button" data-drop="skate" title="Get off the board">🛹 Get off <b>✕</b></button>' : '');
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
  } else if (world.aim === 'confetti' || world.aim === 'bubbles') {
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
  world.fishing = { t0: now, bite: now + 2.5 + Math.random() * 3, x: POND.x + (Math.random() - 0.5) * 60, y: POND.y + (Math.random() - 0.5) * 20 };
  worldToast('Wait for it to bite, then tap again.', 2500);
}
function fishCheck(me, t) {
  const f = world.fishing;
  if (!f) return;
  if (!me || Math.hypot(me.x - POND.x, me.y - POND.y) > 150) { world.fishing = null; return; }
  if (!f.told && t >= f.bite) { f.told = true; sfx('click'); world.splashes.push({ x: f.x, y: f.y - 14, t, text: '!', col: '#c23a4a' }); }
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
  for (let i = 0; i < 3; i++) { const r = (t * 8 + i * 12) % 36; g.globalAlpha = 1 - r / 36; g.beginPath(); g.ellipse(POND.x - 20 + i * 18, POND.y + (i - 1) * 4, r, r / 3, 0, 0, Math.PI * 2); g.stroke(); }
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

// ── things you find: names and pictures for beetles, fish, junk and trinkets ─
const pretty = k => k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
function itemName(k) {
  const [t, id] = [k.slice(0, 1), k.slice(2)];
  if (t === 'f') return BAG.d?.fishnames?.[id] || pretty(id);
  return (typeof NAMES !== 'undefined' && NAMES[id]) || pretty(id);
}
const aName = n => `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}`;
function itemIcon(k) {
  const [t, id] = [k.slice(0, 1), k.slice(2)];
  if (t === 'f') return `<i class="w-fish">${FISH_ICON[id] || '🐟'}</i>`;
  const src = t === 'b' ? `icons/beetles/${id}.png` : typeof IMAGES !== 'undefined' && IMAGES[id];
  return src ? `<img src="${esc(src)}" alt="">` : '<i class="w-fish">?</i>';
}

// the lost and found box: once every while there is something in it
function dig() {
  const me = world.cats.get(world.me);
  if (!me) return;
  worldSend({ dig: 1 }, true);
}
function digResult(d) {
  if (d.dig === 'far') return;
  if (d.dig === 'wait') return worldToast(`Nothing new in the box yet. Come back in ${Math.ceil(d.dig_in / 60)} min.`);
  worldToast(`You found ${aName(itemName(d.dig))} in the box. It is in your bag.`, 4000);
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
window.renderBag = d => { if (d) { BAG.d = d; world.owned = d.owned || world.owned; } drawBag(BAG.d); window.cardInv?.(); };
const bugRar = k => { const r = BUG_TIER[BUG_KINDS.findIndex(ks => ks.includes(k))]; return `<small style="color:${RARITY_HEX[r]}">${esc(RARITY_NAMES[r] || '')}</small>`; };
const nearStall = () => { const me = world.cats.get(world.me); return me && Math.hypot(me.x - STALL.at.x, me.y - STALL.at.y) < 120; };
function drawBag(d) {
  const box = document.getElementById('w-bag-list');
  if (!box || document.getElementById('w-bag').classList.contains('hidden')) return;
  document.querySelectorAll('#w-bag [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === BAG.tab));
  if (!d) { box.innerHTML = '<p class="w-dim">Opening your bag…</p>'; return; }
  if (BAG.tab === 'wear') {
    const items = (world.catalog || []).filter(it => world.owned.includes(it.id));
    box.innerHTML = items.length ? `<div class="w-items">${items.map(it => {
      const on = world.wear[it.slot] === it.id;
      return `<div class="w-item${on ? ' on' : ''}"><canvas width="64" height="64" data-prev="${esc(it.id)}" data-slot="${esc(it.slot)}"></canvas><span>${esc(it.name)}</span>
        ${on ? `<button type="button" data-off="${esc(it.slot)}">Take off</button>` : `<button type="button" data-wear="${esc(it.id)}" data-slot="${esc(it.slot)}">Wear</button>`}</div>`;
    }).join('')}</div>` : '<p class="w-dim">Nothing yet. The terminal in the shop and the capsule machine have things to wear.</p>';
    box.querySelectorAll('canvas[data-prev]').forEach(cv => previewCat(cv, { [cv.dataset.slot]: cv.dataset.prev }));
  } else if (BAG.tab === 'things') {
    const near = nearStall(), keys = Object.keys(d.have).filter(k => d.have[k] > 0);
    const order = { b: 0, f: 1, t: 2, j: 3 };
    keys.sort((a, b) => order[a[0]] - order[b[0]] || itemName(a).localeCompare(itemName(b)));
    const all = [['b', 'beetles'], ['f', 'fish'], ['j', 'junk']].filter(([t]) => keys.some(k => k[0] === t));
    box.innerHTML = keys.length ? `<div class="w-items">${keys.map(k => `<div class="w-item">${itemIcon(k)}<span>${esc(itemName(k))}</span><b>× ${d.have[k]}</b>
      ${near ? `<button type="button" data-sell="${esc(k)}">Sell ★ ${(d.prices[k] || 0) * d.have[k]}</button>` : `<small class="w-dim">★ ${d.prices[k] || 0} each</small>`}</div>`).join('')}</div>
      ${near && all.length ? `<div class="w-row w-end">${all.map(([t, n]) => `<button type="button" data-sellall="${t}">Sell all ${n}</button>`).join('')}</div>` : ''}
      ${near ? '' : '<p class="w-dim">The stall east of the well buys all of it.</p>'}`
      : '<p class="w-dim">Nothing yet. Catch beetles in the park and the garden, fish at the pond, look in the lost and found box.</p>';
  } else if (BAG.tab === 'bugs') {
    const seen = new Set(d.seen), all = BUG_KINDS.flat(), got = all.filter(k => seen.has('b:' + k)).length;
    box.innerHTML = `<div class="w-items">${all.map(k => seen.has('b:' + k)
      ? `<div class="w-item"><img src="${esc(`icons/beetles/${k}.png`)}" alt=""><span>${esc(itemName('b:' + k))}</span>${bugRar(k)}${d.have['b:' + k] ? `<b>× ${d.have['b:' + k]}</b>` : ''}</div>`
      : `<div class="w-item locked"><img src="${esc(`icons/beetles/${k}.png`)}" alt=""><span>???</span>${bugRar(k)}</div>`).join('')}</div>
      <p class="w-dim">${got} of ${all.length} found. Beetles fly around the park and the garden. Tap one to catch it.</p>`;
  } else {
    const ids = Object.keys(d.fishnames);
    const got = ids.filter(id => d.fish[id]).length;
    box.innerHTML = `<div class="w-items">${ids.map(id => d.fish[id]
      ? `<div class="w-item"><i class="w-fish">${FISH_ICON[id] || '🐟'}</i><span>${esc(d.fishnames[id])}</span><b>× ${d.fish[id]}</b></div>`
      : `<div class="w-item locked"><i class="w-fish">?</i><span>???</span></div>`).join('')}</div>
      <p class="w-dim">${got} of ${ids.length} found. The pond is west of the well.</p>`;
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
  // the machine
  const mx = W / 2;
  g.fillStyle = '#e14d9c'; roundRect(g, mx - 56, 110, 112, 92, 10); g.fill();
  g.fillStyle = '#b8347b'; g.fillRect(mx - 56, 190, 112, 12);
  g.fillStyle = 'rgba(220,235,255,0.85)'; g.beginPath(); g.arc(mx, 74, 54, Math.PI, 0); g.fill(); g.fillRect(mx - 54, 74, 108, 40);
  const balls = [['#ffd34d', -30, 90], ['#7fd1ff', -8, 70], ['#ff8fb8', 22, 92], ['#a9f0b0', 4, 98], ['#c7a6ff', 30, 64], ['#ffd34d', -24, 58], ['#ff8fb8', 8, 44]];
  const shake = a >= 0 && a < 0.9 ? Math.sin(a * 40) * 2 : 0;
  balls.forEach(([c, ox, oy], i) => { g.fillStyle = c; g.beginPath(); g.arc(mx + ox + shake * (i % 2 ? 1 : -1), oy + Math.sin(t * 2 + i) * 0.8, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(mx + ox - 5, oy - 6, 3, 3); });
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(mx - 40, 40, 6, 24);
  // the handle
  g.save(); g.translate(mx - 18, 146); g.rotate(a >= 0 ? Math.min(1, a / 0.8) * Math.PI * 2 : 0);
  g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9da3b6'; g.fillRect(-12, -3, 24, 6);
  g.restore();
  g.fillStyle = '#2a1f33'; roundRect(g, mx + 8, 160, 34, 26, 4); g.fill();
  // the capsule falls out, wobbles until we know what is inside, then opens
  const col = cap.res?.col || '#ffd34d';
  if (a >= 0.8) {
    const b = a - 0.8, ready = cap.res && b > 0.9;
    const y = Math.min(232, 186 + b * b * 400);
    if (!ready || !cap.open) {
      if (ready && !cap.open) { cap.open = t; sfx('claim'); }
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
  cap.t0 = performance.now() / 1000; cap.res = null; cap.open = 0;
  document.getElementById('w-cap-got').classList.add('hidden');
  sfx('click');
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
  if (down && key === 'Escape') { closePanels(); return; }
  const k = W_KEYS[key];
  if (!k) return;
  e.preventDefault();
  if (down) world.keys.add(k); else world.keys.delete(k);
}
function closePanels() {
  for (const id of ['w-shop', 'w-screen', 'w-capsule', 'w-emotes', 'w-toys', 'w-bag', 'w-card', 'w-quests']) document.getElementById(id)?.classList.add('hidden');
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
    world.active = Date.now();
    const me = world.cats.get(world.me);
    if (me) me.emote = { k, at: performance.now() / 1000 };
    worldSend({ emote: k }, true);
    document.getElementById('w-emotes').classList.add('hidden');
  });
  document.getElementById('w-toy-btn').addEventListener('click', () => document.getElementById('w-toys').classList.toggle('hidden'));
  document.getElementById('w-toys').addEventListener('click', e => {
    const k = e.target.closest('[data-toy]')?.dataset.toy;
    if (!k) return;
    document.getElementById('w-toys').classList.add('hidden');
    if (k === 'fish') { const s = SPOTS.find(x => x.id === 'pond'); world.pending = s; world.target = { ...s.at }; return; }
    if (k === 'skate') return setSkate(!world.skate);
    setAim(k);
  });
  document.getElementById('w-held').addEventListener('click', e => {
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
