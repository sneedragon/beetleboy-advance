// ── SOUND EFFECTS ─────────────────────────────────────────────────────────────
// Little synthesized sounds (Web Audio, no files). sfx('name') plays one;
// the speaker grille in the header mutes/unmutes (remembered per browser).
const SFX = (() => {
  const LS_MUTE = 'bb_mute';
  let ctx = null, out = null, verb = null;
  let muted = false;
  try { muted = localStorage.getItem(LS_MUTE) === '1'; } catch {}
  const last = {};
  const PENTA = [0, 2, 4, 7, 9];   // small pitch variation that always sounds nice

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createDynamicsCompressor();
    out.threshold.value = -18; out.ratio.value = 4;
    const master = ctx.createGain();
    master.gain.value = 0.55;
    out.connect(master); master.connect(ctx.destination);
    // short fake reverb: a few quiet echoes
    verb = ctx.createGain(); verb.gain.value = 0.18;
    let prev = verb;
    for (const [t, g] of [[0.045, 0.6], [0.09, 0.4], [0.16, 0.25]]) {
      const d = ctx.createDelay(); d.delayTime.value = t;
      const gg = ctx.createGain(); gg.gain.value = g;
      prev.connect(d); d.connect(gg); gg.connect(out);
    }
    return ctx;
  }

  const vary = (f, steps = 0) => f * 2 ** ((PENTA[Math.floor(Math.random() * PENTA.length)] * steps) / 12 / 4);

  // one enveloped oscillator
  function tone(freq, { type = 'sine', at = 0, dur = 0.12, vol = 0.12, attack = 0.005, slide = 0, wet = true } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); if (wet) g.connect(verb);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise({ at = 0, dur = 0.15, vol = 0.1, freq = 1200, q = 1, type = 'bandpass' } = {}) {
    const t = ctx.currentTime + at;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t);
  }

  const arp = (notes, step, opts) => notes.forEach((n, i) => tone(n, { ...opts, at: i * step }));

  const SOUNDS = {
    hover:    () => tone(vary(880, 1), { dur: 0.07, vol: 0.025, attack: 0.01 }),
    click:    () => { tone(vary(1320, 1), { type: 'triangle', dur: 0.05, vol: 0.06, wet: false }); tone(660, { dur: 0.04, vol: 0.03, wet: false }); },
    tab:      () => tone(vary(990, 1), { type: 'triangle', dur: 0.08, vol: 0.05, slide: 1.25 }),
    panel:    () => noise({ dur: 0.18, vol: 0.05, freq: 900, q: 0.6 }),
    claim:    () => arp([523.25, 659.25, 783.99, 1046.5], 0.07, { type: 'triangle', dur: 0.22, vol: 0.09 }),
    cheese:   () => { arp([392, 523.25, 659.25], 0.06, { type: 'square', dur: 0.12, vol: 0.035 }); tone(1318.5, { at: 0.2, dur: 0.4, vol: 0.05 }); },
    junk:     () => { noise({ dur: 0.12, vol: 0.12, freq: 400, q: 2 }); noise({ at: 0.09, dur: 0.1, vol: 0.09, freq: 700, q: 3 }); },
    rare:     () => { arp([783.99, 987.77, 1174.66, 1567.98, 1975.5], 0.06, { dur: 0.35, vol: 0.06 }); noise({ at: 0.3, dur: 0.4, vol: 0.03, freq: 6000, q: 4 }); },
    craft:    () => { tone(220, { type: 'square', dur: 0.06, vol: 0.05, wet: false }); arp([659.25, 880], 0.08, { type: 'triangle', at: 0.05, dur: 0.18, vol: 0.07 }); },
    smash:    () => { noise({ dur: 0.08, vol: 0.2, freq: 250, q: 1.2 }); tone(110, { dur: 0.15, vol: 0.12, slide: 0.5, wet: false }); },
    unlucky:  () => tone(220, { type: 'sawtooth', dur: 0.3, vol: 0.05, slide: 0.6 }),
    fail:     () => { tone(330, { type: 'square', dur: 0.09, vol: 0.04, wet: false }); tone(247, { type: 'square', at: 0.1, dur: 0.14, vol: 0.04, wet: false }); },
    hammerBreak: () => { noise({ dur: 0.25, vol: 0.22, freq: 3000, q: 0.8, type: 'highpass' }); tone(180, { dur: 0.2, vol: 0.1, slide: 0.4 }); },
    ready:    () => arp([880, 1174.66], 0.09, { dur: 0.3, vol: 0.06 }),
    message:  () => tone(vary(1046.5, 1), { dur: 0.1, vol: 0.05, slide: 1.1 }),
    send:     () => tone(784, { type: 'triangle', dur: 0.1, vol: 0.06, slide: 1.5 }),
    mention:  () => arp([1046.5, 1318.5, 1046.5], 0.08, { dur: 0.15, vol: 0.07 }),
    react:    () => tone(vary(1567.98, 1), { dur: 0.08, vol: 0.05 }),
    beetle:   () => { const f = vary(1800, 3); tone(f, { type: 'triangle', dur: 0.05, vol: 0.06, slide: 1.4 }); tone(f * 1.2, { type: 'triangle', at: 0.06, dur: 0.05, vol: 0.05, slide: 1.3 }); },
    beetleMad: () => tone(300, { type: 'sawtooth', dur: 0.15, vol: 0.05, slide: 0.7 }),
    flee:     () => noise({ dur: 0.35, vol: 0.08, freq: 1800, q: 0.5 }),
    unmute:   () => arp([659.25, 987.77], 0.07, { type: 'triangle', dur: 0.15, vol: 0.06 }),
  };
  // Halloween: minor, a bit wobbly
  const SPOOKY = {
    claim:  () => arp([440, 523.25, 622.25, 880], 0.08, { type: 'triangle', dur: 0.3, vol: 0.08 }),
    ready:  () => { arp([659.25, 622.25], 0.12, { dur: 0.4, vol: 0.06 }); tone(330, { at: 0.05, dur: 0.6, vol: 0.03, type: 'sine', slide: 0.97 }); },
    beetle: () => { tone(vary(900, 2), { type: 'sawtooth', dur: 0.12, vol: 0.03, slide: 0.7 }); tone(1350, { at: 0.08, dur: 0.18, vol: 0.03, slide: 0.6 }); },
    rare:   () => { arp([523.25, 622.25, 783.99, 1046.5, 1244.5], 0.07, { dur: 0.45, vol: 0.06 }); noise({ at: 0.3, dur: 0.5, vol: 0.03, freq: 5000, q: 4 }); },
  };

  function play(name) {
    if (muted || !SOUNDS[name]) return;
    const now = performance.now();
    const gap = name === 'hover' ? 70 : 35;          // don't stack identical sounds
    if (now - (last[name] || 0) < gap) return;
    last[name] = now;
    if (!ensure()) return;
    const spooky = document.body.dataset.season === 'halloween' && SPOOKY[name];
    try { (spooky || SOUNDS[name])(); } catch {}
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(LS_MUTE, m ? '1' : '0'); } catch {}
    document.getElementById('speaker-grille')?.classList.toggle('muted', m);
    if (!m) play('unmute');
  }

  // Generic UI sounds by delegation; specific events call sfx() themselves
  function wire() {
    const grille = document.getElementById('speaker-grille');
    if (grille) {
      grille.title = 'Sound on/off';
      grille.classList.toggle('muted', muted);
      grille.addEventListener('click', () => setMuted(!muted));
    }
    const fine = matchMedia('(hover: hover)').matches;
    let lastHover = null;
    document.addEventListener('mouseover', e => {
      if (!fine) return;
      const el = e.target.closest('button, .icc, .chat-action-btn, .react-pill, a, .tr-clickable, .hq-btn');
      if (!el || el === lastHover) return;
      lastHover = el;
      play('hover');
    });
    document.addEventListener('mouseout', e => { if (!e.relatedTarget || !lastHover?.contains(e.relatedTarget)) lastHover = null; });
    document.addEventListener('click', e => {
      if (e.target.closest('.mode-btn, #act-assemble, #act-smash, .act-toggle-btn')) return play('tab');
      if (e.target.closest('#speaker-grille, #tip-beetle, #chat-send, [id^="act-"], #do-smash, #do-assemble')) return; // have their own sounds
      if (e.target.closest('.panel-toggle-btn, .panel-close')) return play('panel');
      if (e.target.closest('button, .icc, .tr-clickable')) play('click');
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

  return { play, setMuted, isMuted: () => muted };
})();

const sfx = name => SFX.play(name);
