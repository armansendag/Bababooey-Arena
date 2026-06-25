"use strict";

const COPY_LIMITS = {
  standard: 3,
  limited: 2,
  unique: 1
};

const DECK_RULES = {
  total: 12,
  troops: 8,
  spells: 2,
  enchantments: 2
};

function summarizeCards(cardQuantities, cardsById) {
  const summary = {
    total: 0,
    troops: 0,
    spells: 0,
    enchantments: 0,
    cores: 0
  };

  for (const [cardId, quantity] of Object.entries(cardQuantities)) {
    const card = cardsById.get(cardId);
    if (!card) continue;
    summary.total += quantity;
    if (card.type === "troop") summary.troops += quantity;
    if (card.type === "spell") summary.spells += quantity;
    if (card.type === "enchantment") summary.enchantments += quantity;
    if (card.type === "core") summary.cores += quantity;
  }

  return summary;
}

function validateLoadout({ cards, coreCardId, collection }, cardsById) {
  const errors = [];
  const normalizedCards = {};

  for (const [cardId, rawQuantity] of Object.entries(cards || {})) {
    const quantity = Number(rawQuantity);
    const card = cardsById.get(cardId);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      errors.push(`${cardId} quantity must be a positive integer.`);
      continue;
    }

    if (!card) {
      errors.push(`${cardId} is not a known card.`);
      continue;
    }

    if (card.type === "core") {
      errors.push(`${card.name} is a core and cannot occupy one of the ${DECK_RULES.total} loadout card slots.`);
      continue;
    }

    const copyLimit = COPY_LIMITS[card.copyTag];
    if (quantity > copyLimit) {
      errors.push(`${card.name} exceeds ${card.copyTag} copy limit of ${copyLimit}.`);
    }

    const owned = collection?.[cardId] || 0;
    if (owned < quantity) {
      errors.push(`${card.name} requires ${quantity} copies but player owns ${owned}.`);
    }

    normalizedCards[cardId] = quantity;
  }

  const core = cardsById.get(coreCardId);
  if (!core || core.type !== "core") {
    errors.push("A valid core card is required.");
  } else if ((collection?.[coreCardId] || 0) < 1) {
    errors.push(`Player does not own selected core ${core.name}.`);
  }

  const summary = summarizeCards(normalizedCards, cardsById);
  if (summary.total !== DECK_RULES.total) errors.push(`Loadout must contain exactly ${DECK_RULES.total} cards.`);
  if (summary.troops !== DECK_RULES.troops) errors.push(`Loadout must contain exactly ${DECK_RULES.troops} troops.`);
  if (summary.spells !== DECK_RULES.spells) errors.push(`Loadout must contain exactly ${DECK_RULES.spells} spells.`);
  if (summary.enchantments !== DECK_RULES.enchantments) errors.push(`Loadout must contain exactly ${DECK_RULES.enchantments} enchantments.`);

  return {
    valid: errors.length === 0,
    errors,
    summary,
    normalizedCards
  };
}

module.exports = { COPY_LIMITS, DECK_RULES, validateLoadout, summarizeCards };
