// BeetleBoy SP · "What next?" advisor: missing beetles and trophies, the
// recipes that make them, and what you still lack for each.
// Classic script sharing globals with the others; load order is set in index.html.

// ── ADVISOR ───────────────────────────────────────────────────────────────────
const RARITY_ORDER = ['tin', 'brz', 'mth', 'adm', 'dia', 'pnk'];

// one ingredient: {label, have, need, ok, hint}
function advIng(label, have, need, key) {
  const ok = have >= need;
  let hint = '';
  if (!ok && key) {
    const r = AR_BY_OUT[key];
    if (r && craftCount(r, state.inv) > 0) hint = 'you can assemble it';
    else if (smashSourcesFor(key).some(x => smashCraftable(x.spec))) hint = 'you can smash for it';
  }
  return { label, have, need, ok, hint };
}

function specLabel(s) {
  if (!s) return '';
  if (s.k) return iname(s.k);
  if (s.t === 'sac') return s.high ? 'Purple or Green sacrifice' : 'Green sacrifice';
  return `${s.r ? RARITY_NAMES[s.r] + ' ' : 'any '}${s.t}`;
}

function specTotal(s) {
  const inv = state.inv;
  if (!s) return 0;
  if (s.k) return inv[s.k] || 0;
  if (s.t === 'sac') return s.high ? (inv.purple || 0) + (inv.green || 0) : (inv.green || 0);
  const pool = s.t === 'beetle' ? BEETLES : s.t === 'flower' ? ALL_FLOWERS : [];
  return pool.filter(k => !s.r || RARITY[k] === s.r).reduce((n, k) => n + (inv[k] || 0), 0);
}

// smash recipes whose result names this item (exactly, or as one of a random set)
function smashSourcesFor(key) {
  const name = iname(key).toLowerCase();
  return RECIPES.filter(([, out, type]) => type === 'smash')
    .filter(([, out]) => out.toLowerCase() === name || out.toLowerCase().split(/, | or /).includes(name))
    .map(([ing, out, , note]) => ({ ing, out, note, spec: SMASH_FILL_MAP.get(ing) }))
    .filter(x => x.spec);
}

function advisorPlans(key) {
  const plans = [];
  for (const r of AR.filter(r => r.out === key)) {
    const ings = r.ing.map(ing => 'group' in ing
      ? advIng(ingGroupLabel(ing.group), ing.group === 'junk' ? junkPool(state.inv).length : ing.group.reduce((n, k) => n + (state.inv[k] || 0), 0), ing.qty)
      : advIng(iname(ing.key), state.inv[ing.key] || 0, ing.qty, ing.key));
    plans.push({ kind: 'assemble', recipe: r, ings });
  }
  for (const src of smashSourcesFor(key)) {
    const { sm0, sm1, sac } = src.spec;
    const same = sm0 && sm1 && ((sm0.k && sm0.k === sm1.k) || (sm0.t && sm0.t === sm1.t && sm0.r === sm1.r));
    const ings = [];
    if (same) ings.push(advIng(specLabel(sm0) + ' ×2', specTotal(sm0), 2, sm0.k));
    else {
      if (sm0) ings.push(advIng(specLabel(sm0), specTotal(sm0), 1, sm0.k));
      if (sm1) ings.push(advIng(specLabel(sm1), specTotal(sm1), 1, sm1.k));
    }
    if (sac) ings.push(advIng(specLabel(sac), specTotal(sac), 1, sac.k));
    plans.push({ kind: 'smash', spec: src.spec, note: src.note, random: src.out.toLowerCase() !== iname(key).toLowerCase(), ings });
  }
  for (const p of plans) p.missing = p.ings.filter(i => !i.ok).length;
  return plans.sort((a, b) => a.missing - b.missing);
}

function renderAdvisor() {
  const el = document.getElementById('advisor-list');
  if (!el || !state.user) return;
  const inv = state.inv;
  const targets = [
    ...BEETLES.filter(k => !(inv[k] > 0)).map(k => ({ key: k, kind: 'beetle' })),
    ...TROPHIES.filter(([k]) => !(inv[k] > 0)).map(([k]) => ({ key: k, kind: 'trophy' })),
  ];
  const withPlans = [], dropOnly = [];
  for (const t of targets) {
    const plans = advisorPlans(t.key);
    if (plans.length) withPlans.push({ ...t, plans, best: plans[0].missing });
    else dropOnly.push(t);
  }
  withPlans.sort((a, b) => a.best - b.best || RARITY_ORDER.indexOf(RARITY[b.key]) - RARITY_ORDER.indexOf(RARITY[a.key]));
  const ingHtml = i => `<span class="adv-ing ${i.ok ? 'ok' : 'need'}">${esc(i.label)} ${i.have.toLocaleString()}/${i.need}${i.hint ? ` <em>· ${i.hint}</em>` : ''}</span>`;
  el.innerHTML = `<div class="adv-head">${withPlans.filter(t => t.best === 0).length} ready · ${withPlans.length} with a known recipe · ${dropOnly.length} only from claims, hunts or secret recipes</div>` +
    withPlans.map((t, ti) => {
      const p = t.plans[0];
      const icon = IMAGES[t.key];
      return `<div class="adv-row ${t.best === 0 ? 'ready' : ''}">
        <div class="adv-title">${icon ? `<img src="${esc(icon)}" alt="">` : ''}<span class="adv-name ${rcls(t.key)}" data-key="${esc(t.key)}">${esc(iname(t.key))}</span>
          <span class="adv-status">${t.best === 0 ? 'READY' : `missing ${t.best}`}</span>
          <button class="tree-open" data-tree="${esc(t.key)}" type="button" title="Crafting tree">🌳</button>
          ${t.best === 0 ? `<button class="adv-setup" data-t="${ti}" type="button">Set up</button>` : ''}</div>
        <div class="adv-recipe"><span class="adv-kind">${p.kind === 'smash' ? 'SMASH' : 'ASSEMBLE'}${p.random ? ' · random outcome' : ''}${p.note ? ` · ${esc(p.note)}` : ''}</span>${p.ings.map(ingHtml).join('<span class="adv-plus">+</span>')}</div>
        ${t.plans.length > 1 ? `<div class="adv-more">${t.plans.length - 1} other recipe${t.plans.length > 2 ? 's' : ''}</div>` : ''}
      </div>`;
    }).join('');
  el.querySelectorAll('.adv-setup').forEach(btn => btn.addEventListener('click', () => {
    const p = withPlans[+btn.dataset.t].plans[0];
    if (p.kind === 'smash') fillSmash(p.spec);
    else {
      clearSlots('asm');
      const slots = pickSlots(p.recipe, state.inv);
      if (slots) ASM_SLOTS.forEach((id, i) => { if (slots[i]) { slotState[id] = slots[i]; renderSlot(id); } });
      setScreenMode(SCREEN.ASSEMBLE);
    }
    log(`Set up: ${iname(withPlans[+btn.dataset.t].key)}. Check the slots, then press the button.`);
  }));
  el.querySelectorAll('.adv-name[data-key]').forEach(n => n.addEventListener('click', () => openCard(n.dataset.key)));
  el.querySelectorAll('[data-tree]').forEach(b => b.addEventListener('click', () => openTree(b.dataset.tree)));
}
