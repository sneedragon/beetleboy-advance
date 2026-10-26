// BeetleBoy SP · Direct messages in the world (dm.php keeps them a day).
// Each browser has its own key pair (ECDH P-256); a message is sealed with
// AES-GCM under a key both ends work out from their two keys, so the server
// only ever holds ciphertext. The private key stays in this browser.

const DM_INFO = new TextEncoder().encode('bb-dm-v1');
const dmState = {
  me: '', key: null, pub: '', serverKey: null, msgs: new Map(), since: 0, theirs: new Map(), shared: new Map(),
  open: null, names: new Map(), read: {}, timer: 0, busy: null, warned: false,
};

const dmB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const dmUnB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const dmLs = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };

async function dmPost(body) {
  const { access } = getTokens();
  if (!access) return null;
  try {
    const r = await fetch('dm.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: access, ...body }) });
    const d = await r.json().catch(() => null);
    if (!r.ok) { if (d?.error && r.status !== 401) worldToast(d.error); return null; }
    return d;
  } catch { return null; }
}

// this browser's key pair for this account, made on first use
async function dmKeys() {
  const k = `bb_dm_k_${dmState.me}`;
  try {
    const saved = JSON.parse(dmLs(k) || 'null');
    if (saved?.priv && saved.pub) {
      dmState.key = await crypto.subtle.importKey('jwk', saved.priv, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
      dmState.pub = saved.pub;
      return;
    }
  } catch {}
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  dmState.key = pair.privateKey;
  dmState.pub = dmB64(await crypto.subtle.exportKey('raw', pair.publicKey));
  dmLs(k, JSON.stringify({ priv: await crypto.subtle.exportKey('jwk', pair.privateKey), pub: dmState.pub }));
}

// the AES key shared with whoever holds `other`
async function dmShared(other) {
  if (dmState.shared.has(other)) return dmState.shared.get(other);
  const p = (async () => {
    const pub = await crypto.subtle.importKey('raw', dmUnB64(other), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, dmState.key, 256);
    const hk = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: DM_INFO }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  })();
  dmState.shared.set(other, p);
  return p;
}

async function dmOpenRow(r) {
  const mineIsA = r.a === dmState.me;
  const myKey = mineIsA ? r.ka : r.kb, other = mineIsA ? r.kb : r.ka;
  const m = { id: r.id, a: r.a, b: r.b, t: r.t, with: mineIsA ? r.b : r.a, text: null, note: '' };
  if (myKey !== dmState.pub) { m.note = mineIsA ? 'sent from another browser' : 'sent to another browser'; return m; }
  try {
    const key = await dmShared(other);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dmUnB64(r.iv), additionalData: new TextEncoder().encode(`${r.a}>${r.b}`) }, key, dmUnB64(r.ct));
    m.text = String(JSON.parse(new TextDecoder().decode(pt)).m || '');
  } catch { m.note = 'could not be opened'; }
  return m;
}

// a full refresh drops what was deleted; otherwise only what is new comes
async function dmLoad(full = false, d = null) {
  d ??= await dmPost({ act: 'inbox', since: full ? 0 : dmState.since });
  if (!d?.msgs) return;
  dmState.serverKey = d.key;
  const fresh = [];
  if (full) for (const id of dmState.msgs.keys()) if (!d.msgs.some(r => r.id === id)) dmState.msgs.delete(id);
  for (const r of d.msgs) {
    if (!dmState.msgs.has(r.id)) { const m = await dmOpenRow(r); dmState.msgs.set(r.id, m); if (r.b === dmState.me) fresh.push(m); }
    dmState.since = Math.max(dmState.since, r.id);
  }
  if (d.oldest) for (const id of dmState.msgs.keys()) if (id < d.oldest) dmState.msgs.delete(id);
  const quiet = !dmState.loaded;
  dmState.loaded = true;
  if (!quiet) for (const m of fresh) {
    if (muted.has(m.a) || dmState.open === m.a) continue;
    worldToast(`✉ ${dmName(m.a)}: ${m.text ? m.text.slice(0, 60) : 'a new message'}`, 4000);
    sfx('click');
  }
  dmRender();
}

const dmName = u => world.cats.get(u)?.d || dmState.names.get(u) || u;
const dmUnread = u => [...dmState.msgs.values()].some(m => m.a === u && m.b === dmState.me && m.id > (dmState.read[u] || 0));

function dmBadge() {
  const n = new Set([...dmState.msgs.values()].filter(m => m.b === dmState.me && !muted.has(m.a) && m.id > (dmState.read[m.a] || 0)).map(m => m.a)).size;
  const el = document.getElementById('cp-dm-badge');
  el.textContent = n || ''; el.classList.toggle('hidden', !n);
}

function dmMarkRead(u) {
  const last = Math.max(0, ...[...dmState.msgs.values()].filter(m => m.with === u).map(m => m.id));
  if (last <= (dmState.read[u] || 0)) return;
  dmState.read[u] = last;
  dmLs(`bb_dm_read_${dmState.me}`, JSON.stringify(dmState.read));
}

const dmTime = t => { const d = new Date(t * 1000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function dmRender() {
  dmBadge();
  const box = document.getElementById('w-dm');
  if (box.classList.contains('hidden')) return;
  const body = document.getElementById('dm-body');
  const elsewhere = dmState.serverKey && dmState.serverKey !== dmState.pub;
  const banner = elsewhere ? '<div class="dm-banner">Your messages go to another browser right now. <button type="button" data-dm="claim">Use this browser for messages</button></div>' : '';
  const u = dmState.open;
  document.getElementById('dm-back').classList.toggle('hidden', !u);
  document.getElementById('dm-input-row').classList.toggle('hidden', !u || elsewhere);
  document.getElementById('dm-title').textContent = u ? dmName(u) : 'Messages';
  if (!u) {
    const last = new Map();
    for (const m of dmState.msgs.values()) if (!muted.has(m.with) && (!last.has(m.with) || m.id > last.get(m.with).id)) last.set(m.with, m);
    const rows = [...last.values()].sort((a, b) => b.id - a.id).map(m =>
      `<button type="button" class="dm-conv${dmUnread(m.with) ? ' new' : ''}" data-dm-open="${esc(m.with)}"><strong>${esc(dmName(m.with))}</strong><span>${esc(m.text ?? m.note)}</span><time>${dmTime(m.t)}</time></button>`).join('');
    body.innerHTML = `${banner}${rows || '<p class="w-dim">No messages yet. Tap someone\'s cat in the world to write to them.</p>'}
      <p class="dm-foot">Messages are encrypted in your browser and disappear 24 hours after they were sent.</p>`;
    return;
  }
  const thread = [...dmState.msgs.values()].filter(m => m.with === u).sort((a, b) => a.id - b.id);
  body.innerHTML = `${banner}<p class="dm-safety" id="dm-safety"></p>${thread.map(m =>
    `<div class="dm-msg${m.a === dmState.me ? ' mine' : ''}${m.text == null ? ' sealed' : ''}"><span>${m.text != null ? esc(m.text) : '🔒 ' + esc(m.note)}</span><time>${dmTime(m.t)}</time></div>`).join('') || '<p class="w-dim">Say hello. Only the two of you can read this.</p>'}
    <button type="button" class="w-quiet" data-dm="clear">Delete this conversation for both of you</button>`;
  body.scrollTop = body.scrollHeight;
  dmMarkRead(u);
  dmBadge();
  dmSafety(u);
}

// both people see the same numbers if nobody swapped a key in between
async function dmSafety(u) {
  const theirs = await dmTheirKey(u);
  const el = document.getElementById('dm-safety');
  if (!el || dmState.open !== u) return;
  if (!theirs) { el.textContent = `${dmName(u)} has not opened Layer 777 yet, so they cannot get messages.`; return; }
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode([dmState.pub, theirs].sort().join('|'))));
  const code = [0, 1, 2, 3].map(i => String(((h[i * 3] << 16) | (h[i * 3 + 1] << 8) | h[i * 3 + 2]) % 100000).padStart(5, '0')).join(' ');
  el.textContent = `Safety code ${code}. If ${dmName(u)} sees the same, nobody is listening in.`;
}

async function dmTheirKey(u, fresh = false) {
  if (!fresh && dmState.theirs.has(u)) return dmState.theirs.get(u);
  const d = await dmPost({ act: 'pub', u });
  if (!d) return null;
  dmState.theirs.set(u, d.pub);
  return d.pub;
}

async function dmSend() {
  const input = document.getElementById('dm-input'), text = input.value.trim(), to = dmState.open;
  if (!text || !to || dmState.sending) return;
  dmState.sending = true;
  try {
    for (let tries = 0; tries < 2; tries++) {
      const theirs = await dmTheirKey(to, tries > 0);
      if (!theirs) { if (!tries) continue; worldToast(`${dmName(to)} has to open Layer 777 once before they can get messages.`, 4500); return; }
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`${dmState.me}>${to}`) }, await dmShared(theirs), new TextEncoder().encode(JSON.stringify({ m: text })));
      const d = await dmPost({ act: 'send', to, ka: dmState.pub, kb: theirs, iv: dmB64(iv), ct: dmB64(ct), since: dmState.since });
      if (!d) return;
      if (d.stale) {
        if (d.mine !== dmState.pub) { dmState.serverKey = d.mine; dmRender(); return; }
        continue;                            // they have a new browser: seal it again for that one
      }
      input.value = '';
      await dmLoad(false, d);
      return;
    }
  } finally { dmState.sending = false; }
}

function dmShow(u = null) {
  dmState.open = u;
  document.getElementById('w-dm').classList.remove('hidden');
  dmRender();
  if (u) document.getElementById('dm-input').focus({ preventScroll: true });
}

window.dmOpen = (u, d) => { if (d) dmState.names.set(u, d); dmShow(u); };
window.dmPoke = maxId => { if (maxId > dmState.since && dmState.key) dmLoad(); };
window.dmStart = async () => {
  if (!window.crypto?.subtle) { window.dmOpen = null; document.getElementById('cp-dm-btn').hidden = true; return; }
  dmState.me = state.user.username;
  try { dmState.read = JSON.parse(dmLs(`bb_dm_read_${dmState.me}`) || '{}') || {}; } catch {}
  await dmKeys();
  let d = await dmPost({ act: 'hello' });
  // the first browser to open the world gets the messages; a later one asks first
  if (d && !d.key) d = await dmPost({ act: 'setkey', pub: dmState.pub });
  await dmLoad(true, d);
  dmState.timer = setInterval(() => !document.hidden && dmLoad(true), 60_000);
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cp-dm-btn').addEventListener('click', () => {
    const box = document.getElementById('w-dm');
    if (box.classList.contains('hidden')) dmShow(null); else box.classList.add('hidden');
  });
  document.getElementById('dm-close').addEventListener('click', () => { document.getElementById('w-dm').classList.add('hidden'); dmState.open = null; });
  document.getElementById('dm-back').addEventListener('click', () => dmShow(null));
  document.getElementById('dm-send').addEventListener('click', dmSend);
  document.getElementById('dm-input').addEventListener('keydown', e => { if (e.key === 'Enter') dmSend(); });
  document.getElementById('dm-body').addEventListener('click', async e => {
    const open = e.target.closest('[data-dm-open]')?.dataset.dmOpen;
    if (open) return dmShow(open);
    const act = e.target.closest('[data-dm]')?.dataset.dm;
    if (act === 'claim') { const d = await dmPost({ act: 'setkey', pub: dmState.pub }); if (d) { dmState.theirs.clear(); await dmLoad(true, d); } }
    if (act === 'clear' && dmState.open) {
      const b = e.target.closest('button'), u = dmState.open;
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Tap again to delete it for both of you'; return; }
      if (await dmPost({ act: 'clear', with: u })) { for (const [id, m] of dmState.msgs) if (m.with === u) dmState.msgs.delete(id); dmShow(null); }
    }
  });
});
