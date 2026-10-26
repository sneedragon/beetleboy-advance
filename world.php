<?php
// The world: one POST a second says where you are, what you are doing, and
// answers with everyone else, the shared ball, what the club screen plays
// and your coins. Names come from RemiliaNET (checked with your token).
// Positions live in a small JSON file in the temp folder; coins, what you
// bought and what you wear live in SQLite outside the web folder.

header('Content-Type: application/json');
header('Cache-Control: no-store');

const RN_HOST = 'www.remilia.net';
const W = 1800, H = 1200;          // the map in world units
const STALE = 20;                  // seconds without a word and you have left
// shared ball: it rolls inside the yard and slows down on its own
const PEN = [120, 860, 600, 1100]; // x0, y0, x1, y1
const BALL_K = 1.4;
// coins
const DAILY = 25;                  // first visit of the day
const ACT_CAP = 60;                // one a minute while active, at most this many a day
const XP_PER_COIN = 200, XP_CAP = 150;

const SHOP = [
    'antenna'   => ['hat',   'Antenna',        40],
    'bow'       => ['hat',   'Bow',            60],
    'headset'   => ['hat',   'Headphones',     80],
    'halo'      => ['hat',   'Halo',          120],
    'bear'      => ['hat',   'Bear hood',     200],
    'crown'     => ['hat',   'Crown',         300],
    'c_red'     => ['col',   'Red fur',        80],
    'c_void'    => ['col',   'Void fur',      100],
    'c_ghost'   => ['col',   'Pale fur',      100],
    'c_glitch'  => ['col',   'Glitch fur',    400],
    'balloon'   => ['hold',  'Balloon',        50],
    'phone'     => ['hold',  'Flip phone',     40],
    'teddy'     => ['hold',  'Teddy',          90],
    't_static'  => ['trail', 'Static trail',  150],
    't_hearts'  => ['trail', 'Heart trail',   150],
];
const EMOTES = ['wave', 'heart', 'laugh', 'spark', 'sleep', 'dance', 'what'];

function fail(int $code, string $msg): void { http_response_code($code); echo json_encode(['error' => $msg]); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only');

$in    = json_decode(file_get_contents('php://input', false, null, 0, 20000), true) ?? [];
$token = (string)($in['token'] ?? '');
$test  = str_contains(__DIR__, '/test');

function limit(string $key, int $max): void {
    $rk = sys_get_temp_dir() . '/bbworldrl_' . md5($key) . '_' . floor(time() / 60);
    $n  = (int)@file_get_contents($rk);
    if ($n >= $max) fail(429, 'slow down');
    @file_put_contents($rk, $n + 1);
}
limit('ip' . ($_SERVER['REMOTE_ADDR'] ?? 'x'), 600);
limit('tk' . $token, 150);
if (mt_rand(0, 199) === 0) foreach (glob(sys_get_temp_dir() . '/bbworldrl_*') ?: [] as $f) if (filemtime($f) < time() - 180) @unlink($f);

if ($token === '' || strlen($token) > 16000 || preg_match('/[\x00-\x20;]/', $token)) fail(400, 'missing token');

function rn(string $path, string $auth): ?array {
    $ch = curl_init('https://' . RN_HOST . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_USERAGENT => 'BeetleBoySP-world/1', CURLOPT_HTTPHEADER => [$auth, 'Accept: application/json']]);
    $r = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return $code === 200 ? json_decode((string)$r, true) : null;
}

// ── who is this? (asked once, then remembered for 10 minutes) ──
function whoami(string $token): ?array {
    $ck = sys_get_temp_dir() . '/bbworldid_' . hash('sha256', $token);
    if (is_file($ck) && filemtime($ck) > time() - 600) {
        $c = json_decode((string)@file_get_contents($ck), true);
        if (is_array($c)) return $c;
    }
    // a password login works on the internal API, "Sign in with remilia.net" only on /api/v1
    $w = rn('/api/profile/whoami', 'Cookie: authToken=' . $token);
    $handle = (string)($w['userHandle'] ?? ''); $name = (string)($w['displayName'] ?? ''); $api = 'i';
    if ($handle === '') {
        $v = rn('/api/v1/me', 'Authorization: Bearer ' . $token);
        $u = $v['user'] ?? $v['data']['user'] ?? [];
        $handle = (string)($u['username'] ?? ''); $name = (string)($u['displayName'] ?? ''); $api = 'v';
    }
    if (!preg_match('/^[A-Za-z0-9_.-]{1,40}$/', $handle)) return null;
    $me = ['u' => $handle, 'd' => mb_substr($name !== '' ? $name : $handle, 0, 40), 'api' => $api];
    @file_put_contents($ck, json_encode($me));
    if (mt_rand(0, 49) === 0) foreach (glob(sys_get_temp_dir() . '/bbworldid_*') ?: [] as $f) if (filemtime($f) < time() - 900) @unlink($f);
    return $me;
}
function beetleXp(string $token, string $api): ?int {
    $r = $api === 'i' ? rn('/api/beetle/user', 'Cookie: authToken=' . $token) : rn('/api/v1/me/beetle', 'Authorization: Bearer ' . $token);
    $xp = $r['data']['xp'] ?? $r['xp'] ?? null;
    return is_numeric($xp) ? (int)$xp : null;
}

$me = whoami($token);
if (!$me) fail(401, 'login expired');
$U = $me['u'];

// ── coins and wardrobe ──
function db(bool $test): PDO {
    static $db;
    if ($db) return $db;
    $dir = dirname(__DIR__, $test ? 3 : 2) . '/beetleboy-private';
    if (!is_dir($dir)) $dir = sys_get_temp_dir();
    $db = new PDO('sqlite:' . $dir . ($test ? '/world_test.sqlite' : '/world.sqlite'));
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA busy_timeout = 3000');
    $db->exec('CREATE TABLE IF NOT EXISTS users (u TEXT PRIMARY KEY, coins INT NOT NULL DEFAULT 0, day TEXT NOT NULL DEFAULT "",
        act_coins INT NOT NULL DEFAULT 0, xp_coins INT NOT NULL DEFAULT 0, xp INT, xp_rest INT NOT NULL DEFAULT 0,
        owned TEXT NOT NULL DEFAULT "[]", wear TEXT NOT NULL DEFAULT "{}", since INT NOT NULL DEFAULT 0)');
    return $db;
}
function loadUser(bool $test, string $u): array {
    $q = db($test)->prepare('SELECT * FROM users WHERE u = ?'); $q->execute([$u]);
    $r = $q->fetch(PDO::FETCH_ASSOC);
    if (!$r) {
        db($test)->prepare('INSERT INTO users (u, since) VALUES (?, ?)')->execute([$u, time()]);
        $q->execute([$u]); $r = $q->fetch(PDO::FETCH_ASSOC);
    }
    $r['owned'] = json_decode($r['owned'], true) ?: [];
    $r['wear']  = json_decode($r['wear'], true) ?: [];
    return $r;
}
function saveUser(bool $test, array $r): void {
    db($test)->prepare('UPDATE users SET coins=?, day=?, act_coins=?, xp_coins=?, xp=?, xp_rest=?, owned=?, wear=? WHERE u=?')
        ->execute([$r['coins'], $r['day'], $r['act_coins'], $r['xp_coins'], $r['xp'], $r['xp_rest'], json_encode(array_values($r['owned'])), json_encode((object)$r['wear']), $r['u']]);
}

// the ball rolls from where it was kicked, slows down and bounces off the fence;
// every client works out the same path from these few numbers
function fold(float $p, float $a, float $b): float {
    $l = $b - $a; $q = fmod($p - $a, 2 * $l); if ($q < 0) $q += 2 * $l;
    return $a + ($q <= $l ? $q : 2 * $l - $q);
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
$world += ['people' => [], 'ball' => ['x' => 360, 'y' => 980, 'vx' => 0, 'vy' => 0, 't' => 0], 'tv' => null];
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
            $r['day'] = $day; $r['act_coins'] = 0; $r['xp_coins'] = 0;
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
            if ($r['day'] !== $day) { $r['day'] = $day; $r['act_coins'] = 0; $r['xp_coins'] = 0; }
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
                if ($r['day'] !== $day) { $r['day'] = $day; $r['act_coins'] = 0; $r['xp_coins'] = 0; }
                $gain = intdiv($xp - $r['xp'] + $r['xp_rest'], XP_PER_COIN);
                $r['xp_rest'] = ($xp - $r['xp'] + $r['xp_rest']) % XP_PER_COIN;
                $gain = max(0, min($gain, XP_CAP - $r['xp_coins']));
                if ($gain) { $r['coins'] += $gain; $r['xp_coins'] += $gain; $out['xpcoins'] = $gain; }
            }
            if ($r['xp'] !== $xp) { $r['xp'] = $xp; $dirty = true; }
        }
    }

    // shop: buy and wear
    if (isset($in['buy']) && isset(SHOP[$in['buy']])) {
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
        foreach (['hat', 'col', 'hold', 'trail'] as $slot) {
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
        $out['owned'] = $r['owned'];
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
$out['coins'] = $world['people'][$U]['c'] ?? ($user['coins'] ?? 0);
$out['wear'] = (object)($world['people'][$U]['w'] ?? []);
$b = $world['ball'];
$out['ball'] = ['x' => $b['x'], 'y' => $b['y'], 'vx' => $b['vx'], 'vy' => $b['vy'], 'age' => round(min($now - $b['t'], 86400), 3)];
if ($world['tv']) $out['tv'] = ['v' => $world['tv']['v'], 'age' => round($now - $world['tv']['s'], 2), 'by' => $world['tv']['by']];
echo json_encode($out);
