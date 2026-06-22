"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("server startup modules import with Linux-safe paths", () => {
  assert.doesNotThrow(() => {
    require("../src/data/cards");
    require("../src/data/packs");
    require("../src/data/quests");
    require("../src/store/memoryStore");
    require("../src/store/jsonStore");
    require("../src/app");
    require("../src/websocket");
  });
});

test("app can construct production server dependencies", () => {
  const { createApp } = require("../src/app");
  const { createMemoryStore } = require("../src/store/memoryStore");
  const app = createApp({ store: createMemoryStore() });

  assert.equal(typeof app.handle, "function");
  assert.ok(app.store.cards.has("core_starter"));
  assert.ok(app.services.onlineMatches);
});
