"use strict";

const http = require("http");
const path = require("path");
const { createApp } = require("./app");
const { createJsonBackedStore } = require("./store/jsonStore");
const { attachWebSocketServer } = require("./websocket");

const port = Number(process.env.PORT || 3000);
const dataFile = process.env.DATA_FILE || path.join(__dirname, "..", "data", "dev-store.json");
const app = createApp({ store: createJsonBackedStore(dataFile) });

const server = http.createServer(app.handle);
attachWebSocketServer(server, app);

const cleanupTimer = setInterval(() => {
  app.services.onlineMatches.cleanupInactiveMatches();
}, 5 * 60 * 1000);
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

server.listen(port, () => {
  console.log(`Bababooey Arena API listening on http://localhost:${port}`);
});
