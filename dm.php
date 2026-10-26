<?php
// Direct messages between people in the world. The browsers encrypt them
// (ECDH P-256 + AES-GCM, js/dm.js); this file only ever sees ciphertext,
// the two names and the two public keys, and drops every message a day
// after it was sent.

require __DIR__ . '/world_lib.php';
[$in, $token, $me] = start(300, 120);
$U = $me['u'];
$test = str_contains(__DIR__, '/test');
$db = db($test);
$now = time();
if (mt_rand(0, 9) === 0) $db->prepare('DELETE FROM dm WHERE t < ?')->execute([$now - DM_TTL]);

$isKey = fn($k) => is_string($k) && preg_match('~^[A-Za-z0-9+/]{86}[A-Za-z0-9+/=]{2}$~', $k);
$isName = fn($u) => is_string($u) && preg_match('/^[A-Za-z0-9_.-]{1,40}$/', $u);
$keyOf = function (string $u) use ($db): ?string {
    $q = $db->prepare('SELECT pub FROM dmkeys WHERE u = ?'); $q->execute([$u]);
    return $q->fetchColumn() ?: null;
};

$act = (string)($in['act'] ?? '');
$out = ['me' => $U];

if ($act === 'setkey') {
    if (!$isKey($in['pub'] ?? null)) fail(400, 'bad key');
    $db->prepare('INSERT INTO dmkeys (u, pub, t) VALUES (?, ?, ?) ON CONFLICT(u) DO UPDATE SET pub = excluded.pub, t = excluded.t')
        ->execute([$U, $in['pub'], $now]);
    $act = 'inbox';
}

if ($act === 'pub') {
    if (!$isName($in['u'] ?? null)) fail(400, 'bad name');
    $out['pub'] = $keyOf($in['u']);
}

elseif ($act === 'send') {
    $to = $in['to'] ?? null;
    if (!$isName($to) || $to === $U) fail(400, 'bad name');
    foreach (['iv' => 16, 'ct' => 8000] as $k => $max) if (!is_string($in[$k] ?? null) || strlen($in[$k]) > $max || !preg_match('~^[A-Za-z0-9+/=]+$~', $in[$k])) fail(400, 'bad message');
    limit('dm' . $U, 20);
    $mine = $keyOf($U); $theirs = $keyOf($to);
    // keys changed since the browser looked: it encrypts again with the new ones
    if ($mine !== ($in['ka'] ?? null) || $theirs === null || $theirs !== ($in['kb'] ?? null)) { $out['stale'] = true; $out['pub'] = $theirs; $out['mine'] = $mine; }
    else {
        $q = $db->prepare('SELECT COUNT(*) FROM dm WHERE a = ? AND t > ?'); $q->execute([$U, $now - DM_TTL]);
        if ($q->fetchColumn() >= 500) fail(429, 'That is a lot of messages for one day.');
        $db->prepare('INSERT INTO dm (a, b, ka, kb, iv, ct, t) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$U, $to, $mine, $theirs, $in['iv'], $in['ct'], $now]);
        $out['id'] = (int)$db->lastInsertId();
    }
    $act = 'inbox';
}

elseif ($act === 'clear') {
    $w = $in['with'] ?? null;
    if (!$isName($w)) fail(400, 'bad name');
    $db->prepare('DELETE FROM dm WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)')->execute([$U, $w, $w, $U]);
    $out['cleared'] = $w;
}

if ($act === 'inbox' || $act === 'hello') {
    $since = max(0, (int)($in['since'] ?? 0));
    $q = $db->prepare('SELECT id, a, b, ka, kb, iv, ct, t FROM dm WHERE (a = ? OR b = ?) AND id > ? AND t > ? ORDER BY id LIMIT 500');
    $q->execute([$U, $U, $since, $now - DM_TTL]);
    $out['msgs'] = array_map(fn($r) => ['id' => (int)$r['id'], 'a' => $r['a'], 'b' => $r['b'], 'ka' => $r['ka'], 'kb' => $r['kb'], 'iv' => $r['iv'], 'ct' => $r['ct'], 't' => (int)$r['t']], $q->fetchAll(PDO::FETCH_ASSOC));
    // which messages are still there (the other side may have cleared a chat)
    $q = $db->prepare('SELECT MIN(id) FROM dm WHERE (a = ? OR b = ?) AND t > ?'); $q->execute([$U, $U, $now - DM_TTL]);
    $out['oldest'] = (int)$q->fetchColumn();
    $out['key'] = $keyOf($U);
}
$out['now'] = $now;
echo json_encode($out);
