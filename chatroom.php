<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204); exit;
}

const MAX_MSGS     = 600;
const CHAT_FILE    = __DIR__ . '/data/chat.json';
const JOINS_FILE   = __DIR__ . '/data/joins.json';
const JOIN_COOLDOWN = 600; // 10 minutes
const ALLOWED_REACTS = ['😹', '🤍', '👍', '🪲'];

if (!is_dir(__DIR__ . '/data')) {
    mkdir(__DIR__ . '/data', 0750, true);
    file_put_contents(__DIR__ . '/data/.htaccess', "Deny from all\n");
}

function load_msgs(): array {
    if (!file_exists(CHAT_FILE)) return [];
    return json_decode(file_get_contents(CHAT_FILE), true) ?? [];
}

function save_msgs(array $msgs): void {
    file_put_contents(CHAT_FILE, json_encode(array_values($msgs)));
}

function jwt_claims(string $tok): ?array {
    $p = explode('.', $tok);
    if (count($p) !== 3) return null;
    $c = json_decode(base64_decode(str_replace(['-','_'],['+','/'], $p[1])), true);
    if (!$c || ($c['exp'] ?? 0) < time()) return null;
    return $c;
}

// ── GET: fetch messages or reactions ─────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $msgs = load_msgs();
    if (isset($_GET['reactions'])) {
        $out = [];
        foreach ($msgs as $m) {
            if (!empty($m['reactions'])) $out[(string)$m['id']] = $m['reactions'];
        }
        echo json_encode(['reactions' => $out]);
        exit;
    }
    if (isset($_GET['after'])) {
        $after = (int)$_GET['after'];
        $msgs  = array_values(array_filter($msgs, fn($m) => $m['id'] > $after));
    } else {
        $msgs = array_slice($msgs, -(min((int)($_GET['last'] ?? 50), 100)));
    }
    echo json_encode(['posts' => array_values($msgs)]);
    exit;
}

// ── POST: send message, join event, or react ─────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in     = json_decode(file_get_contents('php://input'), true) ?? [];
    $token  = trim($in['token']  ?? '');
    $action = trim($in['action'] ?? 'message');

    if (!$token) { http_response_code(400); echo '{"error":"bad request"}'; exit; }

    $claims = jwt_claims($token);
    if (!$claims) { http_response_code(401); echo '{"error":"unauthorized"}'; exit; }

    $rich = json_decode($claims['rich_data'] ?? '{}', true) ?? [];
    $pfp  = $rich['pfpUrl'] ?? '';
    if ($pfp && $pfp[0] === '/') $pfp = 'https://www.remilia.net' . $pfp;
    $username    = $rich['displayUsername'] ?? ($claims['preferred_username'] ?? '?');
    $displayname = $rich['displayName']     ?? ($claims['preferred_username'] ?? '?');
    $theme = preg_replace('/[^a-z0-9_-]/', '', $in['theme'] ?? 'flame');
    $user = ['username' => $username, 'displayname' => $displayname, 'pfpUrl' => $pfp, 'theme' => $theme];

    $fp = fopen(CHAT_FILE . '.lock', 'c');
    flock($fp, LOCK_EX);

    if ($action === 'join') {
        $joins = file_exists(JOINS_FILE) ? (json_decode(file_get_contents(JOINS_FILE), true) ?? []) : [];
        $last  = $joins[$username] ?? 0;
        if (time() - $last >= JOIN_COOLDOWN) {
            $joins[$username] = time();
            $joins = array_filter($joins, fn($t) => time() - $t < JOIN_COOLDOWN * 3);
            file_put_contents(JOINS_FILE, json_encode($joins));

            $msg = ['id' => (int)(microtime(true) * 1000), 'time' => time(),
                    'type' => 'join', 'user' => $user];
            $msgs   = load_msgs();
            $msgs[] = $msg;
            if (count($msgs) > MAX_MSGS) $msgs = array_slice($msgs, -MAX_MSGS);
            save_msgs($msgs);
        }
        flock($fp, LOCK_UN); fclose($fp);
        echo '{"success":true}';

    } elseif ($action === 'react') {
        $msgId = (int)($in['msgId'] ?? 0);
        $emoji = $in['emoji'] ?? '';
        if (!$msgId || !in_array($emoji, ALLOWED_REACTS)) {
            flock($fp, LOCK_UN); fclose($fp);
            http_response_code(400); echo '{"error":"bad request"}'; exit;
        }
        $msgs = load_msgs();
        foreach ($msgs as &$m) {
            if ($m['id'] === $msgId && ($m['type'] ?? 'message') !== 'join') {
                $r = $m['reactions'] ?? [];
                if (!isset($r[$emoji])) $r[$emoji] = [];
                $idx = array_search($username, $r[$emoji]);
                if ($idx !== false) {
                    array_splice($r[$emoji], $idx, 1);
                    if (empty($r[$emoji])) unset($r[$emoji]);
                } else {
                    $r[$emoji][] = $username;
                }
                $m['reactions'] = $r;
                break;
            }
        }
        unset($m);
        save_msgs($msgs);
        flock($fp, LOCK_UN); fclose($fp);
        echo '{"success":true}';

    } else {
        $body = trim($in['body'] ?? '');
        if (!$body) { flock($fp, LOCK_UN); fclose($fp); http_response_code(400); echo '{"error":"bad request"}'; exit; }
        $body = mb_substr($body, 0, 500);

        $replyTo = null;
        if (!empty($in['replyTo']) && is_array($in['replyTo'])) {
            $rt = $in['replyTo'];
            $rtId = (int)($rt['id'] ?? 0);
            if ($rtId) {
                $replyTo = [
                    'id'          => $rtId,
                    'username'    => mb_substr(preg_replace('/[^\w.-]/', '', $rt['username']   ?? ''), 0, 50),
                    'displayname' => mb_substr(strip_tags($rt['displayname'] ?? ''), 0, 80),
                    'body'        => mb_substr(strip_tags($rt['body']        ?? ''), 0, 100),
                ];
            }
        }

        $msg = ['id' => (int)(microtime(true) * 1000), 'time' => time(),
                'body' => $body, 'user' => $user];
        if ($replyTo) $msg['replyTo'] = $replyTo;
        $msgs   = load_msgs();
        $msgs[] = $msg;
        if (count($msgs) > MAX_MSGS) $msgs = array_slice($msgs, -MAX_MSGS);
        save_msgs($msgs);
        flock($fp, LOCK_UN); fclose($fp);
        echo '{"success":true}';
    }
    exit;
}

http_response_code(405); echo '{"error":"method not allowed"}';
