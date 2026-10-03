// BeetleBoy SP · Game actions (claim, hunt, UBC, faucet, crunch) and crafting/smashing incl. hammer replacement.
// Classic script sharing globals with the others; load order is set in index.html.

// ── ACTIONS ───────────────────────────────────────────────────────────────────
const ACTION_CD_KEY = { catchBeetle:'catchBeetle', beetleHunt:'beetleHunt', claimUBC:'claimUBC', junkFaucet:'junkFaucet' };

async function doAction(actionName, label) {
  if (screenMode === SCREEN.ASSEMBLE || screenMode === SCREEN.SMASH) setScreenMode(SCREEN.LOG);
  if (actionName === 'catchBeetle' || actionName === 'beetleHunt') lastActionCtx = 'beetle';
  else if (actionName === 'claimUBC' || actionName === 'junkFaucet') lastActionCtx = 'cheese';
  updateScreenBg(screenMode);

  log(`${label}…`);
  if (!Object.keys(state.inv).length) await loadState(true);
  const invBefore = { ...state.inv };
  const result = await apiPost(`/api/beetle/action/${actionName}`);
  if (!result) return;
  if (result.success === false) {
    sfx('fail');
    if (result.cooldownMs > 0) {
      state.storedCds[ACTION_CD_KEY[actionName]] = result.cooldownMs;
      state.fetchedAt = Date.now();
      tick();
      const s = Math.ceil(result.cooldownMs / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      const parts = [];
      if (h) parts.push(`${h}h`);
      if (m) parts.push(`${m}m`);
      if (sec || !parts.length) parts.push(`${sec}s`);
      log(`${label} is on cooldown — ${parts.join(' ')} remaining`, 'warn');
    } else {
      log(result.message || `${label} failed.`, 'warn');
    }
  } else {
    await loadState();
    const gainedKeys = [], gained = [];
    for (const [k, qty] of Object.entries(state.inv)) {
      const diff = qty - (invBefore[k] || 0);
      if (diff > 0) { gainedKeys.push(k); gained.push(diff > 1 ? `${iname(k)} ×${diff}` : iname(k)); }
    }
    sfx({ claimUBC: 'cheese', junkFaucet: 'junk' }[actionName] || 'claim');
    if (gainedKeys.some(isRareKey)) setTimeout(() => sfx('rare'), 350);
    if (gained.length) log(`✓ ${label} — ${gained.join(', ')}`);
    else if (actionName === 'beetleHunt') log(`✓ ${label} — no beetles this time`);
    else log(`✓ ${label}`);
    announceRareDrops(label, gainedKeys);
  }
}

// Posting finds to global chat is opt-in: it goes to everyone on RemiliaNET.
const announceOn = () => localStorage.getItem(LS_ANNOUNCE) === '1';

async function announceTrophy(trophyKey) {
  if (!announceOn()) return;
  await postToChat(`🏆 Crafted [[${trophyKey}]]!`);
}

async function announceRareDrops(actionLabel, gainedKeys) {
  if (!announceOn()) return;
  const rare = gainedKeys.filter(k => RARITY[k] === 'adm' || RARITY[k] === 'dia');
  if (!rare.length) return;
  await postToChat(`🪲 Got ${rare.map(k => `[[${k}]]`).join(', ')} from ${actionLabel}!`);
}

async function doJunkCrunch() {
  const pool = junkPool(state.inv);
  if (pool.length < 2) { log('Not enough loose junk.', 'warn'); return; }
  const pairs = Math.floor(pool.length / 2);
  if (screenMode === SCREEN.ASSEMBLE || screenMode === SCREEN.SMASH) setScreenMode(SCREEN.LOG);
  updateScreenBg(SCREEN.SMASH);
  log(`Crunching ${pool.length} junk items…`);
  sfx('junk');
  let made = 0, skipped = 0;
  for (let i = 0; i < pairs * 2; i += 2) {
    const result = await apiPost('/api/beetle/action/craft', { type: 1, slot1: pool[i], slot2: pool[i+1] });
    if (!result) break;
    if (result.success !== false) { made++; }
    else if (result.message === 'INVALID_RECIPE') { skipped++; }
    else { log(result.message || 'Failed mid-crunch.', 'warn'); break; }
    await new Promise(r => setTimeout(r, 200));
  }
  if (made) sfx('craft');
  log(`✓ Made ${made}/${pairs} Junk Cube(s)` + (skipped ? ` (${skipped} pair${skipped>1?'s':''} skipped — unknown item)` : ''));
  updateScreenBg(screenMode);
  await loadState();
}


// sound for a crafted result: rare things sparkle
const isRareKey = k => !!k && (k.startsWith('trophy_') || RARITY[k] === 'adm' || RARITY[k] === 'dia');
const craftSound = k => sfx(isRareKey(k) ? 'rare' : 'craft');

// ── CRAFT ACTIONS ─────────────────────────────────────────────────────────────
async function doAssemble() {
  if (!slotState['asm0']) { setResult('asm-result', 'Fill at least Slot 1.'); return; }
  const btn = document.getElementById('do-assemble');
  btn.disabled = true;
  const repeatCount = Math.max(1, Math.min(99, parseInt(document.getElementById('asm-repeat').value) || 1));
  let successCount = 0, lastLabel = '', lastKey = null, lastError = '', trophyCrafted = null;
  for (let i = 0; i < repeatCount; i++) {
    setResult('asm-result', repeatCount > 1 ? `${i+1}/${repeatCount}…` : 'Assembling…', lastKey);
    const [s1, s2, s3, s4] = resolveSlotKeys(ASM_SLOTS);
    if (!s1) { lastError = 'Out of materials.'; setResult('asm-result', lastError); break; }
    const body = { type: 1, slot1: s1, slot2: s2 || undefined, ...(s3 ? { slot3: s3 } : {}), ...(s4 ? { slot4: s4 } : {}) };
    const result = await apiPost('/api/beetle/action/craft', body);
    if (!result) break;
    if (result.success === false) { sfx('fail'); lastError = result.message || 'Failed.'; setResult('asm-result', lastError); break; }
    lastLabel = resultLabel(result) || 'done';
    lastKey   = resultKey(result);
    craftSound(lastKey);
    if (lastKey?.startsWith('trophy_') && !trophyCrafted) trophyCrafted = lastKey;
    successCount++;
    if (i < repeatCount - 1) await loadState(true);
  }
  await loadState();
  updatePreviews();
  if (successCount > 0) {
    const txt = repeatCount > 1 ? `✓ ×${successCount}: ${lastLabel}` : `✓ Got: ${lastLabel}`;
    setResult('asm-result', txt, lastKey);
    log(txt);
    if (trophyCrafted) announceTrophy(trophyCrafted);
  } else if (lastError) {
    log(lastError, 'warn');
  }
  btn.disabled = false;
}

// Rebuild a broken hammer of the same tier. Each hammer recipe consumes the
// tier below, so this starts from the best lower hammer you still own (or a
// fresh Tin Hammer from junk cubes) and upgrades step by step. The whole path
// is checked against a copy of the inventory first, so nothing is crafted
// unless the broken tier can actually be reached.
function planHammerRebuild(brokenIdx, inv) {
  let from = -1;
  for (let i = brokenIdx - 1; i >= 0; i--) if ((inv[HAMMERS[i]] || 0) > 0) { from = i; break; }
  const sim = { ...inv };
  const steps = [];
  for (let t = from + 1; t <= brokenIdx; t++) {
    const key = HAMMERS[t];
    const slots = pickSlots(AR_BY_OUT[key], sim);
    if (!slots) return { ok: false, missing: key, steps };
    for (const k of slots) sim[k] = (sim[k] || 0) - 1;
    sim[key] = (sim[key] || 0) + 1;
    steps.push({ key, slots });
  }
  return { ok: true, from, steps };
}

async function autoRepairHammer(brokenKey) {
  const brokenIdx = HAMMERS.indexOf(brokenKey);
  if (brokenIdx < 0) return false;
  await loadState(true);
  const plan = planHammerRebuild(brokenIdx, state.inv);
  if (!plan.ok) {
    log(`⚒ Can't replace ${iname(brokenKey)}: not enough materials for ${iname(plan.missing)}.`, 'warn');
    return false;
  }
  const uses = plan.from >= 0 ? `your ${iname(HAMMERS[plan.from])}` : 'junk cubes';
  log(`⚒ Rebuilding ${iname(brokenKey)} from ${uses} (${plan.steps.length} craft${plan.steps.length > 1 ? 's' : ''})…`);
  for (const step of plan.steps) {
    const [s1, s2, s3] = pickSlots(AR_BY_OUT[step.key], state.inv) || [];
    if (!s1) { log(`⚒ Materials changed — stopped before ${iname(step.key)}.`, 'warn'); return false; }
    const r = await apiPost('/api/beetle/action/craft', { type: 1, slot1: s1, ...(s2 ? { slot2: s2 } : {}), ...(s3 ? { slot3: s3 } : {}) });
    if (!r || r.success === false) { log(`⚒ Crafting ${iname(step.key)} failed${r?.message ? ': ' + r.message : ''}.`, 'warn'); return false; }
    await loadState(true);
    log(`⚒ ✓ ${iname(step.key)}`);
    sfx('craft');
  }
  if ((state.inv[brokenKey] || 0) < 1) return false;
  slotState['smhammer'] = brokenKey;
  renderSlot('smhammer');
  renderHammerQuick();
  log(`⚒ ${iname(brokenKey)} replaced — resuming.`);
  return true;
}

// After a smash: if the hammer broke, switch to the backup or rebuild it.
// Returns false when the batch has to stop.
async function handleHammerBreak() {
  const hammer = slotState['smhammer'];
  if (!hammer || (state.inv[hammer] || 0) > 0) return true;
  slotState['smhammer'] = null;
  renderSlot('smhammer');
  const bk = slotState['smhammer_bk'];
  if (bk && (state.inv[bk] || 0) > 0) {
    sfx('hammerBreak');
    slotState['smhammer'] = bk;
    slotState['smhammer_bk'] = null;
    renderSlot('smhammer'); renderSlot('smhammer_bk');
    renderHammerQuick(); updateAutoHammerCheckbox();
    log(`⚒ ${iname(hammer)} broke — switched to backup ${iname(bk)}.`, 'warn');
    return true;
  }
  log(`⚒ ${iname(hammer)} broke.`, 'warn');
  sfx('hammerBreak');
  if (document.getElementById('chk-auto-hammer')?.checked) return autoRepairHammer(hammer);
  renderHammerQuick();
  return false;
}

async function doSmash() {
  if (!slotState['sm0'] || !slotState['smsac'] || !slotState['smhammer'])
    { setResult('smash-result2', 'Need Slot 1, Sacrifice and Hammer.'); return; }
  const btn = document.getElementById('do-smash');
  btn.disabled = true;
  const repeatCount = Math.max(1, Math.min(99, parseInt(document.getElementById('smash-repeat').value) || 1));
  let successCount = 0, lastLabel = '', lastKey = null, lastError = '';
  for (let i = 0; i < repeatCount; i++) {
    setResult('smash-result2', repeatCount > 1 ? `${i+1}/${repeatCount}…` : 'Smashing…', lastKey);
    const [s1, s2] = resolveSlotKeys(SMASH_SLOTS);
    if (!s1) { lastError = 'Out of materials.'; setResult('smash-result2', lastError); break; }
    const body = { type: 2, slot1: s1, sacrifice: slotState['smsac'] || '', hammer: slotState['smhammer'] || '', ...(s2 ? { slot2: s2 } : {}) };
    const result = await apiPost('/api/beetle/action/craft', body);
    if (!result) break;
    sfx('smash');
    if (result.success === false && result.message !== 'UNLUCKY_ROLL') {
      sfx('fail'); lastError = result.message || 'Failed.'; setResult('smash-result2', lastError); break;
    }
    if (result.success === false) { sfx('unlucky'); log('✗ Unlucky roll.', 'warn'); }
    else {
      lastLabel = resultLabel(result) || 'done';
      lastKey   = resultKey(result);
      if (isRareKey(lastKey)) setTimeout(() => sfx('rare'), 150);
      successCount++;
      log(`✓ Got: ${lastLabel}`);
    }
    // the hammer can break on any attempt, lucky or not
    if (i < repeatCount - 1) {
      await loadState(true);
      if (!(await handleHammerBreak())) { lastError = 'Hammer broke.'; break; }
    }
  }
  await loadState();
  if (slotState['smhammer'] && (state.inv[slotState['smhammer']] || 0) < 1) {
    slotState['smhammer'] = null;
    renderSlot('smhammer');
  }
  updatePreviews();
  if (successCount > 0) {
    const txt = repeatCount > 1 ? `✓ ×${successCount}: ${lastLabel}` : `✓ Got: ${lastLabel}`;
    setResult('smash-result2', txt, lastKey);
  } else if (lastError) {
    log(lastError, 'warn');
  }
  btn.disabled = false;
}
