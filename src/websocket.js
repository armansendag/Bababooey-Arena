"use strict";

const { WebSocketServer } = require("ws");

function send(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function parseJson(data) {
  try {
    return JSON.parse(String(data));
  } catch {
    const error = new Error("Invalid WebSocket JSON message.");
    error.status = 400;
    throw error;
  }
}

function authenticateFromRequest(app, req) {
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token");
  if (!token) return null;
  const session = app.store.sessions.get(token);
  if (!session) return null;
  return app.store.users.get(session.userId) || null;
}

function attachWebSocketServer(server, app) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/ws") return;
    const user = authenticateFromRequest(app, req);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, user);
    });
  });

  wss.on("connection", (socket, _req, user) => {
    const joinedMatches = new Set();
    const unsubscribe = app.services.onlineMatches.subscribe(user.id, (message) => send(socket, message));

    send(socket, {
      type: "connected",
      userId: user.id,
      challenges: app.services.onlineMatches.listChallenges(user.id),
      matches: app.services.onlineMatches.listMatches(user.id),
      queue: app.services.onlineMatches.queueStatus(user.id),
      ranked: app.services.onlineMatches.rankedProfile(user.id)
    });

    socket.on("message", (data) => {
      try {
        const message = parseJson(data);

        if (message.type === "subscribe_match") {
          const match = app.services.onlineMatches.markConnected(user.id, message.matchId);
          if (!match) throw Object.assign(new Error("Online match not found."), { status: 404 });
          joinedMatches.add(message.matchId);
          send(socket, { type: "match_snapshot", match });
          return;
        }

        if (message.type === "command") {
          const response = app.services.onlineMatches.command(user.id, message.matchId, message.command || {});
          send(socket, { type: "command_ack", matchId: message.matchId, result: response.result });
          return;
        }

        if (message.type === "ping") {
          send(socket, { type: "pong" });
          return;
        }

        throw Object.assign(new Error(`Unknown WebSocket message type ${message.type}.`), { status: 400 });
      } catch (error) {
        send(socket, {
          type: "error",
          error: error.message || "WebSocket error.",
          status: error.status || 500
        });
      }
    });

    socket.on("close", () => {
      unsubscribe();
      for (const matchId of joinedMatches) {
        app.services.onlineMatches.markDisconnected(user.id, matchId);
      }
    });
  });

  return wss;
}

module.exports = { attachWebSocketServer };
