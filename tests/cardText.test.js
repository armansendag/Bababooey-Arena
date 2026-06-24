"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { cardsById } = require("../src/data/cards");

test("core and mana-effect cards have specific player-facing text", () => {
  assert.equal(cardsById.get("core_starter").hp, 20);
  assert.ok(cardsById.get("core_starter").perks.includes("Core HP 20"));
  assert.ok(cardsById.get("troop_mana_slime").perks.some((perk) => perk.includes("+1 mana")));
  assert.ok(cardsById.get("spell_emergency_funding").perks.some((perk) => perk.includes("+3 temporary mana") && perk.includes("5 damage")));
});
