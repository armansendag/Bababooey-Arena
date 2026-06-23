"use strict";

const packs = [
  {
    id: "starter_pack",
    name: "Starter Pack",
    price: 200,
    cardsPerPack: 6,
    includeCores: false,
    dropTable: [
      { rarity: "common", weight: 58 },
      { rarity: "uncommon", weight: 27 },
      { rarity: "rare", weight: 11 },
      { rarity: "epic", weight: 3 },
      { rarity: "legendary", weight: 0.8 },
      { rarity: "mythic", weight: 0.18 },
      { rarity: "bababooey", weight: 0.02 }
    ],
    guaranteedSlots: [
      { rarity: "uncommon" },
      { rarity: "rare", minPackIndex: 5 }
    ]
  },
  {
    id: "archetype_pack",
    name: "Archetype Pack",
    price: 350,
    cardsPerPack: 8,
    includeCores: false,
    dropTable: [
      { rarity: "common", weight: 46 },
      { rarity: "uncommon", weight: 32 },
      { rarity: "rare", weight: 16 },
      { rarity: "epic", weight: 4.5 },
      { rarity: "legendary", weight: 1.2 },
      { rarity: "mythic", weight: 0.28 },
      { rarity: "bababooey", weight: 0.02 }
    ],
    guaranteedSlots: [
      { rarity: "uncommon" },
      { rarity: "rare" }
    ]
  },
  {
    id: "core_cache",
    name: "Core Cache",
    price: 500,
    cardsPerPack: 5,
    includeCores: true,
    types: ["core", "enchantment", "spell"],
    dropTable: [
      { rarity: "common", weight: 35 },
      { rarity: "uncommon", weight: 30 },
      { rarity: "rare", weight: 23 },
      { rarity: "epic", weight: 8 },
      { rarity: "legendary", weight: 2.5 },
      { rarity: "mythic", weight: 1 },
      { rarity: "bababooey", weight: 0.5 }
    ],
    guaranteedSlots: [
      { type: "core" },
      { rarity: "rare" }
    ]
  }
];

module.exports = { packs };
