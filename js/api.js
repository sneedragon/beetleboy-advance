// BeetleBoy SP · Login tokens, RemiliaNET API calls, game state, the log, timers and notifications.
// Classic script sharing globals with the others; load order is set in index.html.

// ── AUTH ──────────────────────────────────────────────────────────────────────
const getTokens  = ()         => ({ access: localStorage.getItem(LS_ACCESS), refresh: localStorage.getItem(LS_REFRESH) });
const saveTokens = (a, r)     => { if (a) localStorage.setItem(LS_ACCESS, a); if (r) localStorage.setItem(LS_REFRESH, r); };
const clearAuth  = ()         => { localStorage.removeItem(LS_ACCESS); localStorage.removeItem(LS_REFRESH); };

async function oidc(params) {
  try {
    const r = await fetch(OIDC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: 'profile', ...params }),
    });
    const d = await r.json();
    if (!r.ok) return { error: d.error, desc: d.error_description || '' };
    return d.access_token ? { access: d.access_token, refresh: d.refresh_token } : null;
  } catch { return null; }
}

// One refresh at a time. Refresh tokens are single-use, so parallel requests
// (chat poll, state refresh, push sync, other tabs) must not each try their
// own: the losers would get invalid_grant and log the user out.
let refreshing = null;
function tryRefresh(staleAccess = null) {
  return refreshing ||= (async () => {
    const before = getTokens();
    // another request or tab already refreshed: use its tokens
    if (staleAccess && before.access && before.access !== staleAccess) return before;
    if (!before.refresh) return null;
    const r = await oidc({ grant_type: 'refresh_token', refresh_token: before.refresh });
    if (r?.access) { saveTokens(r.access, r.refresh); return r; }
    const now = getTokens();
    if (now.refresh && now.refresh !== before.refresh) return now;   // another tab won the race
    if (r?.error === 'invalid_grant') return { expired: true };       // really logged out
    return null;                                                      // network trouble: keep the login
  })().finally(() => { refreshing = null; });
}

// ── API ───────────────────────────────────────────────────────────────────────
// seconds-since-epoch expiry of a JWT access token (0 if unreadable)
function jwtExp(tok) {
  try { return JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp || 0; } catch { return 0; }
}

async function apiCall(method, path, body = null, _retry = true) {
  let { access } = getTokens();
  if (!access) { showLogin(); return null; }
  // renew a little before it runs out instead of letting every request hit a 401
  if (jwtExp(access) && jwtExp(access) * 1000 - Date.now() < 45000) {
    const t = await tryRefresh(access);
    if (t?.access) access = t.access;
  }
  let r;
  try {
    if (USE_PROXY) {
      r = await fetch(PROXY_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, path, body, token: access, v: APP_VERSION }),
      });
    } else {
      const opts = { method, headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${access}` } };
      if (body !== null) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
      r = await fetch(`${BASE_URL}${path}`, opts);
    }
  } catch (e) { log(`Network error: ${e.message}`, 'err'); return null; }

  if (r.status === 401 && _retry) {
    const tokens = await tryRefresh(access);
    if (tokens?.access) return apiCall(method, path, body, false);
    if (tokens?.expired) showLogin();
    else log('Connection trouble, retrying soon…', 'warn');
    return null;
  }
  if (r.status === 429) {
    if (Date.now() - lastRateLimitLog > 5000) {
      lastRateLimitLog = Date.now();
      log('You are beetle-gaming too hard. Slow down! 🪲💨', 'warn');
    }
    return null;
  }
  if (!r.ok) {
    try { const d = await r.json(); return { success: false, ...d }; }
    catch { return { success: false, message: `HTTP ${r.status}` }; }
  }
  return r.json().catch(() => null);
}

const apiGet  = path        => apiCall('GET',  path);
const apiPost = (path, body) => apiCall('POST', path, body ?? {});

// ── STATE ─────────────────────────────────────────────────────────────────────
let state = {
  user: null, inv: {},
  fetchedAt: 0,
  storedCds: { catchBeetle: null, beetleHunt: null, claimUBC: null, junkFaucet: null },
};
let refreshTimer = null, tickTimer = null;
let prevCdStates = {};
let lastRateLimitLog = 0;

async function loadState(silent = false) {
  const user = await apiGet('/api/beetle/user');
  if (!user) return;
  if (!state.me) {
    const w = await apiGet('/api/profile/whoami');
    if (w?.userHandle) state.me = { username: w.userHandle, displayname: w.displayName || w.userHandle, pfpUrl: rnUrl(w.pfpUrl || '') };
  }
  state.user    = { ...user, ...(state.me || {}) };
  schedulePushSync();
  renderStreak();
  if (!document.getElementById('mode-next')?.classList.contains('hidden')) renderAdvisor();
  state.inv     = user.inventory || {};
  state.hammers = user.hammers   || [];
  // Preserve locally-tracked cooldowns when the API doesn't return them
  const elapsed = Date.now() - state.fetchedAt;
  const prev    = state.storedCds;
  state.fetchedAt = Date.now();
  const keep = k => prev[k] !== null ? Math.max(0, prev[k] - elapsed) : null;
  state.storedCds = {
    catchBeetle: user.cooldowns?.catchBeetle ?? keep('catchBeetle'),
    beetleHunt:  user.cooldowns?.beetleHunt  ?? keep('beetleHunt'),
    claimUBC:    user.cooldowns?.claimUBC    ?? keep('claimUBC'),
    junkFaucet:  user.cooldowns?.junkFaucet  ?? keep('junkFaucet'),
  };
  if (!silent) renderAll();
}

function currentCds() {
  const elapsed = Date.now() - state.fetchedAt;
  const r = {};
  for (const [k, v] of Object.entries(state.storedCds))
    r[k] = v === null ? null : Math.max(0, v - elapsed);
  return r;
}

// ── LOG ───────────────────────────────────────────────────────────────────────
function log(msg, cls = '') {
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} `;
  logMessages.unshift({ msg, cls, ts });
  if (logMessages.length > 16) logMessages.length = 16;
  if (screenMode === SCREEN.ITEM) setScreenMode(SCREEN.LOG);
  renderLog();
}

function renderLog() {
  const el = document.getElementById('act-log');
  if (!el) return;
  el.innerHTML = '';
  for (const { msg, cls, ts } of logMessages) {
    const line = document.createElement('div');
    line.className = 'log-line';
    const tsEl = document.createElement('span');
    tsEl.className = 'log-ts';
    tsEl.textContent = ts || '';
    line.appendChild(tsEl);
    const msgEl = document.createElement('span');
    if (cls) msgEl.className = `log-${cls}`;
    msgEl.textContent = msg;
    line.appendChild(msgEl);
    const shareBtn = document.createElement('button');
    shareBtn.className = 'log-share';
    shareBtn.textContent = 'SHARE';
    shareBtn.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      input.value = msg;
      sendChatMsg();
    });
    line.appendChild(shareBtn);
    el.appendChild(line);
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderAll() {
  tick();
  renderHeader();
  renderInventory();
  renderBeetledex();
  renderTrophies();
  renderCraftable();
  renderHammerQuick();
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default')
    Notification.requestPermission();
}
function notify(body, tag) {
  sfx('ready');
  if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then(r => r.showNotification('BeetleBoy SP', { body, tag: tag || body, icon: 'icons/beetles/green.png' }));
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification('BeetleBoy SP', { body, icon: 'icons/beetles/green.png' });
}

const HUNT_COST = 20, HUNTS_PER_WINDOW = 3, HUNT_BREAK_MS = 90 * 60 * 1000;

function huntStatus() {
  const u = state.user || {};
  const used = u.beetleHuntsUsed || 0;
  if (used >= HUNTS_PER_WINDOW && u.lastBeetleHuntDate) {
    const cooldown = u.lastBeetleHuntDate + HUNT_BREAK_MS - Date.now();
    if (cooldown > 0) return { left: 0, cooldown };
    return { left: HUNTS_PER_WINDOW, cooldown: 0 };   // break is over, counter resets
  }
  return { left: HUNTS_PER_WINDOW - used, cooldown: 0 };
}

function tick() {
  const cds = currentCds();
  const map = [
    ['cd-claim',  'act-claim',  'catchBeetle', 'Claim Beetle'],
    ['cd-hunt',   'act-hunt',   'beetleHunt',  'Hunt Beetle'],
    ['cd-ubc',    'act-ubc',    'claimUBC',    'Claim UBC'],
    ['cd-faucet', 'act-faucet', 'junkFaucet',  'Junk Faucet'],
  ];
  for (const [cdId, btnId, key, label] of map) {
    const cdEl = document.getElementById(cdId);
    if (key === 'beetleHunt') {
      // Same rules as remilia.net: 3 hunts, then a 90 min break after the
      // last one; every hunt costs 20 cheese.
      const { left, cooldown } = huntStatus();
      const cheese = state.inv.cheese || 0;
      if (cooldown > 0) {
        const { text, cls } = fmtMs(cooldown);
        cdEl.textContent = text;
        cdEl.className = `btn-cd ${cls}`;
      } else if (cheese < HUNT_COST) {
        cdEl.innerHTML = `<span class="hunt-null-hint">Need ${HUNT_COST} 🧀</span>`;
        cdEl.className = 'btn-cd';
      } else {
        cdEl.textContent = `${left}/${HUNTS_PER_WINDOW} · ${HUNT_COST} 🧀`;
        cdEl.className = 'btn-cd ready';
      }
      const ready = cooldown === 0 && cheese >= HUNT_COST;
      document.getElementById(btnId).classList.toggle('is-ready', ready);
      if (prevCdStates[key] === false && ready) notify('Hunt Beetle is ready!', key);
      prevCdStates[key] = ready;
      continue;
    } else {
      const { text, cls } = fmtMs(cds[key]);
      cdEl.textContent = text;
      cdEl.className = `btn-cd ${cls}`;
    }
    document.getElementById(btnId).classList.toggle('is-ready', cds[key] === 0);
    if (prevCdStates[key] > 0 && cds[key] === 0) notify(`${label} is ready!`, key);
    prevCdStates[key] = cds[key];
  }
}

function renderHeader() {
  const u = state.user;
  if (!u) return;
  document.getElementById('header-user').textContent = u.username || '—';
  const cheese = state.inv.cheese || 0;
  document.getElementById('screen-cheese').textContent = cheese ? `🧀 ${cheese.toLocaleString()}` : '';
  const lvlEl = document.getElementById('screen-level');
  if (lvlEl && u.level != null) {
    const p = trackXp(u);
    const bar = p.progress != null ? `<span class="lvl-bar" title="${Math.round(p.progress * 100)}% to level ${u.level + 1}"><i style="width:${(p.progress * 100).toFixed(1)}%"></i></span>` : '';
    lvlEl.innerHTML = `LVL ${u.level}${bar}<span class="lvl-xp">${p.text}</span>`;
    lvlEl.title = `${(u.xp || 0).toLocaleString()} XP` + (p.perDay ? ` · about ${Math.round(p.perDay).toLocaleString()} XP per day this week` : '');
  }
}

// XP pace and level progress, learned from what this browser has seen
// (RemiliaNET doesn't publish the XP curve). A level's start is known once
// we see the level change; the bar shows when both ends are known.
const LS_XP_LOG = 'bb_xp_log', LS_LVL_XP = 'bb_lvl_xp';
function trackXp(u) {
  const now = Date.now(), xp = u.xp || 0, lvl = u.level;
  let log = [], marks = {};
  try { log = JSON.parse(localStorage.getItem(LS_XP_LOG) || '[]'); marks = JSON.parse(localStorage.getItem(LS_LVL_XP) || '{}'); } catch {}
  const last = log[log.length - 1];
  if (last && lvl > last[2] && !marks[lvl]) marks[lvl] = xp;            // just levelled up: this is (about) where it starts
  if (!last || now - last[0] > 10 * 60 * 1000 || xp !== last[1]) {
    log.push([now, xp, lvl]);
    log = log.filter(e => now - e[0] < 30 * 86400000).slice(-3000);
  }
  try { localStorage.setItem(LS_XP_LOG, JSON.stringify(log)); localStorage.setItem(LS_LVL_XP, JSON.stringify(marks)); } catch {}
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const firstToday = log.find(e => e[0] >= midnight.getTime());
  const today = firstToday ? xp - firstToday[1] : 0;
  const weekAgo = log.find(e => now - e[0] < 7 * 86400000);
  const days = weekAgo ? (now - weekAgo[0]) / 86400000 : 0;
  const perDay = days >= 1 ? (xp - weekAgo[1]) / days : null;
  const lo = marks[lvl], hi = marks[lvl + 1];
  const progress = lo != null && hi != null && hi > lo ? Math.min(1, Math.max(0, (xp - lo) / (hi - lo))) : null;
  const k = n => n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString();
  return { progress, perDay, text: today > 0 ? ` +${k(today)} XP today` : '' };
}

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────────
// Opt-in: the server learns only when your timers end and pushes a
// notification then, even when BeetleBoy is closed.
const LS_PUSH = 'bb_push';
let pushSub = null, lastPushSync = '', pushSyncTimer = null;

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64ToBytes = b64 => {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64.length % 4) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

async function enablePush() {
  if (!pushSupported()) { log('This browser can\'t do background notifications.', 'warn'); return false; }
  if (await Notification.requestPermission() !== 'granted') { log('Notifications are blocked for this site.', 'warn'); return false; }
  const reg = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
  const { publicKey } = await fetch('push.php?key').then(r => r.json());
  pushSub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  try { localStorage.setItem(LS_PUSH, '1'); } catch {}
  lastPushSync = '';
  await syncPushTimers();
  log('🔔 You\'ll get a notification when a timer is ready, even with BeetleBoy closed.');
  return true;
}

async function disablePush() {
  try { localStorage.setItem(LS_PUSH, '0'); } catch {}
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = pushSub || await reg?.pushManager.getSubscription();
  if (sub) {
    fetch('push.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  pushSub = null;
}

// Restore an existing subscription on load
async function initPush() {
  let on = false;
  try { on = localStorage.getItem(LS_PUSH) === '1'; } catch {}
  if (!on || !pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.register('sw.js');
  pushSub = await reg.pushManager.getSubscription();
  if (!pushSub) return false;
  syncPushTimers();
  return true;
}

// Tell the server when each running timer ends (only when that changed)
async function syncPushTimers() {
  if (!pushSub || !state.user) return;
  const cds = currentCds(), now = Date.now();
  const timers = [];
  const add = (id, label, ms) => { if (ms > 0) timers.push({ id, label, at: Math.round((now + ms) / 15000) * 15000 }); };
  add('catchBeetle', 'Claim Beetle', cds.catchBeetle);
  add('claimUBC', 'Claim UBC', cds.claimUBC);
  add('junkFaucet', 'Junk Faucet', cds.junkFaucet);
  add('beetleHunt', 'Hunt Beetle', huntStatus().cooldown);
  const key = JSON.stringify(timers);
  if (key === lastPushSync) return;
  lastPushSync = key;
  try {
    await fetch('push.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync', subscription: pushSub.toJSON(), timers }) });
  } catch { lastPushSync = ''; }
}
const schedulePushSync = () => { clearTimeout(pushSyncTimer); pushSyncTimer = setTimeout(syncPushTimers, 1500); };
