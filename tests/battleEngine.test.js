"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { cards } = require("../src/data/cards");
const { BattleRuleError, calculateDamage, createMatch, applyCommand } = require("../src/domain/battleEngine");
const { createLocalMatch } = require("../src/domain/localMatchHarness");

function testCatalog() {
  return new Map(
    [
      ...cards,
      {
        id: "troop_haste_striker",
        name: "Haste Striker",
        type: "troop",
        rarity: "common",
        faction: "test",
        manaCost: 1,
        cooldown: 2,
        copyTag: "standard",
        attack: 6,
        defense: 2,
        hp: 10,
        perks: ["Haste"]
      },
      {
        id: "troop_slow_guard",
        name: "Slow Guard",
        type: "troop",
        rarity: "common",
        faction: "test",
        manaCost: 1,
        cooldown: 2,
        copyTag: "standard",
        attack: 3,
        defense: 5,
        hp: 10,
        perks: []
      },
      {
        id: "troop_finisher",
        name: "Finisher",
        type: "troop",
        rarity: "common",
        faction: "test",
        manaCost: 1,
        cooldown: 1,
        copyTag: "unique",
        attack: 300,
        defense: 0,
        hp: 1,
        perks: ["Haste"]
      },
      {
        id: "enchant_fragile",
        name: "Fragile Enchantment",
        type: "enchantment",
        rarity: "common",
        faction: "test",
        manaCost: 1,
        cooldown: 2,
        copyTag: "standard",
        hp: 3,
        perks: []
      }
    ].map((card) => [card.id, card])
  );
}

function loadout(overrides = {}) {
  return {
    coreCardId: "core_starter",
    cards: {
      troop_haste_striker: 3,
      troop_slow_guard: 3,
      troop_finisher: 1,
      spell_emergency_funding: 1,
      spell_disenchant: 1,
      enchant_fragile: 3,
      enchant_arcane_shield: 1,
      ...overrides
    }
  };
}

function match() {
  return createMatch(
    {
      player1: { id: "p1", loadout: loadout() },
      player2: { id: "p2", loadout: loadout() },
      seed: "battle_test"
    },
    { cardCatalog: testCatalog() }
  );
}

function endTurn(state, playerId) {
  return applyCommand(state, { type: "endTurn", playerId }, { cardCatalog: testCatalog() });
}

test("match starts with player 1 at 1 mana and player 2 holding one Coin", () => {
  const state = match();

  assert.equal(state.status, "active");
  assert.equal(state.activePlayerId, "p1");
  assert.equal(state.turnNumber, 1);
  assert.equal(state.players[0].coreHp, 50);
  assert.equal(state.players[0].baseMaxMana, 1);
  assert.equal(state.players[0].currentMana, 1);
  assert.equal(state.players[1].baseMaxMana, 0);
  assert.equal(state.players[1].coinAvailable, true);
  assert.equal(state.eventLog[0].type, "turn_started");
});

test("turn system increases owner max mana to ten and refills at start of turn", () => {
  const state = match();

  for (let i = 0; i < 24; i += 1) {
    endTurn(state, state.activePlayerId);
  }

  for (const player of state.players) {
    assert.equal(player.baseMaxMana, 10);
    assert.equal(player.currentMana, 10);
  }
});

test("Coin gives player 2 one temporary mana that disappears at end of turn", () => {
  const state = match();
  endTurn(state, "p1");

  const p2 = state.players[1];
  assert.equal(p2.currentMana, 1);

  applyCommand(state, { type: "castSpell", playerId: "p2", cardId: "spell_coin" }, { cardCatalog: testCatalog() });
  assert.equal(p2.currentMana, 2);
  assert.equal(p2.temporaryMana, 1);
  assert.equal(p2.coinAvailable, false);

  applyCommand(state, { type: "playTroop", playerId: "p2", cardId: "troop_haste_striker" }, { cardCatalog: testCatalog() });
  assert.equal(p2.currentMana, 1);
  endTurn(state, "p2");
  assert.equal(p2.temporaryMana, 0);
});

test("troops cannot attack when summoned unless they have Haste", () => {
  const state = match();
  const slow = applyCommand(state, { type: "playTroop", playerId: "p1", cardId: "troop_slow_guard" }, { cardCatalog: testCatalog() });

  assert.throws(
    () => applyCommand(state, { type: "attack", playerId: "p1", attackerInstanceId: slow.instanceId, target: { type: "core", playerId: "p2" } }, { cardCatalog: testCatalog() }),
    BattleRuleError
  );

  endTurn(state, "p1");
  endTurn(state, "p2");
  const result = applyCommand(
    state,
    { type: "attack", playerId: "p1", attackerInstanceId: slow.instanceId, target: { type: "core", playerId: "p2" } },
    { cardCatalog: testCatalog() }
  );
  assert.equal(result.damage, 3);
  assert.equal(state.players[1].coreHp, 47);
});

test("enemy troops protect the core from troop attacks", () => {
  const state = match();
  const attacker = applyCommand(state, { type: "playTroop", playerId: "p1", cardId: "troop_haste_striker" }, { cardCatalog: testCatalog() });
  endTurn(state, "p1");
  applyCommand(state, { type: "playTroop", playerId: "p2", cardId: "troop_slow_guard" }, { cardCatalog: testCatalog() });
  endTurn(state, "p2");

  assert.throws(
    () => applyCommand(state, { type: "attack", playerId: "p1", attackerInstanceId: attacker.instanceId, target: { type: "core", playerId: "p2" } }, { cardCatalog: testCatalog() }),
    /protecting the core/
  );
});

test("playing a troop briefly cools matching ready copies", () => {
  const state = match();
  applyCommand(state, { type: "playTroop", playerId: "p1", cardId: "troop_slow_guard" }, { cardCatalog: testCatalog() });
  const p1 = state.players[0];
  const matchingCopies = p1.roster.filter((entry) => entry.cardId === "troop_slow_guard");

  assert.equal(matchingCopies.filter((entry) => entry.zone === "battlefield").length, 1);
  assert.equal(matchingCopies.filter((entry) => entry.zone === "cooldown" && entry.cooldownRemaining === 1).length, 2);

  endTurn(state, "p1");
  endTurn(state, "p2");
  assert.equal(matchingCopies.filter((entry) => entry.zone === "ready").length, 2);
});

test("damage formula uses current defense, minimum one damage, and HP persists", () => {
  assert.equal(calculateDamage(3, 5), 1);
  assert.equal(calculateDamage(6, 2), 4);

  const state = match();
  const attacker = applyCommand(state, { type: "playTroop", playerId: "p1", cardId: "troop_haste_striker" }, { cardCatalog: testCatalog() });
  endTurn(state, "p1");
  const defender = applyCommand(state, { type: "playTroop", playerId: "p2", cardId: "troop_slow_guard" }, { cardCatalog: testCatalog() });
  endTurn(state, "p2");

  const hit = applyCommand(
    state,
    { type: "attack", playerId: "p1", attackerInstanceId: attacker.instanceId, target: { type: "troop", instanceId: defender.instanceId } },
    { cardCatalog: testCatalog() }
  );

  assert.equal(hit.damage, 1);
  assert.equal(hit.absorbed, 5);
  assert.equal(state.players[1].troops[0].hp, 9);
  assert.equal(state.players[1].troops[0].currentDefense, 0);

  endTurn(state, "p1");
  assert.equal(state.players[1].troops[0].hp, 9);
  assert.equal(state.players[1].troops[0].currentDefense, 5);
});

test("defeated troops enter cooldown and respawn to the roster, not the battlefield", () => {
  const state = match();
  const attacker = applyCommand(state, { type: "playTroop", playerId: "p1", cardId: "troop_haste_striker" }, { cardCatalog: testCatalog() });
  endTurn(state, "p1");
  const defender = applyCommand(state, { type: "playTroop", playerId: "p2", cardId: "troop_finisher" }, { cardCatalog: testCatalog() });
  endTurn(state, "p2");

  applyCommand(
    state,
    { type: "attack", playerId: "p1", attackerInstanceId: attacker.instanceId, target: { type: "troop", instanceId: defender.instanceId } },
    { cardCatalog: testCatalog() }
  );

  const p2 = state.players[1];
  assert.equal(p2.troops.length, 0);
  let finisherRoster = p2.roster.find((entry) => entry.cardId === "troop_finisher");
  assert.equal(finisherRoster.zone, "cooldown");
  assert.equal(finisherRoster.cooldownRemaining, 1);

  endTurn(state, "p1");
  finisherRoster = p2.roster.find((entry) => entry.cardId === "troop_finisher");
  assert.equal(finisherRoster.zone, "ready");
  assert.equal(p2.troops.length, 0);
});

test("spells are reusable and cooldowns tick down at the owner's turn start", () => {
  const state = match();

  applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_emergency_funding" }, { cardCatalog: testCatalog() });
  const p1 = state.players[0];
  assert.equal(p1.spellCooldowns.spell_emergency_funding, 2);
  assert.equal(p1.coreHp, 25);

  assert.throws(
    () => applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_emergency_funding" }, { cardCatalog: testCatalog() }),
    /cooldown/
  );

  endTurn(state, "p1");
  assert.equal(p1.spellCooldowns.spell_emergency_funding, 2);
  endTurn(state, "p2");
  assert.equal(p1.spellCooldowns.spell_emergency_funding, 1);
  endTurn(state, "p1");
  endTurn(state, "p2");
  assert.equal(p1.spellCooldowns.spell_emergency_funding, undefined);
});

test("enchantments enforce active limits, duplicate active rules, HP destruction, and cooldown", () => {
  const state = match();
  applyCommand(state, { type: "playEnchantment", playerId: "p1", cardId: "enchant_fragile" }, { cardCatalog: testCatalog() });
  assert.throws(
    () => applyCommand(state, { type: "playEnchantment", playerId: "p1", cardId: "enchant_fragile" }, { cardCatalog: testCatalog() }),
    /already active/
  );

  endTurn(state, "p1");
  const attacker = applyCommand(state, { type: "playTroop", playerId: "p2", cardId: "troop_haste_striker" }, { cardCatalog: testCatalog() });
  const enchantment = state.players[0].enchantments[0];
  applyCommand(
    state,
    { type: "attack", playerId: "p2", attackerInstanceId: attacker.instanceId, target: { type: "enchantment", instanceId: enchantment.instanceId } },
    { cardCatalog: testCatalog() }
  );

  const p1 = state.players[0];
  assert.equal(p1.enchantments.length, 0);
  const rosterEntry = p1.roster.find((entry) => entry.cardId === "enchant_fragile");
  assert.equal(rosterEntry.zone, "cooldown");
  assert.equal(rosterEntry.cooldownRemaining, 2);
});

test("Arcane Shield reduces enchantment attack damage by fifty percent", () => {
  const state = match();
  state.players[0].currentMana = 10;
  applyCommand(state, { type: "playEnchantment", playerId: "p1", cardId: "enchant_arcane_shield" }, { cardCatalog: testCatalog() });
  applyCommand(state, { type: "playEnchantment", playerId: "p1", cardId: "enchant_fragile" }, { cardCatalog: testCatalog() });
  endTurn(state, "p1");

  const attacker = applyCommand(state, { type: "playTroop", playerId: "p2", cardId: "troop_haste_striker" }, { cardCatalog: testCatalog() });
  const fragile = state.players[0].enchantments.find((item) => item.cardId === "enchant_fragile");
  const result = applyCommand(
    state,
    { type: "attack", playerId: "p2", attackerInstanceId: attacker.instanceId, target: { type: "enchantment", instanceId: fragile.instanceId } },
    { cardCatalog: testCatalog() }
  );

  assert.equal(result.damage, 3);
  assert.equal(state.players[0].enchantments.some((item) => item.instanceId === fragile.instanceId), false);
});

test("local harness can run a complete validated match to a winner", () => {
  const harness = createLocalMatch(
    {
      player1: { id: "p1", loadout: loadout({ troop_finisher: 1 }) },
      player2: { id: "p2", loadout: loadout() },
      seed: "finish"
    },
    { cardCatalog: testCatalog() }
  );

  const finisher = harness.command({ type: "playTroop", playerId: "p1", cardId: "troop_finisher" });
  harness.command({ type: "attack", playerId: "p1", attackerInstanceId: finisher.instanceId, target: { type: "core", playerId: "p2" } });

  assert.equal(harness.state.status, "finished");
  assert.equal(harness.state.winnerId, "p1");
  assert.equal(harness.state.eventLog.at(-1).type, "match_finished");
});
