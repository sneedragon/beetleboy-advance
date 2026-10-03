// BeetleBoy SP · Crafting tree on the main screen: a pannable, zoomable chart.
// The chosen item sits in the middle; to the left is how it's made (down to
// the raw ingredients), to the right what it's used for (and what that makes).
// Classic script sharing globals with the others; load order is set in index.html.

// ── CRAFTING TREE ─────────────────────────────────────────────────────────────
const TREE_COL = 190, TREE_ROW = 118, TREE_MAX_DEPTH = 7;
const TREE_COLORS = { assemble: '#f2c618', smash: '#ff3b30', random: '#ff8a1e', sac: '#8a8fa8' };

const TYPE_POOL = { beetle: () => BEETLES, flower: () => ALL_FLOWERS };
const tierOf = name => Object.entries(RARITY_NAMES).find(([, n]) => n.toLowerCase() === name.toLowerCase())?.[0];

// Does a smash slot spec accept this item?
function specAccepts(s, key) {
  if (!s) return false;
  if (s.k) return s.k === key;
  if (s.t === 'sac') return key === 'green' || (s.high && key === 'purple');
  return !!TYPE_POOL[s.t]?.().includes(key) && (!s.r || RARITY[key] === s.r);
}

// A smash result text, split into the items (or kinds of item) it can give.
// "Bronze Flower (random)" → any Bronze flower; "Nectar or Cattail" → two items.
function parseOutputs(text) {
  const random = /\(random\)|, | or /i.test(text);
  return text.replace(/\s*\(random\)\s*/i, '').split(/, | or /).map(part => {
    const key = Object.keys(NAMES).find(k => NAMES[k].toLowerCase() === part.toLowerCase());
    if (key) return { key };
    const m = part.match(/^(\w+) (Flower|Beetle)$/i);
    if (m && tierOf(m[1])) return { group: true, label: `any ${RARITY_NAMES[tierOf(m[1])]} ${m[2].toLowerCase()}`, tier: tierOf(m[1]), type: m[2].toLowerCase() };
    return { group: true, label: part };
  }).map(o => ({ ...o, random }));
}

const outputMatches = (o, key) => o.key ? o.key === key : (!!o.tier && RARITY[key] === o.tier && !!TYPE_POOL[o.type]?.().includes(key));

// ── how an item is made ──
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
  const pinned = pinnedBeetle(key);
  for (const [ing, text, type, note] of RECIPES) {
    if (type !== 'smash') continue;
    const spec = SMASH_FILL_MAP.get(ing);
    if (!spec) continue;
    let outs = parseOutputs(text);
    if (pinned && /that beetle's trophy/i.test(text)) outs = [{ key, random: false }];
    if (!outs.some(o => outputMatches(o, key))) continue;
    const { sm0, sm1, sac } = spec;
    const same = sm0 && sm1 && ((sm0.k && sm0.k === sm1.k) || (sm0.t && sm0.t === sm1.t && sm0.r === sm1.r));
    const fromSpec = (s, need, extra = {}) => s.k
      ? { key: s.k, need, have: specTotal(s), ...extra }
      : { group: true, label: specLabel(s), need, have: specTotal(s), ...extra };
    let ings = same ? [fromSpec(sm0, 2)] : [sm0 && fromSpec(sm0, 1), sm1 && fromSpec(sm1, 1)].filter(Boolean);
    if (pinned) ings = ings.map(i => i.group && /beetle/.test(i.label) ? { key: pinned, need: 1, have: state.inv[pinned] || 0 } : i);
    if (sac) ings.push(fromSpec(sac, 1, { sacrifice: true }));
    const random = outs.length > 1 || outs[0].random || !outs[0].key;
    out.push({ kind: random ? 'random' : 'smash', spec, ings, note: random ? `random: ${text}` : (note || '') });
  }
  for (const r of out) r.ready = r.ings.every(i => i.have >= i.need);
  return out.sort((a, b) => (b.ready - a.ready) || (a.ings.filter(i => i.have < i.need).length - b.ings.filter(i => i.have < i.need).length));
}

// ── what an item is used for ──
function treeUses(key) {
  const uses = [];
  const inv = state.inv;
  for (const r of AR) {
    if (r.unique && inv[r.out] > 0 && TROPHY_REPEAT[r.out]) continue;        // trophy owned: its repeat recipe covers it
    if (r.reqTrophy && !(inv[r.reqTrophy] > 0)) continue;                     // repeat recipe not unlocked yet
    if (!r.ing.some(ing => ing.key === key || (Array.isArray(ing.group) && ing.group.includes(key)) || (ing.group === 'junk' && isJunk(key)))) continue;
    uses.push({ kind: 'assemble', outs: [{ key: r.out }], ready: craftCount(r, inv) > 0, setup: { recipe: r } });
  }
  let sacCount = 0;
  for (const [ing, text, type] of RECIPES) {
    if (type !== 'smash') continue;
    const spec = SMASH_FILL_MAP.get(ing);
    if (!spec) continue;
    if (specAccepts(spec.sm0, key) || specAccepts(spec.sm1, key)) {
      let outs = parseOutputs(text);
      if (/that beetle's trophy/i.test(text)) outs = BEETLES.includes(key) ? [{ key: `trophy_${key}` }] : [{ group: true, label: 'a pinned specimen' }];
      const random = outs.length > 1 || outs.some(o => o.random || !o.key);
      uses.push({ kind: random ? 'random' : 'smash', outs, ready: smashCraftable(spec), setup: { spec } });
    } else if (specAccepts(spec.sac, key)) sacCount++;
  }
  if (sacCount) uses.push({ kind: 'sac', outs: [{ group: true, label: `sacrifice in ${sacCount} smash recipes` }], ready: false });
  return uses;
}

// ── model ──
const treeState = { key: null, root: null, choice: {}, collapsed: {}, view: { x: 0, y: 0, k: 1 }, size: { width: 1, height: 1 } };
const isFolded = (id, depth) => treeState.collapsed[id] ?? depth >= 2;

function buildIn(item, path, depth, id, kind) {
  const node = { id, dir: 'in', kind, ...item, kids: [], recipes: [], ri: 0 };
  if (item.group || !item.key) return node;
  node.have = state.inv[item.key] || 0;
  node.recipes = treeRecipes(item.key);
  node.loop = path.includes(item.key);
  node.canFold = node.recipes.length > 0 && !node.loop && depth < TREE_MAX_DEPTH;
  if (!node.canFold) return node;
  node.ri = Math.min(treeState.choice[id] || 0, node.recipes.length - 1);
  node.folded = isFolded(id, depth);
  if (node.folded) return node;
  const r = node.recipes[node.ri];
  node.kids = r.ings.map((ing, i) => buildIn(ing, [...path, item.key], depth + 1, `${id}.${node.ri}.${i}`, r.kind));
  return node;
}

function buildOut(item, path, depth, id, use) {
  const node = { id, dir: 'out', kind: use?.kind, use, ...item, kids: [], recipes: [] };
  if (item.group || !item.key) return node;
  node.have = state.inv[item.key] || 0;
  node.loop = path.includes(item.key);
  const uses = node.loop || depth >= TREE_MAX_DEPTH ? [] : treeUses(item.key);
  node.canFold = uses.length > 0;
  if (!node.canFold) return node;
  node.folded = isFolded(id, depth);
  if (node.folded) return node;
  uses.forEach((u, ui) => u.outs.forEach((o, oi) => node.kids.push(buildOut(o, [...path, item.key], depth + 1, `${id}.${ui}.${oi}`, u))));
  return node;
}

function buildTree(key) {
  const root = buildIn({ key, need: 0 }, [], 0, 'r');
  root.dir = 'root';
  root.kidsIn = root.folded ? [] : root.kids;
  root.foldedIn = root.folded;
  const outRoot = buildOut({ key }, [], 0, 'o');
  root.kidsOut = outRoot.folded ? [] : outRoot.kids;
  root.foldedOut = outRoot.folded; root.canFoldOut = outRoot.canFold;
  root.canFoldIn = root.canFold;
  root.kids = [];
  return root;
}

// ── layout: each side gets its own rows; both line up on the middle item ──
function layoutTree(root) {
  const placeSide = (kids, sign) => {
    let row = 0;
    const all = [];
    const place = (n, d) => {
      n.depth = d; n.sign = sign; all.push(n);
      if (n.kids.length) { n.kids.forEach(k => place(k, d + 1)); n.row = (n.kids[0].row + n.kids[n.kids.length - 1].row) / 2; }
      else n.row = row++;
    };
    kids.forEach(k => place(k, 1));
    const rootRow = kids.length ? (kids[0].row + kids[kids.length - 1].row) / 2 : 0;
    return { all, rootRow, rows: row };
  };
  const L = placeSide(root.kidsIn, -1), R = placeSide(root.kidsOut, 1);
  const center = Math.max(L.rootRow, R.rootRow);
  for (const n of L.all) n.row += center - L.rootRow;
  for (const n of R.all) n.row += center - R.rootRow;
  root.row = center; root.depth = 0; root.sign = 0;
  const all = [root, ...L.all, ...R.all];
  const maxL = Math.max(0, ...L.all.map(n => n.depth)), maxR = Math.max(0, ...R.all.map(n => n.depth));
  for (const n of all) { n.x = (maxL + n.sign * n.depth) * TREE_COL + 90; n.y = n.row * TREE_ROW + 80; }
  const rows = Math.max(center + Math.max(L.rows - L.rootRow, R.rows - R.rootRow, 1), 1);
  return { all, width: (maxL + maxR + 1) * TREE_COL + 120, height: (rows + 1) * TREE_ROW };
}

// ── drawing ──
function renderTreeChart() {
  const root = treeState.root = buildTree(treeState.key);
  const { all, width, height } = layoutTree(root);
  treeState.size = { width, height };
  const short = s => s.length > 18 ? s.slice(0, 17) + '…' : s;
  const arrow = (d, kind) => `<path d="${d}" stroke="${TREE_COLORS[kind] || TREE_COLORS.assemble}" marker-end="url(#tree-arrow-${kind || 'assemble'})"/>`;
  const line = (d, kind) => `<path d="${d}" stroke="${TREE_COLORS[kind] || TREE_COLORS.assemble}"/>`;
  let edges = '', nodes = '';
  for (const n of all) {
    // ingredients flow in from the left
    const inKids = n === root ? root.kidsIn : (n.dir === 'in' ? n.kids : []);
    if (inKids.length) {
      const kind = inKids[0].kind, busX = n.x - TREE_COL / 2 + 10;
      for (const k of inKids) edges += line(`M${k.x + 40},${k.y} H${busX} V${n.y}`, kind);
      edges += arrow(`M${busX},${n.y} H${n.x - 48}`, kind);
    }
    // uses flow out to the right
    const outKids = n === root ? root.kidsOut : (n.dir === 'out' ? n.kids : []);
    if (outKids.length) {
      const busX = n.x + TREE_COL / 2 - 10;
      edges += line(`M${n.x + 40},${n.y} H${busX}`, outKids[0].kind);
      for (const k of outKids) edges += arrow(`M${busX},${n.y} V${k.y} H${k.x - 48}`, k.kind);
    }
    const enough = n.need ? n.have >= n.need : n.have > 0;
    const img = n.key && IMAGES[n.key];
    const name = n.group ? n.label : iname(n.key);
    const count = n.dir === 'out' ? (n.key ? `have ${n.have.toLocaleString()}` : '') : (n.need ? `${n.have.toLocaleString()} / ${n.need}` : `have ${(n.have || 0).toLocaleString()}`);
    const recipe = (n.dir !== 'out') && n.recipes[n.ri];
    const multi = recipe && n.recipes.length > 1 && !(n === root ? root.foldedIn : n.folded)
      ? `<g class="tree-switch" data-id="${n.id}"><rect x="${n.x - 66}" y="${n.y - 52}" width="44" height="17" rx="8"/><text x="${n.x - 44}" y="${n.y - 40}">⇄ ${n.ri + 1}/${n.recipes.length}</text></g>` : '';
    const ready = (recipe?.ready && !n.loop) || (n.dir === 'out' && n.use?.ready && n.use?.setup)
      ? `<g class="tree-ready" data-id="${n.id}"><rect x="${n.x - 34}" y="${n.y + 62}" width="68" height="17" rx="8"/><text x="${n.x}" y="${n.y + 74}">Set up</text></g>` : '';
    // fold handles on the side the branch grows: left = how it's made, right = what it makes
    const handle = (side, folded, which) => `<g class="tree-fold" data-id="${n.id}" data-which="${which}"><circle cx="${n.x + side * 50}" cy="${n.y}" r="9"/><text x="${n.x + side * 50}" y="${n.y + 4}">${folded ? '+' : '−'}</text></g>`;
    let handles = '';
    if (n === root) {
      if (root.canFoldIn) handles += handle(-1, root.foldedIn, 'in');
      if (root.canFoldOut) handles += handle(1, root.foldedOut, 'out');
    } else if (n.canFold) handles += handle(n.dir === 'in' ? -1 : 1, n.folded, n.dir);
    nodes += `<g class="tree-node ${n === root ? 'root' : ''} ${n.group ? 'group' : ''}" data-id="${n.id}"${n.key ? ` data-key="${esc(n.key)}"` : ''}>
      <circle cx="${n.x}" cy="${n.y}" r="${n === root ? 44 : 38}" class="tree-halo ${n === root ? 'root' : (n.dir === 'out' ? 'use' : (enough ? 'ok' : 'need'))}"/>
      ${img ? `<image href="${esc(img)}" x="${n.x - 32}" y="${n.y - 32}" width="64" height="64" filter="url(#tree-glow)"/>` : `<rect x="${n.x - 24}" y="${n.y - 24}" width="48" height="48" rx="8" class="tree-groupbox"/><text class="tree-grouptext" x="${n.x}" y="${n.y + 5}">${n.kind === 'sac' ? 'SAC' : 'ANY'}</text>`}
      <text class="tree-label" x="${n.x}" y="${n.y + 50}">${esc(short(name))}${n.sacrifice ? ' (sac)' : ''}</text>
      ${count ? `<text class="tree-count ${n.dir === 'out' ? 'use' : (enough ? 'ok' : 'need')}" x="${n.x}" y="${n.y + 62 + (ready ? 30 : 0)}">${count}${n.loop ? ' · loops back' : ''}</text>` : ''}
      ${handles}${multi}${ready}</g>`;
  }
  document.getElementById('tree-world').innerHTML = `<g class="tree-edges">${edges}</g>${nodes}`;
  document.getElementById('tree-legend').innerHTML =
    `◀ how it's made · what it makes ▶ · <span style="color:${TREE_COLORS.assemble}">━ assemble</span> <span style="color:${TREE_COLORS.smash}">━ smash</span> <span style="color:${TREE_COLORS.random}">━ random result</span>`;
  applyTreeView();
}

// ── pan & zoom ──
function applyTreeView() {
  const v = treeState.view, svg = document.getElementById('tree-svg');
  document.getElementById('tree-world').setAttribute('transform', `translate(${v.x},${v.y}) scale(${v.k})`);
  svg.style.backgroundPosition = `${v.x}px ${v.y}px`;
  svg.style.backgroundSize = `${40 * v.k}px ${40 * v.k}px`;
}
function fitTree() {
  const box = document.getElementById('tree-svg').getBoundingClientRect();
  const { width, height } = treeState.size;
  const k = Math.min(1.2, Math.max(0.25, Math.min(box.width / width, box.height / height) * 0.95));
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
// keep the clicked node where it was after the tree re-lays itself out
function keepInPlace(id, change) {
  const before = treeNodeById(id);
  const sx = before ? before.x * treeState.view.k + treeState.view.x : null, sy = before ? before.y * treeState.view.k + treeState.view.y : null;
  change();
  renderTreeChart();
  const after = treeNodeById(id);
  if (after && sx != null) { treeState.view.x = sx - after.x * treeState.view.k; treeState.view.y = sy - after.y * treeState.view.k; applyTreeView(); }
}

function treeNodeById(id) {
  const r = treeState.root;
  if (!r) return null;
  const stack = [r, ...r.kidsIn, ...r.kidsOut];
  while (stack.length) { const n = stack.pop(); if (n.id === id) return n; stack.push(...n.kids); }
  return null;
}

function setupTreeRecipe(n) {
  const r = n.dir === 'out' ? n.use.setup : n.recipes[n.ri];
  if (r.spec) fillSmash(r.spec);
  else {
    clearSlots('asm');
    const slots = pickSlots(r.recipe, state.inv);
    if (slots) ASM_SLOTS.forEach((id, i) => { if (slots[i]) { slotState[id] = slots[i]; renderSlot(id); } });
    setScreenMode(SCREEN.ASSEMBLE);
  }
  log(`Set up ${n.key ? iname(n.key) : 'recipe'} from the crafting tree. Check the slots, then press the button.`);
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
      const d2 = Math.hypot(a2.x - b2.x, a2.y - b2.y), r = svg.getBoundingClientRect();
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
    const sw = e.target.closest('.tree-switch'), rd = e.target.closest('.tree-ready'), fd = e.target.closest('.tree-fold'), nd = e.target.closest('.tree-node');
    if (sw) { const n = treeNodeById(sw.dataset.id); keepInPlace(n.id, () => { treeState.choice[n.id] = (n.ri + 1) % n.recipes.length; }); return; }
    if (rd) { setupTreeRecipe(treeNodeById(rd.dataset.id)); return; }
    const toggle = (id, which) => {
      const n = treeNodeById(id);
      if (!n) return;
      if (n.dir === 'root') { const key = which === 'out' ? 'o' : 'r'; const was = which === 'out' ? n.foldedOut : n.foldedIn; keepInPlace(id, () => { treeState.collapsed[key] = !was; }); }
      else if (n.canFold) keepInPlace(id, () => { treeState.collapsed[id] = !n.folded; });
    };
    if (fd) { toggle(fd.dataset.id, fd.dataset.which); return; }
    if (nd && nd.dataset.id !== 'r') toggle(nd.dataset.id, null);
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
