"use strict";

const fs = require("fs");
const path = require("path");
const { createMemoryStore, serializeStore } = require("./memoryStore");

function readSnapshot(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function writeSnapshot(filePath, snapshot) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2));
  fs.renameSync(tempPath, filePath);
}

function createJsonBackedStore(filePath) {
  const store = createMemoryStore({ snapshot: readSnapshot(filePath) });
  store.persist = function persist() {
    writeSnapshot(filePath, serializeStore(store));
  };
  return store;
}

module.exports = { createJsonBackedStore };
