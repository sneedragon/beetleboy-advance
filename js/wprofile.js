// Layer 777 · the little profile card. Tapping a cat or a name opens it: the
// remilia.net profile plus what they do here, and things you can do together.
const card = { u: '', p: null, prof: null };

async function openCard(u, d) {
  const el = document.getElementById('w-card');
  closePanels();
  card.u = u; card.p = null; card.prof = null;
  card.d = d || world.cats.get(u)?.d || u;
  el.classList.remove('hidden');
  renderCard();
  worldSend({ prof: u }, true);
  const p = rnAuth()
    ? await v1Call('GET', `/users/${encodeURIComponent(u)}`).then(r => r.ok ? r.data : null)
    : await apiGet(`/api/profile/~${encodeURIComponent(u)}`).catch(() => null);
  if (card.u !== u) return;
  card.p = p?.user ? p : { none: true };
  renderCard();
}
window.cardStats = prof => { if (prof.u === card.u) { card.prof = prof; renderCard(); } };
// names in the chat and in the side list open the card too
openProfile = (h, d) => openCard(h, d);

function renderCard() {
  const el = document.getElementById('w-card');
  if (el.classList.contains('hidden')) return;
  const u = card.u, user = card.p?.user, vc = card.p?.viewerContext || {}, pr = card.prof;
  const me = u === world.me, here = world.cats.has(u) && !world.cats.get(u).ghost;
  const n = v => (v ?? 0).toLocaleString();
  const name = user?.displayName || card.d;
  const stat = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  let friend = '';
  if (!me && user && !rnAuth()) {
    friend = vc.areFriends ? '<span class="w-pill">✓ Friends</span>'
      : vc.pendingRequestFrom ? '<button type="button" data-c="accept">Accept friend</button>'
      : vc.pendingRequestTo ? '<button type="button" data-c="cancel">Request sent ✕</button>'
      : '<button type="button" data-c="request">Add friend</button>';
  }
  el.querySelector('.w-box').innerHTML = `
    <header><h2>~${esc(u)}</h2><button type="button" data-c="close">✕</button></header>
    <div class="wc-top">
      <div class="wc-pics">
        ${user?.pfpUrl ? `<img class="wc-pfp" src="${esc(rnUrl(user.pfpUrl))}" alt="" onerror="this.style.visibility='hidden'">` : '<div class="wc-pfp"></div>'}
        <canvas class="wc-cat" width="64" height="64"></canvas>
      </div>
      <div class="wc-names">
        <strong>${esc(name)}</strong>
        <span class="w-dim">${here ? '● in the world now' : pr?.here ? '● around' : 'not in the world'}</span>
        ${user?.location ? `<span class="w-dim">📍 ${esc(user.location)}</span>` : ''}
      </div>
    </div>
    ${user?.bio ? `<p class="wc-bio">${esc(user.bio)}</p>` : card.p ? '' : '<p class="w-dim">Loading the profile…</p>'}
    <div class="wc-lcd">
      ${user ? stat(n(user.friendCount), 'friends') + stat(n(user.achievementsCount), 'achievements') : ''}
      ${pr && !pr.none ? stat(n(pr.bugs), 'beetles caught') + stat(n(pr.fish), 'fish') + stat(n(pr.items), 'things') + stat(n(pr.quests), 'quests') : pr?.none ? '<div><span>has not been to Layer 777 yet</span></div>' : ''}
    </div>
    ${me ? '<div class="wc-acts"><button type="button" data-c="bag">🎒 Open your bag</button></div>' : `
    <div class="wc-acts">
      ${window.dmOpen ? '<button type="button" data-c="dm" class="w-main">✉ Message</button>' : ''}
      <button type="button" data-c="wave">👋 Wave</button>
      <button type="button" data-c="hug" ${here ? '' : 'disabled'}>🤗 Hug</button>
      <button type="button" data-c="high5" ${here ? '' : 'disabled'}>🙌 High five</button>
      <button type="button" data-c="ball" ${here ? '' : 'disabled'}>☁ Cloudball</button>
      ${user && (rnAuth() || vc.canPoke !== false) ? '<button type="button" data-c="poke">👉 Poke</button>' : ''}
      ${friend}
    </div>
    <div class="wc-gift"><span>Give coins</span>${[5, 10, 25].map(v => `<button type="button" data-gift="${v}">◉ ${v}</button>`).join('')}</div>
    <div class="wc-acts wc-small">
      <button type="button" data-c="mention">~ Mention in chat</button>
      <a href="${BASE_URL}/~${encodeURIComponent(u)}" target="_blank" rel="noopener">remilia.net ↗</a>
    </div>`}
    <p class="wc-msg w-dim" aria-live="polite"></p>`;
  const cv = el.querySelector('.wc-cat'), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const c = world.cats.get(u);
  const z = world.z; world.z = 1;
  drawCatPreview(g, { u, d: name, w: (me ? world.wear : c?.w || pr?.wear) || {} });
  world.z = z;
}

async function cardAction(act, btn) {
  const u = card.u, msg = t => { const m = document.querySelector('#w-card .wc-msg'); if (m) m.textContent = t; };
  const shut = () => document.getElementById('w-card').classList.add('hidden');
  if (act === 'close') return shut();
  if (act === 'bag') return openBag();
  if (act === 'dm') { shut(); return window.dmOpen?.(u, card.d); }
  if (act === 'mention') {
    shut();
    const i = document.getElementById('chat-input');
    i.value = `${i.value}${i.value && !i.value.endsWith(' ') ? ' ' : ''}~${u} `; i.focus();
    return;
  }
  if (act === 'wave') {
    const me = world.cats.get(world.me);
    if (me) me.emote = { k: 'wave', at: performance.now() / 1000 };
    worldSend({ emote: 'wave' }, true);
    return shut();
  }
  if (act === 'hug' || act === 'high5') { shut(); return touch(u, act); }
  if (act === 'ball') {
    const c = world.cats.get(u);
    shut();
    if (!c) return;
    world.aim = 'toss'; useToy(c.x, c.y - 20); world.aim = null;
    return;
  }
  btn.disabled = true;
  let r;
  if (act === 'poke') {
    r = rnAuth() ? await v1Call('POST', `/users/${encodeURIComponent(u)}/poke`) : await apiPost(`/api/users/${encodeURIComponent(u)}/poke`);
    const ok = rnAuth() ? r.ok : r && r.success !== false && !r.error;
    if (!ok) return msg(r?.status === 429 || /cooldown/i.test(JSON.stringify(r?.error || r?.data || '')) ? 'You poked them recently.' : 'That did not work, try again later.');
    sfx('react');
    return msg(`You poked ~${u} 👉`);
  }
  const calls = {
    request: () => apiPost('/api/friendship/request', { username: u }),
    accept:  () => apiPost('/api/friendship/accept', { username: u }),
    cancel:  () => apiPost('/api/friendship/cancel', { username: u, isFriend: false }),
  };
  if (!calls[act]) return;
  r = await calls[act]();
  if (!r || r.success === false || r.error) { btn.disabled = false; return msg('That did not work, try again later.'); }
  sfx('claim');
  const fresh = await apiGet(`/api/profile/~${encodeURIComponent(u)}`).catch(() => null);
  if (fresh?.user && card.u === u) { card.p = fresh; renderCard(); }
  msg({ request: 'Friend request sent.', accept: `You and ~${u} are friends now.`, cancel: 'Request taken back.' }[act]);
}

document.getElementById('w-card').addEventListener('click', e => {
  if (e.target.id === 'w-card') return e.target.classList.add('hidden');
  const g = e.target.closest('[data-gift]');
  if (g) { gift(card.u, +g.dataset.gift); return; }
  const b = e.target.closest('[data-c]');
  if (b) cardAction(b.dataset.c, b);
});
