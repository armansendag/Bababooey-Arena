"use strict";

const http = require("http");
const { createApp } = require("../src/app");
const { createMemoryStore } = require("../src/store/memoryStore");
const { attachWebSocketServer } = require("../src/websocket");

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
  });
}

async function main() {
  const app = createApp({ store: createMemoryStore() });
  const server = http.createServer(app.handle);
  attachWebSocketServer(server, app);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const health = await request(port, "/health");
    if (health.status !== 200 || !health.body.includes("\"ok\": true")) {
      throw new Error(`Health check failed with ${health.status}: ${health.body}`);
    }

    const home = await request(port, "/");
    if (home.status !== 200 || !home.body.includes("Bababooey Arena")) {
      throw new Error(`Static frontend check failed with ${home.status}.`);
    }

    console.log("Deployment smoke test passed: /health and static frontend responded.");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
