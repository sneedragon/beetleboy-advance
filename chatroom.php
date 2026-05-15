<?php
// Miladychan chat proxy — reads via REST, posts via WebSocket server-side.
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204); exit;
}

define('MC_BOARD',  'beetle');
define('MC_THREAD', '201346');
define('MC_BASE',   'https://boards.miladychan.org');
define('WS_HOST',   'boards.miladychan.org');
define('MC_ORIGIN', 'https://www.remilia.net');

// ── helpers ───────────────────────────────────────────────────────────────────

function mc_get(string $token, array $params = []): ?array {
    $url = MC_BASE . '/json/chat/' . MC_BOARD . '/' . MC_THREAD . '/' . rawurlencode($token);
    if ($params) $url .= '?' . http_build_query($params);
    $ctx  = stream_context_create(['http' => [
        'header'        => "Origin: " . MC_ORIGIN . "\r\nUser-Agent: BeetleBoy/1.0\r\n",
        'timeout'       => 10,
        'ignore_errors' => true,
    ]]);
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) return null;
    if (isset($http_response_header)) {
        preg_match('/HTTP\/\S+\s+(\d+)/', $http_response_header[0] ?? '', $m);
        if ((int)($m[1] ?? 200) === 401) {
            http_response_code(401);
            echo json_encode(['error' => 'unauthorized']); exit;
        }
    }
    return json_decode($body, true);
}

function norm(array $p): array {
    $u = $p['user'] ?? [];
    return [
        'id'        => (int)($p['id'] ?? 0),
        'type'      => 'msg',
        'time'      => (int)($p['time'] ?? 0),
        'body'      => (string)($p['body'] ?? ''),
        'user'      => [
            'username'    => (string)($u['username']    ?? ($p['name'] ?? '')),
            'displayname' => (string)($u['displayname'] ?? ($p['name'] ?? '')),
            'pfpUrl'      => (string)($u['pfpUrl']      ?? ''),
            'theme'       => 'flame',
        ],
        'reactions' => is_array($p['reactions']) ? $p['reactions'] : (object)[],
        'replyTo'   => null,
    ];
}

// ── GET ───────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = trim($_GET['token'] ?? '');

    // Reaction poll — extract from latest posts
    if (isset($_GET['reactions'])) {
        if (!$token) { echo json_encode(['reactions' => (object)[]]);  exit; }
        $data = mc_get($token, ['last' => 50]);
        $out  = [];
        foreach (($data['posts'] ?? []) as $p) {
            if (!empty($p['reactions']) && is_array($p['reactions']))
                $out[(string)(int)$p['id']] = $p['reactions'];
        }
        echo json_encode(['reactions' => $out ?: (object)[]]);
        exit;
    }

    if (!$token) { echo json_encode(['posts' => []]); exit; }

    $after = isset($_GET['after']) ? (int)$_GET['after'] : null;
    $last  = min((int)($_GET['last'] ?? 50), 100);

    $data = mc_get($token, $after !== null ? ['after' => $after] : ['last' => $last]);
    if (!$data) { echo json_encode(['posts' => []]); exit; }

    $posts = array_map('norm', $data['posts'] ?? []);

    // Server may ignore ?after= and return all; filter here as fallback
    if ($after !== null)
        $posts = array_values(array_filter($posts, fn($p) => $p['id'] > $after));

    echo json_encode(['posts' => $posts]);
    exit;
}

// ── POST ──────────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in     = json_decode(file_get_contents('php://input'), true) ?? [];
    $token  = trim($in['token'] ?? '');
    $action = $in['action'] ?? '';

    // Side-channel actions (join, react) — silently acknowledged
    if ($action) { echo json_encode(['ok' => true]); exit; }

    $msg = trim($in['body'] ?? '');
    if (!$token || !$msg) {
        http_response_code(400);
        echo json_encode(['error' => 'missing params']); exit;
    }

    echo json_encode(mc_ws_post($token, mb_substr($msg, 0, 500)));
    exit;
}

http_response_code(405); echo json_encode(['error' => 'method not allowed']);

// ── WebSocket post ────────────────────────────────────────────────────────────

function mc_ws_post(string $token, string $msg): array {
    $ctx  = stream_context_create(['ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ]]);
    $sock = @stream_socket_client('ssl://' . WS_HOST . ':443', $errno, $errstr, 10,
                                  STREAM_CLIENT_CONNECT, $ctx);
    if (!$sock) return ['ok' => false, 'error' => "connect: $errstr"];
    stream_set_timeout($sock, 8);

    // WebSocket upgrade
    $key = base64_encode(random_bytes(16));
    fwrite($sock,
        "GET /api/socket HTTP/1.1\r\n" .
        "Host: "                    . WS_HOST    . "\r\n" .
        "Origin: "                  . MC_ORIGIN  . "\r\n" .
        "Upgrade: websocket\r\n" .
        "Connection: Upgrade\r\n" .
        "Sec-WebSocket-Key: "       . $key       . "\r\n" .
        "Sec-WebSocket-Version: 13\r\n\r\n"
    );
    $resp = '';
    while (!feof($sock)) {
        $line = fgets($sock, 4096);
        if ($line === false) break;
        $resp .= $line;
        if (rtrim($line) === '') break;
    }
    if (strpos($resp, '101') === false) {
        fclose($sock);
        return ['ok' => false, 'error' => 'ws handshake failed'];
    }

    // Auth frame (opcode 30)
    fwrite($sock, ws_frame('30' . json_encode([
        'board'         => MC_BOARD,
        'thread'        => MC_THREAD,
        'shoutboxtoken' => $token,
        'multisync'     => false,
    ])));

    // Post frame (opcode 01)
    fwrite($sock, ws_frame('01' . json_encode([
        'password' => 'beetleboy',
        'open'     => true,
        'sage'     => false,
        'body'     => $msg,
        'name'     => '',
    ])));

    // Wait for server ack (opcode 32), reply with 05
    $deadline = microtime(true) + 6;
    while (microtime(true) < $deadline && !feof($sock)) {
        $frame = ws_read_frame($sock);
        if ($frame === null) break;
        if (substr($frame, 0, 2) === '32') {
            fwrite($sock, ws_frame('05'));
            break;
        }
    }

    fclose($sock);
    return ['ok' => true];
}

function ws_frame(string $data): string {
    $len = strlen($data);
    if ($len < 126)       $header = "\x81" . chr($len | 0x80);
    elseif ($len < 65536) $header = "\x81" . chr(126 | 0x80) . pack('n', $len);
    else                  $header = "\x81" . chr(127 | 0x80) . pack('J', $len);
    $mask   = random_bytes(4);
    $masked = '';
    for ($i = 0; $i < $len; $i++) $masked .= $data[$i] ^ $mask[$i % 4];
    return $header . $mask . $masked;
}

function ws_read_frame($sock): ?string {
    $h = @fread($sock, 2);
    if (strlen($h) < 2) return null;
    $b2  = ord($h[1]);
    $len = $b2 & 0x7F;
    if ($len === 126)     { $e = fread($sock, 2); $len = strlen($e) >= 2 ? unpack('n', $e)[1]  : 0; }
    elseif ($len === 127) { $e = fread($sock, 8); $len = strlen($e) >= 8 ? unpack('J', $e)[1]  : 0; }
    if ($b2 & 0x80) {  // server-masked (unusual but handle it)
        $mask = fread($sock, 4);
        $raw  = $len ? (string)fread($sock, $len) : '';
        $out  = '';
        for ($i = 0; $i < strlen($raw); $i++) $out .= $raw[$i] ^ $mask[$i % 4];
        return $out;
    }
    return $len ? (string)@fread($sock, $len) : '';
}
