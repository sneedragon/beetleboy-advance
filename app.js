'use strict';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const USE_PROXY  = true;
const PROXY_PATH = 'proxy.php';
const BASE_URL   = 'https://www.remilia.net';
const OIDC_URL   = 'https://www.remilia.net/oidc/realms/remilia/protocol/openid-connect/token';
const LS_ACCESS  = 'bb_access';
const LS_REFRESH = 'bb_refresh';
const REFRESH_INTERVAL   = 60_000;
const TICK_INTERVAL      = 1_000;
const CHAT_URL           = 'chatroom.php';
const CHAT_POLL_INTERVAL = 30_000;

// ── THEMES ────────────────────────────────────────────────────────────────────
const LS_THEME  = 'bb_theme';
const LS_SCHEME = 'bb_scheme'; // 'light' | 'dark' | unset (follows system)
const THEMES = [
  { id: 'indigo', name: 'Indigo',  c1: '#20264c', c2: '#0c1020', lc1: '#4050b8', lc2: '#2c3890' },
  { id: 'onyx',   name: 'Onyx',    c1: '#1c1c1c', c2: '#060606', lc1: '#585858', lc2: '#404040' },
  { id: 'grape',  name: 'Grape',   c1: '#26144a', c2: '#0a0614', lc1: '#7030c0', lc2: '#521e98' },
  { id: 'flame',  name: 'Flame',   c1: '#321010', c2: '#0c0202', lc1: '#aa2424', lc2: '#7a1818' },
  { id: 'cobalt', name: 'Cobalt',  c1: '#0e2058', c2: '#040a1c', lc1: '#2050c8', lc2: '#1038a0' },
  { id: 'gold',   name: 'Gold',    c1: '#2c2406', c2: '#0c0a02', lc1: '#b08010', lc2: '#806008' },
  { id: 'teal',   name: 'Teal',    c1: '#0c242c', c2: '#030a0c', lc1: '#108080', lc2: '#0c6868' },
  { id: 'orange', name: 'Orange',  c1: '#2e1a04', c2: '#0c0802', lc1: '#b84818', lc2: '#883010' },
];


function applyTheme(id) {
  if (id === 'indigo') delete document.body.dataset.theme;
  else document.body.dataset.theme = id;
  localStorage.setItem(LS_THEME, id);
  document.querySelectorAll('.theme-swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.theme === id));
}

function buildThemePicker() {
  const current = localStorage.getItem(LS_THEME) || 'flame';
  const picker = document.getElementById('theme-picker');
  const light = document.body.dataset.scheme === 'light';
  picker.innerHTML = `<div class="theme-picker-title">Colorway</div><div id="theme-grid">${
    THEMES.map(t => {
      const g1 = light ? t.lc1 : t.c1, g2 = light ? t.lc2 : t.c2;
      return `<button class="theme-swatch${t.id === current ? ' active' : ''}" data-theme="${t.id}"
        style="background:linear-gradient(150deg,${g1},${g2})" title="${t.name}">
        <span class="theme-name">${t.name}</span></button>`;
    }).join('')
  }</div>
  <button id="scheme-toggle" class="scheme-toggle-btn">${light ? '🌙 Dark Mode' : '☀️ Light Mode'}</button>`;
  picker.querySelectorAll('.theme-swatch').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); applyTheme(btn.dataset.theme); }));
  picker.querySelector('#scheme-toggle').addEventListener('click', e => {
    e.stopPropagation();
    const nowLight = document.body.dataset.scheme === 'light';
    localStorage.setItem(LS_SCHEME, nowLight ? 'dark' : 'light');
    applyColorScheme();
  });
}

// ── IMAGES ────────────────────────────────────────────────────────────────────
const I = 'https://www.remilia.net/api/beetle/images/icons';
const W = 'https://wiki.remilia.org/images';

// Local icon paths (downloaded successfully)
const IMAGES = {
  // Beetles — icons
  green:                    'icons/beetles/green.png',
  purple:                   'icons/beetles/purple.png',
  ladybug:                  'icons/beetles/ladybug.png',
  monarch:                  'icons/beetles/monarch.png',
  pond:                     'icons/beetles/pond.png',
  giraffe_weevil:           'icons/beetles/giraffe_weevil.png',
  bumblebee:               'icons/beetles/bumblebee.png',
  golden_tiger:     'icons/beetles/golden_tiger.png',
  widow:                    'icons/beetles/widow.png',
  golden:                   'icons/beetles/golden.png',
  cucumber:                 'icons/beetles/cucumber.png',
  christmas:                'icons/beetles/christmas.png',
  goliath:                  'icons/beetles/goliath.png',
  bombardier:               'icons/beetles/bombardier.png',
  stag:                     'icons/beetles/stag.png',
  skull:                'icons/beetles/skull.png',
  candycane_tiger_moth:     'icons/beetles/candycane_tiger_moth.png',
  sabertooth_longhorn:      'icons/beetles/sabertooth_longhorn.png',
  pillbug:                  'icons/beetles/pillbug.png',
  imperial_tortoise:        'icons/beetles/imperial_tortoise.png',
  sunset_moth:              'icons/beetles/sunset_moth.png',
  mars_rhino:               'icons/beetles/mars_rhino.png',
  pondhawk:               'icons/beetles/pondhawk.png',
  blue_longicorn:         'icons/beetles/blue_longicorn.png',
  // Flowers — icons
  daisy:                    'icons/flowers/daisy.png',
  sunflower:                'icons/flowers/sunflower.png',
  poppy:                    'icons/flowers/poppy.png',
  gallic_rose:              'icons/flowers/gallic_rose.png',
  st_johns_wort:            'icons/flowers/st_johns_wort.png',
  milk_thistle:             'icons/flowers/milk_thistle.png',
  larkspur:                 'icons/flowers/larkspur.png',
  petunia:                  'icons/flowers/petunia.png',
  snapdragon:               'icons/flowers/snapdragon.png',
  carnation:                'icons/flowers/carnation.png',
  hellebore:                'icons/flowers/hellebore.png',
  royal_poinciana:          'icons/flowers/royal_poinciana.png',
  marigold:                 'icons/flowers/marigold.png',
  magnolia:                 'icons/flowers/magnolia.png',
  camellia:                 'icons/flowers/camellia.png',
  morning_glory:            'icons/flowers/morning_glory.png',
  pincushion:               'icons/flowers/pincushion.png',
  gazania:                  'icons/flowers/gazania.png',
  black_lotus:              'icons/flowers/black_lotus.png',
  fringed_iris:             'icons/flowers/fringed_iris.png',
  // Pollen — icons
  pollen_common:            'icons/flowers/pollen_common.png',
  pollen_uncommon:          'icons/flowers/pollen_uncommon.png',
  pollen_rare:              'icons/flowers/pollen_rare.png',
  pollen_epic:              'icons/flowers/pollen_epic.png',
  // Hammers — icons
  hammer_t1:                'icons/hammers/hammer_t1.png',
  hammer_t2:                'icons/hammers/hammer_t2.png',
  hammer_t3:                'icons/hammers/hammer_t3.png',
  hammer_t4:                'icons/hammers/hammer_t4.png',
  hammer_t5:                'icons/hammers/hammer_t5.png',
  // Virtual junk aggregate
  _junk_:                   'icons/junk/junk_cube_t1.png',
  // Junk cubes
  junk_cube_t1:             'icons/junk/junk_cube_t1.png',
  junk_cube_t2:             'icons/junk/junk_cube_t2.png',
  // Junk items
  ballpoint_pen:            'icons/junk/ballpoint_pen.png',
  bendy_straw:              'icons/junk/bendy_straw.png',
  bike_reflector:           'icons/junk/bike_reflector.png',
  bottle_cap:               'icons/junk/bottle_cap.png',
  broken_firework:          'icons/junk/broken_firework.png',
  headphones_90s:           'icons/junk/headphones_90s.png',
  burger_wrapper:           'icons/junk/burger_wrapper.png',
  chewed_eraser:            'icons/junk/chewed_eraser.png',
  event_band:               'icons/junk/event_band.png',
  guitar_pick:              'icons/junk/guitar_pick.png',
  origami_crane:            'icons/junk/origami_crane.png',
  pill_bottle:              'icons/junk/pill_bottle.png',
  button:                   'icons/junk/button.png',
  chip_bag:                 'icons/junk/chip_bag.png',
  chocolate_bar:            'icons/junk/chocolate_bar.png',
  chocolate_wrapper:        'icons/junk/chocolate_wrapper.png',
  cigarette_butt:           'icons/junk/cigarette_butt.png',
  coffee_can:               'icons/junk/coffee_can.png',
  cracker_wrapper:          'icons/junk/cracker_wrapper.png',
  deodorant_can:            'icons/junk/deodorant_can.png',
  empty_noodle_cup:         'icons/junk/empty_noodle_cup.png',
  glue_stick:               'icons/junk/glue_stick.png',
  green_army_man:           'icons/junk/green_army_man.png',
  grenade_pin:              'icons/junk/grenade_pin.png',
  gum_wrapper:              'icons/junk/gum_wrapper.png',
  jack_adapter:             'icons/junk/jack_adapter.png',
  juicebox:                 'icons/junk/juicebox.png',
  marble:                   'icons/junk/marble.png',
  matchbook:                'icons/junk/matchbook.png',
  paperclip:                'icons/junk/paperclip.png',
  pebble:                   'icons/junk/pebble.png',
  pokkiri_box:              'icons/junk/pokkiri_box.png',
  ramune_bottle:            'icons/junk/ramune_bottle.png',
  red_whistle:              'icons/junk/red_whistle.png',
  rubber_band:              'icons/junk/rubber_band.png',
  salt_pepper_packet:       'icons/junk/salt_pepper_packet.png',
  scratch_off:              'icons/junk/scratch_off.png',
  sim_card:                 'icons/junk/sim_card.png',
  smiley_pebble:            'icons/junk/smiley_pebble.png',
  soda_can_tab:             'icons/junk/soda_can_tab.png',
  stamp:                    'icons/junk/stamp.png',
  train_ticket_stub:        'icons/junk/train_ticket_stub.png',
  watch_battery:            'icons/junk/watch_battery.png',
  wine_cork:                'icons/junk/wine_cork.png',
  wristband:                'icons/junk/wristband.png',
  //Artifacts
  gunpowder:                'icons/artifacts/gunpowder.png',
  cattail:                  'icons/artifacts/cattail.png',
  nectar:                   'icons/artifacts/nectar.png',
  moss:                     'icons/artifacts/moss.png',
  pinecone:                 'icons/artifacts/pinecone.png',
// ── COMPLETE TROPHY ICONS ────────────────────────────────────────────────────

  // Trophies — icons
  trophy_arrowhead:         'icons/trophies/trophy_arrowhead.webp',
  trophy_chinese_coin:      'icons/trophies/trophy_chinese_coin.webp',
  trophy_compass:           'icons/trophies/trophy_compass.webp',
  trophy_cult_medallion:    'icons/trophies/trophy_cult_medallion.webp',
  trophy_d20:               'icons/trophies/trophy_d20.webp',
  trophy_deck_of_cards:     'icons/trophies/trophy_deck_of_cards.webp',
  trophy_engraved_lighter:  'icons/trophies/trophy_engraved_lighter.webp',
  trophy_goya_miniature:    'icons/trophies/trophy_goya_miniature.webp',
  trophy_jade_cabbage:      'icons/trophies/trophy_jade_cabbage.webp',
  trophy_juex_card:         'icons/trophies/trophy_juex_card.webp',
  trophy_milady_fumoku:     'icons/trophies/trophy_milady_fumoku.webp',
  trophy_mokia:             'icons/trophies/trophy_mokia.webp',
  trophy_oriental_fan:      'icons/trophies/trophy_oriental_fan.webp',
  trophy_police_badge:      'icons/trophies/trophy_police_badge.webp',
  trophy_prism:             'icons/trophies/trophy_prism.webp',
  trophy_remilianet_id:        'icons/trophies/trophy_remilianet_id.webp',
  trophy_roman_dodeca:      'icons/trophies/trophy_roman_dodeca.webp',
  trophy_stradivarius:      'icons/trophies/trophy_stradivarius.webp',
  trophy_thumb_drive:       'icons/trophies/trophy_thumb_drive.webp',
  trophy_titanium_cube:     'icons/trophies/trophy_titanium_cube.webp',

  // Trophies — card art (same image)
  _card_trophy_arrowhead:        'icons/trophies/trophy_arrowhead.webp',
  _card_trophy_chinese_coin:     'icons/trophies/trophy_chinese_coin.webp',
  _card_trophy_compass:          'icons/trophies/trophy_compass.webp',
  _card_trophy_cult_medallion:   'icons/trophies/trophy_cult_medallion.webp',
  _card_trophy_d20:              'icons/trophies/trophy_d20.webp',
  _card_trophy_deck_of_cards:    'icons/trophies/trophy_deck_of_cards.webp',
  _card_trophy_engraved_lighter: 'icons/trophies/trophy_engraved_lighter.webp',
  _card_trophy_goya_miniature:   'icons/trophies/trophy_goya_miniature.webp',
  _card_trophy_jade_cabbage:     'icons/trophies/trophy_jade_cabbage.webp',
  _card_trophy_juex_card:        'icons/trophies/trophy_juex_card.webp',
  _card_trophy_milady_fumoku:    'icons/trophies/trophy_milady_fumoku.webp',
  _card_trophy_mokia:            'icons/trophies/trophy_mokia.webp',
  _card_trophy_oriental_fan:     'icons/trophies/trophy_oriental_fan.webp',
  _card_trophy_police_badge:     'icons/trophies/trophy_police_badge.webp',
  _card_trophy_prism:            'icons/trophies/trophy_prism.webp',
  _card_trophy_remilianet_id:       'icons/trophies/trophy_remilianet_id.webp',
  _card_trophy_roman_dodeca:     'icons/trophies/trophy_roman_dodeca.webp',
  _card_trophy_stradivarius:     'icons/trophies/trophy_stradivarius.webp',
  _card_trophy_thumb_drive:      'icons/trophies/trophy_thumb_drive.webp',
  _card_trophy_titanium_cube:    'icons/trophies/trophy_titanium_cube.webp',
  // Special / unique
  specimen_pin:             'icons/artifacts/specimen_pin.png',
  beetleboy_key:            'icons/unique/beetleboy_key.png',
  // Cheese
  cheese:                   'icons/cheese/cheese.png',
  // Character art — beetles
  _card_green:              'icons/_card/green.webp',
  _card_purple:             'icons/_card/purple.webp',
  _card_ladybug:            'icons/_card/ladybug.webp',
  _card_monarch:            'icons/_card/monarch.webp',
  _card_pond:               'icons/_card/pond.webp',
  _card_cucumber:           'icons/_card/cucumber.webp',
  _card_giraffe_weevil:     'icons/_card/giraffe_weevil.webp',
  _card_bumblebee:          'icons/_card/bumblebee.webp',
  _card_golden_tiger:       'icons/_card/golden_tiger.webp',
  _card_widow:              'icons/_card/widow.webp',
  _card_golden:             'icons/_card/golden.webp',
  _card_christmas:          'icons/_card/christmas.webp',
  _card_goliath:            'icons/_card/goliath.webp',
  _card_bombardier:         'icons/_card/bombardier.webp',
  _card_stag:               'icons/_card/stag.webp',
  _card_skull:              'icons/_card/skull.webp',
  _card_candycane_tiger_moth:'icons/_card/candycane_tiger_moth.webp',
  _card_sabertooth_longhorn:'icons/_card/sabertooth_longhorn.webp',
  _card_pillbug:            'icons/_card/pillbug.webp',
  _card_imperial_tortoise:  'icons/_card/imperial_tortoise.webp',
  _card_sunset_moth:        'icons/_card/sunset_moth.webp',
  _card_mars_rhino:         'icons/_card/mars_rhino.webp',
  _card_pondhawk:           'icons/_card/pondhawk.webp',
  _card_blue_longicorn:     'icons/_card/blue_longicorn.webp',
  _card_radbro:             `${W}/3/3c/Radbro.png`,
  // Character art — flowers
  _card_daisy:              'icons/_card/daisy.webp',
  _card_sunflower:          'icons/_card/sunflower.webp',
  _card_poppy:              'icons/_card/poppy.webp',
  _card_gallic_rose:        'icons/_card/gallic_rose.webp',
  _card_milk_thistle:       'icons/_card/milk_thistle.webp',
  _card_marigold:           'icons/_card/marigold.webp',
  _card_magnolia:           'icons/_card/magnolia.webp',
  _card_camellia:           'icons/_card/camellia.webp',
  _card_royal_poinciana:    'icons/_card/royal_poinciana.webp',
  _card_morning_glory:      'icons/_card/morning_glory.webp',
  _card_pincushion:         'icons/_card/pincushion.webp',
  _card_gazania:            'icons/_card/gazania.webp',
  _card_hammer_t3:          'icons/_card/hammer_t3.webp',
  _card_carnation:          'icons/_card/carnation.webp',
  _card_hellebore:          'icons/_card/hellebore.webp',
  _card_black_lotus:        'icons/_card/black_lotus.webp',
  _card_fringed_iris:       'icons/_card/fringed_iris.webp',
  // Character art — junk
  _card_junk_cube_t1:       'icons/_card_junk/junk_cube_t1.webp',
  _card_junk_cube_t2:       'icons/_card_junk/junk_cube_t2.webp',
  _card_bike_reflector:     'icons/_card_junk/bike_reflector.webp',
  _card_bottle_cap:         'icons/_card_junk/bottle_cap.webp',
  _card_chip_bag:           'icons/_card_junk/chip_bag.webp',
  _card_chocolate_bar:      'icons/_card_junk/chocolate_bar.webp',
  _card_chocolate_wrapper:  'icons/_card_junk/chocolate_wrapper.webp',
  _card_cigarette_butt:     'icons/_card_junk/cigarette_butt.webp',
  _card_coffee_can:         'icons/_card_junk/coffee_can.webp',
  _card_cracker_wrapper:    'icons/_card_junk/cracker_wrapper.webp',
  _card_empty_noodle_cup:   'icons/_card_junk/empty_noodle_cup.webp',
  _card_green_army_man:     'icons/_card_junk/green_army_man.webp',
  _card_gum_wrapper:        'icons/_card_junk/gum_wrapper.webp',
  _card_jack_adapter:       'icons/_card_junk/jack_adapter.webp',
  _card_juicebox:           'icons/_card_junk/juicebox.webp',
  _card_marble:             'icons/_card_junk/marble.webp',
  _card_paperclip:          'icons/_card_junk/paperclip.webp',
  _card_pebble:             'icons/_card_junk/pebble.webp',
  _card_pokkiri_box:        'icons/_card_junk/pokkiri_box.webp',
  _card_ramune_bottle:      'icons/_card_junk/ramune_bottle.webp',
  _card_red_whistle:        'icons/_card_junk/red_whistle.webp',
  _card_rubber_band:        'icons/_card_junk/rubber_band.webp',
  _card_scratch_off:        'icons/_card_junk/scratch_off.webp',
  _card_smiley_pebble:      'icons/_card_junk/smiley_pebble.webp',
  _card_soda_can_tab:       'icons/_card_junk/soda_can_tab.webp',
  _card_stamp:              'icons/_card_junk/stamp.webp',
  _card_train_ticket_stub:  'icons/_card_junk/train_ticket_stub.webp',
  _card_watch_battery:      'icons/_card_junk/watch_battery.webp',
  _card_wine_cork:          'icons/_card_junk/wine_cork.webp',
  // Character art — artifacts
  _card_gunpowder:          'icons/artifacts/gunpowder.webp',
  _card_cattail:            'icons/artifacts/cattail.png',
  _card_nectar:             'icons/artifacts/nectar.png',
  _card_moss:               'icons/artifacts/moss.png',
  _card_pinecone:           'icons/artifacts/pinecone.png',
};

// Background scenes used only in the card modal
const BG_SCENES = {
  green:               `${W}/d/d0/Beetleboy_Green_Background.webp`,
  purple:              `${W}/7/73/Beetleboy_Purple_Background.webp`,
  ladybug:             `${W}/9/93/Beetleboy_Ladybug_Background.webp`,
  monarch:             `${W}/1/11/Beetleboy_Monarch_Background.webp`,
  pond:                `${W}/3/35/Beetleboy_Pond_Background.webp`,
  bombardier:          `${W}/3/3f/Beetleboy_Bombardier_Background.webp`,
  stag:                `${W}/d/d1/Beetleboy_Stag_Background.webp`,
  sabertooth_longhorn: `${W}/9/94/Beetleboy_Sabertooth_Longhorn_Background.webp`,
  golden:              `${W}/5/54/Beetleboy_Golden_Background.webp`,
  giraffe_weevil:      `${W}/7/72/Beetleboy_Giraffe_Weevil_Background.webp`,
  pillbug:             `${W}/0/0f/Beetleboy_Pillbug_Background.webp`,
  christmas:           `${W}/f/f9/Beetleboy_Christmas_Background.webp`,
  skull:           `${W}/d/d0/Beetleboy_Skull_Background.webp`,
  sunset_moth:         `${W}/d/d3/Beetleboy_Sunset_Moth_Background.webp`,
  black_lotus:         `${W}/f/f5/Beetleboy_Black_Lotus_Background.webp`,
  camellia:            `${W}/2/2f/Beetleboy_Camellia_Background.webp`,
  daisy:               `${W}/6/67/Beetleboy_Daisy_Background.webp`,
  gallic_rose:         `${W}/7/74/Beetleboy_Gallic_Rose_Background.webp`,
  gazania:             `${W}/3/3a/Beetleboy_Gazania_Background.webp`,
  marigold:            `${W}/3/39/Beetleboy_Marigold_Background.webp`,
  milk_thistle:        `${W}/a/a8/Beetleboy_Milk_Thistle_Background.webp`,
  morning_glory:       `${W}/6/69/Beetleboy_Morning_Glory_Background.webp`,
  pincushion:          `${W}/5/5d/Beetleboy_Pincushion_Background.webp`,
  royal_poinciana:     `${W}/8/83/Beetleboy_Royal_Poinciana_Background.webp`,
  sunflower:           `${W}/c/c2/Beetleboy_Sunflower_Background.webp`,
};

// ── DATA ──────────────────────────────────────────────────────────────────────
const NAMES = {
  green:'Green Beetle', purple:'Purple Beetle', ladybug:'Ladybug',
  monarch:'Monarch', pond:'Pond Beetle', giraffe_weevil:'Giraffe Weevil',
  widow:'Black Widow', golden:'Golden Scarab', cucumber:'Striped cucumber Beetle',
  bumblebee:'Bumblebee',
  christmas:'Christmas Beetle', bumblebee:'Bumble Bee', radbro:'Radbro',
  skull:'Skull Bug', candycane_tiger_moth:'Candycane Tiger Moth',
  imperial_tortoise:'Imperial Tortoise Beetle', pillbug:'Pillbug',
  bombardier:'Bombardier Beetle', goliath:'Goliath Beetle',
  stag:'Stag Beetle', sabertooth_longhorn:'Sabertooth Longhorn Beetle',
  sunset_moth:'Sunset Moth', mars_rhino:'Mars Rhino Beetle',
  golden_tiger:'Golden-Spotted Tiger Beetle', pondhawk: 'Eastern Pondhawk',
  blue_longicorn:'Blue Longicorn Beetle',
  daisy:'Daisy', sunflower:'Sunflower', poppy:'Poppy',
  gallic_rose:'Gallic Rose', st_johns_wort:"Spotted St. John's Wort",
  milk_thistle:'Milk Thistle', larkspur:'Two-spike Larkspur', petunia:'Large White Petunia',
  snapdragon:'Common Snapdragon', marigold:'Marigold', magnolia:'Southern Magnolia', carnation:'Chinese Pink Carnation',
  royal_poinciana:'Royal Poinciana', morning_glory:'Morning Glory',
  camellia:'Camellia', fringed_iris:'Fringed Iris',
  pincushion:'Pincushion', gazania:'Gazania',
  black_lotus:'Black Lotus', hellebore:'Green Hellebore',
  purple_passionflower:'Purple Passionflower',
  pollen_common:'Tin Pollen', pollen_uncommon:'Bronze Pollen',
  pollen_rare:'Mithril Pollen', pollen_epic:'Adamantine Pollen',
  _junk_:'Junk', junk_cube_t1:'Junk Cube', junk_cube_t2:'Junk Tesseract',
  hammer_t1:'Tin Hammer', hammer_t2:'Bronze Hammer',
  hammer_t3:'Mithril Hammer', hammer_t4:'Adamantine Hammer', hammer_t5:'Diamond Hammer',
  headphones_90s:'90s Headphones',
  burger_wrapper:'Burger Wrapper', chewed_eraser:'Chewed Eraser',
  event_band:'Event Band', guitar_pick:'Guitar Pick',
  origami_crane:'Origami Crane', pill_bottle:'Empty Pill Bottle',
  cheese:'Cheese', specimen_pin:'Specimen Pin', grenade_pin:'Grenade Pin',
  beetleboy_key:'BeetleBoy Key', chinese_coin:'Chinese Coin',
  nectar:'Nectar', cattail:'Cattail', pinecone:'Pinecone',
  moss:'Moss', gunpowder:'Gunpowder',
  prism:'Prism', roman_dodeca:'Roman Dodecahedron',
  arrowhead:'Arrowhead', titanium_cube:'Titanium Cube',
  oriental_fan:'Oriental Fan', mokia:'Mokia',
  thumb_drive:'Thumb Drive', jade_cabbage:'Jade Cabbage',
  juex_card:'Juex Card', trophy_juex_card:'Juex Card Trophy',
  cult_medallion:'CULT Medallion',
  d20:'D20', trophy_d20:'D20 Trophy',
  deck_of_cards:'Deck of Cards', compass:'Compass', stradivarius:'Stradivarius',
  engraved_lighter:'Engraved Lighter', goya_miniature:'Goya Miniature Painting',
  police_badge:'Police Badge', milady_fumoku:'Milady Fumoku', remilianet_id:'Reminet ID',
  trophy_prism:'Prism Trophy', trophy_roman_dodeca:'Roman Dodecahedron Trophy',
  trophy_arrowhead:'Arrowhead Trophy', trophy_titanium_cube:'Titanium Cube Trophy',
  trophy_oriental_fan:'Oriental Fan Trophy', trophy_mokia:'Mokia Trophy',
  trophy_thumb_drive:'Thumb Drive Trophy', trophy_jade_cabbage:'Jade Cabbage Trophy',
  trophy_cult_medallion:'CULT Medallion Trophy',
  trophy_stradivarius:'Stradivarius Trophy', trophy_compass:'Compass Trophy',
  trophy_engraved_lighter:'Engraved Lighter Trophy', trophy_goya_miniature:'Goya Miniature Trophy',
  trophy_police_badge:'Police Badge Trophy', trophy_milady_fumoku:'Milady Fumoku Trophy',
  trophy_remilianet_id:'Reminet ID Trophy',
  trophy_deck_of_cards:'Deck of Cards Trophy',
  trophy_chinese_coin:'Chinese Coin Trophy',

};

const RARITY = {
  junk_cube_t1:'jnk', junk_cube_t2:'jnk',
  green:'tin', daisy:'tin', sunflower:'tin', poppy:'tin',
  petunia:'tin', snapdragon:'tin', carnation:'tin',
  pollen_common:'tin', hammer_t1:'tin', beetleboy_key:'tin',
  purple:'brz', ladybug:'brz', gallic_rose:'brz', st_johns_wort:'brz',
  milk_thistle:'brz', marigold:'brz', magnolia:'brz', pollen_uncommon:'brz', hammer_t2:'brz',
  cucumber:'brz',
  bumblebee:'mth',
  monarch:'mth', pond:'mth', royal_poinciana:'mth', morning_glory:'mth',
  camellia:'mth', fringed_iris:'mth', pollen_rare:'mth', hammer_t3:'mth',
  giraffe_weevil:'mth', christmas:'mth', imperial_tortoise:'mth',
  pillbug:'mth', skull:'mth', nectar:'mth', cattail:'mth',
  pincushion:'adm', gazania:'adm', hellebore:'adm', larkspur:'adm',
  purple_passionflower:'adm',
  pollen_epic:'adm', hammer_t4:'adm', pondhawk:'adm',
  bumblebee:'mth', golden_tiger:'mth', blue_longicorn:'mth', bombardier:'adm', goliath:'adm', stag:'adm', sabertooth_longhorn:'adm',
  sunset_moth:'adm', gunpowder:'adm', moss:'adm', pinecone:'adm',
  golden:'dia', widow:'dia', black_lotus:'dia', hammer_t5:'dia',
  mars_rhino:'dia', candycane_tiger_moth:'dia',
  chinese_coin:'pnk', prism:'pnk', roman_dodeca:'pnk', arrowhead:'pnk',
  titanium_cube:'pnk', oriental_fan:'pnk', mokia:'pnk', thumb_drive:'pnk', jade_cabbage:'pnk',
  juex_card:'pnk', trophy_juex_card:'pnk', cult_medallion:'pnk',
  d20:'pnk', trophy_d20:'pnk',
  deck_of_cards:'pnk', compass:'pnk', stradivarius:'pnk',
  engraved_lighter:'pnk', goya_miniature:'pnk',
  police_badge:'pnk', milady_fumoku:'pnk', remilianet_id:'pnk',
  specimen_pin:'pnk',
  trophy_prism:'pnk', trophy_roman_dodeca:'pnk', trophy_arrowhead:'pnk',
  trophy_titanium_cube:'pnk', trophy_oriental_fan:'pnk',
  trophy_mokia:'pnk', trophy_thumb_drive:'pnk', trophy_jade_cabbage:'pnk',
  trophy_cult_medallion:'pnk',
  trophy_stradivarius:'pnk', trophy_deck_of_cards:'pnk', trophy_compass:'pnk',
  trophy_chinese_coin:'pnk',
  trophy_milady_fumoku:'pnk', trophy_goya_miniature:'pnk',
  trophy_police_badge:'pnk',
  trophy_engraved_lighter:'pnk',
  trophy_remilianet_id:'pnk',
};

const SCIENTIFIC = {
  // Beetles
  green:            'Chrysolina graminis',
  ladybug:          'Coccinella septempunctata',
  purple:           'Chrysolina sturmi',
  christmas:        'Stephanorrhina guttata',
  giraffe_weevil:   'Trachelophorus giraffa',
  imperial_tortoise:'Stolas imperialis',
  monarch:          'Danaus plexippus',
  pillbug:          'Armadillidium pulchellum',
  pond:             'Hydrochara caraboides',
  skull:            'Eucorysses grandis',
  bumblebee:       'Bombus terrestris',
  golden_tiger:     'Cicindela aurulenta',
  bombardier:       'Brachinus explodens',
  goliath:          'Goliathus goliatus',
  sabertooth_longhorn:'Macrodontia cervicornis',
  stag:             'Dorcus hopei binodulosus',
  sunset_moth:      'Chrysiridia rhipheus',
  pondhawk:         'Erythemis Simplicicollis',
  golden:           'Chrysina resplendens',
  mars_rhino:       'Megasoma mars',
  candycane_tiger_moth: 'Spilosoma congrua',
  cucumber:         'Acalymma vittatum',
  widow:            'Latrodectus mactans',
  // Flowers
  daisy:            'Leucanthemum vulgare',
  poppy:            'Papaver rhoeas',
  sunflower:        'Helianthus annuus',
  petunia:          'Petunia axillaris',
  snapdragon:       'Antirrhinum majus',
  gallic_rose:      'Rosa gallica',
  marigold:         'Calendula officinalis',
  magnolia:         'Magnolia grandiflora',
  milk_thistle:     'Silybum marianum',
  st_johns_wort:    'Hypericum punctatum',
  camellia:         'Camellia japonica',
  morning_glory:    'Ipomoea tricolor',
  royal_poinciana:  'Delonix regia',
  gazania:          'Gazania x splendens',
  pincushion:           'Leucospermum praecox',
  black_lotus:          'Nelumbo nucifera',
  larkspur:             'Delphinium distichum',
  carnation:            'Dianthus chinensis',
  hellebore:            'Helleborus viridis',
  fringed_iris:         'Iris japonica',
  purple_passionflower: 'Passiflora incarnata',
  // Pollen
  pollen_common:    'Pulvis stannus',
  pollen_uncommon:  'Pulvis bronzium',
  pollen_rare:      'Pulvis mithrilum',
  pollen_epic:      'Pulvis adamantinus',
  // Junk items
  bike_reflector:   'Speculatus velocipedus',
  bottle_cap:       'Operculum metallicum',
  chip_bag:         'Sacculus crepitus',
  chocolate_bar:    'Barra dulcis',
  chocolate_wrapper:'Tegmen chocolatus',
  cigarette_butt:   'Fumigatus relictus',
  coffee_can:       'Cylindrus caffeinatus',
  cracker_wrapper:  'Involucrum biscuitus',
  empty_noodle_cup: 'Ramenus vacuus',
  green_army_man:   'Militus plasticus',
  gum_wrapper:      'Involucrum masticatus',
  jack_adapter:     'Adaptorus audius',
  juicebox:         'Cartonus succulentus',
  junk_cube_t1:     'Cubus junketii',
  junk_cube_t2:     'Cubus junketii major',
  marble:           'Sphericus vitreus',
  paperclip:        'Ferrum clipsius',
  pebble:           'Petrus minimus',
  pokkiri_box:      'Biscuitus japonicus',
  ramune_bottle:    'Vitrum marmoratus',
  red_whistle:      'Fistula rubra',
  rubber_band:      'Elasticus circularis',
  scratch_off:      'Fortuna rasilis',
  smiley_pebble:    'Petrus felix',
  soda_can_tab:     'Tirulus aluminus',
  stamp:            'Sigillum postalis',
  train_ticket_stub:'Transitum fragmentum',
  watch_battery:    'Energia horologii',
  wine_cork:        'Quercus tapperus',
};

const DESCRIPTIONS = {
  // Beetles
  green:            'Tansy beetle',
  ladybug:          'Common ladybug',
  purple:           'Violet leaf beetle',
  christmas:        'Spotted flower beetle',
  giraffe_weevil:   'Giraffe weevil',
  imperial_tortoise:'Imperial tortoise beetle',
  monarch:          'Monarch',
  pillbug:          'Beautiful pill woodlouse',
  pond:             'Lesser silver water beetle',
  skull:            'Death head bug',
  bumblebee:       'Buff-tailed bumblebee',
  bombardier:       'Bombardier beetle',
  goliath:          'Goliath beetle',
  sabertooth_longhorn:'Sabertooth longhorn beetle',
  stag:             'Japanese great stag beetle',
  sunset_moth:      'Madagascan sunset moth',
  pondhawk:         'Eastern pondhawk',
  golden:           'Jewel scarab',
  mars_rhino:       'Mars rhino beetle',
  widow:            'Southern Black Widow',
  golden_tiger:     'Golden-spotted tiger beetle',
  cucumber:         'Striped cucumber beetle',
  candycane_tiger_moth: 'New Hope tiger moth',
  // Flowers
  daisy:            'Oxeye daisy',
  poppy:            'Common poppy',
  sunflower:        'Common sunflower',
  petunia:          'Large white petunia',
  snapdragon:       'Common snapdragon',
  gallic_rose:      'Gallic rose',
  marigold:         'Pot marigold',
  magnolia:         'Southern magnolia',
  milk_thistle:     'Milk thistle',
  st_johns_wort:    "Spotted St. John's wort",
  camellia:         'Japanese camellia',
  morning_glory:    'Garden morning glory',
  royal_poinciana:  'Royal poinciana',
  gazania:          'Garden gazania',
  pincushion:           'Mossel bay pincushion',
  black_lotus:          'Sacred lotus (black)',
  larkspur:             'Two-spike larkspur',
  carnation:            'Chinese pink carnation',
  hellebore:            'Green hellebore',
  fringed_iris:         'Fringed iris',
  purple_passionflower: 'Purple passionflower',
  // Pollen
  pollen_common:    'From Tin flowers',
  pollen_uncommon:  'From Bronze flowers',
  pollen_rare:      'From Mithril flowers',
  pollen_epic:      'From Adamantine flowers',
  // Hammers
  hammer_t1:        '+0% craft bonus, 10% break chance',
  hammer_t2:        '+5% craft bonus, 5% break chance',
  hammer_t3:        '+20% craft bonus, 10% break chance',
  hammer_t4:        '+35% craft bonus, 2% break chance',
  hammer_t5:        '+90% craft bonus, 1% break chance',
  // Junk items
  bike_reflector:   'Safety red',
  bottle_cap:       'Not a currency yet',
  chip_bag:         'Mostly air',
  chocolate_bar:    'Slightly melted',
  chocolate_wrapper:'Still good.',
  cigarette_butt:   'The cure.',
  coffee_can:       'SUPER busy.',
  cracker_wrapper:  'Oh crumbs',
  empty_noodle_cup: 'Delicious styrofoam',
  green_army_man:   'OOORAAHH',
  gum_wrapper:      'Tattoos not included',
  jack_adapter:     'A relic of the early 21st century',
  juicebox:         'Beetlejuice signature flavor',
  junk_cube_t1:     'Encapsulated detritus',
  junk_cube_t2:     'Greater than the sum of its parts',
  marble:           'Faded swirl',
  paperclip:        'Standard silver',
  pebble:           'An interesting shade of blue…',
  pokkiri_box:      'Crispy biscuit sticks',
  ramune_bottle:    'Comes with free marble',
  red_whistle:      'Universal frequency',
  rubber_band:      'Bully grade',
  scratch_off:      'Non-winning',
  smiley_pebble:    'hi',
  soda_can_tab:     'A whit of chainmail',
  stamp:            'Do not lick',
  train_ticket_stub:'I love my station',
  watch_battery:    'Extra spicy flavor',
  wine_cork:        'Celebrated for its excellence',
};

const CATEGORIES = [
  ['Beetles', ['green','purple','ladybug','cucumber','monarch','pond','giraffe_weevil',
                 'pillbug','imperial_tortoise','christmas','skull',
                 'bumblebee','golden_tiger','blue_longicorn',
                 'goliath','bombardier', 'pondhawk', 'stag','sabertooth_longhorn','sunset_moth',
                 'golden','widow','candycane_tiger_moth','mars_rhino',
                 'radbro',]],
  ['Flowers',   ['daisy','sunflower','poppy','petunia','snapdragon','carnation',
                 'gallic_rose','st_johns_wort','milk_thistle','marigold','magnolia',
                 'royal_poinciana','morning_glory','camellia','fringed_iris',
                 'pincushion','gazania','hellebore','larkspur','purple_passionflower',
                 'black_lotus']],
  ['Pollen',    ['pollen_common','pollen_uncommon','pollen_rare','pollen_epic']],
  ['Junk',      ['junk_cube_t1','junk_cube_t2']],
  ['Artifacts', ['nectar','cattail','pinecone','moss','gunpowder']],
  ['Trinkets',  ['chinese_coin','prism','roman_dodeca','arrowhead',
                 'titanium_cube','oriental_fan','mokia','thumb_drive','jade_cabbage',
                 'juex_card','cult_medallion','d20',
                 'deck_of_cards','compass','stradivarius',
                 'engraved_lighter','goya_miniature',
                 'police_badge','milady_fumoku','remilianet_id']],
  ['Hammers',   ['hammer_t1','hammer_t2','hammer_t3','hammer_t4','hammer_t5']],
  ['Special',   ['specimen_pin','beetleboy_key','christmas_item']],
];

const TROPHIES = [
	['trophy_chinese_coin',     'Chinese Coin Trophy',         true],
	['trophy_prism',            'Prism Trophy',                true],
	['trophy_roman_dodeca',     'Roman Dodecahedron Trophy',   true],
	['trophy_arrowhead',        'Arrowhead Trophy',            true],
	['trophy_titanium_cube',    'Titanium Cube Trophy',        true],

	['trophy_oriental_fan',     'Oriental Fan Trophy',         true],
	['trophy_jade_cabbage',     'Jade Cabbage Trophy',         true],
	['trophy_thumb_drive',      'Thumb Drive Trophy',          true],
	['trophy_mokia',            'Mokia Trophy',                true],
	['trophy_compass',          'Compass Trophy',              true],

	['trophy_juex_card',        'Juex Card Trophy',            true],
	['trophy_cult_medallion',   'CULT Medallion Trophy',       true],

	['trophy_stradivarius',     'Stradivarius Trophy',         true],
	['trophy_police_badge',     'Police Badge Trophy',         true],
	['trophy_goya_miniature',   'Goya Miniature Trophy',       true],

	['trophy_milady_fumoku',    'Milady Fumoku Trophy',        true],
	['trophy_remilianet_id',    'Reminet ID Trophy',           true],

	['trophy_deck_of_cards',    'Deck of Cards Trophy',        true],
	['trophy_d20',              'D20 Trophy',                  true],

	['trophy_engraved_lighter', 'Engraved Lighter Trophy',     false],
];

const TIN_FLOWERS     = ['daisy','sunflower','poppy','petunia','snapdragon','carnation'];
const BRONZE_FLOWERS  = ['gallic_rose','st_johns_wort','milk_thistle','marigold','magnolia'];
const MITHRIL_FLOWERS = ['royal_poinciana','morning_glory','camellia','fringed_iris'];
const ADAM_FLOWERS    = ['pincushion','gazania','hellebore','larkspur','purple_passionflower'];

const FLOWER_TIERS = [
  [TIN_FLOWERS,    'Tin Flower'],
  [BRONZE_FLOWERS, 'Bronze Flower'],
  [MITHRIL_FLOWERS,'Mithril Flower'],
  [ADAM_FLOWERS,   'Adamantine Flower'],
];
function ingGroupLabel(group) {
  if (group === 'junk') return 'Any Junk';
  const t = FLOWER_TIERS.find(([g]) => g === group);
  return t ? t[1] : iname(group[0]);
}

const AR = [
  {out:'junk_cube_t1',       name:'Junk Cube',               ing:[{group:'junk',qty:2}]},
  {out:'junk_cube_t2',       name:'Junk Tesseract',          ing:[{key:'junk_cube_t1',qty:3}]},
  {out:'specimen_pin',       name:'Gamble for Specimen Pin', ing:[{key:'junk_cube_t2',qty:2}]},

  {out:'hammer_t1',          name:'Tin Hammer',              unique:true, ing:[{key:'junk_cube_t1',qty:2}]},
  {out:'hammer_t2',          name:'Bronze Hammer',           unique:true, ing:[{key:'hammer_t1',qty:1},{key:'junk_cube_t2',qty:1},{key:'pollen_common',qty:1}]},
  {out:'hammer_t3',          name:'Mithril Hammer',          unique:true, ing:[{key:'hammer_t2',qty:1},{key:'junk_cube_t2',qty:1},{key:'pollen_uncommon',qty:1}]},
  {out:'hammer_t4',          name:'Adamantine Hammer',       unique:true, ing:[{key:'hammer_t3',qty:1},{key:'junk_cube_t2',qty:1},{key:'pollen_epic',qty:1}]},
  {out:'hammer_t5',          name:'Diamond Hammer',          unique:true, ing:[{key:'hammer_t4',qty:1},{key:'junk_cube_t2',qty:1},{key:'pollen_epic',qty:1}]},

  {out:'pollen_common',      name:'Tin Pollen',              ing:[{group:TIN_FLOWERS,qty:2}]},
  {out:'pollen_uncommon',    name:'Bronze Pollen',           ing:[{group:BRONZE_FLOWERS,qty:2}]},
  {out:'pollen_rare',        name:'Mithril Pollen',          ing:[{group:MITHRIL_FLOWERS,qty:2}]},
  {out:'pollen_epic',        name:'Adamantine Pollen',       ing:[{group:ADAM_FLOWERS,qty:2}]},

  {out:'beetleboy_key',      name:'BeetleBoy Key',           unique:true, ing:[{group:BRONZE_FLOWERS,qty:1},{key:'junk_cube_t1',qty:1}]},
// ── TROPHIES (dependency ordered) ─────────────────────────────────────────────
// Tier 1: base artifact trophies (no dependencies)
{out:'trophy_chinese_coin', name:'Chinese Coin Trophy', unique:true,
	ing:[{key:'junk_cube_t1',qty:2},{key:'pollen_common',qty:1}]},

{out:'trophy_prism', name:'Prism Trophy', unique:true,
	ing:[{key:'junk_cube_t2',qty:2},{key:'pollen_common',qty:1}]},

{out:'trophy_roman_dodeca', name:'Roman Dodecahedron Trophy', unique:true,
	ing:[{key:'junk_cube_t2',qty:2},{key:'pollen_uncommon',qty:1}]},

{out:'trophy_arrowhead', name:'Arrowhead Trophy', unique:true,
	ing:[{key:'junk_cube_t2',qty:2},{key:'pollen_rare',qty:1}]},

{out:'trophy_titanium_cube', name:'Titanium Cube Trophy', unique:true,
	ing:[{key:'junk_cube_t2',qty:2},{key:'pollen_epic',qty:1}]},

// Tier 2: coin-derived / simple composite trophies
{out:'trophy_oriental_fan', name:'Oriental Fan Trophy', unique:true,
	ing:[{key:'chinese_coin',qty:1},{key:'pollen_common',qty:1}]},

{out:'trophy_jade_cabbage', name:'Jade Cabbage Trophy', unique:true,
	ing:[{key:'chinese_coin',qty:1},{key:'roman_dodeca',qty:1}]},

{out:'trophy_thumb_drive', name:'Thumb Drive Trophy', unique:true,
	ing:[{key:'roman_dodeca',qty:1},{key:'prism',qty:1}]},

{out:'trophy_mokia', name:'Mokia Trophy', unique:true,
	ing:[{key:'titanium_cube',qty:1},{key:'roman_dodeca',qty:1}]},

{out:'trophy_compass', name:'Compass Trophy', unique:true,
	ing:[{key:'arrowhead',qty:1},{key:'roman_dodeca',qty:1}]},

// Tier 3: item-dependent trophies
{out:'trophy_juex_card', name:'Juex Card Trophy', unique:true,
	ing:[{key:'prism',qty:1},{key:'titanium_cube',qty:1}]},

{out:'trophy_cult_medallion', name:'CULT Medallion Trophy', unique:true,
	ing:[{key:'juex_card',qty:1},{key:'chinese_coin',qty:1}]},

// Tier 4: composite craft chains
{out:'trophy_stradivarius', name:'Stradivarius Trophy', unique:true,
	ing:[{key:'jade_cabbage',qty:1},{key:'oriental_fan',qty:1}]},

{out:'trophy_police_badge', name:'Police Badge Trophy', unique:true,
	ing:[{key:'arrowhead',qty:1},{key:'titanium_cube',qty:1}]},

{out:'trophy_goya_miniature', name:'Goya Miniature Trophy', unique:true,
	ing:[{key:'stradivarius',qty:1},{key:'arrowhead',qty:1}]},

// Tier 5: late-game composites
{out:'trophy_milady_fumoku', name:'Milady Fumoku Trophy', unique:true,
	ing:[{key:'cult_medallion',qty:1},{key:'arrowhead',qty:1}]},

{out:'trophy_remilianet_id', name:'Reminet ID Trophy', unique:true,
	ing:[{key:'juex_card',qty:1},{key:'milady_fumoku',qty:1}]},
];
const AR_BY_OUT = Object.fromEntries(AR.map(r => [r.out, r]));

const RECIPES = [
  // ── Smash — Tier Up (all rarities, risky) ────────────────────────────────────
  ['2× Tin Beetle',                                  'Bronze Beetle',              'smash', 'risky — use first smash of day only'],
  ['2× Bronze Beetle',                               'Mithril Beetle',             'smash', 'risky — use first smash of day only'],
  ['2× Mithril Beetle',                              'Adamantine Beetle',          'smash', 'risky — use first smash of day only'],
  ['2× Adamantine Beetle',                           'Diamond Beetle',             'smash', 'risky — use first smash of day only'],
  ['2× Tin Flower',                                  'Bronze Flower',              'smash', 'risky — use first smash of day only'],
  ['2× Bronze Flower',                               'Mithril Flower',             'smash', 'risky — use first smash of day only'],
  ['2× Mithril Flower',                              'Adamantine Flower',          'smash', 'risky — use first smash of day only'],
  ['2× Adamantine Flower',                           'Diamond Flower',             'smash', 'risky — use first smash of day only'],
  // ── Smash — Beetle → Flower transmutation ────────────────────────────────────
  ['Tin Beetle + Junk Cube',                         'Tin Flower (random)',         'smash', 'one-way only'],
  ['Bronze Beetle + Junk Cube',                      'Bronze Flower (random)',      'smash', 'one-way only'],
  ['Mithril Beetle + Junk Cube',                     'Mithril Flower (random)',     'smash', 'one-way only'],
  ['Adamantine Beetle + Junk Cube',                  'Adamantine Flower (random)',  'smash', 'one-way only'],
  // ── Smash — Artifact creation ─────────────────────────────────────────────────
  ['Bronze Beetle + Bronze Pollen',                  'Nectar or Cattail',          'smash', 'random outcome'],
  ['Mithril Beetle + Mithril Pollen',                'Pinecone, Moss or Gunpowder','smash', 'random outcome'],
  // ── Smash — Artifact use ──────────────────────────────────────────────────────
  ['Nectar + Ladybug',                               'Monarch',                    'smash', ''],
  ['Cattail + Ladybug',                              'Pond Beetle',                'smash', ''],
  ['Pinecone + Pond Beetle',                         'Goliath Beetle',             'smash', ''],
  ['Moss + Pond Beetle',                             'Stag Beetle',                'smash', ''],
  ['Gunpowder + Pond Beetle',                        'Bombardier Beetle',          'smash', ''],
  ['Gunpowder + Moss + Pinecone',                    'Black Lotus',                'smash', ''],
  // ── Smash — Flower beetlecraft ────────────────────────────────────────────────
  ['Fringed Iris + Monarch/Pond (sac Purple)',        'Blue Longicorn Beetle',      'smash', ''],
  ['Royal Poinciana + Mithril Beetle',               'Giraffe Weevil',             'smash', ''],
  ['Camellia + Mithril Beetle',                      'Pillbug',                    'smash', ''],
  ['Morning Glory + Mithril Beetle',                 'Imperial Tortoise Beetle',   'smash', ''],
  ['Pincushion + Adamantine Beetle',                 'Sabertooth Longhorn Beetle', 'smash', ''],
  ['Gazania + Adamantine Beetle',                    'Sunset Moth',                'smash', ''],
  ['Black Lotus + Sabertooth Longhorn + Sunset Moth','Mars Rhino Beetle',          'smash', ''],
  ['Monarch + Two-spike Larkspur + Purple (sac)',    'Golden-Spotted Tiger Beetle','smash', ''],
  // ── Smash — Special ──────────────────────────────────────────────────────────
  ['Specimen Pin + Any Beetle + Green (sac)',         "That Beetle's Trophy",       'smash', 'any beetle species'],
];

const KNOWN_KEYS = new Set([
  ...CATEGORIES.flatMap(([, keys]) => keys),
  ...TROPHIES.map(([k]) => k),
]);
const HIDDEN = {
  has: (id) => id.endsWith('_shelf')
};
const BEETLES = CATEGORIES.find(([n]) => n === 'Beetles')[1];
const HAMMERS = CATEGORIES.find(([n]) => n === 'Hammers')[1];

const HAMMER_STATS = {
  hammer_t1: { bonus: 0,  breakPer: 10 },
  hammer_t2: { bonus: 5,  breakPer: 5  },
  hammer_t3: { bonus: 20, breakPer: 10 },
  hammer_t4: { bonus: 35, breakPer: 2  },
  hammer_t5: { bonus: 90, breakPer: 1  },
};

const TROPHY_REPEAT = {
  trophy_chinese_coin:  'chinese_coin',
  trophy_prism:         'prism',
  trophy_roman_dodeca:  'roman_dodeca',
  trophy_arrowhead:     'arrowhead',
  trophy_titanium_cube: 'titanium_cube',
  trophy_oriental_fan:  'oriental_fan',
  trophy_jade_cabbage:  'jade_cabbage',
  trophy_mokia:         'mokia',
  trophy_thumb_drive:    'thumb_drive',
  trophy_cult_medallion: 'cult_medallion',
  trophy_juex_card:      'juex_card',
  trophy_deck_of_cards:  'deck_of_cards',
  trophy_d20:            'd20',
  trophy_compass:        'compass',
  trophy_stradivarius:   'stradivarius',
  trophy_engraved_lighter: 'engraved_lighter',
  trophy_goya_miniature:  'goya_miniature',
  trophy_police_badge:   'police_badge',
  trophy_milady_fumoku:  'milady_fumoku',
  trophy_remilianet_id:     'remilianet_id',
};

// Keys for each smash recipe ingredient text → {sm0, sm1, sac} fill spec
// {k:'key'} = specific item, {t:'beetle'|'flower', r:'tin'|'brz'|'mth'|'adm'} = best of that type/rarity
const SMASH_FILL_MAP = new Map([
  ['2× Tin Beetle',         {sm0:{t:'beetle',r:'tin'}, sm1:{t:'beetle',r:'tin'}, sac:{t:'beetle',r:'tin'}}],
  ['2× Bronze Beetle',      {sm0:{t:'beetle',r:'brz'}, sm1:{t:'beetle',r:'brz'}, sac:{t:'beetle',r:'tin'}}],
  ['2× Mithril Beetle',     {sm0:{t:'beetle',r:'mth'}, sm1:{t:'beetle',r:'mth'}, sac:{t:'beetle',r:'tin'}}],
  ['2× Adamantine Beetle',  {sm0:{t:'beetle',r:'adm'}, sm1:{t:'beetle',r:'adm'}, sac:{t:'beetle',r:'tin'}}],
  ['2× Tin Flower',         {sm0:{t:'flower',r:'tin'}, sm1:{t:'flower',r:'tin'}, sac:{t:'beetle',r:'tin'}}],
  ['2× Bronze Flower',      {sm0:{t:'flower',r:'brz'}, sm1:{t:'flower',r:'brz'}, sac:{t:'beetle',r:'tin'}}],
  ['2× Mithril Flower',     {sm0:{t:'flower',r:'mth'}, sm1:{t:'flower',r:'mth'}, sac:{t:'beetle',r:'tin'}}],
  ['2× Adamantine Flower',  {sm0:{t:'flower',r:'adm'}, sm1:{t:'flower',r:'adm'}, sac:{t:'beetle',r:'tin'}}],
  ['Tin Beetle + Junk Cube',        {sm0:{t:'beetle',r:'tin'}, sm1:{k:'junk_cube_t1'}, sac:{t:'beetle',r:'tin'}}],
  ['Bronze Beetle + Junk Cube',     {sm0:{t:'beetle',r:'brz'}, sm1:{k:'junk_cube_t1'}, sac:{t:'beetle',r:'tin'}}],
  ['Mithril Beetle + Junk Cube',    {sm0:{t:'beetle',r:'mth'}, sm1:{k:'junk_cube_t1'}, sac:{t:'beetle',r:'tin'}}],
  ['Adamantine Beetle + Junk Cube', {sm0:{t:'beetle',r:'adm'}, sm1:{k:'junk_cube_t1'}, sac:{t:'beetle',r:'tin'}}],
  ['Bronze Beetle + Bronze Pollen', {sm0:{t:'beetle',r:'brz'}, sm1:{k:'pollen_uncommon'}, sac:{t:'beetle',r:'tin'}}],
  ['Mithril Beetle + Mithril Pollen',{sm0:{t:'beetle',r:'mth'}, sm1:{k:'pollen_rare'},    sac:{t:'beetle',r:'tin'}}],
  ['Nectar + Ladybug',       {sm0:{k:'nectar'},   sm1:{k:'ladybug'}, sac:{t:'beetle',r:'tin'}}],
  ['Cattail + Ladybug',      {sm0:{k:'cattail'},  sm1:{k:'ladybug'}, sac:{t:'beetle',r:'tin'}}],
  ['Pinecone + Pond Beetle', {sm0:{k:'pinecone'}, sm1:{k:'pond'},    sac:{t:'beetle',r:'tin'}}],
  ['Moss + Pond Beetle',     {sm0:{k:'moss'},     sm1:{k:'pond'},    sac:{t:'beetle',r:'tin'}}],
  ['Gunpowder + Pond Beetle',{sm0:{k:'gunpowder'},sm1:{k:'pond'},    sac:{t:'beetle',r:'tin'}}],
  ['Gunpowder + Moss + Pinecone',{sm0:{k:'gunpowder'}, sm1:{k:'moss'}, sac:{k:'pinecone'}}],
  ['Fringed Iris + Monarch (sac Purple)',   {sm0:{k:'fringed_iris'},sm1:{k:'monarch'},sac:{k:'purple'}}],
  ['Fringed Iris + Pond (sac Purple)',      {sm0:{k:'fringed_iris'},sm1:{k:'pond'},   sac:{k:'purple'}}],
  ['Royal Poinciana + Mithril Beetle',{sm0:{k:'royal_poinciana'},sm1:{t:'beetle',r:'mth'},sac:{t:'beetle',r:'tin'}}],
  ['Camellia + Mithril Beetle',       {sm0:{k:'camellia'},      sm1:{t:'beetle',r:'mth'},sac:{t:'beetle',r:'tin'}}],
  ['Morning Glory + Mithril Beetle',  {sm0:{k:'morning_glory'}, sm1:{t:'beetle',r:'mth'},sac:{t:'beetle',r:'tin'}}],
  ['Pincushion + Adamantine Beetle',  {sm0:{k:'pincushion'},    sm1:{t:'beetle',r:'adm'},sac:{t:'beetle',r:'tin'}}],
  ['Gazania + Adamantine Beetle',     {sm0:{k:'gazania'},       sm1:{t:'beetle',r:'adm'},sac:{t:'beetle',r:'tin'}}],
  ['Black Lotus + Sabertooth Longhorn + Sunset Moth',{sm0:{k:'black_lotus'},sm1:{k:'sabertooth_longhorn'},sac:{k:'sunset_moth'}}],
  ['Monarch + Two-spike Larkspur + Purple (sac)',    {sm0:{k:'monarch'},sm1:{k:'larkspur'},sac:{k:'purple'}}],
  ['Specimen Pin + Any Beetle + Green (sac)',         {sm0:{k:'specimen_pin'},sm1:{t:'beetle'},sac:{k:'green'}}],
]);

// ── HELPERS ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function iname(key) {
  return NAMES[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function rcls(key) { const r = RARITY[key]; return r ? `r-${r}` : ''; }

function fmtMs(ms) {
  if (ms === null) return { text: '—', cls: '' };
  if (ms <= 0) return { text: 'Ready', cls: 'ready' };
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return { text: `${h}h ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`, cls: 'waiting' };
  if (m > 0) return { text: `${m}m ${String(sec).padStart(2,'0')}s`, cls: 'waiting' };
  return { text: `${sec}s`, cls: 'waiting' };
}

function junkPool(inv) {
  const pool = [];
  for (const [k, qty] of Object.entries(inv))
    if (!KNOWN_KEYS.has(k) && !HIDDEN.has(k) && k !== 'cheese' && qty > 0)
      pool.push(...Array(qty).fill(k));
  return pool;
}

function craftCount(recipe, inv) {
  const counts = recipe.ing.map(ing => {
    if ('group' in ing) {
      const total = ing.group === 'junk'
        ? junkPool(inv).length
        : ing.group.reduce((s, k) => s + (inv[k] || 0), 0);
      return Math.floor(total / ing.qty);
    }
    return Math.floor((inv[ing.key] || 0) / ing.qty);
  });
  return counts.length ? Math.min(...counts) : 0;
}

function pickSlots(recipe, inv) {
  const slots = [];
  for (const ing of recipe.ing) {
    if ('group' in ing) {
      const pool = ing.group === 'junk'
        ? junkPool(inv)
        : [...ing.group].sort((a, b) => (inv[b] || 0) - (inv[a] || 0))
                        .flatMap(k => Array(inv[k] || 0).fill(k));
      if (pool.length < ing.qty) return null;
      slots.push(...pool.slice(0, ing.qty));
    } else {
      if ((inv[ing.key] || 0) < ing.qty) return null;
      slots.push(...Array(ing.qty).fill(ing.key));
    }
  }
  return slots;
}

const ALL_FLOWERS = [...TIN_FLOWERS,...BRONZE_FLOWERS,...MITHRIL_FLOWERS,...ADAM_FLOWERS,'black_lotus'];

const _FLOWER_SCENES = Object.entries(BG_SCENES).filter(([k]) => ALL_FLOWERS.includes(k)).map(([,v]) => v);
const _BEETLE_SCENES = Object.entries(BG_SCENES).filter(([k]) => BEETLES.includes(k)).map(([,v]) => v);
function _hashPick(arr, key) { return arr[key.split('').reduce((s,c) => s + c.charCodeAt(0), 0) % arr.length]; }

function getScene(key) {
  if (BG_SCENES[key]) return BG_SCENES[key];
  if (key.startsWith('pollen_')) return 'pollen_common.webp';
  if (key === 'junk_cube_t1' || key === 'junk_cube_t2' || (!KNOWN_KEYS.has(key) && !HIDDEN.has(key) && key !== 'cheese')) return 'junk.webp';
  if (ALL_FLOWERS.includes(key)) return _hashPick(_FLOWER_SCENES, key);
  if (BEETLES.includes(key)) return _hashPick(_BEETLE_SCENES, key);
  return null;
}

function resolveSmashSpec(s, exclude = []) {
  if (!s) return null;
  const inv = state.inv;
  if (s.k) return (inv[s.k] || 0) > 0 ? s.k : null;
  const pool = s.t === 'beetle' ? BEETLES : s.t === 'flower' ? ALL_FLOWERS : [];
  return pool
    .filter(k => (!s.r || RARITY[k] === s.r) && !exclude.includes(k) && (inv[k] || 0) > 0)
    .sort((a, b) => (inv[b] || 0) - (inv[a] || 0))[0] || null;
}

function smashCraftable(spec) {
  if (!spec) return false;
  const inv = state.inv;
  const total = (s) => {
    if (!s) return Infinity;
    if (s.k) return inv[s.k] || 0;
    const pool = s.t === 'beetle' ? BEETLES : s.t === 'flower' ? ALL_FLOWERS : [];
    return pool.filter(k => !s.r || RARITY[k] === s.r).reduce((n, k) => n + (inv[k] || 0), 0);
  };
  const { sm0, sm1, sac } = spec;
  if (sm0 && total(sm0) < 1) return false;
  if (sm1) {
    const linked = sm0 && ((sm0.t && sm0.t === sm1.t && sm0.r === sm1.r) || (sm0.k && sm0.k === sm1.k));
    if (linked ? total(sm0) < 2 : total(sm1) < 1) return false;
  }
  if (sac && total(sac) < 1) return false;
  return true;
}

function fillSmash(spec) {
  clearSlots('sm');
  const inv = state.inv;
  const s0 = resolveSmashSpec(spec?.sm0);
  if (s0) { slotState['sm0'] = s0; renderSlot('sm0'); }
  let ex1 = [];
  if (s0 && spec?.sm0 && spec?.sm1) {
    const linked = (spec.sm0.t && spec.sm0.t === spec.sm1.t && spec.sm0.r === spec.sm1.r)
                || (spec.sm0.k && spec.sm0.k === spec.sm1.k);
    if (linked && (inv[s0] || 0) < 2) ex1 = [s0];
  }
  const s1 = resolveSmashSpec(spec?.sm1, ex1);
  if (s1) { slotState['sm1'] = s1; renderSlot('sm1'); }
  const sac = resolveSmashSpec(spec?.sac, [s0, s1].filter(Boolean));
  if (sac) { slotState['smsac'] = sac; renderSlot('smsac'); }
  if (screenMode !== 'smash') setScreenMode('smash');
  else autofillSmashHammer();
}

function resultLabel(result) {
  const out = result?.result || {};
  return out.beetle_name || out.name || out.beetle || null;
}

function resolveSlotKeys(slotIds) {
  const pool = [...junkPool(state.inv)];
  return slotIds.map(id => {
    const k = slotState[id] || '';
    if (k !== '_junk_') return k;
    return pool.shift() || '';
  });
}

function previewAssemble() {
  const keys = ['asm0','asm1','asm2','asm3'].map(id => slotState[id] || null).filter(Boolean);
  if (!keys.length) return null;
  for (const r of AR) {
    const remaining = [...keys];
    let match = true;
    for (const ing of r.ing) {
      for (let q = 0; q < ing.qty; q++) {
        let foundIdx = -1;
        for (let i = 0; i < remaining.length; i++) {
          const k = remaining[i];
          if ('group' in ing) {
            if (ing.group === 'junk') {
              if (k === '_junk_' || (!KNOWN_KEYS.has(k) && !HIDDEN.has(k) && k !== 'cheese'))
                { foundIdx = i; break; }
            } else if (Array.isArray(ing.group) && ing.group.includes(k)) {
              foundIdx = i; break;
            }
          } else if ('key' in ing && ing.key === k) {
            foundIdx = i; break;
          }
        }
        if (foundIdx === -1) { match = false; break; }
        remaining.splice(foundIdx, 1);
      }
      if (!match) break;
    }
    if (match && remaining.length === 0) {
      const repeatKey = TROPHY_REPEAT[r.out];
      const ownsTrophy = repeatKey && (state.inv[r.out] || 0) > 0;
      return ownsTrophy ? { name: iname(repeatKey), key: repeatKey } : { name: r.name, key: r.out };
    }
  }
  return null;
}

function resultKey(result) {
  const out = result?.result || {};
  for (const c of [out.beetle, out.item]) {
    if (c && (IMAGES[c] || NAMES[c])) return c;
  }
  const name = resultLabel(result);
  if (name) {
    const entry = Object.entries(NAMES).find(([, v]) => v === name);
    if (entry) return entry[0];
  }
  return null;
}

function setResult(elId, text, key = null) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  const imgSrc = key ? IMAGES[key] : null;
  if (imgSrc) {
    const i = document.createElement('img');
    i.src = imgSrc;
    i.style.cssText = 'width:16px;height:16px;object-fit:contain;flex-shrink:0;vertical-align:middle;margin-right:3px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.9))';
    el.appendChild(i);
  }
  const s = document.createElement('span');
  s.textContent = text;
  el.appendChild(s);
}

function autofillSmashHammer() {
  if (slotState['smhammer']) return;
  const best = [...HAMMERS].reverse().find(h => (state.inv[h] || 0) > 0);
  if (best) { slotState['smhammer'] = best; renderSlot('smhammer'); }
}

function previewSmash() {
  const s1 = slotState['sm0'] || null;
  const s2 = slotState['sm1'] || null;
  const sac = slotState['smsac'] || null;
  if (!s1) return null;

  const R = RARITY;
  const isBeetle = k => k && BEETLES.includes(k);
  const isFlower = k => k && [...TIN_FLOWERS,...BRONZE_FLOWERS,...MITHRIL_FLOWERS,...ADAM_FLOWERS,'black_lotus'].includes(k);
  const tierName = { tin:'Bronze', brz:'Mithril', mth:'Adamantine', adm:'Diamond' };
  const tierFlower = { tin:'Tin', brz:'Bronze', mth:'Mithril', adm:'Adamantine' };

  // Tier up — both item slots same rarity same category
  if (s2 && R[s1] && R[s1] === R[s2] && tierName[R[s1]]) {
    if (isBeetle(s1) && isBeetle(s2))
      return { out: `${tierName[R[s1]]} Beetle`, note: 'Tier Up — risky' };
    if (isFlower(s1) && isFlower(s2))
      return { out: `${tierName[R[s1]]} Flower`, note: 'Tier Up — risky' };
  }

  // Beetle → flower transmutation
  const btf = (b, j) => isBeetle(b) && j === 'junk_cube_t1' && tierFlower[R[b]]
    ? { out: `${tierFlower[R[b]]} Flower (random)`, note: 'one-way' } : null;
  const btfResult = btf(s1, s2) || btf(s2, s1);
  if (btfResult) return btfResult;

  // Artifact creation
  const artCreate = (beetle, pollen) => {
    if (isBeetle(beetle) && R[beetle] === 'brz' && pollen === 'pollen_uncommon')
      return { out: 'Nectar or Cattail', note: 'random' };
    if (isBeetle(beetle) && R[beetle] === 'mth' && pollen === 'pollen_rare')
      return { out: 'Pinecone, Moss or Gunpowder', note: 'random' };
    return null;
  };
  const art = artCreate(s1, s2) || artCreate(s2, s1);
  if (art) return art;

  // Artifact use & specific beetle crafting (check both slot orderings)
  const exactMatch = (a, b) => {
    const pair = `${a}+${b}`;
    return ({
      'nectar+ladybug':        { out: 'Monarch',                 note: '' },
      'cattail+ladybug':       { out: 'Pond Beetle',             note: '' },
      'pinecone+pond':         { out: 'Goliath Beetle',          note: '' },
      'moss+pond':             { out: 'Stag Beetle',             note: '' },
      'gunpowder+pond':        { out: 'Bombardier Beetle',       note: '' },
      'royal_poinciana+monarch':{ out: 'Giraffe Weevil',         note: '' },
      'royal_poinciana+pond':  { out: 'Giraffe Weevil',         note: '' },
      'camellia+monarch':      { out: 'Pillbug',                 note: '' },
      'camellia+pond':         { out: 'Pillbug',                 note: '' },
      'morning_glory+monarch': { out: 'Imperial Tortoise Beetle',note: '' },
      'morning_glory+pond':    { out: 'Imperial Tortoise Beetle',note: '' },
      'pincushion+goliath':    { out: 'Sabertooth Longhorn Beetle', note: '' },
      'pincushion+stag':       { out: 'Sabertooth Longhorn Beetle', note: '' },
      'pincushion+bombardier': { out: 'Sabertooth Longhorn Beetle', note: '' },
      'gazania+goliath':       { out: 'Sunset Moth',             note: '' },
      'gazania+stag':          { out: 'Sunset Moth',             note: '' },
      'gazania+bombardier':    { out: 'Sunset Moth',             note: '' },
      'monarch+larkspur':      { out: 'Golden-Spotted Tiger Beetle', note: '' },
    })[pair] || null;
  };
  const exact = exactMatch(s1, s2) || exactMatch(s2, s1);
  if (exact) return exact;

  // Specimen pin recipe
  if ((s1 === 'specimen_pin' || s2 === 'specimen_pin') && isBeetle(s1 === 'specimen_pin' ? s2 : s1))
    return { out: "That Beetle's Trophy", note: 'sacrifice = green beetle' };

  // 3-item recipes (slot1 + slot2 + sacrifice for display only)
  if (s1 === 'gunpowder' && s2 === 'moss' && sac === 'pinecone')
    return { out: 'Black Lotus', note: '' };
  if (s1 === 'sabertooth_longhorn' && s2 === 'sunset_moth')
    return { out: 'Mars Rhino Beetle', note: 'needs Black Lotus somewhere' };

  return null;
}

function setResultIcon(key) {
  const el = document.getElementById('screen-result-icon');
  if (!el) return;
  const img = key ? IMAGES[key] : null;
  if (img) {
    el.innerHTML = `<img src="${img}" alt="">`;
    el.classList.add('visible');
  } else {
    el.innerHTML = '';
    el.classList.remove('visible');
  }
}

function updatePreviews() {
  const asmEl = document.getElementById('asm-preview');
  if (asmEl) {
    const result = previewAssemble();
    asmEl.textContent = result ? `→ ${result.name}` : '—';
    if (screenMode === 'assemble') setResultIcon(result?.key || null);
  }
  const smEl = document.getElementById('smash-preview');
  if (smEl) {
    const s1 = slotState['sm0'];
    if (!s1) { smEl.innerHTML = '—'; if (screenMode === 'smash') setResultIcon(null); return; }

    const preview = previewSmash();
    smEl.innerHTML = '';
    const line1 = document.createElement('div');
    line1.textContent = preview
      ? `→ ${preview.out}${preview.note ? ' (' + preview.note + ')' : ''}`
      : '→ Unknown';
    smEl.appendChild(line1);

    const hammer = slotState['smhammer'];
    const hs = hammer && HAMMER_STATS[hammer];
    if (hs) {
      const liveData = (state.hammers || []).find(h => h.hammer === hammer);
      const breakRate = liveData ? liveData.break_rate : hs.breakPer;
      const line2 = document.createElement('div');
      line2.className = 'smash-hstat';
      line2.textContent = `+${hs.bonus}% craft bonus`;
      smEl.appendChild(line2);
      const line3 = document.createElement('div');
      line3.className = `smash-hstat smash-break${breakRate >= 50 ? ' smash-break-danger' : breakRate >= 20 ? ' smash-break-warn' : ''}`;
      line3.textContent = `HAMMER BREAK CHANCE: ${breakRate}%`;
      smEl.appendChild(line3);
    }

    if (screenMode === 'smash') {
      const key = preview ? Object.entries(NAMES).find(([, v]) => v === preview.out)?.[0] : null;
      setResultIcon(key || null);
    }
  }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
const getTokens  = ()         => ({ access: localStorage.getItem(LS_ACCESS), refresh: localStorage.getItem(LS_REFRESH) });
const saveTokens = (a, r)     => { if (a) localStorage.setItem(LS_ACCESS, a); if (r) localStorage.setItem(LS_REFRESH, r); };
const clearAuth  = ()         => { localStorage.removeItem(LS_ACCESS); localStorage.removeItem(LS_REFRESH); };

async function oidc(params) {
  try {
    const r = await fetch(OIDC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: 'profile', ...params }),
    });
    const d = await r.json();
    if (!r.ok) return { error: d.error, desc: d.error_description || '' };
    return d.access_token ? { access: d.access_token, refresh: d.refresh_token } : null;
  } catch { return null; }
}

async function tryRefresh() {
  const { refresh } = getTokens();
  if (!refresh) return null;
  const r = await oidc({ grant_type: 'refresh_token', refresh_token: refresh });
  return r?.access ? r : null;
}

// ── API ───────────────────────────────────────────────────────────────────────
async function apiCall(method, path, body = null, _retry = true) {
  const { access } = getTokens();
  if (!access) { showLogin(); return null; }
  let r;
  try {
    if (USE_PROXY) {
      r = await fetch(PROXY_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, path, body, token: access }),
      });
    } else {
      const opts = { method, headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${access}` } };
      if (body !== null) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
      r = await fetch(`${BASE_URL}${path}`, opts);
    }
  } catch (e) { log(`Network error: ${e.message}`, 'err'); return null; }

  if ((r.status === 401 || r.status === 403) && _retry) {
    const tokens = await tryRefresh();
    if (tokens) { saveTokens(tokens.access, tokens.refresh); return apiCall(method, path, body, false); }
    showLogin(); return null;
  }
  if (r.status === 429) {
    if (Date.now() - lastRateLimitLog > 5000) {
      lastRateLimitLog = Date.now();
      log('You are beetle-gaming too hard. Slow down! 🪲💨', 'warn');
    }
    return null;
  }
  if (!r.ok) {
    try { const d = await r.json(); return { success: false, ...d }; }
    catch { return { success: false, message: `HTTP ${r.status}` }; }
  }
  return r.json().catch(() => null);
}

const apiGet  = path        => apiCall('GET',  path);
const apiPost = (path, body) => apiCall('POST', path, body ?? {});

// ── STATE ─────────────────────────────────────────────────────────────────────
let state = {
  user: null, inv: {},
  fetchedAt: 0,
  storedCds: { catchBeetle: null, beetleHunt: null, claimUBC: null, junkFaucet: null },
};
let refreshTimer = null, tickTimer = null;
let prevCdStates = {};
let lastRateLimitLog = 0;
let chatPollTimer = null;
let chatLastId    = null;
let replyTarget   = null; // {id, username, displayname, body}
const renderedPostEls = new Map(); // msgId → element
const CHAT_REACTS = ['😹', '🤍', '👍', '🪲'];
let reactPollTimer = null;

async function loadState(silent = false) {
  const user = await apiGet('/api/beetle/user');
  if (!user) return;
  state.user    = user;
  state.inv     = user.inventory || {};
  state.hammers = user.hammers   || [];
  // Preserve locally-tracked cooldowns when the API doesn't return them
  const elapsed = Date.now() - state.fetchedAt;
  const prev    = state.storedCds;
  state.fetchedAt = Date.now();
  const keep = k => prev[k] !== null ? Math.max(0, prev[k] - elapsed) : null;
  state.storedCds = {
    catchBeetle: user.cooldowns?.catchBeetle ?? keep('catchBeetle'),
    beetleHunt:  user.cooldowns?.beetleHunt  ?? keep('beetleHunt'),
    claimUBC:    user.cooldowns?.claimUBC    ?? keep('claimUBC'),
    junkFaucet:  user.cooldowns?.junkFaucet  ?? keep('junkFaucet'),
  };
  if (!silent) renderAll();
}

function currentCds() {
  const elapsed = Date.now() - state.fetchedAt;
  const r = {};
  for (const [k, v] of Object.entries(state.storedCds))
    r[k] = v === null ? null : Math.max(0, v - elapsed);
  return r;
}

// ── LOG ───────────────────────────────────────────────────────────────────────
function log(msg, cls = '') {
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} `;
  logMessages.unshift({ msg, cls, ts });
  if (logMessages.length > 16) logMessages.length = 16;
  if (screenMode === 'item') setScreenMode('log');
  renderLog();
}

function renderLog() {
  const el = document.getElementById('act-log');
  if (!el) return;
  el.innerHTML = '';
  for (const { msg, cls, ts } of logMessages) {
    const line = document.createElement('div');
    line.className = 'log-line';
    const tsEl = document.createElement('span');
    tsEl.className = 'log-ts';
    tsEl.textContent = ts || '';
    line.appendChild(tsEl);
    const msgEl = document.createElement('span');
    if (cls) msgEl.className = `log-${cls}`;
    msgEl.textContent = msg;
    line.appendChild(msgEl);
    el.appendChild(line);
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderAll() {
  tick();
  renderHeader();
  renderInventory();
  renderBeetledex();
  renderTrophies();
  renderCraftable();
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default')
    Notification.requestPermission();
}
function notify(body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification('BeetleBoy SP', { body, icon: 'icons/beetles/green.png' });
}

function tick() {
  const cds = currentCds();
  const map = [
    ['cd-claim',  'act-claim',  'catchBeetle', 'Claim Beetle'],
    ['cd-hunt',   'act-hunt',   'beetleHunt',  'Hunt Beetle'],
    ['cd-ubc',    'act-ubc',    'claimUBC',    'Claim UBC'],
    ['cd-faucet', 'act-faucet', 'junkFaucet',  'Junk Faucet'],
  ];
  for (const [cdId, btnId, key, label] of map) {
    const cdEl = document.getElementById(cdId);
    if (key === 'beetleHunt' && cds[key] === null) {
      cdEl.innerHTML = '<span class="hunt-null-hint">Try once to get CD</span>';
      cdEl.className = 'btn-cd';
    } else {
      const { text, cls } = fmtMs(cds[key]);
      cdEl.textContent = text;
      cdEl.className = `btn-cd ${cls}`;
    }
    document.getElementById(btnId).classList.toggle('is-ready', cds[key] === 0);
    if (prevCdStates[key] > 0 && cds[key] === 0) notify(`${label} is ready!`);
    prevCdStates[key] = cds[key];
  }
}

function renderHeader() {
  const u = state.user;
  if (!u) return;
  document.getElementById('header-user').textContent = u.username || '—';
  const cheese = state.inv.cheese || 0;
  document.getElementById('screen-cheese').textContent = cheese ? `🧀 ${cheese.toLocaleString()}` : '';
  const lvlEl = document.getElementById('screen-level');
  if (lvlEl) lvlEl.textContent = u.level != null ? `LVL ${u.level}` : '';
}

// ── SCREEN PANE / SLOT SYSTEM ─────────────────────────────────────────────────
let screenMode = 'log'; // 'log' | 'assemble' | 'smash' | 'item'
let lastActionCtx = 'beetle'; // 'beetle' | 'cheese'
let currentItemKey = null;
const slotState = {}; // slotId → itemKey | null
const logMessages = []; // { msg, cls }[], newest first

function updateScreenBg(mode) {
  const imgDiv = document.getElementById('screen-bg-img');
  const vid    = document.getElementById('screen-bg-vid');
  if (!imgDiv || !vid) return;

  if (mode === 'assemble' || mode === 'smash') {
    const src = mode === 'assemble' ? 'img/assemblyloop.mp4' : 'img/smashloop.mp4';
    if (vid.getAttribute('src') !== src) { vid.src = src; vid.load(); }
    vid.style.opacity = '1';
    vid.play().catch(() => {});
  } else {
    vid.pause();
    vid.style.opacity = '0';
    const imgSrc = mode === 'item' || lastActionCtx !== 'cheese'
      ? 'img/morning_poster.webp'
      : 'img/cheese_empty_poster.webp';
    imgDiv.style.backgroundImage = `url('${imgSrc}')`;
    imgDiv.style.backgroundSize     = 'cover';
    imgDiv.style.backgroundPosition = 'center';
  }
}

function setScreenMode(mode) {
  if (screenMode === mode && mode !== 'item') mode = 'log';
  screenMode = mode;
  document.getElementById('sp-log').classList.toggle('hidden',      mode !== 'log');
  document.getElementById('sp-assemble').classList.toggle('hidden',  mode !== 'assemble');
  document.getElementById('sp-smash').classList.toggle('hidden',     mode !== 'smash');
  document.getElementById('sp-item').classList.toggle('hidden',      mode !== 'item');
  document.getElementById('act-assemble').classList.toggle('active', mode === 'assemble');
  document.getElementById('act-smash').classList.toggle('active',    mode === 'smash');
  document.getElementById('btn-esc').classList.toggle('esc-inactive', mode === 'log');
  updateScreenBg(mode);
  if (mode === 'smash') autofillSmashHammer();
  if (mode !== 'assemble' && mode !== 'smash') setResultIcon(null);
  updatePreviews();
}

function slotHtml(slotId, key) {
  if (!key) return ''; // empty = default HTML in index.html
  let img = IMAGES[key];
  if (key === '_junk_') {
    const pool = junkPool(state.inv);
    if (pool.length) img = IMAGES[pool[Math.floor(Math.random() * pool.length)]] || img;
  }
  const scene = getScene(key);
  const name  = iname(key);
  const bgStyle = scene ? `style="background-image:url('${scene}');background-size:cover;background-position:center"` : '';
  return `${scene ? `<div class="sm-slot-scene" ${bgStyle}></div><div class="sm-slot-overlay"></div>` : ''}
    ${img ? `<img class="sm-slot-img" src="${img}" alt="">` : `<div class="sm-slot-lbl">${esc(name.slice(0,9))}</div>`}
    <div class="sm-slot-name">${esc(name)}</div>
    <button class="sm-slot-x" data-clear="${slotId}">✕</button>`;
}

function renderSlot(slotId) {
  const el = document.querySelector(`.sm-slot[data-slot="${slotId}"]`);
  if (!el) return;
  const key = slotState[slotId] || null;
  el.classList.toggle('filled', !!key);
  if (key) {
    el.innerHTML = slotHtml(slotId, key);
    el.querySelector('.sm-slot-x').addEventListener('click', e => {
      e.stopPropagation(); slotState[slotId] = null; renderSlot(slotId);
    });
  } else {
    const lbls = { asm0:'Slot 1', asm1:'Slot 2', asm2:'Slot 3', asm3:'Slot 4',
                   sm0:'Slot 1', sm1:'Slot 2 (opt)', smsac:'Sacrifice', smhammer:'Hammer' };
    el.innerHTML = `<span class="sm-slot-lbl">${lbls[slotId] || slotId}</span>`;
  }
  updatePreviews();
}

function wireSlots() {
  document.querySelectorAll('.sm-slot').forEach(el => {
    const id = el.dataset.slot;

    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('dragover');
      const key = e.dataTransfer.getData('text/plain');
      if (key) { slotState[id] = key; renderSlot(id); }
    });

    // Click an empty slot → no-op (items go in via inventory card clicks or drag)
    el.addEventListener('click', () => {});
  });
}

function clearSlots(prefix) {
  ['asm0','asm1','asm2','asm3','sm0','sm1','smsac','smhammer'].forEach(id => {
    if (id.startsWith(prefix)) { slotState[id] = null; renderSlot(id); }
  });
  const resultId = prefix === 'asm' ? 'asm-result' : 'smash-result2';
  const el = document.getElementById(resultId);
  if (el) el.textContent = '';
  updatePreviews();
}

function openCard(key) {
  if (screenMode === 'item' && currentItemKey === key) { setScreenMode('log'); currentItemKey = null; return; }
  currentItemKey = key;
  setScreenMode('item');

  if (key === '_junk_') {
    const pool   = junkPool(state.inv);
    const imgEl  = document.getElementById('spi-img');
    const nameEl = document.getElementById('spi-name');
    const qtyEl  = document.getElementById('spi-qty');
    const rcpEl  = document.getElementById('spi-rcp');
    const icon   = IMAGES['junk_cube_t1'];
    imgEl.innerHTML = icon
      ? `<img src="${icon}" alt="" style="position:relative;z-index:1;width:100%;height:100%;object-fit:contain;padding:22px;display:block;filter:drop-shadow(0 2px 10px rgba(0,0,0,0.9))">`
      : '';
    nameEl.textContent = 'Junk Items';
    qtyEl.textContent  = `×${pool.length} in inventory`;
    rcpEl.innerHTML    = `<div class="spi-rcp-title">ASSEMBLE</div><div class="spi-rcp-row">Any Junk ×2 → Junk Cube</div>`;
    return;
  }

  const inv     = state.inv;
  const imgEl   = document.getElementById('spi-img');
  const nameEl  = document.getElementById('spi-name');
  const qtyEl   = document.getElementById('spi-qty');
  const rcpEl   = document.getElementById('spi-rcp');

  // Left: image area
  const cardImg = IMAGES[`_card_${key}`];
  const iconImg = IMAGES[key];
  const scene   = getScene(key);
  let imgHtml = '';
  if (scene) {
    imgHtml += `<div style="position:absolute;inset:0;background-image:url('${scene}');background-size:cover;background-position:center"></div>`;
    imgHtml += `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.32)"></div>`;
  }
  if (cardImg) {
    imgHtml += `<img src="${cardImg}" alt="" style="position:relative;z-index:1;width:100%;height:100%;object-fit:contain;display:block">`;
  } else if (iconImg) {
    imgHtml += `<img src="${iconImg}" alt="" style="position:relative;z-index:1;width:100%;height:100%;object-fit:contain;padding:22px;display:block;filter:drop-shadow(0 2px 10px rgba(0,0,0,0.9))">`;
  } else {
    imgHtml += `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.25);font-size:12px">${esc(iname(key).slice(0,12))}</div>`;
  }
  imgEl.innerHTML = imgHtml;

  // Right: name + scientific name + description + qty
  nameEl.innerHTML = '';
  const nameTxt = document.createElement('div');
  nameTxt.className = 'spi-name-main';
  nameTxt.textContent = iname(key);
  nameEl.appendChild(nameTxt);
  const rarityLabels = { tin:'Tin', brz:'Bronze', mth:'Mithril', adm:'Adamantine', dia:'Diamond', pnk:'Special', jnk:'Junk' };
  const r = RARITY[key];
  if (r && rarityLabels[r]) {
    const rarEl = document.createElement('div');
    rarEl.className = `spi-rarity r-${r}`;
    rarEl.textContent = rarityLabels[r];
    nameEl.appendChild(rarEl);
  }
  const sci = SCIENTIFIC[key];
  if (sci) {
    const sciEl = document.createElement('div');
    sciEl.className = 'spi-sci';
    sciEl.textContent = sci;
    nameEl.appendChild(sciEl);
  }

  qtyEl.innerHTML = '';
  const desc = DESCRIPTIONS[key];
  if (desc) {
    const descEl = document.createElement('div');
    descEl.className = 'spi-desc';
    descEl.textContent = `"${desc}"`;
    qtyEl.appendChild(descEl);
  }
  const qtyTxt = document.createElement('div');
  qtyTxt.className = 'spi-qty-count';
  qtyTxt.textContent = `×${inv[key] || 0} in inventory`;
  qtyEl.appendChild(qtyTxt);

  // Crafting recipe for this item
  const recipe = AR_BY_OUT[key];
  let rcpHtml = '';
  if (recipe) {
    const idx = AR.indexOf(recipe);
    const ingDesc = recipe.ing.map(ing =>
      'group' in ing ? `${ingGroupLabel(ing.group)} ×${ing.qty}` : `${iname(ing.key)} ×${ing.qty}`
    ).join(' + ');
    rcpHtml += `<div class="spi-rcp-title">ASSEMBLE</div><div class="spi-rcp-row spi-rcp-clickable" data-rcp="${idx}">${ingDesc}</div>`;
  }

  // Recipes that USE this item as an ingredient
  const usedIn = AR.filter(r => r.ing.some(ing => {
    if ('key' in ing) return ing.key === key;
    if ('group' in ing) {
      if (ing.group === 'junk') return !KNOWN_KEYS.has(key) && !HIDDEN.has(key) && key !== 'cheese';
      return Array.isArray(ing.group) && ing.group.includes(key);
    }
    return false;
  }));
  if (usedIn.length) {
    rcpHtml += `<div class="spi-rcp-title">USED IN</div>`;
    usedIn.forEach(r => {
      const idx = AR.indexOf(r);
      const ingDesc = r.ing.map(ing =>
        'group' in ing ? `${ingGroupLabel(ing.group)} ×${ing.qty}` : `${iname(ing.key)} ×${ing.qty}`
      ).join(' + ');
      rcpHtml += `<div class="spi-rcp-row spi-rcp-clickable" data-rcp="${idx}">${ingDesc} → ${esc(r.name)}</div>`;
    });
  }

  // Smash recipes — match full item name to avoid false positives (e.g. "Junk" matching all junk smashes)
  const fullName = iname(key).toLowerCase();
  const smashRows = HAMMERS.includes(key) ? [] : RECIPES.filter(([ing, out, typ]) =>
    typ === 'smash' && (out.toLowerCase().includes(fullName) || ing.toLowerCase().includes(fullName))
  );

  if (!rcpHtml && !smashRows.length) rcpHtml = `<div class="spi-rcp-title" style="margin-top:4px">No recipes found</div>`;
  rcpEl.innerHTML = rcpHtml;

  // Make assemble rows clickable
  rcpEl.querySelectorAll('.spi-rcp-row[data-rcp]').forEach(row => {
    const r = AR[parseInt(row.dataset.rcp)];
    if (!r) return;
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      clearSlots('asm');
      const slots = pickSlots(r, state.inv);
      if (slots) ['asm0','asm1','asm2','asm3'].forEach((id, i) => { if (slots[i]) { slotState[id] = slots[i]; renderSlot(id); } });
      setScreenMode('assemble');
    });
  });

  // Add smash rows with click support
  if (smashRows.length) {
    const title = document.createElement('div');
    title.className = 'spi-rcp-title';
    title.textContent = 'SMASH';
    rcpEl.appendChild(title);
    smashRows.forEach(([ing, out,, note]) => {
      const spec = SMASH_FILL_MAP.get(ing);
      const row = document.createElement('div');
      row.className = 'spi-rcp-row' + (spec ? ' spi-rcp-clickable' : '');
      row.innerHTML = `${esc(ing)} → ${esc(out)}${note ? ` <em>(${note})</em>` : ''}`;
      if (spec) row.addEventListener('click', () => fillSmash(spec));
      rcpEl.appendChild(row);
    });
  }
}

function iccHtml(k, qty) {
  let img = IMAGES[k];
  if (k === '_junk_') {
    const pool = junkPool(state.inv);
    if (pool.length) img = IMAGES[pool[Math.floor(Math.random() * pool.length)]] || img;
  }
  const scene = getScene(k);
  const rc    = rcls(k);
  const name  = iname(k);
  const bgStyle = scene ? `background-image:url('${scene}');background-size:cover;background-position:center` : '';
  return `<div class="icc ${rc}" data-key="${esc(k)}" draggable="true" title="${esc(name)} ×${qty}">
    <div class="icc-media" style="${bgStyle}">
      ${scene ? '<div class="icc-scene-overlay"></div>' : ''}
      ${img
        ? `<img class="icc-img" src="${img}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="icc-fallback">${esc(name.slice(0, 9))}</div>`}
      <span class="icc-count">×${qty}</span>
    </div>
    <div class="icc-label">${esc(name)}</div>
  </div>`;
}

function renderInventory() {
  const inv = state.inv;
  const junkTotal = junkPool(inv).length;

  let html = '';
  for (const [cat, keys] of CATEGORIES) {
    const items = keys.filter(k => inv[k] > 0);
    const junkCard = cat === 'Junk' && junkTotal > 0 ? [iccHtml('_junk_', junkTotal)] : [];
    if (!items.length && !junkCard.length) continue;
    const grid = [...items.map(k => iccHtml(k, inv[k])), ...junkCard].join('');
    html += `<div class="inv-section">
      <div class="inv-section-title">${cat}</div>
      <div class="icc-grid">${grid}</div>
    </div>`;
  }
  const el = document.getElementById('left-mode-inv');
  el.innerHTML = html;
  el.querySelectorAll('.icc[data-key]').forEach(card => {
    const k = card.dataset.key;
    card.addEventListener('click', () => {
      if (screenMode === 'assemble') {
        if (!BEETLES.includes(k)) {
          const slots = ['asm0','asm1','asm2','asm3'];
          const empty = slots.find(s => !slotState[s]);
          if (empty) { slotState[empty] = k; renderSlot(empty); return; }
        }
      } else if (screenMode === 'smash') {
        if (HAMMERS.includes(k)) {
          slotState['smhammer'] = k; renderSlot('smhammer'); return;
        }
        const slots = BEETLES.includes(k) ? ['smsac','sm0','sm1']
                    : k === '_junk_'       ? ['sm0','sm1']
                    : ['sm0','sm1','smsac'];
        const empty = slots.find(s => !slotState[s]);
        if (empty) { slotState[empty] = k; renderSlot(empty); return; }
      }
      openCard(k);
    });
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', k);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
}

function renderTrophies() {
  const inv = state.inv;
  const owned  = TROPHIES.filter(([k]) => (inv[k] || 0) > 0).length;
  const total  = TROPHIES.length;

  const rows = TROPHIES.map(([key, tname, known]) => {
    const have = (inv[key] || 0) > 0;
    if (have) {
      return `<div class="tr-row tr-owned">
        <span class="tr-check">✓</span>
        <span class="tr-name">${esc(tname)}</span>
      </div>`;
    }
    if (known) {
      const recipe = AR_BY_OUT[key];
      let needHtml = '';
      if (recipe) {
        const parts = [];
        for (const ing of recipe.ing) {
          let cur, label;
          if ('group' in ing) {
            cur   = ing.group === 'junk' ? junkPool(inv).length : ing.group.reduce((s, k) => s + (inv[k] || 0), 0);
            label = ingGroupLabel(ing.group);
          } else { cur = inv[ing.key] || 0; label = iname(ing.key); }
          const short = Math.max(0, ing.qty - cur);
          const cls   = short > 0 ? 'tr-need' : 'tr-have';
          parts.push(`<span class="${cls}">${esc(label)} ${cur}/${ing.qty}</span>`);
        }
        needHtml = `<div class="tr-ing">${parts.join('<span class="tr-plus"> + </span>')}</div>`;
      } else {
        needHtml = `<div class="tr-ing tr-hunt">Obtained through beetle hunting</div>`;
      }
      return `<div class="tr-row tr-uncollected">
        <span class="tr-check">○</span>
        <span class="tr-name">${esc(tname)}</span>
        ${needHtml}
      </div>`;
    }
    return `<div class="tr-row tr-unknown">
      <span class="tr-check">?</span>
      <span class="tr-name">${esc(tname)}</span>
    </div>`;
  }).join('');

  document.getElementById('left-mode-trphy').innerHTML =
    `<div class="tr-header">${owned} / ${total} collected</div>` +
    `<div class="tr-list">${rows}</div>`;
}

function renderCraftable() {
  const inv = state.inv;
  const craftable = AR
    .filter(r => !(r.unique && (inv[r.out] || 0) > 0 && !TROPHY_REPEAT[r.out]))
    .filter(r => !r.reqTrophy || (inv[r.reqTrophy] || 0) > 0)
    .map(r => ({ r, n: craftCount(r, inv) }))
    .filter(({ n }) => n > 0);

  const el = document.getElementById('craftable-list');
  if (!craftable.length) {
    el.innerHTML = '<span class="nothing-craftable">Nothing craftable right now.</span>';
    return;
  }

  el.innerHTML = craftable.map(({ r, n }, i) => {
    const repeatKey  = TROPHY_REPEAT[r.out];
    const ownsTrophy = repeatKey && (inv[r.out] || 0) > 0;
    const displayKey  = ownsTrophy ? repeatKey : r.out;
    const displayName = ownsTrophy ? iname(repeatKey) : r.name;
    const icon = IMAGES[displayKey]
      ? `<img class="craft-icon" src="${IMAGES[displayKey]}" alt="">`
      : `<span class="craft-icon"></span>`;
    const ingHtml = r.ing.map(ing => {
      let label, have;
      if ('group' in ing) {
        have  = ing.group === 'junk' ? junkPool(inv).length : ing.group.reduce((s, k) => s + (inv[k] || 0), 0);
        label = ingGroupLabel(ing.group);
      } else {
        have  = inv[ing.key] || 0;
        label = iname(ing.key);
      }
      const cls = have < ing.qty ? 'ing-need' : '';
      return `<span class="${cls}">${label} ×${ing.qty}</span>`;
    }).join(' <span style="color:rgba(60,90,140,0.6)">+</span> ');
    return `<div class="craft-row" data-idx="${i}">
        ${icon}
        <span class="craft-name ${rcls(displayKey)}">${esc(displayName)}</span>
        <span class="craft-count">×${n}</span>
        <input class="craft-repeat-input" type="number" min="1" max="99" value="1" title="Repeat">
        <button class="craft-do-btn" data-idx="${i}">craft</button>
      </div>
      <div class="craft-expand hidden" data-exp="${i}">
        <div class="craft-ing">${ingHtml}</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.craft-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.classList.contains('craft-do-btn') || e.target.classList.contains('craft-repeat-input')) return;
      const exp = el.querySelector(`.craft-expand[data-exp="${row.dataset.idx}"]`);
      if (exp) exp.classList.toggle('hidden');
    });
  });

  el.querySelectorAll('.craft-do-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const { r, n } = craftable[+btn.dataset.idx];
      const repeatInput = btn.closest('.craft-row').querySelector('.craft-repeat-input');
      const repeatCount = Math.max(1, Math.min(99, parseInt(repeatInput?.value) || 1));
      btn.disabled = true;
      log(repeatCount > 1 ? `Crafting ${n} ×${repeatCount}…` : `Crafting ${n}…`);
      let successCount = 0, lastLabel = '', trophyCrafted = null;
      for (let i = 0; i < repeatCount; i++) {
        const slots = pickSlots(r, state.inv);
        if (!slots) { log('Not enough materials.', 'warn'); break; }
        const [s1, s2, s3, s4] = slots;
        const body = { type: 1, slot1: s1, slot2: s2, ...(s3 ? { slot3: s3 } : {}), ...(s4 ? { slot4: s4 } : {}) };
        const result = await apiPost('/api/beetle/action/craft', body);
        if (!result) break;
        if (result.success === false) { log(result.message || 'Failed.', 'warn'); break; }
        lastLabel = resultLabel(result) || 'done';
        const rk = resultKey(result);
        if (rk?.startsWith('trophy_') && !trophyCrafted) trophyCrafted = rk;
        successCount++;
        if (i < repeatCount - 1) await loadState(true);
      }
      await loadState();
      if (successCount > 0) {
        log(repeatCount > 1 ? `✓ ×${successCount}: ${lastLabel}` : `✓ Got: ${lastLabel || 'done'}`);
        if (trophyCrafted) announceTrophy(trophyCrafted);
      }
      btn.disabled = false;
    });
  });
}


function renderRecipes(filter = '') {
  const q = filter.toLowerCase();
  const inv = state.inv;

  const asmRows = AR
    .filter(r => !r.reqTrophy || (inv[r.reqTrophy] || 0) > 0)
    .filter(r => !q ||
      r.name.toLowerCase().includes(q) ||
      r.ing.some(ing => 'key' in ing
        ? iname(ing.key).toLowerCase().includes(q)
        : ingGroupLabel(ing.group).toLowerCase().includes(q)));

  const smashRows = RECIPES.filter(([ing, out, typ]) =>
    typ === 'smash' && (!q || ing.toLowerCase().includes(q) || out.toLowerCase().includes(q)));

  const wrap = document.getElementById('recipe-table-wrap');
  wrap.innerHTML = '';

  const groupCls = (group) => {
    if (group === 'junk')          return 'r-jnk';
    if (group === TIN_FLOWERS)     return 'r-tin';
    if (group === BRONZE_FLOWERS)  return 'r-brz';
    if (group === MITHRIL_FLOWERS) return 'r-mth';
    if (group === ADAM_FLOWERS)    return 'r-adm';
    return '';
  };

  const mkSection = (label) => {
    const hdr = document.createElement('div');
    hdr.className = 'rcp-hdr';
    hdr.textContent = label;
    wrap.appendChild(hdr);
  };

  const mkAsmRow = (r) => {
    const lhsHtml = r.ing.map(ing => {
      const label = 'key' in ing ? iname(ing.key) : ingGroupLabel(ing.group);
      const cls   = 'key' in ing ? rcls(ing.key) : groupCls(ing.group);
      const qty   = ing.qty > 1 ? ` ×${ing.qty}` : '';
      return `<span class="${cls}">${esc(label)}${qty}</span>`;
    }).join('<span class="rcp-plus"> + </span>');

    const craftable = craftCount(r, inv) > 0;
    const isTrophy  = r.out.startsWith('trophy_');
    const repeatKey = TROPHY_REPEAT[r.out];
    const ownsTrophy = repeatKey && (inv[r.out] || 0) > 0;
    const displayName = ownsTrophy ? iname(repeatKey) : r.name;
    const displayKey  = ownsTrophy ? repeatKey : r.out;
    const rowCls    = (!ownsTrophy && isTrophy) ? 'rcp-trophy' : rcls(displayKey);
    const rhsCls    = (!ownsTrophy && isTrophy) ? 'rcp-trophy-name' : rcls(displayKey);

    const row = document.createElement('div');
    row.className = `rcp-row ${rowCls} rcp-clickable`;

    const main = document.createElement('div');
    main.className = 'rcp-main';
    main.innerHTML =
      `<span class="rcp-lhs">${lhsHtml}</span>` +
      `<span class="rcp-arr">→</span>` +
      `<span class="rcp-rhs ${rhsCls}">${esc(displayName)}</span>` +
      (craftable ? '<span class="rcp-ready-dot"></span>' : '<span class="rcp-ready-dot rcp-dot-off"></span>');
    row.appendChild(main);

    const expand = document.createElement('div');
    expand.className = 'rcp-expand hidden';
    if (craftable) {
      expand.innerHTML = '<span class="rcp-can-craft">✓ Ready — click again to fill slots</span>';
    } else {
      const parts = [];
      for (const ing of r.ing) {
        let have, label;
        if ('group' in ing) {
          have  = ing.group === 'junk' ? junkPool(inv).length : ing.group.reduce((s, k) => s + (inv[k] || 0), 0);
          label = ingGroupLabel(ing.group);
        } else { have = inv[ing.key] || 0; label = iname(ing.key); }
        if (ing.qty - have > 0) parts.push(`${label} ×${ing.qty - have}`);
      }
      expand.innerHTML = `<span class="rcp-missing">Need: ${parts.join(', ')}</span>`;
    }
    row.appendChild(expand);

    let expanded = false;
    row.addEventListener('click', () => {
      if (craftable) {
        clearSlots('asm');
        const slots = pickSlots(r, state.inv);
        if (slots) ['asm0','asm1','asm2','asm3'].forEach((id, i) => {
          if (slots[i]) { slotState[id] = slots[i]; renderSlot(id); }
        });
        if (screenMode !== 'assemble') setScreenMode('assemble');
      } else {
        expanded = !expanded;
        expand.classList.toggle('hidden', !expanded);
      }
    });
    wrap.appendChild(row);
  };

  const mkSmashRow = (ing, out, note) => {
    const spec      = SMASH_FILL_MAP.get(ing);
    const craftable = smashCraftable(spec);
    const row = document.createElement('div');
    row.className = 'rcp-row rcp-clickable';

    const main = document.createElement('div');
    main.className = 'rcp-main';
    main.innerHTML =
      `<span class="rcp-lhs">${esc(ing)}</span>` +
      `<span class="rcp-arr">→</span>` +
      `<span class="rcp-rhs">${esc(out)}</span>` +
      (craftable ? '<span class="rcp-ready-dot"></span>' : '<span class="rcp-ready-dot rcp-dot-off"></span>');
    row.appendChild(main);

    if (note) {
      const noteEl = document.createElement('div');
      noteEl.className = 'rcp-note';
      noteEl.textContent = note;
      row.appendChild(noteEl);
    }

    const expand = document.createElement('div');
    expand.className = 'rcp-expand hidden';
    if (!craftable && spec) {
      const inv = state.inv;
      const parts = [];
      const checkSpec = (s, label) => {
        if (!s) return;
        let have;
        if (s.k) { have = inv[s.k] || 0; if (have < 1) parts.push(`${iname(s.k)} ×1`); return; }
        const pool = s.t === 'beetle' ? BEETLES : s.t === 'flower' ? ALL_FLOWERS : [];
        have = pool.filter(k => !s.r || RARITY[k] === s.r).reduce((n, k) => n + (inv[k] || 0), 0);
        const need = (s === spec.sm1 && spec.sm0?.t === s.t && spec.sm0?.r === s.r) ? 2 : 1;
        if (have < need) parts.push(`${label} ×${need - have}`);
      };
      const rname = r => r ? (r === 'tin' ? 'Tin' : r === 'brz' ? 'Bronze' : r === 'mth' ? 'Mithril' : r === 'adm' ? 'Adamantine' : r === 'dia' ? 'Diamond' : r) : '';
      const sLabel = s => s ? (s.k ? iname(s.k) : `${rname(s.r)} ${s.t === 'beetle' ? 'Beetle' : 'Flower'}`) : '';
      checkSpec(spec.sm0, sLabel(spec.sm0));
      checkSpec(spec.sm1, sLabel(spec.sm1));
      checkSpec(spec.sac, sLabel(spec.sac));
      expand.innerHTML = parts.length
        ? `<span class="rcp-missing">Need: ${parts.join(', ')}</span>`
        : '<span class="rcp-can-craft">✓ Ready</span>';
    }
    row.appendChild(expand);

    let expanded = false;
    row.addEventListener('click', () => {
      if (craftable) {
        fillSmash(spec);
      } else {
        expanded = !expanded;
        expand.classList.toggle('hidden', !expanded);
      }
    });
    wrap.appendChild(row);
  };

  if (asmRows.length) {
    mkSection('⚙ ASSEMBLE');
    asmRows.forEach(mkAsmRow);
  }

  if (smashRows.length) {
    mkSection('⚡ SMASH');
    smashRows.forEach(([ing, out,, note]) => mkSmashRow(ing, out, note));
  }

  if (!asmRows.length && !smashRows.length)
    wrap.innerHTML = '<div class="nothing-craftable">No recipes match.</div>';
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
const ACTION_CD_KEY = { catchBeetle:'catchBeetle', beetleHunt:'beetleHunt', claimUBC:'claimUBC', junkFaucet:'junkFaucet' };

async function doAction(actionName, label) {
  if (screenMode === 'assemble' || screenMode === 'smash') setScreenMode('log');
  if (actionName === 'catchBeetle' || actionName === 'beetleHunt') lastActionCtx = 'beetle';
  else if (actionName === 'claimUBC' || actionName === 'junkFaucet') lastActionCtx = 'cheese';
  updateScreenBg(screenMode);

  log(`${label}…`);
  if (!Object.keys(state.inv).length) await loadState(true);
  const invBefore = { ...state.inv };
  const result = await apiPost(`/api/beetle/action/${actionName}`);
  if (!result) return;
  if (result.success === false) {
    if (result.cooldownMs > 0) {
      state.storedCds[ACTION_CD_KEY[actionName]] = result.cooldownMs;
      state.fetchedAt = Date.now();
      tick();
      const s = Math.ceil(result.cooldownMs / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      const parts = [];
      if (h) parts.push(`${h}h`);
      if (m) parts.push(`${m}m`);
      if (sec || !parts.length) parts.push(`${sec}s`);
      log(`${label} is on cooldown — ${parts.join(' ')} remaining`, 'warn');
    } else {
      log(result.message || `${label} failed.`, 'warn');
    }
  } else {
    await loadState();
    const gainedKeys = [], gained = [];
    for (const [k, qty] of Object.entries(state.inv)) {
      const diff = qty - (invBefore[k] || 0);
      if (diff > 0) { gainedKeys.push(k); gained.push(diff > 1 ? `${iname(k)} ×${diff}` : iname(k)); }
    }
    if (gained.length) log(`✓ ${label} — ${gained.join(', ')}`);
    else if (actionName === 'beetleHunt') log(`✓ ${label} — no beetles this time`);
    else log(`✓ ${label}`);
    announceRareDrops(label, gainedKeys);
  }
}

async function announceTrophy(trophyKey) {
  const { access } = getTokens();
  if (!access) return;
  try {
    await fetch('chatroom.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: access, body: `🏆 Crafted [[${trophyKey}]]!`, theme: localStorage.getItem(LS_THEME) || 'flame' }),
    });
    setTimeout(pollChat, 500);
  } catch {}
}

async function announceRareDrops(actionLabel, gainedKeys) {
  const rare = gainedKeys.filter(k => RARITY[k] === 'adm' || RARITY[k] === 'dia');
  if (!rare.length) return;
  const { access } = getTokens();
  if (!access) return;
  const names = rare.map(k => iname(k)).join(', ');
  try {
    await fetch('chatroom.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: access, body: `🪲 Got ${names} from ${actionLabel}!`, theme: localStorage.getItem(LS_THEME) || 'flame' }),
    });
    setTimeout(pollChat, 500);
  } catch {}
}

async function doJunkCrunch() {
  const pool = junkPool(state.inv);
  if (pool.length < 2) { log('Not enough loose junk.', 'warn'); return; }
  const pairs = Math.floor(pool.length / 2);
  if (screenMode === 'assemble' || screenMode === 'smash') setScreenMode('log');
  updateScreenBg('smash');
  log(`Crunching ${pool.length} junk items…`);
  let made = 0, skipped = 0;
  for (let i = 0; i < pairs * 2; i += 2) {
    const result = await apiPost('/api/beetle/action/craft', { type: 1, slot1: pool[i], slot2: pool[i+1] });
    if (!result) break;
    if (result.success !== false) { made++; }
    else if (result.message === 'INVALID_RECIPE') { skipped++; }
    else { log(result.message || 'Failed mid-crunch.', 'warn'); break; }
    await new Promise(r => setTimeout(r, 200));
  }
  log(`✓ Made ${made}/${pairs} Junk Cube(s)` + (skipped ? ` (${skipped} pair${skipped>1?'s':''} skipped — unknown item)` : ''));
  updateScreenBg(screenMode);
  await loadState();
}


// ── ITEM LINKS ────────────────────────────────────────────────────────────────
const LINK_COLORS = { tin:'var(--tin)',brz:'var(--brz)',mth:'var(--mth)',adm:'var(--adm)',dia:'var(--dia)',pnk:'var(--pnk)',jnk:'var(--jnk)' };

function bodyToPlainText(body) {
  return body.replace(/\[\[([a-z0-9_]+)\]\]/g, (_, key) => `[${iname(key)}]`);
}

function renderChatBody(body) {
  return esc(body).replace(/\[\[([a-z0-9_]+)\]\]/g, (_, key) => {
    const col = LINK_COLORS[RARITY[key]] || '';
    return `<span class="chat-item-link" data-key="${key}"${col ? ` style="color:${col}"` : ''}>[${esc(iname(key))}]</span>`;
  });
}

function resolveItemLinks(text) {
  return text.replace(/\[([^\][\n]+)\]/g, (match, typed) => {
    const lower = typed.toLowerCase().trim();
    const entry = Object.entries(NAMES).find(([, n]) => n.toLowerCase() === lower);
    return entry ? `[[${entry[0]}]]` : match;
  });
}

function getChatLinkQuery(input) {
  const before = input.value.slice(0, input.selectionStart);
  const lastOpen  = before.lastIndexOf('[');
  const lastClose = before.lastIndexOf(']');
  if (lastOpen === -1 || lastOpen < lastClose) return null;
  return before.slice(lastOpen + 1);
}

function updateChatSuggest(input) {
  const query   = getChatLinkQuery(input);
  const suggest = document.getElementById('chat-suggest');
  if (query === null) { suggest.classList.remove('open'); return; }
  const lower = query.toLowerCase();
  const inv   = state.inv || {};
  const matches = Object.entries(NAMES)
    .filter(([, n]) => n.toLowerCase().includes(lower))
    .sort(([ka], [kb]) => (inv[kb] || 0) - (inv[ka] || 0))
    .slice(0, 8);
  if (!matches.length) { suggest.classList.remove('open'); return; }
  suggest.innerHTML = matches.map(([k, n]) => {
    const col = LINK_COLORS[RARITY[k]] || '';
    return `<div class="chat-sug-item" data-key="${k}"${col ? ` style="color:${col}"` : ''}>[${esc(n)}]</div>`;
  }).join('');
  suggest.classList.add('open');
}

function insertChatLink(key) {
  const input = document.getElementById('chat-input');
  const val   = input.value;
  const pos   = input.selectionStart;
  const before = val.slice(0, pos);
  const idx    = before.lastIndexOf('[');
  const link   = `[${iname(key)}]`;
  input.value  = (idx !== -1 ? val.slice(0, idx) : before) + link + val.slice(pos);
  const np = (idx !== -1 ? idx : pos) + link.length;
  input.setSelectionRange(np, np);
  document.getElementById('chat-suggest').classList.remove('open');
  input.focus();
}

// ── CHAT ──────────────────────────────────────────────────────────────────────
async function pollChat() {
  try {
    const url = chatLastId !== null
      ? `${CHAT_URL}?after=${chatLastId}`
      : `${CHAT_URL}?last=50`;
    const r = await fetch(url);
    if (!r.ok) return;
    const data = await r.json();
    const posts = Array.isArray(data.posts) ? data.posts : [];
    if (!posts.length) return;
    const isInit = chatLastId === null;
    chatLastId = posts[posts.length - 1].id;
    appendChatPosts(posts, isInit);
  } catch (e) { console.warn('chat poll', e); }
}


function renderReactPills(container, reactions, msgId) {
  const myUser = state.user?.username || '';
  container.innerHTML = '';
  for (const emoji of CHAT_REACTS) {
    const users = reactions?.[emoji];
    if (!users || !users.length) continue;
    const mine = users.includes(myUser);
    const pill = document.createElement('button');
    pill.className = `react-pill${mine ? ' mine' : ''}`;
    pill.title = users.join(', ');
    pill.textContent = `${emoji} ${users.length}`;
    pill.addEventListener('click', () => sendReact(msgId, emoji));
    container.appendChild(pill);
  }
}

function appendChatPosts(posts, isInit) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 60;
  if (isInit) { box.innerHTML = ''; renderedPostEls.clear(); }
  const myUser = state.user?.username || '';
  for (const p of posts) {
    const el = document.createElement('div');
    const name = esc(p.user?.displayname || p.name || '?');
    const uname = p.user?.username || '';
    const profileUrl = uname ? `https://www.remilia.net/~${esc(uname)}` : '';
    const profileLink = (inner) => profileUrl
      ? `<a class="chat-profile-link" href="${profileUrl}" target="_blank" rel="noopener">${inner}</a>`
      : inner;
    const nameSpan = `<span class="chat-user" data-chat-theme="${esc(p.user?.theme || 'flame')}">${name}</span>`;
    if (p.type === 'join') {
      el.className = 'chat-join';
      el.innerHTML = `<span>• ${profileLink(nameSpan)} entered the chat</span>`;
    } else {
      el.className = 'chat-msg';
      let pfp = p.user?.pfpUrl || '';
      if (pfp.startsWith('/')) pfp = 'https://www.remilia.net' + pfp;
      const time = new Date(p.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const avatar = pfp
        ? `<img class="chat-avatar" src="${esc(pfp)}" alt="" onerror="this.style.display='none'">`
        : '<div class="chat-avatar-ph"></div>';

      // Reply quote
      let quoteHtml = '';
      if (p.replyTo) {
        const qname = esc(p.replyTo.displayname || p.replyTo.username || '?');
        const qbody = esc(bodyToPlainText(p.replyTo.body || '').slice(0, 80));
        quoteHtml = `<div class="chat-reply-quote" data-reply-id="${p.replyTo.id}">↩ ${qname}: ${qbody}</div>`;
      }

      // Action buttons
      const actionsHtml = `<div class="chat-actions">${
        CHAT_REACTS.map(e => `<button class="chat-action-btn react-trigger" data-emoji="${e}" data-msgid="${p.id}">${e}</button>`).join('')
      }<button class="chat-action-btn reply-trigger" data-msgid="${p.id}" data-uname="${esc(uname)}" data-dname="${name}" data-body="${esc(bodyToPlainText(p.body||'').slice(0,100))}">↩</button></div>`;

      el.innerHTML =
        profileLink(avatar) +
        `<div class="chat-body">` +
        `<div class="chat-meta">${profileLink(nameSpan)}<span class="chat-time">${time}</span></div>` +
        quoteHtml +
        `<div class="chat-text">${renderChatBody(p.body || '')}</div>` +
        `<div class="chat-reacts"></div>` +
        `</div>` +
        actionsHtml;

      // Render initial reactions
      const pillsEl = el.querySelector('.chat-reacts');
      if (pillsEl) renderReactPills(pillsEl, p.reactions || {}, p.id);

      // Reply notification
      if (!isInit && p.replyTo?.username === myUser && uname !== myUser) {
        if (document.hidden) {
          notify(`${p.user?.displayname || uname} replied to you`);
        } else {
          showInAppNotif(`${p.user?.displayname || uname} replied to you!`);
        }
      }
    }
    renderedPostEls.set(p.id, el);
    box.appendChild(el);
  }
  if (isInit || atBottom) box.scrollTop = box.scrollHeight;
}

function showInAppNotif(text) {
  const el = document.getElementById('chat-notif');
  if (!el) return;
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 4000);
}

function setReplyTarget(target) {
  replyTarget = target;
  const bar = document.getElementById('reply-bar');
  if (!bar) return;
  if (target) {
    document.getElementById('reply-bar-name').textContent = target.displayname || target.username;
    bar.classList.remove('hidden');
    document.getElementById('chat-input').focus();
  } else {
    bar.classList.add('hidden');
  }
}

async function sendReact(msgId, emoji) {
  const { access } = getTokens();
  if (!access) return;
  try {
    await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: access, action: 'react', msgId, emoji }),
    });
    fetchReactions();
  } catch {}
}

async function fetchReactions() {
  try {
    const r = await fetch(CHAT_URL + '?reactions=1');
    const d = await r.json();
    if (d.reactions) {
      for (const [idStr, reacts] of Object.entries(d.reactions)) {
        const el = renderedPostEls.get(Number(idStr));
        if (!el) continue;
        const pillsEl = el.querySelector('.chat-reacts');
        if (pillsEl) renderReactPills(pillsEl, reacts, Number(idStr));
      }
      // Clear pills on messages with no reactions
      for (const [id, el] of renderedPostEls) {
        if (!d.reactions[String(id)]) {
          const pillsEl = el.querySelector('.chat-reacts');
          if (pillsEl) pillsEl.innerHTML = '';
        }
      }
    }
  } catch {}
}

function startChatPoll() {
  if (chatPollTimer) return;
  chatLastId = null;
  pollChat();
  chatPollTimer = setInterval(pollChat, CHAT_POLL_INTERVAL);
  reactPollTimer = setInterval(fetchReactions, 20000);
  postChatJoin();
}

async function postChatJoin() {
  const { access } = getTokens();
  if (!access) return;
  try {
    await fetch('chatroom.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: access, action: 'join', theme: localStorage.getItem(LS_THEME) || 'flame' }),
    });
    setTimeout(pollChat, 400);
  } catch {}
}

function stopChatPoll() {
  clearInterval(chatPollTimer); chatPollTimer = null;
  clearInterval(reactPollTimer); reactPollTimer = null;
  setReplyTarget(null);
}

async function sendChatMsg() {
  const input = document.getElementById('chat-input');
  document.getElementById('chat-suggest').classList.remove('open');
  const msg = resolveItemLinks((input.value || '').trim());
  if (!msg) return;
  const { access } = getTokens();
  if (!access) return;
  const rt = replyTarget;
  setReplyTarget(null);
  input.value = '';
  input.disabled = true;
  try {
    const payload = { token: access, body: msg, theme: localStorage.getItem(LS_THEME) || 'flame' };
    if (rt) payload.replyTo = rt;
    const r = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) input.value = msg;
    else setTimeout(pollChat, 300);
  } catch { input.value = msg; }
  input.disabled = false;
  input.focus();
}

// ── LOGIN / LOGOUT ────────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
  clearAuth();
}
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  requestNotifPermission();
}

// ── BEETLEDEX ─────────────────────────────────────────────────────────────────
function renderBeetledex() {
  const inv = state.inv;
  const owned = BEETLES.filter(k => (inv[k] || 0) > 0);
  const tiers = [
    { key:'tin', label:'Tin',         color:'var(--tin)' },
    { key:'brz', label:'Bronze',      color:'var(--brz)' },
    { key:'mth', label:'Mithril',     color:'var(--mth)' },
    { key:'adm', label:'Adamantine',  color:'var(--adm)' },
    { key:'dia', label:'Diamond',     color:'var(--dia)' },
    { key:null,  label:'Unknown',     color:'var(--dim)' },
  ];
  let html = `<div class="dex-header">${owned.length}<span class="dex-total"> / ${BEETLES.length} collected</span></div>`;
  for (const tier of tiers) {
    const beetles = BEETLES.filter(k => (RARITY[k] || null) === tier.key);
    if (!beetles.length) continue;
    const ownedCount = beetles.filter(k => (inv[k] || 0) > 0).length;
    html += `<div class="dex-tier-header" style="color:${tier.color}">${tier.label} <span class="dex-tier-count">${ownedCount}/${beetles.length}</span></div>`;
    html += '<div class="dex-grid">';
    for (const k of beetles) {
      const have   = (inv[k] || 0) > 0;
      const qty    = inv[k] || 0;
      const scene  = getScene(k);
      const icon   = IMAGES[`_card_${k}`] || IMAGES[k];
      const bgStyle = scene ? `background-image:url('${scene}');background-size:cover;background-position:center` : '';
      html += `<div class="dex-card ${have ? 'dex-have' : 'dex-missing'}" style="--rarity-col:${tier.color}" title="${esc(iname(k))}">
        <div class="dex-card-art" style="${bgStyle}">
          ${scene ? '<div class="dex-art-overlay"></div>' : ''}
          ${icon ? `<img class="dex-card-icon" src="${icon}" alt="" onerror="this.style.display='none'">` : ''}
          ${have ? `<span class="dex-qty">×${qty}</span>` : '<span class="dex-unknown">?</span>'}
        </div>
        <div class="dex-card-name">${have ? esc(iname(k)) : '???'}</div>
      </div>`;
    }
    html += '</div>';
  }
  document.getElementById('left-mode-dex').innerHTML = html;
}

// ── MODE SWITCHING ────────────────────────────────────────────────────────────
function setMode(mode) {
  document.querySelectorAll('.mode-pane').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const pane = document.getElementById(`mode-${mode}`);
  if (pane) pane.classList.remove('hidden');
  if (mode === 'recipes') renderRecipes(document.getElementById('recipe-search').value);
  const rightBody = document.querySelector('#panel-right .panel-body');
  if (rightBody) {
    rightBody.classList.toggle('wiki-active', mode === 'wiki');
    rightBody.classList.toggle('chat-active', mode === 'chat');
  }
  if (mode === 'wiki') {
    const f = document.getElementById('wiki-frame');
    if (f.src === 'about:blank') f.src = 'https://beetle.wiki/';
  }
  if (mode === 'chat') startChatPoll();
  else stopChatPoll();
}

// ── PANELS ────────────────────────────────────────────────────────────────────
function openPanel(which) {
  const target = document.getElementById(`panel-${which}`);
  target.classList.toggle('open');
  updateDeviceRadius();
}
function closeAllPanels() {
  document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('open'));
  updateDeviceRadius();
}
function updateDeviceRadius() {
  const dev = document.getElementById('device');
  dev.classList.toggle('pl-open', document.getElementById('panel-left').classList.contains('open'));
  dev.classList.toggle('pr-open', document.getElementById('panel-right').classList.contains('open'));
}

// ── TIMERS ────────────────────────────────────────────────────────────────────
function startTimers() {
  clearInterval(refreshTimer); clearInterval(tickTimer);
  refreshTimer = setInterval(loadState, REFRESH_INTERVAL);
  tickTimer    = setInterval(tick, TICK_INTERVAL);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = 'LOGGING IN…';
    document.getElementById('login-err').textContent = '';
    const tokens = await oidc({
      grant_type: 'password',
      username: document.getElementById('lf-user').value.trim(),
      password: document.getElementById('lf-pass').value,
      scope: 'openid profile email',
    });
    if (!tokens || tokens.error) {
      const desc = tokens?.desc || '';
      const is2fa = /otp|mfa|two.factor|authenticat|not fully set up/i.test(desc);
      document.getElementById('login-err').innerHTML = is2fa
        ? '2FA is not supported.<br>Please disable it on your remilia.net account first.'
        : 'Login failed — check your credentials.';
      btn.disabled = false; btn.textContent = 'LOG IN'; return;
    }
    saveTokens(tokens.access, tokens.refresh);
    showApp();
    await loadState();
    startTimers();
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearInterval(refreshTimer); clearInterval(tickTimer); showLogin();
  });

  document.getElementById('act-claim').addEventListener('click',  () => doAction('catchBeetle', 'Claim Beetle'));
  document.getElementById('act-hunt').addEventListener('click',   () => doAction('beetleHunt',  'Hunt'));
  document.getElementById('act-ubc').addEventListener('click',    () => doAction('claimUBC',    'Claim UBC'));
  document.getElementById('act-faucet').addEventListener('click', () => doAction('junkFaucet',  'Junk Faucet'));
  document.getElementById('act-crunch').addEventListener('click', doJunkCrunch);
  document.getElementById('act-refresh').addEventListener('click', loadState);

  // Assemble / Smash screen pane buttons
  document.getElementById('act-assemble').addEventListener('click', () => setScreenMode('assemble'));
  document.getElementById('act-smash').addEventListener('click', () => setScreenMode('smash'));

  document.getElementById('do-assemble').addEventListener('click', async () => {
    if (!slotState['asm0']) { setResult('asm-result', 'Fill at least Slot 1.'); return; }
    const btn = document.getElementById('do-assemble');
    btn.disabled = true;
    const repeatCount = Math.max(1, Math.min(99, parseInt(document.getElementById('asm-repeat').value) || 1));
    let successCount = 0, lastLabel = '', lastKey = null, lastError = '', trophyCrafted = null;
    for (let i = 0; i < repeatCount; i++) {
      setResult('asm-result', repeatCount > 1 ? `${i+1}/${repeatCount}…` : 'Assembling…', lastKey);
      const [s1, s2, s3, s4] = resolveSlotKeys(['asm0','asm1','asm2','asm3']);
      if (!s1) { lastError = 'Out of materials.'; setResult('asm-result', lastError); break; }
      const body = { type: 1, slot1: s1, slot2: s2 || undefined, ...(s3 ? { slot3: s3 } : {}), ...(s4 ? { slot4: s4 } : {}) };
      const result = await apiPost('/api/beetle/action/craft', body);
      if (!result) break;
      if (result.success === false) { lastError = result.message || 'Failed.'; setResult('asm-result', lastError); break; }
      lastLabel = resultLabel(result) || 'done';
      lastKey   = resultKey(result);
      if (lastKey?.startsWith('trophy_') && !trophyCrafted) trophyCrafted = lastKey;
      successCount++;
      if (i < repeatCount - 1) await loadState(true);
    }
    await loadState();
    updatePreviews();
    if (successCount > 0) {
      const txt = repeatCount > 1 ? `✓ ×${successCount}: ${lastLabel}` : `✓ Got: ${lastLabel}`;
      setResult('asm-result', txt, lastKey);
      log(txt);
      if (trophyCrafted) announceTrophy(trophyCrafted);
    } else if (lastError) {
      log(lastError, 'warn');
    }
    btn.disabled = false;
  });

  document.getElementById('clear-assemble').addEventListener('click', () => clearSlots('asm'));

  document.getElementById('do-smash').addEventListener('click', async () => {
    if (!slotState['sm0'] || !slotState['smsac'] || !slotState['smhammer'])
      { setResult('smash-result2', 'Need Slot 1, Sacrifice and Hammer.'); return; }
    const btn = document.getElementById('do-smash');
    btn.disabled = true;
    const repeatCount = Math.max(1, Math.min(99, parseInt(document.getElementById('smash-repeat').value) || 1));
    let successCount = 0, lastLabel = '', lastKey = null, lastError = '';
    for (let i = 0; i < repeatCount; i++) {
      setResult('smash-result2', repeatCount > 1 ? `${i+1}/${repeatCount}…` : 'Smashing…', lastKey);
      const [s1, s2] = resolveSlotKeys(['sm0','sm1']);
      if (!s1) { lastError = 'Out of materials.'; setResult('smash-result2', lastError); break; }
      const body = { type: 2, slot1: s1, sacrifice: slotState['smsac'] || '', hammer: slotState['smhammer'] || '', ...(s2 ? { slot2: s2 } : {}) };
      const result = await apiPost('/api/beetle/action/craft', body);
      if (!result) break;
      if (result.success === false) { lastError = result.message || 'Failed.'; setResult('smash-result2', lastError); break; }
      lastLabel = resultLabel(result) || 'done';
      lastKey   = resultKey(result);
      successCount++;
      if (i < repeatCount - 1) await loadState(true);
    }
    await loadState();
    updatePreviews();
    if (successCount > 0) {
      const txt = repeatCount > 1 ? `✓ ×${successCount}: ${lastLabel}` : `✓ Got: ${lastLabel}`;
      setResult('smash-result2', txt, lastKey);
      log(txt);
    } else if (lastError) {
      log(lastError, 'warn');
    }
    btn.disabled = false;
  });

  document.getElementById('clear-smash').addEventListener('click', () => clearSlots('sm'));

  document.getElementById('recipe-search').addEventListener('input', e => renderRecipes(e.target.value));

  document.getElementById('chat-send').addEventListener('click', sendChatMsg);
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); sendChatMsg(); }
    if (e.key === 'Escape') document.getElementById('chat-suggest').classList.remove('open');
  });
  document.getElementById('chat-input').addEventListener('input', () =>
    updateChatSuggest(document.getElementById('chat-input')));
  document.getElementById('chat-input').addEventListener('blur', () =>
    setTimeout(() => document.getElementById('chat-suggest').classList.remove('open'), 150));
  document.getElementById('chat-suggest').addEventListener('click', e => {
    const item = e.target.closest('.chat-sug-item');
    if (item) insertChatLink(item.dataset.key);
  });
  document.getElementById('chat-input').addEventListener('dragover', e => {
    if (e.dataTransfer.types.includes('text/plain')) e.preventDefault();
  });
  document.getElementById('chat-input').addEventListener('drop', e => {
    const key = e.dataTransfer.getData('text/plain');
    if (!NAMES[key]) return;
    e.preventDefault();
    const input = e.target;
    const pos  = input.selectionStart ?? input.value.length;
    const link = `[${iname(key)}]`;
    input.value = input.value.slice(0, pos) + link + input.value.slice(pos);
    input.setSelectionRange(pos + link.length, pos + link.length);
    input.focus();
  });
  document.getElementById('chat-messages').addEventListener('click', e => {
    const link = e.target.closest('.chat-item-link');
    if (link) { openCard(link.dataset.key); return; }
    const reactBtn = e.target.closest('.react-trigger');
    if (reactBtn) { sendReact(Number(reactBtn.dataset.msgid), reactBtn.dataset.emoji); return; }
    const replyBtn = e.target.closest('.reply-trigger');
    if (replyBtn) {
      setReplyTarget({
        id: Number(replyBtn.dataset.msgid),
        username: replyBtn.dataset.uname,
        displayname: replyBtn.dataset.dname,
        body: replyBtn.dataset.body,
      });
    }
  });
  document.getElementById('reply-bar-cancel').addEventListener('click', () => setReplyTarget(null));

  document.getElementById('mode-btns').addEventListener('click', e => {
    const mode = e.target.dataset.mode;
    if (mode) setMode(mode);
  });

  document.getElementById('left-mode-btns').addEventListener('click', e => {
    const mode = e.target.dataset.leftMode;
    if (!mode) return;
    document.querySelectorAll('.left-pane').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('#left-mode-btns .mode-btn').forEach(b => b.classList.toggle('active', b.dataset.leftMode === mode));
    document.getElementById(`left-mode-${mode}`).classList.remove('hidden');
    if (mode === 'dex') renderBeetledex();
    if (mode === 'trphy') renderTrophies();
  });

  document.querySelectorAll('.panel-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => openPanel(btn.dataset.panel));
  });


  document.getElementById('btn-esc').addEventListener('click', () => setScreenMode('log'));

  wireSlots();

  // SP colorway picker
  const spBtn = document.getElementById('sp-clickable');
  const picker = document.getElementById('theme-picker');
  spBtn.addEventListener('click', e => {
    e.stopPropagation();
    const wasHidden = picker.classList.contains('hidden');
    picker.classList.toggle('hidden');
    if (wasHidden) buildThemePicker();
  });
  document.addEventListener('click', () => picker.classList.add('hidden'));

  // Load saved theme — default to flame
  applyTheme(localStorage.getItem(LS_THEME) || THEMES[Math.floor(Math.random() * THEMES.length)].id);

  // Initial screen background
  updateScreenBg('log');

  // Auto-login if token stored
  if (getTokens().access) { showApp(); loadState().then(startTimers); }

  const loadBgImage = initBgShader();
  if (loadBgImage) {
    applyColorScheme(loadBgImage);
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyColorScheme(loadBgImage));
  }
});

// ── BACKGROUND SHADER ─────────────────────────────────────────────────────────
function initBgShader() {
  const canvas = document.getElementById('bg-shader');
  const gl = canvas.getContext('webgl');
  if (!gl) return;

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const vertSrc = `
    attribute vec2 a_pos;
    varying vec2 vUv;
    void main() { vUv = (a_pos + 1.0) * 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;
  const fragSrc = `
    precision mediump float;
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 resolution;
    uniform float shape, radius, rotateR, rotateG, rotateB, patternScale;
    uniform float brightness, noiseIntensity, blending, edgeBoost, edgeStrength;
    varying vec2 vUv;

    float fastRand(vec2 co) { return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
    float fastNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(fastRand(i),fastRand(i+vec2(1,0)),f.x),mix(fastRand(i+vec2(0,1)),fastRand(i+vec2(1,1)),f.x),f.y);
    }
    float getShape(vec2 c, float sz, float t) {
      if (t<1.5) return step(length(c),sz);
      else if (t<2.5) return step(length(c*vec2(0.7,1.3)),sz);
      else if (t<3.5) return step(abs(c.x),sz);
      else return step(max(abs(c.x),abs(c.y)),sz);
    }
    vec2 rotC(vec2 c, float a) { float s=sin(a),cs=cos(a); return vec2(c.x*cs-c.y*s,c.x*s+c.y*cs); }
    float getDot(vec2 coord, float angle, float spacing, float intensity) {
      vec2 d = coord + vec2(fastNoise(coord*1.5+time*0.08))*0.06;
      vec2 sc = rotC(d,angle)*spacing*patternScale;
      vec2 g = mod(sc,2.0)-1.0;
      float pulse = 1.0+sin(time*0.4)*0.04;
      return getShape(g,0.48*pulse*(1.0+intensity),shape);
    }

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb * brightness;
      vec2 px = vUv * resolution;
      vec2 texel = 1.0 / max(resolution, vec2(1.0));
      vec3 cL = texture2D(tDiffuse, vUv-vec2(texel.x,0)).rgb;
      vec3 cR = texture2D(tDiffuse, vUv+vec2(texel.x,0)).rgb;
      vec3 cU = texture2D(tDiffuse, vUv-vec2(0,texel.y)).rgb;
      vec3 cD = texture2D(tDiffuse, vUv+vec2(0,texel.y)).rgb;
      float luma = dot(col, vec3(0.299,0.587,0.114));
      float chroma = length(col-vec3(luma));
      float gX = length(cR-cL), gY = length(cD-cU);
      float edge = clamp((gX+gY)*1.85,0.0,1.0);
      float signal = clamp(0.06+luma*1.1+chroma*1.25+edge*1.35,0.0,3.0);
      vec2 warp = vec2(cR.r-cL.r,cD.g-cU.g)*(7.5+8.0*edge);
      vec2 boil =
        vec2(
          fastNoise(px * 0.003 + time * 0.07),
          fastNoise(px * 0.003 - time * 0.05)
        );

      boil = (boil - 0.5) * 4.0;

      vec2 coord = px * 0.02 + warp + boil;
      float rI = clamp(col.r*(0.7+signal*0.85),0.0,1.8);
      float gI = clamp(col.g*(0.7+signal*0.85),0.0,1.8);
      float bI = clamp(col.b*(0.7+signal*0.85),0.0,1.8);
      float rd = getDot(coord,rotateR,50.0/radius,rI);
      float gd = getDot(coord,rotateG,50.0/radius,gI);
      float bd = getDot(coord,rotateB,50.0/radius,bI);
      vec3 pat = vec3(rd,gd,bd);
      vec3 inked = col*(0.08+pat*signal);
      vec3 screened = 1.0-(1.0-col)*(1.0-pat*(0.28+0.48*edge));
      vec3 final = mix(inked,screened,0.20+0.35*edge);
      final = mix(col,final,blending);
      if (edgeBoost > 0.001) {
        float lr = clamp(0.2+luma*1.05+chroma*1.15+edge*(0.9*edgeStrength),0.0,2.6);
        vec3 ei = col*(0.24+0.76*pat*lr);
        vec3 es = 1.0-(1.0-col)*(1.0-pat*0.42*lr);
        final = mix(final,mix(ei,es,0.28),edgeBoost*(0.7+0.3*edge));
      }
      if (noiseIntensity > 0.001) {
        float n = fastNoise(vUv*800.0+time*0.8);
        final = mix(final,vec3(n),noiseIntensity*0.8);
      }
      gl_FragColor = vec4(final, 1.0);
    }
  `;

  function makeShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, makeShader(gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const U = name => gl.getUniformLocation(prog, name);
  const u = {
    tDiffuse: U('tDiffuse'), time: U('time'), resolution: U('resolution'),
    shape: U('shape'), radius: U('radius'), rotateR: U('rotateR'), rotateG: U('rotateG'), rotateB: U('rotateB'),
    patternScale: U('patternScale'), brightness: U('brightness'),
    noiseIntensity: U('noiseIntensity'), blending: U('blending'),
    edgeBoost: U('edgeBoost'), edgeStrength: U('edgeStrength'),
  };

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10,13,26,255]));

  function loadBgImage(src) {
    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    };
    img.src = src;
  }

  gl.uniform1i(u.tDiffuse, 0);
  gl.uniform1f(u.shape, 1.0);
  gl.uniform1f(u.radius, 1.3);
  gl.uniform1f(u.rotateR, 0.26);
  gl.uniform1f(u.rotateG, 0.61);
  gl.uniform1f(u.rotateB, 1.05);
  gl.uniform1f(u.patternScale, 0.35);
  gl.uniform1f(u.brightness, 0.95);
  gl.uniform1f(u.noiseIntensity, 0.0);
  gl.uniform1f(u.blending, 0.42);
  gl.uniform1f(u.edgeBoost, 0.0);
  gl.uniform1f(u.edgeStrength, 0.0);

  let t = 0;
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  function frame() {
    t += 0.008;
    gl.uniform1f(u.time, t);
    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return loadBgImage;
}

let _loadBgImage = null;
function applyColorScheme(lb) {
  if (lb) _loadBgImage = lb;
  const stored = localStorage.getItem(LS_SCHEME);
  const light = stored ? stored === 'light' : window.matchMedia('(prefers-color-scheme: light)').matches;
  document.body.dataset.scheme = light ? 'light' : 'dark';
  if (_loadBgImage) _loadBgImage(light ? 'img/clouds.jpg' : 'img/city.png');
  buildThemePicker();
}
