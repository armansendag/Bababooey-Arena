"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { cardsById } = require("../src/data/cards");

test("core and mana-effect cards have specific player-facing text", () => {
  assert.equal(cardsById.get("core_starter").hp, 20);
  assert.ok(cardsById.get("core_starter").perks.includes("Core HP 20"));
  assert.match(cardsById.get("core_starter").rulesText, /Core starts with 20 HP/);
  assert.equal(cardsById.get("troop_mana_goblin").name, "Quandale Dingle");
  assert.ok(cardsById.get("troop_mana_slime").perks.some((perk) => perk.includes("+1 mana")));
  assert.match(cardsById.get("troop_mana_slime").rulesText, /When it dies: gain \+1 temporary mana/);
  assert.ok(cardsById.get("spell_emergency_funding").perks.some((perk) => perk.includes("+3 temporary mana") && perk.includes("5 damage")));
  assert.match(cardsById.get("spell_emergency_funding").rulesText, /\+3 temporary mana/);
  assert.match(cardsById.get("spell_emergency_funding").rulesText, /5 true damage/);
  assert.match(cardsById.get("enchant_arcane_shield").rulesText, /50% less damage/);
});
