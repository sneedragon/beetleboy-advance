// BeetleBoy SP · Crafting tree: a pannable, zoomable chart of how an item is
// made. Ingredients sit on the left and flow right into what they make.
// Classic script sharing globals with the others; load order is set in index.html.

// ── CRAFTING TREE ─────────────────────────────────────────────────────────────
const TREE_COL = 190, TREE_ROW = 118, TREE_MAX_DEPTH = 7;
const TREE_COLORS = { assemble: '#f2c618', smash: '#ff3b30', random: '#ff8a1e' };

// Recipes that make an item: assemble recipes (AR) and smash recipes.
function treeRecipes(key) {
  const out = [];
  for (const r of AR.filter(r => r.out === key)) {
    out.push({
      kind: 'assemble', recipe: r,
      note: r.reqTrophy ? `after the ${iname(r.reqTrophy)}` : (r.unique ? 'one-time' : ''),
      ings: r.ing.map(ing => 'group' in ing
        ? { group: true, label: ingGroupLabel(ing.group), need: ing.qty,
            have: ing.group === 'junk' ? junkPool(state.inv).length : ing.group.reduce((n, k) => n + (state.inv[k] || 0), 0) }
        : { key: ing.key, need: ing.qty, have: state.inv[ing.key] || 0 }),
    });
  }
  for (const src of smashSourcesFor(key)) {
    const { sm0, sm1, sac } = src.spec;
    const same = sm0 && sm1 && ((sm0.k && sm0.k === sm1.k) || (sm0.t && sm0.t === sm1.t && sm0.r === sm1.r));
    const fromSpec = (s, need, extra = {}) => s.k
      ? { key: s.k, need, have: specTotal(s), ...extra }
      : { group: true, label: specLabel(s), need, have: specTotal(s), ...extra };
    const ings = same ? [fromSpec(sm0, 2)] : [sm0 && fromSpec(sm0, 1), sm1 && fromSpec(sm1, 1)].filter(Boolean);
    if (sac) ings.push(fromSpec(sac, 1, { sacrifice: true }));
    const random = src.out.toLowerCase() !== iname(key).toLowerCase();
    out.push({ kind: random ? 'random' : 'smash', spec: src.spec, ings, note: random ? `random: ${src.out}` : (src.note || '') });
  }
  for (const r of out) r.ready = r.ings.every(i => i.have >= i.need);
  // best first: ready, then fewest missing
  return out.sort((a, b) => (b.ready - a.ready) || (a.ings.filter(i => i.have < i.need).length - b.ings.filter(i => i.have < i.need).length));
}

// ── model: item nodes with one chosen recipe each (switchable) ──
const treeState = { root: null, choice: {}, collapsed: {}, view: { x: 0, y: 0, k: 1 } };

function buildTreeNode(item, path, depth, id) {
  const node = { id, ...item, kids: [], recipes: [], ri: 0 };
  if (item.group || !item.key) return node;
  node.recipes = treeRecipes(item.key);
  node.loop = path.includes(item.key);
  if (!node.recipes.length || node.loop || depth >= TREE_MAX_DEPTH) return node;
  node.ri = Math.min(treeState.choice[id] || 0, node.recipes.length - 1);
  const r = node.recipes[node.ri];
  node.kind = r.kind;
  if (treeState.collapsed[id] ?? depth >= 3) { node.folded = true; return node; }
  node.kids = r.ings.map((ing, i) => buildTreeNode(ing, [...path, item.key], depth + 1, `${id}.${node.ri}.${i}`));
  return node;
}

// ── layout: leaves get rows, parents sit in the middle of their kids; root on the right ──
function layoutTree(root) {
  let row = 0, maxDepth = 0;
  const place = (n, d) => {
    n.depth = d; maxDepth = Math.max(maxDepth, d);
    if (n.kids.length) { n.kids.forEach(k => place(k, d + 1)); n.row = (n.kids[0].row + n.kids[n.kids.length - 1].row) / 2; }
    else n.row = row++;
  };
  place(root, 0);
  const all = [];
  const walk = n => { n.x = (maxDepth - n.depth) * TREE_COL + 80; n.y = n.row * TREE_ROW + 70; all.push(n); n.kids.forEach(walk); };
  walk(root);
  return { all, width: (maxDepth + 1) * TREE_COL + 60, height: Math.max(row, 1) * TREE_ROW + 40 };
}

function renderTreeChart() {
  const svg = document.getElementById('tree-svg');
  treeState.root = buildTreeNode({ key: treeState.key, need: 0, have: state.inv[treeState.key] || 0 }, [], 0, 'r');
  const { all, width, height } = layoutTree(treeState.root);
  treeState.size = { width, height };
  const t = s => s.length > 18 ? s.slice(0, 17) + '…' : s;
  let edges = '', nodes = '';
  for (const n of all) {
    if (n.kids.length) {
      const col = TREE_COLORS[n.kind] || TREE_COLORS.assemble;
      const busX = n.x - TREE_COL / 2 + 10;
      for (const k of n.kids) edges += `<path d="M${k.x + 40},${k.y} H${busX} V${n.y}" stroke="${col}" />`;
      edges += `<path d="M${busX},${n.y} H${n.x - 48}" stroke="${col}" marker-end="url(#tree-arrow-${n.kind || 'assemble'})" />`;
    }
    const enough = n.need ? n.have >= n.need : n.have > 0;
    const img = n.key && IMAGES[n.key];
    const name = n.group ? n.label : iname(n.key);
    const count = n.need ? `${n.have.toLocaleString()} / ${n.need}` : `have ${n.have.toLocaleString()}`;
    const multi = n.recipes.length > 1 && !n.folded ? `<g class="tree-switch" data-id="${n.id}"><rect x="${n.x + 22}" y="${n.y - 52}" width="44" height="17" rx="8"/><text x="${n.x + 44}" y="${n.y - 40}">⇄ ${n.ri + 1}/${n.recipes.length}</text></g>` : '';
    const ready = n.recipes[n.ri]?.ready && n.recipes.length && !n.loop ? `<g class="tree-ready" data-id="${n.id}"><rect x="${n.x - 34}" y="${n.y + 54}" width="68" height="17" rx="8"/><text x="${n.x}" y="${n.y + 66}">Set up</text></g>` : '';
    const fold = n.recipes.length && !n.loop ? `<text class="tree-fold" x="${n.x - 46}" y="${n.y - 30}">${n.folded ? '＋' : '−'}</text>` : '';
    nodes += `<g class="tree-node ${n.group ? 'group' : ''} ${n.recipes.length && !n.loop ? 'has-recipe' : ''}" data-id="${n.id}"${n.key ? ` data-key="${esc(n.key)}"` : ''}>
      <circle cx="${n.x}" cy="${n.y}" r="38" class="tree-halo ${enough ? 'ok' : 'need'}"/>
      ${img ? `<image href="${esc(img)}" x="${n.x - 32}" y="${n.y - 32}" width="64" height="64" filter="url(#tree-glow)"/>` : `<rect x="${n.x - 24}" y="${n.y - 24}" width="48" height="48" rx="8" class="tree-groupbox"/><text class="tree-grouptext" x="${n.x}" y="${n.y + 5}">ANY</text>`}
      <text class="tree-label" x="${n.x}" y="${n.y + 44}">${esc(t(name))}${n.sacrifice ? ' (sac)' : ''}</text>
      <text class="tree-count ${enough ? 'ok' : 'need'}" x="${n.x}" y="${n.y + 56 + (ready ? 22 : 0)}">${count}${n.loop ? ' · see right' : ''}</text>
      ${fold}${multi}${ready}</g>`;
  }
  svg.querySelector('#tree-world').innerHTML = `<g class="tree-edges">${edges}</g>${nodes}`;
  const recipe = treeState.root.recipes[treeState.root.ri];
  document.getElementById('tree-legend').innerHTML = `<span style="color:${TREE_COLORS.assemble}">━ assemble</span> <span style="color:${TREE_COLORS.smash}">━ smash</span> <span style="color:${TREE_COLORS.random}">━ smash, random result</span>` +
    (recipe?.note ? ` · ${esc(recipe.note)}` : '');
  applyTreeView();
}

// ── pan & zoom ──
function applyTreeView() {
  const v = treeState.view;
  document.getElementById('tree-world').setAttribute('transform', `translate(${v.x},${v.y}) scale(${v.k})`);
  document.getElementById('tree-svg').style.backgroundPosition = `${v.x}px ${v.y}px`;
  document.getElementById('tree-svg').style.backgroundSize = `${40 * v.k}px ${40 * v.k}px`;
}
function fitTree() {
  const box = document.getElementById('tree-svg').getBoundingClientRect();
  const { width, height } = treeState.size;
  const k = Math.min(1.4, Math.max(0.25, Math.min(box.width / width, box.height / height) * 0.95));
  treeState.view = { k, x: (box.width - width * k) / 2, y: (box.height - height * k) / 2 };
  applyTreeView();
}
function zoomTree(f, cx, cy) {
  const v = treeState.view, k = Math.min(3, Math.max(0.2, v.k * f));
  const box = document.getElementById('tree-svg').getBoundingClientRect();
  cx ??= box.width / 2; cy ??= box.height / 2;
  v.x = cx - (cx - v.x) * (k / v.k); v.y = cy - (cy - v.y) * (k / v.k); v.k = k;
  applyTreeView();
}

function findTreeNode(id, n = treeState.root) {
  if (!n) return null;
  if (n.id === id) return n;
  for (const k of n.kids) { const f = findTreeNode(id, k); if (f) return f; }
  return null;
}

function setupTreeRecipe(n) {
  const r = n.recipes[n.ri];
  if (r.kind !== 'assemble') fillSmash(r.spec);
  else {
    clearSlots('asm');
    const slots = pickSlots(r.recipe, state.inv);
    if (slots) ASM_SLOTS.forEach((id, i) => { if (slots[i]) { slotState[id] = slots[i]; renderSlot(id); } });
    setScreenMode(SCREEN.ASSEMBLE);
  }
  log(`Set up ${iname(n.key)} from the crafting tree. Check the slots, then press the button.`);
}

// The tree lives on the device's main screen (screen mode TREE); wired once
let treeWired = false;
function wireTree() {
  if (treeWired) return;
  treeWired = true;
  const m = document.getElementById('sp-tree');
  document.getElementById('tree-defs').innerHTML =
    `<filter id="tree-glow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#fff" flood-opacity=".55"/></filter>` +
    Object.entries(TREE_COLORS).map(([k, c]) => `<marker id="tree-arrow-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('');
  const svg = m.querySelector('#tree-svg');
  m.querySelector('#tree-close').addEventListener('click', closeTree);
  m.querySelector('#tree-fit').addEventListener('click', fitTree);
  m.querySelector('#tree-zoom-in').addEventListener('click', () => zoomTree(1.25));
  m.querySelector('#tree-zoom-out').addEventListener('click', () => zoomTree(0.8));
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const b = svg.getBoundingClientRect();
    zoomTree(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - b.left, e.clientY - b.top);
  }, { passive: false });
  // drag to pan, two fingers to pinch
  const pts = new Map();
  let moved = 0, pinch = null;
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; });
  svg.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const [a2, b2] = [...pts.values()];
      const d2 = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      const r = svg.getBoundingClientRect();
      if (pinch != null) zoomTree(d2 / d, (a2.x + b2.x) / 2 - r.left, (a2.y + b2.y) / 2 - r.top);
      pinch = d2; moved += 10;
      return;
    }
    treeState.view.x += e.clientX - p.x; treeState.view.y += e.clientY - p.y;
    moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
    p.x = e.clientX; p.y = e.clientY;
    applyTreeView();
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('click', e => {
    if (moved > 6) return;                     // that was a drag
    const sw = e.target.closest('.tree-switch'), rd = e.target.closest('.tree-ready'), nd = e.target.closest('.tree-node.has-recipe');
    if (sw) { const n = findTreeNode(sw.dataset.id); treeState.choice[n.id] = (n.ri + 1) % n.recipes.length; renderTreeChart(); return; }
    if (rd) { setupTreeRecipe(findTreeNode(rd.dataset.id)); return; }
    if (nd) { const n = findTreeNode(nd.dataset.id); treeState.collapsed[n.id] = !n.folded; renderTreeChart(); }
  });
  svg.addEventListener('dblclick', e => { const n = e.target.closest('.tree-node[data-key]'); if (n) openCard(n.dataset.key); });
}

function openTree(key) {
  wireTree();
  Object.assign(treeState, { key, choice: {}, collapsed: {} });
  document.getElementById('tree-title').textContent = `🌳 ${iname(key)}`;
  if (screenMode !== SCREEN.TREE) setScreenMode(SCREEN.TREE);
  renderTreeChart();
  requestAnimationFrame(fitTree);
  sfx('panel');
}

function closeTree() { if (screenMode === SCREEN.TREE) setScreenMode(SCREEN.LOG); }
