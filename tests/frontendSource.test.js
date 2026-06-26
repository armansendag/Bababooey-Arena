const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("battle end turn control stays reachable and supports E keybind", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /function canEndTurn\(\)/);
  assert.match(appSource, /function endActiveTurn\(\)/);
  assert.match(appSource, /renderBattleActionBar/);
  assert.match(appSource, /Press E to end turn\./);
  assert.match(appSource, /event\.key\.toLowerCase\(\) !== "e"/);
  assert.match(appSource, /\["INPUT", "TEXTAREA", "SELECT"\]\.includes\(target\.tagName\)/);
  assert.match(cssSource, /\.battle-action-bar\s*\{/);
  assert.match(cssSource, /position:\s*sticky/);
});

test("online battle keeps viewer side stable and exposes forfeit", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(appSource, /function viewerPlayer\(\)/);
  assert.match(appSource, /state\.profile\?\.userId/);
  assert.match(appSource, /const bottomPlayer = viewerPlayer\(\)/);
  assert.match(appSource, /arena\.appendChild\(playerZone\(bottomPlayer, false\)\)/);
  assert.match(appSource, /function canForfeit\(\)/);
  assert.match(appSource, /function forfeitMatch\(\)/);
  assert.match(appSource, /type: "forfeit"/);
  assert.match(appSource, /Forfeit this match\?/);
});

test("battle commands exit attack mode and only show ready roster cards", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(appSource, /pendingBattleCommand/);
  assert.match(appSource, /state\.feedback = buildFeedback\(previous, match\.state, state\.pendingBattleCommand\)/);
  assert.match(appSource, /state\.pendingBattleCommand = null;\s*state\.selected = null;/);
  assert.match(appSource, /command\.type === "attack" \|\| command\.type === "endTurn" \|\| command\.type === "forfeit"/);
  assert.match(appSource, /function readyRosterEntries\(player\)/);
  assert.match(appSource, /entry\.zone !== "ready"/);
  assert.match(appSource, /player\.spellCooldowns\?\.\[entry\.cardId\]/);
  assert.match(appSource, /readyRosterEntries\(rosterPlayer\)\.forEach/);
});

test("battle damage shows minus ticks and defeated units fade out", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /function damageBurst\(amount\)/);
  assert.match(appSource, /damage-ticks/);
  assert.match(appSource, /function defeatedGhost\(cardId, type, className\)/);
  assert.match(appSource, /feedback\.deathCardId = deathEvent\.payload\.cardId/);
  assert.match(appSource, /defeatedGhost\(state\.feedback\.deathCardId, "troop", "death"\)/);
  assert.match(cssSource, /\.damage-ticks/);
  assert.match(cssSource, /@keyframes damageTick/);
  assert.match(cssSource, /to \{ transform: scale\(\.82\) rotate\(-4deg\); opacity: 0; \}/);
});

test("online screen ignores abandoned saved matches", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(appSource, /state\.battlePhase = match\.status === "active" \? "playing" : "ended"/);
  assert.match(appSource, /if \(match\.status === "active"\) \{\s*openOnlineMatch\(match\);\s*return;\s*\}/s);
  assert.match(appSource, /localStorage\.removeItem\("bababooey_online_match_id"\)/);
});

test("top notifications fade and clear automatically", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /messageFading/);
  assert.match(appSource, /function scheduleMessageDismiss/);
  assert.match(appSource, /setTimeout\(\(\) => \{/);
  assert.match(appSource, /2400\)/);
  assert.match(appSource, /3200\)/);
  assert.match(appSource, /toast-message/);
  assert.match(cssSource, /\.toast-message/);
  assert.match(cssSource, /\.toast-message\.fading/);
  assert.match(cssSource, /@keyframes toastIn/);
});

test("frontend asks for username and renders full pack shop", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(appSource, /placeholder="Username"/);
  assert.match(appSource, /payload\.username = state\.authForm\.username/);
  assert.match(appSource, /Remember me/);
  assert.match(appSource, /\/auth\/register/);
  assert.doesNotMatch(appSource, /\/prototype\/bootstrap", \{ method: "POST" \}/);
  assert.match(appSource, /state\.packs\.forEach/);
  assert.match(appSource, /Odds:/);
  assert.match(appSource, /Guaranteed:/);
});

test("frontend exposes username editing and friend lookup by username or code", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(appSource, /data-username-edit/);
  assert.match(appSource, /function updateUsername/);
  assert.match(appSource, /Username or friend code/);
  assert.match(appSource, /function addFriend/);
  assert.match(appSource, /body: \{ identifier \}/);
});

test("pack openings render exciting on-screen rarity reveals", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /pack-reveal-stage/);
  assert.match(appSource, /Best pull charging:/);
  assert.match(appSource, /pack-drumroll/);
  assert.match(appSource, /pack-spotlight/);
  assert.match(appSource, /pack-result-card/);
  assert.match(appSource, /650 \+ index \* 420/);
  assert.match(appSource, /slam-reveal/);
  assert.match(appSource, /rarity-badge/);
  assert.match(cssSource, /@keyframes suspenseSweep/);
  assert.match(cssSource, /@keyframes suspenseDot/);
  assert.match(cssSource, /@keyframes spotlightPop/);
  assert.match(cssSource, /@keyframes slamReveal/);
  assert.match(cssSource, /\.pack-drumroll/);
  assert.match(cssSource, /\.pack-spotlight/);
  assert.match(cssSource, /\.pack-result-card\.slam-reveal/);
  assert.match(cssSource, /\.rarity-badge/);
});

test("loadout builder only shows and autofills owned cards", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(appSource, /ownedLoadoutCards = sortedCards\(state\.collection\.filter\(\(item\) => item\.type !== "core" && item\.ownedCount > 0\)/);
  assert.match(appSource, /ownedLoadoutCards\.forEach/);
  assert.match(appSource, /No owned non-core cards yet/);
  assert.match(appSource, /\.filter\(\(\[cardId\]\) => \(owned\.get\(cardId\) \|\| 0\) > 0\)/);
  assert.match(appSource, /Build exactly 8 troops, 2 spells, and 2 enchantments/);
  assert.match(appSource, /function saveActiveLoadout/);
  assert.match(appSource, /\/loadouts",\s*\{\s*method: "POST"/s);
  assert.match(appSource, /\/loadouts\/\$\{saved\.id\}\/activate/);
  assert.match(appSource, /Save & Activate Deck/);
  assert.match(appSource, /Total \$\{validation\?\.summary\?\.total \|\| 0\}\/12/);
});

test("loadout builder blocks invalid card additions with a warning", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /loadoutWarning/);
  assert.match(appSource, /function draftSummary/);
  assert.match(appSource, /function loadoutLimitMessage/);
  assert.match(appSource, /Deck already has 8 troops/);
  assert.match(appSource, /Deck already has 2 spells/);
  assert.match(appSource, /Deck already has 2 enchantments/);
  assert.match(appSource, /Deck is full/);
  assert.match(appSource, /state\.loadoutWarning = warning;\s*render\(\);\s*return;/);
  assert.match(appSource, /el\("div", "loadout-warning"/);
  assert.match(cssSource, /\.loadout-warning/);
});

test("loadout card action buttons do not open card details", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(appSource, /actions\.addEventListener\("pointerdown", \(event\) => event\.stopPropagation\(\)\)/);
  assert.match(appSource, /actions\.addEventListener\("click", \(event\) => event\.stopPropagation\(\)\)/);
  assert.doesNotMatch(appSource, /node\.addEventListener\("mouseenter", \(\) => \{\s*state\.detailCard = cardData/s);
  assert.match(appSource, /state\.detailCard = cardData;\s*render\(\);/);
});

test("collection and loadout card menus sort by rarity with owned-first toggles", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /function sortedCards/);
  assert.match(appSource, /rarityRank\(b\.rarity\) - rarityRank\(a\.rarity\)/);
  assert.match(appSource, /data-card-filter="ownedFirst"/);
  assert.match(appSource, /data-loadout-owned-first/);
  assert.match(cssSource, /\.checkbox-filter/);
});

test("collection search keeps focus while filtering", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(appSource, /function updateCardFilter\(control\)/);
  assert.match(appSource, /key === "query" && document\.activeElement === control/);
  assert.match(appSource, /function restoreCardFilterFocus\(key, selectionStart, selectionEnd\)/);
  assert.match(appSource, /nextControl\.focus\(\)/);
  assert.match(appSource, /nextControl\.setSelectionRange\(selectionStart, selectionEnd\)/);
});

test("rarity badge has dedicated header space instead of covering card names", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /<div class="card-name">/);
  assert.match(appSource, /<div class="card-title-block">/);
  assert.match(appSource, /<div class="rarity-badge">/);
  assert.match(cssSource, /grid-template-areas:\s*"mana spacer rarity"\s*"title title title"/);
  assert.match(cssSource, /\.card-title-block\s*\{[^}]*grid-area:\s*title/s);
  assert.doesNotMatch(cssSource, /\.rarity-badge\s*\{[^}]*position:\s*absolute/s);
  assert.doesNotMatch(cssSource, /padding-right:\s*56px/);
});

test("meme beta UI uses Bababooey branding, logo, and expandable card rules", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.doesNotMatch(appSource, /Battlefield: Codex/);
  assert.match(appSource, /Bababooey Arena/);
  assert.match(appSource, /fairs-logo\.jpg/);
  assert.match(appSource, /function cardDescription/);
  assert.match(appSource, /cardData\.rulesText/);
  assert.match(appSource, /class="card-description"/);
  assert.match(appSource, /data-show-more/);
  assert.match(appSource, /Show more/);
  assert.match(appSource, /cardDescription\(item\)/);
  assert.match(cssSource, /\.brand-logo/);
  assert.match(cssSource, /\.hero-logo/);
  assert.match(cssSource, /\.auth-logo/);
  assert.match(cssSource, /\.card-description/);
  assert.match(cssSource, /-webkit-line-clamp:\s*4/);
  assert.match(cssSource, /\.show-more/);
});

test("browser tab uses Bababooey logo favicon", () => {
  const indexSource = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

  assert.match(indexSource, /<title>Bababooey Arena<\/title>/);
  assert.match(indexSource, /rel="icon" href="\/assets\/fairs-logo\.jpg" type="image\/jpeg"/);
  assert.match(indexSource, /rel="apple-touch-icon" href="\/assets\/fairs-logo\.jpg"/);
});

test("frontend does not expose an admin panel", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.doesNotMatch(appSource, /\["admin", "A", "Admin"\]/);
  assert.doesNotMatch(appSource, /function renderAdmin/);
  assert.doesNotMatch(appSource, /\/admin\/reset/);
});

test("settings exposes self-service stat reset only", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /Reset my stats/);
  assert.match(appSource, /function resetMyStats/);
  assert.match(appSource, /\/me\/reset/);
  assert.match(appSource, /RESET MY STATS/);
  assert.match(cssSource, /\.danger-zone/);
});

test("settings exposes font picker with immediate apply and persistence", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  for (const font of ["Inter", "Roboto", "Open Sans", "Montserrat", "Poppins", "Nunito", "Merriweather", "Comic Sans", "Pixel/Retro"]) {
    assert.match(appSource, new RegExp(font.replace("/", "\\/")));
  }
  assert.match(appSource, /data-font-select/);
  assert.match(appSource, /data-reset-font/);
  assert.match(appSource, /Default \(Poppins\)/);
  assert.match(appSource, /localStorage\.getItem\("bababooey_font"\) \|\| "poppins"/);
  assert.match(appSource, /updateFontPreference\("poppins"\)/);
  assert.match(appSource, /data-font-preview/);
  assert.match(appSource, /function applyFontPreference/);
  assert.match(appSource, /document\.documentElement\.style\.setProperty\("--ui-font"/);
  assert.match(appSource, /localStorage\.setItem\("bababooey_font"/);
  assert.match(appSource, /api\("\/me", \{ method: "PATCH", body: \{ settings: \{ font: safeFont \} \} \}\)/);
  assert.match(appSource, /normalizeFont\(fontId\)/);
  assert.match(cssSource, /--ui-font/);
  assert.match(cssSource, /font-family:\s*var\(--ui-font\)/);
  assert.match(cssSource, /\.font-preview/);
});
