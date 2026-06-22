"use strict";

const { MAX_OWNED_COPIES, duplicateCoinValue } = require("../domain/economy");

function serializeCollection(store, playerId) {
  const owned = store.playerCards.get(playerId) || new Map();
  return Array.from(store.cards.values()).map((card) => ({
    ...card,
    ownedCount: owned.get(card.id) || 0
  }));
}

function grantCard(store, playerId, cardId, source) {
  const card = store.cards.get(cardId);
  if (!card) throw new Error(`Unknown card ${cardId}.`);
  const owned = store.playerCards.get(playerId) || new Map();
  store.playerCards.set(playerId, owned);

  const current = owned.get(cardId) || 0;
  if (current >= MAX_OWNED_COPIES) {
    const coins = duplicateCoinValue(card.rarity);
    store.addCoinTransaction({
      playerId,
      amount: coins,
      reason: "duplicate_conversion",
      sourceId: source,
      metadata: { cardId, rarity: card.rarity }
    });
    return { card, added: false, duplicateCoins: coins, ownedCount: current };
  }

  owned.set(cardId, current + 1);
  return { card, added: true, duplicateCoins: 0, ownedCount: current + 1 };
}

function createCollectionService(store) {
  return {
    list(playerId) {
      return serializeCollection(store, playerId);
    },

    ownedMap(playerId) {
      return Object.fromEntries(store.playerCards.get(playerId) || new Map());
    },

    grantCard(cardId, playerId, source = "grant") {
      return grantCard(store, playerId, cardId, source);
    }
  };
}

module.exports = { createCollectionService, grantCard, serializeCollection };
