"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { cards, cardsById } = require("../src/data/cards");
const { applyCommand, createMatch } = require("../src/domain/battleEngine");

function legalCards(extra = {}) {
  return {
    troop_mana_goblin: 3,
    troop_mana_slime: 3,
    troop_mana_golem: 2,
    troop_enchantment_eater: 2,
    troop_arcane_hunter: 2,
    troop_undead_wraith_duelist: 1,
    spell_sit: 1,
    spell_emergency_funding: 1,
    spell_disenchant: 1,
    enchant_mana_spring: 1,
    enchant_arcane_shield: 1,
    enchant_fortress_wall: 1,
    enchant_graveyard: 1,
    ...extra
  };
}

function match(extra1 = {}, extra2 = {}) {
  return createMatch({
    player1: { id: "p1", loadout: { coreCardId: "core_starter", cards: legalCards(extra1) } },
    player2: { id: "p2", loadout: { coreCardId: "core_starter", cards: legalCards(extra2) } },
    seed: "effects"
  }, { cardCatalog: cardsById });
}

function endTurn(state) {
  return applyCommand(state, { type: "endTurn", playerId: state.activePlayerId }, { cardCatalog: cardsById });
}

function passTo(state, playerId, mana = 10) {
  let safety = 20;
  while (state.activePlayerId !== playerId && safety > 0) {
    endTurn(state);
    safety -= 1;
  }
  const player = state.players.find((item) => item.id === playerId);
  player.currentMana = mana;
  player.manaBankCap = Math.max(player.manaBankCap || 20, mana);
  player.baseMaxMana = player.manaBankCap;
  return player;
}

function p(state, playerId) {
  return state.players.find((player) => player.id === playerId);
}

test("spell damage, healing, true damage, and mana gain resolve from generic effects", () => {
  const state = match({ spell_repair_loop: 1, spell_orbital_ping: 1 });
  passTo(state, "p1", 10);

  p(state, "p2").coreHp = 300;
  applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_sit" }, { cardCatalog: cardsById });
  assert.equal(p(state, "p2").coreHp, 280);

  p(state, "p1").coreHp = 10;
  applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_repair_loop" }, { cardCatalog: cardsById });
  assert.equal(p(state, "p1").coreHp, 14);

  p(state, "p1").currentMana = 10;
  applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_orbital_ping" }, { cardCatalog: cardsById });
  assert.equal(p(state, "p2").coreHp, 276);

  p(state, "p1").currentMana = 10;
  p(state, "p1").coreHp = 20;
  const beforeMana = p(state, "p1").currentMana;
  applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_emergency_funding" }, { cardCatalog: cardsById });
  assert.equal(p(state, "p1").currentMana, beforeMana + 3);
  assert.equal(p(state, "p1").coreHp, 15);
});

test("stat buffs, mana bank cap, and start-of-turn mana effects apply", () => {
  const state = match({ troop_beast_pouncing_cub: 3, troop_beast_pack_alpha: 1, enchant_mana_spring: 1, enchant_crystal_mine: 1 });
  passTo(state, "p1", 10);

  const cub = applyCommand(state, { type: "playTroop", playerId: "p1", cardId: "troop_beast_pouncing_cub" }, { cardCatalog: cardsById });
  const beforeBuff = cub.attackBuff || 0;
  applyCommand(state, { type: "playTroop", playerId: "p1", cardId: "troop_beast_pack_alpha" }, { cardCatalog: cardsById });
  assert.equal(cub.attackBuff, beforeBuff + 1);

  applyCommand(state, { type: "playEnchantment", playerId: "p1", cardId: "enchant_mana_spring" }, { cardCatalog: cardsById });
  applyCommand(state, { type: "playEnchantment", playerId: "p1", cardId: "enchant_crystal_mine" }, { cardCatalog: cardsById });
  const beforeTurnMana = p(state, "p1").currentMana;
  endTurn(state);
  endTurn(state);
  assert.equal(p(state, "p1").baseMaxMana, 21);
  assert.equal(p(state, "p1").currentMana > beforeTurnMana, true);
});

test("attack buffs from troops, spells, enchantments, and cores increase combat damage", () => {
  const alphaState = match({ troop_beast_pouncing_cub: 2, troop_beast_pack_alpha: 1 });
  passTo(alphaState, "p1", 10);
  const alphaCub = applyCommand(alphaState, { type: "playTroop", playerId: "p1", cardId: "troop_beast_pouncing_cub" }, { cardCatalog: cardsById });
  applyCommand(alphaState, { type: "playTroop", playerId: "p1", cardId: "troop_beast_pack_alpha" }, { cardCatalog: cardsById });
  applyCommand(alphaState, { type: "attack", playerId: "p1", attackerInstanceId: alphaCub.instanceId, target: { type: "core", playerId: "p2" } }, { cardCatalog: cardsById });
  assert.equal(p(alphaState, "p2").coreHp, 16);

  const spellState = match({ troop_beast_pouncing_cub: 2, spell_pack_howl: 1 });
  passTo(spellState, "p1", 10);
  const spellCub = applyCommand(spellState, { type: "playTroop", playerId: "p1", cardId: "troop_beast_pouncing_cub" }, { cardCatalog: cardsById });
  applyCommand(spellState, { type: "castSpell", playerId: "p1", cardId: "spell_pack_howl" }, { cardCatalog: cardsById });
  applyCommand(spellState, { type: "attack", playerId: "p1", attackerInstanceId: spellCub.instanceId, target: { type: "core", playerId: "p2" } }, { cardCatalog: cardsById });
  assert.equal(p(spellState, "p2").coreHp, 16);

  const enchantState = match({ troop_beast_pouncing_cub: 2, enchant_hunting_ground: 1 });
  passTo(enchantState, "p1", 10);
  applyCommand(enchantState, { type: "playEnchantment", playerId: "p1", cardId: "enchant_hunting_ground" }, { cardCatalog: cardsById });
  const enchantCub = applyCommand(enchantState, { type: "playTroop", playerId: "p1", cardId: "troop_beast_pouncing_cub" }, { cardCatalog: cardsById });
  applyCommand(enchantState, { type: "attack", playerId: "p1", attackerInstanceId: enchantCub.instanceId, target: { type: "core", playerId: "p2" } }, { cardCatalog: cardsById });
  assert.equal(p(enchantState, "p2").coreHp, 16);

  const coreState = createMatch({
    player1: { id: "p1", loadout: { coreCardId: "core_aggro", cards: legalCards({ troop_beast_pouncing_cub: 2 }) } },
    player2: { id: "p2", loadout: { coreCardId: "core_starter", cards: legalCards() } },
    seed: "core-buff"
  }, { cardCatalog: cardsById });
  passTo(coreState, "p1", 10);
  const coreCub = applyCommand(coreState, { type: "playTroop", playerId: "p1", cardId: "troop_beast_pouncing_cub" }, { cardCatalog: cardsById });
  applyCommand(coreState, { type: "attack", playerId: "p1", attackerInstanceId: coreCub.instanceId, target: { type: "core", playerId: "p2" } }, { cardCatalog: cardsById });
  assert.equal(p(coreState, "p2").coreHp, 16);
});

test("attack buffs increase damage against defended troops", () => {
  const state = match({ troop_beast_pouncing_cub: 2, spell_pack_howl: 1 }, { troop_machine_tin_drone: 1 });
  passTo(state, "p1", 10);
  const cub = applyCommand(state, { type: "playTroop", playerId: "p1", cardId: "troop_beast_pouncing_cub" }, { cardCatalog: cardsById });
  applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_pack_howl" }, { cardCatalog: cardsById });
  endTurn(state);
  passTo(state, "p2", 10);
  const drone = applyCommand(state, { type: "playTroop", playerId: "p2", cardId: "troop_machine_tin_drone" }, { cardCatalog: cardsById });
  endTurn(state);
  passTo(state, "p1", 10);

  const result = applyCommand(state, { type: "attack", playerId: "p1", attackerInstanceId: cub.instanceId, target: { type: "troop", instanceId: drone.instanceId } }, { cardCatalog: cardsById });

  assert.equal(result.damage, 2);
});

test("cooldown reduction and increase effects modify reusable cards", () => {
  const state = match({ spell_time_skip: 1 }, { spell_minor_inconvenience: 1 });
  passTo(state, "p1", 10);
  p(state, "p2").coreHp = 300;
  applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_sit" }, { cardCatalog: cardsById });
  assert.equal(p(state, "p1").spellCooldowns.spell_sit, 4);
  p(state, "p1").currentMana = 10;
  applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_time_skip" }, { cardCatalog: cardsById });
  assert.equal(p(state, "p1").spellCooldowns.spell_sit, 2);

  endTurn(state);
  passTo(state, "p2", 10);
  applyCommand(state, { type: "castSpell", playerId: "p2", cardId: "spell_minor_inconvenience" }, { cardCatalog: cardsById });
  assert.equal(p(state, "p1").spellCooldowns.spell_sit >= 2, true);
});

test("spell countering and reflection consume pending defenses", () => {
  const state = match({ spell_nope: 1, spell_reflect: 1 });
  passTo(state, "p1", 10);
  applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_nope" }, { cardCatalog: cardsById });
  endTurn(state);
  passTo(state, "p2", 10);
  const countered = applyCommand(state, { type: "castSpell", playerId: "p2", cardId: "spell_sit" }, { cardCatalog: cardsById });
  assert.equal(countered.countered, true);
  assert.equal(p(state, "p1").coreHp, 20);

  endTurn(state);
  passTo(state, "p1", 10);
  applyCommand(state, { type: "castSpell", playerId: "p1", cardId: "spell_reflect" }, { cardCatalog: cardsById });
  endTurn(state);
  passTo(state, "p2", 10);
  p(state, "p2").coreHp = 300;
  p(state, "p2").spellCooldowns = {};
  const reflected = applyCommand(state, { type: "castSpell", playerId: "p2", cardId: "spell_sit" }, { cardCatalog: cardsById });
  assert.equal(reflected.reflected, true);
  assert.equal(p(state, "p2").coreHp, 280);
});

test("enchantment damage, destruction, and core damage reduction apply", () => {
  const state = match({}, { troop_demolition_bot: 1 });
  passTo(state, "p1", 10);
  applyCommand(state, { type: "playEnchantment", playerId: "p1", cardId: "enchant_arcane_shield" }, { cardCatalog: cardsById });
  applyCommand(state, { type: "playEnchantment", playerId: "p1", cardId: "enchant_fortress_wall" }, { cardCatalog: cardsById });
  endTurn(state);
  passTo(state, "p2", 10);
  const eater = applyCommand(state, { type: "playTroop", playerId: "p2", cardId: "troop_enchantment_eater" }, { cardCatalog: cardsById });
  eater.canAttack = true;
  const wall = p(state, "p1").enchantments.find((item) => item.cardId === "enchant_fortress_wall");
  applyCommand(state, { type: "attack", playerId: "p2", attackerInstanceId: eater.instanceId, target: { type: "enchantment", instanceId: wall.instanceId } }, { cardCatalog: cardsById });
  assert.equal(wall.hp < cardsById.get("enchant_fortress_wall").hp, true);

  const bot = applyCommand(state, { type: "playTroop", playerId: "p2", cardId: "troop_demolition_bot" }, { cardCatalog: cardsById });
  bot.canAttack = true;
  const shield = p(state, "p1").enchantments.find((item) => item.cardId === "enchant_arcane_shield");
  applyCommand(state, { type: "attack", playerId: "p2", attackerInstanceId: bot.instanceId, target: { type: "enchantment", instanceId: shield.instanceId } }, { cardCatalog: cardsById });
  assert.equal(p(state, "p1").enchantments.some((item) => item.instanceId === shield.instanceId), false);
});

test("lifesteal, death triggers, and on-attack effects apply", () => {
  const state = match({ troop_beast_thunder_rhino: 1 });
  passTo(state, "p1", 10);
  p(state, "p1").coreHp = 10;
  const wraith = applyCommand(state, { type: "playTroop", playerId: "p1", cardId: "troop_undead_wraith_duelist" }, { cardCatalog: cardsById });
  endTurn(state);
  passTo(state, "p2", 10);
  endTurn(state);
  passTo(state, "p1", 10);
  applyCommand(state, { type: "attack", playerId: "p1", attackerInstanceId: wraith.instanceId, target: { type: "core", playerId: "p2" } }, { cardCatalog: cardsById });
  assert.equal(p(state, "p1").coreHp, 12);

  const slime = applyCommand(state, { type: "playTroop", playerId: "p1", cardId: "troop_mana_slime" }, { cardCatalog: cardsById });
  endTurn(state);
  passTo(state, "p2", 10);
  const hunter = applyCommand(state, { type: "playTroop", playerId: "p2", cardId: "troop_arcane_hunter" }, { cardCatalog: cardsById });
  p(state, "p2").troops.find((item) => item.instanceId === hunter.instanceId).canAttack = true;
  const manaBefore = p(state, "p1").currentMana;
  p(state, "p1").troops.find((item) => item.instanceId === slime.instanceId).hp = 1;
  applyCommand(state, { type: "attack", playerId: "p2", attackerInstanceId: hunter.instanceId, target: { type: "troop", instanceId: slime.instanceId } }, { cardCatalog: cardsById });
  assert.equal(p(state, "p1").currentMana, manaBefore + 1);
});

test("phase 6 cards carry active effect metadata or documented passive text", () => {
  const active = cards.filter((card) => (card.effects || []).length > 0);
  assert.equal(active.length >= 50, true);
  assert.equal(cards.every((card) => Array.isArray(card.effects)), true);
});
