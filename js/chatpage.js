// BeetleBoy SP · The chat-only page (chat/index.html).
// Reuses chat.js for reading, sending and rendering RemiliaNET's global chat and
// adds what only makes sense with a whole page for it: unread marker, search,
// filters, who's around, mutes, keyword alerts and a few /commands.
// Everything extra is worked out in the browser from the messages RemiliaNET sends.

const LS_LASTREAD = 'bbc_lastread';
const LS_MUTED    = 'bbc_muted';
const LS_WORDS    = 'bbc_words';
const LS_COMPACT  = 'bbc_compact';

const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const pagePosts = new Map();            // msg id → post (as built by toPost)
let lastRead    = lsGet(LS_LASTREAD, 0); // highest message id the user has seen
let unreadFrom  = null;                 // where the "new" divider sits for this visit
let muted       = new Set(lsGet(LS_MUTED, []));
let filter      = { mode: 'all', user: '', q: '' };
let unseen      = 0;
const lastReadAtStart = lastRead;      // "For me" counts what came in since the last visit

// ── what the game page provides and this page does differently ────────────────
function log(msg) { console.info(msg); }
function setScreenMode() {}
function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('cp').classList.add('hidden');
  stopChatPoll();
  clearAuth();
}
function openProfile(handle) { window.open(`${BASE_URL}/~${encodeURIComponent(handle)}`, '_blank', 'noopener'); }

// Item link: a small card with picture, rarity and what the game says about it
function openCard(key) {
  const box = document.getElementById('cp-card');
  const r = RARITY[key];
  box.innerHTML =
    (IMAGES[key] ? `<img src="${esc(IMAGES[key])}" alt="">` : '') +
    `<div><strong class="${rcls(key)}">${esc(iname(key))}</strong>` +
    `<span>${esc(RARITY_NAMES[r] || '')}${SCIENTIFIC[key] ? ` · <i>${esc(SCIENTIFIC[key])}</i>` : ''}</span>` +
    (DESCRIPTIONS[key] ? `<p>${esc(DESCRIPTIONS[key])}</p>` : '') + cardInvInfo(key) + `</div>`;
  box.classList.remove('hidden');
}

// What your own inventory says about it: how many you have, how close you are
// to making it, and what it makes
function cardInvInfo(key) {
  if (!invLoaded) return '';
  const have = state.inv[key] || 0;
  const ingText = i => `${i.key ? iname(i.key) : i.label}${i.need > 1 ? ' ×' + i.need : ''}${i.sacrifice ? ' (sac)' : ''}`;
  let html = `<p class="cp-have">${have ? `You have <b>${have.toLocaleString()}</b>` : "You don't have any"}</p>`;
  const make = treeRecipes(key)[0];
  if (make) {
    html += `<p class="cp-make"><b>${make.ready ? '✓ You can make it' : 'Made from'}</b>` +
      make.ings.map(i => `<span class="${i.have >= i.need ? 'ok' : 'miss'}">${esc(ingText(i))} <small>${Math.min(i.have, i.need)}/${i.need}</small></span>`).join('') + '</p>';
  }
  const uses = treeUses(key).filter(u => u.kind !== 'sac');
  if (uses.length) {
    const outs = [...new Set(uses.flatMap(u => u.outs.map(o => o.key ? iname(o.key) : o.label)))];
    html += `<p class="cp-uses"><b>Makes</b> ${esc(outs.slice(0, 5).join(', '))}${outs.length > 5 ? ` +${outs.length - 5}` : ''}</p>`;
  }
  return html;
}

// ── brag card: your collection as a picture, sent like any other image ──────
const RARITY_HEX = { tin: '#2ea02e', brz: '#c9a800', mth: '#00b3b3', adm: '#b100c4', dia: '#5577ff', pnk: '#d455e6' };
const loadImg = (src, cors) => new Promise(res => {
  if (!src) return res(null);
  const img = new Image();
  if (cors) img.crossOrigin = 'anonymous';
  img.onload = () => res(img); img.onerror = () => res(null);
  img.src = src;
});
const rarityRank = k => RARITY_ORDER.indexOf(RARITY[k]);

async function drawBragCard() {
  await loadInv();
  const inv = state.inv, u = state.user;
  const owned = k => (inv[k] || 0) > 0;
  const collection = [...KNOWN_KEYS].filter(k => !k.startsWith('junk_cube') && k !== 'cheese');
  // best first: rarest tier, then the one you have fewest of
  // (beetles win ties, and the big picture is always your rarest beetle)
  const isB = k => BEETLES.includes(k);
  const best = collection.filter(owned).sort((a, b) => rarityRank(b) - rarityRank(a) || isB(b) - isB(a) || inv[a] - inv[b]);
  const hero = best.find(isB) || best[0];
  const shown = [...best.filter(k => isB(k) && k !== hero), ...best.filter(k => !isB(k) && k !== hero)].slice(0, 7);
  const beetles = BEETLES.reduce((n, k) => n + (inv[k] || 0), 0);
  const trophies = TROPHIES.filter(([k]) => owned(k)).length;
  const pins = Object.keys(inv).filter(k => owned(k) && pinnedBeetle(k)).length;

  const W = 1200, H = 630, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const font = (px, bold = true) => `${bold ? 'bold ' : ''}${px}px "Courier New", Courier, monospace`;
  const heroCol = RARITY_HEX[RARITY[hero]] || '#7a86c2';

  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#151a33'); bg.addColorStop(1, '#0b0e1d');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // left: your rarest thing on its own scene
  const [art, figure, heroImg, pfp] = await Promise.all([
    loadImg(hero && localBg(hero)),
    loadImg(hero && LOCAL_CARD.has(hero) && `icons/_card/${hero}.webp`),
    loadImg(hero && IMAGES[hero]), loadImg(u.pfpUrl, true)]);
  const LW = 430;
  g.save();
  g.beginPath(); g.rect(0, 0, LW, H); g.clip();
  if (art) {
    const s = Math.max(LW / art.width, H / art.height);
    g.drawImage(art, (LW - art.width * s) / 2, (H - art.height * s) / 2, art.width * s, art.height * s);
  } else {
    const rg = g.createRadialGradient(LW / 2, H / 2 - 40, 20, LW / 2, H / 2, 420);
    rg.addColorStop(0, heroCol); rg.addColorStop(1, '#0b0e1d');
    g.fillStyle = rg; g.fillRect(0, 0, LW, H);
  }
  const fade = g.createLinearGradient(0, H * 0.55, 0, H);
  fade.addColorStop(0, 'rgba(8,10,22,0)'); fade.addColorStop(1, 'rgba(8,10,22,0.92)');
  g.fillStyle = fade; g.fillRect(0, 0, LW, H);
  if (figure) {
    const s = (H - 70) / figure.height;
    g.drawImage(figure, (LW - figure.width * s) / 2, 10, figure.width * s, figure.height * s);
    g.fillStyle = fade; g.fillRect(0, 0, LW, H);
  } else if (heroImg) { g.imageSmoothingEnabled = false; g.drawImage(heroImg, LW / 2 - 140, 110, 280, 280); g.imageSmoothingEnabled = true; }
  g.restore();
  g.fillStyle = heroCol; g.fillRect(LW - 4, 0, 4, H);
  g.textAlign = 'center';
  if (hero) {
    g.fillStyle = heroCol; g.font = font(20);
    g.fillText((RARITY_NAMES[RARITY[hero]] || '').toUpperCase(), LW / 2, H - 78);
    g.fillStyle = '#fff'; g.font = font(fitFont(g, iname(hero), 34, LW - 40));
    g.fillText(iname(hero), LW / 2, H - 40);
  } else {
    g.fillStyle = '#fff'; g.font = font(30); g.fillText('No beetles yet', LW / 2, H / 2);
  }

  // right: who you are and what you've got
  const X = LW + 50;
  g.textAlign = 'left';
  let nx = X;
  if (pfp) {
    g.save(); g.beginPath(); g.arc(X + 42, 92, 42, 0, Math.PI * 2); g.clip();
    g.drawImage(pfp, X, 50, 84, 84); g.restore();
    nx = X + 104;
  }
  const name = u.displayname || u.username || '';
  g.fillStyle = '#fff'; g.font = font(fitFont(g, name, 50, W - nx - 50));
  g.fillText(name, nx, 96);
  g.fillStyle = '#8b93c4'; g.font = font(24, false);
  g.fillText(`~${u.username || ''}`, nx, 128);

  const stats = [
    [u.level != null ? `${u.level}` : '?', 'level'],
    [beetles.toLocaleString(), 'beetles'],
    [`${collection.filter(owned).length}/${collection.length}`, 'collected'],
    [`${trophies}/${TROPHIES.length}`, 'trophies'],
  ];
  const SW = (W - X - 50) / stats.length;
  stats.forEach(([v, l], i) => {
    const sx = X + i * SW;
    g.fillStyle = '#fff'; g.font = font(fitFont(g, v, 44, SW - 16)); g.fillText(v, sx, 232);
    g.fillStyle = '#8b93c4'; g.font = font(18, false); g.fillText(l.toUpperCase(), sx, 260);
  });

  // the next rarest things in a row
  const T = 84, gap = 14, ty = 320;
  g.fillStyle = '#8b93c4'; g.font = font(18, false);
  g.fillText(shown.length ? 'ALSO IN THE COLLECTION' : '', X, ty - 14);
  const icons = await Promise.all(shown.map(k => loadImg(IMAGES[k])));
  shown.forEach((k, i) => {
    const tx = X + i * (T + gap), col = RARITY_HEX[RARITY[k]] || '#556';
    g.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(g, tx, ty, T, T, 10); g.fill();
    g.strokeStyle = col; g.lineWidth = 3; roundRect(g, tx, ty, T, T, 10); g.stroke();
    if (icons[i]) { g.imageSmoothingEnabled = false; g.drawImage(icons[i], tx + 8, ty + 8, T - 16, T - 16); g.imageSmoothingEnabled = true; }
    const n = inv[k] > 999 ? `${Math.floor(inv[k] / 1000)}k` : `${inv[k]}`;
    g.font = font(16); const bw = g.measureText(n).width + 10;
    g.fillStyle = col; roundRect(g, tx + T - bw - 4, ty + T - 24, bw, 20, 6); g.fill();
    g.fillStyle = '#fff'; g.fillText(n, tx + T - bw + 1, ty + T - 9);
  });

  // a line of character at the bottom
  const facts = [];
  if (inv.cheese) facts.push(`${inv.cheese.toLocaleString()} cheese`);
  if (pins) facts.push(`${pins} pinned`);
  const hammer = [...HAMMERS].reverse().find(owned);
  if (hammer) facts.push(iname(hammer));
  g.fillStyle = '#c6cbea'; g.font = font(22, false);
  g.fillText(facts.join('  ·  '), X, 470);

  g.fillStyle = '#5b6394'; g.font = font(16, false); g.textAlign = 'right';
  g.fillText(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), W - 50, H - 36);
  return c;
}

function fitFont(g, text, px, max) {
  for (; px > 14; px -= 2) { g.font = `bold ${px}px "Courier New", Courier, monospace`; if (g.measureText(text).width <= max) break; }
  return px;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

async function openBrag() {
  const modal = document.getElementById('cp-brag');
  modal.classList.remove('hidden');
  modal.querySelector('.cp-brag-img').innerHTML = '<p class="cp-empty">Counting your beetles…</p>';
  let c;
  try { c = await drawBragCard(); } catch (e) { console.warn(e); }
  if (!c) { modal.querySelector('.cp-brag-img').innerHTML = '<p class="cp-empty">Could not draw the card.</p>'; return; }
  c.toBlob(blob => {
    modal._file = new File([blob], 'collection.png', { type: 'image/png' });
    modal.querySelector('.cp-brag-img').innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="Your collection card">`;
  }, 'image/png');
}

// Your beetle inventory, so item cards and the brag card know what you own
let invLoaded = false;
async function loadInv() {
  let u;
  if (chatV1()) {
    const r = await v1Call('GET', '/me/beetle');
    u = r.ok ? r.data : null;
  } else u = await apiGet('/api/beetle/user');
  if (!u || u.success === false) return;
  state.inv = u.inventory || {};
  state.user = { ...u, ...state.user };
  state.user.level = u.level;
  invLoaded = true;
}

// ── every rendered message gets tagged so filters can work on it ─────────────
const _appendChatPosts = appendChatPosts;
appendChatPosts = function (posts, isInit, prepend = false) {
  const me = state.user?.username || '';
  const fresh = !isInit && !prepend ? posts.filter(p => p.id > 0 && !pagePosts.has(p.id)) : [];
  _appendChatPosts(posts, isInit, prepend);
  for (const p of posts) {
    if (p.id <= 0) continue;
    pagePosts.set(p.id, p);
    const el = renderedPostEls.get(p.id);
    if (!el) continue;
    const forMe = p.user.username !== me && (p.mentionsMe || p.replyTo?.username === me);
    el.dataset.user = p.user.username;
    el.classList.toggle('cp-forme', forMe);
    el.classList.toggle('cp-media', !!(p.media?.length || /\bhttps?:\/\/|\bwww\./.test(p.body)));
    el.classList.toggle('cp-muted', muted.has(p.user.username));
    el.classList.toggle('cp-word', p.user.username !== me && !!wordHit(p.body));
  }
  if (isInit) placeUnreadDivider();
  for (const p of fresh) {
    if (p.user.username === me) continue;
    const w = wordHit(p.body);
    if (w && !muted.has(p.user.username)) {
      if (document.hidden) notify(`${p.user.displayname || p.user.username}: ${bodyToPlainText(p.body).slice(0, 80)}`, 'word');
      else showInAppNotif(`"${w}" from ${p.user.displayname || p.user.username}`);
      sfx('mention');
    }
    if (!atBottom() || document.hidden) unseen++;
  }
  applyFilter();
  renderSide();
  updateUnread();
};

function wordHit(body) {
  const text = bodyToPlainText(body || '').toLowerCase();
  return lsGet(LS_WORDS, []).find(w => w && text.includes(w.toLowerCase())) || null;
}

// ── unread ────────────────────────────────────────────────────────────────────
const box = () => document.getElementById('chat-messages');
const atBottom = () => { const b = box(); return b.scrollHeight - b.scrollTop <= b.clientHeight + 60; };

function placeUnreadDivider() {
  const me = state.user?.username || '';
  const first = [...pagePosts.values()].find(p => p.id > lastRead && p.user.username !== me);
  if (!lastRead || !first) { markRead(); return; }
  unreadFrom = first.id;
  const el = renderedPostEls.get(first.id);
  const n = [...pagePosts.values()].filter(p => p.id >= first.id && p.user.username !== me).length;
  const div = document.createElement('div');
  div.id = 'cp-divider';
  div.textContent = `${n} new since you were here`;
  el.before(div);
  div.scrollIntoView({ block: 'start' });
}

function markRead() {
  const max = Math.max(lastRead, ...pagePosts.keys());
  if (max > lastRead) { lastRead = max; lsSet(LS_LASTREAD, lastRead); }
  unseen = 0;
}

function updateUnread() {
  if (atBottom() && !document.hidden) markRead();
  const jump = document.getElementById('cp-jump');
  jump.classList.toggle('hidden', atBottom());
  jump.textContent = unseen ? `↓ ${unseen} new` : '↓';
  document.title = unseen && document.hidden ? `(${unseen}) Beetle Chat` : 'Beetle Chat';
}

// ── filters and search ────────────────────────────────────────────────────────
function matches(p) {
  if (filter.mode === 'me' && !renderedPostEls.get(p.id)?.classList.contains('cp-forme')) return false;
  if (filter.mode === 'media' && !renderedPostEls.get(p.id)?.classList.contains('cp-media')) return false;
  if (filter.user && p.user.username !== filter.user) return false;
  if (filter.q) {
    const hay = `${bodyToPlainText(p.body)} ${p.user.username} ${p.user.displayname}`.toLowerCase();
    if (!hay.includes(filter.q)) return false;
  }
  return true;
}

function applyFilter() {
  const on = filter.mode !== 'all' || filter.user || filter.q;
  document.body.classList.toggle('cp-filtering', !!on);
  let shown = 0;
  for (const [id, p] of pagePosts) {
    const el = renderedPostEls.get(id);
    if (!el) continue;
    const ok = !on || matches(p);
    el.classList.toggle('cp-hit', !!on && ok);
    if (ok) shown++;
  }
  document.getElementById('cp-older').classList.toggle('hidden', !on || !chatHasOlder);
  document.getElementById('cp-older').textContent = shown ? 'Search further back' : 'Nothing here yet, search further back';
  const me = state.user?.username || '';
  const forMe = [...pagePosts.values()].filter(p => p.id > (lastReadAtStart ?? 0) && p.user.username !== me
    && renderedPostEls.get(p.id)?.classList.contains('cp-forme')).length;
  document.getElementById('cp-me-count').textContent = forMe ? forMe : '';
  const chip = document.getElementById('cp-user-chip');
  chip.classList.toggle('hidden', !filter.user);
  chip.textContent = filter.user ? `~${filter.user} ✕` : '';
}
function setFilter(change) {
  Object.assign(filter, change);
  document.querySelectorAll('.cp-chip[data-filter]').forEach(c => c.classList.toggle('active', c.dataset.filter === filter.mode));
  applyFilter();
  box().scrollTop = box().scrollHeight;
}

async function searchOlder() {
  const btn = document.getElementById('cp-older');
  btn.disabled = true; btn.textContent = 'Searching…';
  for (let i = 0; i < 5 && chatHasOlder; i++) await loadOlderChat();
  btn.disabled = false;
  applyFilter();
}

// ── side panel: who's around and today's numbers ─────────────────────────────
function renderSide() {
  const now = Date.now() / 1000;
  const recent = new Map();                 // username → {user, last, n}
  const today = new Map();
  const midnight = new Date().setHours(0, 0, 0, 0) / 1000;
  let hottest = null;
  for (const p of pagePosts.values()) {
    const u = p.user.username;
    if (!u) continue;
    if (now - p.time < 3600) {
      const r = recent.get(u) || { user: p.user, last: 0, n: 0 };
      r.last = Math.max(r.last, p.time); r.n++;
      recent.set(u, r);
    }
    if (p.time >= midnight) {
      today.set(u, (today.get(u) || 0) + 1);
      const score = Object.values(p.reactions || {}).reduce((s, a) => s + a.length, 0);
      if (score && (!hottest || score > hottest.score)) hottest = { p, score };
    }
  }
  const people = [...recent.values()].sort((a, b) => b.last - a.last);
  document.getElementById('cp-people').innerHTML = people.length ? people.map(({ user, last, n }) => {
    const ago = Math.max(1, Math.round((now - last) / 60));
    return `<div class="cp-person${filter.user === user.username ? ' active' : ''}${muted.has(user.username) ? ' muted' : ''}" data-user="${esc(user.username)}">` +
      (user.pfpUrl ? `<img src="${esc(user.pfpUrl)}" alt="" onerror="this.style.visibility='hidden'">` : '<span class="cp-pfp"></span>') +
      `<span class="chat-user" style="--name-h:${nameHue(user.displayname || user.username)}">${esc(user.displayname || user.username)}</span>` +
      `<span class="cp-ago">${n} · ${ago}m</span>` +
      `<span class="cp-person-acts"><button type="button" data-act="mention" title="Mention">~</button>` +
      `<button type="button" data-act="mute" title="${muted.has(user.username) ? 'Unmute' : 'Mute'}">${muted.has(user.username) ? '🔈' : '🔇'}</button>` +
      `<button type="button" data-act="profile" title="Profile">↗</button></span></div>`;
  }).join('') : '<p class="cp-empty">Quiet for the last hour.</p>';

  const top = [...today.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const total = [...today.values()].reduce((s, n) => s + n, 0);
  document.getElementById('cp-today').innerHTML =
    `<p>${total} messages from ${today.size} people${chatHasOlder ? ' so far' : ''}</p>` +
    (top.length ? `<p>Chattiest: ${top.map(([u, n]) => `<span class="cp-link" data-user="${esc(u)}">~${esc(u)}</span> ${n}`).join(', ')}</p>` : '') +
    (hottest ? `<p class="cp-link cp-hot" data-jump="${hottest.p.id}">🔥 Most reactions (${hottest.score}): ${esc(bodyToPlainText(hottest.p.body).slice(0, 60) || '(picture)')}</p>` : '');
}

// ── /commands: they just write a normal message, so everyone sees the result ─
const COMMANDS = {
  roll:  a => { const n = Math.max(2, Math.min(1e6, parseInt(a) || 100)); return `🎲 rolled ${1 + Math.floor(Math.random() * n)} (1-${n})`; },
  flip:  () => `🪙 ${Math.random() < 0.5 ? 'heads' : 'tails'}`,
  shrug: a => `${a ? a + ' ' : ''}¯\\_(ツ)_/¯`,
  beetle: () => `🪲 today's beetle: [${iname(BEETLES[Math.floor(Math.random() * BEETLES.length)])}]`,
};
const COMMAND_HELP = { roll: '/roll [max]  dice, 1-100 by default', flip: '/flip  heads or tails', shrug: '/shrug [text]', beetle: '/beetle  a random beetle' };

function expandCommand(input) {
  const m = /^\/(\w+)\s*(.*)$/.exec(input.value.trim());
  if (!m || !COMMANDS[m[1].toLowerCase()]) return;
  input.value = COMMANDS[m[1].toLowerCase()](m[2].trim());
}

function suggestCommands(input) {
  const m = /^\/(\w*)$/.exec(input.value);
  if (!m) return;
  const hits = Object.keys(COMMANDS).filter(c => c.startsWith(m[1].toLowerCase()));
  const sug = document.getElementById('chat-suggest');
  if (!hits.length) return;
  sug.innerHTML = hits.map(c => `<div class="chat-sug-item" data-cmd="${c}">${esc(COMMAND_HELP[c])}</div>`).join('');
  sug.classList.add('open');
}

// ── settings ──────────────────────────────────────────────────────────────────
function renderMuted() {
  const el = document.getElementById('cp-muted');
  el.innerHTML = muted.size
    ? 'Muted: ' + [...muted].map(u => `<button type="button" data-unmute="${esc(u)}">~${esc(u)} ✕</button>`).join(' ')
    : '';
}

function toggleMute(u) {
  muted.has(u) ? muted.delete(u) : muted.add(u);
  lsSet(LS_MUTED, [...muted]);
  for (const [id, p] of pagePosts) renderedPostEls.get(id)?.classList.toggle('cp-muted', muted.has(p.user.username));
  renderSide(); renderMuted();
}

function setupPage() {
  const input = document.getElementById('chat-input');
  // /commands turn into their text before chat.js sends it
  input.addEventListener('keydown', e => { if (e.key === 'Enter') expandCommand(input); }, true);
  document.getElementById('chat-send').addEventListener('click', () => expandCommand(input), true);
  input.addEventListener('input', () => suggestCommands(input));
  document.getElementById('chat-suggest').addEventListener('click', e => {
    const c = e.target.closest('[data-cmd]');
    if (!c) return;
    input.value = `/${c.dataset.cmd} `;
    document.getElementById('chat-suggest').classList.remove('open');
    input.focus();
  });
  setupChatListeners();

  box().addEventListener('scroll', updateUnread, { passive: true });
  document.addEventListener('visibilitychange', updateUnread);
  document.getElementById('cp-jump').addEventListener('click', () => { box().scrollTop = box().scrollHeight; });

  document.getElementById('cp-filters').addEventListener('click', e => {
    const chip = e.target.closest('.cp-chip[data-filter]');
    if (chip) setFilter({ mode: chip.dataset.filter });
  });
  document.getElementById('cp-user-chip').addEventListener('click', () => setFilter({ user: '' }));
  document.getElementById('cp-older').addEventListener('click', searchOlder);
  let t;
  document.getElementById('cp-search').addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => setFilter({ q: e.target.value.trim().toLowerCase() }), 150);
  });

  document.getElementById('cp-side').addEventListener('click', e => {
    const jump = e.target.closest('[data-jump]');
    if (jump) { jumpToChatMsg(Number(jump.dataset.jump)); return; }
    const row = e.target.closest('[data-user]');
    if (!row) return;
    const u = row.dataset.user;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'mention') { input.value = `${input.value}${input.value && !input.value.endsWith(' ') ? ' ' : ''}~${u} `; input.focus(); }
    else if (act === 'mute') toggleMute(u);
    else if (act === 'profile') openProfile(u);
    else setFilter({ user: filter.user === u ? '' : u });
    if (window.innerWidth <= 720) document.body.classList.remove('cp-side-open');
  });
  document.getElementById('cp-people-btn').addEventListener('click', () => document.body.classList.toggle('cp-side-open'));

  const settings = document.getElementById('cp-settings');
  document.getElementById('cp-settings-btn').addEventListener('click', () => { renderMuted(); settings.classList.toggle('hidden'); });
  const words = document.getElementById('cp-words');
  words.value = lsGet(LS_WORDS, []).join(', ');
  words.addEventListener('change', () => lsSet(LS_WORDS, words.value.split(',').map(w => w.trim()).filter(Boolean)));
  const sound = document.getElementById('cp-sound');
  sound.checked = !SFX.isMuted();
  sound.addEventListener('change', () => SFX.setMuted(!sound.checked));
  const compact = document.getElementById('cp-compact');
  compact.checked = lsGet(LS_COMPACT, false);
  document.body.classList.toggle('cp-compact', compact.checked);
  compact.addEventListener('change', () => { lsSet(LS_COMPACT, compact.checked); document.body.classList.toggle('cp-compact', compact.checked); });
  const notifBtn = document.getElementById('cp-notif');
  const notifState = () => {
    const p = 'Notification' in window ? Notification.permission : 'denied';
    notifBtn.classList.toggle('hidden', p !== 'default');
  };
  notifState();
  notifBtn.addEventListener('click', async () => { await Notification.requestPermission(); notifState(); });
  document.getElementById('cp-muted').addEventListener('click', e => {
    const b = e.target.closest('[data-unmute]');
    if (b) toggleMute(b.dataset.unmute);
  });
  document.getElementById('cp-logout').addEventListener('click', showLogin);
  document.addEventListener('click', e => {
    if (!settings.classList.contains('hidden') && !e.target.closest('#cp-settings, #cp-settings-btn')) settings.classList.add('hidden');
    const card = document.getElementById('cp-card');
    if (!card.classList.contains('hidden') && !e.target.closest('#cp-card, .chat-item-link')) card.classList.add('hidden');
  });
  // brag card: preview first, then it goes into the normal attachment slot,
  // so you can still add a line before sending
  const brag = document.getElementById('cp-brag');
  document.getElementById('cp-brag-btn').addEventListener('click', openBrag);
  document.getElementById('cp-brag-again').addEventListener('click', openBrag);
  document.getElementById('cp-brag-close').addEventListener('click', () => brag.classList.add('hidden'));
  brag.addEventListener('click', e => { if (e.target === brag) brag.classList.add('hidden'); });
  document.getElementById('cp-brag-send').addEventListener('click', () => {
    if (!brag._file) return;
    setPendingAttachment(brag._file);
    brag.classList.add('hidden');
    input.focus();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { settings.classList.add('hidden'); document.getElementById('cp-card').classList.add('hidden'); brag.classList.add('hidden'); }
  });

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-err');
    const otp = document.getElementById('lf-otp');
    btn.disabled = true; err.textContent = '';
    const tokens = await oidc({
      grant_type: 'password',
      username: document.getElementById('lf-user').value.trim(),
      password: document.getElementById('lf-pass').value,
      scope: 'openid profile email',
      ...(otp.value.trim() ? { totp: otp.value.trim() } : {}),
    });
    btn.disabled = false;
    if (!tokens || tokens.error) {
      if (/otp|mfa|two.factor|authenticat|not fully set up/i.test(tokens?.desc || '') && otp.hidden) {
        otp.hidden = false; otp.focus();
        err.textContent = 'Enter your 2FA code and log in again.';
      } else err.textContent = 'Login failed — check your details.';
      return;
    }
    saveTokens(tokens.access, tokens.refresh);
    start();
  });

  // light/dark follows the game's setting, the colour theme too
  const stored = localStorage.getItem(LS_SCHEME);
  document.body.dataset.scheme = (stored ? stored === 'light' : matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  applyTheme(localStorage.getItem(LS_THEME) || 'flame');
}

async function start() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('cp').classList.remove('hidden');
  document.body.classList.toggle('v1chat', chatV1());
  let w;
  if (chatV1()) {
    const r = await v1Call('GET', '/me');
    const u = r.data?.user || r.data || {};
    w = { userHandle: u.username || u.handle, displayName: u.displayName || u.display_name, pfpUrl: u.pfpUrl || u.avatarUrl || u.avatar_url };
  } else w = await apiGet('/api/profile/whoami');
  if (!w?.userHandle) return;
  state.user = { username: w.userHandle, displayname: w.displayName || w.userHandle, pfpUrl: rnUrl(w.pfpUrl || '') };
  startChatPoll();
  loadInv();
  setInterval(renderSide, 60_000);    // "x minutes ago" keeps moving
  setInterval(loadInv, 5 * 60_000);
}

// ── "Sign in with remilia.net" (their login page, Authorization Code + PKCE) ─
// Needs the client id of our Login app from remilia.net's developer portal.
const RN_CLIENT_ID = 'tpa-beetleboysp';
const RN_AUTH_URL  = 'https://www.remilia.net/oidc/realms/remilia/protocol/openid-connect/auth';
const rnRedirect   = () => location.origin + location.pathname;
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function rnLogin() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const stateVal = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  sessionStorage.setItem('bb_pkce', JSON.stringify({ verifier, state: stateVal, diag: location.search.includes('diag') }));
  location.href = `${RN_AUTH_URL}?${new URLSearchParams({
    client_id: RN_CLIENT_ID, response_type: 'code', redirect_uri: rnRedirect(), scope: 'openid',
    state: stateVal, code_challenge: challenge, code_challenge_method: 'S256',
  })}`;
}

// back from remilia.net: swap the code for tokens. Returns true when logged in.
async function rnFinish() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return false;
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem('bb_pkce') || '{}'); } catch {}
  sessionStorage.removeItem('bb_pkce');
  history.replaceState(null, '', rnRedirect() + (saved.diag ? '?diag' : ''));
  const err = document.getElementById('login-err');
  if (!q.has('code') || q.get('state') !== saved.state || !saved.verifier) {
    err.textContent = q.get('error_description') || 'Sign-in was cancelled.';
    return false;
  }
  localStorage.setItem(LS_CLIENT, RN_CLIENT_ID);
  const t = await oidc({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: rnRedirect(), code_verifier: saved.verifier });
  if (!t?.access) { localStorage.removeItem(LS_CLIENT); err.textContent = 'Sign-in failed, please try again.'; return false; }
  saveTokens(t.access, t.refresh);
  return true;
}

// ?diag: which of remilia's endpoints take the current token (nothing gets posted)
async function runDiag() {
  const { access } = getTokens();
  const row = (name, ok, note = '') => `<tr><td>${ok ? '✅' : '❌'}</td><td>${esc(name)}</td><td>${esc(note)}</td></tr>`;
  const proxied = async path => {
    try {
      const r = await fetch(PROXY_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, token: access, method: 'GET', v: APP_VERSION }) });
      return [r.ok, `${r.status} ${(await r.text()).slice(0, 80)}`];
    } catch (e) { return [false, String(e)]; }
  };
  const v1 = async path => {
    try { const r = await fetch(`${BASE_URL}/api/v1${path}`, { headers: { Authorization: `Bearer ${access}` } }); return [r.ok, `${r.status} ${(await r.text()).slice(0, 80)}`]; }
    catch (e) { return [false, `${e} (CORS?)`]; }
  };
  const ws = async () => {
    try { const r = await fetch(CHAT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: access, action: 'ping' }) }); return [r.ok, `${r.status} ${(await r.text()).slice(0, 80)}`]; }
    catch (e) { return [false, String(e)]; }
  };
  const checks = [
    ['client', [true, localStorage.getItem(LS_CLIENT) || 'profile (password login)']],
    ['internal whoami', await proxied('/api/profile/whoami')],
    ['internal beetle/user', await proxied('/api/beetle/user')],
    ['internal chat read', await proxied('/api/chats/1/messages?limit=1')],
    ['chat websocket (send, react)', await ws()],
    ['API v1 /me', await v1('/me')],
    ['API v1 chat read', await v1('/global-chat/messages?limit=1')],
  ];
  document.body.innerHTML = `<div style="padding:16px;font:14px monospace;color:#fff;background:#222;min-height:100vh"><h1 style="font-size:18px">Token check</h1>
    <table>${checks.map(([n, [ok, note]]) => row(n, ok, note)).join('')}</table>
    <p style="margin-top:16px"><button type="button" id="diag-rn" style="padding:10px 14px;font:inherit">Check again with "Sign in on remilia.net"</button></p></div>`;
  document.getElementById('diag-rn').addEventListener('click', rnLogin);
}

document.addEventListener('DOMContentLoaded', async () => {
  setupPage();
  const rnBtn = document.getElementById('login-rn');
  if (RN_CLIENT_ID) { rnBtn.hidden = false; rnBtn.addEventListener('click', rnLogin); }
  const fresh = await rnFinish();
  if (location.search.includes('diag') && getTokens().access) return runDiag();
  if (fresh || getTokens().access) start(); else showLogin();
});
