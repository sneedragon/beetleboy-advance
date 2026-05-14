<?php
// Stateless CORS proxy. Only used if USE_PROXY = true in app.js.
// Stores nothing. Forwards requests to remilia.net with the client's auth token.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── Rate limiting ─────────────────────────────────────────────────────────────
function rate_limit(string $ip, int $limit, int $window_sec): void {
    $key  = sys_get_temp_dir() . '/bbrl_' . md5($ip) . '_' . floor(time() / $window_sec);
    $lock = $key . '.lock';
    $fp   = fopen($lock, 'c');
    if (!$fp) return; // can't lock, allow through
    flock($fp, LOCK_EX);
    $count = (int)@file_get_contents($key);
    if ($count >= $limit) {
        flock($fp, LOCK_UN); fclose($fp);
        http_response_code(429);
        echo '{"error":"rate limit exceeded, slow down"}';
        exit;
    }
    file_put_contents($key, $count + 1);
    flock($fp, LOCK_UN); fclose($fp);
    // Occasionally clean up old files (1% chance)
    if (mt_rand(0, 99) === 0) {
        $cutoff = floor(time() / $window_sec) - 2;
        foreach (glob(sys_get_temp_dir() . '/bbrl_*') as $f) {
            if (preg_match('/_(\d+)(?:\.lock)?$/', $f, $m) && (int)$m[1] < $cutoff)
                @unlink($f);
        }
    }
}

$ip    = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$input = json_decode(file_get_contents('php://input'), true);

// Rate-limit unauthenticated requests only; authenticated users are throttled by remilia.net itself
$has_token = !empty($input['token'] ?? '');
if (!$has_token) {
    rate_limit($ip, 50, 200);
}
// ─────────────────────────────────────────────────────────────────────────────

$method = strtoupper($input['method'] ?? 'GET');
$path   = $input['path'] ?? '';
$body   = $input['body'] ?? null;
$token  = $input['token'] ?? '';

if (!$path || !$token) { http_response_code(400); echo '{"error":"bad request"}'; exit; }
if (strpos($token, "\r") !== false || strpos($token, "\n") !== false) {
    http_response_code(400); echo '{"error":"bad request"}'; exit;
}

// SSRF guard: path must be a plain /some/path with no URL tricks.
// Blocks @host injection (user-info bypass), protocol overrides, and
// encoded variants by validating the fully-constructed URL after parsing.
if ($path[0] !== '/') { http_response_code(400); echo '{"error":"invalid path"}'; exit; }
if (strpos($path, '@') !== false || strpos($path, '://') !== false) {
    http_response_code(400); echo '{"error":"invalid path"}'; exit;
}
$url    = 'https://www.remilia.net' . $path;
$parsed = parse_url($url);
if (!$parsed || ($parsed['host'] ?? '') !== 'www.remilia.net' || ($parsed['scheme'] ?? '') !== 'https') {
    http_response_code(400); echo '{"error":"invalid path"}'; exit;
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST  => $method,
    CURLOPT_HTTPHEADER     => [
        'Cookie: authToken=' . $token,
        'Accept: application/json',
        'Content-Type: application/json',
    ],
    CURLOPT_TIMEOUT        => 15,
]);

if ($body !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
}

$result   = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $result;
