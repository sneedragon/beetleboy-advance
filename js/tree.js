// BeetleBoy SP · Crafting tree: pull up any item and fold open how to make it,
// recipe by recipe, ingredient by ingredient, all the way down.
// Classic script sharing globals with the others; load order is set in index.html.

// ── CRAFTING TREE ─────────────────────────────────────────────────────────────
// Recipes that make an item: assemble recipes (AR) and smash recipes.
function treeRecipes(key) {
  const out = [];
  for (const r of AR.filter(r => r.out === key)) {
    out.push({
      kind: 'assemble', recipe: r,
      note: r.reqTrophy ? `needs the ${iname(r.reqTrophy)} first` : (r.unique ? 'one-time' : ''),
      ings: r.ing.map(ing => 'group' in ing
        ? { group: ing.group, label: ingGroupLabel(ing.group), need: ing.qty,
            have: ing.group === 'junk' ? junkPool(state.inv).length : ing.group.reduce((n, k) => n + (state.inv[k] || 0), 0) }
        : { key: ing.key, label: iname(ing.key), need: ing.qty, have: state.inv[ing.key] || 0 }),
    });
  }
  for (const src of smashSourcesFor(key)) {
    const { sm0, sm1, sac } = src.spec;
    const same = sm0 && sm1 && ((sm0.k && sm0.k === sm1.k) || (sm0.t && sm0.t === sm1.t && sm0.r === sm1.r));
    const fromSpec = (s, need) => ({ key: s.k || null, spec: s, label: specLabel(s), need, have: specTotal(s) });
    const ings = same ? [fromSpec(sm0, 2)] : [sm0 && fromSpec(sm0, 1), sm1 && fromSpec(sm1, 1)].filter(Boolean);
    if (sac) ings.push({ ...fromSpec(sac, 1), sacrifice: true });
    const random = src.out.toLowerCase() !== iname(key).toLowerCase();
    out.push({ kind: 'smash', spec: src.spec, ings, note: [random ? `random: ${src.out}` : '', src.note].filter(Boolean).join(' · ') });
  }
  for (const r of out) r.ready = r.ings.every(i => i.have >= i.need);
  return out;
}

const treeIcon = k => IMAGES[k] ? `<img class="tree-ico" src="${esc(IMAGES[k])}" alt="">` : '<span class="tree-ico"></span>';

// An item line; folds open into the recipes that make it (built when opened)
function treeItemNode(key, need, have, path, open) {
  const recipes = treeRecipes(key);
  const enough = have >= need;
  const label = `${treeIcon(key)}<span class="tree-name ${rcls(key)}" data-card="${esc(key)}">${esc(iname(key))}</span>` +
    `<span class="tree-count ${enough ? 'ok' : 'need'}">${have.toLocaleString()}${need ? ` / ${need}` : ''}</span>`;
  const loop = path.includes(key);
  if (!recipes.length || loop) {
    const why = loop ? 'see above' : (BEETLES.includes(key) || ALL_FLOWERS.includes(key) ? 'from claims & hunts' : (key in AR_BY_OUT ? '' : 'no known recipe'));
    return `<div class="tree-leaf">${label}${why ? `<span class="tree-note">${why}</span>` : ''}</div>`;
  }
  return `<details class="tree-item"${open ? ' open' : ''} data-key="${esc(key)}" data-path="${esc([...path, key].join(','))}">
    <summary>${label}<span class="tree-note">${recipes.length} recipe${recipes.length > 1 ? 's' : ''}${recipes.some(r => r.ready) ? ' · <b>ready</b>' : ''}</span></summary>
    <div class="tree-kids"></div></details>`;
}

function treeRecipeNode(r, idx, path) {
  const ingHtml = r.ings.map(i => i.key
    ? treeItemNode(i.key, i.need, i.have, path, false)
    : `<div class="tree-leaf"><span class="tree-ico tree-ico-group"></span><span class="tree-name">${esc(i.label)}</span>` +
      `<span class="tree-count ${i.have >= i.need ? 'ok' : 'need'}">${i.have.toLocaleString()} / ${i.need}</span>${i.sacrifice ? '<span class="tree-note">sacrifice</span>' : ''}</div>`).join('');
  return `<div class="tree-recipe ${r.ready ? 'ready' : ''}">
    <div class="tree-recipe-head"><span class="tree-kind">${r.kind === 'smash' ? 'SMASH' : 'ASSEMBLE'}</span>${r.note ? `<span class="tree-note">${esc(r.note)}</span>` : ''}
      ${r.ready ? `<button type="button" class="tree-setup" data-r="${idx}">Set up</button>` : ''}</div>
    <div class="tree-ings">${ingHtml}</div></div>`;
}

let treeRecipeRefs = [];   // recipes behind the "Set up" buttons
function fillTreeKids(det) {
  const kids = det.querySelector(':scope > .tree-kids');
  if (!kids || kids.dataset.done) return;
  kids.dataset.done = '1';
  const path = det.dataset.path.split(',');
  kids.innerHTML = treeRecipes(det.dataset.key).map(r => { treeRecipeRefs.push(r); return treeRecipeNode(r, treeRecipeRefs.length - 1, path); }).join('');
}

function openTree(key) {
  let modal = document.getElementById('tree-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tree-modal';
    modal.innerHTML = `<div class="tree-box" role="dialog" aria-modal="true" aria-labelledby="tree-title">
      <div class="tree-top"><span id="tree-title"></span>
        <button type="button" class="tree-btn" id="tree-expand" title="Open every branch">expand all</button>
        <button type="button" class="tree-btn" id="tree-close" aria-label="Close">✕</button></div>
      <div class="tree-body" id="tree-body"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeTree(); });
    modal.querySelector('#tree-close').addEventListener('click', closeTree);
    modal.querySelector('#tree-expand').addEventListener('click', () => {
      // a few rounds: opening a branch creates new ones underneath
      for (let round = 0; round < 6; round++) modal.querySelectorAll('details.tree-item:not([open])').forEach(d => { d.open = true; fillTreeKids(d); });
    });
    modal.addEventListener('toggle', e => { if (e.target.matches?.('details.tree-item') && e.target.open) fillTreeKids(e.target); }, true);
    modal.addEventListener('click', e => {
      const setup = e.target.closest('.tree-setup');
      if (setup) {
        const r = treeRecipeRefs[+setup.dataset.r];
        if (r.kind === 'smash') fillSmash(r.spec);
        else {
          clearSlots('asm');
          const slots = pickSlots(r.recipe, state.inv);
          if (slots) ASM_SLOTS.forEach((id, i) => { if (slots[i]) { slotState[id] = slots[i]; renderSlot(id); } });
          setScreenMode(SCREEN.ASSEMBLE);
        }
        log('Recipe set up from the crafting tree. Check the slots, then press the button.');
        closeTree();
      }
    });
    modal.addEventListener('dblclick', e => { const c = e.target.closest('[data-card]'); if (c) { closeTree(); openCard(c.dataset.card); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('tree-modal')?.classList.contains('open')) closeTree(); });
  }
  treeRecipeRefs = [];
  modal.querySelector('#tree-title').innerHTML = `🌳 ${treeIcon(key)} ${esc(iname(key))}`;
  const body = modal.querySelector('#tree-body');
  body.innerHTML = treeItemNode(key, 0, state.inv[key] || 0, [], true) +
    '<p class="tree-hint">Tap a line to fold it open. Double-tap a name to open its card.</p>';
  const root = body.querySelector('details.tree-item');
  if (root) {
    fillTreeKids(root);
    root.querySelectorAll(':scope > .tree-kids details.tree-item').forEach(d => { d.open = true; fillTreeKids(d); });  // second level open
  }
  modal.classList.add('open');
  sfx('panel');
}

function closeTree() {
  document.getElementById('tree-modal')?.classList.remove('open');
}
