// BeetleBoy SP · The new places in the world (world.html, after world.js):
// the Jade Arches kitchen, the farm, the church with the Bible, the library,
// the goals on the pitch and the skate park. world.js calls the window hooks
// at the bottom; world.php keeps the stars, the farm plots and what you cooked with.

// ── the kitchen: buy, chop, grill, fry, put a plate together, serve an order ─
// as PANTRY, DISHES and orderAt() in world.php
const PANTRY = { patty: 3, bun: 2, cheese: 2, lettuce: 2, tomato: 2, potato: 2 };
const DISHES = {
  burger: [['bun', 'patty'], 6], cheeseburger: [['bun', 'patty', 'cheese'], 9],
  deluxe: [['bun', 'patty', 'cheese', 'lettuce', 'tomato'], 14], fries: [['potato'], 3], salad: [['lettuce', 'tomato'], 5],
};
const DISH_NAME = { burger: 'Burger', cheeseburger: 'Cheeseburger', deluxe: 'Jade Deluxe', fries: 'Fries', salad: 'Salad' };
const DISH_ICON = { burger: '🍔', cheeseburger: '🍔🧀', deluxe: '🍔🥬🍅', fries: '🍟', salad: '🥗' };
const FOOD_ICON = { patty: '🥩', bun: '🍞', cheese: '🧀', lettuce: '🥬', tomato: '🍅', potato: '🥔', fries: '🍟' };
const ORDER_LEN = 75, ORDER_N = 3;
function orderAt(i, t) {
  const g = Math.floor((t + i * 25) / ORDER_LEN), k = Object.keys(DISHES);
  return { id: `${i}:${g}`, d: k[Math.floor(hrand(g * 17 + i * 5) * k.length)], end: (g + 1) * ORDER_LEN - i * 25 };
}
// what each station does to what you put on it: seconds until done, and until burnt
const COOK = { board: { lettuce: [2.5], tomato: [2.5], potato: [2.5] }, grill: { patty: [6, 15] }, fryer: { potato: [5, 16] } };
const KIT = {
  kit: {}, hand: null, served: new Set(), next: 0,
  st: { board: null, grill: null, fryer: null, plate: [] },
};
// a plate takes one of each: the bun, cheese, a cooked patty, chopped greens, fries
const plateOk = it => it.k === 'bun' || it.k === 'cheese' || (it.k === 'patty' && it.st === 'done')
  || ((it.k === 'lettuce' || it.k === 'tomato') && it.st === 'cut') || (it.k === 'potato' && it.st === 'fried');
const partOf = it => it.k === 'potato' && it.st === 'fried' ? 'fries' : it.k;
const raw = items => items.map(it => it.k);
function inPlay(k) {
  const all = [KIT.hand, KIT.st.board, KIT.st.grill, KIT.st.fryer, ...KIT.st.plate, ...(KIT.hand?.plate || [])].filter(Boolean);
  return all.filter(it => it.k === k).length;
}
const fridge = k => Math.max(0, (KIT.kit[k] || 0) - inPlay(k));
function dishOf(plate) {
  const have = raw(plate).sort().join();
  return Object.keys(DISHES).find(d => [...DISHES[d][0]].sort().join() === have) || null;
}
const foodIcon = it => it.plate ? (it.plate.length ? it.plate.map(p => FOOD_ICON[partOf(p)]).join('') : '🍽') : FOOD_ICON[partOf(it)];
const handText = () => {
  const h = KIT.hand;
  if (!h) return '';
  if (h.plate) { const d = dishOf(h.plate); return d ? `${DISH_NAME[d]} on a plate` : 'A plate'; }
  return `${{ cut: 'Chopped ', done: 'Cooked ', burnt: 'Burnt ', fried: '' }[h.st] || ''}${h.st === 'fried' ? 'Fries' : itemName('c:' + h.k)}`;
};
// a station: what it holds, how far along it is, and whether it burnt
function cookState(name, now) {
  const it = KIT.st[name];
  if (!it || !it.t0) return null;
  const [done, burn] = COOK[name][it.k];
  const a = it.t0 ? now - it.t0 + (it.acc || 0) : it.acc || 0;
  return { it, a, done, burn };
}
function stationTick(now, me) {
  // chopping only goes on while you stand at the board, like the real thing
  const b = KIT.st.board;
  if (b && b.st === 'raw') {
    const at = STATION.board.at, here = me && Math.hypot(me.x - at.x, me.y - at.y) < 34;
    b.acc = (b.acc || 0) + (here ? now - (b.last || now) : 0); b.last = now;
    if (b.acc >= COOK.board[b.k][0]) { b.st = 'cut'; sfx('click'); }
  }
  for (const name of ['grill', 'fryer']) {
    const it = KIT.st[name];
    if (!it) continue;
    const [done, burn] = COOK[name][it.k], a = now - it.t0;
    const st = a >= burn ? 'burnt' : a >= done ? (name === 'fryer' ? 'fried' : 'done') : 'raw';
    if (st !== it.st) { it.st = st; if (st === 'burnt') worldToast(name === 'grill' ? 'The patty burnt! Into the bin with it.' : 'The fries burnt!'); else sfx('click'); }
  }
}
function useStation(name) {
  const now = performance.now() / 1000, h = KIT.hand;
  const s = KIT.st;
  if (name === 'pantry') { if (h) return worldToast('Your paws are full. Put that down first.'); return openPantry(); }
  if (name === 'bin') {
    if (!h) return worldToast('Nothing in your paws to throw away.');
    const gone = h.plate ? raw(h.plate) : [h.k];
    if (gone.length) worldSend({ ktrash: gone }, true);
    KIT.hand = null; sfx('click'); return;
  }
  if (name === 'serve') {
    if (!h?.plate) return worldToast('Bring a plate with a dish on it. The tickets show what people want.');
    const d = dishOf(h.plate), t = netNow();
    if (!d) return worldToast('That is not on the menu. Look at the tickets.');
    const o = [...Array(ORDER_N).keys()].map(i => orderAt(i, t)).find(o => o.d === d && !KIT.served.has(o.id));
    if (!o) return worldToast(`Nobody is waiting for ${aName(DISH_NAME[d])} right now.`);
    worldSend({ serve: { o: o.id, d } }, true);
    return;
  }
  if (name === 'plate') {
    if (!h) { if (s.plate.length) { KIT.hand = { plate: s.plate }; s.plate = []; } else worldToast('Put things on the plate, then pick it up.'); return; }
    if (h.plate) { if (s.plate.length) return worldToast('There is a plate here already.'); s.plate = h.plate; KIT.hand = null; return; }
    if (h.st === 'burnt') return worldToast('Burnt things go in the bin.');
    if (!plateOk(h)) return worldToast(h.k === 'patty' ? 'Grill the patty first.' : h.k === 'potato' ? 'Chop the potato and fry it first.' : 'Chop it first.');
    if (s.plate.some(p => partOf(p) === partOf(h))) return worldToast('The plate has one of those already.');
    s.plate.push(h); KIT.hand = null; sfx('click'); return;
  }
  // the board, the grill and the fryer: put something on, or take it off
  const it = s[name];
  if (it) {
    if (h) return worldToast('Your paws are full.');
    if (name === 'board' && it.st === 'raw') return worldToast('Stay at the board while it chops.');
    KIT.hand = { k: it.k, st: it.st }; s[name] = null; return;
  }
  if (!h || h.plate) return worldToast(name === 'board' ? 'Bring lettuce, a tomato or a potato to chop.' : name === 'grill' ? 'Bring a patty from the fridge.' : 'Bring a chopped potato.');
  const ok = name === 'board' ? h.st === 'raw' && COOK.board[h.k] : name === 'grill' ? h.k === 'patty' && h.st === 'raw' : h.k === 'potato' && h.st === 'cut';
  if (!ok) return worldToast(name === 'board' ? 'That does not need chopping.' : name === 'grill' ? 'Only raw patties go on the grill.' : 'Only chopped potatoes go in the fryer.');
  s[name] = { k: h.k, st: h.st, t0: now, last: now, acc: 0 }; KIT.hand = null; sfx('click');
}
function openPantry() {
  closePanels();
  document.getElementById('w-pantry').classList.remove('hidden');
  drawPantry();
}
function drawPantry() {
  const box = document.getElementById('w-pantry-list');
  box.innerHTML = Object.keys(PANTRY).map(k => {
    const n = fridge(k), crop = BAG.d?.have?.['c:' + k] || 0;
    return `<div class="w-item"><i class="w-fish">${FOOD_ICON[k]}</i><span>${esc(itemName('c:' + k))}</span>
      ${n ? `<button type="button" data-take="${k}">Take (${n} left)</button>` : `<button type="button" data-kbuy="${k}">${crop ? `From your bag (${crop})` : `★ ${PANTRY[k]}`}</button>`}</div>`;
  }).join('');
}
function kitchenResult(d) {
  if (d.kit) KIT.kit = { ...d.kit };
  if (Array.isArray(d.kbuy)) { KIT.hand = { k: d.kbuy[0], st: 'raw' }; document.getElementById('w-pantry').classList.add('hidden'); sfx('click'); }
  else if (d.kbuy === 'poor') worldToast('Not enough stars for that.');
  else if (d.kbuy === 'far') worldToast('Stand in the kitchen.');
  else if (d.kbuy === 'full') worldToast('The fridge is full. Cook with what is in there.');
  if (Array.isArray(d.serve)) {
    const [dish, pay] = d.serve;
    KIT.hand = null;
    worldToast(`${DISH_ICON[dish]} ${DISH_NAME[dish]} served: +★ ${pay}`);
    const me = world.cats.get(world.me);
    if (me) world.splashes.push({ x: me.x, y: me.y - 28, t: performance.now() / 1000, text: `+★ ${pay}`, col: '#2fae7a' });
    sfx('claim');
  } else if (d.serve === 'late') worldToast('Just missed it: that order is gone.');
  else if (d.serve === 'taken') worldToast('Someone else served that one first.');
  else if (d.serve === 'missing') { worldToast('Something on that plate did not come from the fridge.'); KIT.hand = null; }
  else if (d.serve === 'far') worldToast('Stand at the counter.');
  if (d.served) KIT.served = new Set(d.served);
}
// the tickets and what you carry, over the map while you are in the kitchen
function drawOrders(clock) {
  const el = document.getElementById('w-orders');
  const show = world.zone?.id === 'jade';
  el.classList.toggle('hidden', !show);
  if (!show || clock < KIT.next) return;
  KIT.next = clock + 0.25;
  const t = netNow();
  const tickets = [...Array(ORDER_N).keys()].map(i => orderAt(i, t)).sort((a, b) => a.end - b.end).map(o => {
    const left = Math.max(0, o.end - t), done = KIT.served.has(o.id);
    return `<div class="w-ticket${done ? ' done' : ''}"><b>${DISH_ICON[o.d]}</b><span>${esc(DISH_NAME[o.d])}</span><small>${done ? 'served' : `★ ${DISHES[o.d][1]}`}</small><i style="width:${(left / ORDER_LEN * 100).toFixed(1)}%"></i></div>`;
  }).join('');
  const h = handText();
  const html = tickets + (h ? `<div class="w-hand">${foodIcon(KIT.hand)} ${esc(h)}</div>` : '');
  if (el.innerHTML !== html) el.innerHTML = html;
}

// ── the farm: eight plots of your own (FARM, CROPS in world.php) ─────────────
const CROPS = { lettuce: [1, 120, 2], carrot: [1, 150, 2], tomato: [1, 180, 3], potato: [1, 240, 3], corn: [2, 300, 5], strawberry: [2, 420, 7], pumpkin: [3, 600, 9] };
const CROP_ICON = { lettuce: '🥬', carrot: '🥕', tomato: '🍅', potato: '🥔', corn: '🌽', strawberry: '🍓', pumpkin: '🎃' };
window.CROP_ICON = CROP_ICON;
const PLOTS = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ x: 1880 + (i % 4) * 120, y: 850 + Math.floor(i / 4) * 140, w: 100, h: 70 }));
const FARM = { plots: null, pick: -1, asked: 0 };
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function plotState(i) {
  const p = FARM.plots?.[i];
  if (!p) return null;
  const [c, at] = p, grow = CROPS[c]?.[1] || 60, a = netNow() - at;
  return { c, k: Math.min(1, a / grow), left: grow - a };
}
function plotText(i) {
  if (!FARM.plots) return '🌱 Your plot';
  const s = plotState(i);
  if (!s) return '🌱 Plant a seed';
  return s.k >= 1 ? `🧺 Harvest ${itemName('c:' + s.c).toLowerCase()}` : `${CROP_ICON[s.c]} ${mmss(s.left)}`;
}
function usePlot(i) {
  if (!FARM.plots) { FARM.want = i; worldSend({ farm: { look: 1 } }, true); return; }
  const s = plotState(i);
  if (!s) { FARM.pick = i; openSeeds(); return; }
  if (s.k >= 1) worldSend({ farm: { p: i, h: 1 } }, true);
  else worldToast(`${CROP_ICON[s.c]} ${itemName('c:' + s.c)} is still growing: ${mmss(s.left)} to go.`);
}
function openSeeds() {
  closePanels();
  document.getElementById('w-seeds').classList.remove('hidden');
  document.getElementById('w-seeds-list').innerHTML = Object.entries(CROPS).map(([c, [seed, grow, sells]]) =>
    `<div class="w-item"><i class="w-fish">${CROP_ICON[c]}</i><span>${esc(itemName('c:' + c))}</span><small class="w-dim">${Math.round(grow / 60)} min · sells ★ ${sells}</small>
    <button type="button" data-seed="${c}" ${world.coins < seed ? 'disabled' : ''}>Plant ★ ${seed}</button></div>`).join('');
}
function farmResult(d) {
  if (d.farm) { FARM.plots = d.farm; if (FARM.want != null) { const i = FARM.want; FARM.want = null; usePlot(i); } }
  if (d.farmerr) worldToast(d.farmerr);
  if (d.harvest) {
    worldToast(`${CROP_ICON[d.harvest]} ${itemName('c:' + d.harvest)} is in your bag. The stall buys it, and the Jade Arches pantry cooks with it.`, 4500);
    const me = world.cats.get(world.me);
    if (me) world.splashes.push({ x: me.x, y: me.y - 28, t: performance.now() / 1000, text: `+1 ${CROP_ICON[d.harvest]}`, col: '#c9a13b' });
    sfx('claim');
  }
}

// ── the church and the library: a reader for the Bible and the articles ─────
const READ = { bible: null, books: {}, lib: null, view: null };
const LS_READ = 'bb_world_bible';
const fetchJson = async url => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };
function openRead(title, back) {
  closePanels();
  document.getElementById('w-read').classList.remove('hidden');
  document.getElementById('w-read-title').textContent = title;
  const b = document.getElementById('w-read-back');
  b.classList.toggle('hidden', !back); b.onclick = back || null;
  const body = document.getElementById('w-read-body');
  body.scrollTop = 0;
  return body;
}
async function openBible() {
  let last = null; try { last = JSON.parse(localStorage.getItem(LS_READ) || 'null'); } catch {}
  if (last && READ.view !== 'books') return openChapter(last[0], last[1]);
  const body = openRead('The Bible');
  READ.view = 'books';
  if (!READ.bible) {
    body.innerHTML = '<p class="w-dim">Opening the Bible…</p>';
    try { READ.bible = await fetchJson('bible/index.json'); } catch { body.innerHTML = '<p class="w-dim">The Bible will not open right now. Try again in a moment.</p>'; return; }
  }
  const testament = (a, b) => READ.bible.slice(a, b).map(([n], i) => `<button type="button" data-book="${a + i}">${esc(n)}</button>`).join('');
  body.innerHTML = `<p class="w-dim">The King James Version, all sixty-six books.</p><h3>Old Testament</h3><div class="w-grid">${testament(0, 39)}</div>
    <h3>New Testament</h3><div class="w-grid">${testament(39, 66)}</div>`;
}
function openBook(b) {
  const [name, n] = READ.bible[b];
  const body = openRead(name, () => { READ.view = 'books'; openBible(); });
  READ.view = 'book';
  body.innerHTML = `<div class="w-grid w-nums">${Array.from({ length: n }, (_, i) => `<button type="button" data-ch="${b}:${i}">${i + 1}</button>`).join('')}</div>`;
}
async function openChapter(b, c) {
  if (!READ.bible) try { READ.bible = await fetchJson('bible/index.json'); } catch { return worldToast('The Bible will not open right now.'); }
  const [name, n] = READ.bible[b] || [];
  if (!name) { READ.view = 'books'; return openBible(); }
  const body = openRead(`${name} ${c + 1}`, () => openBook(b));
  READ.view = 'chapter';
  try { localStorage.setItem(LS_READ, JSON.stringify([b, c])); } catch {}
  if (!READ.books[b]) {
    body.innerHTML = '<p class="w-dim">Turning the pages…</p>';
    try { READ.books[b] = await fetchJson(`bible/${b}.json`); } catch { body.innerHTML = '<p class="w-dim">This book will not open right now.</p>'; return; }
  }
  const prev = c > 0 ? [b, c - 1] : b > 0 ? [b - 1, READ.bible[b - 1][1] - 1] : null;
  const next = c < n - 1 ? [b, c + 1] : b < READ.bible.length - 1 ? [b + 1, 0] : null;
  body.innerHTML = `<div class="w-read-text">${(READ.books[b][c] || []).map((v, i) => `<p><sup>${i + 1}</sup>${esc(v)}</p>`).join('')}</div>
    <div class="w-row w-end">${prev ? `<button type="button" data-ch="${prev.join(':')}">‹ ${esc(READ.bible[prev[0]][0])} ${prev[1] + 1}</button>` : ''}
    <button type="button" class="w-quiet" data-allbooks="1">All books</button>
    ${next ? `<button type="button" class="w-main" data-ch="${next.join(':')}">${esc(READ.bible[next[0]][0])} ${next[1] + 1} ›</button>` : ''}</div>`;
}
// the library: each author has a shelf of books, each book a handful of articles
const SHELVES = {
  charlemagne: { name: 'Charlemagne Fang', site: 'paragraph.com/@charlemagnefang' },
  peat: { name: 'Ray Peat', site: 'raypeat.com' },
};
function shelfBooks(id) {
  const all = READ.lib?.[id] || [];
  if (id === 'charlemagne') {
    const years = [...new Set(all.map(a => a.d.slice(0, 4) || 'Undated'))].sort();
    return years.map(y => ({ t: y, a: all.filter(a => (a.d.slice(0, 4) || 'Undated') === y).sort((a, b) => a.d.localeCompare(b.d)) }));
  }
  const sorted = [...all].sort((a, b) => a.t.localeCompare(b.t)), out = [];
  for (let i = 0; i < sorted.length; i += 12) {
    const part = sorted.slice(i, i + 12), f = s => s.t.trim()[0].toUpperCase();
    out.push({ t: `${f(part[0])} to ${f(part[part.length - 1])}`, a: part });
  }
  return out;
}
async function openShelf(id) {
  const sh = SHELVES[id], body = openRead(sh.name);
  if (!READ.lib) {
    body.innerHTML = '<p class="w-dim">Finding the books…</p>';
    try { READ.lib = await fetchJson('library.json'); } catch { body.innerHTML = '<p class="w-dim">The shelf is out of reach right now.</p>'; return; }
  }
  body.innerHTML = `<p class="w-dim">Articles by ${esc(sh.name)}, from ${esc(sh.site)}. Pick a book.</p>
    <div class="w-books">${shelfBooks(id).map((bk, i) => `<button type="button" data-lbook="${id}:${i}" style="--hue:${(i * 47 + (id === 'peat' ? 200 : 20)) % 360}"><b>${esc(bk.t)}</b><small>${bk.a.length} articles</small></button>`).join('')}</div>`;
}
function openLibBook(id, i) {
  const bk = shelfBooks(id)[i], sh = SHELVES[id];
  const body = openRead(`${sh.name} · ${bk.t}`, () => openShelf(id));
  body.innerHTML = `<div class="w-toc">${bk.a.map((a, j) => `<button type="button" data-art="${id}:${i}:${j}"><span>${esc(a.t)}</span>${a.d ? `<small>${esc(a.d)}</small>` : ''}</button>`).join('')}</div>`;
}
function openArticle(id, i, j) {
  const a = shelfBooks(id)[i].a[j], sh = SHELVES[id];
  const body = openRead(a.t, () => openLibBook(id, i));
  body.innerHTML = `<p class="w-dim">${esc(sh.name)}${a.d ? ` · ${esc(a.d)}` : ''}</p>
    <blockquote class="w-read-text">${esc(a.x)}</blockquote>
    <div class="w-row"><a class="w-main w-link" href="${esc(a.u)}" target="_blank" rel="noopener">Read the whole article ↗</a></div>`;
}

// ── the pitch and its goals ─────────────────────────────────────────────────
const SCORE = { s: null, n: null };
function scoreResult(d) {
  if (!Array.isArray(d.score)) return;
  const [l, r, n, by, fin] = d.score;
  if (SCORE.n != null && n > SCORE.n) {
    worldToast(fin ? `⚽ Goal${by ? ` by ${by}` : ''}! That is five: ${fin[0]} : ${fin[1]}, and a new game starts.` : `⚽ Goal${by ? ` by ${by}` : ''}! ${l} : ${r}`, 4000);
    sfx('claim');
  }
  SCORE.n = n; SCORE.s = [l, r];
}

// ── the skate park: kickers send you flying, the rail lets you grind ───────
const KICKERS = [{ x: 210, y: 1250, w: 44, h: 44 }, { x: 640, y: 1240, w: 44, h: 44 }, { x: 520, y: 1440, w: 44, h: 44 }];
const RAIL = { x: 250, y: 1460, w: 220, h: 4 };
const BOX = { x: 380, y: 1290, w: 140, h: 60 };
const inR = (p, r, m = 0) => p.x >= r.x - m && p.x <= r.x + r.w + m && p.y >= r.y - m && p.y <= r.y + r.h + m;

// ── the hooks world.js calls ────────────────────────────────────────────────
const STATION = {
  pantry: { r: { x: 1846, y: 58, w: 64, h: 44 }, icon: '🧊', text: () => KIT.hand ? 'Fridge' : '🧊 Fridge' },
  board: { r: { x: 1932, y: 62, w: 56, h: 36 }, text: () => KIT.st.board ? (KIT.st.board.st === 'raw' ? '🔪 Chopping…' : '✋ Take it') : '🔪 Chop' },
  grill: { r: { x: 2006, y: 62, w: 56, h: 36 }, text: () => KIT.st.grill ? `✋ Take the patty${KIT.st.grill.st === 'raw' ? ' (raw)' : ''}` : '🔥 Grill' },
  fryer: { r: { x: 2080, y: 62, w: 56, h: 36 }, text: () => KIT.st.fryer ? `✋ Take them${KIT.st.fryer.st === 'cut' ? ' (raw)' : ''}` : '🍟 Fry' },
  plate: { r: { x: 2154, y: 62, w: 56, h: 36 }, text: () => KIT.hand ? (KIT.hand.plate ? '🍽 Put the plate down' : '🍽 Put it on the plate') : KIT.st.plate.length ? '🍽 Pick up the plate' : '🍽 Plate' },
  bin: { r: { x: 2228, y: 66, w: 34, h: 32 }, text: () => '🗑 Throw away' },
  serve: { r: { x: 2368, y: 150, w: 36, h: 150 }, at: { x: 2340, y: 225 }, text: () => '🛎 Serve an order' },
};
for (const [id, s] of Object.entries(STATION)) {
  s.at ??= { x: s.r.x + s.r.w / 2, y: s.r.y + s.r.h + 18 };
  SPOTS.push({ id: 'k_' + id, r: s.r, at: s.at, near: 26, col: '#2fae7a', text: s.text, act: () => useStation(id) });
}
PLOTS.forEach((r, i) => SPOTS.push({ id: 'plot' + i, r, at: { x: r.x + r.w / 2, y: r.y + r.h + 14 }, near: 36, col: '#c9a13b', text: () => plotText(i), act: () => usePlot(i) }));
SPOTS.push(
  { id: 'bible', r: { x: 3386, y: 360, w: 28, h: 24 }, at: { x: 3400, y: 404 }, near: 34, col: '#b8962e', text: () => '📖 Read the Bible', act: () => openBible() },
  { id: 'shelf_c', r: { x: 2530, y: 58, w: 250, h: 46 }, at: { x: 2655, y: 128 }, near: 60, col: '#b07a42', text: () => '📚 Charlemagne Fang', act: () => openShelf('charlemagne') },
  { id: 'shelf_p', r: { x: 2820, y: 58, w: 250, h: 46 }, at: { x: 2945, y: 128 }, near: 60, col: '#b07a42', text: () => '📚 Ray Peat', act: () => openShelf('peat') },
);
const PEWS = [];
for (const y of [450, 500, 690, 740, 790, 840]) PEWS.push({ x: 3236, y, w: 124, h: 18 }, { x: 3440, y, w: 124, h: 18 });
const TABLES = [{ x: 1900, y: 250, w: 60, h: 40 }, { x: 2040, y: 300, w: 60, h: 40 }, { x: 2220, y: 250, w: 60, h: 40 }];
const DESKS = [{ x: 2600, y: 230, w: 110, h: 46 }, { x: 2890, y: 230, w: 110, h: 46 }];
const BARN = { x: 2720, y: 830, w: 220, h: 120 };

window.placeSolids = s => {
  for (const { r } of Object.values(STATION)) s.push([r.x, r.y, r.w, r.h, 'prop']);
  for (const r of [...TABLES, ...DESKS, ...PEWS, BARN]) s.push([r.x, r.y, r.w, r.h, 'prop']);
  s.push([2530, 58, 250, 46, 'prop'], [2820, 58, 250, 46, 'prop']);                  // the shelves
  s.push([3330, 272, 140, 40, 'prop'], [3386, 360, 28, 24, 'prop']);                 // the altar and the lectern
  s.push([2620, 1070, 70, 30, 'prop'], [2970, 1060, 90, 28, 'prop']);                // hay and the trough
};

window.placeFloors = (g, floor, grass, rnd, D) => {
  // the pitch: lines on the grass
  g.strokeStyle = D ? 'rgba(200,220,200,0.18)' : 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
  const [x0, y0, x1, y1] = PEN, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  g.beginPath(); g.moveTo(mx, y0); g.lineTo(mx, y1); g.stroke();
  g.beginPath(); g.arc(mx, my, 40, 0, Math.PI * 2); g.stroke();
  for (const [x, d] of [[x0, 1], [x1, -1]]) { g.strokeRect(Math.min(x, x + d * 60), GOAL[0] - 30, 60, GOAL[1] - GOAL[0] + 60); }
  // the skate park: smooth concrete with joints
  floor(z0('skate'), z => {
    g.fillStyle = D ? '#1a1922' : '#d9d8df'; g.fillRect(z.x, z.y, z.w, z.h);
    g.strokeStyle = D ? 'rgba(255,255,255,0.04)' : 'rgba(80,80,110,0.18)'; g.lineWidth = 1;
    for (let x = z.x; x < z.x + z.w; x += 80) { g.beginPath(); g.moveTo(x + 0.5, z.y); g.lineTo(x + 0.5, z.y + z.h); g.stroke(); }
    for (let y = z.y; y < z.y + z.h; y += 80) { g.beginPath(); g.moveTo(z.x, y + 0.5); g.lineTo(z.x + z.w, y + 0.5); g.stroke(); }
    // a bowl painted in the corner, and some paint
    g.fillStyle = D ? '#121119' : '#c6c4cf'; g.beginPath(); g.ellipse(780, 1440, 80, 60, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = D ? '#3a3648' : '#f2f2f6'; g.lineWidth = 3; g.stroke();
    for (let i = 0; i < 6; i++) { g.fillStyle = `hsla(${rnd(0, 360)},70%,60%,${D ? 0.12 : 0.25})`; g.beginPath(); g.ellipse(rnd(100, 860), rnd(1200, 1530), rnd(10, 26), rnd(6, 14), rnd(0, 3), 0, Math.PI * 2); g.fill(); }
  });
  // the farm: dark earth, tilled plots
  floor(z0('farm'), z => {
    grass(z, D ? '#10120b' : '#d8e4b8', 5000, 60);
    for (const p of PLOTS) {
      g.fillStyle = D ? '#1e150e' : '#8a6243'; roundRect(g, p.x, p.y, p.w, p.h, 6); g.fill();
      g.fillStyle = D ? '#2a1d13' : '#a47a55';
      for (let y = p.y + 8; y < p.y + p.h - 4; y += 14) g.fillRect(p.x + 6, y, p.w - 12, 4);
    }
    g.fillStyle = D ? 'rgba(160,140,100,0.12)' : 'rgba(200,170,120,0.55)';
    g.fillRect(2380, 796, 160, 360); g.fillRect(1850, 1100, 1220, 40);              // the path from the gate
  });
  // the Jade Arches: green and white tiles, the kitchen behind the counter
  floor(z0('jade'), z => {
    for (let y = z.y; y < z.y + z.h; y += 24) for (let x = z.x; x < z.x + z.w; x += 24) {
      g.fillStyle = ((x + y) / 24) % 2 ? (D ? '#0e1a14' : '#e9f6ef') : (D ? '#13261c' : '#b9e3cc'); g.fillRect(x, y, 24, 24);
    }
    g.fillStyle = D ? 'rgba(0,0,0,0.35)' : 'rgba(30,90,60,0.18)'; g.fillRect(z.x, z.y, 460, 140);
    g.fillStyle = D ? '#1b4a35' : '#2fae7a'; g.fillRect(z.x + 16, z.y + 138, 444, 4);  // the line you cook behind
  });
  // the library: wooden boards and a rug
  floor(z0('library'), z => {
    for (let y = z.y; y < z.y + z.h; y += 16) {
      g.fillStyle = (y / 16) % 2 ? (D ? '#1d150f' : '#d7b48a') : (D ? '#22180f' : '#cfa97c'); g.fillRect(z.x, y, z.w, 16);
      g.fillStyle = D ? 'rgba(0,0,0,0.3)' : 'rgba(120,80,40,0.25)';
      for (let x = z.x + ((y / 16) % 3) * 40; x < z.x + z.w; x += 120) g.fillRect(x, y, 2, 16);
    }
    g.fillStyle = D ? '#3a1a22' : '#a8384a'; roundRect(g, 2650, 170, 300, 160, 10); g.fill();
    g.strokeStyle = D ? '#6a4a30' : '#e8c070'; g.lineWidth = 3; roundRect(g, 2660, 180, 280, 140, 8); g.stroke();
  });
  // the church: stone, and a red carpet from the door to the altar
  floor(z0('church'), z => {
    for (let y = z.y; y < z.y + z.h; y += 32) for (let x = z.x; x < z.x + z.w; x += 32) {
      g.fillStyle = ((x + y) / 32) % 2 ? (D ? '#15141a' : '#ece6d4') : (D ? '#1b1a21' : '#ddd5bd'); g.fillRect(x, y, 32, 32);
    }
    g.fillStyle = D ? '#3a1218' : '#a8283a';
    g.fillRect(3380, 320, 40, 620); g.fillRect(3180, 570, 220, 60);
    g.fillStyle = D ? '#6a5a2a' : '#e8c070'; g.fillRect(3380, 320, 2, 620); g.fillRect(3418, 320, 2, 620);
  });
};

const box3 = (g, r, top, side, D) => {
  g.fillStyle = D ? 'rgba(0,0,0,0.5)' : 'rgba(40,50,90,0.22)'; g.fillRect(r.x, r.y + r.h, r.w, 6);
  g.fillStyle = side; g.fillRect(r.x, r.y + r.h - 8, r.w, 8);
  g.fillStyle = top; g.fillRect(r.x, r.y, r.w, r.h - 8);
};
const emo = (g, t, x, y, px) => { g.font = `${px}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y); };
window.placeProps = (g, D, rnd) => {
  // goals at both ends of the pitch: posts and a net
  for (const [x, d] of [[PEN[0], -1], [PEN[2], 1]]) {
    const nx = d < 0 ? x - 24 : x;
    g.fillStyle = D ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.35)'; g.fillRect(nx, GOAL[0], 24, GOAL[1] - GOAL[0]);
    g.strokeStyle = D ? 'rgba(220,220,240,0.25)' : 'rgba(120,130,160,0.6)'; g.lineWidth = 1;
    for (let y = GOAL[0]; y <= GOAL[1]; y += 8) { g.beginPath(); g.moveTo(nx, y + 0.5); g.lineTo(nx + 24, y + 0.5); g.stroke(); }
    for (let i = 0; i <= 24; i += 8) { g.beginPath(); g.moveTo(nx + i + 0.5, GOAL[0]); g.lineTo(nx + i + 0.5, GOAL[1]); g.stroke(); }
    g.fillStyle = D ? '#c9c6dc' : '#ffffff';
    g.fillRect(nx, GOAL[0] - 3, 24, 4); g.fillRect(nx, GOAL[1] - 1, 24, 4);
    g.fillRect(x - 2, GOAL[0] - 6, 4, 10); g.fillRect(x - 2, GOAL[1] - 4, 4, 10);
  }
  // the skate park: kickers, a fun box and a rail
  for (const k of KICKERS) {
    const grd = g.createLinearGradient(k.x, 0, k.x + k.w, 0);
    grd.addColorStop(0, D ? '#2a2733' : '#bdbcc8'); grd.addColorStop(1, D ? '#4a4660' : '#f4f4f8');
    g.fillStyle = 'rgba(40,40,70,0.2)'; g.fillRect(k.x + 4, k.y + k.h, k.w, 6);
    g.fillStyle = grd; g.fillRect(k.x, k.y, k.w, k.h);
    g.fillStyle = D ? '#ffd34d' : '#e8a33d'; g.fillRect(k.x + k.w - 4, k.y, 4, k.h);
  }
  g.fillStyle = 'rgba(40,40,70,0.2)'; g.fillRect(BOX.x + 4, BOX.y + BOX.h, BOX.w, 8);
  g.fillStyle = D ? '#34304a' : '#b9b6c8'; g.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
  g.fillStyle = D ? '#4a4660' : '#e4e3ec'; g.fillRect(BOX.x + 30, BOX.y + 6, BOX.w - 60, BOX.h - 12);
  g.fillStyle = 'rgba(40,40,70,0.25)'; g.fillRect(RAIL.x, RAIL.y + 8, RAIL.w, 3);
  g.fillStyle = D ? '#8a86a8' : '#5d606c'; g.fillRect(RAIL.x, RAIL.y, RAIL.w, RAIL.h);
  for (let x = RAIL.x + 10; x < RAIL.x + RAIL.w; x += 50) g.fillRect(x, RAIL.y, 3, 10);
  // the kitchen: the fridge, the board, the grill, the fryer, the plate, the bin, the counter
  const steel = D ? '#2a2c34' : '#d3d6de', steel2 = D ? '#1a1b20' : '#a9adb9';
  for (const [id, s] of Object.entries(STATION)) {
    const r = s.r;
    box3(g, r, id === 'pantry' ? (D ? '#2c3a44' : '#e8f2f8') : id === 'serve' ? (D ? '#1b4a35' : '#2fae7a') : steel, steel2, D);
    if (id === 'board') { g.fillStyle = D ? '#4a3420' : '#d9a86a'; g.fillRect(r.x + 8, r.y + 5, r.w - 16, r.h - 18); }
    if (id === 'grill') { g.fillStyle = '#1a1a1a'; g.fillRect(r.x + 6, r.y + 4, r.w - 12, r.h - 16); g.fillStyle = '#555'; for (let x = r.x + 10; x < r.x + r.w - 8; x += 6) g.fillRect(x, r.y + 4, 2, r.h - 16); }
    if (id === 'fryer') { g.fillStyle = '#3a2a10'; g.fillRect(r.x + 8, r.y + 4, r.w - 16, r.h - 16); g.fillStyle = '#d9a02a'; g.fillRect(r.x + 10, r.y + 6, r.w - 20, r.h - 20); }
    if (id === 'plate') { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(r.x + r.w / 2, r.y + 14, 16, 9, 0, 0, Math.PI * 2); g.fill(); }
    if (id === 'pantry') { g.fillStyle = steel2; g.fillRect(r.x + r.w / 2 - 1, r.y + 4, 2, r.h - 14); g.fillRect(r.x + r.w - 10, r.y + 10, 3, 10); }
    if (id === 'bin') { g.fillStyle = D ? '#1b1d22' : '#6d7389'; g.fillRect(r.x + 4, r.y + 2, r.w - 8, 6); }
  }
  for (const t of TABLES) {
    box3(g, t, D ? '#e8e2d0' : '#ffffff', D ? '#8a8270' : '#cfc8b4', D);
    g.fillStyle = D ? '#1b4a35' : '#2fae7a';
    for (const [sx, sy] of [[t.x - 14, t.y + 12], [t.x + t.w + 4, t.y + 12]]) { g.beginPath(); g.arc(sx + 5, sy + 6, 7, 0, Math.PI * 2); g.fill(); }
  }
  // two jade arches on the floor by the door
  g.strokeStyle = D ? 'rgba(47,174,122,0.35)' : 'rgba(47,174,122,0.8)'; g.lineWidth = 6;
  for (const ax of [2100, 2140]) { g.beginPath(); g.moveTo(ax - 20, 392); g.quadraticCurveTo(ax - 20, 340, ax, 340); g.quadraticCurveTo(ax + 20, 340, ax + 20, 392); g.stroke(); }
  g.lineWidth = 1;
  // the library: shelves full of books, desks with lamps
  for (const x of [2530, 2820]) {
    const r = { x, y: 58, w: 250, h: 46 };
    box3(g, r, D ? '#2a1a10' : '#7a4a26', D ? '#1a0f08' : '#5a341a', D);
    for (let row = 0; row < 2; row++) for (let bx = x + 6; bx < x + r.w - 8;) {
      const w = 5 + Math.floor(rnd(0, 5)), h = 12 + Math.floor(rnd(0, 5));
      g.fillStyle = `hsl(${Math.floor(rnd(0, 360))} ${D ? 30 : 50}% ${D ? 25 : 45}%)`; g.fillRect(bx, r.y + 4 + row * 18 + (16 - h), w, h);
      bx += w + 1;
    }
  }
  for (const d of DESKS) {
    box3(g, d, D ? '#3a2616' : '#9a6a3a', D ? '#24170c' : '#6a4422', D);
    g.fillStyle = D ? '#c9b07a' : '#f4ecd8'; g.fillRect(d.x + 20, d.y + 10, 24, 16); g.fillRect(d.x + 64, d.y + 12, 20, 14);
  }
  // the church: pews, the altar with a cross, the lectern, windows in the walls
  for (const p of PEWS) box3(g, p, D ? '#3a2616' : '#8a5a30', D ? '#24170c' : '#5a3a1c', D);
  box3(g, { x: 3330, y: 272, w: 140, h: 40 }, D ? '#d8d0b8' : '#ffffff', D ? '#8a8270' : '#d9cfae', D);
  g.fillStyle = D ? '#8a7a3a' : '#d4a531'; g.fillRect(3397, 262, 6, 30); g.fillRect(3388, 270, 24, 5);
  box3(g, { x: 3386, y: 360, w: 28, h: 24 }, D ? '#5a3a1c' : '#9a6a3a', D ? '#3a2410' : '#6a4422', D);
  g.fillStyle = D ? '#c9b07a' : '#f4ecd8'; g.fillRect(3390, 362, 9, 10); g.fillRect(3401, 362, 9, 10);
  const glass = ['#e8404a', '#4a7ae8', '#e8c040', '#40b870', '#a858d8'];
  for (const [wx, wy] of [[3604, 320], [3604, 470], [3604, 720], [3604, 860], [3180, 320], [3180, 440], [3180, 760], [3180, 860]]) {
    for (let i = 0; i < 4; i++) { g.fillStyle = D ? glass[(wy / 10 + i) % 5] + '66' : glass[(wy / 10 + i) % 5]; g.fillRect(wx + 3, wy + i * 14, 10, 13); }
  }
  for (let i = 0; i < 3; i++) { g.fillStyle = D ? glass[i + 1] + '66' : glass[i + 1]; g.fillRect(3360 + i * 30, 243, 26, 10); }
  // the farm: a barn, hay, a trough, a scarecrow
  const bn = BARN;
  box3(g, bn, D ? '#4a1a18' : '#b8403a', D ? '#2a0e0c' : '#7a2420', D);
  g.fillStyle = D ? '#2a2a2a' : '#5a5a5a'; g.beginPath(); g.moveTo(bn.x - 10, bn.y + 20); g.lineTo(bn.x + bn.w / 2, bn.y - 30); g.lineTo(bn.x + bn.w + 10, bn.y + 20); g.fill();
  g.fillStyle = D ? '#c9c6dc' : '#ffffff'; g.fillRect(bn.x + 80, bn.y + 50, 60, 62);
  g.fillStyle = D ? '#4a1a18' : '#b8403a'; g.fillRect(bn.x + 84, bn.y + 54, 52, 58);
  g.strokeStyle = D ? '#c9c6dc' : '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(bn.x + 84, bn.y + 54); g.lineTo(bn.x + 136, bn.y + 112); g.moveTo(bn.x + 136, bn.y + 54); g.lineTo(bn.x + 84, bn.y + 112); g.stroke(); g.lineWidth = 1;
  box3(g, { x: 2620, y: 1070, w: 70, h: 30 }, D ? '#6a5a2a' : '#e8c86a', D ? '#4a3a18' : '#c9a13b', D);
  box3(g, { x: 2970, y: 1060, w: 90, h: 28 }, D ? '#24304a' : '#6a9ad8', D ? '#3a3648' : '#8a8fa3', D);
  g.fillStyle = D ? '#3a2616' : '#7a4a26'; g.fillRect(2598, 880, 4, 40); g.fillRect(2584, 892, 32, 4);
  emo(g, '👒', 2600, 876, 16);
};

window.placesLive = (g, clock, layer) => {
  const me = world.cats.get(world.me), D = world.dark;
  if (layer === 'over') {
    // what I carry floats over my head
    if (me && KIT.hand) small(g, me.x, me.y, () => emo(g, foodIcon(KIT.hand), me.x, me.y - 46 + Math.sin(clock * 4) * 1.5, KIT.hand.plate ? 16 : 20));
    return;
  }
  stationTick(clock, me);
  drawOrders(clock);
  // what lies on the stations, and how far along it is
  for (const name of ['board', 'grill', 'fryer']) {
    const it = KIT.st[name], r = STATION[name].r;
    if (!it) continue;
    const cx = r.x + r.w / 2, cy = r.y + 12;
    if (it.st === 'burnt') { g.save(); g.filter = 'grayscale(1) brightness(0.35)'; emo(g, FOOD_ICON[it.k], cx, cy, 16); g.restore(); }
    else emo(g, it.st === 'fried' ? '🍟' : FOOD_ICON[it.k], cx, cy, it.st === 'cut' ? 12 : 16);
    let k = null;
    if (name === 'board' && it.st === 'raw') k = (it.acc || 0) / COOK.board[it.k][0];
    if (name !== 'board' && it.st === 'raw') k = (clock - it.t0) / COOK[name][it.k][0];
    if (name !== 'board' && (it.st === 'done' || it.st === 'fried')) {
      const [done, burn] = COOK[name][it.k], w = (clock - it.t0 - done) / (burn - done);
      if (w > 0.5 && Math.sin(clock * 12) > 0) emo(g, '⚠️', cx + 18, r.y - 4, 10);
    }
    if (name !== 'board' && it.st !== 'burnt') for (let i = 0; i < 3; i++) {
      const a = (clock * 0.8 + i / 3) % 1;
      g.fillStyle = `rgba(${it.st === 'raw' ? '255,255,255' : '200,200,200'},${(1 - a) * 0.5})`;
      g.beginPath(); g.arc(cx - 10 + i * 10 + Math.sin(a * 6 + i) * 3, cy - 6 - a * 24, 2 + a * 3, 0, Math.PI * 2); g.fill();
    }
    if (it.st === 'burnt') for (let i = 0; i < 3; i++) {
      const a = (clock * 0.6 + i / 3) % 1;
      g.fillStyle = `rgba(40,40,40,${(1 - a) * 0.6})`; g.beginPath(); g.arc(cx - 8 + i * 8, cy - 6 - a * 34, 3 + a * 6, 0, Math.PI * 2); g.fill();
    }
    if (k != null) {
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(r.x + 4, r.y - 8, r.w - 8, 5);
      g.fillStyle = '#2fae7a'; g.fillRect(r.x + 5, r.y - 7, (r.w - 10) * Math.min(1, k), 3);
    }
  }
  if (KIT.st.plate.length) { const r = STATION.plate.r; emo(g, KIT.st.plate.map(p => FOOD_ICON[partOf(p)]).join(''), r.x + r.w / 2, r.y + 12, 10); }
  // my crops
  if (FARM.plots) PLOTS.forEach((r, i) => {
    const s = plotState(i);
    if (!s) return;
    const cx = r.x + r.w / 2;
    for (let j = 0; j < 6; j++) {
      const x = r.x + 16 + (j % 3) * 34, y = r.y + 18 + Math.floor(j / 3) * 30;
      if (s.k < 0.34) { g.fillStyle = D ? '#4a6a3a' : '#5aa04a'; g.fillRect(x - 1, y, 3, 3); }
      else if (s.k < 1) {
        const h = 4 + s.k * 10;
        g.fillStyle = D ? '#3a6a3a' : '#4f9d58'; g.fillRect(x, y - h, 2, h);
        g.beginPath(); g.ellipse(x - 3, y - h, 4, 2, -0.5, 0, Math.PI * 2); g.ellipse(x + 5, y - h + 2, 4, 2, 0.5, 0, Math.PI * 2); g.fill();
      } else emo(g, CROP_ICON[s.c], x, y - 6 + Math.sin(clock * 2 + j) * 1, 16);
    }
    if (s.k >= 1 && Math.sin(clock * 3 + i) > 0.7) { g.fillStyle = '#fff6c0'; g.fillRect(cx + 30, r.y + 4, 2, 6); g.fillRect(cx + 28, r.y + 6, 6, 2); }
  });
  // the scoreboard over the pitch
  if (SCORE.s) {
    const x = (PEN[0] + PEN[2]) / 2, y = PEN[1] + 24;
    g.fillStyle = D ? '#14121a' : '#1d1f2a'; roundRect(g, x - 34, y - 11, 68, 22, 5); g.fill();
    g.font = 'bold 14px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffd34d'; g.fillText(`${SCORE.s[0]} : ${SCORE.s[1]}`, x, y + 1);
  }
  // candles on the altar
  for (const cx of [3342, 3458]) {
    g.fillStyle = D ? '#d8d0b8' : '#fffaf0'; g.fillRect(cx - 2, 268, 4, 12);
    const f = 1 + Math.sin(clock * 9 + cx) * 0.2;
    g.fillStyle = '#ffd34d'; g.beginPath(); g.ellipse(cx, 264, 2 * f, 4 * f, 0, 0, Math.PI * 2); g.fill();
    if (D) { const r = g.createRadialGradient(cx, 264, 0, cx, 264, 40); r.addColorStop(0, 'rgba(255,210,120,0.25)'); r.addColorStop(1, 'rgba(255,210,120,0)'); g.fillStyle = r; g.fillRect(cx - 40, 224, 80, 80); }
  }
};

window.placesTick = (d, extra) => {
  kitchenResult(d);
  farmResult(d);
  scoreResult(d);
  // on the way into the kitchen or the farm, ask what is in the fridge and on the plots
  const z = world.zone?.id, now = Date.now();
  if (z === 'jade' && !KIT.looked) { KIT.looked = true; worldSend({ klook: 1 }); }
  if (z === 'farm' && (!FARM.plots || now - FARM.asked > 60_000) && now - FARM.asked > 5000) { FARM.asked = now; worldSend({ farm: { look: 1 } }); }
  if (!document.getElementById('w-pantry').classList.contains('hidden') && (d.kit || d.inv)) drawPantry();
};

window.skateRamp = (me, b, t) => {
  if (!b.z && b.vz <= 0 && b.v > 60 && t - (b.kicked || 0) > 0.5 && (KICKERS.some(k => inR(me, k)) || (inR(me, BOX) && !inR(me, BOX, -20)))) {
    b.vz = SK.pop * (0.75 + 0.6 * b.v / SK.max); b.z = 0.1; b.kicked = t; b.trick = ''; b.spin = 0;
    world.splashes.push({ x: me.x, y: me.y - 30, t, text: 'Air!', col: '#5b63e6' });
    sfx('click');
  }
  // over the rail on the way down, going along it: grind
  const onRail = inR(me, RAIL, 5) && Math.abs(Math.cos(b.h)) > 0.85;
  if (onRail && b.z > 2 && b.vz <= 0) {
    if (!b.grind) { b.grind = t; world.splashes.push({ x: me.x, y: me.y - 30, t, text: '50-50', col: '#ff3d6e' }); sfx('click'); }
    b.z = 6; b.vz = 0;
  } else if (b.grind && !onRail) {
    const s = t - b.grind; b.grind = 0;
    if (s > 0.4) { world.splashes.push({ x: me.x, y: me.y - 34, t, text: `Grind ${s.toFixed(1)}s`, col: '#ff3d6e' }); sfx('claim'); }
  }
};

window.placesClose = () => { for (const id of ['w-pantry', 'w-seeds', 'w-read']) document.getElementById(id)?.classList.add('hidden'); };

// the panels
document.getElementById('w-pantry').addEventListener('click', e => {
  if (e.target.id === 'w-pantry' || e.target.closest('#w-pantry-close')) return placesClose();
  const take = e.target.closest('[data-take]')?.dataset.take, buy = e.target.closest('[data-kbuy]')?.dataset.kbuy;
  if (take && fridge(take) > 0 && !KIT.hand) { KIT.hand = { k: take, st: 'raw' }; placesClose(); sfx('click'); }
  if (buy) worldSend({ kbuy: buy }, true);
});
document.getElementById('w-seeds').addEventListener('click', e => {
  if (e.target.id === 'w-seeds' || e.target.closest('#w-seeds-close')) return placesClose();
  const c = e.target.closest('[data-seed]')?.dataset.seed;
  if (c && FARM.pick >= 0) { worldSend({ farm: { p: FARM.pick, c } }, true); placesClose(); sfx('click'); }
});
document.getElementById('w-read').addEventListener('click', e => {
  if (e.target.id === 'w-read' || e.target.closest('#w-read-close')) return placesClose();
  const t = e.target.closest('button[data-book], button[data-ch], button[data-allbooks], button[data-lbook], button[data-art]');
  if (!t) return;
  const v = t.dataset;
  if (v.book) openBook(+v.book);
  else if (v.ch) { const [b, c] = v.ch.split(':').map(Number); openChapter(b, c); }
  else if (v.allbooks) { READ.view = 'books'; try { localStorage.removeItem(LS_READ); } catch {} openBible(); }
  else if (v.lbook) { const [id, i] = v.lbook.split(':'); openLibBook(id, +i); }
  else if (v.art) { const [id, i, j] = v.art.split(':'); openArticle(id, +i, +j); }
});
