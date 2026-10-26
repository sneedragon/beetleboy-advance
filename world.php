<?php
// The world: one POST a second says where you are, what you are doing, and
// answers with everyone else, the shared ball, what the club screen plays
// and your coins. Names come from RemiliaNET (checked with your token).
// Positions live in a small JSON file in the temp folder; coins, what you
// bought and what you wear live in SQLite outside the web folder.

require __DIR__ . '/world_lib.php';

const W = 1800, H = 1200;          // the map in world units
const STALE = 20;                  // seconds without a word and you have left
// shared ball: it rolls inside the park and slows down on its own
const PEN = [120, 860, 600, 1100]; // x0, y0, x1, y1
const BALL_K = 1.4;
// coins
const DAILY = 25;                  // first visit of the day
const ACT_CAP = 60;                // one a minute while active, at most this many a day
const XP_PER_COIN = 200, XP_CAP = 150;
const BUG_CAP = 40;                // coins a day from catching beetles
const CAPSULE = 30;                // the capsule machine
const WISH = 1;                    // a coin into the well

// id => [slot, name, price]; price 0 = only from the capsule machine
const SHOP = [
    'antenna'   => ['hat',   'Antenna',        40],
    'bow'       => ['hat',   'Bow',            60],
    'headset'   => ['hat',   'Headphones',     80],
    'halo'      => ['hat',   'Halo',          120],
    'bear'      => ['hat',   'Bear hood',     200],
    'crown'     => ['hat',   'Crown',         300],
    'star'      => ['hat',   'Little star',     0],
    'feather'   => ['hat',   'Feather',         0],
    'wings'     => ['back',  'Wings',           0],
    'c_red'     => ['col',   'Red fur',        80],
    'c_void'    => ['col',   'Void fur',      100],
    'c_ghost'   => ['col',   'Pale fur',      100],
    'c_sky'     => ['col',   'Sky fur',         0],
    'c_glitch'  => ['col',   'Glitch fur',    400],
    'balloon'   => ['hold',  'Balloon',        50],
    'phone'     => ['hold',  'Flip phone',     40],
    'teddy'     => ['hold',  'Teddy',          90],
    'lantern'   => ['hold',  'Lantern',         0],
    't_static'  => ['trail', 'Static trail',  150],
    't_hearts'  => ['trail', 'Heart trail',   150],
    't_feathers'=> ['trail', 'Feather trail',   0],
];
const SLOTS = ['hat', 'back', 'col', 'hold', 'trail'];
const EMOTES = ['wave', 'heart', 'laugh', 'spark', 'sleep', 'dance', 'what'];

[$in, $token, $me] = start(600, 150);
$test  = str_contains(__DIR__, '/test');

function beetleXp(string $token, string $api): ?int {
    $r = $api === 'i' ? rn('/api/beetle/user', 'Cookie: authToken=' . $token) : rn('/api/v1/me/beetle', 'Authorization: Bearer ' . $token);
    $xp = $r['data']['xp'] ?? $r['xp'] ?? null;
    return is_numeric($xp) ? (int)$xp : null;
}

$U = $me['u'];

// ── coins and wardrobe ──
function loadUser(bool $test, string $u): array {
    $q = db($test)->prepare('SELECT * FROM users WHERE u = ?'); $q->execute([$u]);
    $r = $q->fetch(PDO::FETCH_ASSOC);
    if (!$r) {
        db($test)->prepare('INSERT INTO users (u, since) VALUES (?, ?)')->execute([$u, time()]);
        $q->execute([$u]); $r = $q->fetch(PDO::FETCH_ASSOC);
    }
    $r['owned'] = json_decode($r['owned'], true) ?: [];
    $r['bug_coins'] = (int)($r['bug_coins'] ?? 0);
    $r['wear']  = json_decode($r['wear'], true) ?: [];
    return $r;
}
function saveUser(bool $test, array $r): void {
    db($test)->prepare('UPDATE users SET coins=?, day=?, act_coins=?, xp_coins=?, xp=?, xp_rest=?, owned=?, wear=? WHERE u=?')
        ->execute([$r['coins'], $r['day'], $r['act_coins'], $r['xp_coins'], $r['xp'], $r['xp_rest'], json_encode(array_values($r['owned'])), json_encode((object)$r['wear']), $r['u']]);
    db($test)->prepare('UPDATE users SET bug_coins=? WHERE u=?')->execute([$r['bug_coins'], $r['u']]);
}

// the ball rolls from where it was kicked, slows down and bounces off the fence;
// every client works out the same path from these few numbers
function fold(float $p, float $a, float $b): float {
    $l = $b - $a; $q = fmod($p - $a, 2 * $l); if ($q < 0) $q += 2 * $l;
    return $a + ($q <= $l ? $q : 2 * $l - $q);
}

// beetles wander about; every browser works out the same ones from the clock.
// Keep in step with bugAt() in js/world.js.
const BUG_N = 7, BUG_LIFE = 90;
const BUG_AREAS = [[1180, 830, 1700, 1130], [1180, 830, 1700, 1130], [1180, 830, 1700, 1130], [140, 820, 620, 1120], [720, 480, 1080, 720], [60, 450, 660, 740], [1140, 450, 1740, 740]];
function hrand(float $n): float { $v = sin($n * 12.9898) * 43758.5453; return $v - floor($v); }
function bugAt(int $k, float $t): array {
    $g = (int)floor(($t + $k * 13) / BUG_LIFE);
    $s = $g * 31 + $k * 7;
    [$x0, $y0, $x1, $y1] = BUG_AREAS[$k];
    $r = hrand($s + 3);
    return ['id' => $k . ':' . $g, 'kind' => $r < 0.06 ? 2 : ($r < 0.3 ? 1 : 0),
        'x' => $x0 + hrand($s + 1) * ($x1 - $x0) + 36 * sin($t * (0.3 + hrand($s + 4) * 0.4) + $s),
        'y' => $y0 + hrand($s + 2) * ($y1 - $y0) + 24 * sin($t * (0.25 + hrand($s + 5) * 0.4) + $s * 2)];
}
function ballAt(array $b, float $t): array {
    $d = (1 - exp(-BALL_K * max(0, $t - $b['t']))) / BALL_K;
    return [fold($b['x'] + $b['vx'] * $d, PEN[0], PEN[2]), fold($b['y'] + $b['vy'] * $d, PEN[1], PEN[3])];
}

// ── read, update and write the world under a lock ──
$file = sys_get_temp_dir() . '/' . ($test ? 'bbworld_test.json' : 'bbworld_v1.json');
$fp = fopen($file, 'c+');
if (!$fp) fail(500, 'world unavailable');
flock($fp, LOCK_EX);
$world = json_decode(stream_get_contents($fp) ?: '{}', true);
if (!is_array($world)) $world = [];
$world += ['people' => [], 'ball' => ['x' => 360, 'y' => 980, 'vx' => 0, 'vy' => 0, 't' => 0], 'tv' => null, 'caught' => []];
foreach ($world['caught'] as $id => $t) if ($t < time() - BUG_LIFE * 2) unset($world['caught'][$id]);
$now = microtime(true); $sec = time(); $day = gmdate('Y-m-d');
foreach ($world['people'] as $u => $p) if (($p['t'] ?? 0) < $sec - STALE) unset($world['people'][$u]);

$out = ['me' => $U];
$prev = $world['people'][$U] ?? null;
$user = null;
$getUser = function () use (&$user, $test, $U) { return $user ??= loadUser($test, $U); };
$dirty = false;

if (!empty($in['leave'])) unset($world['people'][$U]);
else {
    $x = isset($in['x']) ? max(0, min(W, (int)$in['x'])) : ($prev['x'] ?? mt_rand(800, 1000));
    $y = isset($in['y']) ? max(0, min(H, (int)$in['y'])) : ($prev['y'] ?? mt_rand(560, 680));
    $p = ['d' => $me['d'], 'x' => $x, 'y' => $y, 't' => $sec,
          'e' => $prev['e'] ?? null, 'w' => $prev['w'] ?? null, 'c' => $prev['c'] ?? null,
          'act' => $prev['act'] ?? 0, 'xa' => $prev['xa'] ?? 0, 'xf' => $prev['xf'] ?? 0];

    // just arrived: coins and clothes from the database, and the daily bonus
    if (!$prev || $p['c'] === null || $p['w'] === null) {
        $getUser(); $r = &$user;
        if ($r['day'] !== $day) {
            $r['day'] = $day; $r['act_coins'] = 0; $r['xp_coins'] = 0; $r['bug_coins'] = 0;
            $r['coins'] += DAILY; $out['bonus'] = DAILY; $dirty = true;
        }
        $p['c'] = $r['coins']; $p['w'] = $r['wear'];
    }

    // a coin for each minute spent here while doing something (the tab tells us)
    if ($prev && !empty($in['a'])) {
        $p['act'] += min(5, $sec - ($prev['t'] ?? $sec));
        if ($p['act'] >= 60) {
            $p['act'] -= 60;
            $getUser(); $r = &$user;
            if ($r['day'] !== $day) { $r['day'] = $day; $r['act_coins'] = 0; $r['xp_coins'] = 0; $r['bug_coins'] = 0; }
            if ($r['act_coins'] < ACT_CAP) { $r['act_coins']++; $r['coins']++; $dirty = true; }
        }
    }

    // beetle game XP turns into coins, checked every five minutes (or after the lab)
    if ($sec - $p['xa'] > 300 || (!empty($in['xp']) && $sec - $p['xf'] > 30)) {
        if (!empty($in['xp'])) $p['xf'] = $sec;
        $p['xa'] = $sec;
        $xp = beetleXp($token, $me['api']);
        if ($xp !== null) {
            $getUser(); $r = &$user;
            if ($r['xp'] !== null && $xp > $r['xp']) {
                if ($r['day'] !== $day) { $r['day'] = $day; $r['act_coins'] = 0; $r['xp_coins'] = 0; $r['bug_coins'] = 0; }
                $gain = intdiv($xp - $r['xp'] + $r['xp_rest'], XP_PER_COIN);
                $r['xp_rest'] = ($xp - $r['xp'] + $r['xp_rest']) % XP_PER_COIN;
                $gain = max(0, min($gain, XP_CAP - $r['xp_coins']));
                if ($gain) { $r['coins'] += $gain; $r['xp_coins'] += $gain; $out['xpcoins'] = $gain; }
            }
            if ($r['xp'] !== $xp) { $r['xp'] = $xp; $dirty = true; }
        }
    }

    // shop: buy and wear
    if (isset($in['buy']) && isset(SHOP[$in['buy']]) && SHOP[$in['buy']][2] > 0) {
        $getUser(); $r = &$user; $id = $in['buy'];
        if (in_array($id, $r['owned'], true)) $out['shop'] = 'owned';
        elseif ($r['coins'] < SHOP[$id][2]) $out['shop'] = 'poor';
        else {
            $r['coins'] -= SHOP[$id][2]; $r['owned'][] = $id;
            $r['wear'][SHOP[$id][0]] = $id; $dirty = true; $out['shop'] = 'bought';
        }
    }
    if (isset($in['wear']) && is_array($in['wear'])) {
        $getUser(); $r = &$user;
        foreach (SLOTS as $slot) {
            if (!array_key_exists($slot, $in['wear'])) continue;
            $id = $in['wear'][$slot];
            if ($id === null || $id === '') unset($r['wear'][$slot]);
            elseif (is_string($id) && in_array($id, $r['owned'], true) && SHOP[$id][0] === $slot) $r['wear'][$slot] = $id;
        }
        $dirty = true;
    }
    if (!empty($in['shopinfo'])) {
        $getUser(); $r = &$user;
        $out['catalog'] = array_map(fn($id, $s) => ['id' => $id, 'slot' => $s[0], 'name' => $s[1], 'price' => $s[2]], array_keys(SHOP), SHOP);
        $out['capsule_price'] = CAPSULE;
        $out['owned'] = $r['owned'];
    }
    // the capsule machine: something you do not have yet, at random
    if (!empty($in['capsule'])) {
        $getUser(); $r = &$user;
        $left = array_values(array_filter(array_keys(SHOP), fn($id) => SHOP[$id][2] === 0 && !in_array($id, $r['owned'], true)));
        if (!$left) $out['capsule'] = 'all';
        elseif ($r['coins'] < CAPSULE) $out['capsule'] = 'poor';
        else {
            $id = $left[mt_rand(0, count($left) - 1)];
            $r['coins'] -= CAPSULE; $r['owned'][] = $id; $r['wear'][SHOP[$id][0]] = $id;
            $dirty = true; $out['capsule'] = $id; $out['capsule_name'] = SHOP[$id][1];
        }
    }
    // a coin into the well, at most one every few seconds
    if (!empty($in['wish'])) {
        $getUser(); $r = &$user;
        if ($sec - ($prev['wish'] ?? 0) < 4) $out['wish'] = 'wait';
        elseif ($r['coins'] < WISH) $out['wish'] = 'poor';
        else { $r['coins'] -= WISH; $dirty = true; $out['wish'] = 'ok'; $p['wish'] = $sec; }
    }
    if (isset($prev['wish']) && !isset($p['wish'])) $p['wish'] = $prev['wish'];
    // catching a beetle: it has to be there, close to you, and nobody got it first
    if (isset($in['catch']) && is_string($in['catch']) && preg_match('/^(\d):(\d+)$/', $in['catch'], $m) && (int)$m[1] < BUG_N) {
        $b = bugAt((int)$m[1], $now);
        if ($b['id'] !== $in['catch'] || isset($world['caught'][$b['id']])) $out['caught'] = 'gone';
        elseif (hypot($b['x'] - $x, $b['y'] - $y) > 80) $out['caught'] = 'far';
        else {
            $world['caught'][$b['id']] = $sec;
            $getUser(); $r = &$user;
            if ($r['day'] !== $day) { $r['day'] = $day; $r['act_coins'] = 0; $r['xp_coins'] = 0; $r['bug_coins'] = 0; }
            $gain = min([1, 2, 5][$b['kind']], BUG_CAP - $r['bug_coins']);
            if ($gain > 0) { $r['coins'] += $gain; $r['bug_coins'] += $gain; $dirty = true; }
            $out['caught'] = $b['id']; $out['bug_coins'] = max(0, $gain);
        }
    }
    if ($user) { $p['c'] = $user['coins']; $p['w'] = $user['wear']; }

    if (isset($in['emote']) && in_array($in['emote'], EMOTES, true)) $p['e'] = [$in['emote'], $now];

    // kicking the ball: only from close by, and not harder than a good kick
    if (isset($in['kick']) && is_array($in['kick'])) {
        [$bx, $by] = ballAt($world['ball'], $now);
        $vx = (float)($in['kick']['vx'] ?? 0); $vy = (float)($in['kick']['vy'] ?? 0);
        $v = hypot($vx, $vy);
        if ($v > 900) { $vx *= 900 / $v; $vy *= 900 / $v; }
        if (hypot($bx - $x, $by - $y) < 110 && $v > 0) $world['ball'] = ['x' => $bx, 'y' => $by, 'vx' => $vx, 'vy' => $vy, 't' => $now, 'by' => $U];
    }

    // the club screen: anyone standing in the club may put on a YouTube video
    if (isset($in['tv']) && is_string($in['tv'])) {
        $inClub = $x >= 60 && $x <= 660 && $y >= 40 && $y <= 420;
        $last = $world['tvset'][$U] ?? 0;
        if (!$inClub) $out['tv_err'] = 'Stand in the club to change the screen.';
        elseif ($sec - $last < 20) $out['tv_err'] = 'Wait a few seconds before changing it again.';
        elseif ($in['tv'] === '') { $world['tv'] = null; $world['tvset'][$U] = $sec; }
        elseif (preg_match('~(?:youtu\.be/|[?&]v=|/shorts/|/embed/|/live/)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$~', $in['tv'], $m)) {
            $world['tv'] = ['v' => $m[1] ?: $m[2], 's' => $now, 'by' => $me['d']];
            $world['tvset'][$U] = $sec;
        } else $out['tv_err'] = 'That does not look like a YouTube link.';
    }
    $world['people'][$U] = $p;
}
if (count($world['people']) > 80) { uasort($world['people'], fn($a, $b) => $b['t'] <=> $a['t']); $world['people'] = array_slice($world['people'], 0, 80, true); }
foreach ($world['tvset'] ?? [] as $u => $t) if ($t < $sec - 60) unset($world['tvset'][$u]);

ftruncate($fp, 0); rewind($fp);
fwrite($fp, json_encode($world));
fflush($fp); flock($fp, LOCK_UN); fclose($fp);

if ($dirty && $user) saveUser($test, $user);

$out['now'] = $now;
$out['people'] = [];
foreach ($world['people'] as $u => $p) {
    $o = ['u' => (string)$u, 'd' => $p['d'], 'x' => $p['x'], 'y' => $p['y']];
    if ($p['w']) $o['w'] = (object)$p['w'];
    if ($p['e'] && $p['e'][1] > $now - 4) $o['e'] = [$p['e'][0], round($now - $p['e'][1], 2)];
    $out['people'][] = $o;
}
$out['gone'] = array_keys($world['caught']);
// the newest direct message for me, so the page knows when to fetch them
try { $q = db($test)->prepare('SELECT MAX(id) FROM dm WHERE b = ?'); $q->execute([$U]); $out['dm'] = (int)$q->fetchColumn(); } catch (Throwable $e) {}
$out['coins'] = $world['people'][$U]['c'] ?? ($user['coins'] ?? 0);
$out['wear'] = (object)($world['people'][$U]['w'] ?? []);
$b = $world['ball'];
$out['ball'] = ['x' => $b['x'], 'y' => $b['y'], 'vx' => $b['vx'], 'vy' => $b['vy'], 'age' => round(min($now - $b['t'], 86400), 3)];
if ($world['tv']) $out['tv'] = ['v' => $world['tv']['v'], 'age' => round($now - $world['tv']['s'], 2), 'by' => $world['tv']['by']];
echo json_encode($out);
