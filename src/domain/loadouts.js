"use strict";

const COPY_LIMITS = {
  standard: 3,
  limited: 2,
  unique: 1
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
      errors.push(`${card.name} is a core and cannot occupy one of the 20 loadout card slots.`);
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
  if (summary.total !== 20) errors.push("Loadout must contain exactly 20 cards.");

  return {
    valid: errors.length === 0,
    errors,
    summary,
    normalizedCards
  };
}

module.exports = { COPY_LIMITS, validateLoadout, summarizeCards };
