// BeetleBoy SP · Event wiring and startup (runs on DOMContentLoaded, after all other scripts).
// Classic script sharing globals with the others; load order is set in index.html.

// ── INIT ──────────────────────────────────────────────────────────────────────
function setupAuthListeners() {
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = 'LOGGING IN…';
    document.getElementById('login-err').textContent = '';
    const tokens = await oidc({
      grant_type: 'password',
      username: document.getElementById('lf-user').value.trim(),
      password: document.getElementById('lf-pass').value,
      scope: 'openid profile email',
    });
    if (!tokens || tokens.error) {
      const desc = tokens?.desc || '';
      const is2fa = /otp|mfa|two.factor|authenticat|not fully set up/i.test(desc);
      document.getElementById('login-err').innerHTML = is2fa
        ? '2FA is not supported.<br>Please disable it on your remilia.net account first.'
        : 'Login failed — check your credentials.';
      btn.disabled = false; btn.textContent = 'LOG IN'; return;
    }
    saveTokens(tokens.access, tokens.refresh);
    showApp();
    await loadState();
    startTimers();
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearInterval(refreshTimer); clearInterval(tickTimer); showLogin();
  });
}

function setupActionButtons() {
  document.getElementById('act-claim').addEventListener('click',  () => doAction('catchBeetle', 'Claim Beetle'));
  document.getElementById('act-hunt').addEventListener('click',   () => doAction('beetleHunt',  'Hunt'));
  document.getElementById('act-ubc').addEventListener('click',    () => doAction('claimUBC',    'Claim UBC'));
  document.getElementById('act-faucet').addEventListener('click', () => doAction('junkFaucet',  'Junk Faucet'));
  document.getElementById('act-crunch').addEventListener('click', doJunkCrunch);
  document.getElementById('act-refresh').addEventListener('click', loadState);
  document.getElementById('act-assemble').addEventListener('click', () => setScreenMode(SCREEN.ASSEMBLE));
  document.getElementById('act-smash').addEventListener('click',    () => setScreenMode(SCREEN.SMASH));
  document.getElementById('do-assemble').addEventListener('click', doAssemble);
  document.getElementById('clear-assemble').addEventListener('click', () => clearSlots('asm'));
  document.getElementById('do-smash').addEventListener('click', doSmash);
  document.getElementById('clear-smash').addEventListener('click', () => clearSlots('sm'));
  const autoHammerChk = document.getElementById('chk-auto-hammer');
  autoHammerChk.checked = localStorage.getItem(LS_AUTO_HAMMER) === '1';
  autoHammerChk.addEventListener('change', () => localStorage.setItem(LS_AUTO_HAMMER, autoHammerChk.checked ? '1' : '0'));
  const bell = document.getElementById('bell-btn');
  if (bell) {
    const show = on => { bell.classList.toggle('on', on); bell.setAttribute('aria-pressed', on); bell.title = on ? 'Timer notifications are on (click to turn off)' : 'Notify me when timers are ready, even when BeetleBoy is closed'; };
    if (!pushSupported()) bell.hidden = true;
    initPush().then(show);
    bell.addEventListener('click', async () => {
      bell.disabled = true;
      if (bell.classList.contains('on')) { await disablePush(); show(false); log('🔕 Timer notifications off.'); }
      else show(await enablePush().catch(e => { log(`Couldn't turn on notifications: ${e.message}`, 'warn'); return false; }));
      bell.disabled = false;
    });
  }
  const announceChk = document.getElementById('chk-announce');
  if (announceChk) {
    announceChk.checked = announceOn();
    announceChk.addEventListener('change', () => localStorage.setItem(LS_ANNOUNCE, announceChk.checked ? '1' : '0'));
  }
  document.getElementById('btn-esc').addEventListener('click', () => setScreenMode(SCREEN.LOG));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !e.target.matches('input, textarea')) setScreenMode(SCREEN.LOG);
  });

  let tipTimeout = null, recent = [], bag = [], fled = false;
  const tipBeetle = document.getElementById('tip-beetle');
  const tipBubble = document.getElementById('tip-bubble');
  const say = (text, ms) => {
    tipBubble.textContent = text;
    tipBubble.classList.add('visible');
    clearTimeout(tipTimeout);
    tipTimeout = setTimeout(() => tipBubble.classList.remove('visible'), ms || Math.min(9000, 2500 + text.length * 45));
  };
  // every line once before any repeats
  const nextRandom = () => {
    const pool = isHalloween() ? [...TIPS, ...HALLOWEEN_TIPS, ...HALLOWEEN_TIPS] : TIPS;   // spooky lines twice as likely
    if (!bag.length) bag = pool.map((_, i) => i).sort(() => Math.random() - 0.5);
    return pool[bag.pop()] ?? pool[0];
  };
  tipBeetle.addEventListener('click', () => {
    if (fled) return;
    tipBeetle.classList.remove('shaking');
    void tipBeetle.offsetWidth;
    tipBeetle.classList.add('shaking');

    let pokes = 0;
    try { pokes = Number(localStorage.getItem('bb_pokes') || 0) + 1; localStorage.setItem('bb_pokes', pokes); } catch {}
    const now = Date.now();
    recent = recent.filter(t => now - t < 8000).concat(now);

    if (BEETLE_MILESTONES[pokes]) return say(BEETLE_MILESTONES[pokes], 6000);
    if (recent.length >= 12) {               // had enough: runs away for a bit
      fled = true; recent = [];
      say('That\'s it. I\'m leaving. 💨', 3000);
      sfx('flee');
      tipBeetle.classList.add('fled');
      setTimeout(() => { fled = false; tipBeetle.classList.remove('fled'); say('...fine, I\'m back. Be nice.'); }, 30000);
      return;
    }
    if (recent.length >= 6) { sfx('beetleMad'); return say(BEETLE_ANNOYED[Math.min(BEETLE_ANNOYED.length - 1, recent.length - 6)]); }
    sfx('beetle');
    const ctx = beetleContextLines();
    say(ctx.length && Math.random() < 0.4 ? ctx[Math.floor(Math.random() * ctx.length)] : nextRandom());
  });
}

function setupLogSearchListeners() {
  const input   = document.getElementById('log-search');
  const suggest = document.getElementById('log-suggest');
  let activeIdx = -1;

  const items = () => [...suggest.querySelectorAll('.log-sug-item')];
  const setActive = idx => {
    items().forEach((el, i) => el.classList.toggle('active', i === idx));
    activeIdx = idx;
  };
  const close = () => { suggest.classList.remove('open'); activeIdx = -1; };
  const pick  = key => { openCard(key); input.value = ''; close(); };

  const update = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { close(); return; }
    const matches = Object.entries(NAMES)
      .filter(([, n]) => n.toLowerCase().includes(q))
      .sort(([ka, na], [kb, nb]) => {
        const aStarts = na.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = nb.toLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts || na.localeCompare(nb);
      })
      .slice(0, 10);
    if (!matches.length) { close(); return; }
    suggest.innerHTML = '';
    matches.forEach(([k, n]) => {
      const col = LINK_COLORS[RARITY[k]] || '';
      const el = document.createElement('div');
      el.className = 'log-sug-item';
      el.textContent = n;
      if (col) el.style.color = col;
      el.dataset.key = k;
      suggest.appendChild(el);
    });
    suggest.classList.add('open');
    activeIdx = -1;
  };

  input.addEventListener('input', update);
  input.addEventListener('blur',  () => setTimeout(close, 150));
  input.addEventListener('keydown', e => {
    const list = items();
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const active = list[activeIdx];
      if (active) pick(active.dataset.key);
      else if (list.length === 1) pick(list[0].dataset.key);
    }
    else if (e.key === 'Escape') close();
  });
  suggest.addEventListener('click', e => {
    const item = e.target.closest('.log-sug-item');
    if (item) pick(item.dataset.key);
  });
}

function setupChatListeners() {
  const input   = document.getElementById('chat-input');
  const suggest = document.getElementById('chat-suggest');

  document.getElementById('chat-send').addEventListener('click', sendChatMsg);
  document.getElementById('chat-attach').addEventListener('click', () => document.getElementById('chat-file-input').click());
  document.getElementById('chat-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) setPendingAttachment(file);
    e.target.value = '';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); sendChatMsg(); }
    if (e.key === 'Escape') suggest.classList.remove('open');
  });
  input.addEventListener('paste', e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        setPendingAttachment(item.getAsFile());
        break;
      }
    }
  });
  input.addEventListener('input', () => updateChatSuggest(input));
  input.addEventListener('blur',  () => setTimeout(() => suggest.classList.remove('open'), 150));
  input.addEventListener('dragover', e => {
    if (e.dataTransfer.types.includes('text/plain')) e.preventDefault();
  });
  input.addEventListener('drop', e => {
    const key = e.dataTransfer.getData('text/plain');
    if (!NAMES[key]) return;
    e.preventDefault();
    const pos  = input.selectionStart ?? input.value.length;
    const link = `[${iname(key)}]`;
    input.value = input.value.slice(0, pos) + link + input.value.slice(pos);
    input.setSelectionRange(pos + link.length, pos + link.length);
    input.focus();
  });
  suggest.addEventListener('click', e => {
    const item = e.target.closest('.chat-sug-item');
    if (!item) return;
    if (item.dataset.handle) {                       // mention: RemiliaNET writes them as ~handle
      const pos = input.selectionStart, before = input.value.slice(0, pos);
      const start = Math.max(before.lastIndexOf('@'), before.lastIndexOf('~'));
      input.value = before.slice(0, start) + `~${item.dataset.handle} ` + input.value.slice(pos);
      const np = start + item.dataset.handle.length + 2;
      input.setSelectionRange(np, np);
      suggest.classList.remove('open');
      input.focus();
    } else insertChatLink(item.dataset.key);
  });
  document.getElementById('chat-messages').addEventListener('scroll', e => {
    if (e.target.scrollTop < 60) loadOlderChat();
  }, { passive: true });
  document.getElementById('chat-messages').addEventListener('click', e => {
    const prof = e.target.closest('[data-profile]');
    if (prof && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) { e.preventDefault(); openProfile(prof.dataset.profile); return; }
    const link = e.target.closest('.chat-item-link');
    if (link) { openCard(link.dataset.key); return; }
    const reactBtn = e.target.closest('.react-trigger');
    if (reactBtn) { sendReact(Number(reactBtn.dataset.msgid), reactBtn.dataset.emoji); return; }
    const replyBtn = e.target.closest('.reply-trigger');
    if (replyBtn) {
      setReplyTarget({
        id: Number(replyBtn.dataset.msgid),
        username: replyBtn.dataset.uname,
        displayname: replyBtn.dataset.dname,
        body: replyBtn.dataset.body,
      });
    }
  });
  document.getElementById('reply-bar-cancel').addEventListener('click', () => setReplyTarget(null));
  // big chat: the chat moves onto the device's main screen (Esc or the 💬 toggle brings it back)
  document.getElementById('chat-big-btn').addEventListener('click', () => setScreenMode(screenMode === SCREEN.CHAT ? SCREEN.LOG : SCREEN.CHAT));
  document.getElementById('log-chat-btn').addEventListener('click', () => setScreenMode(SCREEN.CHAT));
  document.getElementById('recipe-search').addEventListener('input', e => renderRecipes(e.target.value));
}

function setupPanelListeners() {
  document.getElementById('mode-btns').addEventListener('click', e => {
    const mode = e.target.dataset.mode;
    if (mode) setMode(mode);
  });
  document.getElementById('left-mode-btns').addEventListener('click', e => {
    const mode = e.target.dataset.leftMode;
    if (!mode) return;
    document.querySelectorAll('.left-pane').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('#left-mode-btns .mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.leftMode === mode));
    document.getElementById(`left-mode-${mode}`).classList.remove('hidden');
    if (mode === 'dex')   renderBeetledex();
    if (mode === 'trphy') renderTrophies();
    if (mode === 'stats') renderStats();
  });
  document.querySelectorAll('.panel-toggle-btn').forEach(btn =>
    btn.addEventListener('click', () => openPanel(btn.dataset.panel)));

}

function setupThemePicker() {
  const spBtn  = document.getElementById('sp-clickable');
  const picker = document.getElementById('theme-picker');
  spBtn.addEventListener('click', e => {
    e.stopPropagation();
    const wasHidden = picker.classList.contains('hidden');
    picker.classList.toggle('hidden');
    if (wasHidden) buildThemePicker();
  });
  document.addEventListener('click', () => picker.classList.add('hidden'));
}

document.addEventListener('DOMContentLoaded', () => {
  setupAuthListeners();
  setupActionButtons();
  setupLogSearchListeners();
  setupChatListeners();
  setupPanelListeners();
  setupThemePicker();
  wireSlots();

  initSeason();
  const everyday = THEMES.filter(t => !t.seasonal);
  applyTheme(localStorage.getItem(LS_THEME) || everyday[Math.floor(Math.random() * everyday.length)].id);
  updateScreenBg(SCREEN.LOG);

  if (getTokens().access) { showApp(); loadState().then(startTimers); }

  const loadBgImage = initBgShader();
  if (loadBgImage) {
    applyColorScheme(loadBgImage);
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyColorScheme(loadBgImage));
  }
});
