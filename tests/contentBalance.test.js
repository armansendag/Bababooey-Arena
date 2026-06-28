"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { cards, cardsById } = require("../src/data/cards");
const { packs } = require("../src/data/packs");
const { STARTER_LOADOUTS } = require("../src/data/starterLoadouts");
const { createMatch, applyCommand } = require("../src/domain/battleEngine");
const { validateLoadout } = require("../src/domain/loadouts");

function collectionFor(loadout) {
  return Object.fromEntries([[loadout.coreCardId, 1], ...Object.entries(loadout.cards)]);
}

function playableEntries(player, loadout) {
  return player.roster
    .filter((entry) => entry.zone === "ready")
    .map((entry) => cardsById.get(entry.cardId))
    .filter((card) => card && card.type !== "spell" && card.manaCost <= player.currentMana && loadout.cards[card.id]);
}

test("phase 6 catalog has the requested card counts", () => {
  assert.equal(cards.filter((card) => card.type === "troop").length, 80);
  assert.equal(cards.filter((card) => card.type === "spell").length, 25);
  assert.equal(cards.filter((card) => card.type === "enchantment").length, 20);
  assert.equal(cards.filter((card) => card.type === "core").length, 8);
});

test("all starter archetype loadouts are legal and playable early", () => {
  for (const [archetype, loadout] of Object.entries(STARTER_LOADOUTS)) {
    const result = validateLoadout({
      coreCardId: loadout.coreCardId,
      cards: loadout.cards,
      collection: collectionFor(loadout)
    }, cardsById);

    assert.equal(result.valid, true, `${archetype} starter should validate: ${result.errors.join(", ")}`);
    const costs = Object.keys(loadout.cards).map((cardId) => cardsById.get(cardId).manaCost);
    assert.equal(Math.min(...costs) <= 1, true, `${archetype} starter should have a turn-one play`);
  }
});

test("starter mirrors do not instantly win or brick in opening turns", () => {
  for (const [archetype, loadout] of Object.entries(STARTER_LOADOUTS)) {
    const state = createMatch({
      player1: { id: `${archetype}_p1`, loadout },
      player2: { id: `${archetype}_p2`, loadout },
      seed: archetype
    }, { cardCatalog: cardsById });

    let madePlay = 0;
    for (let turn = 0; turn < 6; turn += 1) {
      const player = state.players.find((item) => item.id === state.activePlayerId);
      const playable = playableEntries(player, loadout);
      assert.equal(playable.length > 0, true, `${archetype} starter bricked on turn ${state.turnNumber}`);

      const card = playable.sort((a, b) => a.manaCost - b.manaCost || a.name.localeCompare(b.name))[0];
      if (card.type === "troop") applyCommand(state, { type: "playTroop", playerId: player.id, cardId: card.id }, { cardCatalog: cardsById });
      else if (card.type === "enchantment") applyCommand(state, { type: "playEnchantment", playerId: player.id, cardId: card.id }, { cardCatalog: cardsById });
      madePlay += 1;

      assert.equal(state.status, "active", `${archetype} starter should not instantly win`);
      applyCommand(state, { type: "endTurn", playerId: player.id }, { cardCatalog: cardsById });
    }

    assert.equal(madePlay, 6);
  }
});

const RARITY_VALUE = {
  common: 1,
  uncommon: 2,
  rare: 5,
  epic: 14,
  legendary: 45,
  mythic: 120,
  bababooey: 300
};

function weightedRarityValue(dropTable) {
  const total = dropTable.reduce((sum, entry) => sum + entry.weight, 0);
  return dropTable.reduce((sum, entry) => sum + (RARITY_VALUE[entry.rarity] || 0) * (entry.weight / total), 0);
}

function guaranteedSlotValue(pack, slot) {
  if (slot.rarity) return RARITY_VALUE[slot.rarity] || 0;
  return weightedRarityValue(pack.dropTable);
}

function expectedPackValue(pack) {
  let value = 0;
  for (let index = 0; index < pack.cardsPerPack; index += 1) {
    const guaranteed = (pack.guaranteedSlots || [])[index];
    value += guaranteed ? guaranteedSlotValue(pack, guaranteed) : weightedRarityValue(pack.dropTable);
  }
  return value;
}

test("pack economy keeps premium packs more rewarding than chaos by expected rarity value", () => {
  const byId = Object.fromEntries(packs.map((pack) => [pack.id, pack]));
  const expected = Object.fromEntries(packs.map((pack) => [pack.id, expectedPackValue(pack)]));

  assert.equal(byId.chaos_pack.cardsPerPack, 6);
  assert.equal(byId.chaos_pack.price < byId.epic_pack.price, true);
  assert.equal(expected.epic_pack > expected.chaos_pack, true);
  assert.equal(expected.mythic_pack > expected.epic_pack, true);
  assert.equal(expected.rare_pack > expected.basic_pack, true);
  assert.deepEqual(byId.starter_pack.dropTable.map((entry) => entry.rarity), ["common", "uncommon", "rare"]);
});

test("phase balance 2 targeted outliers are tuned without changing core rules", () => {
  const byId = Object.fromEntries(cards.map((card) => [card.id, card]));

  assert.equal(byId.core_ramp.effects.length, 0);
  assert.deepEqual(byId.core_beast.effects, [{ trigger: "onAttack", type: "coreAttackBonus", faction: "beast", amount: 1 }]);
  assert.equal(byId.core_memeborn.effects[0].type, "damage");
  assert.equal(byId.core_memeborn.effects[0].amount, 1);

  assert.equal(byId.troop_mana_goblin.effects[0].trigger, "death");
  assert.equal(byId.troop_mana_goblin.attack <= 1, true);
  assert.equal(byId.spell_mana_conversion.manaCost, 4);
  assert.equal(byId.spell_forbidden_coupon.manaCost, 2);
  assert.equal(byId.spell_forbidden_coupon.effects[0].amount, 3);
  assert.equal(byId.enchant_infinite_generator.manaCost, 4);
  assert.equal(byId.enchant_infinite_generator.effects[0].amount, 1);

  for (const cardId of [
    "troop_memeborn_the_big_bababooey",
    "troop_mana_worldroot_avatar",
    "troop_undead_the_last_coffin",
    "troop_arcane_reality_editor",
    "troop_beast_primal_calamity",
    "troop_neutral_worldbreaker",
    "troop_tech_doomsday_prototype",
    "troop_machine_singularity_engine"
  ]) {
    assert.equal(byId[cardId].manaCost, 6, `${cardId} should be moved into reachable finisher range`);
    assert.equal(byId[cardId].attack + byId[cardId].defense + byId[cardId].hp >= 45, true, `${cardId} should have finisher stats`);
    assert.equal(byId[cardId].effects.length > 0, true, `${cardId} should have a payoff effect`);
  }
  assert.equal(byId.spell_sit.effects[0].amount, 20);
  assert.equal(byId.spell_sit.cooldown, 4);
});
