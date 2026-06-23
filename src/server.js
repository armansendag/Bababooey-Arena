"use strict";

const http = require("http");
const { createApp } = require("./app");
const { createConfiguredStore } = require("./store/configuredStore");
const { attachWebSocketServer } = require("./websocket");

const port = Number(process.env.PORT || 3000);

async function start() {
  const store = await createConfiguredStore();
  const app = createApp({ store });
  const server = http.createServer(app.handle);
  attachWebSocketServer(server, app);

  const cleanupTimer = setInterval(() => {
    app.services.onlineMatches.cleanupInactiveMatches();
  }, 5 * 60 * 1000);
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

  async function shutdown() {
    clearInterval(cleanupTimer);
    if (typeof store.flush === "function") await store.flush();
    if (typeof store.close === "function") await store.close();
    server.close(() => process.exit(0));
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  server.listen(port, () => {
    const storage = store.persistence?.type || (process.env.DATABASE_URL ? "postgresql" : "json");
    console.log(`Bababooey Arena API listening on http://localhost:${port} (${storage} store)`);
    if (store.persistence?.type === "postgresql") {
      const migrationStatus = store.persistence.migrationStatus || {};
      console.log(`Connected to PostgreSQL database: ${store.persistence.databaseName || "unknown"}`);
      console.log(`Migration status: ${migrationStatus.applied?.length || 0} applied, ${migrationStatus.skipped?.length || 0} already applied, ${migrationStatus.total || 0} total.`);
    }
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { start };
