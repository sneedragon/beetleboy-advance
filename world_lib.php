<?php
// Shared by world.php and dm.php: who is asking (checked with RemiliaNET),
// rate limits, and the SQLite file outside the web folder.

const RN_HOST = 'www.remilia.net';

function fail(int $code, string $msg): void { http_response_code($code); echo json_encode(['error' => $msg]); exit; }

function limit(string $key, int $max): void {
    $rk = sys_get_temp_dir() . '/bbworldrl_' . md5($key) . '_' . floor(time() / 60);
    $n  = (int)@file_get_contents($rk);
    if ($n >= $max) fail(429, 'slow down');
    @file_put_contents($rk, $n + 1);
}

function rn(string $path, string $auth): ?array {
    $ch = curl_init('https://' . RN_HOST . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_USERAGENT => 'BeetleBoySP-world/1', CURLOPT_HTTPHEADER => [$auth, 'Accept: application/json']]);
    $r = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return $code === 200 ? json_decode((string)$r, true) : null;
}

// who is this? (asked once, then remembered for 10 minutes)
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

// the POST body, the token in it, and who that token belongs to
function start(int $ipMax, int $tokenMax): array {
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only');
    $in    = json_decode(file_get_contents('php://input', false, null, 0, 40000), true) ?? [];
    $token = (string)($in['token'] ?? '');
    limit('ip' . ($_SERVER['REMOTE_ADDR'] ?? 'x'), $ipMax);
    limit('tk' . $token, $tokenMax);
    if (mt_rand(0, 199) === 0) foreach (glob(sys_get_temp_dir() . '/bbworldrl_*') ?: [] as $f) if (filemtime($f) < time() - 180) @unlink($f);
    if ($token === '' || strlen($token) > 16000 || preg_match('/[\x00-\x20;]/', $token)) fail(400, 'missing token');
    $me = whoami($token);
    if (!$me) fail(401, 'login expired');
    return [$in, $token, $me];
}

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
    try { $db->exec('ALTER TABLE users ADD COLUMN bug_coins INT NOT NULL DEFAULT 0'); } catch (PDOException $e) {}
    // what you caught and gave: {"bugs":[n,n,n],"fish":{id:n},"gday":"","gsent":0}
    try { $db->exec('ALTER TABLE users ADD COLUMN inv TEXT NOT NULL DEFAULT "{}"'); } catch (PDOException $e) {}
    // direct messages: only ciphertext, gone a day after it was sent
    $db->exec('CREATE TABLE IF NOT EXISTS dmkeys (u TEXT PRIMARY KEY, pub TEXT NOT NULL, t INT NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS dm (id INTEGER PRIMARY KEY AUTOINCREMENT, a TEXT NOT NULL, b TEXT NOT NULL,
        ka TEXT NOT NULL, kb TEXT NOT NULL, iv TEXT NOT NULL, ct TEXT NOT NULL, t INT NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS dm_b ON dm (b, id)');
    $db->exec('CREATE INDEX IF NOT EXISTS dm_a ON dm (a, id)');
    return $db;
}
const DM_TTL = 86400;
