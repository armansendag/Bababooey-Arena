"use strict";

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { createJsonBackedStore } = require("../src/store/jsonStore");

function register(app, email, displayName) {
  return app.services.auth.register({
    email,
    password: "correct-horse-battery",
    displayName
  });
}

function seedRankedLoadout(app, playerId) {
  const cards = {
    troop_mana_goblin: 3,
    troop_mana_slime: 3,
    troop_mana_golem: 2,
    troop_mana_dragon: 1,
    troop_enchantment_eater: 3,
    troop_arcane_hunter: 2,
    troop_demolition_bot: 2,
    spell_sit: 1,
    spell_emergency_funding: 1,
    spell_disenchant: 1,
    enchant_mana_spring: 1
  };
  for (const [cardId, quantity] of Object.entries(cards)) {
    for (let i = 0; i < quantity; i += 1) app.services.collection.grantCard(cardId, playerId, "phase7b_seed");
  }
  const loadout = app.services.loadouts.create(playerId, {
    name: "Production Test",
    coreCardId: "core_starter",
    cards
  });
  app.services.loadouts.setActive(playerId, loadout.id);
  return loadout;
}

function finishWithSitWin(app, match, winnerId) {
  let current = match;
  function command(playerId, body) {
    const response = app.services.onlineMatches.command(playerId, current.id, body);
    current = response.match;
  }
  function readyForSit() {
    let safety = 50;
    while (safety > 0) {
      const player = current.state.players.find((item) => item.id === winnerId);
      if (current.state.activePlayerId === winnerId && player.currentMana >= 7 && !player.spellCooldowns.spell_sit) return;
      command(current.state.activePlayerId, { type: "endTurn" });
      safety -= 1;
    }
    throw new Error("Winner never became ready to cast Sit.");
  }
  for (let i = 0; i < 3 && current.status === "active"; i += 1) {
    readyForSit();
    command(winnerId, { type: "castSpell", cardId: "spell_sit" });
  }
  return current;
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

async function request(baseUrl, endpoint, token) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

test("production persistence domains survive restart-style store reload", async (t) => {
  const filePath = path.join(os.tmpdir(), `bababooey-phase7b-${Date.now()}-${Math.random()}.json`);
  t.after(() => {
    try { fs.unlinkSync(filePath); } catch {}
  });

  const app = createApp({ store: createJsonBackedStore(filePath), random: () => 0 });
  const playerA = register(app, "phase7b-alpha@example.com", "Phase 7B Alpha");
  const playerB = register(app, "phase7b-bravo@example.com", "Phase 7B Bravo");
  seedRankedLoadout(app, playerA.user.id);
  seedRankedLoadout(app, playerB.user.id);

  app.services.packs.open(playerA.user.id, "starter_pack");
  const afterPackStore = createJsonBackedStore(filePath);
  assert.equal(afterPackStore.packOpenings.length, 1);
  assert.equal(afterPackStore.playerQuests.size > 0, true);

  const friendship = app.services.friends.sendRequest(playerA.user.id, playerB.profile.friendCode);
  app.services.friends.respond(playerB.user.id, friendship.id, true);
  app.services.onlineMatches.joinQueue(playerA.user.id, "ranked");
  const { match } = app.services.onlineMatches.joinQueue(playerB.user.id, "ranked");
  const finished = finishWithSitWin(app, match, playerA.user.id);
  assert.equal(finished.status, "finished");

  const restartedStore = createJsonBackedStore(filePath);
  const restartedApp = createApp({ store: restartedStore });

  assert.equal(restartedStore.users.size, 2);
  assert.equal(restartedStore.sessions.has(playerA.token), true);
  assert.equal(restartedStore.profiles.get(playerA.user.id).coins !== 1000, true);
  assert.equal(restartedStore.packOpenings.length, 1);
  assert.equal((restartedStore.playerCards.get(playerA.user.id).get("spell_sit") || 0) > 0, true);
  assert.equal(Array.from(restartedStore.loadouts.values()).some((loadout) => loadout.name === "Production Test"), true);
  assert.equal(Array.from(restartedStore.friendships.values()).some((item) => item.status === "accepted"), true);
  assert.equal(restartedStore.matchHistory.length, 2);
  assert.equal(restartedStore.rankedRatings.get(playerA.user.id).rating, 1025);
  assert.equal(restartedApp.services.onlineMatches.history(playerA.user.id).length, 1);
});

test("debug persistence endpoint reports store type and domain counts", async (t) => {
  const app = createApp({ store: createJsonBackedStore(path.join(os.tmpdir(), `bababooey-debug-${Date.now()}-${Math.random()}.json`)) });
  const player = register(app, "debug-persistence@example.com", "Debug Persistence");
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());

  const payload = await request(baseUrl, "/debug/persistence", player.token);

  assert.equal(payload.storeType, "json");
  assert.equal(payload.databaseConnected, true);
  assert.equal(payload.counts.users, 1);
  assert.equal(payload.counts.collections, 1);
  assert.equal(payload.counts.loadouts, 1);
});
