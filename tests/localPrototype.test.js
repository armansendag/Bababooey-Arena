"use strict";

const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");

function listen(app) {
  const server = http.createServer(app.handle);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
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
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

test("prototype UI flow can bootstrap and drive a local battle through HTTP commands", async (t) => {
  const app = createApp();
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());

  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Bababooey Arena/);

  const account = await request(baseUrl, "/prototype/bootstrap", { method: "POST" });
  const auth = { authorization: `Bearer ${account.token}` };
  const collection = await request(baseUrl, "/collection", { headers: auth });
  assert.ok(collection.some((item) => item.ownedCount > 0));

  let match = await request(baseUrl, "/local-matches", { method: "POST" });
  const firstTroop = await request(baseUrl, `/local-matches/${match.id}/commands`, {
    method: "POST",
    body: { type: "playTroop", playerId: "player_1", cardId: "troop_mana_goblin" }
  });
  match = firstTroop.state;
  assert.equal(match.players[0].troops.length, 1);

  match = (await request(baseUrl, `/local-matches/${match.id}/commands`, {
    method: "POST",
    body: { type: "endTurn", playerId: "player_1" }
  })).state;
  match = (await request(baseUrl, `/local-matches/${match.id}/commands`, {
    method: "POST",
    body: { type: "castSpell", playerId: "player_2", cardId: "spell_coin" }
  })).state;
  const secondTroop = await request(baseUrl, `/local-matches/${match.id}/commands`, {
    method: "POST",
    body: { type: "playTroop", playerId: "player_2", cardId: "troop_mana_goblin" }
  });
  match = secondTroop.state;
  match = (await request(baseUrl, `/local-matches/${match.id}/commands`, {
    method: "POST",
    body: { type: "endTurn", playerId: "player_2" }
  })).state;

  match = (await request(baseUrl, `/local-matches/${match.id}/commands`, {
    method: "POST",
    body: {
      type: "attack",
      playerId: "player_1",
      attackerInstanceId: firstTroop.result.instanceId,
      target: { type: "troop", instanceId: secondTroop.result.instanceId }
    }
  })).state;

  assert.equal(match.eventLog.at(-1).type, "troop_attacked");
  assert.equal(match.players[1].troops[0].hp < 3, true);
});

test("prototype bootstrap and profile update use player display names", async (t) => {
  const app = createApp();
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());

  const account = await request(baseUrl, "/prototype/bootstrap", {
    method: "POST",
    body: { displayName: "Arena Ace" }
  });
  const auth = { authorization: `Bearer ${account.token}` };

  assert.equal(account.profile.displayName, "Arena Ace");

  const updated = await request(baseUrl, "/me", {
    method: "PATCH",
    headers: auth,
    body: { displayName: "Core Crusher" }
  });
  assert.equal(updated.displayName, "Core Crusher");

  await assert.rejects(
    () => request(baseUrl, "/me", {
      method: "PATCH",
      headers: auth,
      body: { displayName: "A" }
    }),
    /Display name/
  );
});

test("local prototype command flow can finish a full match", async (t) => {
  const app = createApp();
  const { server, baseUrl } = await listen(app);
  t.after(() => server.close());

  let match = await request(baseUrl, "/local-matches", { method: "POST" });

  async function command(body) {
    const response = await request(baseUrl, `/local-matches/${match.id}/commands`, { method: "POST", body });
    match = response.state;
    return response;
  }

  async function passUntilPlayerOneReadyForSit() {
    let safety = 40;
    while (safety > 0) {
      const playerOne = match.players.find((player) => player.id === "player_1");
      if (match.activePlayerId === "player_1" && playerOne.currentMana >= 7 && !playerOne.spellCooldowns.spell_sit) return;
      await command({ type: "endTurn", playerId: match.activePlayerId });
      safety -= 1;
    }
    throw new Error("Player 1 never became ready to cast Sit.");
  }

  await passUntilPlayerOneReadyForSit();
  await command({ type: "castSpell", playerId: "player_1", cardId: "spell_sit" });

  assert.equal(match.status, "finished");
  assert.equal(match.winnerId, "player_1");
  assert.equal(match.eventLog.at(-1).type, "match_finished");
});
