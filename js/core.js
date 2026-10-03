// BeetleBoy SP · Config, colour themes and shared helpers (recipes, slots, scenes).
// Classic script sharing globals with the others; load order is set in index.html.

// ── CONFIG ────────────────────────────────────────────────────────────────────
const USE_PROXY  = true;
const APP_VERSION = '202610031136'; // sent to proxy.php; a request without it comes from a stale cached page
const PROXY_PATH = 'proxy.php';
const BASE_URL   = 'https://www.remilia.net';
const OIDC_URL   = 'https://www.remilia.net/oidc/realms/remilia/protocol/openid-connect/token';
const LS_ACCESS  = 'bb_access';
const LS_REFRESH = 'bb_refresh';
const REFRESH_INTERVAL   = 60_000;
const TICK_INTERVAL      = 1_000;
const CHAT_URL           = 'chatroom.php';

// ── UI CONSTANTS ─────────────────────────────────────────────────────────────
const ASM_SLOTS   = ['asm0','asm1','asm2','asm3'];
const SMASH_SLOTS = ['sm0','sm1'];
const ALL_SLOTS   = [...ASM_SLOTS, 'sm0','sm1','smsac','smhammer','smhammer_bk'];

const SCREEN = { LOG:'log', ASSEMBLE:'assemble', SMASH:'smash', ITEM:'item' };

const RARITY_NAMES = {
  tin:'Tin', brz:'Bronze', mth:'Mithril', adm:'Adamantine',
  dia:'Diamond', pnk:'Special', jnk:'Junk',
};

// ── THEMES ────────────────────────────────────────────────────────────────────
const LS_THEME       = 'bb_theme';
const LS_AUTO_HAMMER = 'bb_auto_hammer';
const LS_ANNOUNCE    = 'bb_announce';
const LS_SCHEME = 'bb_scheme'; // 'light' | 'dark' | unset (follows system)
const THEMES = [
  { id: 'indigo', name: 'Indigo',  c1: '#20264c', c2: '#0c1020', lc1: '#4050b8', lc2: '#2c3890' },
  { id: 'onyx',   name: 'Onyx',    c1: '#1c1c1c', c2: '#060606', lc1: '#585858', lc2: '#404040' },
  { id: 'grape',  name: 'Grape',   c1: '#26144a', c2: '#0a0614', lc1: '#7030c0', lc2: '#521e98' },
  { id: 'flame',  name: 'Flame',   c1: '#321010', c2: '#0c0202', lc1: '#aa2424', lc2: '#7a1818' },
  { id: 'cobalt', name: 'Cobalt',  c1: '#0e2058', c2: '#040a1c', lc1: '#2050c8', lc2: '#1038a0' },
  { id: 'gold',   name: 'Gold',    c1: '#2c2406', c2: '#0c0a02', lc1: '#b08010', lc2: '#806008' },
  { id: 'teal',   name: 'Teal',    c1: '#0c242c', c2: '#030a0c', lc1: '#108080', lc2: '#0c6868' },
  { id: 'orange', name: 'Orange',  c1: '#2e1a04', c2: '#0c0802', lc1: '#b84818', lc2: '#883010' },
];

const TIPS = [
  'Mithril Hammers have a higher break chance than bronze!',
  'Diamond Hammers will dramatically improve your odds!',
  'Have you heard about Junk Spheres?',
  "Don't try to make diamond pollen!",
  'Did you know you can get Specimen Pins from hunting?',
  'The D20 and Deck of Cards can be dropped from hunting!',
  'Click the SP to find the secret color picker!',
  'Can a mouse have some cheddar?',
  'Godzamn, I need more adamantine pollen.',
  'Have you heard of Ray Peat?',
  "Don't try to craft more than 30 things at once...",
  'Contribute to the beetle wiki!',
  'You should really tell Sneed about any bugs you find. No, not that kind of bug.',
  "I'm just a Grigger in a Scarab World.",
  'Give me money',
  'Purple sacrifices increase your odds!',
  'Nothing ever happens.',
  'Can someone please give me the freaking lighter recipe?',
  "Please don't smash me, please im begging you...",
  "It's so over for a tincel like me.",
  'I hate you.',
  'I love you.',
  'MUP DA DOO DIDDA PO MO GUB BIDDA BE DAT TUM MUHFUGEN BIX NOOD COF BIN DUB HO',
  '/unlockchat',
  '*pokes you*',
  "I'm busy.",
  'Leave me alone.',
  'sport car',
  'I love pineapple on pizza.',
  'Set a backup hammer to use when your main one breaks.',
  'If you have the materials ready, you can automatically replace broken hammers.',
  'I use Arch btw.',
  'Wayland is evil. X11 chuds will win.',
  'Ethereum is the world computer.',
  'Alt L1s are evil.',
  'If it takes 1 hour to smash a batch of beetles and we have 15 hammers working 24 hours a day every day for 5 years, how long does it take us to smash 6000000 beetles?',
  'yayo.supply/sneed',
  'WAAAGH!',
  '$CULT',
  'Smoking weed makes you gay and retarded.',
  'Have you tried clicking the cheese man? Like, a lot?',
  'UBC means Universal Basic Cheese. Fully automated luxury cheese communism.',
  'Pinned specimens are not junk. I checked. Twice.',
  'Hammers break. So do I, emotionally.',
  'Three hunts, then a 90 minute break. Union rules.',
  'The 🔥 react is free. Use it.',
  'Say gm in global chat. It costs nothing.',
  'Post your rare drops in chat. Or don\'t. I\'m not your mom.',
  'Every Junk Tesseract was once two hundred cigarette butts. Think about that.',
  'I was a Green Beetle once. Then I got pinned.',
  'Sacrifice a Purple. You know you want to.',
  'Specimen Pin gambling is a valid lifestyle.',
  'The beetle wiki knows things. Dark things.',
  'Level 100 players know the lighter recipe. They will never tell you.',
  'One more smash. Just one more.',
  'Diamond pollen is a myth told to scare tincels.',
  'You could be outside right now.',
  'I have seen things in the junk pile you would not believe.',
  'Beetles are just bugs that went to college.',
  'gm',
  'gn',
  'wagmi (we are all gonna mutate into beetles)',
  'Have you thanked your hammer today?',
  'Every cheese you don\'t spend makes a mouse sad.',
  'BEETLEBOY ADVANCE SP: now with 100% more beetle.',
  "I'm not a bug, I'm a feature.",
  'Ctrl+F "lighter" on the wiki. I dare you.',
  'Stag beetles fight with their faces. Respect.',
  'The cheese man sees all.',
  'Remilia Corporation is not responsible for lost beetles.',
];

// Lines that depend on your game right now (all optional; empty if not true)
function beetleContextLines() {
  const u = state.user, inv = state.inv || {};
  if (!u) return [];
  const out = [];
  const cds = currentCds();
  const cheese = inv.cheese || 0;
  const hunt = huntStatus();
  if (cds.catchBeetle === 0) out.push('Your beetle claim is ready. Go get it, I\'m not doing it for you.');
  if (cds.claimUBC === 0) out.push('Free cheese is ready. Universal Basic Cheese, baby.');
  if (cds.junkFaucet === 0) out.push('The cheese man has junk for you today. Click him until he cracks.');
  if (hunt.cooldown > 0) out.push(`Hunting break: ${fmtMs(hunt.cooldown).text} left. Touch grass meanwhile.`);
  else if (cheese >= HUNT_COST) out.push(`You have ${cheese} cheese. That's ${Math.floor(cheese / HUNT_COST)} hunts. Just saying.`);
  else out.push(`${cheese} cheese? A hunt costs ${HUNT_COST}. Brokie.`);
  const junk = junkPool(inv).length;
  if (junk >= 50) out.push(`You're sitting on ${junk} pieces of junk. CRUNCH IT.`);
  if (!HAMMERS.some(h => (inv[h] || 0) > 0)) out.push("You don't even own a hammer. How do you live like this?");
  if ((inv.green || 0) >= 1000) out.push(`${(inv.green).toLocaleString()} Green Beetles. Hoarder.`);
  if (u.level != null) out.push(u.level >= 100 ? 'Level 100. Welcome to beetol wurl. Now tell me the lighter recipe.' : `Level ${u.level}. ${100 - u.level} more and they might tell you the lighter recipe.`);
  const pins = Object.keys(inv).filter(k => (inv[k] || 0) > 0 && pinnedBeetle(k)).length;
  if (pins) out.push(`You pinned ${pins} of my friends. I'm keeping a list.`);
  const h = new Date().getHours();
  if (h >= 1 && h < 5) out.push(`It's ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Go to sleep. The beetles will still be here.`);
  if (h >= 5 && h < 9) out.push('Morning. Did you claim your cheese yet?');
  return out;
}

const BEETLE_ANNOYED = ['Stop poking me.', 'I said STOP.', 'Do you poke everyone like this?', 'I bite, you know.', "I'm telling Sneed."];
const BEETLE_MILESTONES = { 100: "That's 100 pokes. We're basically married now.", 500: '500 pokes. Do you need to talk to someone?', 1000: '1000 pokes. Seek help. I mean it. 🪲' };

function applyTheme(id) {
  if (id === 'indigo') delete document.body.dataset.theme;
  else document.body.dataset.theme = id;
  localStorage.setItem(LS_THEME, id);
  document.querySelectorAll('.theme-swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.theme === id));
}

function buildThemePicker() {
  const current = localStorage.getItem(LS_THEME) || 'flame';
  const picker = document.getElementById('theme-picker');
  const light = document.body.dataset.scheme === 'light';
  picker.innerHTML = `<div class="theme-picker-title">Colorway</div><div id="theme-grid">${
    THEMES.map(t => {
      const g1 = light ? t.lc1 : t.c1, g2 = light ? t.lc2 : t.c2;
      return `<button class="theme-swatch${t.id === current ? ' active' : ''}" data-theme="${t.id}"
        style="background:linear-gradient(150deg,${g1},${g2})" title="${t.name}">
        <span class="theme-name">${t.name}</span></button>`;
    }).join('')
  }</div>
  <button id="scheme-toggle" class="scheme-toggle-btn">${light ? '🌙 Dark Mode' : '☀️ Light Mode'}</button>`;
  picker.querySelectorAll('.theme-swatch').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); applyTheme(btn.dataset.theme); }));
  picker.querySelector('#scheme-toggle').addEventListener('click', e => {
    e.stopPropagation();
    const nowLight = document.body.dataset.scheme === 'light';
    localStorage.setItem(LS_SCHEME, nowLight ? 'dark' : 'light');
    applyColorScheme();
  });
}

// Data (IMAGES, BG_SCENES, NAMES, RARITY, SCIENTIFIC, DESCRIPTIONS, CATEGORIES,
// TROPHIES, AR, RECIPES, SMASH_FILL_MAP, etc.) lives in data.js, loaded first.

// ── HELPERS ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// A pinned specimen (made with a Specimen Pin) is "trophy_<beetle>"
const pinnedBeetle = key => key.startsWith('trophy_') && BEETLES.includes(key.slice(7)) ? key.slice(7) : null;

function iname(key) {
  const pinned = pinnedBeetle(key);
  if (pinned && !NAMES[key]) return `Pinned ${iname(pinned)}`;
  return NAMES[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function rcls(key) { const r = RARITY[key]; return r ? `r-${r}` : ''; }

function ingGroupLabel(group) {
  if (group === 'junk') return 'Any Junk';
  const tier = FLOWER_TIERS.find(([g]) => g === group);
  return tier ? tier[1] : group.map(iname).join(' or ');
}

function arDisplay(r, inv) {
  const repeatKey  = TROPHY_REPEAT[r.out];
  const ownsTrophy = !!repeatKey && (inv[r.out] || 0) > 0;
  return {
    displayKey:  ownsTrophy ? repeatKey : r.out,
    displayName: ownsTrophy ? iname(repeatKey) : (r.name ?? iname(r.out)),
  };
}

function fmtMs(ms) {
  if (ms === null) return { text: '—', cls: '' };
  if (ms <= 0) return { text: 'Ready', cls: 'ready' };
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return { text: `${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`, cls: 'waiting' };
  if (m > 0) return { text: `${m}m ${String(sec).padStart(2,'0')}s`, cls: 'waiting' };
  return { text: `${sec}s`, cls: 'waiting' };
}

function junkPool(inv) {
  const pool = [];
  for (const [k, qty] of Object.entries(inv))
    if (isJunk(k) && qty > 0)
      pool.push(...Array(qty).fill(k));
  return pool;
}

function craftCount(recipe, inv) {
  const counts = recipe.ing.map(ing => {
    if ('group' in ing) {
      const total = ing.group === 'junk'
        ? junkPool(inv).length
        : ing.group.reduce((s, k) => s + (inv[k] || 0), 0);
      return Math.floor(total / ing.qty);
    }
    return Math.floor((inv[ing.key] || 0) / ing.qty);
  });
  return counts.length ? Math.min(...counts) : 0;
}

function pickSlots(recipe, inv) {
  const slots = [];
  for (const ing of recipe.ing) {
    if ('group' in ing) {
      const pool = ing.group === 'junk'
        ? junkPool(inv)
        : [...ing.group].sort((a, b) => (inv[b] || 0) - (inv[a] || 0))
                        .flatMap(k => Array(inv[k] || 0).fill(k));
      if (pool.length < ing.qty) return null;
      slots.push(...pool.slice(0, ing.qty));
    } else {
      if ((inv[ing.key] || 0) < ing.qty) return null;
      slots.push(...Array(ing.qty).fill(ing.key));
    }
  }
  return slots;
}


// Scene behind a card: the official background if we ship it (icons/_bg),
// else the category's background, else a wiki scene, else a hashed pick.
const localBg = k => LOCAL_BG.has(k) ? `icons/_bg/${k}.webp` : null;
const _sceneOf = k => localBg(k) || BG_SCENES[k];
const _FLOWER_SCENES = ALL_FLOWERS.map(_sceneOf).filter(Boolean);
const _BEETLE_SCENES = BEETLES.map(_sceneOf).filter(Boolean);
function _hashPick(arr, key) { return arr[key.split('').reduce((s,c) => s + c.charCodeAt(0), 0) % arr.length]; }
const _CAT_BG = { Trinkets: 'trinkets', Artifacts: 'artifacts', Special: 'unique' };

function getScene(key) {
  const own = _sceneOf(key);
  if (own) return own;
  if (key.startsWith('pollen_')) return localBg('pollen_common') || 'pollen_common.webp';
  if (key === 'junk_cube_t1' || key === 'junk_cube_t2' || isJunk(key)) return localBg('junk') || 'junk.webp';
  if (key === 'cheese') return localBg('cheese');
  if (key.startsWith('trophy_')) return localBg(pinnedBeetle(key) || 'trinkets') || localBg('trinkets');
  const cat = CATEGORIES.find(([, keys]) => keys.includes(key))?.[0];
  if (_CAT_BG[cat]) return localBg(_CAT_BG[cat]);
  if (ALL_FLOWERS.includes(key)) return _hashPick(_FLOWER_SCENES, key);
  if (BEETLES.includes(key)) return _hashPick(_BEETLE_SCENES, key);
  return null;
}

function resolveSmashSpec(s, exclude = []) {
  if (!s) return null;
  const inv = state.inv;
  if (s.k) return (inv[s.k] || 0) > 0 ? s.k : null;
  if (s.t === 'sac') {
    if (s.high && (inv['purple'] || 0) > 0 && !exclude.includes('purple')) return 'purple';
    if ((inv['green'] || 0) > 0 && !exclude.includes('green')) return 'green';
    return null;
  }
  const pool = s.t === 'beetle' ? BEETLES : s.t === 'flower' ? ALL_FLOWERS : [];
  return pool
    .filter(k => (!s.r || RARITY[k] === s.r) && !exclude.includes(k) && (inv[k] || 0) > 0)
    .sort((a, b) => (inv[b] || 0) - (inv[a] || 0))[0] || null;
}

function smashCraftable(spec) {
  if (!spec) return false;
  const inv = state.inv;
  const total = (s) => {
    if (!s) return Infinity;
    if (s.k) return inv[s.k] || 0;
    if (s.t === 'sac') return s.high
      ? (inv['purple'] || 0) + (inv['green'] || 0)
      : (inv['green'] || 0);
    const pool = s.t === 'beetle' ? BEETLES : s.t === 'flower' ? ALL_FLOWERS : [];
    return pool.filter(k => !s.r || RARITY[k] === s.r).reduce((n, k) => n + (inv[k] || 0), 0);
  };
  const { sm0, sm1, sac } = spec;
  if (sm0 && total(sm0) < 1) return false;
  if (sm1) {
    const linked = sm0 && ((sm0.t && sm0.t === sm1.t && sm0.r === sm1.r) || (sm0.k && sm0.k === sm1.k));
    if (linked ? total(sm0) < 2 : total(sm1) < 1) return false;
  }
  if (sac && total(sac) < 1) return false;
  return true;
}

function fillSmash(spec) {
  clearSlots('sm');
  const inv = state.inv;
  const s0 = resolveSmashSpec(spec?.sm0);
  if (s0) { slotState['sm0'] = s0; renderSlot('sm0'); }
  let ex1 = [];
  if (s0 && spec?.sm0 && spec?.sm1) {
    const linked = (spec.sm0.t && spec.sm0.t === spec.sm1.t && spec.sm0.r === spec.sm1.r)
                || (spec.sm0.k && spec.sm0.k === spec.sm1.k);
    if (linked && (inv[s0] || 0) < 2) ex1 = [s0];
  }
  const s1 = resolveSmashSpec(spec?.sm1, ex1);
  if (s1) { slotState['sm1'] = s1; renderSlot('sm1'); }
  const sac = resolveSmashSpec(spec?.sac, [s0, s1].filter(Boolean));
  if (sac) { slotState['smsac'] = sac; renderSlot('smsac'); }
  if (screenMode !== 'smash') setScreenMode(SCREEN.SMASH);
  else autofillSmashHammer();
}

function resultLabel(result) {
  const out = result?.result || {};
  return out.beetle_name || out.name || out.beetle || null;
}

function resolveSlotKeys(slotIds) {
  const pool = [...junkPool(state.inv)];
  return slotIds.map(id => {
    const k = slotState[id] || '';
    if (k !== '_junk_') return k;
    return pool.shift() || '';
  });
}

function previewAssemble() {
  const keys = ASM_SLOTS.map(id => slotState[id] || null).filter(Boolean);
  if (!keys.length) return null;
  for (const r of AR) {
    const remaining = [...keys];
    let match = true;
    for (const ing of r.ing) {
      for (let q = 0; q < ing.qty; q++) {
        let foundIdx = -1;
        for (let i = 0; i < remaining.length; i++) {
          const k = remaining[i];
          if ('group' in ing) {
            if (ing.group === 'junk') {
              if (k === '_junk_' || isJunk(k))
                { foundIdx = i; break; }
            } else if (Array.isArray(ing.group) && ing.group.includes(k)) {
              foundIdx = i; break;
            }
          } else if ('key' in ing && ing.key === k) {
            foundIdx = i; break;
          }
        }
        if (foundIdx === -1) { match = false; break; }
        remaining.splice(foundIdx, 1);
      }
      if (!match) break;
    }
    if (match && remaining.length === 0) {
      const repeatKey = TROPHY_REPEAT[r.out];
      const ownsTrophy = repeatKey && (state.inv[r.out] || 0) > 0;
      return ownsTrophy ? { name: iname(repeatKey), key: repeatKey } : { name: r.name ?? iname(r.out), key: r.out };
    }
  }
  return null;
}

function resultKey(result) {
  const out = result?.result || {};
  for (const c of [out.beetle, out.item]) {
    if (c && (IMAGES[c] || NAMES[c])) return c;
  }
  const name = resultLabel(result);
  if (name) {
    const entry = Object.entries(NAMES).find(([, v]) => v === name);
    if (entry) return entry[0];
  }
  return null;
}

function setResult(elId, text, key = null) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  const imgSrc = key ? IMAGES[key] : null;
  if (imgSrc) {
    const i = document.createElement('img');
    i.src = imgSrc;
    i.style.cssText = 'width:16px;height:16px;object-fit:contain;flex-shrink:0;vertical-align:middle;margin-right:3px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.9))';
    el.appendChild(i);
  }
  const s = document.createElement('span');
  s.textContent = text;
  el.appendChild(s);
}

function autofillSmashHammer() {
  if (slotState['smhammer']) return;
  const best = [...HAMMERS].reverse().find(h => (state.inv[h] || 0) > 0);
  if (best) { slotState['smhammer'] = best; renderSlot('smhammer'); }
}

function renderHammerQuick() {
  const el = document.getElementById('hammer-quick');
  if (!el) return;
  el.innerHTML = '';
  const owned = HAMMERS.filter(h => (state.inv[h] || 0) > 0);
  owned.forEach(h => {
    const r = RARITY[h];
    const isPrimary = slotState['smhammer'] === h;
    const isBackup  = slotState['smhammer_bk'] === h;
    const btn = document.createElement('button');
    btn.className = 'hq-btn' + (isPrimary ? ' hq-active' : '') + (isBackup ? ' hq-backup' : '');
    btn.style.setProperty('--hq-col', `var(--${r})`);
    const img = document.createElement('img');
    img.src = IMAGES[h];
    img.alt = iname(h);
    img.draggable = false;
    btn.appendChild(img);
    btn.title = iname(h) + (isPrimary ? ' (Primary)' : isBackup ? ' (Backup)' : '');
    btn.addEventListener('click', () => {
      if (isPrimary) {
        slotState['smhammer'] = null; renderSlot('smhammer');
      } else if (isBackup) {
        slotState['smhammer_bk'] = null; renderSlot('smhammer_bk');
      } else if (!slotState['smhammer']) {
        slotState['smhammer'] = h; renderSlot('smhammer');
      } else if (!slotState['smhammer_bk']) {
        slotState['smhammer_bk'] = h; renderSlot('smhammer_bk');
      } else {
        slotState['smhammer'] = h; renderSlot('smhammer');
      }
      renderHammerQuick();
      updatePreviews();
    });
    el.appendChild(btn);
  });
  updateAutoHammerCheckbox();
}

function previewSmash() {
  const s1 = slotState['sm0'] || null;
  const s2 = slotState['sm1'] || null;
  const sac = slotState['smsac'] || null;
  if (!s1) return null;

  const isBeetle = k => k && BEETLES.includes(k);
  const isFlower = k => k && ALL_FLOWERS.includes(k);
  // Maps a rarity to the NEXT tier's name (for tier-up preview)
  const nextTier = { tin:'Bronze', brz:'Mithril', mth:'Adamantine', adm:'Diamond' };

  // Tier up — both item slots same rarity same category
  if (s2 && RARITY[s1] && RARITY[s1] === RARITY[s2] && nextTier[RARITY[s1]]) {
    if (isBeetle(s1) && isBeetle(s2))
      return { out: `${nextTier[RARITY[s1]]} Beetle`, note: 'Tier Up — risky' };
    if (isFlower(s1) && isFlower(s2))
      return { out: `${nextTier[RARITY[s1]]} Flower`, note: 'Tier Up — risky' };
  }

  // Beetle → flower transmutation (beetle + junk cube → same-tier flower)
  const btf = (b, j) => isBeetle(b) && j === 'junk_cube_t1' && RARITY_NAMES[RARITY[b]]
    ? { out: `${RARITY_NAMES[RARITY[b]]} Flower (random)`, note: 'one-way' } : null;
  const btfResult = btf(s1, s2) || btf(s2, s1);
  if (btfResult) return btfResult;

  // Artifact creation
  const artCreate = (beetle, pollen) => {
    if (isBeetle(beetle) && RARITY[beetle] === 'brz' && pollen === 'pollen_uncommon')
      return { out: 'Nectar or Cattail', note: 'random' };
    if (isBeetle(beetle) && RARITY[beetle] === 'mth' && pollen === 'pollen_rare')
      return { out: 'Pinecone, Moss or Gunpowder', note: 'random' };
    return null;
  };
  const art = artCreate(s1, s2) || artCreate(s2, s1);
  if (art) return art;

  // Artifact use & specific beetle crafting (check both slot orderings)
  const exactMatch = (a, b) => {
    const pair = `${a}+${b}`;
    return ({
      'nectar+ladybug':        { out: 'Monarch',                 note: '' },
      'cattail+ladybug':       { out: 'Pond Beetle',             note: '' },
      'pinecone+pond':         { out: 'Goliath Beetle',          note: '' },
      'moss+pond':             { out: 'Stag Beetle',             note: '' },
      'gunpowder+pond':        { out: 'Bombardier Beetle',       note: '' },
      'royal_poinciana+monarch':{ out: 'Giraffe Weevil',         note: '' },
      'royal_poinciana+pond':  { out: 'Giraffe Weevil',         note: '' },
      'camellia+monarch':      { out: 'Pillbug',                 note: '' },
      'camellia+pond':         { out: 'Pillbug',                 note: '' },
      'morning_glory+monarch': { out: 'Imperial Tortoise Beetle',note: '' },
      'morning_glory+pond':    { out: 'Imperial Tortoise Beetle',note: '' },
      'pincushion+goliath':    { out: 'Sabertooth Longhorn Beetle', note: '' },
      'pincushion+stag':       { out: 'Sabertooth Longhorn Beetle', note: '' },
      'pincushion+bombardier': { out: 'Sabertooth Longhorn Beetle', note: '' },
      'gazania+goliath':       { out: 'Sunset Moth',             note: '' },
      'gazania+stag':          { out: 'Sunset Moth',             note: '' },
      'gazania+bombardier':    { out: 'Sunset Moth',             note: '' },
      'monarch+larkspur':      { out: 'Golden-Spotted Tiger Beetle', note: '' },
      'pond+larkspur':         { out: 'Golden-Spotted Tiger Beetle', note: '' },
    })[pair] || null;
  };
  const exact = exactMatch(s1, s2) || exactMatch(s2, s1);
  if (exact) return exact;

  // Specimen pin recipe
  if ((s1 === 'specimen_pin' || s2 === 'specimen_pin') && isBeetle(s1 === 'specimen_pin' ? s2 : s1))
    return { out: "That Beetle's Trophy", note: 'sacrifice = green beetle' };

  // 3-item recipes (slot1 + slot2 + sacrifice for display only)
  if (s1 === 'gunpowder' && s2 === 'moss' && sac === 'pinecone')
    return { out: 'Black Lotus', note: '' };
  if (s1 === 'sabertooth_longhorn' && s2 === 'sunset_moth')
    return { out: 'Mars Rhino Beetle', note: 'needs Black Lotus somewhere' };

  return null;
}

function setResultIcon(key) {
  const el = document.getElementById('screen-result-icon');
  if (!el) return;
  const img = key ? IMAGES[key] : null;
  if (img) {
    el.innerHTML = `<img src="${img}" alt="">`;
    el.classList.add('visible');
  } else {
    el.innerHTML = '';
    el.classList.remove('visible');
  }
}

function updatePreviews() {
  const asmEl = document.getElementById('asm-preview');
  if (asmEl) {
    const result = previewAssemble();
    asmEl.textContent = result ? `→ ${result.name}` : '—';
    if (screenMode === SCREEN.ASSEMBLE) setResultIcon(result?.key || null);
  }
  const smEl = document.getElementById('smash-preview');
  if (smEl) {
    const s1 = slotState['sm0'];
    if (!s1) { smEl.innerHTML = '—'; if (screenMode === SCREEN.SMASH) setResultIcon(null); return; }

    const preview = previewSmash();
    smEl.innerHTML = '';
    const line1 = document.createElement('div');
    line1.textContent = preview
      ? `→ ${preview.out}${preview.note ? ' (' + preview.note + ')' : ''}`
      : '→ Unknown';
    smEl.appendChild(line1);

    const hammer = slotState['smhammer'];
    const hs = hammer && HAMMER_STATS[hammer];
    if (hs) {
      // the game reports break_rate 0 until a hammer has worn; the base chance applies then
      const liveData = (state.hammers || []).find(h => h.hammer === hammer);
      const breakRate = liveData ? Math.max(liveData.break_rate || 0, liveData.base_break_rate || 0) : hs.breakPer;
      const bonus = liveData?.craft_bonus ?? hs.bonus;
      const line2 = document.createElement('div');
      line2.className = 'smash-hstat';
      line2.textContent = `+${bonus}% craft bonus`;
      smEl.appendChild(line2);
      const line3 = document.createElement('div');
      line3.className = `smash-hstat smash-break${breakRate >= 50 ? ' smash-break-danger' : breakRate >= 20 ? ' smash-break-warn' : ''}`;
      line3.textContent = `HAMMER BREAK CHANCE: ${breakRate}%`;
      smEl.appendChild(line3);
    }

    if (screenMode === SCREEN.SMASH) {
      const key = preview ? Object.entries(NAMES).find(([, v]) => v === preview.out)?.[0] : null;
      setResultIcon(key || null);
    }
  }
}
