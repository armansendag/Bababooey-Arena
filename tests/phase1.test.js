"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { cards } = require("../src/data/cards");
const { packs } = require("../src/data/packs");
const { USERNAME_CHANGE_COOLDOWN_MS } = require("../src/services/profileService");
const { createMemoryStore, serializeStore } = require("../src/store/memoryStore");

function register(app, email, displayName) {
  return app.services.auth.register({
    email,
    password: "correct-horse-battery",
    displayName
  });
}

function grantLegalLoadoutCollection(app, playerId) {
  const quantities = {
    troop_mana_goblin: 3,
    troop_mana_slime: 3,
    troop_mana_golem: 2,
    troop_mana_dragon: 1,
    troop_enchantment_eater: 3,
    troop_arcane_hunter: 2,
    troop_demolition_bot: 2,
    spell_disenchant: 2,
    enchant_mana_spring: 2
  };

  for (const [cardId, quantity] of Object.entries(quantities)) {
    for (let i = 0; i < quantity; i += 1) {
      app.services.collection.grantCard(cardId, playerId, "test_seed");
    }
  }

  return quantities;
}

test("register creates a profile with starting coins and a friend code", () => {
  const app = createApp();
  const result = register(app, "a@example.com", "Arman");

  assert.equal(result.profile.coins, 1000);
  assert.match(result.profile.friendCode, /^BBY-[A-F0-9]{6}$/);
  assert.ok(result.token);
  assert.equal(result.profile.displayName, "Arman");
  assert.equal(result.profile.username, "Arman");
  assert.equal(result.profile.normalizedUsername, "arman");
  assert.deepEqual(result.profile.freePacks, { starter_pack: 3 });
  const loadouts = app.services.loadouts.list(result.user.id);
  assert.equal(loadouts.length, 1);
  assert.equal(loadouts.some((loadout) => loadout.name === "Beginner Starter" && loadout.isActive), true);
  const owned = app.store.playerCards.get(result.user.id);
  assert.equal(owned.size < cards.length, true);
  assert.equal(Array.from(owned.keys()).filter((cardId) => app.store.cards.get(cardId).type === "core").length, 1);
});

test("cannot create duplicate username with different casing", () => {
  const app = createApp();
  register(app, "one@example.com", "Alpha_User");

  assert.throws(
    () => app.services.auth.register({ email: "two@example.com", password: "correct-horse-battery", username: "alpha_user" }),
    /Username is already taken/
  );
});

test("invalid usernames are rejected", () => {
  const app = createApp();
  for (const username of ["ab", "has space", "toolong_username_123", "bad-name"]) {
    assert.throws(
      () => app.services.auth.register({ email: `${username.replace(/[^a-z]/g, "") || "bad"}@example.com`, password: "correct-horse-battery", username }),
      /Username must be 3-16/
    );
  }
});

test("user data persists by account username identity", () => {
  const app = createApp();
  const player = app.services.auth.register({ email: "persist-user@example.com", password: "correct-horse-battery", username: "Persist_User" });
  app.store.addCoinTransaction({ playerId: player.user.id, amount: 25, reason: "test_reward" });

  const restored = createMemoryStore({ snapshot: serializeStore(app.store) });
  const user = restored.usersByUsername.get("persist_user");
  assert.equal(user.id, player.user.id);
  assert.equal(restored.profiles.get(player.user.id).coins, 1025);
  assert.equal(restored.playerCards.has(player.user.id), true);
  assert.equal(restored.loadouts.size, 1);
});

test("username change works and then respects cooldown", () => {
  const app = createApp();
  const player = register(app, "rename@example.com", "RenameMe");

  const updated = app.services.profiles.update(player.user.id, { username: "Renamed_1" });
  assert.equal(updated.username, "Renamed_1");
  assert.equal(app.store.usersByUsername.get("renamed_1").id, player.user.id);
  assert.equal(app.store.usersByUsername.has("renameme"), false);

  assert.throws(
    () => app.services.profiles.update(player.user.id, { username: "Renamed_2" }),
    /once every 30 days/
  );

  const profile = app.store.profiles.get(player.user.id);
  const user = app.store.users.get(player.user.id);
  const oldEnough = new Date(Date.now() - USERNAME_CHANGE_COOLDOWN_MS - 1000).toISOString();
  profile.usernameLastChangedAt = oldEnough;
  user.usernameLastChangedAt = oldEnough;
  assert.equal(app.services.profiles.update(player.user.id, { username: "Renamed_2" }).username, "Renamed_2");
});

test("friends can be found by username or friend code", () => {
  const app = createApp();
  const playerA = register(app, "friend-a@example.com", "FriendA");
  const playerB = register(app, "friend-b@example.com", "FriendB");
  const playerC = register(app, "friend-c@example.com", "FriendC");

  const byUsername = app.services.friends.sendRequest(playerA.user.id, "friendb");
  assert.equal(byUsername.addressee.username, "FriendB");

  const byCode = app.services.friends.sendRequest(playerA.user.id, playerC.profile.friendCode);
  assert.equal(byCode.addressee.username, "FriendC");
});

test("new accounts receive limited starter rewards, not the full catalog", () => {
  const app = createApp();
  const player = register(app, "limited@example.com", "Limited");
  const owned = app.store.playerCards.get(player.user.id);
  const totalCopies = Array.from(owned.values()).reduce((sum, count) => sum + count, 0);

  assert.equal(app.store.profiles.get(player.user.id).coins, 1000);
  assert.deepEqual(app.store.profiles.get(player.user.id).freePacks, { starter_pack: 3 });
  assert.equal(owned.size, 9);
  assert.equal(totalCopies, 21);
  assert.equal(owned.size < app.store.cards.size, true);
});

test("pack shop returns all configured pack types with odds and descriptions", () => {
  const app = createApp();
  const shop = app.services.packs.list();

  assert.deepEqual(shop.map((pack) => pack.id), [
    "starter_pack",
    "basic_pack",
    "rare_pack",
    "epic_pack",
    "mythic_pack",
    "chaos_pack",
    "archetype_pack",
    "core_cache"
  ]);
  assert.equal(shop.length, packs.length);
  assert.equal(shop.every((pack) => pack.description && pack.dropTable.length > 0 && Number.isInteger(pack.cardsPerPack)), true);
});

test("starter packs only roll common, uncommon, and rare cards", () => {
  const starter = packs.find((pack) => pack.id === "starter_pack");
  assert.deepEqual(starter.dropTable.map((entry) => entry.rarity), ["common", "uncommon", "rare"]);
});

test("friend requests are created and accepted by friend code", () => {
  const app = createApp();
  const playerA = register(app, "a@example.com", "Alpha");
  const playerB = register(app, "b@example.com", "Bravo");

  const request = app.services.friends.sendRequest(playerA.user.id, playerB.profile.friendCode);
  assert.equal(request.status, "pending");

  const accepted = app.services.friends.respond(playerB.user.id, request.id, true);
  assert.equal(accepted.status, "accepted");

  const friends = app.services.friends.list(playerA.user.id);
  assert.equal(friends.length, 1);
  assert.equal(friends[0].addressee.displayName, "Bravo");
});

test("loadout builder enforces ownership, total count, and copy limits", () => {
  const app = createApp();
  const player = register(app, "loadout@example.com", "Builder");
  const cards = grantLegalLoadoutCollection(app, player.user.id);

  const valid = app.services.loadouts.validate(player.user.id, {
    name: "Mana Curve",
    coreCardId: "core_starter",
    cards
  });

  assert.equal(valid.valid, true);
  assert.equal(valid.summary.total, 20);
  assert.equal(valid.summary.troops, 16);
  assert.equal(valid.summary.spells, 2);
  assert.equal(valid.summary.enchantments, 2);

  const loadout = app.services.loadouts.create(player.user.id, {
    name: "Mana Curve",
    coreCardId: "core_starter",
    cards
  });
  assert.equal(loadout.name, "Mana Curve");
});

test("loadouts may use any card type mix when count, ownership, and copy limits are valid", () => {
  const app = createApp();
  const player = register(app, "anymix@example.com", "Any Mix");
  const spellCards = Array.from(app.store.cards.values()).filter((card) => card.type === "spell").slice(0, 20);
  for (const card of spellCards) {
    app.services.collection.grantCard(card.id, player.user.id, "test_seed");
  }

  const result = app.services.loadouts.validate(player.user.id, {
    coreCardId: "core_starter",
    cards: Object.fromEntries(spellCards.map((card) => [card.id, 1]))
  });

  assert.equal(result.valid, true, result.errors.join(", "));
  assert.equal(result.summary.total, 20);
  assert.equal(result.summary.spells, 20);
  assert.equal(result.summary.troops, 0);
  assert.equal(result.summary.enchantments, 0);
});

test("invalid loadouts report copy limit and total count failures", () => {
  const app = createApp();
  const player = register(app, "invalid@example.com", "Invalid");
  grantLegalLoadoutCollection(app, player.user.id);

  const result = app.services.loadouts.validate(player.user.id, {
    coreCardId: "core_starter",
    cards: {
      troop_mana_dragon: 2,
      spell_disenchant: 4
    }
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("unique copy limit")));
  assert.ok(result.errors.some((error) => error.includes("exactly 20")));
  assert.equal(result.errors.some((error) => error.includes("14-16 troops")), false);
  assert.equal(result.errors.some((error) => error.includes("up to 3 spells")), false);
});

test("pack opening charges coins, grants cards, converts copies beyond ten, and advances quests", () => {
  const app = createApp({ random: () => 0 });
  const player = register(app, "pack@example.com", "Packer");
  app.store.profiles.get(player.user.id).freePacks = {};
  const owned = app.store.playerCards.get(player.user.id);
  for (const card of app.store.cards.values()) {
    if (card.type !== "core") owned.set(card.id, 10);
  }

  const result = app.services.packs.open(player.user.id, "starter_pack");

  assert.equal(result.cards.length, 6);
  assert.equal(result.opening.duplicateCoins > 0, true);
  assert.equal(result.profile.coins > 800, true);

  const quests = app.services.quests.list(player.user.id);
  const openPackQuest = quests.find((quest) => quest.id === "weekly_open_packs");
  assert.equal(openPackQuest.progress, 1);
});

test("free starter pack opens before spending coins and adds cards", () => {
  const app = createApp({ random: () => 0 });
  const player = register(app, "freepack@example.com", "Free Pack");
  const beforeCoins = app.store.profiles.get(player.user.id).coins;
  const beforeCopies = Array.from(app.store.playerCards.get(player.user.id).values()).reduce((sum, count) => sum + count, 0);

  const result = app.services.packs.open(player.user.id, "starter_pack");
  const afterCopies = Array.from(app.store.playerCards.get(player.user.id).values()).reduce((sum, count) => sum + count, 0);

  assert.equal(result.opening.free, true);
  assert.equal(app.store.profiles.get(player.user.id).coins, beforeCoins);
  assert.equal(app.store.profiles.get(player.user.id).freePacks.starter_pack, 2);
  assert.equal(afterCopies, beforeCopies + result.cards.filter((card) => card.added).length);
});

test("duplicate conversion only happens after ten owned copies", () => {
  const app = createApp({ random: () => 0 });
  const player = register(app, "duplicates@example.com", "Duplicates");
  const targetCard = Array.from(app.store.cards.values()).find((card) => card.type !== "core" && card.rarity === "common");
  const owned = app.store.playerCards.get(player.user.id);
  owned.set(targetCard.id, 9);

  const ninth = app.services.collection.grantCard(targetCard.id, player.user.id, "test");
  const beyondLimit = app.services.collection.grantCard(targetCard.id, player.user.id, "test");

  assert.equal(ninth.added, true);
  assert.equal(ninth.duplicateCoins, 0);
  assert.equal(beyondLimit.added, false);
  assert.equal(beyondLimit.ownedCount, 10);
  assert.equal(beyondLimit.duplicateCoins > 0, true);
});

test("completed quests can be claimed once for coins", () => {
  const app = createApp();
  const player = register(app, "quest@example.com", "Quester");

  app.services.quests.recordProgress(player.user.id, "play_game", 1);
  const claimed = app.services.quests.claim(player.user.id, "daily_play_game");

  assert.equal(claimed.claimedAt !== null, true);
  assert.equal(app.store.profiles.get(player.user.id).coins, 1075);
  assert.throws(() => app.services.quests.claim(player.user.id, "daily_play_game"), /already claimed/);
});

test("new players can queue into a first online match with starter decks", () => {
  const app = createApp();
  const playerA = register(app, "first-a@example.com", "First Alpha");
  const playerB = register(app, "first-b@example.com", "First Bravo");

  const waiting = app.services.onlineMatches.joinQueue(playerA.user.id, "casual");
  assert.equal(waiting.queue.status, "searching");

  const matched = app.services.onlineMatches.joinQueue(playerB.user.id, "casual");
  assert.equal(matched.queue.status, "matched");
  assert.equal(matched.match.status, "active");
  assert.equal(matched.match.state.players.length, 2);
});

test("bug reports persist when a dev account is reset", () => {
  const app = createApp();
  const player = register(app, "debug@example.com", "Debugger");
  app.store.addCoinTransaction({ playerId: player.user.id, amount: -100, reason: "test_spend" });

  const report = app.store.addBugReport({
    reporterId: player.user.id,
    matchId: "local-test",
    message: "Button felt stuck."
  });
  assert.equal(report.message, "Button felt stuck.");

  app.store.resetDevAccount(player.user.id);
  const profile = app.services.profiles.get(player.user.id);
  const loadouts = app.services.loadouts.list(player.user.id);

  assert.equal(profile.coins, 1000);
  assert.equal(profile.freePacks.starter_pack, 3);
  assert.equal(loadouts.length, 1);
  assert.equal(loadouts.some((loadout) => loadout.name === "Beginner Starter" && loadout.isActive), true);
  assert.equal(app.store.bugReports.length, 1);
});
