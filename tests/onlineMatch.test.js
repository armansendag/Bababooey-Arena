"use strict";

const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");
const { createApp } = require("../src/app");
const { attachWebSocketServer } = require("../src/websocket");
const { createMemoryStore, serializeStore } = require("../src/store/memoryStore");
const { createJsonBackedStore } = require("../src/store/jsonStore");

function listen(app) {
  const server = http.createServer(app.handle);
  attachWebSocketServer(server, app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}`, wsUrl: `ws://127.0.0.1:${address.port}/ws` });
    });
  });
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function waitForMessage(socket, predicate, timeoutMs = 3000) {
  socket._messages = socket._messages || [];
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for WebSocket message."));
    }, timeoutMs);
    const interval = setInterval(() => {
      const bufferedIndex = socket._messages.findIndex(predicate);
      if (bufferedIndex >= 0) {
        const [message] = socket._messages.splice(bufferedIndex, 1);
        cleanup();
        resolve(message);
      }
    }, 10);
    function onError(error) {
      cleanup();
      reject(error);
    }
    function cleanup() {
      clearTimeout(timeout);
      clearInterval(interval);
      socket.off("error", onError);
    }
    socket.on("error", onError);
  });
}

function openSocket(wsUrl, token) {
  const socket = new WebSocket(`${wsUrl}?token=${token}`);
  socket._messages = [];
  socket.on("message", (raw) => {
    socket._messages.push(JSON.parse(String(raw)));
  });
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function register(app, email, displayName) {
  return app.services.auth.register({
    email,
    password: "correct-horse-battery",
    displayName
  });
}

function seedCollection(app, playerId) {
  const quantities = {
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
  for (const [cardId, quantity] of Object.entries(quantities)) {
    for (let i = 0; i < quantity; i += 1) app.services.collection.grantCard(cardId, playerId, "online_test");
  }
  return quantities;
}

function createActiveLoadout(app, playerId) {
  const cards = seedCollection(app, playerId);
  const loadout = app.services.loadouts.create(playerId, {
    name: "Online Test",
    coreCardId: "core_starter",
    cards
  });
  app.services.loadouts.setActive(playerId, loadout.id);
  return loadout;
}

function makeOnlineFixture(options = {}) {
  const app = createApp(options);
  const playerA = register(app, "alpha@example.com", "Alpha");
  const playerB = register(app, "bravo@example.com", "Bravo");
  createActiveLoadout(app, playerA.user.id);
  createActiveLoadout(app, playerB.user.id);
  const friendship = app.services.friends.sendRequest(playerA.user.id, playerB.profile.friendCode);
  app.services.friends.respond(playerB.user.id, friendship.id, true);
  return { app, playerA, playerB };
}

async function createAcceptedOnlineMatch(baseUrl, playerA, playerB) {
  const authA = { authorization: `Bearer ${playerA.token}` };
  const authB = { authorization: `Bearer ${playerB.token}` };
  const challenge = await request(baseUrl, "/friend-challenges", {
    method: "POST",
    headers: authA,
    body: { challengedId: playerB.user.id }
  });
  const match = await request(baseUrl, `/friend-challenges/${challenge.id}/accept`, {
    method: "POST",
    headers: authB
  });
  return { match, authA, authB, challenge };
}

function finishWithSitWin(app, match, winner, loser) {
  let current = match;
  function command(playerId, body) {
    const response = app.services.onlineMatches.command(playerId, current.id, body);
    current = response.match;
  }
  function readyForSit() {
    let safety = 40;
    while (safety > 0) {
      const p1 = current.state.players.find((player) => player.id === winner.user.id);
      if (current.state.activePlayerId === winner.user.id && p1.currentMana >= 7 && !p1.spellCooldowns.spell_sit) return;
      command(current.state.activePlayerId, { type: "endTurn" });
      safety -= 1;
    }
    throw new Error("Winner never became ready to cast Sit.");
  }
  for (let i = 0; i < 3 && current.status === "active"; i += 1) {
    readyForSit();
    command(winner.user.id, { type: "castSpell", cardId: "spell_sit" });
  }
  assert.equal(current.status, "finished");
  assert.equal(current.winnerId, winner.user.id);
  assert.ok(loser.user.id);
  return current;
}

test("WebSocket connection authenticates and sends initial state", async (t) => {
  const { app, playerA } = makeOnlineFixture();
  const { server, wsUrl } = await listen(app);
  t.after(() => server.close());

  const socket = await openSocket(wsUrl, playerA.token);
  t.after(() => socket.close());
  const connected = await waitForMessage(socket, (message) => message.type === "connected");

  assert.equal(connected.userId, playerA.user.id);
  assert.ok(Array.isArray(connected.challenges));
  assert.ok(Array.isArray(connected.matches));
});

test("accepting a friend challenge creates an online match room", async (t) => {
  const { app, playerA, playerB } = makeOnlineFixture();
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());
  const authA = { authorization: `Bearer ${playerA.token}` };
  const authB = { authorization: `Bearer ${playerB.token}` };

  const challenge = await request(baseUrl, "/friend-challenges", {
    method: "POST",
    headers: authA,
    body: { challengedId: playerB.user.id }
  });
  const match = await request(baseUrl, `/friend-challenges/${challenge.id}/accept`, {
    method: "POST",
    headers: authB
  });

  assert.equal(match.status, "active");
  assert.deepEqual(match.players.map((player) => player.userId), [playerA.user.id, playerB.user.id]);
  assert.equal(match.state.activePlayerId, playerA.user.id);
  assert.equal(app.store.onlineMatchEvents.length, 1);
});

test("online commands are server-authoritative and reject invalid intent", async (t) => {
  const { app, playerA, playerB } = makeOnlineFixture();
  const { server, baseUrl, wsUrl } = await listen(app);
  t.after(() => server.close());
  const authA = { authorization: `Bearer ${playerA.token}` };
  const authB = { authorization: `Bearer ${playerB.token}` };

  const challenge = await request(baseUrl, "/friend-challenges", {
    method: "POST",
    headers: authA,
    body: { challengedId: playerB.user.id }
  });
  const match = await request(baseUrl, `/friend-challenges/${challenge.id}/accept`, { method: "POST", headers: authB });

  const socketA = await openSocket(wsUrl, playerA.token);
  const socketB = await openSocket(wsUrl, playerB.token);
  t.after(() => {
    socketA.close();
    socketB.close();
  });
  await waitForMessage(socketA, (message) => message.type === "connected");
  await waitForMessage(socketB, (message) => message.type === "connected");
  socketA.send(JSON.stringify({ type: "subscribe_match", matchId: match.id }));
  socketB.send(JSON.stringify({ type: "subscribe_match", matchId: match.id }));
  await waitForMessage(socketA, (message) => message.type === "match_snapshot");

  socketB.send(JSON.stringify({
    type: "command",
    matchId: match.id,
    command: { type: "playTroop", cardId: "troop_mana_goblin" }
  }));
  const invalid = await waitForMessage(socketB, (message) => message.type === "error");
  assert.match(invalid.error, /not this player's turn/i);

  socketA.send(JSON.stringify({
    type: "command",
    matchId: match.id,
    command: { type: "playTroop", cardId: "troop_mana_goblin", playerId: playerB.user.id }
  }));
  const stateMessage = await waitForMessage(socketB, (message) => message.type === "match_state");
  assert.equal(stateMessage.match.state.players[0].troops.length, 1);
  assert.equal(stateMessage.match.state.players[0].troops[0].ownerId, playerA.user.id);
});

test("reconnect receives latest online match state", async (t) => {
  const { app, playerA, playerB } = makeOnlineFixture();
  const { server, baseUrl, wsUrl } = await listen(app);
  t.after(() => server.close());
  const authA = { authorization: `Bearer ${playerA.token}` };
  const authB = { authorization: `Bearer ${playerB.token}` };
  const challenge = await request(baseUrl, "/friend-challenges", { method: "POST", headers: authA, body: { challengedId: playerB.user.id } });
  const match = await request(baseUrl, `/friend-challenges/${challenge.id}/accept`, { method: "POST", headers: authB });

  await request(baseUrl, `/online-matches/${match.id}/commands`, {
    method: "POST",
    headers: authA,
    body: { type: "playTroop", cardId: "troop_mana_goblin" }
  });

  const socket = await openSocket(wsUrl, playerA.token);
  t.after(() => socket.close());
  await waitForMessage(socket, (message) => message.type === "connected");
  socket.send(JSON.stringify({ type: "subscribe_match", matchId: match.id }));
  const snapshot = await waitForMessage(socket, (message) => message.type === "match_snapshot");

  assert.equal(snapshot.match.state.players[0].troops.length, 1);
  assert.equal(snapshot.match.connectedPlayerIds.includes(playerA.user.id), true);
});

test("a full online friend match can finish and records history plus rewards", async (t) => {
  const { app, playerA, playerB } = makeOnlineFixture();
  const { server, baseUrl, wsUrl } = await listen(app);
  t.after(() => server.close());
  const authA = { authorization: `Bearer ${playerA.token}` };
  const authB = { authorization: `Bearer ${playerB.token}` };
  const challenge = await request(baseUrl, "/friend-challenges", { method: "POST", headers: authA, body: { challengedId: playerB.user.id } });
  let match = await request(baseUrl, `/friend-challenges/${challenge.id}/accept`, { method: "POST", headers: authB });

  const socketA = await openSocket(wsUrl, playerA.token);
  t.after(() => socketA.close());
  await waitForMessage(socketA, (message) => message.type === "connected");
  socketA.send(JSON.stringify({ type: "subscribe_match", matchId: match.id }));
  await waitForMessage(socketA, (message) => message.type === "match_snapshot");

  async function commandAsA(command) {
    const response = await request(baseUrl, `/online-matches/${match.id}/commands`, {
      method: "POST",
      headers: authA,
      body: command
    });
    match = response.match;
  }

  async function passUntilPlayerOneReadyForSit() {
    let safety = 40;
    while (safety > 0) {
      const playerOne = match.state.players.find((player) => player.id === playerA.user.id);
      if (match.state.activePlayerId === playerA.user.id && playerOne.currentMana >= 7 && !playerOne.spellCooldowns.spell_sit) return;
      await request(baseUrl, `/online-matches/${match.id}/commands`, {
        method: "POST",
        headers: match.state.activePlayerId === playerA.user.id ? authA : authB,
        body: { type: "endTurn" }
      });
      match = await request(baseUrl, `/online-matches/${match.id}`, { headers: authA });
      safety -= 1;
    }
    throw new Error("Player 1 never became ready to cast Sit.");
  }

  for (let cast = 0; cast < 3 && match.status === "active"; cast += 1) {
    await passUntilPlayerOneReadyForSit();
    await commandAsA({ type: "castSpell", cardId: "spell_sit" });
  }

  assert.equal(match.status, "finished");
  assert.equal(match.winnerId, playerA.user.id);
  assert.equal(app.store.matchHistory.length, 2);
  assert.equal(app.store.profiles.get(playerA.user.id).coins, 1100);
  assert.equal(app.store.profiles.get(playerB.user.id).coins, 1025);
  assert.ok(app.store.onlineMatchEvents.some((event) => event.eventType === "match_finished"));
});

test("disconnect timeout abandons a match and reconnect before timeout preserves it", async (t) => {
  const { app, playerA, playerB } = makeOnlineFixture({ onlineMatchOptions: { disconnectTimeoutMs: 80 } });
  const { server, baseUrl, wsUrl } = await listen(app);
  t.after(() => server.close());
  const { match } = await createAcceptedOnlineMatch(baseUrl, playerA, playerB);

  const socketA = await openSocket(wsUrl, playerA.token);
  await waitForMessage(socketA, (message) => message.type === "connected");
  socketA.send(JSON.stringify({ type: "subscribe_match", matchId: match.id }));
  await waitForMessage(socketA, (message) => message.type === "match_snapshot");
  socketA.close();
  await new Promise((resolve) => setTimeout(resolve, 30));

  const reconnectA = await openSocket(wsUrl, playerA.token);
  t.after(() => reconnectA.close());
  await waitForMessage(reconnectA, (message) => message.type === "connected");
  reconnectA.send(JSON.stringify({ type: "subscribe_match", matchId: match.id }));
  const liveSnapshot = await waitForMessage(reconnectA, (message) => message.type === "match_snapshot");
  assert.equal(liveSnapshot.match.status, "active");
  reconnectA.close();

  await new Promise((resolve) => setTimeout(resolve, 120));
  const abandoned = app.services.onlineMatches.getMatch(playerB.user.id, match.id);
  assert.equal(abandoned.status, "abandoned");
  assert.equal(abandoned.winnerId, playerB.user.id);
});

test("malformed commands are rejected before reaching gameplay rules", async (t) => {
  const { app, playerA, playerB } = makeOnlineFixture();
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());
  const { match, authA } = await createAcceptedOnlineMatch(baseUrl, playerA, playerB);

  await assert.rejects(
    () => request(baseUrl, `/online-matches/${match.id}/commands`, {
      method: "POST",
      headers: authA,
      body: { type: "attack", attackerInstanceId: 4, target: { type: "troop" } }
    }),
    /attackerInstanceId is required/
  );

  await assert.rejects(
    () => request(baseUrl, `/online-matches/${match.id}/commands`, {
      method: "POST",
      headers: authA,
      body: { type: "playTroop", cardId: "troop_mana_goblin", coins: 999999 }
    }),
    /unexpected field coins/
  );
});

test("rate limits friend challenges and online commands", async (t) => {
  const { app, playerA, playerB } = makeOnlineFixture();
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());
  const authA = { authorization: `Bearer ${playerA.token}` };

  for (let i = 0; i < 5; i += 1) {
    await request(baseUrl, "/friend-challenges", {
      method: "POST",
      headers: authA,
      body: { challengedId: playerB.user.id }
    });
  }
  await assert.rejects(
    () => request(baseUrl, "/friend-challenges", {
      method: "POST",
      headers: authA,
      body: { challengedId: playerB.user.id }
    }),
    /Rate limit exceeded/
  );

  const challenge = Array.from(app.store.friendChallenges.values()).find((item) => item.status === "pending");
  const match = app.services.onlineMatches.acceptChallenge(playerB.user.id, challenge.id);
  app.services.onlineMatches.command(playerA.user.id, match.id, { type: "endTurn" });
  for (let i = 0; i < 39; i += 1) {
    assert.throws(() => app.services.onlineMatches.command(playerA.user.id, match.id, { type: "endTurn" }), /Invalid command|not this player's turn|Not enough mana|not active|cooldown|not ready/i);
  }
  assert.throws(() => app.services.onlineMatches.command(playerA.user.id, match.id, { type: "endTurn" }), /Rate limit exceeded/);
});

test("rewards are granted only once even after restart snapshot", async (t) => {
  const { app, playerA, playerB } = makeOnlineFixture();
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());
  const { match, authA, authB } = await createAcceptedOnlineMatch(baseUrl, playerA, playerB);
  let current = match;

  async function command(headers, body) {
    const response = await request(baseUrl, `/online-matches/${current.id}/commands`, { method: "POST", headers, body });
    current = response.match;
  }
  async function readyForSit() {
    let safety = 40;
    while (safety > 0) {
      const p1 = current.state.players.find((player) => player.id === playerA.user.id);
      if (current.state.activePlayerId === playerA.user.id && p1.currentMana >= 7 && !p1.spellCooldowns.spell_sit) return;
      await command(current.state.activePlayerId === playerA.user.id ? authA : authB, { type: "endTurn" });
      safety -= 1;
    }
    throw new Error("not ready");
  }
  for (let i = 0; i < 3 && current.status === "active"; i += 1) {
    await readyForSit();
    await command(authA, { type: "castSpell", cardId: "spell_sit" });
  }

  const snapshot = serializeStore(app.store);
  const restartedStore = createMemoryStore({ snapshot });
  const restartedApp = createApp({ store: restartedStore });
  const history = restartedApp.services.onlineMatches.history(playerA.user.id);
  assert.equal(history.length, 1);
  assert.equal(restartedStore.profiles.get(playerA.user.id).coins, 1100);
  assert.throws(
    () => restartedApp.services.onlineMatches.command(playerA.user.id, current.id, { type: "endTurn" }),
    /Match is not active/
  );
  assert.equal(restartedStore.matchHistory.length, 2);
  assert.equal(restartedStore.coinTransactions.filter((tx) => tx.sourceId === current.id).length, 2);
});

test("match history and event log survive mock persistence restart", async (t) => {
  const { app, playerA, playerB } = makeOnlineFixture();
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());
  const { match, authA } = await createAcceptedOnlineMatch(baseUrl, playerA, playerB);

  await request(baseUrl, `/online-matches/${match.id}/commands`, {
    method: "POST",
    headers: authA,
    body: { type: "playTroop", cardId: "troop_mana_goblin" }
  });

  const snapshot = serializeStore(app.store);
  const restartedStore = createMemoryStore({ snapshot });
  const restartedApp = createApp({ store: restartedStore });
  const restored = restartedApp.services.onlineMatches.getMatch(playerA.user.id, match.id);

  assert.equal(restored.state.players[0].troops.length, 1);
  assert.ok(restartedStore.onlineMatchEvents.some((event) => event.eventType === "troop_played"));
});

test("json-backed store persists online match history across app restart", async (t) => {
  const filePath = require("node:path").join(require("node:os").tmpdir(), `bababooey-${Date.now()}-${Math.random()}.json`);
  t.after(() => {
    try { require("node:fs").unlinkSync(filePath); } catch {}
  });
  const store = createJsonBackedStore(filePath);
  const app = createApp({ store });
  const playerA = register(app, "persist-alpha@example.com", "Persist Alpha");
  const playerB = register(app, "persist-bravo@example.com", "Persist Bravo");
  createActiveLoadout(app, playerA.user.id);
  createActiveLoadout(app, playerB.user.id);
  const friendship = app.services.friends.sendRequest(playerA.user.id, playerB.profile.friendCode);
  app.services.friends.respond(playerB.user.id, friendship.id, true);
  const challenge = app.services.onlineMatches.sendChallenge(playerA.user.id, playerB.user.id);
  const match = app.services.onlineMatches.acceptChallenge(playerB.user.id, challenge.id);
  app.services.onlineMatches.command(playerA.user.id, match.id, { type: "playTroop", cardId: "troop_mana_goblin" });

  const restartedStore = createJsonBackedStore(filePath);
  const restartedApp = createApp({ store: restartedStore });
  const restored = restartedApp.services.onlineMatches.getMatch(playerA.user.id, match.id);
  assert.equal(restored.state.players[0].troops.length, 1);
  assert.ok(restartedStore.onlineMatchEvents.some((event) => event.eventType === "troop_played"));
});

test("casual queue supports join, cancel, and match creation", async (t) => {
  const { app, playerA, playerB } = makeOnlineFixture();
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());
  const authA = { authorization: `Bearer ${playerA.token}` };
  const authB = { authorization: `Bearer ${playerB.token}` };

  const joined = await request(baseUrl, "/queue/casual/join", { method: "POST", headers: authA });
  assert.equal(joined.queue.status, "searching");
  assert.equal(joined.queue.mode, "casual");

  const cancelled = await request(baseUrl, "/queue/cancel", { method: "POST", headers: authA });
  assert.equal(cancelled.status, "idle");

  await request(baseUrl, "/queue/casual/join", { method: "POST", headers: authA });
  const matched = await request(baseUrl, "/queue/casual/join", { method: "POST", headers: authB });
  assert.equal(matched.queue.status, "matched");
  assert.equal(matched.match.mode, "casual");
  assert.deepEqual(matched.match.players.map((player) => player.userId), [playerA.user.id, playerB.user.id]);
});

test("players cannot queue without a valid active loadout", async (t) => {
  const app = createApp();
  const player = register(app, "queue-noloadout@example.com", "No Loadout");
  for (const [id, loadout] of Array.from(app.store.loadouts.entries())) {
    if (loadout.playerId === player.user.id) app.store.loadouts.delete(id);
  }
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());

  await assert.rejects(
    () => request(baseUrl, "/queue/ranked/join", {
      method: "POST",
      headers: { authorization: `Bearer ${player.token}` }
    }),
    /Starter Deck/
  );
});

test("casual matches grant casual rewards only once", () => {
  const { app, playerA, playerB } = makeOnlineFixture();
  app.services.onlineMatches.joinQueue(playerA.user.id, "casual");
  const { match } = app.services.onlineMatches.joinQueue(playerB.user.id, "casual");

  const finished = finishWithSitWin(app, match, playerA, playerB);

  assert.equal(app.store.profiles.get(playerA.user.id).coins, 1050);
  assert.equal(app.store.profiles.get(playerB.user.id).coins, 1010);
  assert.equal(app.store.matchHistory.find((entry) => entry.playerId === playerA.user.id).mode, "casual");
  assert.equal(app.store.coinTransactions.filter((tx) => tx.sourceId === finished.id).length, 2);
});

test("ranked matches update ratings, tiers, rewards, and avoid duplicate grants", () => {
  const { app, playerA, playerB } = makeOnlineFixture();
  app.services.onlineMatches.joinQueue(playerA.user.id, "ranked");
  const { match } = app.services.onlineMatches.joinQueue(playerB.user.id, "ranked");

  const finished = finishWithSitWin(app, match, playerA, playerB);
  const ratingA = app.services.onlineMatches.rankedProfile(playerA.user.id);
  const ratingB = app.services.onlineMatches.rankedProfile(playerB.user.id);

  assert.equal(ratingA.rating, 1025);
  assert.equal(ratingA.tier, "Silver");
  assert.equal(ratingB.rating, 985);
  assert.equal(ratingB.tier, "Bronze");
  assert.equal(app.store.profiles.get(playerA.user.id).coins, 1100);
  assert.equal(app.store.profiles.get(playerB.user.id).coins, 1025);
  app.store.onlineMatches.get(finished.id).rewarded = false;
  app.services.onlineMatches.cleanupInactiveMatches();
  assert.equal(app.store.coinTransactions.filter((tx) => tx.sourceId === finished.id).length, 2);
  assert.equal(app.store.matchHistory.filter((entry) => entry.matchId === finished.id).length, 2);
});

test("leaderboards order ranked rating and casual wins", () => {
  const { app, playerA, playerB } = makeOnlineFixture();
  const playerC = register(app, "charlie@example.com", "Charlie");
  createActiveLoadout(app, playerC.user.id);
  app.store.rankedRatings.set(playerA.user.id, { playerId: playerA.user.id, rating: 1400, wins: 4, losses: 1, updatedAt: new Date().toISOString() });
  app.store.rankedRatings.set(playerB.user.id, { playerId: playerB.user.id, rating: 1600, wins: 2, losses: 0, updatedAt: new Date().toISOString() });
  app.store.rankedRatings.set(playerC.user.id, { playerId: playerC.user.id, rating: 1600, wins: 5, losses: 2, updatedAt: new Date().toISOString() });
  app.store.matchHistory.push(
    { id: "h1", matchId: "m1", mode: "casual", playerId: playerA.user.id, opponentId: playerB.user.id, result: "win", rewardCoins: 50, createdAt: new Date().toISOString() },
    { id: "h2", matchId: "m2", mode: "casual", playerId: playerA.user.id, opponentId: playerC.user.id, result: "win", rewardCoins: 50, createdAt: new Date().toISOString() },
    { id: "h3", matchId: "m3", mode: "casual", playerId: playerB.user.id, opponentId: playerA.user.id, result: "win", rewardCoins: 50, createdAt: new Date().toISOString() }
  );

  const boards = app.services.onlineMatches.leaderboards();

  assert.equal(boards.ranked[0].userId, playerC.user.id);
  assert.equal(boards.ranked[0].tier, "Diamond");
  assert.equal(boards.casual[0].userId, playerA.user.id);
  assert.equal(boards.casual[0].wins, 2);
});

test("cleanup abandons old inactive matches", () => {
  const now = Date.now();
  const { app, playerA, playerB } = makeOnlineFixture({
    onlineMatchOptions: {
      staleMatchMs: 10,
      nowMs: () => now
    }
  });
  const challenge = app.services.onlineMatches.sendChallenge(playerA.user.id, playerB.user.id);
  const match = app.services.onlineMatches.acceptChallenge(playerB.user.id, challenge.id);
  app.store.onlineMatches.get(match.id).createdAt = new Date(now - 1000).toISOString();
  const cleaned = app.services.onlineMatches.cleanupInactiveMatches();
  const restored = app.services.onlineMatches.getMatch(playerA.user.id, match.id);
  assert.equal(cleaned, 1);
  assert.equal(restored.status, "abandoned");
});
