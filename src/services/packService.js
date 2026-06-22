"use strict";

const { makeId, nowIso } = require("../store/memoryStore");

function weightedPick(items, random = Math.random) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function createPackService(store, collectionService, questService, random = Math.random) {
  function list() {
    return Array.from(store.packs.values());
  }

  function open(playerId, packId) {
    const pack = store.packs.get(packId);
    if (!pack) throw Object.assign(new Error("Pack not found."), { status: 404 });
    const profile = store.profiles.get(playerId);
    if (profile.coins < pack.price) throw Object.assign(new Error("Insufficient coins."), { status: 400 });

    store.addCoinTransaction({ playerId, amount: -pack.price, reason: "pack_purchase", sourceId: pack.id });

    const resultCards = [];
    let duplicateCoins = 0;
    const activeCards = Array.from(store.cards.values()).filter((card) => card.type !== "core");

    for (let i = 0; i < pack.cardsPerPack; i += 1) {
      const rarityPick = weightedPick(pack.dropTable, random);
      const rarityPool = activeCards.filter((card) => card.rarity === rarityPick.rarity);
      const pool = rarityPool.length > 0 ? rarityPool : activeCards;
      const card = pool[Math.floor(random() * pool.length)];
      const grant = collectionService.grantCard(card.id, playerId, `pack:${pack.id}`);
      duplicateCoins += grant.duplicateCoins;
      resultCards.push({
        card,
        added: grant.added,
        duplicateCoins: grant.duplicateCoins,
        ownedCount: grant.ownedCount
      });
    }

    const opening = {
      id: makeId(),
      playerId,
      packId,
      results: resultCards.map((result) => ({
        cardId: result.card.id,
        added: result.added,
        duplicateCoins: result.duplicateCoins
      })),
      duplicateCoins,
      createdAt: nowIso()
    };
    store.packOpenings.push(opening);
    questService.recordProgress(playerId, "open_pack", 1);
    if (resultCards.some((result) => ["rare", "epic", "legendary", "mythic", "bababooey"].includes(result.card.rarity))) {
      questService.recordProgress(playerId, "get_rare_plus", 1);
    }

    return { opening, cards: resultCards, profile: store.profiles.get(playerId) };
  }

  return { list, open };
}

module.exports = { createPackService, weightedPick };
