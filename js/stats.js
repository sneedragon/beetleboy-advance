// BeetleBoy SP · Drop stats: what your actions gave you, kept in this browser.
// Classic script sharing globals with the others; load order is set in index.html.

// ── STATS ─────────────────────────────────────────────────────────────────────
const LS_STATS = 'bb_stats_log';
const STATS_MAX = 6000;

function statsLog() {
  try { return JSON.parse(localStorage.getItem(LS_STATS) || '[]'); } catch { return []; }
}

// type: 'action' {a, got} · 'smash' {h, ok, out} · 'break' {h} · 'craft' {out}
function recordEvent(type, data) {
  const log = statsLog();
  log.push({ t: Date.now(), type, ...data });
  try { localStorage.setItem(LS_STATS, JSON.stringify(log.slice(-STATS_MAX))); } catch {}
}

function renderStats() {
  const el = document.getElementById('left-mode-stats');
  if (!el) return;
  const all = statsLog();
  const range = el.dataset.range || '7';
  const since = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
  const ev = all.filter(e => e.t >= since);
  const pct = (a, b) => b ? `${Math.round(a / b * 100)}%` : '—';
  const per100 = (a, b) => b ? (a / b * 100).toFixed(1) : '—';
  const rareOf = got => Object.keys(got || {}).filter(k => RARITY[k] === 'adm' || RARITY[k] === 'dia' || k.startsWith('trophy_'));

  const act = a => ev.filter(e => e.type === 'action' && e.a === a);
  const rows = [['catchBeetle', 'Claim Beetle'], ['beetleHunt', 'Hunt'], ['claimUBC', 'Claim UBC'], ['junkFaucet', 'Junk Faucet']].map(([a, label]) => {
    const list = act(a);
    const empty = list.filter(e => !Object.keys(e.got || {}).length).length;
    const rare = list.reduce((n, e) => n + rareOf(e.got).length, 0);
    const tiers = {};
    for (const e of list) for (const [k, q] of Object.entries(e.got || {})) if (RARITY[k] && k !== 'cheese') tiers[RARITY[k]] = (tiers[RARITY[k]] || 0) + q;
    return { label, n: list.length, empty, rare, tiers };
  }).filter(r => r.n);

  const smashes = ev.filter(e => e.type === 'smash');
  const breaks = ev.filter(e => e.type === 'break');
  const byHammer = {};
  for (const s of smashes) if (s.h) (byHammer[s.h] ||= { n: 0, breaks: 0 }).n++;
  for (const b of breaks) if (b.h) (byHammer[b.h] ||= { n: 0, breaks: 0 }).breaks++;
  const crafts = ev.filter(e => e.type === 'craft').length;

  const tierChips = tiers => RARITY_ORDER.filter(r => tiers[r]).map(r => `<span class="st-chip r-${r}">${RARITY_NAMES[r]} ${tiers[r]}</span>`).join('') || '<span class="st-dim">nothing yet</span>';
  el.innerHTML = `
    <div class="st-range">${[['1', 'Today'], ['7', '7 days'], ['30', '30 days'], ['all', 'All']].map(([v, l]) =>
      `<button type="button" data-range="${v}" class="${v === range ? 'active' : ''}">${l}</button>`).join('')}</div>
    ${!all.length ? '<p class="st-dim">BeetleBoy starts counting from now: claim, hunt and smash and your luck shows up here. It is stored only in this browser.</p>' : ''}
    ${rows.map(r => `<div class="st-block">
      <div class="st-title">${r.label} <span>${r.n}×</span></div>
      <div class="st-line">${tierChips(r.tiers)}</div>
      <div class="st-line st-dim">${r.label === 'Hunt' ? `empty hunts ${pct(r.empty, r.n)} · ` : ''}rare drops ${r.rare} (${per100(r.rare, r.n)} per 100)</div>
    </div>`).join('')}
    ${smashes.length ? `<div class="st-block">
      <div class="st-title">Smashing <span>${smashes.length}×</span></div>
      <div class="st-line st-dim">unlucky rolls ${pct(smashes.filter(s => !s.ok).length, smashes.length)}</div>
      ${Object.entries(byHammer).map(([h, v]) => {
        const base = (state.hammers || []).find(x => x.hammer === h)?.base_break_rate ?? HAMMER_STATS[h]?.breakPer;
        return `<div class="st-line">${esc(iname(h))}: ${v.breaks} break${v.breaks === 1 ? '' : 's'} in ${v.n} smashes <span class="st-dim">(${pct(v.breaks, v.n)} seen${base != null ? `, ${base}% stated` : ''})</span></div>`;
      }).join('')}
    </div>` : ''}
    ${crafts ? `<div class="st-block"><div class="st-title">Assembled <span>${crafts}×</span></div></div>` : ''}`;
  el.querySelectorAll('.st-range button').forEach(b => b.addEventListener('click', () => { el.dataset.range = b.dataset.range; renderStats(); }));
}
