// the notice board, the slot parlour, the map and levels
'use strict';

// ── levels: every level needs a fifth more XP than the one before ───────────
function lvOf(xp) {
  let lv = 1, need = 50;
  xp = Math.max(0, xp | 0);
  while (xp >= need) { xp -= need; lv++; need = Math.round(50 * 1.2 ** (lv - 1)); }
  return { lv, into: xp, need };
}
window.lvOf = lvOf;
const HUB = { lxp: null, top: null, slot: -1, bet: 1, spinning: false, mapRaf: 0 };
function setLevel(xp) {
  if (xp == null) return;
  const el = document.getElementById('w-lv'), was = HUB.lxp == null ? null : lvOf(HUB.lxp).lv;
  HUB.lxp = xp;
  const l = lvOf(xp);
  el.textContent = `Lv ${l.lv}`;
  el.title = `${l.into} of ${l.need} XP to level ${l.lv + 1}. Stars you earn count as XP, and so does every beetle, fish, find and harvest.`;
  el.style.setProperty('--k', (l.into / l.need * 100).toFixed(1) + '%');
  if (was != null && l.lv > was) {
    worldToast(`⭐ Level ${l.lv}!`, 3500); sfx('claim');
    const me = world.cats.get(world.me);
    if (me) world.splashes.push({ x: me.x, y: me.y - 70, t: performance.now() / 1000, text: `Level ${l.lv}`, col: '#ffb43d' });
  }
}

// ── the notice board by the plaza ───────────────────────────────────────────
const PATCH = [
  ['26 Oct', 'Sit down on any chair, stool, bench, sofa or pew. On the board you can now kickflip over tables, benches and the park hedges, but not over the garden fence.'],
  ['26 Oct', 'The beetle slots have four reels of three with seven lines, a golden wild and big wins. The Jade Arches look like a jade dynasty now, steaks show when they are cooked, and you can see what you are carrying. One order in a hundred gives you the crew cap.'],
  ['26 Oct', 'A back alley with a dumpster behind the Jade Arches and Cyberia, a busier terminal with computers, arcades and servers, your level next to your name, and walking that stops when you let go.'],
  ['26 Oct', 'The town follows a new plan: a slot parlour across from the Jade Arches, the farm down beside the garden, and the pond between Cyberia and the terminal. The terminal has a proper boutique and a counter that buys your finds.'],
  ['26 Oct', 'Levels: every star you earn is XP, and each beetle, fish, find and harvest adds one more. The best three are on this board.'],
  ['26 Oct', 'A map of the whole town with everyone who is online. Open it from the bar at the bottom.'],
  ['26 Oct', 'The club screen works from anywhere in Cyberia, and you can hear it from the plaza.'],
];
function renderBoard() {
  const el = document.getElementById('w-board-body');
  const medal = ['🥇', '🥈', '🥉'];
  const top = HUB.top == null ? '<p class="w-dim">Looking up the best players…</p>'
    : HUB.top.length ? `<ol class="w-top">${HUB.top.map(([u, xp], i) => `<li><span>${medal[i]}</span><b>${esc(u)}</b><small>Lv ${lvOf(+xp).lv} · ${(+xp).toLocaleString()} XP</small></li>`).join('')}</ol>`
    : '<p class="w-dim">Nobody has any XP yet. Catch a beetle and you are first.</p>';
  el.innerHTML = `<h3>Top players</h3>${top}<h3>What is new</h3>${PATCH.map(([d, t]) => `<p class="w-note"><small>${esc(d)}</small>${esc(t)}</p>`).join('')}`;
}
function openBoard() {
  closePanels();
  document.getElementById('w-board').classList.remove('hidden');
  renderBoard();
  worldSend({ board: 1 }, true);
}

// ── the slot machines: four reels, three rows, seven lines ──────────────────
// as in world.php: pays in fifths of the bet for three and four in a line from the left; golden stands in for any beetle
const SLOT_PAY = { green: [3, 12], ladybug: [4, 16], pillbug: [7, 30], stag: [12, 60], goliath: [25, 150], golden: [60, 750] };
const SLOT_LINES = [[1, 1, 1, 1], [0, 0, 0, 0], [2, 2, 2, 2], [0, 1, 1, 0], [2, 1, 1, 2], [1, 0, 0, 1], [1, 2, 2, 1]];
const LINE_COL = ['#ff3d6e', '#ffd75a', '#5be0c0', '#7fb8ff', '#d65bb6', '#ff9a3d', '#b9e86a'];
const SLOT_NAME = { green: 'Green', ladybug: 'Ladybug', pillbug: 'Pillbug', stag: 'Stag', goliath: 'Goliath', golden: 'Golden' };
const starsFor = (bet, fifths) => Math.max(1, Math.round(bet * fifths / 5));
const randSym = () => SLOT_SYMS[Math.floor(Math.random() * 6)];
function reelHtml(k) { return `<img src="icons/beetles/${k}.png" alt="${SLOT_NAME[k]}">`; }
function cellsHtml(col) { return col.map(k => `<div class="w-cell" data-k="${k}">${reelHtml(k)}</div>`).join(''); }
function buildSlots() {
  const box = document.getElementById('w-slot-reels');
  if (box.dataset.built) return;
  box.dataset.built = 1;
  const tabs = side => `<div class="w-ltabs">${SLOT_LINES.map((L, i) => `<i style="--c:${LINE_COL[i]};grid-row:${L[side ? 3 : 0] + 1}" data-line="${i}">${i + 1}</i>`).join('')}</div>`;
  box.innerHTML = `<div class="w-marq"><b>甲虫</b> BEETLE SLOTS <b>777</b></div>
    <div class="w-glass">${tabs(0)}<div class="w-cols">${[0, 1, 2, 3].map(c => `<div class="w-col">${cellsHtml([randSym(), randSym(), randSym()])}</div>`).join('')}
    <svg viewBox="0 0 400 300" preserveAspectRatio="none"></svg></div>${tabs(1)}</div>
    <div id="w-slot-big"></div>`;
}
function renderPay() {
  const bet = HUB.bet;
  document.getElementById('w-slot-pay').innerHTML = Object.entries(SLOT_PAY).reverse().map(([k, [p3, p4]]) =>
    `<div>${reelHtml(k)}<span>3</span><b>★ ${starsFor(bet, p3)}</b><span>4</span><b>★ ${starsFor(bet, p4)}</b></div>`).join('') +
    `<p class="w-dim">${reelHtml('golden')} The golden beetle stands in for any other. Seven lines, all of them count. Wins on several lines add up.</p>
    <div class="w-lines">${SLOT_LINES.map((L, i) => `<svg viewBox="0 0 40 30" style="--c:${LINE_COL[i]}"><rect width="40" height="30"/><polyline points="${L.map((r, c) => `${5 + c * 10},${5 + r * 10}`).join(' ')}"/></svg>`).join('')}</div>`;
}
function renderSlots() {
  document.querySelectorAll('#w-slots [data-bet]').forEach(b => b.classList.toggle('on', +b.dataset.bet === HUB.bet));
  document.getElementById('w-slot-spin').textContent = `Pull the lever ★ ${HUB.bet}`;
  document.getElementById('w-slot-spin').disabled = HUB.spinning || (world.coins != null && world.coins < HUB.bet);
}
function openSlots(i) {
  closePanels();
  HUB.slot = i;
  document.getElementById('w-slots').classList.remove('hidden');
  buildSlots(); renderPay();
  document.getElementById('w-slot-msg').textContent = 'Three or four alike on a line, from the left, pay out.';
  renderSlots();
}
const slotCols = () => [...document.querySelectorAll('#w-slot-reels .w-col')];
function clearWins() {
  document.querySelector('#w-slot-reels svg').innerHTML = '';
  document.querySelectorAll('#w-slot-reels .hit, #w-slot-reels .w-ltabs i.on').forEach(e => e.classList.remove('hit', 'on'));
  const big = document.getElementById('w-slot-big'); big.className = ''; big.textContent = '';
}
function spinSlots() {
  if (HUB.spinning) return;
  if (world.coins != null && world.coins < HUB.bet) return worldToast('Not enough stars for that bet.');
  HUB.spinning = true; HUB.t0 = performance.now();
  world.slotSpin = { i: HUB.slot, until: performance.now() / 1000 + 30, reels: null };
  document.getElementById('w-slot-msg').textContent = 'Spinning…';
  clearWins();
  slotCols().forEach(c => { c.classList.remove('land'); c.classList.add('spin'); });
  clearInterval(HUB.anim);
  HUB.anim = setInterval(() => slotCols().forEach(c => { if (c.classList.contains('spin')) c.innerHTML = cellsHtml([randSym(), randSym(), randSym()]); }), 60);
  renderSlots(); sfx('click');
  worldSend({ slot: { bet: HUB.bet } }, true);
}
function slotResult(s) {
  const stop = msg => { clearInterval(HUB.anim); HUB.spinning = false; world.slotSpin = null; slotCols().forEach(c => c.classList.remove('spin')); document.getElementById('w-slot-msg').textContent = msg; renderSlots(); };
  if (typeof s === 'string') return stop({ far: 'Stand in the slot parlour to play.', poor: 'Not enough stars for that bet.', wait: 'The reels are still turning.', bad: 'Pick a bet first.' }[s] || 'The machine is stuck. Try again.');
  // the reels stop one after another, left to right; the last one takes its time when three are already lined up
  const wait = Math.max(0, 900 - (performance.now() - HUB.t0)), cols = slotCols();
  const tease = (s.lines || []).some(([, n]) => n === 3) || s.grid?.slice(0, 3).some(c => c.includes('golden'));
  const at = j => wait + j * 380 + (j === 3 && tease ? 700 : 0);
  world.slotSpin = { i: HUB.slot, until: performance.now() / 1000 + (at(3) + 300) / 1000, reels: s.reels };
  cols.forEach((c, j) => setTimeout(() => { c.classList.remove('spin'); c.innerHTML = cellsHtml(s.grid[j]); c.classList.add('land'); sfx('click'); }, at(j)));
  setTimeout(() => {
    const net = s.win - s.bet;
    stop(s.win === 0 ? 'No luck this time.' : net > 0 ? `You win ★ ${s.win}!` : `★ ${s.win} back.`);
    world.slotSpin = { i: HUB.slot, until: 0, reels: s.reels };
    // light up each winning line in its colour, and the beetles on it
    const svg = document.querySelector('#w-slot-reels svg');
    svg.innerHTML = (s.lines || []).map(([li, n]) => `<polyline style="--c:${LINE_COL[li]}" points="${SLOT_LINES[li].slice(0, n).map((r, c) => `${50 + c * 100},${50 + r * 100}`).join(' ')}"/>`).join('');
    for (const [li, n] of s.lines || []) {
      SLOT_LINES[li].slice(0, n).forEach((r, c) => cols[c].children[r]?.classList.add('hit'));
      document.querySelectorAll(`#w-slot-reels .w-ltabs i[data-line="${li}"]`).forEach(e => e.classList.add('on'));
    }
    const big = document.getElementById('w-slot-big');
    if (s.win >= s.bet * 30) { big.textContent = s.lines.some(([, n, k]) => k === 'golden' && n === 4) ? 'JACKPOT' : 'MEGA WIN'; big.className = 'show mega'; }
    else if (s.win >= s.bet * 8) { big.textContent = 'BIG WIN'; big.className = 'show'; }
    if (net > 0) {
      sfx('claim');
      const me = world.cats.get(world.me);
      if (me) world.splashes.push({ x: me.x, y: me.y - 60, t: performance.now() / 1000, text: `+★ ${s.win}`, col: '#ffb43d' });
      if (s.win >= s.bet * 8) for (let i = 0; i < 4; i++) world.fx.set(`slot${Date.now()}${i}`, { x: SLOTS[HUB.slot].x + 38 + (i - 1.5) * 40, y: SLOTS[HUB.slot].y + 20, hue: 30 + i * 20, kind: 'confetti', t0: performance.now() / 1000 + i * 0.2 });
    }
  }, at(3) + 250);
}

// ── the map: the whole town, and where everyone is ──────────────────────────
function drawMap() {
  const cv = document.getElementById('w-map-cv');
  if (!cv || document.getElementById('w-map').classList.contains('hidden')) { HUB.mapRaf = 0; return; }
  const box = cv.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const s = Math.min((box.width - 4) / WORLD_W, (window.innerHeight * 0.72 - 60) / WORLD_H);
  const w = Math.round(WORLD_W * s), h = Math.round(WORLD_H * s);
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
  const g = cv.getContext('2d'), D = world.dark;
  g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
  g.fillStyle = D ? '#07060c' : '#cfd6e6'; g.fillRect(0, 0, WORLD_W, WORLD_H);
  g.fillStyle = D ? '#1d1b28' : '#f2f1ea';
  for (const p of PLATFORMS) g.fillRect(p.x, p.y, p.w, p.h);
  for (const z of ZONES) {
    g.fillStyle = z.col + (D ? '55' : '70'); g.fillRect(z.x, z.y, z.w, z.h);
    g.strokeStyle = z.col; g.lineWidth = 8 / s * 0.25; g.strokeRect(z.x, z.y, z.w, z.h);
  }
  g.fillStyle = D ? '#24406a' : '#7fb8ff'; g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = D ? '#4a4460' : '#c9c6dc'; g.beginPath(); g.arc(WELL.x, WELL.y, 30, 0, Math.PI * 2); g.fill();
  g.font = `bold ${Math.round(13 / s)}px "Pixelify Sans", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = D ? '#e9e4ff' : '#1d1f2a';
  for (const z of ZONES) g.fillText(z.name, z.x + z.w / 2, z.y + z.h / 2);
  g.fillText('PLAZA', WELL.x, WELL.y + 110);
  // everyone online; me with a ring
  const t = performance.now() / 1000;
  for (const c of world.cats.values()) {
    if (c.ghost) continue;
    const mine = c.u === world.me;
    g.fillStyle = mine ? '#ff3d6e' : `hsl(${nameHue(c.d || c.u)} 70% 50%)`;
    g.beginPath(); g.arc(c.x, c.y, (mine ? 7 : 5.5) / s * 0.9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.5 / s; g.stroke();
    if (mine) { g.strokeStyle = `rgba(255,61,110,${0.6 - (t % 1) * 0.6})`; g.beginPath(); g.arc(c.x, c.y, (8 + (t % 1) * 10) / s, 0, Math.PI * 2); g.stroke(); }
  }
  const n = [...world.cats.values()].filter(c => !c.ghost).length;
  document.getElementById('w-map-n').textContent = `${n} online`;
  HUB.mapRaf = requestAnimationFrame(drawMap);
}
function openMap() {
  const p = document.getElementById('w-map'), open = p.classList.contains('hidden');
  closePanels();
  if (!open) return;
  p.classList.remove('hidden');
  if (!HUB.mapRaf) HUB.mapRaf = requestAnimationFrame(drawMap);
}

// the best three, written on the board's green screen; asked for again every minute while you are near
window.hubLive = (g, t) => {
  const b = BOARD, me = world.cats.get(world.me);
  if (me && Math.hypot(me.x - b.at.x, me.y - b.at.y) < 700 && t - (HUB.asked || -99) > 60) { HUB.asked = t; worldSend({ board: 1 }); }
  const ink = world.dark ? '#c9e86a' : '#2a3214';
  g.save(); g.textBaseline = 'middle'; g.font = '8px "Pixelify Sans", monospace';
  const rows = HUB.top || [];
  if (!rows.length) { g.fillStyle = ink; g.textAlign = 'center'; g.fillText(HUB.top ? 'NO PLAYERS YET' : 'CONNECTING' + '.'.repeat(Math.floor(t * 2) % 4), b.x + b.w / 2, b.y + 48); }
  rows.slice(0, 3).forEach(([u, xp], i) => {
    const y = b.y + 32 + i * 13;
    g.fillStyle = ['#ffd75a', '#e6e8f0', '#e09a5a'][i]; g.fillRect(b.x + 12, y - 4, 9, 9);
    g.fillStyle = '#23286a'; g.textAlign = 'center'; g.fillText(i + 1, b.x + 16.5, y + 0.5);
    g.fillStyle = ink; g.textAlign = 'left'; g.fillText(String(u).slice(0, 14), b.x + 25, y);
    g.textAlign = 'right'; g.fillText('Lv' + lvOf(+xp).lv, b.x + b.w - 12, y);
  });
  g.restore();
};

// ── the hooks world.js calls ────────────────────────────────────────────────
window.hubTick = d => {
  setLevel(d.lxp);
  if (d.top) { HUB.top = d.top; if (!document.getElementById('w-board').classList.contains('hidden')) renderBoard(); }
  if (d.slot != null) slotResult(d.slot);
  if (!document.getElementById('w-slots').classList.contains('hidden')) renderSlots();
};
window.hubClose = () => {
  for (const id of ['w-board', 'w-slots', 'w-map']) document.getElementById(id)?.classList.add('hidden');
  if (HUB.spinning) return;
  world.slotSpin = null;
};

document.getElementById('w-map-btn').addEventListener('click', openMap);
document.getElementById('w-lv').addEventListener('click', openBoard);
for (const id of ['w-board', 'w-map']) document.getElementById(id).addEventListener('click', e => { if (e.target.id === id || e.target.closest(`#${id}-close`)) closePanels(); });
document.getElementById('w-slots').addEventListener('click', e => {
  if (e.target.id === 'w-slots' || e.target.closest('#w-slots-close')) return closePanels();
  const bet = e.target.closest('[data-bet]')?.dataset.bet;
  if (bet && !HUB.spinning) { HUB.bet = +bet; renderSlots(); renderPay(); }
  if (e.target.closest('#w-slot-spin')) spinSlots();
});
