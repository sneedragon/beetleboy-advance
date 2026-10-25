// BeetleBoy SP · The chat room: a little floor above the chat where everyone on
// this page walks around as a Remicat in the colour of their chat name.
// RemiliaNET has no idea who is "here", so room.php keeps the positions. People
// who only chat on remilia.net sit along the bottom edge, half see-through.
// New chat messages pop up as speech bubbles over the cat that wrote them.

const ROOM_W = 640, ROOM_H = 320, ROOM_WALL = 56;
const ROOM_SPEED = 130;              // world units a second
const ROOM_POLL = 1000;
const LS_ROOM = 'bb_room_open';

const room = {
  open: false, me: '', cats: new Map(), canvas: null, ctx: null, scale: 1,
  sprite: null, tinted: new Map(), timer: null, raf: 0, last: 0,
  target: null, sent: '', keys: new Set(), failing: 0,
};

// ── the cat sprite, recoloured per name ──────────────────────────────────────
// remicat.png: 48px frames, 3 per row. Row 0 down, row 2 side (faces right), row 3 up.
const CAT_ANIM = {
  walk: { down: [0, 1, 2, 1], side: [8, 7, 6, 7], up: [9, 10, 11, 10] },
  idle: { down: [1, 0, 1, 2], side: [7, 7, 7, 6], up: [10, 10, 10, 9] },
};
function catSheet(hue, ghost) {
  const k = `${hue}${ghost ? 'g' : ''}`;
  if (room.tinted.has(k)) return room.tinted.get(k);
  const img = room.sprite;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  // the yellow body takes the name colour; outline and eyes stay as they are
  const [r, gg, b] = hslRgb(hue, 0.7, ghost ? 0.7 : 0.6);
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 3] && d.data[i] > 200 && d.data[i + 2] < 60) { d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; }
  }
  g.putImageData(d, 0, 0);
  room.tinted.set(k, c);
  return c;
}
function hslRgb(h, s, l) {
  const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}

// ── talking to room.php ──────────────────────────────────────────────────────
async function roomPost(body) {
  const { access } = getTokens();
  if (!access) return null;
  try {
    const r = await fetch('room.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: access, ...body }) });
    if (r.status === 401) { await tryRefresh(access); return null; }
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function roomTick() {
  if (!room.open || document.hidden) return;
  const me = room.cats.get(room.me);
  const at = room.target || me;
  const body = at ? { x: Math.round(at.x), y: Math.round(at.y) } : {};
  const d = await roomPost(body);
  if (!d?.people) { if (++room.failing === 5) roomNote('The room is not answering right now.'); return; }
  if (room.failing >= 5) roomNote('');
  room.failing = 0;
  room.me = d.me;
  const here = new Set();
  for (const p of d.people) {
    here.add(p.u);
    let c = room.cats.get(p.u);
    if (!c || c.ghost) {
      const was = c;
      c = { u: p.u, d: p.d, x: p.x, y: p.y, tx: p.x, ty: p.y, dir: 'down', flip: false, moving: false, t0: Math.random() * 4, bubble: was?.bubble, bubbleT: was?.bubbleT };
      room.cats.set(p.u, c);
    }
    c.d = p.d;
    // my own cat only listens to the server when it first arrives
    if (p.u !== room.me) { c.tx = p.x; c.ty = p.y; }
  }
  for (const [u, c] of room.cats) if (!c.ghost && !here.has(u)) room.cats.delete(u);
  placeGhosts();
  roomCount();
}

// chatters of the last ten minutes who are not on this page
function placeGhosts() {
  const since = Date.now() / 1000 - 600;
  const seen = new Map();
  for (const p of pagePosts.values()) {
    const u = p.user?.username;
    if (u && p.time > since && !muted.has(u)) seen.set(u, p.user.displayname || u);
  }
  for (const [u, c] of room.cats) if (c.ghost && !seen.has(u)) room.cats.delete(u);
  const ghosts = [...seen].filter(([u]) => !room.cats.has(u) || room.cats.get(u).ghost);
  ghosts.sort((a, b) => a[0].localeCompare(b[0]));
  ghosts.slice(0, 12).forEach(([u, d], i, all) => {
    const x = (ROOM_W / (all.length + 1)) * (i + 1);
    const c = room.cats.get(u);
    if (c) { c.x = c.tx = x; c.d = d; return; }
    room.cats.set(u, { u, d, x, y: ROOM_H - 24, tx: x, ty: ROOM_H - 24, dir: 'down', flip: false, moving: false, ghost: true, t0: Math.random() * 4 });
  });
}

function roomCount() {
  const n = [...room.cats.values()].filter(c => !c.ghost).length;
  const el = document.getElementById('cp-room-count');
  if (el) el.textContent = room.open && n ? n : '';
}
function roomNote(t) { const el = document.getElementById('cp-room-note'); if (el) el.textContent = t; }

// ── moving ───────────────────────────────────────────────────────────────────
function roomStep(dt) {
  const me = room.cats.get(room.me);
  if (me && room.keys.size) {
    const k = room.keys;
    const vx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    const vy = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
    if (vx || vy) room.target = { x: clampX(me.x + vx * 40), y: clampY(me.y + vy * 40) };
  }
  if (me && room.target) { me.tx = room.target.x; me.ty = room.target.y; }
  for (const c of room.cats.values()) {
    const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy);
    // far away (a jump, a new tab): just appear there
    if (dist > 400) { c.x = c.tx; c.y = c.ty; c.moving = false; continue; }
    const step = ROOM_SPEED * dt;
    c.moving = dist > 1;
    if (!c.moving) continue;
    if (step >= dist) { c.x = c.tx; c.y = c.ty; } else { c.x += dx / dist * step; c.y += dy / dist * step; }
    if (Math.abs(dx) > Math.abs(dy)) { c.dir = 'side'; c.flip = dx < 0; } else c.dir = dy < 0 ? 'up' : 'down';
  }
}
const clampX = x => Math.max(24, Math.min(ROOM_W - 24, x));
const clampY = y => Math.max(ROOM_WALL + 30, Math.min(ROOM_H - 30, y));

// ── drawing ──────────────────────────────────────────────────────────────────
function roomDraw(now) {
  const g = room.ctx, s = room.scale;
  g.setTransform(s, 0, 0, s, 0, 0);
  g.imageSmoothingEnabled = false;
  const css = getComputedStyle(document.body);
  const floor = css.getPropertyValue('--ctrl-bg-2').trim() || '#2a3050';
  const wall = css.getPropertyValue('--panel').trim() || '#1e2442';
  const line = css.getPropertyValue('--border').trim() || '#444';
  g.fillStyle = floor; g.fillRect(0, 0, ROOM_W, ROOM_H);
  g.fillStyle = wall; g.fillRect(0, 0, ROOM_W, ROOM_WALL);
  g.strokeStyle = line; g.lineWidth = 1;
  g.globalAlpha = 0.25;
  for (let x = 0; x <= ROOM_W; x += 40) { g.beginPath(); g.moveTo(x, ROOM_WALL); g.lineTo(x, ROOM_H); g.stroke(); }
  for (let y = ROOM_WALL; y <= ROOM_H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(ROOM_W, y); g.stroke(); }
  g.globalAlpha = 1;
  g.fillStyle = line; g.fillRect(0, ROOM_WALL - 3, ROOM_W, 3);

  if (room.target && room.cats.get(room.me)?.moving) {
    g.strokeStyle = css.getPropertyValue('--accent').trim() || '#e66';
    g.globalAlpha = 0.6;
    g.beginPath(); g.ellipse(room.target.x, room.target.y, 10, 4, 0, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  }

  // back to front so the lower cat stands in front
  const cats = [...room.cats.values()].sort((a, b) => a.y - b.y);
  const t = now / 1000;
  for (const c of cats) {
    const hue = nameHue(c.d || c.u);
    const sheet = catSheet(hue, c.ghost);
    const seq = CAT_ANIM[c.moving ? 'walk' : 'idle'][c.dir];
    const f = seq[Math.floor((t + c.t0) * (c.moving ? 8 : 2)) % seq.length];
    const sx = (f % 3) * 48, sy = Math.floor(f / 3) * 48;
    const x = Math.round(c.x), y = Math.round(c.y);
    g.globalAlpha = c.ghost ? 0.45 : 1;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y, 14, 4, 0, 0, Math.PI * 2); g.fill();
    g.save();
    g.translate(x, y);
    if (c.flip) g.scale(-1, 1);
    g.drawImage(sheet, sx, sy, 48, 48, -24, -46, 48, 48);
    g.restore();
    roomLabel(g, c, x, y, hue);
    g.globalAlpha = 1;
    if (c.bubble && Date.now() < c.bubbleT) roomBubble(g, c.bubble, x, y - 52);
  }
}

// text keeps at least its size on screen when the room is drawn small (phones)
const roomFont = px => `${Math.round(px / Math.min(1, room.scale / (window.devicePixelRatio || 1)))}px system-ui, sans-serif`;

function roomLabel(g, c, x, y, hue) {
  g.font = roomFont(10);
  g.textAlign = 'center'; g.textBaseline = 'top';
  const name = (c.d || c.u).slice(0, 18) + (c.u === room.me ? ' (you)' : '');
  const m = g.measureText(name), w = m.width + 8, h = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent + 3;
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(x - w / 2, y + 4, w, h);
  g.fillStyle = `hsl(${hue} 75% 72%)`;
  g.fillText(name, x, y + 6);
}

function roomBubble(g, text, x, y) {
  g.font = roomFont(11);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // up to two lines of about 26 characters
  const words = text.split(/\s+/), lines = [''];
  for (const w of words) {
    const l = lines[lines.length - 1];
    if ((l + ' ' + w).trim().length > 26 && l) { if (lines.length === 2) { lines[1] += '…'; break; } lines.push(w); }
    else lines[lines.length - 1] = (l + ' ' + w).trim();
  }
  const m = g.measureText('Mg'), lh1 = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent + 1;
  const lw = Math.max(...lines.map(l => g.measureText(l).width)) + 12, lh = lines.length * lh1 + 8;
  const bx = Math.max(2, Math.min(ROOM_W - lw - 2, x - lw / 2)), by = Math.max(2, y - lh);
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1;
  roundRect(g, bx, by, lw, lh, 6); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - 4, by + lh); g.lineTo(x, by + lh + 5); g.lineTo(x + 4, by + lh); g.closePath(); g.fill();
  g.fillStyle = '#111';
  lines.forEach((l, i) => g.fillText(l, bx + lw / 2, by + 4 + lh1 / 2 + i * lh1));
}

function roomFrame(now) {
  if (!room.open) return;
  const dt = Math.min(0.1, (now - (room.last || now)) / 1000);
  room.last = now;
  roomStep(dt);
  roomDraw(now);
  room.raf = requestAnimationFrame(roomFrame);
}

// the canvas keeps the room's 2:1 shape and fits the panel
function roomFit() {
  const wrap = document.getElementById('cp-room');
  if (!wrap || !room.canvas) return;
  const w = wrap.clientWidth;
  const h = Math.min(w / 2, window.innerHeight * 0.36);
  const cw = h * 2;
  const dpr = window.devicePixelRatio || 1;
  room.canvas.style.width = `${cw}px`; room.canvas.style.height = `${h}px`;
  room.canvas.width = Math.round(cw * dpr); room.canvas.height = Math.round(h * dpr);
  room.scale = room.canvas.width / ROOM_W;
}

// ── open, close, input ───────────────────────────────────────────────────────
function roomToggle(on = !room.open) {
  room.open = on;
  try { localStorage.setItem(LS_ROOM, on ? '1' : ''); } catch {}
  document.getElementById('cp-room').classList.toggle('hidden', !on);
  document.getElementById('cp-room-btn').classList.toggle('active', on);
  if (on) {
    roomFit();
    roomTick();
    clearInterval(room.timer);
    room.timer = setInterval(roomTick, ROOM_POLL);
    room.last = 0;
    room.raf = requestAnimationFrame(roomFrame);
  } else {
    clearInterval(room.timer);
    cancelAnimationFrame(room.raf);
    roomLeave();
    for (const [u, c] of room.cats) if (!c.ghost) room.cats.delete(u);
    room.target = null;
    roomCount();
  }
}

function roomLeave() {
  const { access } = getTokens();
  if (access && room.me) navigator.sendBeacon?.('room.php', JSON.stringify({ token: access, leave: true }));
}

const ROOM_KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
function roomKey(e, down) {
  if (!room.open) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  const k = ROOM_KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (!k || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  if (down) room.keys.add(k); else room.keys.delete(k);
}

function setupRoom() {
  room.canvas = document.getElementById('cp-room-canvas');
  room.ctx = room.canvas.getContext('2d');
  room.sprite = new Image();
  room.sprite.src = 'icons/remicat.png';
  room.canvas.addEventListener('pointerdown', e => {
    const r = room.canvas.getBoundingClientRect();
    room.target = { x: clampX((e.clientX - r.left) / r.width * ROOM_W), y: clampY((e.clientY - r.top) / r.height * ROOM_H) };
    roomTick();
  });
  document.getElementById('cp-room-btn').addEventListener('click', () => roomToggle());
  document.addEventListener('keydown', e => roomKey(e, true));
  document.addEventListener('keyup', e => roomKey(e, false));
  window.addEventListener('blur', () => room.keys.clear());
  window.addEventListener('resize', () => room.open && roomFit());
  window.addEventListener('pagehide', () => room.open && roomLeave());
  document.addEventListener('visibilitychange', () => { if (room.open && !document.hidden) roomTick(); });
  let wanted = false;
  try { wanted = localStorage.getItem(LS_ROOM) === '1'; } catch {}
  if (wanted) room.sprite.addEventListener('load', () => getTokens().access && roomToggle(true), { once: true });
}

// ── speech bubbles from the chat ─────────────────────────────────────────────
const roomSaid = new Set();
const _roomAppend = appendChatPosts;
appendChatPosts = function (posts, isInit, prepend = false) {
  _roomAppend(posts, isInit, prepend);
  if (prepend) return;
  if (room.open) placeGhosts();
  for (const p of posts) {
    const u = p.user?.username;
    if (!u) continue;
    const text = bodyToPlainText(p.body || '').trim();
    // the message I just sent shows up twice: first as my own copy, then from the server
    const key = `${u}\n${text}`;
    if (isInit || !text || roomSaid.has(key) || muted.has(u)) { roomSaid.add(key); continue; }
    roomSaid.add(key);
    setTimeout(() => roomSaid.delete(key), 60_000);
    const c = room.cats.get(u);
    if (c) { c.bubble = text; c.bubbleT = Date.now() + 6000; }
  }
};

document.addEventListener('DOMContentLoaded', setupRoom);
