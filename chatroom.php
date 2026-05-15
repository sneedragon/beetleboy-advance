<?php
// Miladychan chat proxy.
// GET  ?stream=1&token=T  → SSE stream (persistent WS → browser)
// POST {token, body}      → post message via WS
// POST {action: ...}      → no-op (join, react, etc.)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST');
    header('Access-Control-Allow-Headers: Content-Type, Last-Event-ID');
    http_response_code(204); exit;
}

define('MC_BOARD',  'beetle');
define('MC_THREAD', '201346');
define('MC_HOST',   'boards.miladychan.org');
define('MC_ORIGIN', 'https://www.remilia.net');

// ── WebSocket primitives ──────────────────────────────────────────────────────

function ws_connect(): mixed {
    $ctx  = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $sock = @stream_socket_client('ssl://' . MC_HOST . ':443', $errno, $errstr, 10,
                                  STREAM_CLIENT_CONNECT, $ctx);
    if (!$sock) return null;
    stream_set_timeout($sock, 10);

    $key = base64_encode(random_bytes(16));
    fwrite($sock,
        "GET /api/socket HTTP/1.1\r\n" .
        "Host: "                   . MC_HOST   . "\r\n" .
        "Origin: "                 . MC_ORIGIN . "\r\n" .
        "Upgrade: websocket\r\nConnection: Upgrade\r\n" .
        "Sec-WebSocket-Key: "      . $key      . "\r\n" .
        "Sec-WebSocket-Version: 13\r\n\r\n"
    );
    $resp = '';
    while (!feof($sock)) { $l = fgets($sock); $resp .= $l; if (rtrim($l) === '') break; }
    if (strpos($resp, '101') === false) { fclose($sock); return null; }
    return $sock;
}

// read_exact loops until all bytes received, retrying on TLS-layer timeouts.
// PHP blocking TLS streams return false (not '') on stream_set_timeout expiry,
// so we must distinguish a real error (break) from a timeout (retry).
function read_exact($sock, int $n): string {
    $d = '';
    while (strlen($d) < $n) {
        $c = fread($sock, $n - strlen($d));
        if ($c === false) {
            if (feof($sock)) break;                        // connection closed
            $meta = stream_get_meta_data($sock);
            if (!$meta['timed_out']) break;               // real error
            continue;                                      // timeout — retry
        }
        if ($c === '') { if (feof($sock)) break; continue; }
        $d .= $c;
    }
    return $d;
}

// ws_read returns: string frame on success, null on timeout/no-data, false on disconnect
function ws_read($sock): string|null|false {
    $h = @fread($sock, 2);
    if ($h === false) return false;
    if ($h === '' || strlen($h) < 2) {
        // Possible timeout — check metadata
        $meta = stream_get_meta_data($sock);
        if ($meta['timed_out']) return null;
        if (feof($sock)) return false;
        // Got 1 byte, wait for second
        if (strlen($h) === 1) {
            $h2 = @fread($sock, 1);
            if (!$h2) return false;
            $h .= $h2;
        } else return null;
    }
    $b2 = ord($h[1]); $l = $b2 & 0x7F;
    if ($l === 126) $l = unpack('n', read_exact($sock, 2))[1];
    elseif ($l === 127) $l = unpack('J', read_exact($sock, 8))[1];
    if ($b2 & 0x80) { $mk = read_exact($sock,4); $raw = read_exact($sock,$l); $o=''; for($i=0;$i<strlen($raw);$i++) $o.=$raw[$i]^$mk[$i%4]; return $o; }
    return $l ? read_exact($sock, $l) : '';
}

function ws_frame(string $d): string {
    $l = strlen($d);
    $h = $l<126 ? "\x81".chr($l|0x80) : ($l<65536 ? "\x81".chr(126|0x80).pack('n',$l) : "\x81".chr(127|0x80).pack('J',$l));
    $m = random_bytes(4); $o = ''; for ($i=0;$i<$l;$i++) $o.=$d[$i]^$m[$i%4];
    return $h.$m.$o;
}

function ws_auth($sock, string $token): void {
    fwrite($sock, ws_frame('30'.json_encode([
        'board'=>MC_BOARD, 'thread'=>MC_THREAD, 'shoutboxtoken'=>$token, 'multisync'=>false,
    ])));
}

// ── Normalizers ───────────────────────────────────────────────────────────────

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

function norm_body_only(int $id, array $p): array {
    $name = (string)($p['name'] ?? '');
    $u    = $p['user'] ?? [];
    $uname = (string)($u['username']    ?? $name);
    $dname = (string)($u['displayname'] ?? $name);
    $pfp   = (string)($u['pfpUrl']      ?? '');
    return [
        'id' => $id, 'type' => 'msg',
        'time' => (int)($p['time'] ?? 0),
        'body' => (string)($p['body'] ?? ''),
        'user' => ['username'=>$uname,'displayname'=>$dname,'pfpUrl'=>$pfp,'theme'=>'flame'],
        'reactions' => (object)[], 'replyTo' => null,
    ];
}

function sse(array $posts): void {
    if (!$posts) return;
    $max = max(array_column($posts, 'id'));
    echo "id: $max\ndata: " . json_encode(['type'=>'posts','posts'=>$posts]) . "\n\n";
    flush();
}

// ── SSE stream ────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['stream'])) {
    $token = trim($_GET['token'] ?? '');
    if (!$token) { http_response_code(400); exit; }

    ignore_user_abort(false);
    @set_time_limit(0);
    while (@ob_end_flush());

    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('X-Accel-Buffering: no');

    $last_id = (int)($_SERVER['HTTP_LAST_EVENT_ID'] ?? 0);

    $sock = ws_connect();
    if (!$sock) {
        echo "data: " . json_encode(['type'=>'error','msg'=>'connect failed']) . "\n\n";
        flush(); exit;
    }
    ws_auth($sock, $token);
    // Longer timeout while waiting for the initial (potentially large) op-30 history frame.
    // Switched to 2 s after the first frame arrives so we can send SSE keepalives promptly.
    stream_set_timeout($sock, 10);

    $got_init = false;

    while (!feof($sock) && !connection_aborted()) {
        $frame = ws_read($sock);

        if ($frame === null) {
            if (!$got_init) continue; // still waiting for initial history — no ping yet
            echo ": ping\n\n"; flush();
            continue;
        }
        if ($frame === false) break; // WS disconnected
        $op      = substr($frame, 0, 2);
        $payload = substr($frame, 2);

        if ($op === '30' && !$got_init) {
            $got_init = true;
            stream_set_timeout($sock, 2);
            $recent_raw = json_decode($payload, true)['recent'] ?? [];
            foreach ($recent_raw as $id => $p) {
                $recent[] = norm_body_only((int)$id, is_array($p) ? $p : ['body' => (string)$p]);
            }
            sse($recent);

        } elseif ($op === '33') {
            // Live events — only '01' sub-events carry full post+user data.
            // Other sub-opcodes (02 = typing count, etc.) lack user info and would
            // overwrite the name slot via in-place update if forwarded first.
            $posts = [];
            foreach ((json_decode($payload, true) ?? []) as $evt) {
                if (!is_string($evt) || substr($evt, 0, 2) !== '01') continue;
                $p = json_decode(substr($evt, 2), true);
                if (!is_array($p) || empty($p['id'])) continue;
                $body = trim($p['body'] ?? '');
                if ($body !== '') {
                    $posts[] = norm_full($p);
                    $last_id = max($last_id, (int)$p['id']);
                }
            }
            sse($posts);

        } elseif ($op === '32') {
            fwrite($sock, ws_frame('05'));
        }
    }

    fclose($sock);
    exit;
}

// ── GET history proxy — fetches REST endpoint server-side to avoid CORS ─────────
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['history'])) {
    $token = trim($_GET['token'] ?? '');
    if (!$token) { http_response_code(400); echo '{}'; exit; }
    $ctx  = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $sock = @stream_socket_client('ssl://' . MC_HOST . ':443', $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $ctx);
    if (!$sock) { echo '{}'; exit; }
    stream_set_timeout($sock, 15);
    $path = '/json/chat/' . MC_BOARD . '/' . MC_THREAD . '/' . rawurlencode($token) . '?last=100';
    fwrite($sock,
        "GET $path HTTP/1.1\r\n" .
        "Host: "       . MC_HOST   . "\r\n" .
        "Origin: "     . MC_ORIGIN . "\r\n" .
        "Accept: application/json\r\n" .
        "Connection: close\r\n\r\n"
    );
    $raw = '';
    while (!feof($sock)) { $c = fread($sock, 8192); if ($c === false) break; $raw .= $c; }
    fclose($sock);
    $pos = strpos($raw, "\r\n\r\n");
    header('Content-Type: application/json');
    echo $pos !== false ? substr($raw, $pos + 4) : '{}';
    exit;
}

// ── GET reactions (no-op — reactions come with SSE stream) ────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(['reactions' => (object)[]]);
    exit;
}

// ── POST: send message or acknowledge side-channel actions ────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in     = json_decode(file_get_contents('php://input'), true) ?? [];
    $token  = trim($in['token'] ?? '');
    $action = $in['action'] ?? '';

    if ($action) { echo json_encode(['ok' => true]); exit; }

    $msg = trim($in['body'] ?? '');
    if (!$token || !$msg) { http_response_code(400); echo json_encode(['error'=>'missing']); exit; }

    $sock = ws_connect();
    if (!$sock) { echo json_encode(['ok'=>false,'error'=>'connect failed']); exit; }

    $uname = mb_substr(trim($in['uname'] ?? ''), 0, 50);
    ws_auth($sock, $token);
    fwrite($sock, ws_frame('01'.json_encode(['password'=>'beetleboy','open'=>true,'sage'=>false,'body'=>mb_substr($msg,0,500),'name'=>$uname])));

    $deadline = microtime(true) + 6;
    while (microtime(true) < $deadline && !feof($sock)) {
        $frame = ws_read($sock);
        if ($frame === null) break;
        if (substr($frame, 0, 2) === '32') { fwrite($sock, ws_frame('05')); break; }
    }
    fclose($sock);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405); echo json_encode(['error'=>'method not allowed']);
