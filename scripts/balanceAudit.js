"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { cards } = require("../src/data/cards");
const { packs } = require("../src/data/packs");
const { STARTER_LOADOUTS } = require("../src/data/starterLoadouts");

const REPORT_PATH = path.join(__dirname, "..", "docs", "balance-audit.md");
const BALANCE_PATCH_NOTES = {
  nerfed: [
    "Big Snack Core: removed passive mana-bank cap bonus so the ramp core is identity only.",
    "No Fun Allowed Core: now scored as a core identity effect instead of a playable card body.",
    "Bonk Alarm Core: now scored as a core identity effect instead of a playable card body.",
    "Bababooey Core Deluxe: changed from repeatable spell mana to small spell-triggered Core pressure.",
    "Bark Mode Core: changed from permanent Beast attack buffs to small Beast Core-attack identity.",
    "Leaky Mana Faucet: increased cost/cooldown and lowered HP.",
    "Forbidden Coupon: changed from +6 temporary mana at 0 cost to +3 temporary mana at 2 cost with longer cooldown.",
    "Sell This Creature: increased cost/cooldown so troop destruction plus mana refund is not an early swing.",
    "Forever Battery: changed from +2 repeatable mana to +1 and reduced cost to make it slower but playable.",
    "Sit Down Button: reduced direct Core damage from 100 to 20 and increased cooldown."
  ],
  buffed: [
    "The Big Bababooey: reduced cost and improved finisher body with an on-play enemy-board hit.",
    "Big Tree Receipt: reduced cost, improved body, and added late-game mana drip.",
    "Final Nap Box: reduced cost, improved body, and added a death-trigger enemy-board hit.",
    "Photoshop Wizard: reduced cost, improved body, and adds a spell counter when played.",
    "Absolute Unit Event: reduced cost, improved body, and gained trample Core pressure.",
    "The Debt Collector: reduced cost, improved body, and gained trample Core pressure.",
    "Oops Button 9000: reduced cost, improved body, and gained on-play enemy-board damage.",
    "Forbidden Blender: reduced cost, improved body, and gained Core damage reduction while active."
  ],
  why: [
    "Cores are always active, so their audit score now excludes Core HP and uses a smaller identity-effect target.",
    "Repeatable mana was narrowed because banked mana makes even +1 per turn scale strongly over a match.",
    "High-cost finishers received cost/stat/effect buffs so saving mana has a visible payoff."
  ]
};

function round(value) {
  return Math.round(value * 10) / 10;
}

function targetPowerRange(manaCost) {
  const cost = Number(manaCost || 0);
  const ranges = {
    0: [0, 20],
    1: [10, 18],
    2: [18, 28],
    3: [28, 40],
    4: [40, 55],
    5: [55, 70],
    6: [70, 90],
    7: [90, 110],
    8: [110, 135],
    9: [135, 160],
    10: [160, 190]
  };
  if (cost <= 10) return { low: ranges[cost]?.[0] ?? 0, high: ranges[cost]?.[1] ?? 20 };
  return { low: 160 + ((cost - 10) * 20), high: 190 + ((cost - 10) * 20) };
}

function magnitudeValue(amount = 1, small = [5, 10], medium = [10, 20], large = [20, 35]) {
  if (amount <= 2) return small[0] + amount * 2;
  if (amount <= 6) return medium[0] + amount * 1.5;
  return Math.min(large[1], large[0] + amount);
}

function triggerMultiplier(effect) {
  if (effect.trigger === "startTurn") return 2.1;
  if (["static", "onPlayTroop", "onSpellCast"].includes(effect.trigger)) return 1.5;
  if (effect.trigger === "onAttack") return 1.25;
  return 1;
}

function effectValue(effect, context = {}) {
  const amount = Math.abs(Number(effect.amount ?? effect.attack ?? effect.defense ?? effect.hp ?? 1));
  let base;
  switch (effect.type) {
    case "damage":
    case "trueDamage":
    case "heal":
    case "healCore":
    case "damageAllTroops":
    case "damageAllEnemies":
    case "trampleCoreDamage":
    case "enchantmentDamageBonus":
      if (effect.target === "enemyCore" || effect.type === "trampleCoreDamage") {
        base = Math.min(120, Math.max(8, amount * 4.5));
      } else {
        base = magnitudeValue(amount);
      }
      if (effect.type === "trueDamage") base += 4;
      if (effect.type === "damageAllTroops" || effect.type === "damageAllEnemies") base += 8;
      break;
    case "trueDamageSelfCore":
      base = -Math.min(20, amount * 2);
      break;
    case "statBuff": {
      const statAmount = Math.abs(effect.attack || 0) + Math.abs(effect.defense || 0) + Math.abs(effect.hp || 0);
      base = magnitudeValue(statAmount || 1);
      if (["friendlyFaction", "allFriendly"].includes(effect.selector)) base += 7;
      break;
    }
    case "manaGain":
    case "manaGainForFaction":
    case "manaGainFromDestroyedCost":
    case "maxManaIncrease":
      base = 10 + Math.min(20, amount * 5);
      if (effect.type === "manaGainFromDestroyedCost") base = 18;
      if (effect.type === "maxManaIncrease") base += 6;
      break;
    case "cooldownIncrease":
    case "cooldownReduction":
      base = 10 + Math.min(15, amount * 5);
      break;
    case "spellCounter":
    case "spellReflection":
    case "spellCounterFirstEachTurn":
      base = effect.type === "spellCounterFirstEachTurn" ? 40 : 28;
      break;
    case "destroyEnchantment":
    case "destroyEnchantmentOnHit":
      base = effect.type === "destroyEnchantmentOnHit" ? 18 : 15;
      break;
    case "destroyTroop":
      base = 32;
      break;
    case "coreDamageReduction":
      base = 15 + Math.min(20, amount * 4);
      break;
    case "enchantmentDamageReduction":
    case "enchantmentDamageMultiplier":
      base = effect.type === "enchantmentDamageMultiplier" ? 25 : 12 + Math.min(13, amount * 4);
      break;
    case "lifesteal":
      base = 10 + Math.min(15, amount * 4);
      break;
    case "enemySpellCostIncrease":
    case "firstSpellDiscount":
      base = 18 + Math.min(12, amount * 4);
      break;
    case "coreAttackBonus":
      base = 16 + Math.min(12, amount * 4);
      break;
    default:
      base = 8;
      break;
  }
  const coreMultiplier = context.card?.type === "core" ? 0.45 : 1;
  return round(base * triggerMultiplier(effect) * coreMultiplier);
}

function statScore(card) {
  if (card.type === "core") return 0;
  return round(((card.attack || 0) * 1.4) + ((card.defense || 0) * 1.1) + ((card.hp || 0) * 0.6));
}

function effectScore(card) {
  return round((card.effects || []).reduce((sum, effect) => sum + effectValue(effect, { card }), 0));
}

function statusFor(total, range) {
  if (total > range.high * 1.4) return "especially broken";
  if (total < range.low * 0.6) return "useless";
  if (total > range.high) return "overpowered";
  if (total < range.low) return "underpowered";
  return "balanced";
}

function recommendationsFor(card, audit) {
  const recs = [];
  const highestStat = [
    ["attack", card.attack || 0],
    ["defense", card.defense || 0],
    ["HP", card.hp || 0]
  ].sort((a, b) => b[1] - a[1])[0];

  if (audit.status === "overpowered" || audit.status === "especially broken") {
    recs.push("increase mana cost");
    if (highestStat?.[1] > 0) recs.push(`lower ${highestStat[0]}`);
    if (audit.effectScore > audit.statScore) recs.push("reduce effect value");
    if (card.cooldown > 0) recs.push("increase cooldown");
  } else if (audit.status === "underpowered" || audit.status === "useless") {
    if (card.type === "troop") recs.push("increase attack or HP");
    if (card.type === "enchantment") recs.push("increase HP or effect value");
    if (card.type === "spell") recs.push("increase effect value");
    if (card.cooldown > 0) recs.push("lower cooldown");
    recs.push("lower mana cost if identity should stay weak");
  } else {
    recs.push("no immediate change");
  }
  return recs.slice(0, 4);
}

function affectedPacks(card) {
  return packs
    .filter((pack) => {
      if (!pack.includeCores && card.type === "core") return false;
      if (pack.types?.length && !pack.types.includes(card.type)) return false;
      return true;
    })
    .map((pack) => pack.name);
}

function affectedArchetypes(card) {
  return Object.entries(STARTER_LOADOUTS)
    .filter(([, loadout]) => loadout.coreCardId === card.id || Boolean(loadout.cards[card.id]))
    .map(([name]) => name);
}

function auditCard(card) {
  const stats = statScore(card);
  const effects = effectScore(card);
  const total = round(stats + effects);
  const range = card.type === "core" ? { low: 0, high: 12 } : targetPowerRange(card.manaCost);
  const audit = {
    id: card.id,
    name: card.name,
    type: card.type,
    faction: card.faction || "neutral",
    rarity: card.rarity,
    manaCost: card.manaCost,
    cooldown: card.cooldown,
    statScore: stats,
    effectScore: effects,
    totalScore: total,
    targetLow: range.low,
    targetHigh: range.high,
    status: statusFor(total, range),
    packs: affectedPacks(card),
    archetypes: affectedArchetypes(card)
  };
  audit.recommendations = recommendationsFor(card, audit);
  return audit;
}

function auditCards(cardList = cards) {
  return cardList.map(auditCard).sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name));
}

function imbalanceAmount(item) {
  if (item.totalScore > item.targetHigh) return round(item.totalScore - item.targetHigh);
  if (item.totalScore < item.targetLow) return round(item.targetLow - item.totalScore);
  return 0;
}

function markdownTable(rows) {
  const header = "| Card | Cost | Type | Faction | Rarity | Stats | Effects | Total | Target | Status | Recommendations |";
  const sep = "| --- | ---: | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |";
  const body = rows.map((item) => {
    return `| ${item.name} | ${item.manaCost} | ${item.type} | ${item.faction} | ${item.rarity} | ${item.statScore} | ${item.effectScore} | ${item.totalScore} | ${item.targetLow}-${item.targetHigh} | ${item.status} | ${item.recommendations.join("; ")} |`;
  });
  return [header, sep, ...body].join("\n");
}

function summarizeAffected(audits) {
  const flagged = audits.filter((item) => item.status !== "balanced");
  const packCounts = new Map();
  const archetypeCounts = new Map();
  for (const item of flagged) {
    for (const pack of item.packs) packCounts.set(pack, (packCounts.get(pack) || 0) + 1);
    for (const archetype of item.archetypes) archetypeCounts.set(archetype, (archetypeCounts.get(archetype) || 0) + 1);
  }
  const top = (map) => Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
  return { packs: top(packCounts), archetypes: top(archetypeCounts) };
}

function generateReport(audits = auditCards()) {
  const overpowered = audits
    .filter((item) => item.totalScore > item.targetHigh)
    .sort((a, b) => imbalanceAmount(b) - imbalanceAmount(a))
    .slice(0, 10);
  const underpowered = audits
    .filter((item) => item.totalScore < item.targetLow)
    .sort((a, b) => imbalanceAmount(b) - imbalanceAmount(a))
    .slice(0, 10);
  const broken = audits.filter((item) => item.status === "especially broken");
  const useless = audits.filter((item) => item.status === "useless");
  const affected = summarizeAffected(audits);
  const statusCounts = audits.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});

  return [
    "# Balance Audit",
    "",
    "Generated by `npm run balance:audit`.",
    "",
    "Power Score = `(Attack * 1.4) + (Defense * 1.1) + (HP * 0.6) + Effect Value`.",
    "",
    "Effect values are estimates. This audit is a triage tool, not an automatic balance patch.",
    "",
    "## Summary",
    "",
    `- Cards audited: ${audits.length}`,
    `- Balanced: ${statusCounts.balanced || 0}`,
    `- Underpowered: ${statusCounts.underpowered || 0}`,
    `- Overpowered: ${statusCounts.overpowered || 0}`,
    `- Especially broken: ${statusCounts["especially broken"] || 0}`,
    `- Useless: ${statusCounts.useless || 0}`,
    "",
    "## Top 10 Overpowered",
    "",
    overpowered.length ? markdownTable(overpowered) : "No overpowered cards found.",
    "",
    "## Top 10 Underpowered",
    "",
    underpowered.length ? markdownTable(underpowered) : "No underpowered cards found.",
    "",
    "## Phase Balance 2 Before/After",
    "",
    "### Cards Nerfed",
    "",
    BALANCE_PATCH_NOTES.nerfed.map((item) => `- ${item}`).join("\n"),
    "",
    "### Cards Buffed",
    "",
    BALANCE_PATCH_NOTES.buffed.map((item) => `- ${item}`).join("\n"),
    "",
    "### Why These Changes Were Made",
    "",
    BALANCE_PATCH_NOTES.why.map((item) => `- ${item}`).join("\n"),
    "",
    "### New Top 10 Overpowered",
    "",
    overpowered.length ? markdownTable(overpowered) : "No overpowered cards found.",
    "",
    "### New Top 10 Underpowered",
    "",
    underpowered.length ? markdownTable(underpowered) : "No underpowered cards found.",
    "",
    "## Especially Broken Cards",
    "",
    broken.length ? markdownTable(broken) : "No cards are more than 40% above their target range.",
    "",
    "## Useless Cards",
    "",
    useless.length ? markdownTable(useless) : "No cards are more than 40% below their target range.",
    "",
    "## Packs Affected",
    "",
    affected.packs.length ? affected.packs.map(([name, count]) => `- ${name}: ${count} flagged cards`).join("\n") : "- No packs contain flagged cards.",
    "",
    "## Starter Archetypes Affected",
    "",
    affected.archetypes.length ? affected.archetypes.map(([name, count]) => `- ${name}: ${count} flagged cards`).join("\n") : "- No starter archetypes contain flagged cards.",
    "",
    "## Full Audit Table",
    "",
    markdownTable(audits)
  ].join("\n");
}

function printConsoleTable(audits) {
  console.table(audits.map((item) => ({
    card: item.name,
    cost: item.manaCost,
    type: item.type,
    stats: item.statScore,
    effects: item.effectScore,
    total: item.totalScore,
    target: `${item.targetLow}-${item.targetHigh}`,
    status: item.status,
    recommendations: item.recommendations.join("; ")
  })));
}

function run() {
  const audits = auditCards();
  printConsoleTable(audits);
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${generateReport(audits)}\n`);
  console.log(`Balance audit written to ${path.relative(path.join(__dirname, ".."), REPORT_PATH)}`);
  return audits;
}

if (require.main === module) run();

module.exports = {
  auditCard,
  auditCards,
  effectValue,
  generateReport,
  recommendationsFor,
  run,
  statScore,
  statusFor,
  targetPowerRange
};
