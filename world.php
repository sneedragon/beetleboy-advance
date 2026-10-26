<?php
// The world: one POST a second says where you are, what you are doing, and
// answers with everyone else, the shared ball, what the club screen plays
// and your coins. Names come from RemiliaNET (checked with your token).
// Positions live in a small JSON file in the temp folder; coins, what you
// bought and what you wear live in SQLite outside the web folder.

require __DIR__ . '/world_lib.php';

const W = 2820, H = 2120;          // the map in world units
const STALE = 20;                  // seconds without a word and you have left
const WALK = 260;                  // a little faster than a cat walks (W_SPEED in js/world.js)
// shared ball: it rolls inside the park and slows down on its own
const PEN = [100, 1240, 470, 1460]; // x0, y0, x1, y1
const GOAL = [1310, 1390];          // the goal mouths at both ends, as in js/world.js
const BALL_K = 1.4;
// coins
const DAILY = 25;                  // first visit of the day
const ACT_FAST = 30;               // the first this many a day come one a minute, then each takes a minute longer, up to ten
const XP_PER_COIN = 200, XP_CAP = 150;
const CAPSULE = 30;                // the capsule machine
const WISH = 1;                    // a coin into the well
const FIREWORK = 2;                // a rocket over the plaza
const GIFT_CAP = 200;              // coins you can give away a day
const POND = [1185, 620];           // the pond on the plaza, as in js/world.js
const STALL = [1500, 806];         // the buy counter in the terminal, as in js/world.js
const BIN = [118, 296];             // the dumpster in the back alley
const RUMMAGE = 90;                // seconds between two digs in the box
const CONFETTI = 2;                // seconds between free toys (confetti, bubbles)
// the Jade Arches kitchen: what the pantry sells, and what a plate pays (KITCHEN in js/places.js)
const JADE = [60, 40, 960, 330];
const CLUB = [60, 330, 960, 910];
const SLOT_ROOM = [1410, 40, 2310, 330];
const PANTRY = ['patty' => 3, 'bun' => 2, 'cheese' => 2, 'lettuce' => 2, 'tomato' => 2, 'potato' => 2];
const DISHES = ['burger' => [['bun', 'patty'], 6], 'cheeseburger' => [['bun', 'patty', 'cheese'], 9],
    'deluxe' => [['bun', 'patty', 'cheese', 'lettuce', 'tomato'], 14], 'fries' => [['potato'], 3], 'salad' => [['lettuce', 'tomato'], 5]];
const ORDER_LEN = 75, ORDER_N = 3;
// the order on board slot i: everyone sees the same ones (orderAt() in js/places.js)
function orderAt(int $i, float $t): array {
    $g = (int)floor(($t + $i * 25) / ORDER_LEN); $k = array_keys(DISHES);
    return ['id' => "$i:$g", 'd' => $k[(int)floor(hrand($g * 17 + $i * 5) * count($k))]];
}
// the farm: seed price, seconds to grow, what one sells for (CROPS in js/places.js)
const FARM = [510, 1490, 960, 1780];
// the slot parlour: what comes up how often, and what three of a kind pay (times the bet)
const SLOT_SYMS = ['green' => 30, 'ladybug' => 25, 'pillbug' => 20, 'stag' => 14, 'goliath' => 8, 'golden' => 3];
// four reels, three rows, seven lines; the golden beetle stands in for any other. Pays in fifths of the bet
// for three and four in a line from the left; worked out to give back about 95 in every 100 stars
const SLOT_PAY = ['green' => [3, 12], 'ladybug' => [4, 16], 'pillbug' => [7, 30], 'stag' => [12, 60], 'goliath' => [25, 150], 'golden' => [60, 750]];
const SLOT_LINES = [[1, 1, 1, 1], [0, 0, 0, 0], [2, 2, 2, 2], [0, 1, 1, 0], [2, 1, 1, 2], [1, 0, 0, 1], [1, 2, 2, 1]];
const SLOT_BETS = [1, 5, 10];
const PLOTS = 8;
const LIBRARY = [1860, 1200, 2310, 1490];    // the whiteboard works only in here
const WB_W = 320; const WB_H = 180; const WB_KEEP = 400;
const CROPS = ['lettuce' => [1, 120, 2], 'carrot' => [1, 150, 2], 'tomato' => [1, 180, 3], 'potato' => [1, 240, 3],
    'corn' => [2, 300, 5], 'strawberry' => [2, 420, 7], 'pumpkin' => [3, 600, 9]];

// id => [slot, name, price]; price 0 = only from the capsule machine
const SHOP = [
    'antenna'   => ['hat',   'Antenna',        40],
    'bow'       => ['hat',   'Bow',            60],
    'headset'   => ['hat',   'Headphones',     80],
    'halo'      => ['hat',   'Halo',          120],
    'bear'      => ['hat',   'Bear hood',     200],
    'crown'     => ['hat',   'Crown',         300],
    'star'      => ['hat',   'Little star',     0],
    'feather'   => ['hat',   'Feather',         0],
    'wings'     => ['back',  'Wings',           0],
    'c_red'     => ['col',   'Red fur',        80],
    'c_void'    => ['col',   'Void fur',      100],
    'c_ghost'   => ['col',   'Pale fur',      100],
    'c_sky'     => ['col',   'Sky fur',         0],
    'c_glitch'  => ['col',   'Glitch fur',    400],
    'balloon'   => ['hold',  'Balloon',        50],
    'phone'     => ['hold',  'Flip phone',     40],
    'teddy'     => ['hold',  'Teddy',          90],
    'lantern'   => ['hold',  'Lantern',         0],
    't_static'  => ['trail', 'Static trail',  150],
    't_hearts'  => ['trail', 'Heart trail',   150],
    't_feathers'=> ['trail', 'Feather trail',   0],
    'cap'       => ['hat',   'Cap',            50],
    'beanie'    => ['hat',   'Beanie',         70],
    'shades'    => ['hat',   'Shades',         90],
    'flowers'   => ['hat',   'Flower crown',  110],
    'tophat'    => ['hat',   'Top hat',       250],
    'horns'     => ['hat',   'Little horns',    0],
    'cape'      => ['back',  'Cape',          120],
    'backpack'  => ['back',  'Backpack',       80],
    'jetpack'   => ['back',  'Jetpack',         0],
    'c_mint'    => ['col',   'Mint fur',      120],
    'c_gold'    => ['col',   'Gold fur',      350],
    'c_night'   => ['col',   'Night fur',       0],
    'rod'       => ['hold',  'Fishing rod',    60],
    'umbrella'  => ['hold',  'Umbrella',      100],
    'icecream'  => ['hold',  'Ice cream',      30],
    't_bubbles' => ['trail', 'Bubble trail',  150],
    't_notes'   => ['trail', 'Music trail',   180],
    't_sparks'  => ['trail', 'Sparkle trail',   0],
    'party'     => ['hat',   'Party hat',       0],
    'mushroom'  => ['hat',   'Mushroom cap',    0],
    'ufo'       => ['hat',   'Tiny UFO',        0],
    'c_pink'    => ['col',   'Blossom fur',     0],
    'c_rainbow' => ['col',   'Rainbow fur',     0],
    'flower'    => ['hold',  'Flower',          0],
    'wand'      => ['hold',  'Star wand',       0],
    't_snow'    => ['trail', 'Snow trail',      0],
    't_flames'  => ['trail', 'Flame trail',     0],
    // price -1: only the well gives it, one wish in a thousand
    'wishhalo'  => ['hat',   'Wish halo',      -1],
    'mccap'     => ['hat',   'Crew cap',       -1],   // one order in a hundred at the Jade Arches
    'pumpkinhat'=> ['hat',   'Pumpkin hat',    -1],   // one pumpkin in thirty from the farm
    // toys to unlock: you buy them once and keep them
    'k_hearts'  => ['toy',   'Heart burst',    60],
    'k_snow'    => ['toy',   'Snow cloud',     80],
    'k_notes'   => ['toy',   'Music box',      80],
    'k_petals'  => ['toy',   'Petal storm',   120],
    'k_lanterns'=> ['toy',   'Sky lanterns',  200],
];
// the capsule machine: how rare each prize is (0 common, 1 rare, 2 epic, 3 legendary)
const CAP_TIER = ['star' => 0, 'feather' => 0, 'c_sky' => 0, 'lantern' => 0, 'party' => 0, 'flower' => 0, 't_snow' => 0,
    'horns' => 1, 't_feathers' => 1, 'mushroom' => 1, 'c_pink' => 1, 'wand' => 1,
    'wings' => 2, 'jetpack' => 2, 'c_night' => 2, 't_sparks' => 2, 'ufo' => 2,
    'c_rainbow' => 3, 't_flames' => 3];
const CAP_ODDS = [70, 24, 5.5, 0.5];    // percent for each tier
const WISH_ODDS = 1000;
const SLOTS = ['hat', 'back', 'col', 'hold', 'trail'];
const EMOTES = ['wave', 'heart', 'laugh', 'spark', 'sleep', 'dance', 'what'];
const TOUCH = ['hug', 'high5'];    // things you do to someone standing next to you
// the pond: id => [name, chance, price at the stall]
const FISH = [
    'minnow' => ['Cloud minnow', 30, 1], 'koi' => ['Koi', 16, 3], 'puffer' => ['Puffer', 11, 3], 'jelly' => ['Sky jelly', 9, 4],
    'shrimp' => ['Shrimp', 12, 2], 'crab' => ['Crab', 9, 3], 'frog' => ['Frog', 9, 2], 'shell' => ['Shell', 8, 2],
    'eel' => ['Wire eel', 7, 4], 'squid' => ['Squid', 6, 5], 'angel' => ['Angelfish', 5, 6], 'duck' => ['Rubber duck', 4, 5],
    'turtle' => ['Turtle', 3, 8], 'lobster' => ['Lobster', 2, 12], 'golden' => ['Golden carp', 2, 25], 'whale' => ['Tiny whale', 1, 40],
    'boot' => ['Old boot', 8, 1], 'disk' => ['Floppy disk', 4, 2],
];
// beetles, by how rare they are (as BUG_KINDS in js/world.js), and what the stall pays
const BUGS = [['green'], ['purple', 'ladybug', 'cucumber'],
    ['monarch', 'pond', 'giraffe_weevil', 'pillbug', 'imperial_tortoise', 'christmas', 'skull', 'bumblebee', 'golden_tiger', 'blue_longicorn'],
    ['goliath', 'bombardier', 'death_feigning', 'pondhawk', 'stag', 'sabertooth_longhorn', 'sunset_moth'],
    ['golden', 'widow', 'candycane_tiger_moth', 'mars_rhino', 'harlequin']];
const BUG_PRICE = [2, 4, 10, 30, 150];
// how often each tier turns up: diamond is one beetle in 500
function bugTier(float $r): int { return $r < 0.002 ? 4 : ($r < 0.02 ? 3 : ($r < 0.12 ? 2 : ($r < 0.42 ? 1 : 0))); }
// junk from the beetle game: the pond and the dumpster turn it up
const JUNK = ['ballpoint_pen', 'bendy_straw', 'bike_reflector', 'bottle_cap', 'broken_firework', 'burger_wrapper', 'button', 'chewed_eraser',
    'chip_bag', 'chocolate_bar', 'chocolate_wrapper', 'coffee_can', 'cracker_wrapper', 'deodorant_can', 'empty_noodle_cup', 'event_band',
    'glue_stick', 'green_army_man', 'guitar_pick', 'gum_wrapper', 'headphones_90s', 'jack_adapter', 'juicebox', 'marble', 'matchbook',
    'origami_crane', 'paperclip', 'pebble', 'pill_bottle', 'pokkiri_box', 'ramune_bottle', 'red_whistle', 'rubber_band', 'salt_pepper_packet',
    'scratch_off', 'sim_card', 'smiley_pebble', 'soda_can_tab', 'stamp', 'train_ticket_stub', 'watch_battery', 'wine_cork', 'wristband'];
// trinkets: rare finds, worth something
const TRINKETS = ['arrowhead' => 20, 'chinese_coin' => 25, 'compass' => 25, 'cult_medallion' => 40, 'd20' => 20, 'deck_of_cards' => 20,
    'engraved_lighter' => 30, 'goya_miniature' => 60, 'jade_cabbage' => 60, 'joystick' => 30, 'juex_card' => 35, 'milady_fumoku' => 50,
    'mokia' => 30, 'oriental_fan' => 35, 'police_badge' => 40, 'prism' => 30, 'remilianet_id' => 45, 'roman_dodeca' => 50,
    'stradivarius' => 80, 'thumb_drive' => 25, 'titanium_cube' => 45];
function pickFish(): string {
    $n = mt_rand(1, array_sum(array_column(FISH, 1)));
    foreach (FISH as $id => [, $w]) { $n -= $w; if ($n <= 0) return $id; }
    return 'minnow';
}
// what an item in the bag is worth: b:beetle, f:fish, j:junk, t:trinket
function price(string $k): int {
    [$t, $id] = explode(':', $k, 2) + ['', ''];
    if ($t === 'f') return FISH[$id][2] ?? 0;
    if ($t === 'j') return in_array($id, JUNK, true) ? (crc32($id) % 3) + 1 : 0;
    if ($t === 't') return TRINKETS[$id] ?? 0;
    if ($t === 'c') return CROPS[$id][2] ?? 0;
    if ($t === 'b') foreach (BUGS as $i => $ks) if (in_array($id, $ks, true)) return BUG_PRICE[$i];
    if ($t === 'w' && isCos($k)) return isset(CAP_TIER[$id]) ? COS_PRICE[CAP_TIER[$id]] : max(1, intdiv(SHOP[$id][2], 3));
    return 0;
}
// how rare a thing is, on the beetle scale: tin, brz, mth, adm, dia (jnk for junk)
function rarity(string $k): string {
    [$t, $id] = explode(':', $k, 2) + ['', ''];
    if ($t === 'b') foreach (BUGS as $i => $ks) if (in_array($id, $ks, true)) return ['tin', 'brz', 'mth', 'adm', 'dia'][$i];
    if ($t === 'f') {
        if (in_array($id, ['boot', 'disk'], true)) return 'jnk';
        $w = FISH[$id][1] ?? 0;
        return $w >= 12 ? 'tin' : ($w >= 7 ? 'brz' : ($w >= 4 ? 'mth' : ($w >= 2 ? 'adm' : 'dia')));
    }
    if ($t === 't') { $p = TRINKETS[$id] ?? 0; return $p <= 25 ? 'brz' : ($p <= 40 ? 'mth' : ($p <= 60 ? 'adm' : 'dia')); }
    return $t === 'j' ? 'jnk' : '';
}
// w:<id> is something to wear as a thing you can sell or trade; the well's halo and toys are not
const COS_PRICE = [6, 15, 45, 250];
function isCos($k): bool {
    if (!is_string($k) || !str_starts_with($k, 'w:')) return false;
    $id = substr($k, 2);
    return isset(SHOP[$id]) && SHOP[$id][2] >= 0 && SHOP[$id][0] !== 'toy';
}
// what someone could trade away: beetles and spare clothes in the bag, and what is in their wardrobe
function tradeable(array $owned, array $have): array {
    $t = array_filter($have, fn($n, $k) => $n > 0 && (str_starts_with((string)$k, 'b:') || isCos((string)$k)), ARRAY_FILTER_USE_BOTH);
    foreach ($owned as $id) if (isCos("w:$id")) $t["w:$id"] = ($t["w:$id"] ?? 0) + 1;
    return $t;
}
// hand a thing over: spares go first, the one in the wardrobe last
function takeItem(array &$x, string $k): void {
    if (($x['inv']['have'][$k] ?? 0) > 0) { if (--$x['inv']['have'][$k] <= 0) unset($x['inv']['have'][$k]); return; }
    $id = substr($k, 2);
    $x['owned'] = array_values(array_filter($x['owned'], fn($o) => $o !== $id));
    foreach ($x['wear'] as $slot => $w) if ($w === $id) unset($x['wear'][$slot]);
}
function giveItem(array &$x, string $k): void {
    $id = substr($k, 2);
    if (str_starts_with($k, 'w:') && !in_array($id, $x['owned'], true)) { $x['owned'][] = $id; $x['inv']['seen'][$k] = 1; }
    else gain($x, $k);
}

// quests: three a day out of these, and some that you only do once
// id => [what, how many, coins]
const DAILY_Q = [
    'catch'   => ['Catch beetles', 3, 15], 'fish' => ['Catch something in the pond', 3, 15], 'sell' => ['Sell things at the stall', 5, 10],
    'touch'   => ['Hug someone or give a high five', 1, 10], 'fw' => ['Set off a firework', 1, 8], 'dig' => ['Dig through the dumpster', 2, 10],
    'wish'    => ['Make a wish at the well', 1, 5], 'kick' => ['Kick the ball', 5, 8], 'toss' => ['Throw cloudballs', 5, 6],
    'party'   => ['Throw confetti or blow bubbles', 3, 5],
];
const ONCE_Q = [
    'first_bug'  => ['Catch your first beetle', 10], 'first_fish' => ['Catch your first fish', 10], 'golden' => ['Catch a diamond beetle', 100],
    'all_bugs'   => ['Catch every kind of beetle', 80], 'all_fish' => ['Catch every kind of fish', 120], 'trinket' => ['Find a trinket', 20],
    'seller'     => ['Earn 200 stars at the stall', 30], 'hugger' => ['Hug or high five 10 times', 25], 'dressed' => ['Wear something in every slot', 50],
    'whale'      => ['Catch the tiny whale', 50],
];
function questDay(array &$r, string $day): void {
    if (($r['inv']['qday'] ?? '') === $day) return;
    $ids = array_keys(DAILY_Q);
    mt_srand(crc32($r['u'] . $day)); shuffle($ids); mt_srand();
    $r['inv']['qday'] = $day; $r['inv']['q'] = array_map(fn($id) => [$id, 0, 0], array_slice($ids, 0, 3));
}
// something happened: count it, and pay out what is done
function quest(array &$r, string $day, string $ev, int $n, array &$out): void {
    questDay($r, $day);
    foreach ($r['inv']['q'] as &$q) {
        if ($q[0] !== $ev || $q[2]) continue;
        $q[1] = min(DAILY_Q[$ev][1], $q[1] + $n);
        if ($q[1] >= DAILY_Q[$ev][1]) { $q[2] = 1; earn($r, DAILY_Q[$ev][2]); $out['quest'][] = [DAILY_Q[$ev][0], DAILY_Q[$ev][2]]; }
    }
    unset($q);
    if ($ev === 'touch') $r['inv']['st']['touch'] = ($r['inv']['st']['touch'] ?? 0) + $n;
    $seen = $r['inv']['seen'] ?? []; $st = $r['inv']['st'] ?? []; $allBugs = array_merge(...BUGS);
    $done = [
        'first_bug' => array_sum($r['inv']['bugs']) > 0, 'first_fish' => array_sum($r['inv']['fish']) > 0, 'golden' => ($r['inv']['bugs'][4] ?? 0) > 0,
        'all_bugs' => !array_filter($allBugs, fn($b) => !isset($seen["b:$b"])),
        'all_fish' => !array_filter(array_keys(FISH), fn($f) => empty($r['inv']['fish'][$f])),
        'trinket' => (bool)array_filter(array_keys($seen), fn($k) => str_starts_with($k, 't:')),
        'seller' => ($st['earned'] ?? 0) >= 200, 'hugger' => ($st['touch'] ?? 0) >= 10,
        'dressed' => count(array_intersect(SLOTS, array_keys($r['wear']))) === count(SLOTS), 'whale' => !empty($r['inv']['fish']['whale']),
    ];
    foreach ($done as $id => $ok) if ($ok && empty($r['inv']['qd'][$id])) {
        $r['inv']['qd'][$id] = 1; earn($r, ONCE_Q[$id][1]); $out['quest'][] = [ONCE_Q[$id][0], ONCE_Q[$id][1]];
    }
}
// put something in the bag, and remember that you have had one
// stars you earn count as XP as well (gifts and selling bought things do not)
function earn(array &$r, int $n, bool $xp = true): void {
    $r['coins'] += $n;
    if ($xp && $n > 0) $r['lxp'] += $n;
}
function gain(array &$r, string $k): void {
    $r['inv']['have'][$k] = ($r['inv']['have'][$k] ?? 0) + 1;
    $r['inv']['seen'][$k] = 1;
}

[$in, $token, $me] = start(600, 150);
$test  = str_contains(__DIR__, '/test');

function beetleXp(string $token, string $api): ?int {
    $r = $api === 'i' ? rn('/api/beetle/user', 'Cookie: authToken=' . $token) : rn('/api/v1/me/beetle', 'Authorization: Bearer ' . $token);
    $xp = $r['data']['xp'] ?? $r['xp'] ?? null;
    return is_numeric($xp) ? (int)$xp : null;
}

$U = $me['u'];

// ── coins and wardrobe ──
function loadUser(bool $test, string $u): array {
    $q = db($test)->prepare('SELECT * FROM users WHERE u = ?'); $q->execute([$u]);
    $r = $q->fetch(PDO::FETCH_ASSOC);
    if (!$r) {
        db($test)->prepare('INSERT INTO users (u, since) VALUES (?, ?)')->execute([$u, time()]);
        $q->execute([$u]); $r = $q->fetch(PDO::FETCH_ASSOC);
    }
    $r['owned'] = json_decode($r['owned'], true) ?: [];
    $r['bug_coins'] = (int)($r['bug_coins'] ?? 0);
    $r['lxp'] = (int)($r['lxp'] ?? 0);
    $r['wear']  = json_decode($r['wear'], true) ?: [];
    $r['inv']   = (json_decode($r['inv'] ?? '{}', true) ?: []) + ['bugs' => [0, 0, 0], 'fish' => [], 'gday' => '', 'gsent' => 0, 'have' => [], 'seen' => [], 'st' => [], 'qd' => []];
    $r['inv']['bugs'] = array_pad(array_values($r['inv']['bugs']), count(BUGS), 0);
    return $r;
}
function saveUser(bool $test, array $r): void {
    db($test)->prepare('UPDATE users SET coins=?, day=?, act_coins=?, xp_coins=?, xp=?, xp_rest=?, owned=?, wear=? WHERE u=?')
        ->execute([$r['coins'], $r['day'], $r['act_coins'], $r['xp_coins'], $r['xp'], $r['xp_rest'], json_encode(array_values($r['owned'])), json_encode((object)$r['wear']), $r['u']]);
    db($test)->prepare('UPDATE users SET bug_coins=?, inv=?, lxp=? WHERE u=?')->execute([$r['bug_coins'], json_encode($r['inv']), $r['lxp'], $r['u']]);
}

// the ball rolls from where it was kicked, slows down and bounces off the fence;
// every client works out the same path from these few numbers
function fold(float $p, float $a, float $b): float {
    $l = $b - $a; $q = fmod($p - $a, 2 * $l); if ($q < 0) $q += 2 * $l;
    return $a + ($q <= $l ? $q : 2 * $l - $q);
}

// beetles wander about; every browser works out the same ones from the clock.
// Keep in step with bugAt() in js/world.js.
// more people online, more beetles: two for each, at least four and at most twelve
const BUG_N = 12, BUG_LIFE = 90;
function bugCount(int $people): int { return max(4, min(BUG_N, 2 + 2 * $people)); }
const BUG_AREAS = [[560, 1240, 930, 1460], [110, 1500, 480, 1750], [120, 1250, 460, 1450], [120, 940, 920, 1170], [1450, 940, 2270, 1170], [1450, 1240, 1830, 1750], [990, 1230, 1380, 2040], [990, 120, 1380, 520]];
function hrand(float $n): float { $v = sin($n * 12.9898) * 43758.5453; return $v - floor($v); }
function bugAt(int $k, float $t): array {
    $g = (int)floor(($t + $k * 13) / BUG_LIFE);
    $s = $g * 31 + $k * 7;
    [$x0, $y0, $x1, $y1] = BUG_AREAS[$k % count(BUG_AREAS)];
    $r = hrand($s + 3);
    return ['id' => $k . ':' . $g, 's' => $s, 'kind' => bugTier($r),
        'x' => $x0 + hrand($s + 1) * ($x1 - $x0) + 36 * sin($t * (0.3 + hrand($s + 4) * 0.4) + $s),
        'y' => $y0 + hrand($s + 2) * ($y1 - $y0) + 24 * sin($t * (0.25 + hrand($s + 5) * 0.4) + $s * 2)];
}
function ballAt(array $b, float $t): array {
    $d = (1 - exp(-BALL_K * max(0, $t - $b['t']))) / BALL_K;
    return [fold($b['x'] + $b['vx'] * $d, PEN[0], PEN[2]), fold($b['y'] + $b['vy'] * $d, PEN[1], PEN[3])];
}
// when and where the ball first rolls into a goal, or null (ballGoal() in js/world.js)
function goalOf(array $b): ?array {
    if (!$b['vx']) return null;
    $L = PEN[2] - PEN[0];
    for ($n = 0; $n < 12; $n++) {
        $d = (($b['vx'] > 0 ? PEN[2] + $n * $L : PEN[0] - $n * $L) - $b['x']) / $b['vx'];
        if ($d < 0) continue;
        if (BALL_K * $d >= 0.97) break;
        $y = fold($b['y'] + $b['vy'] * $d, PEN[1], PEN[3]);
        if ($y > GOAL[0] + 4 && $y < GOAL[1] - 4) return ['t' => $b['t'] - log(1 - BALL_K * $d) / BALL_K, 'side' => ($b['vx'] > 0) === ($n % 2 === 0) ? 'r' : 'l'];
    }
    return null;
}

// ── read, update and write the world under a lock ──
$file = tmpd() . '/' . ($test ? 'bbworld_test.json' : 'bbworld_v1.json');
$fp = fopen($file, 'c+');
if (!$fp) fail(500, 'world unavailable');
flock($fp, LOCK_EX);
$world = json_decode(stream_get_contents($fp) ?: '{}', true);
if (!is_array($world)) $world = [];
$world += ['people' => [], 'ball' => ['x' => 285, 'y' => 1350, 'vx' => 0, 'vy' => 0, 't' => 0], 'score' => [0, 0, 0, '', null], 'served' => [], 'tv' => null, 'tvq' => [], 'caught' => [], 'fx' => [], 'toss' => [], 'trades' => []];
// the map grew: nobody keeps a spot from the old one, and the ball goes to the new pitch
if (($world['map'] ?? 1) < 3) { $world['map'] = 3; $world['people'] = []; $world['ball'] = ['x' => 285, 'y' => 1350, 'vx' => 0, 'vy' => 0, 't' => 0]; }
foreach ($world['caught'] as $id => $t) if ($t < time() - BUG_LIFE * 2) unset($world['caught'][$id]);
$now = microtime(true); $sec = time(); $day = gmdate('Y-m-d');
foreach ($world['people'] as $u => $p) if (($p['t'] ?? 0) < $sec - STALE) unset($world['people'][$u]);
// a trade offer lasts two minutes, and only while both are here
$world['trades'] = array_values(array_filter($world['trades'], fn($o) => $o['t'] > $sec - 120 && isset($world['people'][$o['a']], $world['people'][$o['b']])));
$world['fx'] = array_values(array_filter($world['fx'], fn($f) => $f[2] > $now - 6));
$world['toss'] = array_values(array_filter($world['toss'], fn($f) => $f[4] > $now - 4));
$world['served'] = array_filter($world['served'], fn($t) => $t > $sec - ORDER_LEN * 3);
// a goal: a moment in the net, then the score goes up and the ball back to the middle; five wins
if (($g = goalOf($world['ball'])) && $now >= $g['t'] + 1.5) {
    $sc = &$world['score'];
    $sc[$g['side'] === 'r' ? 0 : 1]++; $sc[2]++;
    $by = $world['ball']['by'] ?? ''; $sc[3] = $world['people'][$by]['d'] ?? $by; $sc[4] = null;
    if (max($sc[0], $sc[1]) >= 5) { $sc[4] = [$sc[0], $sc[1]]; $sc[0] = $sc[1] = 0; }
    unset($sc);
    $world['ball'] = ['x' => 285, 'y' => 1350, 'vx' => 0, 'vy' => 0, 't' => $now];
}
// the screen moves on to the next video once this one has run out
function tvNext(array &$world, float $now): void {
    $n = array_shift($world['tvq']);
    $world['tv'] = $n ? ['v' => $n['v'], 's' => $now, 'by' => $n['by']] : null;
}
if ($world['tv'] && $now - $world['tv']['s'] > (isset($world['tv']['d']) ? $world['tv']['d'] + 2 : 7200)) tvNext($world, $now);

$out = ['me' => $U];
$prev = $world['people'][$U] ?? null;
$user = null;
$getUser = function () use (&$user, $test, $U) { return $user ??= loadUser($test, $U); };
$dirty = false;

if (!empty($in['leave'])) unset($world['people'][$U]);
else {
    $x = isset($in['x']) ? max(0, min(W, (int)$in['x'])) : ($prev['x'] ?? mt_rand(1110, 1260));
    $y = isset($in['y']) ? max(0, min(H, (int)$in['y'])) : ($prev['y'] ?? mt_rand(1100, 1170));
    $p = ['d' => $me['d'], 'x' => $x, 'y' => $y, 't' => $sec,
          'e' => $prev['e'] ?? null, 'w' => $prev['w'] ?? null, 'c' => $prev['c'] ?? null, 'l' => $prev['l'] ?? null,
          'act' => $prev['act'] ?? 0, 'xa' => $prev['xa'] ?? 0, 'xf' => $prev['xf'] ?? 0,
          'in' => array_values(array_filter($prev['in'] ?? [], fn($i) => $i[2] > $now - 10))];
    foreach (['wish', 'fish', 'fw', 'tz', 'gift', 'touch', 'dig', 'party', 'st', 'stt', 'slot'] as $k) if (isset($prev[$k])) $p[$k] = $prev[$k];
    // where you can really be: the page says where you walk to, but nobody walks
    // faster than this, so catching, fishing and the rest count from here
    if (isset($prev['rx'])) {
        // the page also says where the cat is right now (cx, cy); without it, where it walks to
        $sx = isset($in['cx']) ? max(0, min(W, (int)$in['cx'])) : $x; $sy = isset($in['cy']) ? max(0, min(H, (int)$in['cy'])) : $y;
        $dx = $sx - $prev['rx']; $dy = $sy - $prev['ry']; $dd = hypot($dx, $dy);
        $k = min(1, (WALK * max(0, $now - $prev['rt']) + 60) / max(1, $dd));
        $rx = $prev['rx'] + $dx * $k; $ry = $prev['ry'] + $dy * $k;
    } else { $rx = isset($in['cx']) ? max(0, min(W, (int)$in['cx'])) : $x; $ry = isset($in['cy']) ? max(0, min(H, (int)$in['cy'])) : $y; }
    $p['rx'] = round($rx, 1); $p['ry'] = round($ry, 1); $p['rt'] = $now;

    // just arrived: coins and clothes from the database, and the daily bonus
    if (!$prev || $p['c'] === null || $p['w'] === null || $p['l'] === null) {
        $getUser(); $r = &$user;
        if ($r['day'] !== $day) {
            $r['day'] = $day; $r['act_coins'] = 0; $r['xp_coins'] = 0; $r['bug_coins'] = 0;
            earn($r, DAILY); $out['bonus'] = DAILY; $dirty = true;
        }
        $p['c'] = $r['coins']; $p['l'] = $r['lxp']; $p['w'] = $r['wear']; $p['st'] = (string)($r['status'] ?? '');
    }

    // a coin for each minute spent here; past the first 30 of the day each takes a minute longer, ten at most
    if ($prev) {
        $p['act'] += min(5, $sec - ($prev['t'] ?? $sec));
        $need = 60 * min(10, 1 + max(0, ($p['actn'] ?? 0) - ACT_FAST + 1));
        if (($p['actd'] ?? '') !== $day) { $p['actd'] = $day; $p['actn'] = 0; $need = 60; }
        if ($p['act'] >= $need) {
            $p['act'] -= $need;
            $getUser(); $r = &$user;
            if ($r['day'] !== $day) { $r['day'] = $day; $r['act_coins'] = 0; $r['xp_coins'] = 0; $r['bug_coins'] = 0; }
            $r['act_coins']++; $p['actn'] = $r['act_coins']; earn($r, 1); $dirty = true;
        }
    }

    // beetle game XP turns into coins, checked every five minutes (or after the lab)
    if ($sec - $p['xa'] > 300 || (!empty($in['xp']) && $sec - $p['xf'] > 30)) {
        if (!empty($in['xp'])) $p['xf'] = $sec;
        $p['xa'] = $sec;
        $xp = beetleXp($token, $me['api']);
        if ($xp !== null) {
            $getUser(); $r = &$user;
            if ($r['xp'] !== null && $xp > $r['xp']) {
                if ($r['day'] !== $day) { $r['day'] = $day; $r['act_coins'] = 0; $r['xp_coins'] = 0; $r['bug_coins'] = 0; }
                $gain = intdiv($xp - $r['xp'] + $r['xp_rest'], XP_PER_COIN);
                $r['xp_rest'] = ($xp - $r['xp'] + $r['xp_rest']) % XP_PER_COIN;
                $gain = max(0, min($gain, XP_CAP - $r['xp_coins']));
                if ($gain) { earn($r, $gain); $r['xp_coins'] += $gain; $out['xpcoins'] = $gain; }
            }
            if ($r['xp'] !== $xp) { $r['xp'] = $xp; $dirty = true; }
        }
    }

    // shop: buy and wear
    if (isset($in['buy']) && is_string($in['buy']) && isset(SHOP[$in['buy']]) && SHOP[$in['buy']][2] > 0) {
        $getUser(); $r = &$user; $id = $in['buy'];
        if (in_array($id, $r['owned'], true)) $out['shop'] = 'owned';
        elseif ($r['coins'] < SHOP[$id][2]) $out['shop'] = 'poor';
        else {
            $r['coins'] -= SHOP[$id][2]; $r['owned'][] = $id;
            if (SHOP[$id][0] !== 'toy') $r['wear'][SHOP[$id][0]] = $id;
            $dirty = true; $out['shop'] = 'bought';
        }
    }
    if (isset($in['wear']) && is_array($in['wear'])) {
        $getUser(); $r = &$user;
        foreach (SLOTS as $slot) {
            if (!array_key_exists($slot, $in['wear'])) continue;
            $id = $in['wear'][$slot];
            if ($id === null || $id === '') unset($r['wear'][$slot]);
            elseif (is_string($id) && isset(SHOP[$id]) && in_array($id, $r['owned'], true) && SHOP[$id][0] === $slot) $r['wear'][$slot] = $id;
        }
        $dirty = true;
    }
    if (!empty($in['shopinfo'])) {
        $getUser(); $r = &$user;
        $out['catalog'] = array_map(fn($id, $s) => ['id' => $id, 'slot' => $s[0], 'name' => $s[1], 'price' => $s[2], 'tier' => CAP_TIER[$id] ?? null], array_keys(SHOP), SHOP);
        $out['capsule_price'] = CAPSULE;
        $out['owned'] = $r['owned'];
    }
    // the capsule machine: something you do not have yet, at random
    if (!empty($in['capsule'])) {
        $getUser(); $r = &$user;
        if ($r['coins'] < CAPSULE) $out['capsule'] = 'poor';
        else {
            // first how rare, then which one of that kind; one you have gives a few stars back
            $roll = mt_rand(0, 99999) / 1000; $tier = 0;
            for ($i = count(CAP_ODDS) - 1; $i > 0; $i--) { if ($roll < array_sum(array_slice(CAP_ODDS, $i))) { $tier = $i; break; } }
            $pool = array_keys(array_filter(CAP_TIER, fn($v) => $v === $tier));
            $id = $pool[mt_rand(0, count($pool) - 1)];
            $r['coins'] -= CAPSULE; $dirty = true;
            if (in_array($id, $r['owned'], true)) { gain($r, "w:$id"); $out['capsule_dup'] = price("w:$id"); }
            else { $r['owned'][] = $id; $r['wear'][SHOP[$id][0]] = $id; }
            $out['capsule'] = $id; $out['capsule_name'] = SHOP[$id][1]; $out['capsule_tier'] = $tier;
        }
    }
    // a coin into the well, at most one every few seconds
    if (!empty($in['wish'])) {
        $getUser(); $r = &$user;
        if ($sec - ($prev['wish'] ?? 0) < 4) $out['wish'] = 'wait';
        elseif ($r['coins'] < WISH) $out['wish'] = 'poor';
        else {
            $r['coins'] -= WISH; $dirty = true; $out['wish'] = 'ok'; $p['wish'] = $sec; quest($r, $day, 'wish', 1, $out);
            if (mt_rand(1, WISH_ODDS) === 1 && !in_array('wishhalo', $r['owned'], true)) {
                $r['owned'][] = 'wishhalo'; $r['wear']['hat'] = 'wishhalo'; $out['wishgift'] = 'wishhalo';
            }
        }
    }
    // catching a beetle: it has to be there, close to you, and nobody got it first
    if (isset($in['catch']) && is_string($in['catch']) && preg_match('/^(\d+):(\d+)$/', $in['catch'], $m) && (int)$m[1] < bugCount(count($world['people']))) {
        $b = bugAt((int)$m[1], $now);
        if ($b['id'] !== $in['catch'] || isset($world['caught'][$b['id']])) $out['caught'] = 'gone';
        elseif (hypot($b['x'] - $rx, $b['y'] - $ry) > 80) $out['caught'] = 'far';
        else {
            $world['caught'][$b['id']] = $sec;
            $getUser(); $r = &$user;
            $kind = BUGS[$b['kind']][(int)floor(hrand($b['s'] + 9) * count(BUGS[$b['kind']]))];
            gain($r, "b:$kind"); $r['inv']['bugs'][$b['kind']]++; $r['lxp']++; $dirty = true;
            $out['caught'] = $b['id']; $out['bug'] = $kind;
            quest($r, $day, 'catch', 1, $out);
        }
    }
    // the pond: a cast takes a few seconds, then something bites (or not)
    if (!empty($in['fish'])) {
        if (hypot($rx - POND[0], $ry - POND[1]) > 240) $out['fish'] = 'far';
        elseif ($sec - ($p['fish'] ?? 0) < 8) $out['fish'] = 'wait';
        else {
            $p['fish'] = $sec; $roll = mt_rand(1, 100);
            if ($roll <= 22) $out['fish'] = 'none';
            elseif ($roll <= 36) {
                $getUser(); $r = &$user; $j = JUNK[mt_rand(0, count(JUNK) - 1)];
                gain($r, "j:$j"); $r['lxp']++; $dirty = true; $out['fish'] = 'junk'; $out['junk'] = $j;
                quest($r, $day, 'fish', 1, $out);
            } else {
                $getUser(); $r = &$user; $id = pickFish();
                $r['inv']['fish'][$id] = ($r['inv']['fish'][$id] ?? 0) + 1; gain($r, "f:$id"); $r['lxp']++; $dirty = true;
                $out['fish'] = $id; $out['fish_name'] = FISH[$id][0];
                quest($r, $day, 'fish', 1, $out);
            }
        }
    }
    // the dumpster in the back alley: mostly junk, now and then a trinket
    if (!empty($in['dig'])) {
        if (hypot($rx - BIN[0], $ry - BIN[1]) > 110) $out['dig'] = 'far';
        elseif ($sec - ($p['dig'] ?? 0) < RUMMAGE) $out['dig'] = 'wait';
        else {
            $p['dig'] = $sec; $getUser(); $r = &$user; $dirty = true;
            if (mt_rand(1, 100) <= 12) { $t = array_rand(TRINKETS); $k = "t:$t"; }
            else $k = 'j:' . JUNK[mt_rand(0, count(JUNK) - 1)];
            gain($r, $k); $r['lxp']++; $out['dig'] = $k;
            quest($r, $day, 'dig', 1, $out);
        }
        if ($out['dig'] === 'wait') $out['dig_in'] = RUMMAGE - ($sec - $p['dig']);
    }
    // the stall buys what is in your bag: one kind, or all of a sort at once
    if (isset($in['sell']) && is_array($in['sell'])) {
        $getUser(); $r = &$user; $have = &$r['inv']['have'];
        if (hypot($rx - STALL[0], $ry - STALL[1]) > 130) $out['sell'] = 'far';
        else {
            $keys = [];
            if (isset($in['sell']['k']) && is_string($in['sell']['k']) && !empty($have[$in['sell']['k']]))
                $keys[$in['sell']['k']] = max(1, min($have[$in['sell']['k']], (int)($in['sell']['n'] ?? 1)));
            elseif (isset($in['sell']['all']) && in_array($in['sell']['all'], ['b', 'f', 'j', 'c'], true))
                foreach ($have as $k => $n) if (str_starts_with($k, $in['sell']['all'] . ':')) $keys[$k] = $n;
            $got = 0; $cnt = 0; $lx = 0;
            foreach ($keys as $k => $n) {
                $pr = price((string)$k);
                if ($pr <= 0) continue;
                $have[$k] -= $n; if ($have[$k] <= 0) unset($have[$k]);
                $got += $pr * $n; $cnt += $n;
                if (!str_starts_with((string)$k, 'w:')) $lx += $pr * $n;   // clothes you can buy give no XP
            }
            if ($cnt) {
                earn($r, $got, false); $r['lxp'] += $lx; $r['inv']['st']['earned'] = ($r['inv']['st']['earned'] ?? 0) + $got; $dirty = true;
                $out['sell'] = ['n' => $cnt, 'coins' => $got];
                quest($r, $day, 'sell', $cnt, $out);
            } else $out['sell'] = 'none';
        }
        unset($have);
    }
    // the slot machines: four reels of beetles, three rows, seven lines
    if (isset($in['slot']) && is_array($in['slot'])) {
        $getUser(); $r = &$user;
        $bet = (int)($in['slot']['bet'] ?? 0);
        $inSlots = $rx >= SLOT_ROOM[0] && $rx <= SLOT_ROOM[2] && $ry >= SLOT_ROOM[1] && $ry <= SLOT_ROOM[3];
        if (!$inSlots) $out['slot'] = 'far';
        elseif (!in_array($bet, SLOT_BETS, true)) $out['slot'] = 'bad';
        elseif ($now - ($p['slot'] ?? 0) < 2.2) $out['slot'] = 'wait';
        elseif ($r['coins'] < $bet) $out['slot'] = 'poor';
        else {
            $p['slot'] = $now; $r['coins'] -= $bet;
            $grid = [];
            for ($c = 0; $c < 4; $c++) for ($row = 0; $row < 3; $row++) {
                $n = mt_rand(1, array_sum(SLOT_SYMS));
                foreach (SLOT_SYMS as $k => $w) if (($n -= $w) <= 0) { $grid[$c][$row] = $k; break; }
            }
            $fifths = 0; $lines = [];
            foreach (SLOT_LINES as $li => $L) {
                $seq = array_map(fn($c) => $grid[$c][$L[$c]], [0, 1, 2, 3]);
                $base = 'golden'; foreach ($seq as $k) if ($k !== 'golden') { $base = $k; break; }
                $run = 0; foreach ($seq as $k) { if ($k === $base || $k === 'golden') $run++; else break; }
                $wild = 0; foreach ($seq as $k) { if ($k === 'golden') $wild++; else break; }
                $pay = $run >= 3 ? SLOT_PAY[$base][$run - 3] : 0; $sym = $base; $n = $run;
                if ($wild >= 3 && SLOT_PAY['golden'][$wild - 3] > $pay) { $pay = SLOT_PAY['golden'][$wild - 3]; $sym = 'golden'; $n = $wild; }
                if ($pay) { $fifths += $pay; $lines[] = [$li, $n, $sym]; }
            }
            $win = $fifths ? max(1, (int)round($bet * $fifths / 5)) : 0;
            $reels = [$grid[0][1], $grid[1][1], $grid[2][1], $grid[3][1]];
            // only what you win on top of the bet counts as XP
            earn($r, $win, false); if ($win > $bet) $r['lxp'] += $win - $bet;
            $dirty = true; $out['slot'] = ['grid' => $grid, 'reels' => $reels, 'lines' => $lines, 'win' => $win, 'bet' => $bet];
        }
    }
    // confetti and bubbles: free, everyone sees them
    if (isset($in['party']) && is_array($in['party']) && is_string($in['party']['k'] ?? null)
        && (in_array($in['party']['k'], ['confetti', 'bubbles'], true) || (isset(SHOP['k_' . $in['party']['k']]) && in_array('k_' . $in['party']['k'], $getUser()['owned'] ?? [], true)))) {
        if ($now - ($p['party'] ?? 0) >= CONFETTI) {
            $p['party'] = $now;
            $world['fx'][] = [max(0, min(W, (int)($in['party']['x'] ?? $x))), max(0, min(H, (int)($in['party']['y'] ?? $y))), $now, mt_rand(0, 359), $U, $in['party']['k']];
            $world['fx'] = array_slice($world['fx'], -16);
            $getUser(); $r = &$user; $dirty = true; quest($r, $day, 'party', 1, $out);
        }
    }
    // what you own changed: the client keeps its list in step
    if (isset($out['shop']) || isset($out['capsule']) || isset($out['wishgift']) || isset($out['mccap']) || isset($out['pumpkinhat'])) $out['owned'] = $user['owned'] ?? [];
    // your quests for today, and the ones you do once
    if (!empty($in['quests'])) {
        $getUser(); $r = &$user;
        if (($r['inv']['qday'] ?? '') !== $day) { questDay($r, $day); $dirty = true; }
        $out['quests'] = ['daily' => array_map(fn($q) => ['name' => DAILY_Q[$q[0]][0], 'n' => $q[1], 'of' => DAILY_Q[$q[0]][1], 'coins' => DAILY_Q[$q[0]][2], 'done' => (bool)$q[2]], $r['inv']['q']),
            'once' => array_map(fn($id, $q) => ['name' => $q[0], 'coins' => $q[1], 'done' => !empty($r['inv']['qd'][$id])], array_keys(ONCE_Q), ONCE_Q)];
    }
    // a firework over the plaza: everyone sees it go up
    if (isset($in['fw']) && is_array($in['fw'])) {
        $getUser(); $r = &$user;
        if ($sec - ($p['fw'] ?? 0) < 3) $out['fw'] = 'wait';
        elseif ($r['coins'] < FIREWORK) $out['fw'] = 'poor';
        else {
            $r['coins'] -= FIREWORK; $dirty = true; $p['fw'] = $sec; $out['fw'] = 'ok';
            $world['fx'][] = [max(0, min(W, (int)($in['fw']['x'] ?? $x))), max(0, min(H, (int)($in['fw']['y'] ?? $y))), $now, mt_rand(0, 359), $U, 'fw'];
            $world['fx'] = array_slice($world['fx'], -16);
            quest($r, $day, 'fw', 1, $out);
        }
    }
    // a cloudball thrown from where you stand
    if (isset($in['toss']) && is_array($in['toss']) && $now - ($p['tz'] ?? 0) > 0.8) {
        $tx = (int)($in['toss']['x'] ?? 0); $ty = (int)($in['toss']['y'] ?? 0);
        $d = hypot($tx - $x, $ty - $y);
        if ($d > 0) { $k = min(1, 420 / $d); $tx = (int)($x + ($tx - $x) * $k); $ty = (int)($y + ($ty - $y) * $k); }
        $world['toss'][] = [$x, $y - 20, $tx, $ty, $now, $U];
        $world['toss'] = array_slice($world['toss'], -20);
        $p['tz'] = $now;
        $getUser(); $r = &$user; $dirty = true; quest($r, $day, 'toss', 1, $out);
    }
    // a hug or a high five: you have to stand next to them
    if (isset($in['touch']) && is_array($in['touch']) && in_array($in['touch']['k'] ?? '', TOUCH, true)) {
        $to = (string)($in['touch']['to'] ?? ''); $o = $world['people'][$to] ?? null;
        if (!$o || $to === $U) $out['touch'] = 'gone';
        elseif (hypot(($o['rx'] ?? $o['x']) - $rx, ($o['ry'] ?? $o['y']) - $ry) > 90) $out['touch'] = 'far';
        elseif ($now - ($p['touch'] ?? 0) < 2) $out['touch'] = 'wait';
        else {
            $k = $in['touch']['k']; $p['touch'] = $now; $p['e'] = [$k, $now]; $out['touch'] = 'ok';
            $world['people'][$to]['e'] = [$k, $now];
            $world['people'][$to]['in'][] = [$k, $me['d'], $now, $U];
            $getUser(); $r = &$user; $dirty = true; quest($r, $day, 'touch', 1, $out);
        }
    }
    // giving coins to someone who is here
    if (isset($in['gift']) && is_array($in['gift'])) {
        $to = (string)($in['gift']['to'] ?? ''); $n = (int)($in['gift']['n'] ?? 0);
        $getUser(); $r = &$user;
        if ($r['inv']['gday'] !== $day) { $r['inv']['gday'] = $day; $r['inv']['gsent'] = 0; }
        if (!isset($world['people'][$to]) || $to === $U) $out['gift'] = 'gone';
        elseif ($n < 1 || $n > 100) $out['gift'] = 'bad';
        elseif ($sec - ($p['gift'] ?? 0) < 4) $out['gift'] = 'wait';
        elseif ($r['coins'] < $n) $out['gift'] = 'poor';
        elseif ($r['inv']['gsent'] + $n > GIFT_CAP) $out['gift'] = 'cap';
        else {
            $r['coins'] -= $n; $r['inv']['gsent'] += $n; $dirty = true; $p['gift'] = $sec;
            loadUser($test, $to);       // makes sure they have a row
            db($test)->prepare('UPDATE users SET coins = coins + ? WHERE u = ?')->execute([$n, $to]);
            if (isset($world['people'][$to]['c'])) $world['people'][$to]['c'] += $n;
            $world['people'][$to]['in'][] = ['gift', $me['d'], $now, $U, $n];
            $world['people'][$to]['e'] = ['gift', $now]; $p['e'] = ['gift', $now];
            $out['gift'] = 'ok';
        }
    }
    // someone's card: what they have in here
    if (isset($in['prof']) && is_string($in['prof']) && preg_match('/^[A-Za-z0-9_.-]{1,40}$/', $in['prof'])) {
        $q = db($test)->prepare('SELECT * FROM users WHERE u = ?'); $q->execute([$in['prof']]);
        $o = $q->fetch(PDO::FETCH_ASSOC);
        if ($o) {
            $inv = json_decode($o['inv'] ?? '{}', true) ?: [];
            $out['prof'] = ['u' => $in['prof'], 'coins' => (int)$o['coins'], 'items' => count(json_decode($o['owned'], true) ?: []),
                'wear' => (object)(json_decode($o['wear'], true) ?: []), 'bugs' => array_sum($inv['bugs'] ?? []),
                'fish' => array_sum($inv['fish'] ?? []), 'quests' => count($inv['qd'] ?? []), 'since' => (int)$o['since'], 'status' => (string)($o['status'] ?? ''), 'lxp' => (int)($o['lxp'] ?? 0), 'here' => isset($world['people'][$in['prof']]),
                'beetles' => (object)tradeable(json_decode($o['owned'], true) ?: [], $inv['have'] ?? [])];
        } else $out['prof'] = ['u' => $in['prof'], 'none' => true, 'here' => false];
    }
    // trading beetles: an offer to someone who is here, and they take it or not
    $isBug = fn($k) => $k === null || isCos($k) || (is_string($k) && str_starts_with($k, 'b:') && in_array(substr($k, 2), array_merge(...BUGS), true));
    if (isset($in['trade']) && is_array($in['trade'])) {
        $to = (string)($in['trade']['to'] ?? ''); $give = $in['trade']['give'] ?? null; $want = $in['trade']['want'] ?? null;
        $getUser();
        if (!$isBug($give) || !$isBug($want) || (!$give && !$want)) $out['trade'] = 'bad';
        elseif ($to === $U || !isset($world['people'][$to])) $out['trade'] = 'gone';
        elseif ($give && (tradeable($user['owned'], $user['inv']['have'])[$give] ?? 0) < 1) $out['trade'] = 'nohave';
        else {
            $world['trades'] = array_values(array_filter($world['trades'], fn($o) => !($o['a'] === $U && $o['b'] === $to)));
            if (count(array_filter($world['trades'], fn($o) => $o['a'] === $U)) >= 3) $out['trade'] = 'many';
            else {
                $world['tradeid'] = ($world['tradeid'] ?? 0) + 1;
                $world['trades'][] = ['id' => $world['tradeid'], 'a' => $U, 'ad' => $me['d'], 'b' => $to, 'give' => $give, 'want' => $want, 't' => $sec];
                $out['trade'] = 'sent';
            }
        }
    }
    if (isset($in['tradeans']) && is_array($in['tradeans'])) {
        $id = (int)($in['tradeans']['id'] ?? 0);
        $i = array_search($id, array_column($world['trades'], 'id'), true);
        $o = $i === false ? null : $world['trades'][$i];
        if (!$o || ($o['a'] !== $U && $o['b'] !== $U)) $out['trade'] = 'gone';
        else {
            array_splice($world['trades'], $i, 1);
            $tell = function (string $k) use (&$world, $o, $me, $now, $U) { if (isset($world['people'][$o['a']])) $world['people'][$o['a']]['in'][] = [$k, $me['d'], $now, $U, 0]; };
            if ($o['a'] === $U) $out['trade'] = 'withdrawn';
            elseif (empty($in['tradeans']['ok'])) { $tell('tradeno'); $out['trade'] = 'declined'; }
            else {
                // both still have what they offered: swap, and save them both while the world is locked
                $getUser(); $r = &$user; $a = loadUser($test, $o['a']);
                $has = fn(array $x, ?string $k) => !$k || (tradeable($x['owned'], $x['inv']['have'])[$k] ?? 0) > 0;
                if (!$has($a, $o['give']) || !$has($r, $o['want'])) { $tell('tradeno'); $out['trade'] = 'nohave'; }
                else {
                    if ($o['give']) { takeItem($a, $o['give']); giveItem($r, $o['give']); }
                    if ($o['want']) { takeItem($r, $o['want']); giveItem($a, $o['want']); }
                    saveUser($test, $a); $dirty = true;
                    if (isset($world['people'][$o['a']])) $world['people'][$o['a']]['w'] = $a['wear'];
                    $tell('tradeok'); $out['trade'] = 'done';
                }
            }
        }
    }
    // your bag
    if (!empty($in['inv'])) {
        $getUser(); $r = &$user;
        $out['inv'] = ['owned' => $r['owned'], 'bugs' => $r['inv']['bugs'], 'fish' => (object)$r['inv']['fish'],
            'fishnames' => array_map(fn($f) => $f[0], FISH), 'have' => (object)$r['inv']['have'], 'seen' => array_keys($r['inv']['seen']),
            'trade' => (object)tradeable($r['owned'], $r['inv']['have']),
            'rar' => (object)array_combine(array_keys($r['inv']['have']), array_map(fn($k) => rarity((string)$k), array_keys($r['inv']['have']))),
            'fishrar' => (object)array_combine(array_keys(FISH), array_map(fn($id) => rarity("f:$id"), array_keys(FISH))),
            'prices' => (object)array_combine(array_keys($r['inv']['have']), array_map('price', array_map('strval', array_keys($r['inv']['have']))))];
    }
    if ($user) { $p['c'] = $user['coins']; $p['w'] = $user['wear']; }

    // a short status line everyone sees on your card and under your name
    if (isset($in['status']) && is_string($in['status']) && $sec - ($p['stt'] ?? 0) >= 3) {
        $st = trim(preg_replace('/[\p{C}\s]+/u', ' ', $in['status']) ?? '');
        $st = mb_substr($st, 0, 60);
        $p['st'] = $st; $p['stt'] = $sec; $out['status'] = $st;
        db($test)->prepare('UPDATE users SET status = ? WHERE u = ?')->execute([$st, $U]);
    }
    if (isset($in['emote']) && in_array($in['emote'], EMOTES, true)) $p['e'] = [$in['emote'], $now];
    // holding something up for everyone to see; it stays yours
    if (isset($in['show']) && is_string($in['show']) && preg_match('/^[bcfjtw]:[a-z0-9_]{1,40}$/', $in['show'])) {
        $getUser();
        $k = $in['show'];
        if ($user && (($user['inv']['have'][$k] ?? 0) > 0 || (str_starts_with($k, 'w:') && in_array(substr($k, 2), $user['owned'], true)))) $p['e'] = ["show:$k", $now];
    }
    // the kitchen: buy from the pantry (crops from your bag go in first), throw away, serve a plate
    $inJade = $rx >= JADE[0] && $rx <= JADE[2] && $ry >= JADE[1] && $ry <= JADE[3];
    if (isset($in['kbuy']) || isset($in['ktrash']) || isset($in['serve']) || !empty($in['klook'])) {
        $getUser(); $r = &$user; $kit = $r['inv']['kit'] ?? [];
        if (isset($in['kbuy']) && is_string($in['kbuy']) && isset(PANTRY[$in['kbuy']])) {
            $k = $in['kbuy'];
            if (!$inJade) $out['kbuy'] = 'far';
            elseif (array_sum($kit) >= 12) $out['kbuy'] = 'full';
            elseif (!empty($r['inv']['have']["c:$k"])) { takeItem($r, "c:$k"); $kit[$k] = ($kit[$k] ?? 0) + 1; $out['kbuy'] = [$k, 0]; }
            elseif ($r['coins'] < PANTRY[$k]) $out['kbuy'] = 'poor';
            else { $r['coins'] -= PANTRY[$k]; $kit[$k] = ($kit[$k] ?? 0) + 1; $out['kbuy'] = [$k, PANTRY[$k]]; }
        }
        if (isset($in['ktrash']) && is_array($in['ktrash'])) foreach (array_slice($in['ktrash'], 0, 8) as $k)
            if (is_string($k) && !empty($kit[$k])) { if (--$kit[$k] <= 0) unset($kit[$k]); }
        if (isset($in['serve']) && is_array($in['serve'])) {
            $o = (string)($in['serve']['o'] ?? ''); $dish = (string)($in['serve']['d'] ?? '');
            [$i] = explode(':', $o) + ['']; $i = (int)$i;
            $ord = $i >= 0 && $i < ORDER_N ? orderAt($i, $now) : null;
            $need = array_count_values(DISHES[$dish][0] ?? []);
            if (!$inJade) $out['serve'] = 'far';
            elseif (!$ord || $ord['id'] !== $o || $ord['d'] !== $dish) $out['serve'] = 'late';
            elseif (isset($world['served'][$o])) $out['serve'] = 'taken';
            elseif (array_filter($need, fn($n, $k) => ($kit[$k] ?? 0) < $n, ARRAY_FILTER_USE_BOTH)) $out['serve'] = 'missing';
            else {
                foreach ($need as $k => $n) { $kit[$k] -= $n; if ($kit[$k] <= 0) unset($kit[$k]); }
                $pay = DISHES[$dish][1]; earn($r, $pay); $world['served'][$o] = $sec;
                $out['serve'] = [$dish, $pay];
                if (!in_array('mccap', $r['owned'] ?? [], true) && mt_rand(1, 100) === 1) { $r['owned'][] = 'mccap'; $out['mccap'] = 1; }
            }
        }
        $r['inv']['kit'] = $kit; $dirty = true;
        $out['kit'] = (object)$kit; $p['c'] = $r['coins'];
    }
    // the farm: eight plots of your own; plant a seed, come back when it has grown
    if (isset($in['farm']) && is_array($in['farm'])) {
        $getUser(); $r = &$user;
        $f = array_pad(array_slice($r['inv']['farm'] ?? [], 0, PLOTS), PLOTS, null);
        $i = (int)($in['farm']['p'] ?? -1); $c = $in['farm']['c'] ?? null;
        $inFarm = $rx >= FARM[0] && $rx <= FARM[2] && $ry >= FARM[1] && $ry <= FARM[3];
        if ($i >= 0 && $i < PLOTS && !$inFarm) $out['farmerr'] = 'Walk into the farm first.';
        elseif ($i >= 0 && $i < PLOTS && is_string($c) && isset(CROPS[$c]) && !$f[$i]) {
            if ($r['coins'] < CROPS[$c][0]) $out['farmerr'] = 'Not enough stars for that seed.';
            else { $r['coins'] -= CROPS[$c][0]; $f[$i] = [$c, $sec]; }
        } elseif ($i >= 0 && $i < PLOTS && !empty($in['farm']['h']) && $f[$i] && $sec - $f[$i][1] >= CROPS[$f[$i][0]][1]) {
            gain($r, 'c:' . $f[$i][0]); $r['lxp']++; $out['harvest'] = $f[$i][0];
            if ($f[$i][0] === 'pumpkin' && !in_array('pumpkinhat', $r['owned'] ?? [], true) && mt_rand(1, 30) === 1) { $r['owned'][] = 'pumpkinhat'; $out['pumpkinhat'] = 1; }
            $f[$i] = null;
        }
        $r['inv']['farm'] = $f; $dirty = true;
        $out['farm'] = $f; $p['c'] = $r['coins'];
    }
    // the library whiteboard: everyone draws on it together; the strokes live in their own file
    if (isset($in['wb']) && is_array($in['wb'])) {
        $wf = tmpd() . '/' . ($test ? 'bbwb_test.json' : 'bbwb_v1.json');
        $wp = fopen($wf, 'c+');
        if ($wp) {
            flock($wp, LOCK_EX);
            $wb = json_decode(stream_get_contents($wp) ?: '{}', true);
            if (!is_array($wb)) $wb = [];
            $wb += ['n' => 0, 's' => [], 'clr' => 0];
            $inLib = $rx >= LIBRARY[0] && $rx <= LIBRARY[2] && $ry >= LIBRARY[1] && $ry <= LIBRARY[3];
            $put = false;
            if ($inLib && !empty($in['wb']['clr'])) { $wb['s'] = []; $wb['clr'] = ++$wb['n']; $put = true; }
            foreach ($inLib && is_array($in['wb']['s'] ?? null) ? array_slice($in['wb']['s'], 0, 12) : [] as $st) {
                if (!is_array($st) || count($st) !== 3 || !is_array($st[2])) continue;
                $pts = [];
                foreach (array_slice(array_values($st[2]), 0, 240) as $i => $v) $pts[] = max(0, min($i % 2 ? WB_H : WB_W, (int)$v));
                if (count($pts) < 2 || count($pts) % 2) continue;
                $wb['s'][] = [++$wb['n'], max(0, min(7, (int)$st[0])), max(1, min(4, (int)$st[1])), $pts];
                $put = true;
            }
            if ($put) {
                $wb['s'] = array_slice($wb['s'], -WB_KEEP);
                ftruncate($wp, 0); rewind($wp); fwrite($wp, json_encode($wb)); fflush($wp);
            }
            flock($wp, LOCK_UN); fclose($wp);
            // only what is new since the last look, unless the board was wiped or the gap is too old
            $since = (int)($in['wb']['since'] ?? 0);
            $first = $wb['s'][0][0] ?? $wb['n'] + 1;
            $full = $since < $wb['clr'] || $since > $wb['n'] || ($since < $first - 1 && $since > 0) || $since === 0;
            $out['wb'] = ['n' => $wb['n'], 'full' => $full ? 1 : 0, 's' => array_values(array_filter($wb['s'], fn($x) => $full || $x[0] > $since))];
        }
    }
    $p['sk'] = !empty($in['sk']) ? 1 : 0;         // on the skateboard
    $p['si'] = !empty($in['si']) && empty($in['sk']) ? 1 : 0;   // sitting down
    $mine = array_filter($p['in'], fn($i) => $i[2] > $now - 8);
    if ($mine) $out['in'] = array_values(array_map(fn($i) => [$i[0], $i[1], round($now - $i[2], 2), $i[4] ?? 0], $mine));

    // kicking the ball: only from close by, and not harder than a good kick
    if (isset($in['kick']) && is_array($in['kick'])) {
        [$bx, $by] = ballAt($world['ball'], $now);
        $vx = (float)($in['kick']['vx'] ?? 0); $vy = (float)($in['kick']['vy'] ?? 0);
        $v = hypot($vx, $vy);
        if ($v > 900) { $vx *= 900 / $v; $vy *= 900 / $v; }
        $g = goalOf($world['ball']);
        if (hypot($bx - $rx, $by - $ry) < 110 && $v > 0 && $now - ($world['ball']['t'] ?? 0) > 0.25 && !($g && $now >= $g['t'])) {
            $world['ball'] = ['x' => $bx, 'y' => $by, 'vx' => $vx, 'vy' => $vy, 't' => $now, 'by' => $U];
            $getUser(); $r = &$user; $dirty = true; quest($r, $day, 'kick', 1, $out);
            $p['c'] = $r['coins'];
        }
    }

    // the club screen: anyone standing in the club may put on a YouTube video
    if (isset($in['tv']) && is_string($in['tv'])) {
        $inClub = $rx >= CLUB[0] && $rx <= CLUB[2] && $ry >= CLUB[1] && $ry <= CLUB[3];
        $last = $world['tvset'][$U] ?? 0;
        if (!$inClub) $out['tv_err'] = 'Stand in the club to change the screen.';
        elseif ($sec - $last < 20) $out['tv_err'] = 'Wait a few seconds before changing it again.';
        elseif ($in['tv'] === '') { $world['tv'] = null; $world['tvq'] = []; $world['tvset'][$U] = $sec; }
        elseif (preg_match('~(?:youtu\.be/|[?&]v=|/shorts/|/embed/|/live/)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$~', $in['tv'], $m)) {
            $v = $m[1] ?: $m[2];
            // something is on already: the new one waits its turn
            if (!$world['tv']) $world['tv'] = ['v' => $v, 's' => $now, 'by' => $me['d']];
            elseif (count($world['tvq']) >= 20) $out['tv_err'] = 'The queue is full.';
            elseif (count(array_filter($world['tvq'], fn($q) => $q['u'] === $U)) >= 3) $out['tv_err'] = 'You have three videos waiting already.';
            else { $world['tvq'][] = ['v' => $v, 'by' => $me['d'], 'u' => $U]; $out['tv_queued'] = count($world['tvq']); }
            $world['tvset'][$U] = $sec - 15;
        } else $out['tv_err'] = 'That does not look like a YouTube link.';
    }
    if (!empty($in['tvskip']) && $world['tv']) {
        $inClub = $rx >= CLUB[0] && $rx <= CLUB[2] && $ry >= CLUB[1] && $ry <= CLUB[3];
        if (!$inClub) $out['tv_err'] = 'Stand in the club to skip.';
        elseif ($sec - ($world['tvset'][$U] ?? 0) < 10) $out['tv_err'] = 'Wait a few seconds before skipping again.';
        else { tvNext($world, $now); $world['tvset'][$U] = $sec; }
    }
    // the player tells us how long the video is, so the next one starts on time
    if (isset($in['tvdur']) && is_array($in['tvdur']) && $world['tv'] && ($in['tvdur']['v'] ?? '') === $world['tv']['v'] && !isset($world['tv']['d'])) {
        $d = (float)($in['tvdur']['d'] ?? 0);
        if ($d > 1 && $d < 36000) $world['tv']['d'] = $d;
    }
    // a player saw the video end: move on, unless it has only just started
    if (isset($in['tvend']) && $world['tv'] && $in['tvend'] === $world['tv']['v'] && $now - $world['tv']['s'] > ($world['tv']['d'] ?? 20) - 8) tvNext($world, $now);
    if ($user) { $p['c'] = $user['coins']; $p['l'] = $user['lxp']; }
    $world['people'][$U] = $p;
}
if (count($world['people']) > 80) { uasort($world['people'], fn($a, $b) => $b['t'] <=> $a['t']); $world['people'] = array_slice($world['people'], 0, 80, true); }
foreach ($world['tvset'] ?? [] as $u => $t) if ($t < $sec - 60) unset($world['tvset'][$u]);

// saved while the world is still locked, so a gift and the receiver's own visit never cross
if ($dirty && $user) saveUser($test, $user);
ftruncate($fp, 0); rewind($fp);
fwrite($fp, json_encode($world));
fflush($fp); flock($fp, LOCK_UN); fclose($fp);

$out['now'] = $now;
$out['bn'] = bugCount(count($world['people']));
$out['people'] = [];
foreach ($world['people'] as $u => $p) {
    $o = ['u' => (string)$u, 'd' => $p['d'], 'x' => $p['x'], 'y' => $p['y']];
    if ($p['w']) $o['w'] = (object)$p['w'];
    if (!empty($p['st'])) $o['st'] = $p['st'];
    if (!empty($p['sk'])) $o['sk'] = 1;
    if (!empty($p['si'])) $o['si'] = 1;
    if ($p['e'] && $p['e'][1] > $now - 4) $o['e'] = [$p['e'][0], round($now - $p['e'][1], 2)];
    $out['people'][] = $o;
}
$out['gone'] = array_keys($world['caught']);
// trade offers to me and from me
foreach ($world['trades'] as $o) if ($o['a'] === $U || $o['b'] === $U) $out['trades'][] = ['id' => $o['id'], 'in' => $o['b'] === $U,
    'u' => $o['b'] === $U ? $o['a'] : $o['b'], 'd' => $o['b'] === $U ? $o['ad'] : ($world['people'][$o['b']]['d'] ?? $o['b']), 'give' => $o['give'], 'want' => $o['want']];
// the newest direct message for me, so the page knows when to fetch them
try { $q = db($test)->prepare('SELECT MAX(id) FROM dm WHERE b = ?'); $q->execute([$U]); $out['dm'] = (int)$q->fetchColumn(); } catch (Throwable $e) {}
$out['coins'] = $world['people'][$U]['c'] ?? ($user['coins'] ?? 0);
$out['lxp'] = $world['people'][$U]['l'] ?? ($user['lxp'] ?? 0);
// the notice board: who has the most XP
if (!empty($in['board'])) {
    try { $out['top'] = db($test)->query('SELECT u, lxp FROM users WHERE lxp > 0 ORDER BY lxp DESC LIMIT 3')->fetchAll(PDO::FETCH_NUM); } catch (Throwable $e) { $out['top'] = []; }
}
$out['wear'] = (object)($world['people'][$U]['w'] ?? []);
$b = $world['ball'];
$out['ball'] = ['x' => $b['x'], 'y' => $b['y'], 'vx' => $b['vx'], 'vy' => $b['vy'], 'age' => round(min($now - $b['t'], 86400), 3)];
$out['score'] = $world['score'];
$out['served'] = array_keys($world['served']);
if ($world['tv']) $out['tv'] = ['v' => $world['tv']['v'], 'age' => round($now - $world['tv']['s'], 2), 'by' => $world['tv']['by'], 'k' => (int)($world['tv']['s'] * 10)];
if ($world['tvq']) $out['tvq'] = array_map(fn($q) => ['v' => $q['v'], 'by' => $q['by']], $world['tvq']);
if ($world['fx']) $out['fx'] = array_map(fn($f) => [$f[0], $f[1], round($now - $f[2], 2), $f[3], $f[5] ?? 'fw'], $world['fx']);
if ($world['toss']) $out['toss'] = array_map(fn($f) => [$f[0], $f[1], $f[2], $f[3], round($now - $f[4], 2), $f[5]], $world['toss']);
echo json_encode($out);
