// BeetleBoy SP · Item links and the RemiliaNET global chat.
// Classic script sharing globals with the others; load order is set in index.html.

// ── ITEM LINKS ────────────────────────────────────────────────────────────────
const LINK_COLORS = { tin:'var(--tin)',brz:'var(--brz)',mth:'var(--mth)',adm:'var(--adm)',dia:'var(--dia)',pnk:'var(--pnk)',jnk:'var(--jnk)' };

function bodyToPlainText(body) {
  return body.replace(/\[\[([a-z0-9_]+)\]\]/g, (_, key) => `[${iname(key)}]`);
}

function renderChatBody(body) {
  const URL_RE   = /\bhttps?:\/\/\S+/g;
  const IMG_EXT  = /\.(?:jpe?g|png|gif|webp)(?:[?#]\S*)?$/i;
  const parts = [];
  let last = 0;
  for (const m of body.matchAll(URL_RE)) {
    if (m.index > last) parts.push({ t: 'text', v: body.slice(last, m.index) });
    parts.push({ t: IMG_EXT.test(m[0]) ? 'img' : 'url', v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ t: 'text', v: body.slice(last) });
  return parts.map(p => {
    if (p.t === 'img') return `<img class="chat-img" src="${esc(p.v)}" alt="" loading="lazy" onerror="this.style.display='none'">`;
    if (p.t === 'url') return `<a class="chat-link" href="${esc(p.v)}" target="_blank" rel="noopener noreferrer">${esc(p.v)}</a>`;
    return esc(p.v).replace(/\n/g, '<br>').replace(/\[\[([a-z0-9_]+)\]\]/g, (_, key) => {
      const col = LINK_COLORS[RARITY[key]] || '';
      return `<span class="chat-item-link" data-key="${key}"${col ? ` style="color:${col}"` : ''}>[${esc(iname(key))}]</span>`;
    }).replace(/(^|\s)([~@])([\w.-]{2,32})/g, (m, pre, sign, h) =>
      `${pre}<span class="chat-at${h.toLowerCase() === (state.user?.username || '').toLowerCase() ? ' me' : ''}">${sign}${h}</span>`);
  }).join('');
}

function resolveItemLinks(text) {
  return text.replace(/\[([^\][\n]+)\]/g, (match, typed) => {
    const lower = typed.toLowerCase().trim();
    const entry = Object.entries(NAMES).find(([, n]) => n.toLowerCase() === lower);
    return entry ? `[[${entry[0]}]]` : match;
  });
}

function getChatLinkQuery(input) {
  const before = input.value.slice(0, input.selectionStart);
  const lastOpen  = before.lastIndexOf('[');
  const lastClose = before.lastIndexOf(']');
  if (lastOpen === -1 || lastOpen < lastClose) return null;
  return before.slice(lastOpen + 1);
}

function updateChatSuggest(input) {
  const suggest = document.getElementById('chat-suggest');
  const at = /(^|\s)[~@]([\w.-]*)$/.exec(input.value.slice(0, input.selectionStart));
  if (at) {
    const q = at[2].toLowerCase();
    const people = [...new Map([...chatUsers.values()].map(u => [u.handle, u])).values()]
      .filter(u => u.handle && (u.handle.toLowerCase().startsWith(q) || (u.display_name || '').toLowerCase().startsWith(q)))
      .slice(0, 8);
    if (!people.length) { suggest.classList.remove('open'); return; }
    suggest.innerHTML = people.map(u =>
      `<div class="chat-sug-item chat-sug-user" data-handle="${esc(u.handle)}" style="--name-h:${nameHue(u.display_name || u.handle)}">~${esc(u.handle)}${u.display_name && u.display_name !== u.handle ? ` <span class="chat-sug-dn">${esc(u.display_name)}</span>` : ''}</div>`).join('');
    suggest.classList.add('open');
    return;
  }
  const query   = getChatLinkQuery(input);
  if (query === null) { suggest.classList.remove('open'); return; }
  const lower = query.toLowerCase();
  const inv   = state.inv || {};
  const matches = Object.entries(NAMES)
    .filter(([, n]) => n.toLowerCase().includes(lower))
    .sort(([ka], [kb]) => (inv[kb] || 0) - (inv[ka] || 0))
    .slice(0, 8);
  if (!matches.length) { suggest.classList.remove('open'); return; }
  suggest.innerHTML = matches.map(([k, n]) => {
    const col = LINK_COLORS[RARITY[k]] || '';
    return `<div class="chat-sug-item" data-key="${k}"${col ? ` style="color:${col}"` : ''}>[${esc(n)}]</div>`;
  }).join('');
  suggest.classList.add('open');
}

function insertChatLink(key) {
  const input = document.getElementById('chat-input');
  const val   = input.value;
  const pos   = input.selectionStart;
  const before = val.slice(0, pos);
  const idx    = before.lastIndexOf('[');
  const link   = `[${iname(key)}]`;
  input.value  = (idx !== -1 ? val.slice(0, idx) : before) + link + val.slice(pos);
  const np = (idx !== -1 ? idx : pos) + link.length;
  input.setSelectionRange(np, np);
  document.getElementById('chat-suggest').classList.remove('open');
  input.focus();
}

// ── CHAT ──────────────────────────────────────────────────────────────────────
// RemiliaNET global chat (chat 1). Messages are read through proxy.php and
// sent/reacted through chatroom.php, which talks to RemiliaNET's chat websocket.
const CHAT_ID         = 1;
const CHAT_POLL_MS    = 4000;
// the only reactions RemiliaNET chat accepts
const CHAT_REACTS     = ['😹', '🤍', '😮', '🔥', '👍'];
let chatTimer         = null;
let chatLoaded        = false;
let chatBusy          = false;
let replyTarget       = null;
let pendingAttachment = null; // { file }
const renderedPostEls = new Map(); // msgId → DOM element
const chatUsers       = new Map(); // user id → { handle, display_name, profile_pic_url }
const chatMsgs        = new Map(); // msg id → raw message (for reply quotes)
let chatOldestId      = null;      // for loading older messages on scroll-up
let chatHasOlder      = true;
let chatLoadingOlder  = false;

// Is this message for me? RemiliaNET sends mention ids; @handle in text also counts
function mentionsMe(m, body) {
  const me = state.user;
  if (!me) return false;
  if ((m.mentions || []).includes(Number(me.id))) return true;
  return !!me.username && new RegExp(`(^|\\s)[~@]${me.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(body || '');
}

const rnUrl = u => !u ? '' : (u.startsWith('/') ? BASE_URL + u : u);

// Upload to RemiliaNET's media store (through chatroom.php) so the image
// shows natively for everyone on remilia.net. Returns {mediaId, url} or null.
async function uploadChatImage(file) {
  const send = token => {
    const fd = new FormData();
    fd.append('action', 'upload');
    fd.append('token', token);
    fd.append('file', file);
    return fetch(CHAT_URL, { method: 'POST', body: fd });
  };
  try {
    let r = await send(getTokens().access);
    if (r.status === 502) {
      const stale = getTokens().access;
      const t = await tryRefresh(stale);
      if (t?.access) r = await send(t.access);
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.mediaId) { showInAppNotif(j.error || 'Image upload failed.'); return null; }
    return j;
  } catch (e) { showInAppNotif('Image upload failed.'); return null; }
}

function setPendingAttachment(file) {
  pendingAttachment = { file };
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('chat-attach-preview');
    prev.innerHTML = `<img class="attach-thumb" src="${esc(e.target.result)}" alt=""><button id="chat-attach-remove" type="button" title="Remove">✕</button>`;
    prev.classList.remove('hidden');
    document.getElementById('chat-attach-remove').addEventListener('click', clearPendingAttachment);
  };
  reader.readAsDataURL(file);
}

function clearPendingAttachment() {
  pendingAttachment = null;
  const prev = document.getElementById('chat-attach-preview');
  prev.innerHTML = '';
  prev.classList.add('hidden');
}

function chatUser(id) {
  const u = chatUsers.get(id);
  return {
    username:    u?.handle || '',
    displayname: u?.display_name || u?.handle || '',
    pfpUrl:      rnUrl(u?.profile_pic_url || ''),
  };
}

// RemiliaNET message → the post shape the renderer uses
function toPost(m) {
  const reactions = {};
  for (const r of m.reactions || []) {
    (reactions[r.emoji] ||= []).push(chatUsers.get(r.user_id)?.handle || String(r.user_id));
  }
  let replyTo = null;
  if (m.reply_to_message_id) {
    const q = chatMsgs.get(m.reply_to_message_id);
    const qu = q ? chatUser(q.author_id) : {};
    replyTo = { id: m.reply_to_message_id, username: qu.username || '', displayname: qu.displayname || '', body: q?.body || '…' };
  }
  const media = [];
  for (const im of m.images || []) media.push({ kind: 'img', url: rnUrl(im.url) });
  if (m.video) media.push({ kind: 'video', url: rnUrl(m.video.url), thumb: rnUrl(m.video.thumbnail_url) });
  return {
    id: m.id, type: 'msg',
    time: Math.floor(m.created_at / 1000),
    body: m.is_deleted ? '(deleted)' : (m.body || ''),
    user: chatUser(m.author_id),
    reactions, replyTo, media,
    mentionsMe: mentionsMe(m, m.body),
  };
}

async function fetchChat() {
  if (chatBusy) return;
  chatBusy = true;
  try {
    const d = await apiGet(`/api/chats/${CHAT_ID}/messages?limit=50`);
    if (!d?.global) return;
    for (const [id, u] of Object.entries(d.global.users || {})) chatUsers.set(Number(id), u);
    for (const [id, m] of Object.entries(d.global.messages || {})) chatMsgs.set(Number(id), m);
    const ids = (d.message_ids || []).slice().sort((a, b) => a - b);
    const posts = ids.map(id => chatMsgs.get(id)).filter(Boolean).map(toPost);
    const isInit = !chatLoaded;
    chatLoaded = true;
    // has_more_older is always false; oldest_reachable_id is the real limit
    if (isInit) { chatOldestId = ids[0] ?? null; chatHasOlder = !!ids.length && ids[0] > (d.oldest_reachable_id || 0); }
    appendChatPosts(posts, isInit);
  } finally { chatBusy = false; }
}

async function loadOlderChat() {
  if (chatLoadingOlder || !chatHasOlder || !chatOldestId) return;
  chatLoadingOlder = true;
  try {
    const d = await apiGet(`/api/chats/${CHAT_ID}/messages?limit=50&before=${chatOldestId}`);
    if (!d?.global) return;
    for (const [id, u] of Object.entries(d.global.users || {})) chatUsers.set(Number(id), u);
    for (const [id, m] of Object.entries(d.global.messages || {})) chatMsgs.set(Number(id), m);
    const ids = (d.message_ids || []).slice().sort((a, b) => a - b);
    chatHasOlder = ids.length > 0 && ids[0] > (d.oldest_reachable_id || 0);
    if (ids.length) chatOldestId = ids[0];
    appendChatPosts(ids.map(id => chatMsgs.get(id)).filter(Boolean).map(toPost), false, true);
  } finally { chatLoadingOlder = false; }
}

async function chatAction(payload) {
  const { access } = getTokens();
  if (!access) return { ok: false, error: 'not logged in' };
  try {
    let r = await fetch(CHAT_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: access, ...payload }),
    });
    if (r.status === 502) {            // expired session: refresh once and retry
      const t = await tryRefresh(access);
      if (t?.access) {
        r = await fetch(CHAT_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: t.access, ...payload }),
        });
      }
    }
    return await r.json().catch(() => ({ ok: r.ok }));
  } catch (e) { return { ok: false, error: e.message }; }
}

async function sendReact(msgId, emoji) {
  if (!msgId || msgId < 0) return;
  const me = state.user?.username;
  const el = renderedPostEls.get(msgId);
  const mine = el?.querySelector(`.react-pill.mine[data-emoji="${emoji}"]`);
  const res = await chatAction({ action: mine ? 'unreact' : 'react', messageId: msgId, emoji });
  if (!res.ok) { sfx('fail'); showInAppNotif(res.error || 'Reaction failed.'); return; }
  sfx('react');
  if (me) fetchChat();
}

function renderReactPills(container, reactions, msgId) {
  const myUser = state.user?.username || '';
  container.innerHTML = '';
  const emojis = [...new Set([...CHAT_REACTS, ...Object.keys(reactions || {})])];
  for (const emoji of emojis) {
    const users = reactions?.[emoji];
    if (!users || !users.length) continue;
    const mine = users.includes(myUser);
    const pill = document.createElement('button');
    pill.className = `react-pill${mine ? ' mine' : ''}`;
    pill.dataset.emoji = emoji;
    pill.title = users.join(', ');
    pill.textContent = `${emoji} ${users.length}`;
    pill.addEventListener('click', () => sendReact(msgId, emoji));
    container.appendChild(pill);
  }
}

function mediaHtml(media) {
  return (media || []).map(m => m.kind === 'video'
    ? `<video class="chat-img" src="${esc(m.url)}"${m.thumb ? ` poster="${esc(m.thumb)}"` : ''} controls preload="none" playsinline></video>`
    : `<img class="chat-img" src="${esc(m.url)}" alt="" loading="lazy" onerror="this.style.display='none'">`).join('');
}

function appendChatPosts(posts, isInit, prepend = false) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 60;
  const older = prepend ? document.createDocumentFragment() : null;
  const prevHeight = box.scrollHeight;
  if (isInit) { box.innerHTML = ''; renderedPostEls.clear(); }
  const myUser = state.user?.username || '';
  for (const p of posts) {
    // Known message: refresh text and reactions (edits, deletions, new reactions)
    if (renderedPostEls.has(p.id)) {
      const el = renderedPostEls.get(p.id);
      const textEl = el.querySelector('.chat-text');
      const html = renderChatBody(resolveItemLinks(p.body || ''));
      if (textEl && textEl.innerHTML !== html) textEl.innerHTML = html;
      const pillsEl = el.querySelector('.chat-reacts');
      if (pillsEl) renderReactPills(pillsEl, p.reactions || {}, p.id);
      continue;
    }

    const el = document.createElement('div');
    el.className = 'chat-msg' + (p.mentionsMe ? ' chat-msg-mention' : '');
    const uname = p.user?.username || '';
    const name = esc(p.user?.displayname || uname || '?');
    const profileUrl = uname ? `${BASE_URL}/~${encodeURIComponent(uname)}` : '';
    const profileLink = inner => profileUrl
      ? `<a class="chat-profile-link" href="${profileUrl}" target="_blank" rel="noopener">${inner}</a>`
      : inner;
    const nameSpan = `<span class="chat-user" style="--name-h:${nameHue(p.user?.displayname || uname)}">${name}</span>`;
    const time = p.time > 0 ? new Date(p.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const avatar = p.user?.pfpUrl
      ? `<img class="chat-avatar" src="${esc(p.user.pfpUrl)}" alt="" onerror="this.style.display='none'">`
      : '<div class="chat-avatar-ph"></div>';

    let quoteHtml = '';
    if (p.replyTo) {
      const qname = esc(p.replyTo.displayname || p.replyTo.username || '…');
      const qbody = esc(bodyToPlainText(p.replyTo.body || '').slice(0, 80));
      quoteHtml = `<div class="chat-reply-quote" data-reply-id="${p.replyTo.id}">↩ ${qname}: ${qbody}</div>`;
    }
    const actionsHtml = p.id > 0 ? `<div class="chat-actions">${
      CHAT_REACTS.map(e => `<button class="chat-action-btn react-trigger" data-emoji="${e}" data-msgid="${p.id}">${e}</button>`).join('')
    }<button class="chat-action-btn reply-trigger" data-msgid="${p.id}" data-uname="${esc(uname)}" data-dname="${name}" data-body="${esc(bodyToPlainText(p.body || '').slice(0, 100))}">↩</button></div>` : '';

    el.innerHTML =
      profileLink(avatar) +
      `<div class="chat-body">` +
      `<div class="chat-meta">${profileLink(nameSpan)}<span class="chat-time">${time}</span></div>` +
      quoteHtml +
      `<div class="chat-text">${renderChatBody(resolveItemLinks(p.body || ''))}</div>` +
      mediaHtml(p.media) +
      `<div class="chat-reacts"></div>` +
      `</div>` +
      actionsHtml;
    renderReactPills(el.querySelector('.chat-reacts'), p.reactions || {}, p.id);

    const forMe = uname !== myUser && (p.replyTo?.username === myUser || p.mentionsMe);
    if (!isInit && !prepend && uname !== myUser) sfx(forMe ? 'mention' : 'message');
    if (!isInit && !prepend && p.mentionsMe && uname !== myUser && p.replyTo?.username !== myUser) {
      if (document.hidden) notify(`${p.user?.displayname || uname} mentioned you`, 'mention');
      else showInAppNotif(`${p.user?.displayname || uname} mentioned you!`);
    }
    if (!isInit && !prepend && myUser && p.replyTo?.username === myUser && uname !== myUser) {
      if (document.hidden) notify(`${p.user?.displayname || uname} replied to you`);
      else showInAppNotif(`${p.user?.displayname || uname} replied to you!`);
    }
    renderedPostEls.set(p.id, el);
    if (older) older.appendChild(el); else box.appendChild(el);
  }
  if (older) {                                   // keep the view where it was
    box.insertBefore(older, box.firstChild);
    box.scrollTop += box.scrollHeight - prevHeight;
    return;
  }
  // drop optimistic placeholders once the real messages have arrived
  if (posts.length) {
    for (const [id, el] of renderedPostEls) {
      if (id < 0 && Date.now() + id > 8000) { el.remove(); renderedPostEls.delete(id); }
    }
  }
  if (isInit || atBottom) box.scrollTop = box.scrollHeight;
}

// Same per-name colors as RemiliaNET chat: the hue comes from a hash of the
// display name (lightness is set in CSS per color scheme).
function nameHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h % 360);
}

function showInAppNotif(text) {
  const el = document.getElementById('chat-notif');
  if (!el) return;
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 4000);
}

function setReplyTarget(target) {
  replyTarget = target;
  const bar = document.getElementById('reply-bar');
  if (!bar) return;
  if (target) {
    document.getElementById('reply-bar-name').textContent = target.displayname || target.username;
    bar.classList.remove('hidden');
    document.getElementById('chat-input').focus();
  } else {
    bar.classList.add('hidden');
  }
}

function startChatPoll() {
  if (chatTimer) return;
  fetchChat();
  chatTimer = setInterval(() => { if (!document.hidden) fetchChat(); }, CHAT_POLL_MS);
}

function stopChatPoll() {
  clearInterval(chatTimer);
  chatTimer = null;
  setReplyTarget(null);
}

// Posts to global chat. Item links go out as plain "[Item Name]" so everyone
// on RemiliaNET can read them; BeetleBoy turns them back into links.
async function postToChat(text, replyTo = null, mediaIds = []) {
  return chatAction({ action: 'submit', text: bodyToPlainText(text), ...(replyTo ? { replyTo } : {}), ...(mediaIds.length ? { mediaIds } : {}) });
}

async function sendChatMsg() {
  const input = document.getElementById('chat-input');
  document.getElementById('chat-suggest').classList.remove('open');
  let msg = resolveItemLinks((input.value || '').trim());
  const attach = pendingAttachment;
  if (!msg && !attach) return;
  if (!getTokens().access) return;
  const rt = replyTarget;
  setReplyTarget(null);
  input.value = '';
  input.disabled = true;

  let media = null;
  if (attach) {
    clearPendingAttachment();
    media = await uploadChatImage(attach.file);
    if (!media && !msg) { input.disabled = false; input.focus(); return; }
  }

  // Optimistic: show it right away with a negative placeholder id
  const optId = -Date.now();
  appendChatPosts([{
    id: optId, type: 'msg', time: Math.floor(Date.now() / 1000), body: msg,
    user: { username: state.user?.username || '', displayname: state.user?.displayname || '', pfpUrl: state.user?.pfpUrl || '' },
    reactions: {}, replyTo: rt || null,
    media: media ? [{ kind: 'img', url: media.url }] : [],
  }], false);

  sfx('send');
  const res = await postToChat(msg, rt?.id, media ? [media.mediaId] : []);
  const optEl = renderedPostEls.get(optId);
  if (optEl) optEl.remove();
  renderedPostEls.delete(optId);
  if (!res.ok) {
    input.value = bodyToPlainText(msg);
    showInAppNotif(res.error || 'Message failed.');
  } else {
    await fetchChat();
  }
  input.disabled = false;
  input.focus();
}
