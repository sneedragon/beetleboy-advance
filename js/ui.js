// BeetleBoy SP · Login screen, beetledex, side panels and mode switching.
// Classic script sharing globals with the others; load order is set in index.html.

// ── LOGIN / LOGOUT ────────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
  clearAuth();
}
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  requestNotifPermission();
}

// ── BEETLEDEX ─────────────────────────────────────────────────────────────────
function renderBeetledex() {
  const inv = state.inv;
  const owned = BEETLES.filter(k => (inv[k] || 0) > 0);
  const tiers = [
    { key:'tin', label:'Tin',         color:'var(--tin)' },
    { key:'brz', label:'Bronze',      color:'var(--brz)' },
    { key:'mth', label:'Mithril',     color:'var(--mth)' },
    { key:'adm', label:'Adamantine',  color:'var(--adm)' },
    { key:'dia', label:'Diamond',     color:'var(--dia)' },
    { key:null,  label:'Unknown',     color:'var(--dim)' },
  ];
  let html = `<div class="dex-header">${owned.length}<span class="dex-total"> / ${BEETLES.length} collected</span></div>`;
  for (const tier of tiers) {
    const beetles = BEETLES.filter(k => (RARITY[k] || null) === tier.key);
    if (!beetles.length) continue;
    const ownedCount = beetles.filter(k => (inv[k] || 0) > 0).length;
    html += `<div class="dex-tier-header" style="color:${tier.color}">${tier.label} <span class="dex-tier-count">${ownedCount}/${beetles.length}</span></div>`;
    html += '<div class="dex-grid">';
    for (const k of beetles) {
      const have   = (inv[k] || 0) > 0;
      const qty    = inv[k] || 0;
      const scene  = getSceneSmall(k);
      const icon   = smallImg(IMAGES[`_card_${k}`]) || IMAGES[k];
      const bgStyle = scene ? `background-image:url('${scene}');background-size:cover;background-position:center` : '';
      html += `<div class="dex-card ${have ? 'dex-have' : 'dex-missing'}" style="--rarity-col:${tier.color}" title="${esc(iname(k))}"${have ? ` data-key="${esc(k)}"` : ''}>
        <div class="dex-card-art" style="${bgStyle}">
          ${scene ? '<div class="dex-art-overlay"></div>' : ''}
          ${icon ? `<img class="dex-card-icon" src="${icon}" alt="" onerror="this.style.display='none'">` : ''}
          ${have ? `<span class="dex-qty">×${qty}</span>` : '<span class="dex-unknown">?</span>'}
        </div>
        <div class="dex-card-name">${have ? esc(iname(k)) : '???'}</div>
      </div>`;
    }
    html += '</div>';
  }
  const dexEl = document.getElementById('left-mode-dex');
  dexEl.innerHTML = html;
  dexEl.querySelectorAll('.dex-card[data-key]').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => openCard(card.dataset.key));
  });
}

// ── MODE SWITCHING ────────────────────────────────────────────────────────────
function setMode(mode) {
  document.querySelectorAll('.mode-pane').forEach(p => { if (!p.closest('#sp-chat')) p.classList.add('hidden'); });   // chat on the big screen stays
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const onScreen = mode === 'chat' && screenMode === SCREEN.CHAT;
  const pane = document.getElementById(onScreen ? 'chat-away' : `mode-${mode}`);
  if (pane) pane.classList.remove('hidden');
  if (mode === 'recipes') renderRecipes(document.getElementById('recipe-search').value);
  if (mode === 'next') renderAdvisor();
  const rightBody = document.querySelector('#panel-right .panel-body');
  if (rightBody) {
    rightBody.classList.toggle('wiki-active', mode === 'wiki');
    rightBody.classList.toggle('chat-active', mode === 'chat');
  }
  if (mode === 'wiki') {
    const f = document.getElementById('wiki-frame');
    if (f.src === 'about:blank') f.src = 'https://beetle.wiki/';
  }
  if (mode === 'chat') startChatPoll();
  else if (screenMode !== SCREEN.CHAT) stopChatPoll();
}

// ── PANELS ────────────────────────────────────────────────────────────────────
function openPanel(which) {
  const target = document.getElementById(`panel-${which}`);
  // On mobile, close the other panel first so they don't both overlay at once
  if (window.innerWidth <= 700 && !target.classList.contains('open')) {
    document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('open'));
  }
  target.classList.toggle('open');
  updateDeviceRadius();
}
function updateDeviceRadius() {
  const dev = document.getElementById('device');
  dev.classList.toggle('pl-open', document.getElementById('panel-left').classList.contains('open'));
  dev.classList.toggle('pr-open', document.getElementById('panel-right').classList.contains('open'));
}

// ── TIMERS ────────────────────────────────────────────────────────────────────
function startTimers() {
  clearInterval(refreshTimer); clearInterval(tickTimer);
  refreshTimer = setInterval(loadState, REFRESH_INTERVAL);
  tickTimer    = setInterval(tick, TICK_INTERVAL);
}
