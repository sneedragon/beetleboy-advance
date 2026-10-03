// BeetleBoy SP · Mini profiles: click a name in chat to see the basics,
// poke or send a friend request.
// Classic script sharing globals with the others; load order is set in index.html.

// ── MINI PROFILE ──────────────────────────────────────────────────────────────
function profileModal() {
  let m = document.getElementById('profile-modal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'profile-modal';
  m.innerHTML = '<div class="pf-box" role="dialog" aria-modal="true" aria-label="Profile"><button type="button" class="tree-btn pf-close" aria-label="Close">✕</button><div class="pf-body"></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('.pf-close')) closeProfile(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('open')) closeProfile(); });
  return m;
}
const closeProfile = () => document.getElementById('profile-modal')?.classList.remove('open');

async function openProfile(handle) {
  const m = profileModal();
  const body = m.querySelector('.pf-body');
  body.innerHTML = `<div class="pf-loading">Loading ~${esc(handle)}…</div>`;
  m.classList.add('open');
  sfx('panel');
  const p = await apiGet(`/api/profile/~${encodeURIComponent(handle)}`);
  if (!p?.user) { body.innerHTML = `<div class="pf-loading">Couldn't load ~${esc(handle)}.</div>`; return; }
  renderProfile(p);
}

function renderProfile(p) {
  const body = document.querySelector('#profile-modal .pf-body');
  const u = p.user, vc = p.viewerContext || {};
  const hue = u.color ?? nameHue(u.displayName || u.username);
  const n = v => (v ?? 0).toLocaleString();
  const days = s => s >= 3600 ? `${Math.ceil(s / 3600)}h` : `${Math.ceil(s / 60)}m`;
  let friendBtn = '';
  if (!p.isOwnProfile) {
    if (vc.areFriends) friendBtn = '<span class="pf-state">✓ Friends</span>';
    else if (vc.pendingRequestFrom) friendBtn = '<button type="button" class="pf-act" data-act="accept">Accept friend request</button>';
    else if (vc.pendingRequestTo) friendBtn = '<button type="button" class="pf-act ghost" data-act="cancel">Request sent · cancel</button>';
    else friendBtn = '<button type="button" class="pf-act" data-act="request">Add friend</button>';
  }
  const pokeBtn = p.isOwnProfile ? '' : (vc.canPoke
    ? '<button type="button" class="pf-act" data-act="poke">👉 Poke</button>'
    : `<span class="pf-state">Poked · again in ${days(vc.pokeCooldownSeconds || 0)}</span>`);
  body.innerHTML = `
    <div class="pf-head" style="--pf-h:${hue}">
      ${u.pfpUrl ? `<img class="pf-pfp" src="${esc(rnUrl(u.pfpUrl))}" alt="">` : '<div class="pf-pfp"></div>'}
      <div class="pf-names"><div class="pf-dn">${esc(u.displayName || u.username)}</div><div class="pf-handle">~${esc(u.username)}</div>
        ${u.location ? `<div class="pf-loc">📍 ${esc(u.location)}</div>` : ''}</div>
    </div>
    ${u.bio ? `<div class="pf-bio">${esc(u.bio)}</div>` : ''}
    <div class="pf-stats">
      <div><b>${n(u.beetles)}</b><span>beetles</span></div>
      <div><b>${n(u.friendCount)}</b><span>friends</span></div>
      <div><b>${n(u.pokes)}</b><span>pokes</span></div>
      <div><b>${n(u.achievementsCount)}</b><span>achievements</span></div>
    </div>
    ${vc.mutualCount ? `<div class="pf-mutual">${n(vc.mutualCount)} mutual friend${vc.mutualCount > 1 ? 's' : ''}</div>` : ''}
    <div class="pf-actions">${pokeBtn}${friendBtn}</div>
    <div class="pf-msg" aria-live="polite"></div>
    <a class="pf-link" href="${BASE_URL}/~${encodeURIComponent(u.username)}" target="_blank" rel="noopener">Open full profile on remilia.net ↗</a>`;
  body.querySelectorAll('.pf-act').forEach(b => b.addEventListener('click', () => profileAction(p, b.dataset.act, b)));
}

async function profileAction(p, act, btn) {
  const handle = p.user.username;
  const msg = document.querySelector('#profile-modal .pf-msg');
  btn.disabled = true;
  const calls = {
    poke:    () => apiPost(`/api/users/${encodeURIComponent(handle)}/poke`),
    request: () => apiPost('/api/friendship/request', { username: handle }),
    accept:  () => apiPost('/api/friendship/accept', { username: handle }),
    cancel:  () => apiPost('/api/friendship/cancel', { username: handle, isFriend: false }),
  };
  const r = await calls[act]();
  if (!r || r.success === false || r.error) {
    btn.disabled = false;
    sfx('fail');
    msg.textContent = r?.error?.message || r?.error || r?.message || 'That didn\'t work, try again later.';
    return;
  }
  sfx(act === 'poke' ? 'react' : 'craft');
  msg.textContent = { poke: `You poked ~${handle}.`, request: 'Friend request sent.', accept: `You and ~${handle} are friends now.`, cancel: 'Friend request cancelled.' }[act];
  const fresh = await apiGet(`/api/profile/~${encodeURIComponent(handle)}`);   // show the new state
  if (fresh?.user) { renderProfile(fresh); document.querySelector('#profile-modal .pf-msg').textContent = msg.textContent; }
}
