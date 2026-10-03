// BeetleBoy SP · The device screen: inventory, cards, assemble/smash slots and previews.
// Classic script sharing globals with the others; load order is set in index.html.

// ── SCREEN PANE / SLOT SYSTEM ─────────────────────────────────────────────────
let screenMode    = SCREEN.LOG;  // one of SCREEN.*
let lastActionCtx = 'beetle';   // 'beetle' | 'cheese' — drives background image choice
let currentItemKey = null;
const slotState = {}; // slotId → itemKey | null
const logMessages = []; // { msg, cls }[], newest first

function updateScreenBg(mode) {
  const imgDiv = document.getElementById('screen-bg-img');
  const vid    = document.getElementById('screen-bg-vid');
  if (!imgDiv || !vid) return;

  if (mode === SCREEN.ASSEMBLE || mode === SCREEN.SMASH) {
    const src = mode === SCREEN.ASSEMBLE ? 'img/assemblyloop.mp4' : 'img/smashloop.mp4';
    if (vid.getAttribute('src') !== src) { vid.src = src; vid.load(); }
    vid.style.opacity = '1';
    vid.play().catch(() => {});
  } else {
    vid.pause();
    vid.style.opacity = '0';
    const imgSrc = mode === SCREEN.ITEM || lastActionCtx !== 'cheese'
      ? 'img/morning_poster.webp'
      : 'img/cheese_empty_poster.webp';
    imgDiv.style.backgroundImage = `url('${imgSrc}')`;
    imgDiv.style.backgroundSize     = 'cover';
    imgDiv.style.backgroundPosition = 'center';
  }
}

function setScreenMode(mode) {
  if (screenMode === mode && mode !== SCREEN.ITEM) mode = SCREEN.LOG;
  screenMode = mode;
  document.getElementById('sp-log').classList.toggle('hidden',      mode !== SCREEN.LOG);
  document.getElementById('sp-assemble').classList.toggle('hidden',  mode !== SCREEN.ASSEMBLE);
  document.getElementById('sp-smash').classList.toggle('hidden',     mode !== SCREEN.SMASH);
  document.getElementById('sp-item').classList.toggle('hidden',      mode !== SCREEN.ITEM);
  document.getElementById('act-assemble').classList.toggle('active', mode === SCREEN.ASSEMBLE);
  document.getElementById('act-smash').classList.toggle('active',    mode === SCREEN.SMASH);
  document.getElementById('btn-esc').classList.toggle('esc-inactive', mode === SCREEN.LOG);
  updateScreenBg(mode);
  if (mode === SCREEN.SMASH) autofillSmashHammer();
  if (mode !== SCREEN.ASSEMBLE && mode !== SCREEN.SMASH) setResultIcon(null);
  updatePreviews();
}

function slotHtml(slotId, key) {
  if (!key) return ''; // empty = default HTML in index.html
  let img = IMAGES[key];
  if (key === '_junk_') {
    const pool = junkPool(state.inv);
    if (pool.length) img = IMAGES[pool[Math.floor(Math.random() * pool.length)]] || img;
  }
  const scene = getSceneSmall(key);
  const name  = iname(key);
  const bgStyle = scene ? `style="background-image:url('${scene}');background-size:cover;background-position:center"` : '';
  return `${scene ? `<div class="sm-slot-scene" ${bgStyle}></div><div class="sm-slot-overlay"></div>` : ''}
    ${img ? `<img class="sm-slot-img" src="${img}" alt="">` : `<div class="sm-slot-lbl">${esc(name.slice(0,9))}</div>`}
    <div class="sm-slot-name">${esc(name)}</div>
    <button class="sm-slot-x" data-clear="${slotId}">✕</button>`;
}

function renderSlot(slotId) {
  const el = document.querySelector(`.sm-slot[data-slot="${slotId}"]`);
  if (!el) return;
  const key = slotState[slotId] || null;
  el.classList.toggle('filled', !!key);
  if (key) {
    el.innerHTML = slotHtml(slotId, key);
    el.querySelector('.sm-slot-x').addEventListener('click', e => {
      e.stopPropagation(); slotState[slotId] = null; renderSlot(slotId);
    });
  } else {
    const lbls = { asm0:'Slot 1', asm1:'Slot 2', asm2:'Slot 3', asm3:'Slot 4',
                   sm0:'Slot 1', sm1:'Slot 2 (opt)', smsac:'Sacrifice', smhammer:'Hammer', smhammer_bk:'Backup' };
    el.innerHTML = `<span class="sm-slot-lbl">${lbls[slotId] || slotId}</span>`;
  }
  updatePreviews();
  if (slotId === 'smhammer_bk') updateAutoHammerCheckbox();
}

function updateAutoHammerCheckbox() {
  const chk = document.getElementById('chk-auto-hammer');
  if (!chk) return;
  const hasBackup = !!slotState['smhammer_bk'];
  chk.disabled = hasBackup;
  chk.closest('label').style.opacity = hasBackup ? '0.4' : '';
}

function wireSlots() {
  document.querySelectorAll('.sm-slot').forEach(el => {
    const id = el.dataset.slot;

    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('dragover');
      const key = e.dataTransfer.getData('text/plain');
      if (key) { slotState[id] = key; renderSlot(id); }
    });

    // Click an empty slot → no-op (items go in via inventory card clicks or drag)
    el.addEventListener('click', () => {});
  });
}

function clearSlots(prefix) {
  ALL_SLOTS.forEach(id => {
    if (id.startsWith(prefix)) { slotState[id] = null; renderSlot(id); }
  });
  const resultId = prefix === 'asm' ? 'asm-result' : 'smash-result2';
  const el = document.getElementById(resultId);
  if (el) el.textContent = '';
  updatePreviews();
}

function openCard(key) {
  if (screenMode === SCREEN.ITEM && currentItemKey === key) { setScreenMode(SCREEN.LOG); currentItemKey = null; return; }
  currentItemKey = key;
  setScreenMode(SCREEN.ITEM);

  if (key === '_junk_') {
    const pool   = junkPool(state.inv);
    const imgEl  = document.getElementById('spi-img');
    const nameEl = document.getElementById('spi-name');
    const qtyEl  = document.getElementById('spi-qty');
    const rcpEl  = document.getElementById('spi-rcp');
    const icon   = IMAGES['junk_cube_t1'];
    imgEl.innerHTML = icon
      ? `<img src="${icon}" alt="" style="position:relative;z-index:1;width:100%;height:100%;object-fit:contain;padding:22px;display:block;filter:drop-shadow(0 2px 10px rgba(0,0,0,0.9))">`
      : '';
    nameEl.textContent = 'Junk Items';
    qtyEl.textContent  = `×${pool.length} in inventory`;
    rcpEl.innerHTML    = `<div class="spi-rcp-title">ASSEMBLE</div><div class="spi-rcp-row">Any Junk ×2 → Junk Cube</div>`;
    return;
  }

  const inv     = state.inv;
  const imgEl   = document.getElementById('spi-img');
  const nameEl  = document.getElementById('spi-name');
  const qtyEl   = document.getElementById('spi-qty');
  const rcpEl   = document.getElementById('spi-rcp');

  // Left: image area
  const cardImg = IMAGES[`_card_${key}`];
  const iconImg = IMAGES[key];
  const scene   = getScene(key);
  let imgHtml = '';
  if (scene) {
    imgHtml += `<div style="position:absolute;inset:0;background-image:url('${scene}');background-size:cover;background-position:center"></div>`;
    imgHtml += `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.32)"></div>`;
  }
  if (cardImg) {
    imgHtml += `<img src="${cardImg}" alt="" style="position:relative;z-index:1;width:100%;height:100%;object-fit:contain;display:block">`;
  } else if (iconImg) {
    imgHtml += `<img src="${iconImg}" alt="" style="position:relative;z-index:1;width:100%;height:100%;object-fit:contain;padding:22px;display:block;filter:drop-shadow(0 2px 10px rgba(0,0,0,0.9))">`;
  } else {
    imgHtml += `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.25);font-size:12px">${esc(iname(key).slice(0,12))}</div>`;
  }
  imgEl.innerHTML = imgHtml;

  // Right: name + scientific name + description + qty
  nameEl.innerHTML = '';
  const nameTxt = document.createElement('div');
  nameTxt.className = 'spi-name-main';
  nameTxt.textContent = iname(key);
  nameEl.appendChild(nameTxt);
  const r = RARITY[key];
  if (r && RARITY_NAMES[r]) {
    const rarEl = document.createElement('div');
    rarEl.className = `spi-rarity r-${r}`;
    rarEl.textContent = RARITY_NAMES[r];
    nameEl.appendChild(rarEl);
  }
  const sci = SCIENTIFIC[key];
  if (sci) {
    const sciEl = document.createElement('div');
    sciEl.className = 'spi-sci';
    sciEl.textContent = sci;
    nameEl.appendChild(sciEl);
  }

  qtyEl.innerHTML = '';
  const desc = DESCRIPTIONS[key];
  if (desc) {
    const descEl = document.createElement('div');
    descEl.className = 'spi-desc';
    descEl.textContent = `"${desc}"`;
    qtyEl.appendChild(descEl);
  }
  const qtyTxt = document.createElement('div');
  qtyTxt.className = 'spi-qty-count';
  qtyTxt.textContent = `×${inv[key] || 0} in inventory`;
  qtyEl.appendChild(qtyTxt);

  // Crafting recipe for this item
  const recipe = AR_BY_OUT[key];
  let rcpHtml = '';
  if (recipe) {
    const idx = AR.indexOf(recipe);
    const ingDesc = recipe.ing.map(ing =>
      'group' in ing ? `${ingGroupLabel(ing.group)} ×${ing.qty}` : `${iname(ing.key)} ×${ing.qty}`
    ).join(' + ');
    rcpHtml += `<div class="spi-rcp-title spi-rcp-title--assemble">ASSEMBLE</div><div class="spi-rcp-row spi-rcp-clickable" data-rcp="${idx}">${ingDesc}</div>`;
  }

  // Recipes that USE this item as an ingredient
  const usedIn = AR.filter(r => r.ing.some(ing => {
    if ('key' in ing) return ing.key === key;
    if ('group' in ing) {
      if (ing.group === 'junk') return isJunk(key);
      return Array.isArray(ing.group) && ing.group.includes(key);
    }
    return false;
  }));
  if (usedIn.length) {
    rcpHtml += `<div class="spi-rcp-title spi-rcp-title--used-in">USED IN</div>`;
    usedIn.forEach(r => {
      const idx = AR.indexOf(r);
      const ingDesc = r.ing.map(ing =>
        'group' in ing ? `${ingGroupLabel(ing.group)} ×${ing.qty}` : `${iname(ing.key)} ×${ing.qty}`
      ).join(' + ');
      rcpHtml += `<div class="spi-rcp-row spi-rcp-clickable" data-rcp="${idx}">${ingDesc} → ${esc(arDisplay(r, inv).displayName)}</div>`;
    });
  }

  // Smash recipes — match full item name to avoid false positives (e.g. "Junk" matching all junk smashes)
  const fullName = iname(key).toLowerCase();
  const tierName = RARITY[key] ? RARITY_NAMES[RARITY[key]] : null;
  const tierCategory = tierName && BEETLES.includes(key)     ? `${tierName.toLowerCase()} beetle`
                     : tierName && ALL_FLOWERS.includes(key) ? `${tierName.toLowerCase()} flower`
                     : null;
  const smashIngRows = [], smashOutRows = [];
  if (!HAMMERS.includes(key)) {
    for (const row of RECIPES) {
      const [ing, out, typ] = row;
      if (typ !== 'smash') continue;
      const ingL = ing.toLowerCase(), outL = out.toLowerCase();
      const ingSpecific = ingL.includes(fullName);
      const outSpecific = outL.includes(fullName);
      const ingGeneric  = !ingSpecific && !outSpecific && tierCategory && ingL.includes(tierCategory);
      const outGeneric  = !ingSpecific && !outSpecific && !ingGeneric && tierCategory && outL.includes(tierCategory);
      if (ingSpecific) smashIngRows.push({ row, generic: false });
      else if (outSpecific) smashOutRows.push({ row, generic: false });
      else if (ingGeneric) smashIngRows.push({ row, generic: true });
      else if (outGeneric) smashOutRows.push({ row, generic: true });
    }
  }

  if (!rcpHtml && !smashIngRows.length && !smashOutRows.length)
    rcpHtml = `<div class="spi-rcp-title" style="margin-top:4px">No recipes found</div>`;
  rcpEl.innerHTML = rcpHtml;

  // Make assemble rows clickable
  rcpEl.querySelectorAll('.spi-rcp-row[data-rcp]').forEach(row => {
    const r = AR[parseInt(row.dataset.rcp)];
    if (!r) return;
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      clearSlots('asm');
      const slots = pickSlots(r, state.inv);
      if (slots) ASM_SLOTS.forEach((id, i) => { if (slots[i]) { slotState[id] = slots[i]; renderSlot(id); } });
      setScreenMode(SCREEN.ASSEMBLE);
    });
  });

  const makeSmashRowEl = (ing, out, note) => {
    const spec = SMASH_FILL_MAP.get(ing);
    const el = document.createElement('div');
    el.className = 'spi-rcp-row' + (spec ? ' spi-rcp-clickable' : '');
    el.innerHTML = `${esc(ing)} → ${esc(out)}${note ? ` <em>(${note})</em>` : ''}`;
    if (spec) el.addEventListener('click', () => fillSmash(spec));
    return el;
  };

  const addSmashSection = (entries, label, titleClass) => {
    if (!entries.length) return;
    const specific = entries.filter(e => !e.generic);
    const generic  = entries.filter(e => e.generic);

    const title = document.createElement('div');
    title.className = `spi-rcp-title ${titleClass}`;
    title.textContent = label;
    rcpEl.appendChild(title);

    specific.forEach(({ row: [ing, out,, note] }) => rcpEl.appendChild(makeSmashRowEl(ing, out, note)));

    if (generic.length) {
      if (generic.length <= 2) {
        generic.forEach(({ row: [ing, out,, note] }) => rcpEl.appendChild(makeSmashRowEl(ing, out, note)));
      } else {
        const toggle = document.createElement('div');
        toggle.className = 'spi-rcp-generic-toggle';
        const updateToggle = open =>
          toggle.textContent = `${open ? '▼' : '▶'} ${generic.length} tier recipes`;
        updateToggle(false);

        const container = document.createElement('div');
        container.className = 'spi-rcp-generic-rows';
        container.hidden = true;
        generic.forEach(({ row: [ing, out,, note] }) => container.appendChild(makeSmashRowEl(ing, out, note)));

        toggle.addEventListener('click', () => {
          container.hidden = !container.hidden;
          updateToggle(!container.hidden);
        });

        rcpEl.appendChild(toggle);
        rcpEl.appendChild(container);
      }
    }
  };

  addSmashSection(smashIngRows, 'SMASH',      'spi-rcp-title--smash');
  addSmashSection(smashOutRows, 'SMASH FROM', 'spi-rcp-title--smash-from');

  // See also — trophy ↔ item cross-links + manual SEE_ALSO entries
  const seeAlso = [];
  const repeatItemKey = TROPHY_REPEAT[key];
  const reqTrophyKey  = AR_BY_OUT[key]?.reqTrophy;
  if (repeatItemKey) seeAlso.push(repeatItemKey);
  if (reqTrophyKey)  seeAlso.push(reqTrophyKey);
  (SEE_ALSO.get(key) || []).forEach(k => { if (!seeAlso.includes(k)) seeAlso.push(k); });

  if (seeAlso.length) {
    const saTitle = document.createElement('div');
    saTitle.className = 'spi-rcp-title spi-rcp-title--see-also';
    saTitle.textContent = 'SEE ALSO';
    rcpEl.appendChild(saTitle);
    seeAlso.forEach(k => {
      const el = document.createElement('div');
      el.className = 'spi-rcp-row spi-rcp-clickable';
      const img = IMAGES[k];
      el.innerHTML = (img ? `<img class="spi-see-also-icon" src="${esc(img)}" alt="">` : '') + esc(iname(k));
      el.addEventListener('click', () => openCard(k));
      rcpEl.appendChild(el);
    });
  }
}

function iccHtml(k, qty) {
  let img = IMAGES[k];
  if (k === '_junk_') {
    const pool = junkPool(state.inv);
    if (pool.length) img = IMAGES[pool[Math.floor(Math.random() * pool.length)]] || img;
  }
  const scene = getSceneSmall(k);
  const rc    = rcls(k);
  const name  = iname(k);
  const bgStyle = scene ? `background-image:url('${scene}');background-size:cover;background-position:center` : '';
  return `<div class="icc ${rc}" data-key="${esc(k)}" draggable="true" title="${esc(name)} ×${qty}">
    <div class="icc-media" style="${bgStyle}">
      ${scene ? '<div class="icc-scene-overlay"></div>' : ''}
      ${img
        ? `<img class="icc-img" src="${img}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="icc-fallback">${esc(name.slice(0, 9))}</div>`}
      <span class="icc-count">×${qty}</span>
    </div>
    <div class="icc-label">${esc(name)}</div>
  </div>`;
}

function renderInventory() {
  const inv = state.inv;
  const junkTotal = junkPool(inv).length;

  let html = '';
  for (const [cat, keys] of CATEGORIES) {
    const items = keys.filter(k => inv[k] > 0);
    const junkCard = cat === 'Junk' && junkTotal > 0 ? [iccHtml('_junk_', junkTotal)] : [];
    if (!items.length && !junkCard.length) continue;
    const grid = [...items.map(k => iccHtml(k, inv[k])), ...junkCard].join('');
    html += `<div class="inv-section">
      <div class="inv-section-title">${cat}</div>
      <div class="icc-grid">${grid}</div>
    </div>`;
  }
  const el = document.getElementById('left-mode-inv');
  el.innerHTML = html;
  el.querySelectorAll('.icc[data-key]').forEach(card => {
    const k = card.dataset.key;
    card.addEventListener('click', () => {
      if (screenMode === SCREEN.ASSEMBLE) {
        if (!BEETLES.includes(k)) {
          const slots = ASM_SLOTS;
          const empty = slots.find(s => !slotState[s]);
          if (empty) { slotState[empty] = k; renderSlot(empty); return; }
        }
      } else if (screenMode === SCREEN.SMASH) {
        if (HAMMERS.includes(k)) {
          if (!slotState['smhammer'] || slotState['smhammer'] === k) {
            slotState['smhammer'] = k; renderSlot('smhammer');
          } else if (!slotState['smhammer_bk'] || slotState['smhammer_bk'] === k) {
            slotState['smhammer_bk'] = k; renderSlot('smhammer_bk');
          } else {
            slotState['smhammer'] = k; renderSlot('smhammer');
          }
          renderHammerQuick(); return;
        }
        const slots = BEETLES.includes(k) ? ['smsac','sm0','sm1']
                    : k === '_junk_'       ? ['sm0','sm1']
                    : ['sm0','sm1','smsac'];
        const empty = slots.find(s => !slotState[s]);
        if (empty) { slotState[empty] = k; renderSlot(empty); return; }
      }
      openCard(k);
    });
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', k);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
}

function renderTrophies() {
  const inv = state.inv;
  const owned  = TROPHIES.filter(([k]) => (inv[k] || 0) > 0).length;
  const total  = TROPHIES.length;

  const rows = TROPHIES.map(([key, tname, known]) => {
    const have = (inv[key] || 0) > 0;
    const iconSrc = IMAGES[key];
    const iconHtml = iconSrc
      ? `<img class="tr-icon" src="${esc(iconSrc)}" alt="">`
      : `<span class="tr-icon"></span>`;
    if (have) {
      return `<div class="tr-row tr-owned tr-clickable" data-key="${esc(key)}">
        ${iconHtml}<span class="tr-check">✓</span><span class="tr-name">${esc(tname)}</span>
      </div>`;
    }
    if (known) {
      const recipe = AR_BY_OUT[key];
      let needHtml = '';
      if (recipe) {
        const parts = [];
        for (const ing of recipe.ing) {
          let cur, label;
          if ('group' in ing) {
            cur   = ing.group === 'junk' ? junkPool(inv).length : ing.group.reduce((s, k) => s + (inv[k] || 0), 0);
            label = ingGroupLabel(ing.group);
          } else { cur = inv[ing.key] || 0; label = iname(ing.key); }
          const short = Math.max(0, ing.qty - cur);
          const cls   = short > 0 ? 'tr-need' : 'tr-have';
          parts.push(`<span class="${cls}">${esc(label)} ${cur}/${ing.qty}</span>`);
        }
        needHtml = `<div class="tr-ing">${parts.join('<span class="tr-plus"> + </span>')}</div>`;
      } else {
        needHtml = `<div class="tr-ing tr-hunt">Obtained through beetle hunting</div>`;
      }
      return `<div class="tr-row tr-uncollected tr-clickable" data-key="${esc(key)}">
        ${iconHtml}<span class="tr-check">○</span><span class="tr-name">${esc(tname)}</span>
        ${needHtml}
      </div>`;
    }
    return `<div class="tr-row tr-unknown tr-clickable" data-key="${esc(key)}">
      ${iconHtml}<span class="tr-check">?</span><span class="tr-name">${esc(tname)}</span>
    </div>`;
  }).join('');

  // Pinned specimens: one per beetle species, made with a Specimen Pin
  const pinned = Object.keys(inv).filter(k => (inv[k] || 0) > 0 && pinnedBeetle(k));
  const pinRows = pinned.map(key => {
    const b = pinnedBeetle(key);
    const iconSrc = IMAGES[key] || IMAGES[b];
    return `<div class="tr-row tr-owned tr-clickable" data-key="${esc(b)}">
      ${iconSrc ? `<img class="tr-icon" src="${esc(iconSrc)}" alt="">` : '<span class="tr-icon"></span>'}<span class="tr-check">📌</span><span class="tr-name">${esc(iname(b))}</span>
    </div>`;
  }).join('');

  const container = document.getElementById('left-mode-trphy');
  container.innerHTML =
    `<div class="tr-header">${owned} / ${total} collected</div>` +
    `<div class="tr-list">${rows}</div>` +
    (pinRows ? `<div class="tr-header">📌 ${pinned.length} pinned specimen${pinned.length > 1 ? 's' : ''}</div><div class="tr-list">${pinRows}</div>` : '');

  container.querySelectorAll('.tr-clickable[data-key]').forEach(row => {
    row.addEventListener('click', () => openCard(row.dataset.key));
  });
}

function renderCraftable() {
  const inv = state.inv;
  const craftable = AR
    .filter(r => !(r.unique && (inv[r.out] || 0) > 0))
    .filter(r => !r.reqTrophy || (inv[r.reqTrophy] || 0) > 0)
    .map(r => ({ r, n: r.unique ? Math.min(1, craftCount(r, inv)) : craftCount(r, inv) }))
    .filter(({ n }) => n > 0);

  const el = document.getElementById('craftable-list');
  if (!craftable.length) {
    el.innerHTML = '<span class="nothing-craftable">Nothing craftable right now.</span>';
    return;
  }

  el.innerHTML = craftable.map(({ r, n }, i) => {
    const { displayKey, displayName } = arDisplay(r, inv);
    const icon = IMAGES[displayKey]
      ? `<img class="craft-icon" src="${IMAGES[displayKey]}" alt="">`
      : `<span class="craft-icon"></span>`;
    const ingHtml = r.ing.map(ing => {
      let label, have;
      if ('group' in ing) {
        have  = ing.group === 'junk' ? junkPool(inv).length : ing.group.reduce((s, k) => s + (inv[k] || 0), 0);
        label = ingGroupLabel(ing.group);
      } else {
        have  = inv[ing.key] || 0;
        label = iname(ing.key);
      }
      const cls = have < ing.qty ? 'ing-need' : '';
      return `<span class="${cls}">${label} ×${ing.qty}</span>`;
    }).join(' <span style="color:rgba(60,90,140,0.6)">+</span> ');
    return `<div class="craft-row" data-idx="${i}">
        ${icon}
        <span class="craft-name ${rcls(displayKey)}">${esc(displayName)}</span>
        <span class="craft-count">×${n}</span>
        <input class="craft-repeat-input" type="number" min="1" max="99" value="1" title="Repeat">
        <button class="craft-do-btn" data-idx="${i}">craft</button>
      </div>
      <div class="craft-expand hidden" data-exp="${i}">
        <div class="craft-ing">${ingHtml}</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.craft-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.classList.contains('craft-do-btn') || e.target.classList.contains('craft-repeat-input')) return;
      const exp = el.querySelector(`.craft-expand[data-exp="${row.dataset.idx}"]`);
      if (exp) exp.classList.toggle('hidden');
    });
  });

  el.querySelectorAll('.craft-do-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const { r, n } = craftable[+btn.dataset.idx];
      const repeatInput = btn.closest('.craft-row').querySelector('.craft-repeat-input');
      const repeatCount = Math.max(1, Math.min(99, parseInt(repeatInput?.value) || 1));
      btn.disabled = true;
      log(repeatCount > 1 ? `Crafting ${n} ×${repeatCount}…` : `Crafting ${n}…`);
      let successCount = 0, lastLabel = '', trophyCrafted = null;
      for (let i = 0; i < repeatCount; i++) {
        const slots = pickSlots(r, state.inv);
        if (!slots) { log('Not enough materials.', 'warn'); break; }
        const [s1, s2, s3, s4] = slots;
        const body = { type: 1, slot1: s1, slot2: s2, ...(s3 ? { slot3: s3 } : {}), ...(s4 ? { slot4: s4 } : {}) };
        const result = await apiPost('/api/beetle/action/craft', body);
        if (!result) break;
        if (result.success === false) { sfx('fail'); log(result.message || 'Failed.', 'warn'); break; }
        lastLabel = resultLabel(result) || 'done';
        const rk = resultKey(result);
        craftSound(rk);
        if (rk?.startsWith('trophy_') && !trophyCrafted) trophyCrafted = rk;
        successCount++;
        if (i < repeatCount - 1) await loadState(true);
      }
      await loadState();
      if (successCount > 0) {
        log(repeatCount > 1 ? `✓ ×${successCount}: ${lastLabel}` : `✓ Got: ${lastLabel || 'done'}`);
        if (trophyCrafted) announceTrophy(trophyCrafted);
      }
      btn.disabled = false;
    });
  });
}


function groupRarityClass(group) {
  if (group === 'junk')          return 'r-jnk';
  if (group === TIN_FLOWERS)     return 'r-tin';
  if (group === BRONZE_FLOWERS)  return 'r-brz';
  if (group === MITHRIL_FLOWERS) return 'r-mth';
  if (group === ADAM_FLOWERS)    return 'r-adm';
  return '';
}

function makeAsmRow(r, inv) {
  const lhsHtml = r.ing.map(ing => {
    const label = 'key' in ing ? iname(ing.key) : ingGroupLabel(ing.group);
    const cls   = 'key' in ing ? rcls(ing.key) : groupRarityClass(ing.group);
    const qty   = ing.qty > 1 ? ` ×${ing.qty}` : '';
    return `<span class="${cls}">${esc(label)}${qty}</span>`;
  }).join('<span class="rcp-plus"> + </span>');

  const craftable  = craftCount(r, inv) > 0;
  const isTrophy   = r.out.startsWith('trophy_');
  const { displayKey, displayName } = arDisplay(r, inv);
  const ownsTrophy = !!TROPHY_REPEAT[r.out] && (inv[r.out] || 0) > 0;
  const rowCls = (!ownsTrophy && isTrophy) ? 'rcp-trophy' : rcls(displayKey);
  const rhsCls = (!ownsTrophy && isTrophy) ? 'rcp-trophy-name' : rcls(displayKey);

  const row  = document.createElement('div');
  row.className = `rcp-row ${rowCls} rcp-clickable`;

  const main = document.createElement('div');
  main.className = 'rcp-main';
  main.innerHTML =
    `<span class="rcp-lhs">${lhsHtml}</span>` +
    `<span class="rcp-arr">→</span>` +
    `<span class="rcp-rhs ${rhsCls}">${esc(displayName)}</span>` +
    `<span class="rcp-ready-dot${craftable ? '' : ' rcp-dot-off'}"></span>`;
  row.appendChild(main);

  const expand = document.createElement('div');
  expand.className = 'rcp-expand hidden';
  if (craftable) {
    expand.innerHTML = '<span class="rcp-can-craft">✓ Ready — click again to fill slots</span>';
  } else {
    const parts = [];
    for (const ing of r.ing) {
      let have, label;
      if ('group' in ing) {
        have  = ing.group === 'junk' ? junkPool(inv).length : ing.group.reduce((s, k) => s + (inv[k] || 0), 0);
        label = ingGroupLabel(ing.group);
      } else {
        have  = inv[ing.key] || 0;
        label = iname(ing.key);
      }
      if (ing.qty - have > 0) parts.push(`${label} ×${ing.qty - have}`);
    }
    expand.innerHTML = `<span class="rcp-missing">Need: ${parts.join(', ')}</span>`;
  }
  row.appendChild(expand);

  let expanded = false;
  row.addEventListener('click', () => {
    if (craftable) {
      clearSlots('asm');
      const slots = pickSlots(r, state.inv);
      if (slots) ASM_SLOTS.forEach((id, i) => {
        if (slots[i]) { slotState[id] = slots[i]; renderSlot(id); }
      });
      if (screenMode !== SCREEN.ASSEMBLE) setScreenMode(SCREEN.ASSEMBLE);
    } else {
      expanded = !expanded;
      expand.classList.toggle('hidden', !expanded);
    }
  });
  return row;
}

function smashSlotHtml(s, qty = 1) {
  if (!s) return '';
  const pre = qty > 1 ? `${qty}× ` : '';
  if (s.k) return `<span class="${rcls(s.k)}">${pre}${esc(iname(s.k))}</span>`;
  if (s.t === 'sac') {
    const label = s.high ? 'Purple/Green Beetle' : 'Green Beetle';
    return `<span class="${s.high ? 'r-brz' : 'r-tin'}">${pre}${label}</span>`;
  }
  const rStr = s.r || '';
  const label = `${RARITY_NAMES[rStr] || ''} ${s.t === 'beetle' ? 'Beetle' : 'Flower'}`;
  return `<span class="r-${rStr}">${pre}${esc(label.trim())}</span>`;
}

function smashIngHtml(spec, ingFallback) {
  if (!spec) return esc(ingFallback);
  const { sm0, sm1, sac } = spec;
  const linked = sm0 && sm1 && (
    (sm0.k && sm0.k === sm1.k) ||
    (sm0.t && sm0.t === sm1.t && sm0.r === sm1.r)
  );
  const parts = [];
  if (linked) parts.push(smashSlotHtml(sm0, 2));
  else { if (sm0) parts.push(smashSlotHtml(sm0)); if (sm1) parts.push(smashSlotHtml(sm1)); }
  if (sac?.k) parts.push(smashSlotHtml(sac));
  return parts.filter(Boolean).join('<span class="rcp-plus"> + </span>');
}

function smashOutClass(out) {
  const key = Object.entries(NAMES).find(([, n]) => n === out)?.[0];
  if (key) return rcls(key);
  for (const [r, name] of Object.entries(RARITY_NAMES))
    if (out.toLowerCase().includes(name.toLowerCase())) return `r-${r}`;
  return '';
}

function makeSmashRow(ing, out, note) {
  const inv       = state.inv;
  const spec      = SMASH_FILL_MAP.get(ing);
  const craftable = smashCraftable(spec);

  const row  = document.createElement('div');
  row.className = 'rcp-row rcp-clickable';

  const main = document.createElement('div');
  main.className = 'rcp-main';
  main.innerHTML =
    `<span class="rcp-lhs">${smashIngHtml(spec, ing)}</span>` +
    `<span class="rcp-arr">→</span>` +
    `<span class="rcp-rhs ${smashOutClass(out)}">${esc(out)}</span>` +
    `<span class="rcp-ready-dot${craftable ? '' : ' rcp-dot-off'}"></span>`;
  row.appendChild(main);

  if (note) {
    const noteEl = document.createElement('div');
    noteEl.className = 'rcp-note';
    noteEl.textContent = note;
    row.appendChild(noteEl);
  }

  const expand = document.createElement('div');
  expand.className = 'rcp-expand hidden';
  if (!craftable && spec) {
    const parts  = [];
    const rname  = r => RARITY_NAMES[r] || r || '';
    const sLabel = s => {
      if (!s) return '';
      if (s.k) return iname(s.k);
      if (s.t === 'sac') return s.high ? 'Purple or Green Beetle' : 'Green Beetle';
      return `${rname(s.r)} ${s.t === 'beetle' ? 'Beetle' : 'Flower'}`;
    };
    const checkSpec = (s, label) => {
      if (!s) return;
      if (s.k) {
        if ((inv[s.k] || 0) < 1) parts.push(`${iname(s.k)} ×1`);
        return;
      }
      if (s.t === 'sac') {
        const have = s.high ? (inv['purple'] || 0) + (inv['green'] || 0) : (inv['green'] || 0);
        if (have < 1) parts.push(`${label} ×1`);
        return;
      }
      const pool = s.t === 'beetle' ? BEETLES : s.t === 'flower' ? ALL_FLOWERS : [];
      const have = pool.filter(k => !s.r || RARITY[k] === s.r).reduce((n, k) => n + (inv[k] || 0), 0);
      const need = (s === spec.sm1 && spec.sm0?.t === s.t && spec.sm0?.r === s.r) ? 2 : 1;
      if (have < need) parts.push(`${label} ×${need - have}`);
    };
    checkSpec(spec.sm0, sLabel(spec.sm0));
    checkSpec(spec.sm1, sLabel(spec.sm1));
    checkSpec(spec.sac, sLabel(spec.sac));
    expand.innerHTML = parts.length
      ? `<span class="rcp-missing">Need: ${parts.join(', ')}</span>`
      : '<span class="rcp-can-craft">✓ Ready</span>';
  }
  row.appendChild(expand);

  let expanded = false;
  row.addEventListener('click', () => {
    if (craftable) {
      fillSmash(spec);
    } else {
      expanded = !expanded;
      expand.classList.toggle('hidden', !expanded);
    }
  });
  return row;
}

function renderRecipes(filter = '') {
  const q   = filter.toLowerCase();
  const inv = state.inv;

  const asmRows = AR
    .filter(r => !(TROPHY_REPEAT[r.out] && (inv[r.out] || 0) > 0))
    .filter(r => !r.reqTrophy || (inv[r.reqTrophy] || 0) > 0)
    .filter(r => !q ||
      (r.name ?? iname(r.out)).toLowerCase().includes(q) ||
      r.ing.some(ing => 'key' in ing
        ? iname(ing.key).toLowerCase().includes(q)
        : ingGroupLabel(ing.group).toLowerCase().includes(q)));

  const smashRows = RECIPES.filter(([ing, out, typ]) =>
    typ === 'smash' && (!q || ing.toLowerCase().includes(q) || out.toLowerCase().includes(q)));

  const wrap = document.getElementById('recipe-table-wrap');
  wrap.innerHTML = '';

  const addSection = label => {
    const hdr = document.createElement('div');
    hdr.className = 'rcp-hdr';
    hdr.textContent = label;
    wrap.appendChild(hdr);
  };

  if (asmRows.length) {
    addSection('⚙ ASSEMBLE');
    asmRows.forEach(r => wrap.appendChild(makeAsmRow(r, inv)));
  }
  if (smashRows.length) {
    addSection('⚡ SMASH');
    smashRows.forEach(([ing, out,, note]) => wrap.appendChild(makeSmashRow(ing, out, note)));
  }
  if (!asmRows.length && !smashRows.length)
    wrap.innerHTML = '<div class="nothing-craftable">No recipes match.</div>';
}
