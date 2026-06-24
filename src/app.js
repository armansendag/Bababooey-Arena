"use strict";

const fs = require("fs");
const pathModule = require("path");
const { URL } = require("url");
const { createMemoryStore } = require("./store/memoryStore");
const { createAuthService } = require("./services/authService");
const { createCollectionService } = require("./services/collectionService");
const { createFriendService } = require("./services/friendService");
const { createLocalBattleService } = require("./services/localBattleService");
const { DEMO_LOADOUT } = require("./services/localBattleService");
const { createOnlineMatchService } = require("./services/onlineMatchService");
const { createLoadoutService } = require("./services/loadoutService");
const { createPackService } = require("./services/packService");
const { createProfileService } = require("./services/profileService");
const { createQuestService } = require("./services/questService");

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function methodNotAllowed(res) {
  sendJson(res, 405, { error: "Method not allowed." });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

function sendStatic(res, filePath) {
  const ext = pathModule.extname(filePath);
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    "content-type": MIME_TYPES[ext] || "application/octet-stream",
    "content-length": body.length
  });
  res.end(body);
}

function createDemoAccount(services, store) {
  const email = `prototype-${Date.now()}@local.test`;
  const account = services.auth.register({
    email,
    password: "prototype-password",
    displayName: "Prototype Pilot"
  });

  const owned = store.playerCards.get(account.user.id);
  owned.set(DEMO_LOADOUT.coreCardId, 1);
  for (const [cardId, quantity] of Object.entries(DEMO_LOADOUT.cards)) {
    owned.set(cardId, Math.max(owned.get(cardId) || 0, quantity));
  }
  const loadout = services.loadouts.create(account.user.id, {
    name: "Prototype Online Loadout",
    coreCardId: DEMO_LOADOUT.coreCardId,
    cards: DEMO_LOADOUT.cards
  });
  services.loadouts.setActive(account.user.id, loadout.id);

  return account;
}

function logServerError(store, req, error, userId = null) {
  if (typeof store.logError !== "function") return;
  const status = error.status || 500;
  store.logError({
    level: status >= 500 ? "error" : "warn",
    scope: "http",
    message: error.message || "Internal server error.",
    status,
    userId,
    details: error.details || null,
    metadata: {
      method: req.method,
      path: new URL(req.url, "http://localhost").pathname
    }
  });
}

function isDebugPersistenceEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_ADMIN_DEBUG === "true";
}

function persistenceDebugSnapshot(store) {
  return {
    storeType: store.persistence?.type || "memory",
    databaseConnected: Boolean(store.persistence?.connected),
    databaseName: store.persistence?.databaseName || null,
    migrationStatus: store.persistence?.migrationStatus || null,
    counts: {
      users: store.users.size,
      collections: store.playerCards.size,
      ownedCardStacks: Array.from(store.playerCards.values()).reduce((sum, owned) => sum + owned.size, 0),
      loadouts: store.loadouts.size,
      friends: store.friendships.size,
      packOpenings: store.packOpenings.length,
      matches: store.onlineMatches.size,
      matchHistory: store.matchHistory.length,
      rankedRatings: store.rankedRatings.size,
      coinTransactions: store.coinTransactions.length
    }
  };
}

function createApp(options = {}) {
  const store = options.store || createMemoryStore();
  const authService = createAuthService(store);
  const collectionService = createCollectionService(store);
  const questService = createQuestService(store);
  const services = {
    auth: authService,
    collection: collectionService,
    friends: createFriendService(store),
    localBattles: createLocalBattleService(),
    onlineMatches: null,
    loadouts: createLoadoutService(store, collectionService),
    packs: createPackService(store, collectionService, questService, options.random),
    profiles: createProfileService(store, authService),
    quests: questService
  };
  services.onlineMatches = createOnlineMatchService(store, options.onlineMatchOptions || {});

  async function requireUser(req) {
    return services.auth.authenticate(req.headers);
  }

  async function handle(req, res) {
    let authenticatedUserId = null;
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      const publicDir = pathModule.join(__dirname, "..", "public");

      if (req.method === "GET" && (path === "/" || path.startsWith("/assets/") || path === "/app.js" || path === "/styles.css")) {
        const requested = path === "/" ? "index.html" : path.replace(/^\//, "");
        const filePath = pathModule.normalize(pathModule.join(publicDir, requested));
        if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          return sendJson(res, 404, { error: "Static asset not found." });
        }
        return sendStatic(res, filePath);
      }

      if (req.method === "GET" && path === "/health") {
        return sendJson(res, 200, { ok: true });
      }

      if (path === "/prototype/bootstrap") {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 201, createDemoAccount(services, store));
      }

      if (path === "/local-matches") {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 201, services.localBattles.createDemoMatch());
      }

      const localMatchCommand = path.match(/^\/local-matches\/([^/]+)\/commands$/);
      if (localMatchCommand) {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.localBattles.command(localMatchCommand[1], await readJson(req)));
      }

      const localMatchDemo = path.match(/^\/local-matches\/demo-script$/);
      if (localMatchDemo) {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.localBattles.runDemoScript());
      }

      const localMatchGet = path.match(/^\/local-matches\/([^/]+)$/);
      if (localMatchGet) {
        if (req.method !== "GET") return methodNotAllowed(res);
        return sendJson(res, 200, services.localBattles.getMatch(localMatchGet[1]));
      }

      if (path === "/auth/register") {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 201, services.auth.register(await readJson(req)));
      }

      if (path === "/auth/login") {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.auth.login(await readJson(req)));
      }

      const user = await requireUser(req);
      authenticatedUserId = user.id;

      if (path === "/me") {
        if (req.method === "GET") return sendJson(res, 200, services.profiles.get(user.id));
        if (req.method === "PATCH") return sendJson(res, 200, services.profiles.update(user.id, await readJson(req)));
        return methodNotAllowed(res);
      }

      if (path === "/cards" && req.method === "GET") {
        return sendJson(res, 200, Array.from(store.cards.values()));
      }

      if (path === "/collection" && req.method === "GET") {
        return sendJson(res, 200, services.collection.list(user.id));
      }

      if (path === "/friends") {
        if (req.method === "GET") return sendJson(res, 200, services.friends.list(user.id));
        if (req.method === "POST") {
          const body = await readJson(req);
          return sendJson(res, 201, services.friends.sendRequest(user.id, body.friendCode));
        }
        return methodNotAllowed(res);
      }

      if (path === "/friend-challenges") {
        if (req.method === "GET") return sendJson(res, 200, services.onlineMatches.listChallenges(user.id));
        if (req.method === "POST") {
          const body = await readJson(req);
          return sendJson(res, 201, services.onlineMatches.sendChallenge(user.id, body.challengedId));
        }
        return methodNotAllowed(res);
      }

      const challengeAccept = path.match(/^\/friend-challenges\/([^/]+)\/accept$/);
      if (challengeAccept) {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.onlineMatches.acceptChallenge(user.id, challengeAccept[1]));
      }

      const challengeDecline = path.match(/^\/friend-challenges\/([^/]+)\/decline$/);
      if (challengeDecline) {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.onlineMatches.declineChallenge(user.id, challengeDecline[1]));
      }

      if (path === "/online-matches" && req.method === "GET") {
        return sendJson(res, 200, services.onlineMatches.listMatches(user.id));
      }

      if (path === "/queue/status" && req.method === "GET") {
        return sendJson(res, 200, services.onlineMatches.queueStatus(user.id));
      }

      if (path === "/queue/casual/join") {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.onlineMatches.joinQueue(user.id, "casual"));
      }

      if (path === "/queue/ranked/join") {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.onlineMatches.joinQueue(user.id, "ranked"));
      }

      if (path === "/queue/cancel") {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.onlineMatches.cancelQueue(user.id));
      }

      if (path === "/ranked/profile" && req.method === "GET") {
        return sendJson(res, 200, services.onlineMatches.rankedProfile(user.id));
      }

      if (path === "/leaderboards" && req.method === "GET") {
        return sendJson(res, 200, services.onlineMatches.leaderboards());
      }

      if (path === "/debug/persistence") {
        if (req.method !== "GET") return methodNotAllowed(res);
        if (!isDebugPersistenceEnabled()) {
          const error = new Error("Persistence debug is disabled in production.");
          error.status = 403;
          throw error;
        }
        return sendJson(res, 200, persistenceDebugSnapshot(store));
      }

      const onlineMatchGet = path.match(/^\/online-matches\/([^/]+)$/);
      if (onlineMatchGet) {
        if (req.method !== "GET") return methodNotAllowed(res);
        return sendJson(res, 200, services.onlineMatches.getMatch(user.id, onlineMatchGet[1]));
      }

      const onlineMatchCommand = path.match(/^\/online-matches\/([^/]+)\/commands$/);
      if (onlineMatchCommand) {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.onlineMatches.command(user.id, onlineMatchCommand[1], await readJson(req)));
      }

      if (path === "/match-history" && req.method === "GET") {
        return sendJson(res, 200, services.onlineMatches.history(user.id));
      }

      if (path === "/match-bug-reports") {
        if (req.method !== "POST") return methodNotAllowed(res);
        const body = await readJson(req);
        const match = body.matchId ? store.onlineMatches.get(body.matchId) : null;
        if (body.matchId && match && !match.playerIds.includes(user.id)) {
          const error = new Error("You can only report matches you played in.");
          error.status = 403;
          throw error;
        }
        return sendJson(res, 201, store.addBugReport({
          reporterId: user.id,
          matchId: body.matchId || null,
          message: body.message,
          stateSummary: match ? {
            status: match.status,
            mode: match.mode,
            turnNumber: match.state?.turnNumber,
            activePlayerId: match.state?.activePlayerId,
            eventCount: match.state?.eventLog?.length || 0
          } : null
        }));
      }

      const friendAcceptMatch = path.match(/^\/friends\/([^/]+)\/accept$/);
      if (friendAcceptMatch) {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.friends.respond(user.id, friendAcceptMatch[1], true));
      }

      const friendDeclineMatch = path.match(/^\/friends\/([^/]+)\/decline$/);
      if (friendDeclineMatch) {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.friends.respond(user.id, friendDeclineMatch[1], false));
      }

      if (path === "/loadouts") {
        if (req.method === "GET") return sendJson(res, 200, services.loadouts.list(user.id));
        if (req.method === "POST") return sendJson(res, 201, services.loadouts.create(user.id, await readJson(req)));
        return methodNotAllowed(res);
      }

      if (path === "/loadouts/validate") {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.loadouts.validate(user.id, await readJson(req)));
      }

      const loadoutMatch = path.match(/^\/loadouts\/([^/]+)$/);
      if (loadoutMatch) {
        if (req.method !== "PATCH") return methodNotAllowed(res);
        return sendJson(res, 200, services.loadouts.update(user.id, loadoutMatch[1], await readJson(req)));
      }

      const activeLoadoutMatch = path.match(/^\/loadouts\/([^/]+)\/activate$/);
      if (activeLoadoutMatch) {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.loadouts.setActive(user.id, activeLoadoutMatch[1]));
      }

      if (path === "/shop/packs" && req.method === "GET") {
        return sendJson(res, 200, services.packs.list());
      }

      const packOpenMatch = path.match(/^\/shop\/packs\/([^/]+)\/open$/);
      if (packOpenMatch) {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 201, services.packs.open(user.id, packOpenMatch[1]));
      }

      if (path === "/quests" && req.method === "GET") {
        return sendJson(res, 200, services.quests.list(user.id));
      }

      const questProgressMatch = path.match(/^\/quests\/progress$/);
      if (questProgressMatch) {
        if (req.method !== "POST") return methodNotAllowed(res);
        const body = await readJson(req);
        return sendJson(res, 200, services.quests.recordProgress(user.id, body.objectiveType, body.amount || 1));
      }

      const questClaimMatch = path.match(/^\/quests\/([^/]+)\/claim$/);
      if (questClaimMatch) {
        if (req.method !== "POST") return methodNotAllowed(res);
        return sendJson(res, 200, services.quests.claim(user.id, questClaimMatch[1]));
      }

      return sendJson(res, 404, { error: "Not found." });
    } catch (error) {
      logServerError(store, req, error, authenticatedUserId);
      const status = error.status || 500;
      return sendJson(res, status, {
        error: error.message || "Internal server error.",
        details: error.details
      });
    }
  }

  return { handle, store, services };
}

module.exports = { createApp, persistenceDebugSnapshot, readJson, sendJson };
