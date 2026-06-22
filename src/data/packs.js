"use strict";

const packs = [
  {
    id: "starter_pack",
    name: "Starter Pack",
    price: 250,
    cardsPerPack: 5,
    dropTable: [
      { rarity: "common", weight: 70 },
      { rarity: "uncommon", weight: 20 },
      { rarity: "rare", weight: 8 },
      { rarity: "epic", weight: 1.5 },
      { rarity: "legendary", weight: 0.4 },
      { rarity: "mythic", weight: 0.09 },
      { rarity: "bababooey", weight: 0.01 }
    ]
  }
];

module.exports = { packs };
