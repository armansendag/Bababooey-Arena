"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { createConfiguredStore } = require("../src/store/configuredStore");
const { createMemoryStore, serializeStore } = require("../src/store/memoryStore");
const { inferSsl } = require("../src/store/postgresStore");

function register(app, email, displayName) {
  return app.services.auth.register({
    email,
    password: "correct-horse-battery",
    displayName
  });
}

test("configured store falls back to JSON mode when DATABASE_URL is not set", async () => {
  const store = await createConfiguredStore({ env: { DATA_FILE: require("node:path").join(require("node:os").tmpdir(), `bby-${Date.now()}.json`) } });
  assert.equal(typeof store.persist, "function");
  assert.equal(store.cards.size >= 100, true);
});

test("snapshot store preserves every production persistence domain", () => {
  const app = createApp({ store: createMemoryStore() });
  const playerA = register(app, "phase7a-alpha@example.com", "Phase Seven Alpha");
  const playerB = register(app, "phase7a-bravo@example.com", "Phase Seven Bravo");
  app.services.friends.sendRequest(playerA.user.id, playerB.profile.friendCode);
  app.store.profiles.get(playerA.user.id).freePacks = {};
  app.services.packs.open(playerA.user.id, "starter_pack");
  app.services.quests.recordProgress(playerA.user.id, "play_game", 1);
  app.services.onlineMatches.joinQueue(playerA.user.id, "casual");
  const { match } = app.services.onlineMatches.joinQueue(playerB.user.id, "casual");
  app.store.addBugReport({ reporterId: playerA.user.id, matchId: match.id, message: "phase 7a compatibility" });

  const snapshot = serializeStore(app.store);
  const restored = createMemoryStore({ snapshot });

  assert.equal(restored.users.size, 2);
  assert.equal(restored.profiles.size, 2);
  assert.equal(restored.sessions.size, 2);
  assert.equal(restored.playerCards.size, 2);
  assert.equal(restored.loadouts.size, 2);
  assert.equal(restored.friendChallenges.size, 0);
  assert.equal(restored.friendships.size, 1);
  assert.equal(restored.playerQuests.size > 0, true);
  assert.equal(restored.packOpenings.length, 1);
  assert.equal(restored.onlineMatches.size, 1);
  assert.equal(restored.onlineMatchEvents.length > 0, true);
  assert.equal(restored.matchHistory.length, 0);
  assert.equal(restored.coinTransactions.length > 0, true);
  assert.equal(restored.bugReports.length, 1);
});

test("postgres ssl inference supports local and hosted database urls", () => {
  assert.equal(inferSsl("postgres://user:pass@localhost:5432/app"), false);
  assert.deepEqual(inferSsl("postgres://user:pass@example.render.com:5432/app"), { rejectUnauthorized: false });
  assert.deepEqual(inferSsl("postgres://user:pass@ep-cool-name.us-east-2.aws.neon.tech/app?sslmode=require"), { rejectUnauthorized: false });
});
