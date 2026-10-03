<?php
// Push notifications for BeetleBoy timers, also when the app is closed.
// The browser subscribes and tells us when its timers end; nothing else is
// stored (no login tokens). Due notifications are sent by
//   - GET push.php?cron=<secret>   (a cron job, every minute)
//   - push_tick() from proxy.php    (piggybacks on normal app traffic)
// GET  push.php?key                 -> {publicKey}
// POST {action:"sync", subscription, timers:[{id, at, label}]}
// POST {action:"unsubscribe", endpoint}
const BB_PRIVATE = '/home/sites/site100039010/beetleboy-private';
const PUSH_HOSTS = '/(^|\.)(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com|push\.services\.mozilla\.com)$/';
const TIMER_IDS  = ['catchBeetle', 'beetleHunt', 'claimUBC', 'junkFaucet'];
const MAX_SUBS   = 5000;

function push_cfg(): array { static $c; return $c ??= require BB_PRIVATE . '/config.php'; }

function push_db(): PDO {
    static $d;
    if ($d) return $d;
    $d = new PDO('sqlite:' . BB_PRIVATE . '/push.sqlite');
    $d->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $d->exec('PRAGMA busy_timeout = 3000');
    $d->exec('CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, sub TEXT NOT NULL, updated INTEGER NOT NULL)');
    $d->exec('CREATE TABLE IF NOT EXISTS timers (endpoint TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, label TEXT NOT NULL, PRIMARY KEY (endpoint, id))');
    return $d;
}

// Send everything that's due; at most once every 20 s across all callers.
function push_tick(bool $force = false): int {
    $stamp = BB_PRIVATE . '/push.last';
    if (!$force && @filemtime($stamp) > time() - 20) return 0;
    @touch($stamp);
    $db = push_db();
    $due = $db->query('SELECT t.endpoint, t.id, t.label, s.sub FROM timers t JOIN subs s ON s.endpoint = t.endpoint WHERE t.at <= ' . (int)(microtime(true) * 1000 + 5000) . ' LIMIT 300')->fetchAll(PDO::FETCH_ASSOC);
    if (!$due) return 0;
    require_once BB_PRIVATE . '/vendor/autoload.php';
    $cfg = push_cfg();
    $wp = new Minishlink\WebPush\WebPush(['VAPID' => ['subject' => $cfg['subject'], 'publicKey' => $cfg['publicKey'], 'privateKey' => $cfg['privateKey']]], ['TTL' => 3600]);
    $del = $db->prepare('DELETE FROM timers WHERE endpoint = ? AND id = ?');
    foreach ($due as $t) {
        $wp->queueNotification(
            Minishlink\WebPush\Subscription::create(json_decode($t['sub'], true)),
            json_encode(['title' => 'BeetleBoy SP', 'body' => $t['label'] . ' is ready!', 'tag' => $t['id']])
        );
        $del->execute([$t['endpoint'], $t['id']]);
    }
    $sent = 0;
    foreach ($wp->flush() as $report) {
        if ($report->isSuccess()) { $sent++; continue; }
        if ($report->isSubscriptionExpired()) {           // browser dropped the subscription
            $ep = $report->getEndpoint();
            $db->prepare('DELETE FROM subs WHERE endpoint = ?')->execute([$ep]);
            $db->prepare('DELETE FROM timers WHERE endpoint = ?')->execute([$ep]);
        }
    }
    return $sent;
}

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') !== 'push.php') return;   // included by proxy.php

header('Content-Type: application/json');
function out(int $code, array $body): never { http_response_code($code); echo json_encode($body); exit; }

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['key'])) out(200, ['publicKey' => push_cfg()['publicKey']]);
    if (isset($_GET['cron'])) {
        if (!hash_equals(push_cfg()['cronSecret'], (string)$_GET['cron'])) out(403, ['error' => 'forbidden']);
        out(200, ['sent' => push_tick(true)]);
    }
    out(400, ['error' => 'bad request']);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'method not allowed']);

$in = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $in['action'] ?? '';
$db = push_db();

if ($action === 'unsubscribe') {
    $ep = (string)($in['endpoint'] ?? '');
    $db->prepare('DELETE FROM subs WHERE endpoint = ?')->execute([$ep]);
    $db->prepare('DELETE FROM timers WHERE endpoint = ?')->execute([$ep]);
    out(200, ['ok' => true]);
}
if ($action !== 'sync') out(400, ['error' => 'unknown action']);

$sub = $in['subscription'] ?? null;
$ep  = is_array($sub) ? (string)($sub['endpoint'] ?? '') : '';
$u   = parse_url($ep);
if (!$u || ($u['scheme'] ?? '') !== 'https' || !preg_match(PUSH_HOSTS, $u['host'] ?? '') || strlen($ep) > 1000
    || empty($sub['keys']['p256dh']) || empty($sub['keys']['auth'])) {
    out(400, ['error' => 'not a browser push subscription']);
}
$known = $db->prepare('SELECT 1 FROM subs WHERE endpoint = ?');
$known->execute([$ep]);
if (!$known->fetchColumn() && (int)$db->query('SELECT COUNT(*) FROM subs')->fetchColumn() >= MAX_SUBS) out(503, ['error' => 'full']);

$clean = ['endpoint' => $ep, 'keys' => ['p256dh' => (string)$sub['keys']['p256dh'], 'auth' => (string)$sub['keys']['auth']]];
$db->beginTransaction();
$db->prepare('INSERT INTO subs (endpoint, sub, updated) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET sub = excluded.sub, updated = excluded.updated')
   ->execute([$ep, json_encode($clean), time()]);
$db->prepare('DELETE FROM timers WHERE endpoint = ?')->execute([$ep]);
$ins = $db->prepare('INSERT OR REPLACE INTO timers (endpoint, id, at, label) VALUES (?, ?, ?, ?)');
$now = microtime(true) * 1000;
foreach (array_slice((array)($in['timers'] ?? []), 0, 8) as $t) {
    $id = (string)($t['id'] ?? ''); $at = (int)($t['at'] ?? 0);
    if (!in_array($id, TIMER_IDS, true) || $at < $now || $at > $now + 48 * 3600 * 1000) continue;
    $ins->execute([$ep, $id, $at, mb_substr(preg_replace('/[^\p{L}\p{N} ]/u', '', (string)($t['label'] ?? $id)), 0, 40)]);
}
$db->commit();
out(200, ['ok' => true]);
