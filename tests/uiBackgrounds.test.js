"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

test("main UI styles do not use decorative background images", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "public", "styles.css"), "utf8");
  assert.equal(css.includes("url("), false);
  assert.equal(css.includes("arena.svg"), false);
});
