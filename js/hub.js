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

// ── the slot machines ───────────────────────────────────────────────────────
const SLOT_PAY = { green: 5, ladybug: 8, pillbug: 12, stag: 20, goliath: 50, golden: 200 };   // as in world.php
const SLOT_NAME = { green: 'Green', ladybug: 'Ladybug', pillbug: 'Pillbug', stag: 'Stag', goliath: 'Goliath', golden: 'Golden' };
function reelHtml(k) { return `<img src="icons/beetles/${k}.png" alt="${SLOT_NAME[k]}">`; }
function renderSlots() {
  document.querySelectorAll('#w-slots [data-bet]').forEach(b => b.classList.toggle('on', +b.dataset.bet === HUB.bet));
  document.getElementById('w-slot-spin').textContent = `Pull the lever ★ ${HUB.bet}`;
  document.getElementById('w-slot-spin').disabled = HUB.spinning || (world.coins != null && world.coins < HUB.bet);
}
function openSlots(i) {
  closePanels();
  HUB.slot = i;
  const p = document.getElementById('w-slots');
  p.classList.remove('hidden');
  const reels = document.getElementById('w-slot-reels');
  if (!reels.children.length) reels.innerHTML = ['green', 'stag', 'golden'].map(k => `<div>${reelHtml(k)}</div>`).join('');
  document.getElementById('w-slot-pay').innerHTML = Object.entries(SLOT_PAY).reverse().map(([k, m]) =>
    `<div>${reelHtml(k)}${reelHtml(k)}${reelHtml(k)}<b>× ${m}</b></div>`).join('') +
    `<div>${reelHtml('golden')}${reelHtml('golden')}<i></i><b>× 5</b></div><div><span>any pair</span><b>bet back</b></div>`;
  document.getElementById('w-slot-msg').textContent = 'Three of a kind pays out. A pair gives your bet back.';
  renderSlots();
}
function spinSlots() {
  if (HUB.spinning) return;
  if (world.coins != null && world.coins < HUB.bet) return worldToast('Not enough stars for that bet.');
  HUB.spinning = true; HUB.t0 = performance.now();
  const t = performance.now() / 1000;
  world.slotSpin = { i: HUB.slot, until: t + 30, reels: null };
  document.getElementById('w-slot-msg').textContent = 'Spinning…';
  [...document.getElementById('w-slot-reels').children].forEach(r => r.classList.add('spin'));
  HUB.anim = setInterval(() => {
    [...document.getElementById('w-slot-reels').children].forEach((r, k) => { if (r.classList.contains('spin')) r.innerHTML = reelHtml(SLOT_SYMS[Math.floor(Math.random() * 6)]); });
  }, 70);
  renderSlots(); sfx('click');
  worldSend({ slot: { bet: HUB.bet } }, true);
}
function slotResult(s) {
  const stop = msg => { clearInterval(HUB.anim); HUB.spinning = false; world.slotSpin = null; [...document.getElementById('w-slot-reels').children].forEach(r => r.classList.remove('spin')); document.getElementById('w-slot-msg').textContent = msg; renderSlots(); };
  if (typeof s === 'string') return stop({ far: 'Stand in the slot parlour to play.', poor: 'Not enough stars for that bet.', wait: 'The reels are still turning.', bad: 'Pick a bet first.' }[s] || 'The machine is stuck. Try again.');
  // the reels stop one after another, left to right
  const wait = Math.max(0, 900 - (performance.now() - HUB.t0)), reels = [...document.getElementById('w-slot-reels').children];
  world.slotSpin = { i: HUB.slot, until: performance.now() / 1000 + (wait + 900) / 1000, reels: s.reels };
  s.reels.forEach((k, j) => setTimeout(() => { reels[j].classList.remove('spin'); reels[j].innerHTML = reelHtml(k); sfx('click'); }, wait + j * 350));
  setTimeout(() => {
    const net = s.win - s.bet;
    stop(s.win === 0 ? 'No luck this time.' : net > 0 ? `You win ★ ${s.win}!` : 'A pair: your bet comes back.');
    world.slotSpin = { i: HUB.slot, until: 0, reels: s.reels };
    if (net > 0) {
      sfx('claim');
      const me = world.cats.get(world.me);
      if (me) world.splashes.push({ x: me.x, y: me.y - 60, t: performance.now() / 1000, text: `+★ ${s.win}`, col: '#ffb43d' });
      if (s.win >= s.bet * 20) for (let i = 0; i < 4; i++) world.fx.set(`slot${Date.now()}${i}`, { x: SLOTS[HUB.slot].x + 38 + (i - 1.5) * 40, y: SLOTS[HUB.slot].y + 20, hue: 30 + i * 20, kind: 'confetti', t0: performance.now() / 1000 + i * 0.2 });
    }
  }, wait + 2 * 350 + 200);
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
  if (bet && !HUB.spinning) { HUB.bet = +bet; renderSlots(); }
  if (e.target.closest('#w-slot-spin')) spinSlots();
});
