<?php
// Collects items this site doesn't know yet. A logged-in player's browser sees the
// card data (names + image links) for things they own and sends it here; we fetch
// the images from remilia.net and park them outside the web root for review.
// POST {items:[{key, meta:{...}}]}  -> {saved:[keys]}
// Nothing about the player is stored (no token, no name, no IP).
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"error":"post only"}'; exit; }

const BB_PRIVATE = '/home/sites/site100039010/beetleboy-private';
const INCOMING   = BB_PRIVATE . '/incoming';
const MAX_ITEMS  = 300;          // directories kept in total
const MAX_BYTES  = 4000000;      // per image
const IMG_FIELDS = ['icon', 'background', 'character'];

function done(array $o, int $code = 200): void { http_response_code($code); echo json_encode($o); exit; }

// 30 requests per hour per client is plenty for a once-in-a-while check
$ip  = $_SERVER['REMOTE_ADDR'] ?? 'x';
$rk  = sys_get_temp_dir() . '/bbcol_' . md5($ip) . '_' . floor(time() / 3600);
$cnt = (int)@file_get_contents($rk);
if ($cnt >= 30) done(['error' => 'rate limit'], 429);
@file_put_contents($rk, $cnt + 1);

$in    = json_decode(file_get_contents('php://input', false, null, 0, 200000), true);
$items = is_array($in['items'] ?? null) ? array_slice($in['items'], 0, 10) : [];
if (!$items) done(['saved' => []]);
@mkdir(INCOMING, 0700, true);
if (count(glob(INCOMING . '/*', GLOB_ONLYDIR)) >= MAX_ITEMS) done(['error' => 'full'], 507);

// only remilia.net over https; relative links are resolved against www.remilia.net
function img_url(string $u): ?string {
    if ($u === '' || strlen($u) > 500) return null;
    if ($u[0] === '/' && ($u[1] ?? '') !== '/') $u = 'https://www.remilia.net' . $u;
    $p = parse_url($u);
    if (!$p || ($p['scheme'] ?? '') !== 'https' || isset($p['user']) || isset($p['port'])) return null;
    $h = strtolower($p['host'] ?? '');
    return ($h === 'remilia.net' || str_ends_with($h, '.remilia.net')) ? $u : null;
}
function fetch_img(string $url): ?array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_MAXFILESIZE => MAX_BYTES]);
    $d = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($code !== 200 || !is_string($d) || strlen($d) < 100 || strlen($d) > MAX_BYTES) return null;
    $ext = match (true) {
        str_starts_with($d, "\x89PNG") => 'png',
        str_starts_with($d, 'GIF8') => 'gif',
        str_starts_with($d, "\xFF\xD8\xFF") => 'jpg',
        substr($d, 0, 4) === 'RIFF' && substr($d, 8, 4) === 'WEBP' => 'webp',
        default => null,
    };
    return $ext ? [$d, $ext] : null;
}

$saved = [];
foreach ($items as $it) {
    $key = $it['key'] ?? '';
    if (!is_string($key) || !preg_match('/^[a-z0-9_]{2,60}$/', $key)) continue;
    $dir = INCOMING . '/' . $key;
    if (is_dir($dir)) continue;                       // already collected
    $meta = is_array($it['meta'] ?? null) ? $it['meta'] : [];
    $files = [];
    foreach (IMG_FIELDS as $f) {
        $u = img_url((string)($meta[$f] ?? ''));
        if (!$u) continue;
        $got = fetch_img($u);
        if ($got) $files[$f] = $got;
    }
    if (!$files) continue;                            // nothing real behind it
    if (!@mkdir($dir, 0700)) continue;
    $clean = [];
    foreach ($meta as $k => $v) {
        if (is_string($k) && strlen($k) < 40 && (is_string($v) || is_int($v) || is_float($v) || is_bool($v)))
            $clean[$k] = is_string($v) ? mb_substr($v, 0, 200) : $v;
    }
    foreach ($files as $f => [$data, $ext]) { file_put_contents("$dir/$f.$ext", $data); $clean["_file_$f"] = "$f.$ext"; }
    $clean['_collected'] = gmdate('c');
    file_put_contents("$dir/meta.json", json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    $saved[] = $key;
}
done(['saved' => $saved]);
