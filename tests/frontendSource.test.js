"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

test("battlefield sides stay fixed instead of following active player", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

  assert.match(source, /function battlefieldPlayers\(\)/);
  assert.match(source, /return \{ top: second \|\| first, bottom: first \|\| second \}/);
  assert.doesNotMatch(source, /arena\.appendChild\(playerZone\(active, false\)\)/);
  assert.doesNotMatch(source, /arena\.appendChild\(playerZone\(enemy, true\)\)/);
});

test("frontend reflects 50 hp cores and troop-protected core targeting", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

  assert.match(source, /Each Core starts at 50 HP/);
  assert.match(source, /player\.troops\.length === 0/);
  assert.match(source, /Core is targetable once enemy troops are gone/);
  assert.doesNotMatch(source, /300 HP/);
});
