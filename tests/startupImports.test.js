"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("server modules can be imported without starting a listener", () => {
  assert.doesNotThrow(() => {
    require("../src/app");
    require("../src/server");
    require("../src/store/configuredStore");
    require("../src/store/jsonStore");
    require("../src/store/memoryStore");
    require("../src/store/postgresStore");
    require("../src/websocket");
  });
});
