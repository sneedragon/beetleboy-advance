<?php
// Miladychan chat proxy — reads and writes via WebSocket server-side.
// Reading: connect WS, auth, parse recent + listen for 33/01 live events.
// Writing: connect WS, auth, post via 01 frame, ack with 05.
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204); exit;
}

define('MC_BOARD',  'beetle');
define('MC_THREAD', '201346');
define('MC_HOST',   'boards.miladychan.org');
define('MC_ORIGIN', 'https://www.remilia.net');

// ── WebSocket helpers ─────────────────────────────────────────────────────────

function ws_connect(): mixed {
    $ctx  = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $sock = @stream_socket_client('ssl://' . MC_HOST . ':443', $errno, $errstr, 10,
                                  STREAM_CLIENT_CONNECT, $ctx);
    if (!$sock) return null;
    stream_set_timeout($sock, 8);

    $key = base64_encode(random_bytes(16));
    fwrite($sock,
        "GET /api/socket HTTP/1.1\r\n" .
        "Host: "                   . MC_HOST   . "\r\n" .
        "Origin: "                 . MC_ORIGIN . "\r\n" .
        "Upgrade: websocket\r\n" .
        "Connection: Upgrade\r\n" .
        "Sec-WebSocket-Key: "      . $key      . "\r\n" .
        "Sec-WebSocket-Version: 13\r\n\r\n"
    );
    $resp = '';
    while (!feof($sock)) { $l = fgets($sock); $resp .= $l; if (rtrim($l) === '') break; }
    if (strpos($resp, '101') === false) { fclose($sock); return null; }
    return $sock;
}

function ws_frame(string $data): string {
    $len = strlen($data);
    if ($len < 126)       $h = "\x81" . chr($len | 0x80);
    elseif ($len < 65536) $h = "\x81" . chr(126 | 0x80) . pack('n', $len);
    else                  $h = "\x81" . chr(127 | 0x80) . pack('J', $len);
    $mask   = random_bytes(4);
    $masked = '';
    for ($i = 0; $i < $len; $i++) $masked .= $data[$i] ^ $mask[$i % 4];
    return $h . $mask . $masked;
}

function read_exact($sock, int $len): string {
    $d = '';
    while (strlen($d) < $len) {
        $c = fread($sock, $len - strlen($d));
        if ($c === false || $c === '') break;
        $d .= $c;
    }
    return $d;
}

function ws_read($sock): ?string {
    $h = @fread($sock, 2);
    if (strlen($h) < 2) return null;
    $b2  = ord($h[1]);
    $len = $b2 & 0x7F;
    if ($len === 126)     $len = unpack('n', read_exact($sock, 2))[1];
    elseif ($len === 127) $len = unpack('J', read_exact($sock, 8))[1];
    if ($b2 & 0x80) {
        $mk  = read_exact($sock, 4);
        $raw = read_exact($sock, $len);
        $out = '';
        for ($i = 0; $i < strlen($raw); $i++) $out .= $raw[$i] ^ $mk[$i % 4];
        return $out;
    }
    return $len ? read_exact($sock, $len) : '';
}

function ws_auth($sock, string $token): void {
    fwrite($sock, ws_frame('30' . json_encode([
        'board'         => MC_BOARD,
        'thread'        => MC_THREAD,
        'shoutboxtoken' => $token,
        'multisync'     => false,
    ])));
}

// ── Post normalizers ──────────────────────────────────────────────────────────

function norm_full(array $p): array {
    $u = $p['user'] ?? [];
    return [
        'id'        => (int)($p['id']   ?? 0),
        'type'      => 'msg',
        'time'      => (int)($p['time'] ?? 0),
        'body'      => (string)($p['body'] ?? ''),
        'user'      => [
            'username'    => (string)($u['username']    ?? ($p['name'] ?? '')),
            'displayname' => (string)($u['displayname'] ?? ($p['name'] ?? '')),
            'pfpUrl'      => (string)($u['pfpUrl']      ?? ''),
            'theme'       => 'flame',
        ],
        'reactions' => is_array($p['reactions'] ?? null) ? $p['reactions'] : (object)[],
        'replyTo'   => null,
    ];
}

function norm_body_only(int $id, string $body): array {
    return [
        'id'        => $id,
        'type'      => 'msg',
        'time'      => 0,
        'body'      => $body,
        'user'      => ['username' => '', 'displayname' => '', 'pfpUrl' => '', 'theme' => 'flame'],
        'reactions' => (object)[],
        'replyTo'   => null,
    ];
}

// ── Fetch messages via WebSocket ──────────────────────────────────────────────

function mc_fetch(string $token, int $after_id): array {
    $sock = ws_connect();
    if (!$sock) return [];

    ws_auth($sock, $token);

    $recent   = [];  // id => body  (from op 30, no username)
    $full     = [];  // id => post  (from op 33/01, has username)
    $got_init = false;
    $deadline = microtime(true) + 10;
    $cutoff   = 0;   // set after we receive op 30

    while (microtime(true) < $deadline && !feof($sock)) {
        if ($cutoff && microtime(true) > $cutoff) break;

        $frame = ws_read($sock);
        if ($frame === null) break;
        $op      = substr($frame, 0, 2);
        $payload = substr($frame, 2);

        if ($op === '30' && !$got_init) {
            $got_init = true;
            $data = json_decode($payload, true) ?? [];
            foreach ($data['recent'] ?? [] as $id => $p) {
                $id = (int)$id;
                if ($id > $after_id) $recent[$id] = (string)($p['body'] ?? '');
            }
            // Wait 1.2s more after getting history, in case live 33/01 arrive
            $cutoff = microtime(true) + 1.2;

        } elseif ($op === '33') {
            $events = json_decode($payload, true) ?? [];
            foreach ((array)$events as $evt) {
                if (!is_string($evt) || substr($evt, 0, 2) !== '01') continue;
                $p = json_decode(substr($evt, 2), true);
                if (!$p || empty($p['id'])) continue;
                $id = (int)$p['id'];
                if ($id > $after_id) $full[$id] = $p;
            }

        } elseif ($op === '32') {
            fwrite($sock, ws_frame('05'));
        }
    }
    fclose($sock);

    // Merge: all IDs from either source
    $all_ids = array_unique(array_merge(array_keys($recent), array_keys($full)));
    sort($all_ids);

    $result = [];
    foreach ($all_ids as $id) {
        $result[] = isset($full[$id])
            ? norm_full($full[$id])
            : norm_body_only($id, $recent[$id] ?? '');
    }
    return $result;
}

// ── GET ───────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = trim($_GET['token'] ?? '');
    if (!$token) { echo json_encode(['posts' => []]); exit; }

    if (isset($_GET['reactions'])) {
        // Reactions come embedded in posts; return empty to disable separate poll
        echo json_encode(['reactions' => (object)[]]);
        exit;
    }

    $after = isset($_GET['after']) ? (int)$_GET['after'] : 0;
    $posts = mc_fetch($token, $after);
    echo json_encode(['posts' => $posts]);
    exit;
}

// ── POST ──────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in     = json_decode(file_get_contents('php://input'), true) ?? [];
    $token  = trim($in['token'] ?? '');
    $action = $in['action'] ?? '';

    if ($action) { echo json_encode(['ok' => true]); exit; }

    $msg = trim($in['body'] ?? '');
    if (!$token || !$msg) {
        http_response_code(400);
        echo json_encode(['error' => 'missing params']); exit;
    }

    echo json_encode(mc_ws_post($token, mb_substr($msg, 0, 500)));
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'method not allowed']);

// ── WebSocket post ────────────────────────────────────────────────────────────

function mc_ws_post(string $token, string $msg): array {
    $sock = ws_connect();
    if (!$sock) return ['ok' => false, 'error' => 'connect failed'];

    ws_auth($sock, $token);

    fwrite($sock, ws_frame('01' . json_encode([
        'password' => 'beetleboy',
        'open'     => true,
        'sage'     => false,
        'body'     => $msg,
        'name'     => '',
    ])));

    $deadline = microtime(true) + 6;
    while (microtime(true) < $deadline && !feof($sock)) {
        $frame = ws_read($sock);
        if ($frame === null) break;
        if (substr($frame, 0, 2) === '32') {
            fwrite($sock, ws_frame('05'));
            break;
        }
    }

    fclose($sock);
    return ['ok' => true];
}
