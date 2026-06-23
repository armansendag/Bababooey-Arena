"use strict";

const packs = [
  {
    id: "starter_pack",
    name: "Starter Pack",
    description: "A gentle pack for new accounts. Mostly commons and uncommons, with a small rare chance.",
    price: 150,
    cardsPerPack: 6,
    includeCores: false,
    dropTable: [
      { rarity: "common", weight: 72 },
      { rarity: "uncommon", weight: 25 },
      { rarity: "rare", weight: 3 }
    ],
    guaranteedSlots: [
      { rarity: "uncommon" }
    ]
  },
  {
    id: "basic_pack",
    name: "Basic Pack",
    description: "The main progression pack, with a steady common/uncommon base and rare-plus upside.",
    price: 250,
    cardsPerPack: 6,
    includeCores: false,
    dropTable: [
      { rarity: "common", weight: 62 },
      { rarity: "uncommon", weight: 27 },
      { rarity: "rare", weight: 8 },
      { rarity: "epic", weight: 2.5 },
      { rarity: "legendary", weight: 0.45 },
      { rarity: "mythic", weight: 0.05 }
    ],
    guaranteedSlots: [
      { rarity: "uncommon" }
    ]
  },
  {
    id: "rare_pack",
    name: "Rare Pack",
    description: "Costs more, but guarantees one rare or better slot.",
    price: 600,
    cardsPerPack: 6,
    includeCores: false,
    dropTable: [
      { rarity: "common", weight: 42 },
      { rarity: "uncommon", weight: 34 },
      { rarity: "rare", weight: 18 },
      { rarity: "epic", weight: 4.8 },
      { rarity: "legendary", weight: 1 },
      { rarity: "mythic", weight: 0.2 }
    ],
    guaranteedSlots: [
      { rarity: "rare" }
    ]
  },
  {
    id: "epic_pack",
    name: "Epic Pack",
    description: "A premium pack with an epic guaranteed slot and a real legendary chase.",
    price: 1400,
    cardsPerPack: 6,
    includeCores: false,
    dropTable: [
      { rarity: "uncommon", weight: 43 },
      { rarity: "rare", weight: 37 },
      { rarity: "epic", weight: 16 },
      { rarity: "legendary", weight: 3 },
      { rarity: "mythic", weight: 0.8 },
      { rarity: "bababooey", weight: 0.2 }
    ],
    guaranteedSlots: [
      { rarity: "epic" }
    ]
  },
  {
    id: "mythic_pack",
    name: "Mythic Pack",
    description: "Very expensive long-term chase pack with a mythic guaranteed slot.",
    price: 5000,
    cardsPerPack: 6,
    includeCores: false,
    dropTable: [
      { rarity: "rare", weight: 44 },
      { rarity: "epic", weight: 34 },
      { rarity: "legendary", weight: 16 },
      { rarity: "mythic", weight: 5 },
      { rarity: "bababooey", weight: 1 }
    ],
    guaranteedSlots: [
      { rarity: "mythic" }
    ]
  },
  {
    id: "chaos_pack",
    name: "Chaos Pack",
    description: "High variance pack. Bad idea, great story.",
    price: 900,
    cardsPerPack: 7,
    includeCores: false,
    dropTable: [
      { rarity: "common", weight: 35 },
      { rarity: "uncommon", weight: 25 },
      { rarity: "rare", weight: 18 },
      { rarity: "epic", weight: 12 },
      { rarity: "legendary", weight: 6 },
      { rarity: "mythic", weight: 3 },
      { rarity: "bababooey", weight: 1 }
    ],
    guaranteedSlots: []
  },
  {
    id: "archetype_pack",
    name: "Archetype Pack",
    description: "Focused pack for building around troops, spells, and enchantments.",
    price: 450,
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
    description: "The only launch pack that can roll selectable Cores.",
    price: 700,
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
