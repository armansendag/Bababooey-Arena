"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  auditCard,
  auditCards,
  effectValue,
  generateReport,
  statScore,
  statusFor,
  targetPowerRange
} = require("../scripts/balanceAudit");
const { cards } = require("../src/data/cards");

test("balance audit stat score follows the requested formula", () => {
  assert.equal(statScore({ attack: 5, defense: 2, hp: 8 }), 14);
  assert.equal(statScore({ type: "core", hp: 20 }), 0);
});

test("balance audit target ranges match mana cost bands", () => {
  assert.deepEqual(targetPowerRange(1), { low: 10, high: 18 });
  assert.deepEqual(targetPowerRange(5), { low: 55, high: 70 });
  assert.deepEqual(targetPowerRange(10), { low: 160, high: 190 });
  assert.deepEqual(targetPowerRange(12), { low: 200, high: 230 });
});

test("balance audit status flags normal, broken, and useless cards", () => {
  assert.equal(statusFor(20, { low: 18, high: 28 }), "balanced");
  assert.equal(statusFor(35, { low: 18, high: 28 }), "overpowered");
  assert.equal(statusFor(45, { low: 18, high: 28 }), "especially broken");
  assert.equal(statusFor(12, { low: 18, high: 28 }), "underpowered");
  assert.equal(statusFor(9, { low: 18, high: 28 }), "useless");
});

test("balance audit effect value estimates major effect categories", () => {
  assert.equal(effectValue({ trigger: "spell", type: "damage", amount: 2 }) >= 5, true);
  assert.equal(effectValue({ trigger: "spell", type: "damage", target: "enemyCore", amount: 20 }), 90);
  assert.equal(effectValue({ trigger: "startTurn", type: "manaGain", amount: 2 }) >= 20, true);
  assert.equal(effectValue({ trigger: "spell", type: "spellCounter", amount: 1 }) >= 20, true);
  assert.equal(effectValue({ trigger: "spell", type: "destroyEnchantment", amount: 1 }) >= 10, true);
  assert.equal(effectValue({ trigger: "static", type: "coreDamageReduction", amount: 5 }) >= 30, true);
});

test("core cards use smaller identity scoring instead of playable-card stat scoring", () => {
  const coreAudit = auditCard({
    id: "core_test",
    name: "Core Test",
    type: "core",
    faction: "neutral",
    rarity: "common",
    manaCost: 0,
    cooldown: 0,
    hp: 20,
    effects: [{ trigger: "onAttack", type: "coreAttackBonus", faction: "beast", amount: 1 }]
  });

  assert.equal(coreAudit.statScore, 0);
  assert.deepEqual({ low: coreAudit.targetLow, high: coreAudit.targetHigh }, { low: 0, high: 12 });
  assert.equal(coreAudit.status, "balanced");
});

test("balance audit scans every card and emits recommendations", () => {
  const audits = auditCards();
  assert.equal(audits.length, cards.length);
  assert.equal(audits.every((item) => Number.isFinite(item.statScore) && Number.isFinite(item.effectScore)), true);
  assert.equal(audits.every((item) => Array.isArray(item.recommendations) && item.recommendations.length > 0), true);
  assert.ok(audits.some((item) => item.status !== "balanced"));
});

test("balance report contains required sections", () => {
  const report = generateReport([
    auditCard({
      id: "fake_big",
      name: "Fake Big",
      type: "troop",
      faction: "neutral",
      rarity: "common",
      manaCost: 1,
      cooldown: 1,
      attack: 50,
      defense: 0,
      hp: 1,
      effects: []
    }),
    auditCard({
      id: "fake_small",
      name: "Fake Small",
      type: "spell",
      faction: "neutral",
      rarity: "common",
      manaCost: 5,
      cooldown: 1,
      effects: []
    })
  ]);

  assert.match(report, /# Balance Audit/);
  assert.match(report, /Top 10 Overpowered/);
  assert.match(report, /Top 10 Underpowered/);
  assert.match(report, /Especially Broken Cards/);
  assert.match(report, /Useless Cards/);
  assert.match(report, /Packs Affected/);
  assert.match(report, /Full Audit Table/);
});
