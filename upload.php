<?php
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

const UPLOAD_DIR  = __DIR__ . '/uploads/';
const MAX_BYTES   = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg','image/png','image/gif','image/webp'];

function jwt_claims(string $tok): ?array {
    $p = explode('.', $tok);
    if (count($p) !== 3) return null;
    $c = json_decode(base64_decode(str_replace(['-','_'],['+','/'], $p[1])), true);
    if (!$c || ($c['exp'] ?? 0) < time()) return null;
    return $c;
}

$token = trim($_POST['token'] ?? '');
if (!$token) { http_response_code(400); echo '{"error":"missing token"}'; exit; }
if (!jwt_claims($token)) { http_response_code(401); echo '{"error":"unauthorized"}'; exit; }

if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400); echo '{"error":"no file"}'; exit;
}

$file = $_FILES['image'];
if ($file['size'] > MAX_BYTES) {
    http_response_code(413); echo '{"error":"file too large (max 5 MB)"}'; exit;
}

// Validate by actual mime type, not extension
$mime = mime_content_type($file['tmp_name']);
if (!in_array($mime, ALLOWED_MIME)) {
    http_response_code(415); echo '{"error":"unsupported file type"}'; exit;
}

$ext = match($mime) {
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
};

if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

$filename = bin2hex(random_bytes(12)) . '.' . $ext;
$dest     = UPLOAD_DIR . $filename;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500); echo '{"error":"upload failed"}'; exit;
}

echo json_encode(['url' => 'uploads/' . $filename]);
