"use strict";

const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");

function register(app, email, displayName) {
  return app.services.auth.register({
    email,
    password: "correct-horse-battery",
    displayName
  });
}

function listen(app) {
  const server = http.createServer(app.handle);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function request(baseUrl, endpoint, options = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function seedPlayerData(app, playerA, playerB) {
  app.services.friends.sendRequest(playerA.user.id, playerB.profile.friendCode);
  app.store.friendChallenges.set("challenge_1", {
    id: "challenge_1",
    challengerId: playerA.user.id,
    challengedId: playerB.user.id,
    status: "pending"
  });
  app.store.addCoinTransaction({ playerId: playerA.user.id, amount: 25, reason: "test_reward", sourceId: "reward_1" });
  app.store.profiles.get(playerA.user.id).freePacks = {};
  app.services.packs.open(playerA.user.id, "starter_pack");
  app.services.quests.recordProgress(playerA.user.id, "play_game", 1);
  app.services.onlineMatches.joinQueue(playerA.user.id, "casual");
  const { match } = app.services.onlineMatches.joinQueue(playerB.user.id, "casual");
  app.store.onlineMatchEvents.push({ id: "event_1", matchId: match.id, eventType: "test_event" });
  app.store.matchHistory.push({ matchId: match.id, playerIds: [playerA.user.id, playerB.user.id], winnerId: playerA.user.id });
  app.store.rankedRatings.set(playerA.user.id, { playerId: playerA.user.id, rating: 1200, wins: 1, losses: 0 });
  app.store.addBugReport({ reporterId: playerA.user.id, matchId: match.id, message: "reset seed" });
}

test("resetPlayerAccount restores starter progression and clears that player's data", () => {
  const app = createApp();
  const playerA = register(app, "reset-a@example.com", "Reset Alpha");
  const playerB = register(app, "reset-b@example.com", "Reset Bravo");
  seedPlayerData(app, playerA, playerB);

  app.store.resetPlayerAccount(playerA.user.id);

  const profile = app.store.profiles.get(playerA.user.id);
  const owned = app.store.playerCards.get(playerA.user.id);
  const loadouts = Array.from(app.store.loadouts.values()).filter((loadout) => loadout.playerId === playerA.user.id);

  assert.equal(app.store.users.has(playerA.user.id), true);
  assert.equal(profile.displayName, "Reset Alpha");
  assert.equal(profile.coins, 1000);
  assert.deepEqual(profile.freePacks, { starter_pack: 3 });
  assert.equal(owned.size, 9);
  assert.equal(loadouts.length, 1);
  assert.equal(loadouts[0].name, "Beginner Starter");
  assert.equal(app.store.friendships.size, 0);
  assert.equal(app.store.friendChallenges.size, 0);
  assert.equal(app.store.playerQuests.has(playerA.user.id), false);
  assert.equal(app.store.rankedRatings.has(playerA.user.id), false);
  assert.equal(app.store.coinTransactions.some((transaction) => transaction.playerId === playerA.user.id), false);
  assert.equal(app.store.packOpenings.some((opening) => opening.playerId === playerA.user.id), false);
  assert.equal(app.store.matchHistory.some((history) => history.playerIds.includes(playerA.user.id)), false);
  assert.equal(app.store.onlineMatchEvents.length, 0);
  assert.equal(app.store.cards.size > 0, true);
  assert.equal(app.store.packs.size > 0, true);
  assert.equal(app.store.quests.size > 0, true);
});

test("resetAllPlayerData clears player state while preserving game content", () => {
  const app = createApp();
  const playerA = register(app, "all-a@example.com", "All Alpha");
  const playerB = register(app, "all-b@example.com", "All Bravo");
  seedPlayerData(app, playerA, playerB);
  app.store.logError({ scope: "test", message: "seed error" });

  const contentCounts = {
    cards: app.store.cards.size,
    packs: app.store.packs.size,
    quests: app.store.quests.size
  };
  const result = app.store.resetAllPlayerData();

  assert.deepEqual(result, { users: 0, collections: 0, loadouts: 0, matches: 0, transactions: 0 });
  assert.equal(app.store.users.size, 0);
  assert.equal(app.store.profiles.size, 0);
  assert.equal(app.store.sessions.size, 0);
  assert.equal(app.store.playerCards.size, 0);
  assert.equal(app.store.loadouts.size, 0);
  assert.equal(app.store.friendships.size, 0);
  assert.equal(app.store.friendChallenges.size, 0);
  assert.equal(app.store.playerQuests.size, 0);
  assert.equal(app.store.matchHistory.length, 0);
  assert.equal(app.store.rankedRatings.size, 0);
  assert.equal(app.store.coinTransactions.length, 0);
  assert.equal(app.store.packOpenings.length, 0);
  assert.equal(app.store.onlineMatchEvents.length, 0);
  assert.equal(app.store.bugReports.length, 0);
  assert.equal(app.store.errorLogs.length, 0);
  assert.equal(app.store.cards.size, contentCounts.cards);
  assert.equal(app.store.packs.size, contentCounts.packs);
  assert.equal(app.store.quests.size, contentCounts.quests);
});

test("admin reset HTTP routes require confirmation", async (t) => {
  const app = createApp();
  const player = register(app, "http-reset@example.com", "HTTP Reset");
  app.store.addCoinTransaction({ playerId: player.user.id, amount: 25, reason: "test_reward" });
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());
  const auth = { authorization: `Bearer ${player.token}` };

  await assert.rejects(
    () => request(baseUrl, "/admin/reset-my-account", { method: "POST", headers: auth, body: { confirmation: "RESET" } }),
    /Confirmation required/
  );

  const reset = await request(baseUrl, "/admin/reset-my-account", {
    method: "POST",
    headers: auth,
    body: { confirmation: "RESET MY ACCOUNT" }
  });
  assert.equal(reset.profile.coins, 1000);

  const full = await request(baseUrl, "/admin/reset-all-player-data", {
    method: "POST",
    headers: auth,
    body: { confirmation: "RESET ALL PLAYER DATA" }
  });
  assert.equal(full.reset.users, 0);
  assert.equal(app.store.cards.size > 0, true);
});
