// Smoke test: serves the repo locally, logs in with a fake token and fake game
// data (no real account), clicks through every panel on desktop and phone
// width, and fails on script errors, missing files or sideways scrolling.
//   node tests/smoke.mjs        (deploy.sh runs it before uploading)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8000 + Math.floor(Math.random() * 900);
const BASE = `http://127.0.0.1:${PORT}`;
const BROWSER = ['/usr/bin/chromium', '/opt/brave-bin/brave'].find(existsSync);
const problems = [];
const fail = msg => problems.push(msg);

// ── static checks: every local image the data points at exists ──
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(ROOT + 'assets.js', 'utf8') + readFileSync(ROOT + 'data.js', 'utf8') + ';this.D = { IMAGES, CATEGORIES, TROPHIES };', ctx);
const { IMAGES, CATEGORIES, TROPHIES } = ctx.D;
for (const [k, src] of Object.entries(IMAGES)) {
  if (!/^https?:/.test(src) && !existsSync(ROOT + src)) fail(`missing image for ${k}: ${src}`);
}
const html = readFileSync(ROOT + 'index.html', 'utf8');
const ver = (html.match(/js\/core\.js\?v=([\w]+)/) || [])[1];
const appVer = (readFileSync(ROOT + 'js/core.js', 'utf8').match(/APP_VERSION = '([^']+)'/) || [])[1];
if (ver && appVer && ver !== appVer) fail(`index.html ?v=${ver} but APP_VERSION=${appVer}`);

// ── fake game data ──
const inv = {};
for (const [, keys] of CATEGORIES) keys.forEach((k, i) => { inv[k] = (i * 7) % 40; });
for (const [k] of TROPHIES.slice(0, 10)) inv[k] = 1;
Object.assign(inv, { cheese: 72, green: 4000, hammer_t4: 1, hammer_t5: 1, trophy_green: 1, bottle_cap: 9, chip_bag: 20, marble: 5 });
const user = { id: 1, xp: 790000, level: 95, inventory: inv, cheeseShields: 1, beetleHuntsUsed: 3, lastBeetleHuntDate: Date.now() - 20 * 60000,
  crafting_slot3_unlocked: true, beetle_count: 5000, cooldowns: { catchBeetle: 600000, claimUBC: 50000000, junkFaucet: 50000000 },
  hammers: [{ hammer: 'hammer_t4', break_rate: 0, craft_count: 5, base_break_rate: 2, craft_bonus: 35 }, { hammer: 'hammer_t5', break_rate: 0, craft_count: 4, base_break_rate: 1, craft_bonus: 90 }] };
const now = Date.now();
const chat = { global: {
  users: { 1: { id: 1, handle: 'tester', display_name: 'Tester' }, 2: { id: 2, handle: 'beetlefan', display_name: 'Beetle Fan' } },
  messages: {
    10: { id: 10, chat_id: 1, author_id: 2, body: 'gm ~tester, look at my [Sunset Moth]', reply_to_message_id: 0, created_at: now - 60000, reactions: [{ user_id: 1, emoji: '🔥' }], images: null, video: null, mentions: [1] },
    11: { id: 11, chat_id: 1, author_id: 1, body: 'nice https://www.youtube.com/watch?v=dQw4w9WgXcQ', reply_to_message_id: 10, created_at: now - 30000, reactions: [], images: null, video: null, mentions: null },
  } }, message_ids: [10, 11], oldest_reachable_id: 10 };
const fakeJwt = 'x.' + Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + 3600 })).toString('base64url') + '.y';

function apiAnswer(path) {
  if (path.startsWith('/api/beetle/user')) return user;
  if (path.startsWith('/api/profile/whoami')) return { userHandle: 'tester', displayName: 'Tester', pfpUrl: '' };
  if (path.startsWith('/api/chats/')) return chat;
  if (path.startsWith('/api/link_preview')) return { url: '', title: '' };
  if (path.startsWith('/api/profile/~')) return { user: { username: 'beetlefan', displayName: 'Beetle Fan', pfpUrl: '', bio: 'I like beetles', location: 'the junk pile', color: 120,
    friendCount: 12, pokes: 34, beetles: 567, achievementsCount: 8 }, viewerContext: { areFriends: false, pendingRequestFrom: false, pendingRequestTo: false, canPoke: true, pokeCooldownSeconds: 0, mutualCount: 2 }, isOwnProfile: false };
  return { success: false, message: 'not faked in smoke test' };
}

// ── run ──
const server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', ROOT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 600));
const browser = await chromium.launch({ executablePath: BROWSER, headless: true, args: ['--no-sandbox'] });
mkdirSync(ROOT + 'tests/out', { recursive: true });

async function check(label, viewport) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => fail(`${label}: page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fail(`${label}: console error: ${m.text()}`); });
  page.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) fail(`${label}: ${r.status()} ${r.url().slice(BASE.length)}`); });
  await page.addInitScript(t => { localStorage.setItem('bb_access', t); localStorage.setItem('bb_refresh', 'r'); localStorage.setItem('bb_mute', '1'); }, fakeJwt);
  await page.route('**/proxy.php', route => {
    const { path } = JSON.parse(route.request().postData() || '{}');
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(apiAnswer(path || '')) });
  });
  await page.route(/(chatroom|push)\.php/, route => route.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());   // stay offline
  await page.goto(BASE + '/');
  await page.waitForTimeout(1200);
  if (await page.isVisible('#login-screen')) fail(`${label}: app did not start (login screen still showing)`);
  const clickAll = async sel => { for (const el of await page.$$(sel)) { await el.click({ force: true }).catch(() => {}); await page.waitForTimeout(250); } };
  await page.click('.panel-toggle-btn.sp-left', { force: true }).catch(() => fail(`${label}: no INV toggle`));
  await clickAll('#left-mode-btns .mode-btn');
  await page.click('.panel-toggle-btn.sp-right', { force: true }).catch(() => fail(`${label}: no TOOLS toggle`));
  await clickAll('#mode-btns .mode-btn:not([data-mode="wiki"])');
  await page.waitForTimeout(600);
  for (const [sel, what] of [['#left-mode-stats', 'stats tab'], ['#advisor-list .adv-row, #advisor-list .adv-head', 'advisor'], ['.chat-msg', 'chat messages'], ['.chat-msg-mention', 'mention highlight'], ['.chat-yt', 'YouTube embed']]) {
    if (!(await page.$(sel))) fail(`${label}: ${what} missing`);
  }
  // crafting tree: a deep trophy, every branch open
  const tree = await page.evaluate(() => {
    openTree('trophy_remilianet_id');
    const n = { recipes: document.querySelectorAll('#tree-svg .tree-edges path').length, items: document.querySelectorAll('#tree-svg .tree-node').length, visible: !document.getElementById('sp-tree').classList.contains('hidden') };
    return n;
  });
  const flower = await page.evaluate(() => {
    openTree('gallic_rose');
    const r = treeState.root;
    return { made: r.kidsIn.length, uses: r.kidsOut.length, recipes: r.recipes.length };
  });
  if (!flower.made || !flower.uses) fail(`${label}: flower tree has no branches (${JSON.stringify(flower)})`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-tree-flower.png` });
  if (!tree.visible || !tree.recipes || tree.items < 3) fail(`${label}: crafting tree looks empty (${JSON.stringify(tree)})`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-tree.png` });
  await page.evaluate(() => closeTree());
  // mini profile from a chat name, then big chat on/off
  await page.click('.chat-msg [data-profile="beetlefan"]', { force: true }).catch(() => fail(`${label}: no clickable chat name`));
  await page.waitForTimeout(400);
  if (!(await page.$('#profile-modal.open .pf-act'))) fail(`${label}: mini profile did not open`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-profile.png` });
  await page.evaluate(() => closeProfile());
  await page.click('#log-chat-btn').catch(() => fail(`${label}: no chat button on the main screen`));
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => screenMode === 'chat' && document.getElementById('sp-chat').contains(document.getElementById('chat-messages'))))) fail(`${label}: chat did not move to the main screen`);
  if (!(await page.evaluate(() => { const o = document.querySelector('#chat-input-row .chat-option'); if (!o) return false; const c = document.getElementById('chk-announce').checked; o.click(); const ok = document.getElementById('chk-announce').checked !== c; o.click(); return ok; }))) fail(`${label}: announce toggle missing or dead on the big screen`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-bigchat.png` });
  await page.click('[data-mode="next"]', { force: true });
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById('mode-chat').classList.contains('hidden') || !chatTimer)) fail(`${label}: switching the panel tab broke the big-screen chat`);
  await page.click('#chat-big-btn', { force: true });
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById('sp-chat').contains(document.getElementById('chat-messages')))) fail(`${label}: chat did not go back to the panel`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) fail(`${label}: page scrolls sideways by ${overflow}px`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}.png` });
  await page.close();
}

try {
  await check('desktop', { width: 1400, height: 860 });
  await check('phone', { width: 400, height: 860 });
} finally {
  await browser.close();
  server.kill();
}

if (problems.length) {
  console.error(`✗ smoke test failed (${problems.length}):\n  ` + [...new Set(problems)].join('\n  '));
  process.exit(1);
}
console.log('✓ smoke test passed (desktop + phone). Screenshots in tests/out/');
