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

test("frontend asks for username and renders full pack shop", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(appSource, /placeholder="Username"/);
  assert.match(appSource, /\/auth\/register/);
  assert.doesNotMatch(appSource, /\/prototype\/bootstrap", \{ method: "POST" \}/);
  assert.match(appSource, /state\.packs\.forEach/);
  assert.match(appSource, /Odds:/);
  assert.match(appSource, /Guaranteed:/);
});

test("pack openings render exciting on-screen rarity reveals", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /pack-reveal-stage/);
  assert.match(appSource, /Best pull:/);
  assert.match(appSource, /pack-result-card/);
  assert.match(appSource, /slam-reveal/);
  assert.match(appSource, /rarity-badge/);
  assert.match(cssSource, /@keyframes slamReveal/);
  assert.match(cssSource, /\.pack-result-card\.slam-reveal/);
  assert.match(cssSource, /\.rarity-badge/);
});

test("loadout builder only shows and autofills owned cards", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

  assert.match(appSource, /ownedLoadoutCards = sortedCards\(state\.collection\.filter\(\(item\) => item\.type !== "core" && item\.ownedCount > 0\)/);
  assert.match(appSource, /ownedLoadoutCards\.forEach/);
  assert.match(appSource, /No owned non-core cards yet/);
  assert.match(appSource, /\.filter\(\(\[cardId\]\) => \(owned\.get\(cardId\) \|\| 0\) > 0\)/);
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

test("rarity badge has dedicated header space instead of covering card names", () => {
  const appSource = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

  assert.match(appSource, /<div class="card-name">/);
  assert.match(appSource, /<div class="rarity-badge">/);
  assert.match(cssSource, /grid-template-columns:\s*34px minmax\(0, 1fr\) auto/);
  assert.doesNotMatch(cssSource, /\.rarity-badge\s*\{[^}]*position:\s*absolute/s);
  assert.doesNotMatch(cssSource, /padding-right:\s*56px/);
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
