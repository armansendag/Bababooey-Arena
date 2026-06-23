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
