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
const FIREWORK = 2;                // a rocket over the plaza
const GIFT_CAP = 200;              // coins you can give away a day
const POND = [460, 610];           // the pond on the plaza, as in js/world.js

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
const TOUCH = ['hug', 'high5'];    // things you do to someone standing next to you
// the pond: id => [name, chance]
const FISH = [
    'minnow' => ['Cloud minnow', 30], 'koi' => ['Koi', 18], 'puffer' => ['Puffer', 12], 'jelly' => ['Sky jelly', 10],
    'eel' => ['Wire eel', 8], 'angel' => ['Angelfish', 6], 'boot' => ['Old boot', 10], 'disk' => ['Floppy disk', 4], 'golden' => ['Golden carp', 2],
];
function pickFish(): string {
    $n = mt_rand(1, array_sum(array_column(FISH, 1)));
    foreach (FISH as $id => [, $w]) { $n -= $w; if ($n <= 0) return $id; }
    return 'minnow';
}

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
    $r['inv']   = (json_decode($r['inv'] ?? '{}', true) ?: []) + ['bugs' => [0, 0, 0], 'fish' => [], 'gday' => '', 'gsent' => 0];
    return $r;
}
function saveUser(bool $test, array $r): void {
    db($test)->prepare('UPDATE users SET coins=?, day=?, act_coins=?, xp_coins=?, xp=?, xp_rest=?, owned=?, wear=? WHERE u=?')
        ->execute([$r['coins'], $r['day'], $r['act_coins'], $r['xp_coins'], $r['xp'], $r['xp_rest'], json_encode(array_values($r['owned'])), json_encode((object)$r['wear']), $r['u']]);
    db($test)->prepare('UPDATE users SET bug_coins=?, inv=? WHERE u=?')->execute([$r['bug_coins'], json_encode($r['inv']), $r['u']]);
}

// the ball rolls from where it was kicked, slows down and bounces off the fence;
// every client works out the same path from these few numbers
function fold(float $p, float $a, float $b): float {
    $l = $b - $a; $q = fmod($p - $a, 2 * $l); if ($q < 0) $q += 2 * $l;
    return $a + ($q <= $l ? $q : 2 * $l - $q);
}

// beetles wander about; every browser works out the same ones from the clock.
// Keep in step with bugAt() in js/world.js.
const BUG_N = 4, BUG_LIFE = 90;
const BUG_AREAS = [[1180, 830, 1700, 1130], [1180, 830, 1700, 1130], [140, 820, 620, 1120], [720, 480, 1080, 720]];
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
$world += ['people' => [], 'ball' => ['x' => 360, 'y' => 980, 'vx' => 0, 'vy' => 0, 't' => 0], 'tv' => null, 'tvq' => [], 'caught' => [], 'fx' => [], 'toss' => []];
foreach ($world['caught'] as $id => $t) if ($t < time() - BUG_LIFE * 2) unset($world['caught'][$id]);
$now = microtime(true); $sec = time(); $day = gmdate('Y-m-d');
foreach ($world['people'] as $u => $p) if (($p['t'] ?? 0) < $sec - STALE) unset($world['people'][$u]);
$world['fx'] = array_values(array_filter($world['fx'], fn($f) => $f[2] > $now - 6));
$world['toss'] = array_values(array_filter($world['toss'], fn($f) => $f[4] > $now - 4));
// the screen moves on to the next video once this one has run out
function tvNext(array &$world, float $now): void {
    $n = array_shift($world['tvq']);
    $world['tv'] = $n ? ['v' => $n['v'], 's' => $now, 'by' => $n['by']] : null;
}
if ($world['tv'] && $now - $world['tv']['s'] > (isset($world['tv']['d']) ? $world['tv']['d'] + 2 : 7200)) tvNext($world, $now);

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
          'act' => $prev['act'] ?? 0, 'xa' => $prev['xa'] ?? 0, 'xf' => $prev['xf'] ?? 0,
          'in' => array_values(array_filter($prev['in'] ?? [], fn($i) => $i[2] > $now - 10))];
    foreach (['wish', 'fish', 'fw', 'tz', 'gift', 'touch'] as $k) if (isset($prev[$k])) $p[$k] = $prev[$k];

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
            if ($gain > 0) { $r['coins'] += $gain; $r['bug_coins'] += $gain; }
            $r['inv']['bugs'][$b['kind']]++; $dirty = true;
            $out['caught'] = $b['id']; $out['bug_coins'] = max(0, $gain);
        }
    }
    // the pond: a cast takes a few seconds, then something bites (or not)
    if (!empty($in['fish'])) {
        if (hypot($x - POND[0], $y - POND[1]) > 140) $out['fish'] = 'far';
        elseif ($sec - ($p['fish'] ?? 0) < 5) $out['fish'] = 'wait';
        else {
            $p['fish'] = $sec;
            if (mt_rand(1, 100) <= 25) $out['fish'] = 'none';
            else {
                $getUser(); $r = &$user; $id = pickFish();
                $r['inv']['fish'][$id] = ($r['inv']['fish'][$id] ?? 0) + 1; $dirty = true;
                $out['fish'] = $id; $out['fish_name'] = FISH[$id][0];
            }
        }
    }
    // a firework over the plaza: everyone sees it go up
    if (isset($in['fw']) && is_array($in['fw'])) {
        $getUser(); $r = &$user;
        if ($sec - ($p['fw'] ?? 0) < 3) $out['fw'] = 'wait';
        elseif ($r['coins'] < FIREWORK) $out['fw'] = 'poor';
        else {
            $r['coins'] -= FIREWORK; $dirty = true; $p['fw'] = $sec; $out['fw'] = 'ok';
            $world['fx'][] = [max(0, min(W, (int)($in['fw']['x'] ?? $x))), max(0, min(H, (int)($in['fw']['y'] ?? $y))), $now, mt_rand(0, 359), $U];
            $world['fx'] = array_slice($world['fx'], -12);
        }
    }
    // a cloudball thrown from where you stand
    if (isset($in['toss']) && is_array($in['toss']) && $now - ($p['tz'] ?? 0) > 0.8) {
        $tx = (int)($in['toss']['x'] ?? 0); $ty = (int)($in['toss']['y'] ?? 0);
        $d = hypot($tx - $x, $ty - $y);
        if ($d > 0) { $k = min(1, 420 / $d); $tx = (int)($x + ($tx - $x) * $k); $ty = (int)($y + ($ty - $y) * $k); }
        $world['toss'][] = [$x, $y - 20, $tx, $ty, $now, $U];
        $world['toss'] = array_slice($world['toss'], -20);
        $p['tz'] = $now;
    }
    // a hug or a high five: you have to stand next to them
    if (isset($in['touch']) && is_array($in['touch']) && in_array($in['touch']['k'] ?? '', TOUCH, true)) {
        $to = (string)($in['touch']['to'] ?? ''); $o = $world['people'][$to] ?? null;
        if (!$o || $to === $U) $out['touch'] = 'gone';
        elseif (hypot($o['x'] - $x, $o['y'] - $y) > 90) $out['touch'] = 'far';
        elseif ($now - ($p['touch'] ?? 0) < 2) $out['touch'] = 'wait';
        else {
            $k = $in['touch']['k']; $p['touch'] = $now; $p['e'] = [$k, $now]; $out['touch'] = 'ok';
            $world['people'][$to]['e'] = [$k, $now];
            $world['people'][$to]['in'][] = [$k, $me['d'], $now, $U];
        }
    }
    // giving coins to someone who is here
    if (isset($in['gift']) && is_array($in['gift'])) {
        $to = (string)($in['gift']['to'] ?? ''); $n = (int)($in['gift']['n'] ?? 0);
        $getUser(); $r = &$user;
        if ($r['inv']['gday'] !== $day) { $r['inv']['gday'] = $day; $r['inv']['gsent'] = 0; }
        if (!isset($world['people'][$to]) || $to === $U) $out['gift'] = 'gone';
        elseif ($n < 1 || $n > 100) $out['gift'] = 'bad';
        elseif ($sec - ($p['gift'] ?? 0) < 4) $out['gift'] = 'wait';
        elseif ($r['coins'] < $n) $out['gift'] = 'poor';
        elseif ($r['inv']['gsent'] + $n > GIFT_CAP) $out['gift'] = 'cap';
        else {
            $r['coins'] -= $n; $r['inv']['gsent'] += $n; $dirty = true; $p['gift'] = $sec;
            loadUser($test, $to);       // makes sure they have a row
            db($test)->prepare('UPDATE users SET coins = coins + ? WHERE u = ?')->execute([$n, $to]);
            if (isset($world['people'][$to]['c'])) $world['people'][$to]['c'] += $n;
            $world['people'][$to]['in'][] = ['gift', $me['d'], $now, $U, $n];
            $world['people'][$to]['e'] = ['gift', $now]; $p['e'] = ['gift', $now];
            $out['gift'] = 'ok';
        }
    }
    // someone's card: what they have in here
    if (isset($in['prof']) && is_string($in['prof']) && preg_match('/^[A-Za-z0-9_.-]{1,40}$/', $in['prof'])) {
        $q = db($test)->prepare('SELECT * FROM users WHERE u = ?'); $q->execute([$in['prof']]);
        $o = $q->fetch(PDO::FETCH_ASSOC);
        if ($o) {
            $inv = json_decode($o['inv'] ?? '{}', true) ?: [];
            $out['prof'] = ['u' => $in['prof'], 'coins' => (int)$o['coins'], 'items' => count(json_decode($o['owned'], true) ?: []),
                'wear' => (object)(json_decode($o['wear'], true) ?: []), 'bugs' => array_sum($inv['bugs'] ?? []),
                'fish' => array_sum($inv['fish'] ?? []), 'since' => (int)$o['since'], 'here' => isset($world['people'][$in['prof']])];
        } else $out['prof'] = ['u' => $in['prof'], 'none' => true, 'here' => false];
    }
    // your bag
    if (!empty($in['inv'])) {
        $getUser(); $r = &$user;
        $out['inv'] = ['owned' => $r['owned'], 'bugs' => $r['inv']['bugs'], 'fish' => (object)$r['inv']['fish'],
            'fishnames' => array_map(fn($f) => $f[0], FISH)];
    }
    if ($user) { $p['c'] = $user['coins']; $p['w'] = $user['wear']; }

    if (isset($in['emote']) && in_array($in['emote'], EMOTES, true)) $p['e'] = [$in['emote'], $now];
    $mine = array_filter($p['in'], fn($i) => $i[2] > $now - 8);
    if ($mine) $out['in'] = array_values(array_map(fn($i) => [$i[0], $i[1], round($now - $i[2], 2), $i[4] ?? 0], $mine));

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
        elseif ($in['tv'] === '') { $world['tv'] = null; $world['tvq'] = []; $world['tvset'][$U] = $sec; }
        elseif (preg_match('~(?:youtu\.be/|[?&]v=|/shorts/|/embed/|/live/)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$~', $in['tv'], $m)) {
            $v = $m[1] ?: $m[2];
            // something is on already: the new one waits its turn
            if (!$world['tv']) $world['tv'] = ['v' => $v, 's' => $now, 'by' => $me['d']];
            elseif (count($world['tvq']) >= 20) $out['tv_err'] = 'The queue is full.';
            elseif (count(array_filter($world['tvq'], fn($q) => $q['u'] === $U)) >= 3) $out['tv_err'] = 'You have three videos waiting already.';
            else { $world['tvq'][] = ['v' => $v, 'by' => $me['d'], 'u' => $U]; $out['tv_queued'] = count($world['tvq']); }
            $world['tvset'][$U] = $sec - 15;
        } else $out['tv_err'] = 'That does not look like a YouTube link.';
    }
    if (!empty($in['tvskip']) && $world['tv']) {
        $inClub = $x >= 60 && $x <= 660 && $y >= 40 && $y <= 420;
        if (!$inClub) $out['tv_err'] = 'Stand in the club to skip.';
        elseif ($sec - ($world['tvset'][$U] ?? 0) < 10) $out['tv_err'] = 'Wait a few seconds before skipping again.';
        else { tvNext($world, $now); $world['tvset'][$U] = $sec; }
    }
    // the player tells us how long the video is, so the next one starts on time
    if (isset($in['tvdur']) && is_array($in['tvdur']) && $world['tv'] && ($in['tvdur']['v'] ?? '') === $world['tv']['v'] && !isset($world['tv']['d'])) {
        $d = (float)($in['tvdur']['d'] ?? 0);
        if ($d > 1 && $d < 36000) $world['tv']['d'] = $d;
    }
    $world['people'][$U] = $p;
}
if (count($world['people']) > 80) { uasort($world['people'], fn($a, $b) => $b['t'] <=> $a['t']); $world['people'] = array_slice($world['people'], 0, 80, true); }
foreach ($world['tvset'] ?? [] as $u => $t) if ($t < $sec - 60) unset($world['tvset'][$u]);

// saved while the world is still locked, so a gift and the receiver's own visit never cross
if ($dirty && $user) saveUser($test, $user);
ftruncate($fp, 0); rewind($fp);
fwrite($fp, json_encode($world));
fflush($fp); flock($fp, LOCK_UN); fclose($fp);

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
if ($world['tvq']) $out['tvq'] = array_map(fn($q) => ['v' => $q['v'], 'by' => $q['by']], $world['tvq']);
if ($world['fx']) $out['fx'] = array_map(fn($f) => [$f[0], $f[1], round($now - $f[2], 2), $f[3]], $world['fx']);
if ($world['toss']) $out['toss'] = array_map(fn($f) => [$f[0], $f[1], $f[2], $f[3], round($now - $f[4], 2), $f[5]], $world['toss']);
echo json_encode($out);
