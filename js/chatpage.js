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
    (DESCRIPTIONS[key] ? `<p>${esc(DESCRIPTIONS[key])}</p>` : '') + `</div>`;
  box.classList.remove('hidden');
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
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { settings.classList.add('hidden'); document.getElementById('cp-card').classList.add('hidden'); }
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
  const w = await apiGet('/api/profile/whoami');
  if (!w?.userHandle) return;
  state.user = { username: w.userHandle, displayname: w.displayName || w.userHandle, pfpUrl: rnUrl(w.pfpUrl || '') };
  startChatPoll();
  setInterval(renderSide, 60_000);    // "x minutes ago" keeps moving
}

document.addEventListener('DOMContentLoaded', () => {
  setupPage();
  if (getTokens().access) start(); else showLogin();
});
