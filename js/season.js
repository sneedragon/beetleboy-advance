// BeetleBoy SP · Seasonal looks (Halloween). Switches itself on and off by date.
// Classic script sharing globals with the others; load order is set in index.html.

// ── SEASONS ───────────────────────────────────────────────────────────────────
// Halloween runs from Oct 24 until the morning of Nov 1 (local time).
// Preview with ?halloween in the address (only while it's there).
const LS_SEASON_PREV = 'bb_theme_before_season';   // colorway to go back to afterwards
const LS_SEASON_SEEN = 'bb_season_seen';           // season we already auto-switched for

function currentSeason() {
  // preview only while the address says so; nothing sticks afterwards
  const q = new URLSearchParams(location.search);
  if (q.has('halloween')) return 'halloween';
  if (q.has('nohalloween')) return null;
  const d = new Date(), m = d.getMonth(), day = d.getDate();
  if ((m === 9 && day >= 24) || (m === 10 && day === 1 && d.getHours() < 6)) return 'halloween';
  return null;
}

const SEASON = currentSeason();
const isHalloween = () => SEASON === 'halloween';

const HALLOWEEN_TIPS = [
  'Trick or treat! Give me cheese.',
  'Boo. Did I scare you? No? Fine.',
  'I dressed up as a Death Feigning Beetle. Very convincing, I know.',
  'The cheese man is wearing a sheet this year. Spooky.',
  "Don't smash beetles after midnight. Trust me.",
  'Something is crawling in the junk pile. Oh wait, that\'s me.',
  'Candycane Tiger Moths are for Christmas. Halloween is Bombardier season.',
  'I carved a pumpkin. It looks like Sneed.',
  'Happy Halloween. The beetles are restless tonight.',
  'Every pinned specimen is a ghost now. That\'s just science.',
  'Spooky scary beetles send shivers down your spine.',
  'Your hammer broke? Must be a curse.',
];

// Called once on startup, before the colorway is applied
function initSeason() {
  const halloweenTheme = THEMES.find(t => t.id === 'halloween');
  let theme = null;
  try { theme = localStorage.getItem(LS_THEME); } catch {}
  if (!isHalloween()) {
    // season over: give back the colorway people had before
    if (theme === 'halloween') {
      let prev = null;
      try { prev = localStorage.getItem(LS_SEASON_PREV); localStorage.setItem(LS_THEME, prev || 'flame'); } catch {}
    }
    return;
  }
  document.body.dataset.season = 'halloween';
  const preview = new URLSearchParams(location.search).has('halloween');
  const key = 'halloween-' + new Date().getFullYear() + (preview ? '-preview' : '');
  let seen = null;
  try { seen = localStorage.getItem(LS_SEASON_SEEN); } catch {}
  if (halloweenTheme && seen !== key) {           // switch once per season; people can switch back
    try {
      if (theme !== 'halloween') localStorage.setItem(LS_SEASON_PREV, theme || 'flame');
      localStorage.setItem(LS_THEME, 'halloween');
      localStorage.setItem(LS_SEASON_SEEN, key);
    } catch {}
  }
  startBats();
  setTimeout(() => log('🎃 Happy Halloween! The beetles are restless tonight.'), 1200);
}

// A few bats flapping across the screen now and then
function startBats() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.id = 'bats';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const bats = [];
  const fit = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; };
  fit(); addEventListener('resize', fit);
  const spawn = () => {
    const ltr = Math.random() < 0.5, s = (0.6 + Math.random() * 0.8) * devicePixelRatio;
    bats.push({ x: ltr ? -40 : cv.width + 40, y: cv.height * (0.08 + Math.random() * 0.5), vx: (ltr ? 1 : -1) * (1.2 + Math.random() * 1.6) * devicePixelRatio,
      vy: (Math.random() - 0.5) * 0.4, s, t: Math.random() * 6, wob: 0.5 + Math.random() });
  };
  const drawBat = b => {
    const flap = Math.sin(b.t * 9) * 0.9;           // wing angle
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.s * (b.vx < 0 ? -1 : 1), b.s);
    ctx.fillStyle = 'rgba(12,6,16,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2);      // body
    for (const side of [-1, 1]) {                   // wings
      ctx.moveTo(0, -1);
      ctx.quadraticCurveTo(side * 9, -9 * flap - 3, side * 18, -4 * flap);
      ctx.quadraticCurveTo(side * 13, 1, side * 10, 3);
      ctx.quadraticCurveTo(side * 6, 1, 0, 3);
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,140,30,0.9)';          // eyes
    ctx.fillRect(-2, -3, 1.2, 1.2); ctx.fillRect(1, -3, 1.2, 1.2);
    ctx.restore();
  };
  let next = performance.now() + 2500;
  const frame = now => {
    if (!document.hidden && now > next) {
      const n = Math.random() < 0.3 ? 3 : 1;
      for (let i = 0; i < n; i++) setTimeout(spawn, i * 350);
      next = now + 9000 + Math.random() * 16000;
    }
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let i = bats.length - 1; i >= 0; i--) {
      const b = bats[i];
      b.t += 0.016; b.x += b.vx; b.y += b.vy + Math.sin(b.t * b.wob * 3) * 0.6;
      drawBat(b);
      if (b.x < -60 || b.x > cv.width + 60) bats.splice(i, 1);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
