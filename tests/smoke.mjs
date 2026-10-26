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
    12: { id: 12, chat_id: 1, author_id: 2, body: 'guide (see www.example.com/guide) and https://beetle.wiki/Beetles. pic: https://example.com/pic.png', reply_to_message_id: 0, created_at: now - 20000, reactions: [], images: null, video: null, mentions: null },
  } }, message_ids: [10, 11, 12], oldest_reachable_id: 10 };
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
  // real mouse clicks on the tree: a + handle must unfold, "Set up" must fill the slots
  const clicks = await (async () => {
    await page.evaluate(() => { openTree('trophy_remilianet_id'); });
    await page.waitForTimeout(300);
    const before = await page.$$eval('#tree-svg .tree-node', n => n.length);
    // a folded branch: its handle shows "+"
    const plus = await page.evaluateHandle(() => {
      const top = document.querySelector('.tree-top').getBoundingClientRect().bottom + 4;
      return [...document.querySelectorAll('#tree-svg .tree-fold')].find(g => g.textContent.trim() === '+' && g.getBoundingClientRect().top > top) || null;
    });
    const hasPlus = await plus.evaluate(p => !!p);
    if (hasPlus) { await plus.asElement().click(); await page.waitForTimeout(300); }
    const after = await page.$$eval('#tree-svg .tree-node', n => n.length);
    const ready = await page.$('#tree-svg .tree-ready');
    let setUp = null;
    if (ready) { await ready.click(); await page.waitForTimeout(300); setUp = await page.evaluate(() => screenMode); }
    return { before, after, hadPlus: hasPlus, hadReady: !!ready, setUp };
  })();
  // ◎ re-centres on another item, ◀ comes back
  const focus = await (async () => {
    await page.evaluate(() => openTree('gunpowder'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${ROOT}tests/out/${label}-tree-gunpowder.png` });
    const top = await page.evaluate(() => document.querySelector('.tree-top').getBoundingClientRect().bottom + 4);
    const f = await page.evaluateHandle(t => [...document.querySelectorAll('#tree-svg .tree-focus')].find(g => g.getBoundingClientRect().top > t) || null, top);
    if (!(await f.evaluate(x => !!x))) return { ok: false, why: 'no visible focus button' };
    const target = await f.evaluate(x => x.dataset.key);
    await f.asElement().click(); await page.waitForTimeout(300);
    const now = await page.evaluate(() => treeState.key);
    await page.click('#tree-back'); await page.waitForTimeout(300);
    const back = await page.evaluate(() => treeState.key);
    return { ok: now === target && back === 'gunpowder', target, now, back };
  })();
  if (!focus.ok) fail(`${label}: tree focus/back broken (${JSON.stringify(focus)})`);
  if (!clicks.hadPlus || clicks.after <= clicks.before) fail(`${label}: tree + handle did nothing (${JSON.stringify(clicks)})`);
  if (clicks.hadReady && clicks.setUp === 'tree') fail(`${label}: tree "Set up" did nothing (${JSON.stringify(clicks)})`);
  await page.evaluate(() => { if (screenMode === 'tree') closeTree(); else setScreenMode(SCREEN.LOG); });
  // chat: links come out right and open, images open large, text can be selected
  const links = await page.$$eval('#chat-messages .chat-link', as => as.map(a => a.getAttribute('href')));
  for (const want of ['https://www.example.com/guide', 'https://beetle.wiki/Beetles']) {
    if (!links.includes(want)) fail(`${label}: chat link wrong (${JSON.stringify(links)})`);
  }
  const linkEl = await page.$('#chat-messages .chat-link[href="https://beetle.wiki/Beetles"]');
  if (linkEl) {
    const popup = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null);
    await linkEl.click({ force: true });
    const pg = await popup;
    if (!pg) fail(`${label}: clicking a chat link opened nothing`); else await pg.close();
  }
  const userSelect = await page.$eval('#chat-messages .chat-text', el => getComputedStyle(el).userSelect);
  if (userSelect !== 'text' && userSelect !== 'auto') fail(`${label}: chat text not selectable (${userSelect})`);
  await page.evaluate(() => { const i = document.querySelector('#chat-messages img.chat-img'); i && i.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(200);
  if (!(await page.$('#lightbox.open'))) fail(`${label}: chat image did not open large`);
  await page.evaluate(() => document.getElementById('lightbox')?.classList.remove('open'));
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
  // a link in the big-screen chat must take a normal click (nothing on top of it)
  const bigLink = await page.$('#sp-chat .chat-link[href="https://beetle.wiki/Beetles"]');
  if (bigLink) {
    await bigLink.scrollIntoViewIfNeeded();
    const popup2 = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null);
    await bigLink.click({ timeout: 3000 }).catch(e => fail(`${label}: big-screen chat link covered (${String(e).split('\n')[0]})`));
    const pg2 = await popup2;
    if (pg2) await pg2.close();
  }
  await page.click('[data-mode="next"]', { force: true });
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById('mode-chat').classList.contains('hidden') || !chatTimer)) fail(`${label}: switching the panel tab broke the big-screen chat`);
  await page.click('#chat-big-btn', { force: true });
  await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById('sp-chat').contains(document.getElementById('chat-messages')))) fail(`${label}: chat did not go back to the panel`);
  await page.evaluate(() => setScreenMode(SCREEN.SMASH));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-smash.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) fail(`${label}: page scrolls sideways by ${overflow}px`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}.png` });
  await page.close();
}

// chat-only page: starts, tags messages, filters, search, side panel, /commands
// "Sign in with remilia.net": chat goes through the official /api/v1
async function checkChatPageV1(label, viewport) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => fail(`${label} v1: page error: ${e.message}`));
  await page.addInitScript(t => { localStorage.setItem('bb_rn_access', t); localStorage.setItem('bb_rn_refresh', 'r'); localStorage.setItem('bb_mute', '1'); localStorage.setItem('bb_chat_rn', '1'); }, fakeJwt);
  let posted = null, internal = 0;
  await page.route(/(proxy|chatroom|room)\.php/, route => { internal++; route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }); });
  await page.route('**/api/v1/**', route => {
    const u = route.request().url();
    if (u.includes('/global-chat/messages') && route.request().method() === 'POST') {
      posted = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: '12', text: posted.text, created_at: 1754870500, author: { handle: 'tester', display_name: 'Tester' } } }) });
    }
    if (u.includes('/global-chat/messages')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { has_more: false, next_cursor: null, messages: [
      { id: '10', text: 'hello from v1', created_at: 1754870400, author: { handle: 'beetlefan', display_name: 'Beetle Fan', avatar_url: null }, reactions: [{ emoji: '🔥', count: 2 }] },
      { id: '11', text: 'pic', created_at: 1754870450, reply_to_id: '10', author: { handle: 'guest', display_name: 'Guest' }, media: { kind: 'image', url: 'https://example.invalid/a.png' } }] } }) });
    if (u.includes('/me/beetle')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { level: 3, inventory: {} } }) });
    if (u.endsWith('/me')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ user: { username: 'tester', displayName: 'Tester' } }) });
    route.fulfill({ status: 404, body: '{}' });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)(?!www\.remilia\.net\/api\/v1)/, route => route.abort());
  await page.goto(BASE + '/chat/');
  await page.waitForTimeout(1200);
  if (await page.isVisible('#login-screen')) fail(`${label} v1: chat page did not start`);
  const n = await page.$$eval('#chat-messages .chat-msg', els => els.length);
  if (n !== 2) fail(`${label} v1: shows ${n} messages, expected 2`);
  if (!(await page.textContent('#chat-messages')).includes('🔥 2')) fail(`${label} v1: reaction counts missing`);
  if (!await page.$('#chat-messages .chat-msg img[src*="a.png"]')) fail(`${label} v1: picture missing`);
  if (await page.isVisible('#chat-attach')) fail(`${label} v1: attach button shows although uploads are not possible`);
  await page.fill('#chat-input', 'hi v1');
  await page.press('#chat-input', 'Enter');
  await page.waitForTimeout(500);
  if (posted?.text !== 'hi v1') fail(`${label} v1: message not posted to /api/v1 (${JSON.stringify(posted)})`);
  if (internal) fail(`${label} v1: ${internal} calls went to the internal API`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-chatpage-v1.png` });
  await page.close();
}

async function checkChatPage(label, viewport) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => fail(`${label}: page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fail(`${label}: console error: ${m.text()}`); });
  page.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) fail(`${label}: ${r.status()} ${r.url().slice(BASE.length)}`); });
  await page.addInitScript(t => { localStorage.setItem('bb_access', t); localStorage.setItem('bb_refresh', 'r'); localStorage.setItem('bb_mute', '1'); localStorage.setItem('bbc_lastread', '10'); }, fakeJwt);
  await page.route('**/proxy.php', route => {
    const { path } = JSON.parse(route.request().postData() || '{}');
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(apiAnswer(path || '')) });
  });
  let sent = null;
  await page.route(/(chatroom|push)\.php/, route => { sent = route.request().postData(); route.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); });
  let roomSent = null;
  await page.route('**/room.php', route => {
    roomSent = JSON.parse(route.request().postData() || '{}');
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ me: 'tester', people: [
      { u: 'tester', d: 'Tester', x: roomSent.x ?? 200, y: roomSent.y ?? 200 }, { u: 'guest', d: 'Guest Cat', x: 420, y: 160 }] }) });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  await page.goto(BASE + '/chat/');
  await page.waitForTimeout(1200);
  if (await page.isVisible('#login-screen')) fail(`${label}: chat page did not start`);
  const n = await page.$$eval('#chat-messages .chat-msg', els => els.length);
  if (n !== 3) fail(`${label}: chat page shows ${n} messages, expected 3`);
  if (!await page.$('#cp-divider')) fail(`${label}: chat page has no unread divider`);
  await page.click('.cp-chip[data-filter="me"]');
  if (await page.$$eval('#chat-messages .chat-msg', els => els.filter(e => e.offsetParent).length) !== 1) fail(`${label}: "For me" filter wrong`);
  await page.click('.cp-chip[data-filter="all"]');
  await page.fill('#cp-search', 'guide');
  await page.waitForTimeout(300);
  if (await page.$$eval('#chat-messages .chat-msg', els => els.filter(e => e.offsetParent).length) !== 1) fail(`${label}: chat search wrong`);
  await page.fill('#cp-search', '');
  await page.waitForTimeout(300);
  if (viewport.width <= 720) await page.click('#cp-people-btn');
  if (!(await page.textContent('#cp-people')).includes('Beetle Fan')) fail(`${label}: side panel misses who is around`);
  await page.click('.cp-person[data-user="beetlefan"] .chat-user');
  if (await page.$$eval('#chat-messages .chat-msg', els => els.filter(e => e.offsetParent).length) !== 2) fail(`${label}: filtering by person wrong`);
  await page.click('#cp-user-chip');
  await page.click('.chat-item-link', { force: true });
  if (!await page.isVisible('#cp-card')) fail(`${label}: item link opened no card`);
  if (!/You have \d/.test(await page.textContent('#cp-card'))) fail(`${label}: item card does not show how many you have`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-chatpage-card.png` });
  await page.keyboard.press('Escape');
  await page.click('#cp-brag-btn');
  await page.waitForSelector('.cp-brag-img img', { timeout: 4000 }).catch(() => fail(`${label}: brag card was not drawn`));
  await page.screenshot({ path: `${ROOT}tests/out/${label}-chatpage-brag.png` });
  if (label === 'desktop') await page.$eval('.cp-brag-img img', async img => {
    const b = await (await fetch(img.src)).blob();
    const r = new FileReader(); return new Promise(res => { r.onload = () => res(r.result); r.readAsDataURL(b); });
  }).then(d => import('node:fs').then(fs => fs.writeFileSync(`${ROOT}tests/out/brag.png`, Buffer.from(d.split(',')[1], 'base64'))));
  await page.click('#cp-brag-send');
  await page.waitForSelector('#chat-attach-preview .attach-thumb', { timeout: 3000 }).catch(() => fail(`${label}: brag card did not land in the attachment slot`));
  await page.click('#chat-attach-remove');
  await page.fill('#chat-input', '/roll 6');
  await page.press('#chat-input', 'Enter');
  await page.waitForTimeout(400);
  if (!/rolled [1-6] \(1-6\)/.test(sent || '')) fail(`${label}: /roll did not send a roll (${sent})`);
  await page.click('#cp-room-btn');
  await page.waitForTimeout(1500);
  if (!await page.isVisible('#cp-room-canvas')) fail(`${label}: the room did not open`);
  if ((await page.textContent('#cp-room-count')).trim() !== '2') fail(`${label}: the room does not count 2 cats`);
  const box = await page.$eval('#cp-room-canvas', c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.click(box.x + box.w * 0.8, box.y + box.h * 0.7);
  await page.waitForTimeout(400);
  if (!(roomSent?.x > 400)) fail(`${label}: clicking the room did not send where to walk (${JSON.stringify(roomSent)})`);
  await page.fill('#chat-input', 'hello room');
  await page.press('#chat-input', 'Enter');
  await page.waitForTimeout(1200);
  if (await page.evaluate(() => room.cats.get('tester')?.bubble?.text) !== 'hello room') fail(`${label}: no speech bubble over my cat`);
  const again = await page.evaluate(() => {
    room.cats.get('tester').bubble = null;
    appendChatPosts([...pagePosts.values()], false);              // the poll hands back old messages
    const old = room.cats.get('tester').bubble;
    const guest = { username: 'guest', displayname: 'Guest Cat' };
    appendChatPosts([{ id: 990001, time: Date.now() / 1000, body: 'Test', user: guest, reactions: {}, media: [] }], false);
    room.cats.get('guest').bubble = null;
    appendChatPosts([{ id: 990002, time: Date.now() / 1000, body: 'Test', user: guest, reactions: {}, media: [] }], false);
    const twice = room.cats.get('guest').bubble?.text;
    appendChatPosts([{ id: 990003, time: Date.now() / 1000, body: '', user: guest, reactions: {}, media: [{ kind: 'img', url: 'icons/remicat.png' }] }], false);
    return { old, twice, pic: !!room.cats.get('guest').bubble?.img };
  });
  if (again.old) fail(`${label}: an old message popped up again as a bubble`);
  if (again.twice !== 'Test') fail(`${label}: the same text sent twice got no second bubble`);
  if (!again.pic) fail(`${label}: a picture message got no bubble`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-chatpage-room.png` });
  await page.click('#cp-room-btn');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) fail(`${label}: chat page scrolls sideways by ${overflow}px`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-chatpage.png` });
  await page.close();
}

// the world: a fake world.php that remembers where I go, sells one hat and plays a video
async function checkWorld(label, viewport) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => fail(`${label} world: page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fail(`${label} world: console error: ${m.text()}`); });
  page.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) fail(`${label} world: ${r.status()} ${r.url().slice(BASE.length)}`); });
  await page.addInitScript(t => { localStorage.setItem('bb_access', t); localStorage.setItem('bb_refresh', 'r'); localStorage.setItem('bb_mute', '1'); }, fakeJwt);
  await page.route('**/proxy.php', route => {
    const { path } = JSON.parse(route.request().postData() || '{}');
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(apiAnswer(path || '')) });
  });
  await page.route(/(chatroom|push)\.php/, route => route.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
  const w = { x: 900, y: 600, coins: 100, owned: [], wear: {}, sent: [], tv: null };
  await page.route('**/world.php', route => {
    const b = JSON.parse(route.request().postData() || '{}');
    w.sent.push(b);
    if (b.x != null) { w.x = b.x; w.y = b.y; }
    const out = { me: 'tester', now: Date.now() / 1000, coins: w.coins, wear: w.wear,
      ball: { x: 360, y: 980, vx: 0, vy: 0, age: 5 }, tv: w.tv,
      people: [{ u: 'tester', d: 'Tester', x: w.x, y: w.y, w: w.wear }, { u: 'guest', d: 'Guest Cat', x: 960, y: 640, w: { hat: 'crown' }, e: ['wave', 1], st: 'gm everyone' }] };
    if (b.status != null) out.status = b.status;
    if (b.buy === 'antenna' && w.coins >= 40) { w.coins -= 40; w.owned.push('antenna'); w.wear.hat = 'antenna'; out.shop = 'bought'; out.coins = w.coins; }
    if (b.tv) w.tv = out.tv = { v: 'dQw4w9WgXcQ', age: 0, by: 'Tester' };
    if (b.capsule) { w.wear.back = 'wings'; out.capsule = 'wings'; out.capsule_name = 'Wings'; }
    if (b.wish) out.wish = 'ok';
    if (b.fish) { out.fish = 'koi'; out.fish_name = 'Koi'; w.fish = 1; }
    if (b.fw) { w.coins -= 2; out.coins = w.coins; out.fw = 'ok'; out.fx = [[b.fw.x, b.fw.y, 0.1, 200]]; }
    if (b.gift) { w.coins -= b.gift.n; out.coins = w.coins; out.gift = 'ok'; }
    if (b.prof) out.prof = { u: b.prof, coins: 5, items: 1, wear: { hat: 'crown' }, bugs: 3, fish: 2, since: 1, here: true };
    w.have ||= { 'b:green': 2, 'j:bottle_cap': 1 };
    if (b.sell) { const k = b.sell.k; if (k && w.have[k]) { out.sell = { n: w.have[k], coins: 2 * w.have[k] }; w.coins += out.sell.coins; out.coins = w.coins; delete w.have[k]; } else out.sell = 'none'; }
    if (b.inv) out.inv = { owned: w.owned, bugs: [2, 1, 0], fish: w.fish ? { koi: 1 } : {}, fishnames: { minnow: 'Minnow', koi: 'Koi', golden: 'Golden fish' },
      have: w.have, seen: Object.keys(w.have), prices: Object.fromEntries(Object.keys(w.have).map(k => [k, 2])) };
    if (b.quests) out.quests = { daily: [{ name: 'Catch 3 beetles', n: 1, of: 3, coins: 10, done: false }], once: [{ name: 'Catch your first fish', coins: 10, done: true }] };
    if (b.dig) { out.dig = 't:clover'; out.quest = [['Dig through the lost and found', 10]]; }
    if (b.party) out.fx = [[b.party.x, b.party.y, 0.1, 40, b.party.k]];
    if (b.catch) { out.caught = b.catch; out.bug = 'green'; out.gone = [b.catch]; }
    if (b.shopinfo) { out.catalog = [{ id: 'antenna', slot: 'hat', name: 'Antenna', price: 40 }, { id: 'crown', slot: 'hat', name: 'Crown', price: 300 }, { id: 'wings', slot: 'back', name: 'Wings', price: 0 }]; out.owned = w.owned; }
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(out) });
  });
  // dm.php: the guest's key is my own, so a message to them opens on my side too
  const dm = { keys: {}, msgs: [] };
  await page.route('**/dm.php', route => {
    const b = JSON.parse(route.request().postData() || '{}');
    const out = { me: 'tester', now: Math.floor(Date.now() / 1000) };
    if (b.act === 'setkey') dm.keys.tester = dm.keys.guest = b.pub;
    if (b.act === 'pub') out.pub = dm.keys[b.u] || null;
    if (b.act === 'send') { dm.msgs.push({ id: dm.msgs.length + 1, a: 'tester', b: b.to, ka: b.ka, kb: b.kb, iv: b.iv, ct: b.ct, t: out.now }); out.id = dm.msgs.length; }
    if (['setkey', 'send', 'inbox', 'hello'].includes(b.act)) { out.msgs = dm.msgs.filter(m => m.id > (b.since || 0)); out.oldest = dm.msgs[0]?.id || 0; out.key = dm.keys.tester || null; }
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  await page.goto(BASE + '/world.html');
  await page.waitForTimeout(1500);
  if (await page.isVisible('#login-screen')) fail(`${label} world: did not start`);
  if ((await page.$$eval('#chat-messages .chat-msg', els => els.length)) !== 3) fail(`${label} world: chat beside the world is missing`);
  if (!(await page.textContent('#w-coins')).includes('100')) fail(`${label} world: coins not shown`);
  if (await page.evaluate(() => world.cats.size) < 2) fail(`${label} world: the other cat is missing`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world.png` });
  const box = await page.$eval('#w-top', c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.click(box.x + box.w * 0.75, box.y + box.h * 0.5);
  await page.waitForTimeout(500);
  if (!(w.sent.at(-1)?.x > 900)) fail(`${label} world: clicking did not send where to walk`);
  await page.click('#w-emote-btn');
  await page.click('#w-emotes [data-emote="heart"]');
  await page.waitForTimeout(300);
  if (!w.sent.some(b => b.emote === 'heart')) fail(`${label} world: emote not sent`);
  const goTo = (x, y) => page.evaluate(([x, y]) => { const me = world.cats.get(world.me); me.x = me.tx = x; me.y = me.ty = y; world.target = null; world.pending = null; }, [x, y]);
  // walk up to the counter in the terminal: a prompt floats over it, E opens the wardrobe
  await goTo(1440, 330);
  await page.waitForTimeout(300);
  if (await page.evaluate(() => world.near?.id) !== 'shop') fail(`${label} world: no prompt at the counter`);
  await page.keyboard.press('e');
  await page.waitForSelector('[data-buy="antenna"]', { timeout: 3000 }).catch(() => fail(`${label} world: shop shows no items`));
  await page.click('[data-buy="antenna"]');
  await page.waitForTimeout(500);
  if (!await page.$('[data-off="hat"]')) fail(`${label} world: buying did not put the hat on`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-shop.png` });
  await page.keyboard.press('Escape');
  // the capsule machine
  await goTo(1640, 350);
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  await page.click('#w-cap-turn');
  await page.waitForTimeout(2200);
  if (!await page.isVisible('#w-cap-got')) fail(`${label} world: the capsule machine gave nothing`);
  await page.keyboard.press('Escape');
  // the well
  await goTo(900, 660);
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  if (!w.sent.some(b => b.wish)) fail(`${label} world: the well took no wish`);
  // the club screen: tapping it walks there and opens it on arrival
  await goTo(360, 330);
  await page.waitForTimeout(300);
  await page.evaluate(() => { world.pending = SPOTS.find(s => s.id === 'screen'); world.target = { ...world.pending.at }; });
  await page.waitForTimeout(800);
  if (!await page.isVisible('#w-tv-consent')) fail(`${label} world: the screen asks no consent before YouTube`);
  await page.fill('#w-tv-url', 'https://youtu.be/dQw4w9WgXcQ');
  await page.click('#w-tv-play');
  await page.waitForTimeout(1300);
  if (!w.sent.some(b => b.tv)) fail(`${label} world: video not sent`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-club.png` });
  await page.keyboard.press('Escape');
  // a beetle in the garden gets caught by walking into it
  await page.evaluate(() => { const b = bugAt(0, netNow()); const me = world.cats.get(world.me); me.x = me.tx = b.x; me.y = me.ty = b.y; world.target = null; });
  await page.waitForTimeout(700);
  if (!w.sent.some(b => b.catch)) fail(`${label} world: walking into a beetle caught nothing`);
  // the workbench opens the game for a password login
  await goTo(1440, 950);
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  if (!await page.$('#w-lab iframe')) fail(`${label} world: the workbench did not open the game`);
  await page.click('#w-lab-close');
  await page.waitForTimeout(300);
  if (!w.sent.some(b => b.xp)) fail(`${label} world: closing the game asked for no coins`);
  // the pond: cast, wait for the bite, reel in
  await goTo(460, 680);
  await page.waitForTimeout(300);
  if (await page.evaluate(() => world.near?.id) !== 'pond') fail(`${label} world: no prompt at the pond`);
  await page.keyboard.press('e');
  await page.evaluate(() => { world.fishing.bite = performance.now() / 1000 - 0.1; });
  await page.waitForTimeout(100);
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  if (!w.sent.some(b => b.fish)) fail(`${label} world: fishing sent nothing`);
  // a firework from the toys
  await page.click('#w-toy-btn');
  await page.click('#w-toys [data-toy="fw"]');
  await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.3);
  await page.waitForTimeout(400);
  if (!w.sent.some(b => b.fw)) fail(`${label} world: the firework did not go up`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-toys.png` });
  await page.keyboard.press('Escape');
  // the bag
  await page.click('#w-bag-btn');
  await page.click('#w-bag [data-tab="fish"]');
  await page.waitForTimeout(400);
  if (!(await page.textContent('#w-bag-list')).includes('Koi')) fail(`${label} world: the bag does not show the fish`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-bag.png` });
  await page.keyboard.press('Escape');
  // the stall buys what is in the bag
  await goTo(1300, 560);
  await page.waitForTimeout(300);
  if (await page.evaluate(() => world.near?.id) !== 'stall') fail(`${label} world: no prompt at the stall`);
  await page.keyboard.press('e');
  await page.waitForSelector('[data-sell="b:green"]', { timeout: 3000 }).catch(() => fail(`${label} world: the stall offers nothing to sell`));
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-sell.png` });
  await page.click('[data-sell="b:green"]');
  await page.waitForTimeout(500);
  if (!w.sent.some(b => b.sell?.k === 'b:green' && b.x === 1300)) fail(`${label} world: selling sent nothing from the stall`);
  if (await page.$('[data-sell="b:green"]')) fail(`${label} world: the sold beetles are still in the bag`);
  await page.keyboard.press('Escape');
  // the lost and found box, and the quest list
  await goTo(1624, 740);
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  await page.waitForTimeout(400);
  if (!w.sent.some(b => b.dig)) fail(`${label} world: the lost and found box was not searched`);
  await page.click('#w-quest-btn');
  await page.waitForTimeout(400);
  if (!(await page.textContent('#w-quests-list')).includes('Catch 3 beetles')) fail(`${label} world: the quest list is empty`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-quests.png` });
  await page.keyboard.press('Escape');
  // confetti, and the night
  await page.click('#w-toy-btn');
  await page.click('#w-toys [data-toy="confetti"]');
  await page.mouse.click(box.x + box.w * 0.5, box.y + box.h * 0.5);
  await page.waitForTimeout(400);
  if (!w.sent.some(b => b.party?.k === 'confetti')) fail(`${label} world: no confetti`);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Enter');
  if (await page.evaluate(() => document.activeElement?.id) !== 'chat-input') fail(`${label} world: Enter did not focus the chat`);
  await page.click('#w-dark-btn');
  await page.waitForTimeout(600);
  if (!await page.evaluate(() => document.body.classList.contains('w-dark'))) fail(`${label} world: night mode did not turn on`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-night.png` });
  await page.click('#w-dark-btn');
  // someone's card: from a name, with things to do together
  await page.evaluate(() => openProfile('guest'));
  await page.waitForTimeout(500);
  if (!await page.isVisible('#w-card .wc-lcd')) fail(`${label} world: the profile card did not open`);
  await page.click('#w-card [data-gift="5"]');
  await page.waitForTimeout(400);
  if (!w.sent.some(b => b.gift?.to === 'guest')) fail(`${label} world: the gift was not sent`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-card.png` });
  await page.keyboard.press('Escape');
  // my own card sets a status
  await page.evaluate(() => openProfile('tester'));
  await page.waitForTimeout(400);
  await page.fill('#w-card .wc-status-set input', 'fishing all day');
  await page.press('#w-card .wc-status-set input', 'Enter');
  await page.waitForTimeout(400);
  if (!w.sent.some(b => b.status === 'fishing all day')) fail(`${label} world: the status was not sent`);
  await page.keyboard.press('Escape');
  await page.click('#w-card header button').catch(() => {});
  // the sky colour slider turns the sky
  await page.click('#cp-settings-btn');
  const hb = await page.$eval('#w-hue .hue-track', t => { const r = t.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.click(hb.x + hb.w * 0.92, hb.y + hb.h / 2);
  await page.waitForTimeout(500);
  if (await page.evaluate(() => world.hue) < 300) fail(`${label} world: the sky colour slider did nothing`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-hue.png` });
  await page.click('#cp-settings-btn');
  await page.evaluate(() => { localStorage.removeItem('bb_world_hue'); world.hue = SKY_HUE; paintSky(); });
  // the people list slides in and back out
  await page.click('#cp-people-btn');
  await page.waitForTimeout(300);
  await page.click('#cp-side-close');
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.body.classList.contains('cp-side-open'))) fail(`${label} world: the people list does not close`);
  // the remilia sign-in finds the garden gate shut
  if (await page.evaluate(() => { localStorage.setItem('bb_chat_rn', '1'); const r = blocked(1440, 784); localStorage.removeItem('bb_chat_rn'); return r; }) !== 'lab') fail(`${label} world: the garden gate is open for the remilia sign-in`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-garden.png` });
  // a message to the other cat, sealed in the browser
  await page.evaluate(() => window.dmOpen('guest', 'Guest Cat'));
  await page.fill('#dm-input', 'hello in secret');
  await page.click('#dm-send');
  await page.waitForTimeout(800);
  if (!dm.msgs.length || dm.msgs[0].ct.includes('hello')) fail(`${label} world: message not sent sealed (${JSON.stringify(dm.msgs)})`);
  if (!(await page.textContent('#dm-body')).includes('hello in secret')) fail(`${label} world: own message cannot be read back`);
  await page.screenshot({ path: `${ROOT}tests/out/${label}-world-dm.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) fail(`${label} world: scrolls sideways by ${overflow}px`);
  await page.close();
}

try {
  await check('desktop', { width: 1400, height: 860 });
  await check('phone', { width: 400, height: 860 });
  await checkChatPage('desktop', { width: 1400, height: 860 });
  await checkChatPage('phone', { width: 400, height: 860 });
  await checkChatPageV1('phone', { width: 400, height: 860 });
  await checkWorld('desktop', { width: 1400, height: 860 });
  await checkWorld('phone', { width: 400, height: 860 });
} finally {
  await browser.close();
  server.kill();
}

if (problems.length) {
  console.error(`✗ smoke test failed (${problems.length}):\n  ` + [...new Set(problems)].join('\n  '));
  process.exit(1);
}
console.log('✓ smoke test passed (desktop + phone, game + chat page). Screenshots in tests/out/');
