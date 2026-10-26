<?php
// The chat room: who is standing where. One POST does it all: it says where
// you want to go and answers with everyone who is in the room right now.
// Names come from RemiliaNET (checked with your token), never from the client.
// Positions live in a small file in the temp folder and fade out on their own.

header('Content-Type: application/json');
header('Cache-Control: no-store');

const RN_HOST  = 'www.remilia.net';
const W = 640, H = 320;            // the room in world units (the client scales it)
const STALE = 20;                  // seconds without a word and you have left
const ROOM  = 'bbroom_v1.json';

function fail(int $code, string $msg): void { http_response_code($code); echo json_encode(['error' => $msg]); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only');

$in    = json_decode(file_get_contents('php://input', false, null, 0, 20000), true) ?? [];
$token = (string)($in['token'] ?? '');

// two a second per login is more than the client sends; an address may carry
// several logins (a household, two tabs), so it gets more room
function limit(string $key, int $max): void {
    $rk = sys_get_temp_dir() . '/bbroomrl_' . md5($key) . '_' . floor(time() / 60);
    $n  = (int)@file_get_contents($rk);
    if ($n >= $max) fail(429, 'slow down');
    @file_put_contents($rk, $n + 1);
}
limit('ip' . ($_SERVER['REMOTE_ADDR'] ?? 'x'), 600);
limit('tk' . $token, 120);
if (mt_rand(0, 199) === 0) foreach (glob(sys_get_temp_dir() . '/bbroomrl_*') ?: [] as $f) if (filemtime($f) < time() - 180) @unlink($f);

if ($token === '' || strlen($token) > 16000 || preg_match('/[\x00-\x20;]/', $token)) fail(400, 'missing token');

// ── who is this? (asked once, then remembered for 10 minutes) ──
function whoami(string $token): ?array {
    $ck = sys_get_temp_dir() . '/bbroomid_' . hash('sha256', $token);
    if (is_file($ck) && filemtime($ck) > time() - 600) {
        $c = json_decode((string)@file_get_contents($ck), true);
        if (is_array($c)) return $c;
    }
    $get = function (string $path, string $auth) {
        $ch = curl_init('https://' . RN_HOST . $path);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_USERAGENT => 'BeetleBoySP-room/1', CURLOPT_HTTPHEADER => [$auth, 'Accept: application/json']]);
        $r = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        return $code === 200 ? json_decode((string)$r, true) : null;
    };
    // a password login works on the internal API, "Sign in with remilia.net" only on /api/v1
    $w = $get('/api/profile/whoami', 'Cookie: authToken=' . $token);
    $handle = (string)($w['userHandle'] ?? '');
    $name   = (string)($w['displayName'] ?? '');
    if ($handle === '') {
        $v = $get('/api/v1/me', 'Authorization: Bearer ' . $token);
        $u = $v['user'] ?? $v['data']['user'] ?? [];
        $handle = (string)($u['username'] ?? '');
        $name   = (string)($u['displayName'] ?? '');
    }
    if (!preg_match('/^[A-Za-z0-9_.-]{1,40}$/', $handle)) return null;
    $me = ['u' => $handle, 'd' => mb_substr($name !== '' ? $name : $handle, 0, 40)];
    @file_put_contents($ck, json_encode($me));
    if (mt_rand(0, 49) === 0) foreach (glob(sys_get_temp_dir() . '/bbroomid_*') ?: [] as $f) if (filemtime($f) < time() - 900) @unlink($f);
    return $me;
}
$me = whoami($token);
if (!$me) fail(401, 'login expired');

// ── read, update and write the room under a lock ──
$file = sys_get_temp_dir() . '/' . ROOM;
$fp = fopen($file, 'c+');
if (!$fp) fail(500, 'room unavailable');
flock($fp, LOCK_EX);
$room = json_decode(stream_get_contents($fp) ?: '{}', true);
if (!is_array($room)) $room = [];
$now = time();
foreach ($room as $u => $p) if (($p['t'] ?? 0) < $now - STALE) unset($room[$u]);

$leave = !empty($in['leave']);
if ($leave) unset($room[$me['u']]);
else {
    $prev = $room[$me['u']] ?? null;
    $x = isset($in['x']) ? max(0, min(W, (int)$in['x'])) : ($prev['x'] ?? mt_rand(80, W - 80));
    $y = isset($in['y']) ? max(40, min(H, (int)$in['y'])) : ($prev['y'] ?? mt_rand(120, H - 20));
    $room[$me['u']] = ['d' => $me['d'], 'x' => $x, 'y' => $y, 't' => $now];
}
if (count($room) > 60) { uasort($room, fn($a, $b) => $b['t'] <=> $a['t']); $room = array_slice($room, 0, 60, true); }

ftruncate($fp, 0); rewind($fp);
fwrite($fp, json_encode($room));
fflush($fp); flock($fp, LOCK_UN); fclose($fp);

$out = [];
foreach ($room as $u => $p) $out[] = ['u' => (string)$u, 'd' => $p['d'], 'x' => $p['x'], 'y' => $p['y']];
echo json_encode(['me' => $me['u'], 'people' => $out]);
