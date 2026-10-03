<?php
// RemiliaNET global chat bridge.
// Reading happens through proxy.php (GET /api/chats/1/messages).
// Writing goes over RemiliaNET's chat websocket (/api/ws), which the
// browser can't open from another origin, so this script does it server-side:
// POST {token, action: "submit", text, replyTo?}
// POST {token, action: "react" | "unreact", messageId, emoji}
// POST {token, action: "ping"}  (connect + subscribe only, posts nothing)
// POST multipart token, action=upload, file  -> {ok, mediaId, url} (RemiliaNET media upload)
// Stores nothing.
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204); exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo '{"error":"method not allowed"}'; exit;
}

const RN_HOST = 'www.remilia.net';
const CHAT_ID = 1;

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

// ── WebSocket primitives ──────────────────────────────────────────────────────

function ws_connect(string $token) {
    $ctx  = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $sock = @stream_socket_client('ssl://' . RN_HOST . ':443', $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $ctx);
    if (!$sock) return null;
    stream_set_timeout($sock, 5);
    $key = base64_encode(random_bytes(16));
    fwrite($sock,
        "GET /api/ws HTTP/1.1\r\n" .
        "Host: " . RN_HOST . "\r\n" .
        "Origin: https://" . RN_HOST . "\r\n" .
        "Cookie: authToken=" . $token . "\r\n" .
        "Upgrade: websocket\r\nConnection: Upgrade\r\n" .
        "Sec-WebSocket-Key: " . $key . "\r\n" .
        "Sec-WebSocket-Version: 13\r\n\r\n"
    );
    $resp = '';
    while (!feof($sock)) {
        $l = fgets($sock);
        if ($l === false) break;
        $resp .= $l;
        if (rtrim($l) === '') break;
    }
    if (strpos($resp, ' 101 ') === false) { fclose($sock); return null; }
    return $sock;
}

function read_exact($sock, int $n): string {
    $d = '';
    while (strlen($d) < $n) {
        $c = fread($sock, $n - strlen($d));
        if ($c === false || $c === '') {
            if (feof($sock) || stream_get_meta_data($sock)['timed_out']) break;
            continue;
        }
        $d .= $c;
    }
    return $d;
}

// Returns the next text frame, or null on timeout/close.
function ws_read($sock): ?string {
    $h = read_exact($sock, 2);
    if (strlen($h) < 2) return null;
    $op = ord($h[0]) & 0x0F;
    $len = ord($h[1]) & 0x7F;
    if ($len === 126) $len = unpack('n', read_exact($sock, 2))[1];
    elseif ($len === 127) $len = unpack('J', read_exact($sock, 8))[1];
    $data = $len ? read_exact($sock, $len) : '';
    if ($op === 0x8) return null;                 // close
    if ($op === 0x9) { ws_send($sock, $data, 0xA); return ws_read($sock); } // ping -> pong
    return $data;
}

function ws_send($sock, string $d, int $op = 0x1): void {
    $l = strlen($d);
    $h = chr(0x80 | $op) . ($l < 126 ? chr($l | 0x80) : ($l < 65536 ? chr(126 | 0x80) . pack('n', $l) : chr(127 | 0x80) . pack('J', $l)));
    $m = random_bytes(4); $o = '';
    for ($i = 0; $i < $l; $i++) $o .= $d[$i] ^ $m[$i % 4];
    fwrite($sock, $h . $m . $o);
}

function ws_json($sock, string $type, array $payload): void {
    ws_send($sock, json_encode(['type' => $type, 'payload' => $payload]));
}

// ── Image upload: RemiliaNET's own media store, so images show natively ──────

function rn_http(string $method, string $path, string $token, $body, array $headers = []): array {
    $ch = curl_init('https://' . RN_HOST . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => array_merge(['Cookie: authToken=' . $token, 'Accept: application/json', 'Origin: https://' . RN_HOST], $headers),
        CURLOPT_POSTFIELDS => $body,
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode((string)$res, true)];
}

if (($_POST['action'] ?? '') === 'upload') {
    $token = trim($_POST['token'] ?? '');
    if (!$token || preg_match('/[\r\n;\s]/', $token)) fail(400, 'missing token');
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) fail(400, 'no file');
    if ($f['size'] > 10 * 1024 * 1024) fail(413, 'image too large (max 10 MB)');
    $mime = mime_content_type($f['tmp_name']);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true)) fail(415, 'only images (jpg, png, gif, webp)');
    [$code, $up] = rn_http('POST', '/media/upload/', $token, ['file' => new CURLFile($f['tmp_name'], $mime, 'image')]);
    if ($code !== 200 || empty($up['token'])) fail(502, 'RemiliaNET upload failed (' . $code . ')');
    [$code, $conf] = rn_http('POST', '/media/upload/confirm', $token, json_encode(['tokens' => [$up['token']]]), ['Content-Type: application/json']);
    $m = $conf['media'][0] ?? null;
    if ($code !== 200 || !$m) fail(502, 'RemiliaNET upload could not be confirmed');
    echo json_encode(['ok' => true, 'mediaId' => (int)$m['media_id'], 'url' => 'https://' . RN_HOST . $m['url']]);
    exit;
}

// ── Request ───────────────────────────────────────────────────────────────────

$in     = json_decode(file_get_contents('php://input'), true) ?? [];
$token  = trim($in['token'] ?? '');
$action = $in['action'] ?? '';
if (!$token || preg_match('/[\r\n;\s]/', $token)) fail(400, 'missing token');

if ($action === 'submit') {
    $text = trim((string)($in['text'] ?? ''));
    $media = array_values(array_filter(array_map('intval', array_slice((array)($in['mediaIds'] ?? []), 0, 4))));
    if ($text === '' && !$media) fail(400, 'empty message');
    if (strlen($text) > 8000) fail(413, 'message too long');
    $payload = ['chat_id' => CHAT_ID, 'text' => $text, 'media_ids' => $media];
    if (!empty($in['replyTo'])) $payload['in_reply_to_id'] = (int)$in['replyTo'];
} elseif ($action === 'react' || $action === 'unreact') {
    $msgId = (int)($in['messageId'] ?? 0);
    $emoji = (string)($in['emoji'] ?? '');
    if (!$msgId || $emoji === '' || mb_strlen($emoji) > 8) fail(400, 'bad reaction');
    $payload = ['chat_id' => CHAT_ID, 'message_id' => $msgId, 'emoji' => $emoji];
} elseif ($action === 'ping') {
    $payload = null; // only checks that the session can open the chat
} else {
    fail(400, 'unknown action');
}

$sock = ws_connect($token);
if (!$sock) fail(502, 'could not connect to RemiliaNET chat (login expired?)');

ws_json($sock, 'subscribe', ['chat_id' => CHAT_ID]);
$subscribed = false;
$deadline = microtime(true) + 4;
while (!$subscribed && microtime(true) < $deadline) {
    $f = ws_read($sock);
    if ($f === null) break;
    $j = json_decode($f, true);
    if (($j['type'] ?? '') === 'subscribed') $subscribed = true;
    if (($j['type'] ?? '') === 'error') { fclose($sock); fail(403, $j['payload']['message'] ?? 'chat error'); }
}
if (!$subscribed) { fclose($sock); fail(502, 'chat did not answer'); }

if ($action === 'ping') { fclose($sock); echo json_encode(['ok' => true]); exit; }
ws_json($sock, $action, $payload);

// Wait for the echo (deliver / reaction) or an error, so the client knows it worked
$result = ['ok' => true];
$deadline = microtime(true) + 5;
while (microtime(true) < $deadline) {
    $f = ws_read($sock);
    if ($f === null) break;
    $j = json_decode($f, true);
    $type = $j['type'] ?? '';
    if ($type === 'error') { $result = ['ok' => false, 'error' => $j['payload']['message'] ?? 'chat error']; break; }
    if ($action === 'submit' && $type === 'deliver') {
        $result['message'] = $j['payload'];
        break;
    }
    if ($action !== 'submit' && $type === 'reaction') break;
}
fclose($sock);
if (!$result['ok']) http_response_code(400);
echo json_encode($result);
