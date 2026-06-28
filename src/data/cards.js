"use strict";

const FACTIONS = ["neutral", "mana", "arcane", "tech", "beast", "machine", "undead", "memeborn"];
const RARITY_BY_SLOT = ["common", "common", "common", "uncommon", "uncommon", "rare", "rare", "epic", "legendary", "mythic"];
const COST_BY_SLOT = [1, 1, 2, 2, 3, 3, 4, 5, 6, 8];
const COPY_BY_RARITY = {
  common: "standard",
  uncommon: "standard",
  rare: "limited",
  epic: "limited",
  legendary: "unique",
  mythic: "unique",
  bababooey: "unique"
};

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function troopCard(faction, name, slot, overrides = {}) {
  const rarity = overrides.rarity || RARITY_BY_SLOT[slot];
  const manaCost = overrides.manaCost ?? COST_BY_SLOT[slot];
  const attackBias = {
    neutral: 0,
    mana: -1,
    arcane: 0,
    tech: 1,
    beast: 2,
    machine: 0,
    undead: 0,
    memeborn: 1
  }[faction] || 0;
  const defenseBias = {
    neutral: 1,
    mana: 0,
    arcane: 0,
    tech: 1,
    beast: -1,
    machine: 2,
    undead: 0,
    memeborn: 0
  }[faction] || 0;
  return {
    id: overrides.id || `troop_${faction}_${slug(name)}`,
    name,
    type: "troop",
    rarity,
    faction,
    manaCost,
    cooldown: overrides.cooldown ?? Math.max(1, Math.ceil(manaCost / 2) + (rarity === "legendary" || rarity === "mythic" ? 2 : 1)),
    copyTag: overrides.copyTag || COPY_BY_RARITY[rarity],
    attack: overrides.attack ?? Math.max(1, manaCost + attackBias + (slot % 3)),
    defense: overrides.defense ?? Math.max(0, Math.floor(manaCost / 2) + defenseBias),
    hp: overrides.hp ?? Math.max(2, manaCost * 2 + 2 + Math.max(0, defenseBias)),
    perks: overrides.perks || [`${faction} ${slot < 3 ? "tempo" : slot < 7 ? "midgame" : "finisher"} troop`]
  };
}

const troopThemes = {
  neutral: [
    ["Enchantment Eater", { id: "troop_enchantment_eater", manaCost: 3, cooldown: 2, attack: 4, defense: 1, hp: 5, rarity: "uncommon", copyTag: "standard", perks: ["Bonus effects against enchantments"] }],
    ["Frontline Recruit", { perks: ["Reliable early blocker"] }],
    ["Banner Squire", { perks: ["Balanced starter troop"] }],
    ["Shield Captain", { perks: ["High defense for its cost"] }],
    ["Arena Bruiser", { perks: ["Steady midgame pressure"] }],
    ["Veteran Duelist", { perks: ["Efficient trade body"] }],
    ["Relic Warden", { perks: ["Protects fragile boards"] }],
    ["Colossus Handler", { perks: ["Large neutral body"] }],
    ["Ancient Sentinel", { perks: ["Late-game stabilizer"] }],
    ["Worldbreaker", { rarity: "mythic", manaCost: 6, cooldown: 5, attack: 18, defense: 8, hp: 28, perks: ["Neutral mythic finisher"] }]
  ],
  mana: [
    ["Mana Goblin", { id: "troop_mana_goblin", manaCost: 1, cooldown: 3, attack: 1, defense: 0, hp: 2, rarity: "common", copyTag: "standard", perks: ["Weak ramp body: when destroyed, gain +1 temporary mana"] }],
    ["Mana Slime", { id: "troop_mana_slime", manaCost: 2, cooldown: 3, attack: 1, defense: 1, hp: 3, rarity: "common", copyTag: "standard", perks: ["Weak ramp body: when destroyed, gain +1 mana"] }],
    ["Sprout Channeler", { perks: ["Ramp curve support"] }],
    ["Lotus Adept", { perks: ["Mana faction support"] }],
    ["Mana Golem", { id: "troop_mana_golem", manaCost: 5, cooldown: 3, attack: 4, defense: 4, hp: 9, rarity: "rare", copyTag: "limited", perks: ["Gain +1 mana each turn"] }],
    ["Crystal Herder", { perks: ["Sturdy ramp payoff"] }],
    ["Leyline Giant", { perks: ["Big mana bridge"] }],
    ["Overgrowth Titan", { perks: ["Ramp finisher"] }],
    ["Mana Dragon", { id: "troop_mana_dragon", manaCost: 8, cooldown: 5, attack: 8, defense: 6, hp: 14, rarity: "legendary", copyTag: "unique", perks: ["Gain +2 mana each turn"] }],
    ["Worldroot Avatar", { rarity: "mythic", manaCost: 6, cooldown: 5, attack: 14, defense: 8, hp: 28, perks: ["Mana mythic finisher"] }]
  ],
  arcane: [
    ["Rune Apprentice", { perks: ["Cheap arcane body"] }],
    ["Glyph Scout", { perks: ["Arcane tempo troop"] }],
    ["Arcane Hunter", { id: "troop_arcane_hunter", manaCost: 4, cooldown: 3, attack: 5, defense: 2, hp: 6, rarity: "rare", copyTag: "limited", perks: ["Interacts directly with enchantments"] }],
    ["Spellblade Adept", { perks: ["Pressures control decks"] }],
    ["Mirror Savant", { perks: ["Arcane value body"] }],
    ["Nullmage Guard", { perks: ["Defensive arcane troop"] }],
    ["Astral Binder", { perks: ["Late arcane stabilizer"] }],
    ["Chrono Oracle", { perks: ["Control finisher body"] }],
    ["Prism Archon", { rarity: "legendary", perks: ["Arcane legendary finisher"] }],
    ["Reality Editor", { rarity: "mythic", manaCost: 6, cooldown: 5, attack: 14, defense: 7, hp: 26, perks: ["Arcane mythic finisher"] }]
  ],
  tech: [
    ["Socket Runner", { perks: ["Fast tech opener", "Haste"] }],
    ["Wrench Rookie", { perks: ["Low-cost machine support"] }],
    ["Gearwright", { perks: ["Tech curve piece"] }],
    ["Pulse Trooper", { perks: ["Midrange tech attacker"] }],
    ["Demolition Bot", { id: "troop_demolition_bot", manaCost: 6, cooldown: 4, attack: 7, defense: 3, hp: 8, rarity: "epic", copyTag: "limited", perks: ["Destroys protected structures"] }],
    ["Railgunner", { perks: ["High attack tech troop"] }],
    ["Siege Mechanic", { perks: ["Structure pressure"] }],
    ["Turbo Exo-Suit", { perks: ["Heavy tech body"] }],
    ["Orbital Engineer", { rarity: "legendary", perks: ["Tech legendary payoff"] }],
    ["Doomsday Prototype", { rarity: "mythic", manaCost: 6, cooldown: 5, attack: 17, defense: 7, hp: 27, perks: ["Tech mythic finisher"] }]
  ],
  beast: [
    ["Pouncing Cub", { attack: 3, defense: 0, hp: 2, perks: ["Aggressive beast opener", "Haste"] }],
    ["Fang Pup", { attack: 3, perks: ["Fast beast pressure"] }],
    ["River Raptor", { perks: ["Beast tempo attacker"] }],
    ["Horned Charger", { attack: 5, defense: 1, perks: ["Aggro curve threat"] }],
    ["Pack Alpha", { perks: ["Beast midgame leader"] }],
    ["Thunder Rhino", { perks: ["Beast heavy hitter"] }],
    ["Skyclaw Roc", { perks: ["Evasive beast flavor"] }],
    ["Elder Mammoth", { perks: ["Large beast body"] }],
    ["Apex Chimera", { rarity: "legendary", perks: ["Beast legendary finisher"] }],
    ["Primal Calamity", { rarity: "mythic", manaCost: 6, cooldown: 5, attack: 20, defense: 4, hp: 26, perks: ["Beast mythic finisher"] }]
  ],
  machine: [
    ["Tin Drone", { defense: 2, perks: ["Machine blocker"] }],
    ["Servo Helper", { perks: ["Cheap machine unit"] }],
    ["Assembly Walker", { defense: 3, perks: ["Sturdy machine curve"] }],
    ["Cog Guardian", { defense: 4, perks: ["Defensive machine troop"] }],
    ["Factory Knight", { perks: ["Machine midgame unit"] }],
    ["Iron Harvester", { perks: ["Durable machine threat"] }],
    ["Mech Paladin", { perks: ["High defense machine"] }],
    ["Titan Loader", { perks: ["Large machine body"] }],
    ["Clockwork Dragon", { rarity: "legendary", perks: ["Machine legendary finisher"] }],
    ["Singularity Engine", { rarity: "mythic", manaCost: 6, cooldown: 5, attack: 15, defense: 10, hp: 30, perks: ["Machine mythic finisher"] }]
  ],
  undead: [
    ["Bone Skitter", { perks: ["Undead opener"] }],
    ["Grave Nibbler", { perks: ["Sticky undead body"] }],
    ["Crypt Archer", { perks: ["Undead ranged pressure"] }],
    ["Ghoul Captain", { perks: ["Undead curve leader"] }],
    ["Tomb Knight", { perks: ["Balanced undead troop"] }],
    ["Wraith Duelist", { perks: ["Midgame undead threat"] }],
    ["Lich Acolyte", { perks: ["Control undead body"] }],
    ["Grave Titan", { perks: ["Large undead body"] }],
    ["Dread Lich", { rarity: "legendary", perks: ["Undead legendary finisher"] }],
    ["The Last Coffin", { rarity: "mythic", manaCost: 6, cooldown: 5, attack: 15, defense: 7, hp: 29, perks: ["Undead mythic finisher"] }]
  ],
  memeborn: [
    ["Tiny Goofball", { perks: ["Memeborn opener", "Haste"] }],
    ["Bonk Intern", { perks: ["Cheap meme pressure"] }],
    ["Oops Knight", { perks: ["Unstable but playable"] }],
    ["Vibe Wizard", { perks: ["Memeborn curve piece"] }],
    ["Chair Champion", { perks: ["Absurd midgame attacker"] }],
    ["Yell Captain", { perks: ["Memeborn rally body"] }],
    ["Chaos Accountant", { perks: ["Strange but sturdy"] }],
    ["Monday Monster", { perks: ["Late meme pressure"] }],
    ["Bababooey Herald", { rarity: "legendary", perks: ["Memeborn legendary finisher"] }],
    ["The Big Bababooey", { rarity: "bababooey", manaCost: 6, cooldown: 5, attack: 19, defense: 6, hp: 30, perks: ["Bababooey rarity finisher"] }]
  ]
};

const troopCards = Object.entries(troopThemes).flatMap(([faction, entries]) => {
  return entries.map(([name, overrides], slot) => troopCard(faction, name, slot, overrides));
});

const spellCards = [
  ["spell_sit", "Sit", "neutral", "rare", 7, 4, "limited", ["Deal 20 damage"]],
  ["spell_mana_conversion", "Mana Conversion", "mana", "uncommon", 4, 4, "standard", ["Destroy a troop and gain its mana cost"]],
  ["spell_emergency_funding", "Emergency Funding", "mana", "common", 0, 2, "standard", ["Gain +3 temporary mana and deal 5 damage to your Core"]],
  ["spell_disenchant", "Disenchant", "arcane", "common", 2, 2, "standard", ["Destroy an enchantment"]],
  ["spell_nope", "Nope", "arcane", "epic", 3, 4, "limited", ["Counter a spell"]],
  ["spell_reflect", "Reflect", "arcane", "epic", 4, 4, "limited", ["Redirect a spell"]],
  ["spell_disrupt", "Disrupt", "arcane", "rare", 3, 3, "limited", ["Increase cooldowns"]],
  ["spell_quick_jab", "Quick Jab", "beast", "common", 1, 1, "standard", ["Reusable tempo spell"]],
  ["spell_pack_howl", "Pack Howl", "beast", "uncommon", 2, 2, "standard", ["Beast pressure support"]],
  ["spell_primal_roar", "Primal Roar", "beast", "rare", 4, 3, "limited", ["Big beast turn setup"]],
  ["spell_overclock", "Overclock", "machine", "common", 1, 2, "standard", ["Machine tempo support"]],
  ["spell_repair_loop", "Repair Loop", "machine", "common", 2, 2, "standard", ["Machine sustain hook"]],
  ["spell_factory_reset", "Factory Reset", "machine", "rare", 5, 4, "limited", ["Machine board reset hook"]],
  ["spell_grave_call", "Grave Call", "undead", "common", 2, 2, "standard", ["Undead recursion hook"]],
  ["spell_bone_storm", "Bone Storm", "undead", "uncommon", 3, 3, "standard", ["Undead pressure spell"]],
  ["spell_final_rites", "Final Rites", "undead", "epic", 6, 4, "limited", ["Undead finisher hook"]],
  ["spell_bonk", "Bonk", "memeborn", "common", 1, 1, "standard", ["Small reusable meme spell"]],
  ["spell_minor_inconvenience", "Minor Inconvenience", "memeborn", "uncommon", 2, 2, "standard", ["Cooldown annoyance hook"]],
  ["spell_unhinged_plan", "Unhinged Plan", "memeborn", "rare", 3, 3, "limited", ["Memeborn combo setup"]],
  ["spell_arcane_ping", "Arcane Ping", "arcane", "common", 1, 1, "standard", ["Cheap arcane spell"]],
  ["spell_time_skip", "Time Skip", "arcane", "legendary", 6, 5, "unique", ["Turn manipulation hook"]],
  ["spell_supply_drop", "Supply Drop", "tech", "common", 2, 2, "standard", ["Tech resource hook"]],
  ["spell_scrap_blast", "Scrap Blast", "tech", "uncommon", 3, 3, "standard", ["Tech damage hook"]],
  ["spell_orbital_ping", "Orbital Ping", "tech", "rare", 4, 3, "limited", ["Tech reach hook"]],
  ["spell_forbidden_coupon", "Forbidden Coupon", "memeborn", "bababooey", 2, 8, "unique", ["Gain +3 temporary mana"]]
].map(([id, name, faction, rarity, manaCost, cooldown, copyTag, perks]) => ({
  id,
  name,
  type: "spell",
  rarity,
  faction,
  manaCost,
  cooldown,
  copyTag,
  perks
}));

const enchantmentCards = [
  ["enchant_mana_spring", "Mana Spring", "mana", "common", 3, 3, "standard", 7, ["+1 mana bank cap while active"]],
  ["enchant_crystal_mine", "Crystal Mine", "mana", "uncommon", 3, 2, "standard", 9, ["Gain +1 mana each turn"]],
  ["enchant_arcane_reservoir", "Arcane Reservoir", "arcane", "rare", 3, 3, "limited", 10, ["First spell costs 1 less"]],
  ["enchant_mystic_well", "Mystic Well", "mana", "rare", 4, 3, "limited", 11, ["Gain mana when casting spells"]],
  ["enchant_infinite_generator", "Infinite Generator", "mana", "mythic", 4, 5, "unique", 15, ["Gain +1 mana each turn"]],
  ["enchant_arcane_shield", "Arcane Shield", "arcane", "rare", 4, 3, "limited", 12, ["Enchantments take 50% reduced damage"]],
  ["enchant_fortress_wall", "Fortress Wall", "neutral", "epic", 5, 4, "limited", 16, ["Core damage reduction"]],
  ["enchant_magic_barrier", "Magic Barrier", "arcane", "epic", 5, 4, "limited", 10, ["Cancel first enemy spell each turn"]],
  ["enchant_counter_matrix", "Counter Matrix", "arcane", "legendary", 6, 5, "unique", 13, ["Enemy spells cost more"]],
  ["enchant_guardian_statue", "Guardian Statue", "neutral", "rare", 4, 3, "limited", 14, ["Protects enchantments"]],
  ["enchant_hunting_ground", "Hunting Ground", "beast", "common", 2, 2, "standard", 8, ["Beast pressure support"]],
  ["enchant_alpha_den", "Alpha Den", "beast", "rare", 4, 3, "limited", 12, ["Beast board support"]],
  ["enchant_assembly_line", "Assembly Line", "machine", "common", 2, 2, "standard", 9, ["Machine curve support"]],
  ["enchant_steel_bunker", "Steel Bunker", "machine", "rare", 4, 3, "limited", 15, ["Machine defense support"]],
  ["enchant_graveyard", "Graveyard", "undead", "common", 2, 2, "standard", 8, ["Undead recursion support"]],
  ["enchant_haunted_cathedral", "Haunted Cathedral", "undead", "epic", 5, 4, "limited", 14, ["Undead late-game support"]],
  ["enchant_meme_factory", "Meme Factory", "memeborn", "common", 2, 2, "standard", 8, ["Memeborn value support"]],
  ["enchant_bababooey_echo", "Bababooey Echo", "memeborn", "legendary", 6, 5, "unique", 13, ["Memeborn legendary enchantment"]],
  ["enchant_supply_depot", "Supply Depot", "tech", "uncommon", 3, 2, "standard", 10, ["Tech support enchantment"]],
  ["enchant_orbital_array", "Orbital Array", "tech", "epic", 5, 4, "limited", 12, ["Tech late-game support"]]
].map(([id, name, faction, rarity, manaCost, cooldown, copyTag, hp, perks]) => ({
  id,
  name,
  type: "enchantment",
  rarity,
  faction,
  manaCost,
  cooldown,
  copyTag,
  hp,
  perks
}));

const coreCards = [
  ["core_starter", "Starter Core", "neutral", "common", 20, ["Core HP 20"]],
  ["core_aggro", "War Drum Core", "beast", "uncommon", 20, ["Core HP 20", "Aggro starter core"]],
  ["core_ramp", "Worldroot Core", "mana", "uncommon", 20, ["Core HP 20", "Ramp starter core"]],
  ["core_control", "Prism Core", "arcane", "rare", 20, ["Core HP 20", "Control starter core"]],
  ["core_beast", "Apex Core", "beast", "rare", 20, ["Core HP 20", "Beast starter core"]],
  ["core_machine", "Factory Core", "machine", "rare", 20, ["Core HP 20", "Machine starter core"]],
  ["core_undead", "Crypt Core", "undead", "rare", 20, ["Core HP 20", "Undead starter core"]],
  ["core_memeborn", "Bababooey Core", "memeborn", "bababooey", 20, ["Core HP 20", "Memeborn starter core"]]
].map(([id, name, faction, rarity, hp, perks]) => ({
  id,
  name,
  type: "core",
  rarity,
  faction,
  manaCost: 0,
  cooldown: 0,
  copyTag: "unique",
  hp,
  perks
}));

const cardEffects = {
  troop_mana_goblin: [{ trigger: "death", type: "manaGain", amount: 1, temporary: true }],
  troop_mana_slime: [{ trigger: "death", type: "manaGain", amount: 1, temporary: true }],
  troop_mana_golem: [{ trigger: "startTurn", type: "manaGain", amount: 1, temporary: true, ownerOnly: true }],
  troop_mana_dragon: [{ trigger: "startTurn", type: "manaGain", amount: 2, temporary: true, ownerOnly: true }],
  troop_enchantment_eater: [{ trigger: "onAttack", type: "enchantmentDamageBonus", amount: 3 }],
  troop_arcane_hunter: [{ trigger: "onAttack", type: "enchantmentDamageBonus", amount: 2 }],
  troop_demolition_bot: [{ trigger: "onAttack", type: "destroyEnchantmentOnHit" }],
  troop_neutral_shield_captain: [{ trigger: "onPlay", type: "statBuff", selector: "self", defense: 1 }],
  troop_neutral_relic_warden: [{ trigger: "static", type: "enchantmentDamageReduction", amount: 1 }],
  troop_beast_pack_alpha: [{ trigger: "onPlay", type: "statBuff", selector: "friendlyFaction", faction: "beast", attack: 1 }],
  troop_beast_thunder_rhino: [{ trigger: "onAttack", type: "trampleCoreDamage", amount: 1 }],
  troop_neutral_worldbreaker: [{ trigger: "onAttack", type: "trampleCoreDamage", amount: 4 }],
  troop_mana_worldroot_avatar: [{ trigger: "startTurn", type: "manaGain", amount: 1, temporary: true, ownerOnly: true }],
  troop_arcane_reality_editor: [{ trigger: "onPlay", type: "spellCounter", amount: 1 }],
  troop_tech_doomsday_prototype: [{ trigger: "onPlay", type: "damageAllEnemies", amount: 4 }],
  troop_beast_primal_calamity: [{ trigger: "onAttack", type: "trampleCoreDamage", amount: 5 }],
  troop_machine_cog_guardian: [{ trigger: "static", type: "coreDamageReduction", amount: 1 }],
  troop_machine_iron_harvester: [{ trigger: "onAttack", type: "lifesteal", amount: 2 }],
  troop_machine_mech_paladin: [{ trigger: "onPlay", type: "healCore", amount: 4 }],
  troop_machine_singularity_engine: [{ trigger: "static", type: "coreDamageReduction", amount: 2 }],
  troop_undead_grave_nibbler: [{ trigger: "death", type: "healCore", amount: 2 }],
  troop_undead_wraith_duelist: [{ trigger: "onAttack", type: "lifesteal", amount: 2 }],
  troop_undead_the_last_coffin: [{ trigger: "death", type: "damageAllEnemies", amount: 4 }],
  troop_memeborn_oops_knight: [{ trigger: "onPlay", type: "trueDamageSelfCore", amount: 2 }],
  troop_memeborn_chair_champion: [{ trigger: "onAttack", type: "cooldownIncrease", target: "opponentSpells", amount: 1 }],
  troop_memeborn_the_big_bababooey: [{ trigger: "onPlay", type: "damageAllEnemies", amount: 4 }],

  spell_sit: [{ trigger: "spell", type: "damage", target: "enemyCore", amount: 20 }],
  spell_mana_conversion: [
    { trigger: "spell", type: "destroyTroop", target: "targetTroop" },
    { trigger: "spell", type: "manaGainFromDestroyedCost", temporary: true }
  ],
  spell_emergency_funding: [
    { trigger: "spell", type: "manaGain", amount: 3, temporary: true },
    { trigger: "spell", type: "trueDamageSelfCore", amount: 5 }
  ],
  spell_disenchant: [{ trigger: "spell", type: "destroyEnchantment", target: "targetEnchantment" }],
  spell_nope: [{ trigger: "spell", type: "spellCounter", amount: 1 }],
  spell_reflect: [{ trigger: "spell", type: "spellReflection", amount: 1 }],
  spell_disrupt: [{ trigger: "spell", type: "cooldownIncrease", target: "opponentAll", amount: 1 }],
  spell_quick_jab: [{ trigger: "spell", type: "damage", target: "targetOrEnemyCore", amount: 2 }],
  spell_pack_howl: [{ trigger: "spell", type: "statBuff", selector: "friendlyFaction", faction: "beast", attack: 1 }],
  spell_primal_roar: [{ trigger: "spell", type: "statBuff", selector: "friendlyFaction", faction: "beast", attack: 2, hp: 1 }],
  spell_overclock: [{ trigger: "spell", type: "statBuff", selector: "friendlyFaction", faction: "machine", attack: 1 }],
  spell_repair_loop: [{ trigger: "spell", type: "heal", target: "targetOrFriendlyCore", amount: 4 }],
  spell_factory_reset: [{ trigger: "spell", type: "damageAllTroops", amount: 3 }],
  spell_grave_call: [{ trigger: "spell", type: "cooldownReduction", target: "ownTroops", amount: 1 }],
  spell_bone_storm: [{ trigger: "spell", type: "damageAllEnemies", amount: 2 }],
  spell_final_rites: [{ trigger: "spell", type: "damage", target: "enemyCore", amount: 12 }],
  spell_bonk: [{ trigger: "spell", type: "damage", target: "targetOrEnemyCore", amount: 1 }],
  spell_minor_inconvenience: [{ trigger: "spell", type: "cooldownIncrease", target: "opponentAll", amount: 1 }],
  spell_unhinged_plan: [{ trigger: "spell", type: "manaGain", amount: 2, temporary: true }],
  spell_arcane_ping: [{ trigger: "spell", type: "damage", target: "targetOrEnemyCore", amount: 1 }],
  spell_time_skip: [{ trigger: "spell", type: "cooldownReduction", target: "ownAll", amount: 2 }],
  spell_supply_drop: [{ trigger: "spell", type: "manaGain", amount: 1, temporary: true }],
  spell_scrap_blast: [{ trigger: "spell", type: "damage", target: "targetOrEnemyCore", amount: 3 }],
  spell_orbital_ping: [{ trigger: "spell", type: "trueDamage", target: "enemyCore", amount: 4 }],
  spell_forbidden_coupon: [{ trigger: "spell", type: "manaGain", amount: 3, temporary: true }],

  enchant_mana_spring: [{ trigger: "static", type: "maxManaIncrease", amount: 1 }],
  enchant_crystal_mine: [{ trigger: "startTurn", type: "manaGain", amount: 1, temporary: true, ownerOnly: true }],
  enchant_arcane_reservoir: [{ trigger: "static", type: "firstSpellDiscount", amount: 1 }],
  enchant_mystic_well: [{ trigger: "onSpellCast", type: "manaGain", amount: 1, temporary: true }],
  enchant_infinite_generator: [{ trigger: "startTurn", type: "manaGain", amount: 1, temporary: true, ownerOnly: true }],
  enchant_arcane_shield: [{ trigger: "static", type: "enchantmentDamageMultiplier", multiplier: 0.5 }],
  enchant_fortress_wall: [{ trigger: "static", type: "coreDamageReduction", amount: 5 }],
  enchant_magic_barrier: [{ trigger: "static", type: "spellCounterFirstEachTurn", amount: 1 }],
  enchant_counter_matrix: [{ trigger: "static", type: "enemySpellCostIncrease", amount: 1 }],
  enchant_guardian_statue: [{ trigger: "static", type: "enchantmentDamageReduction", amount: 2 }],
  enchant_hunting_ground: [{ trigger: "onPlayTroop", type: "statBuff", selector: "playedFaction", faction: "beast", attack: 1 }],
  enchant_alpha_den: [{ trigger: "startTurn", type: "statBuff", selector: "friendlyFaction", faction: "beast", attack: 1, ownerOnly: true }],
  enchant_assembly_line: [{ trigger: "onPlayTroop", type: "statBuff", selector: "playedFaction", faction: "machine", defense: 1 }],
  enchant_steel_bunker: [{ trigger: "static", type: "coreDamageReduction", amount: 3 }],
  enchant_graveyard: [{ trigger: "death", type: "cooldownReduction", target: "destroyedTroop", amount: 1 }],
  enchant_haunted_cathedral: [{ trigger: "startTurn", type: "healCore", amount: 3, ownerOnly: true }],
  enchant_meme_factory: [{ trigger: "onPlayTroop", type: "manaGainForFaction", faction: "memeborn", amount: 1, temporary: true }],
  enchant_bababooey_echo: [{ trigger: "onSpellCast", type: "damage", target: "enemyCore", amount: 2 }],
  enchant_supply_depot: [{ trigger: "startTurn", type: "manaGain", amount: 1, temporary: true, ownerOnly: true }],
  enchant_orbital_array: [{ trigger: "startTurn", type: "damage", target: "enemyCore", amount: 2, ownerOnly: true }],

  core_aggro: [{ trigger: "onAttack", type: "coreAttackBonus", faction: "beast", amount: 1 }],
  core_ramp: [],
  core_control: [{ trigger: "static", type: "coreDamageReduction", amount: 1 }],
  core_beast: [{ trigger: "onAttack", type: "coreAttackBonus", faction: "beast", amount: 1 }],
  core_machine: [{ trigger: "onPlayTroop", type: "statBuff", selector: "playedFaction", faction: "machine", defense: 1 }],
  core_undead: [{ trigger: "death", type: "healCore", amount: 1 }],
  core_memeborn: [{ trigger: "onSpellCast", type: "damage", target: "enemyCore", amount: 1 }]
};

const memeCardNames = {
  core_starter: "Plain Toast Core",
  core_aggro: "Bonk Alarm Core",
  core_ramp: "Big Snack Core",
  core_control: "No Fun Allowed Core",
  core_beast: "Bark Mode Core",
  core_machine: "Toaster Palace Core",
  core_undead: "Oops All Bones Core",
  core_memeborn: "Bababooey Core Deluxe",
  troop_enchantment_eater: "Contract Gobbler",
  troop_neutral_frontline_recruit: "Intern With A Pan",
  troop_neutral_banner_squire: "Flag Boy Supreme",
  troop_neutral_shield_captain: "Captain Door Shield",
  troop_neutral_arena_bruiser: "Parking Lot Larry",
  troop_neutral_veteran_duelist: "Uncle Parry",
  troop_neutral_relic_warden: "Museum Bouncer",
  troop_neutral_colossus_handler: "Big Tony Handler",
  troop_neutral_ancient_sentinel: "Grandpa Statue",
  troop_neutral_worldbreaker: "The Debt Collector",
  troop_mana_goblin: "Quandale Dingle",
  troop_mana_slime: "Liquidity Squish",
  troop_mana_sprout_channeler: "Beanstalk Accountant",
  troop_mana_lotus_adept: "Budget Yoga Wizard",
  troop_mana_golem: "ATM With Legs",
  troop_mana_crystal_herder: "Crystal Dad",
  troop_mana_leyline_giant: "Extension Cord Giant",
  troop_mana_overgrowth_titan: "Lawn Violation Titan",
  troop_mana_dragon: "Tax Refund Dragon",
  troop_mana_worldroot_avatar: "Big Tree Receipt",
  troop_arcane_rune_apprentice: "Spelling Bee Menace",
  troop_arcane_glyph_scout: "Tiny Rune Snitch",
  troop_arcane_hunter: "Magic Hall Monitor",
  troop_arcane_spellblade_adept: "Mall Ninja Wizard",
  troop_arcane_mirror_savant: "Selfie Sorcerer",
  troop_arcane_nullmage_guard: "Ctrl Z Security",
  troop_arcane_astral_binder: "Cosmic Zip Tie",
  troop_arcane_chrono_oracle: "Microwave Prophet",
  troop_arcane_prism_archon: "Rainbow Principal",
  troop_arcane_reality_editor: "Photoshop Wizard",
  troop_tech_socket_runner: "USB Speed Goblin",
  troop_tech_wrench_rookie: "Lil Wrenchy",
  troop_tech_gearwright: "Gear Gremlin Guy",
  troop_tech_pulse_trooper: "Bluetooth Bonker",
  troop_demolition_bot: "Roomba With Charges",
  troop_tech_railgunner: "Train Horn Chad",
  troop_tech_siege_mechanic: "IKEA Siege Expert",
  troop_tech_turbo_exo_suit: "Turbo Pajama Suit",
  troop_tech_orbital_engineer: "Satellite Nephew",
  troop_tech_doomsday_prototype: "Oops Button 9000",
  troop_beast_pouncing_cub: "Sneaky Cheddar Cub",
  troop_beast_fang_pup: "Bitey Chihuahua",
  troop_beast_river_raptor: "Wet Chicken Raptor",
  troop_beast_horned_charger: "Shopping Cart Rhino",
  troop_beast_pack_alpha: "Alpha Lunch Monitor",
  troop_beast_thunder_rhino: "Thunder Meatball",
  troop_beast_skyclaw_roc: "Ceiling Fan Bird",
  troop_beast_elder_mammoth: "Grandpa Woolly",
  troop_beast_apex_chimera: "Three Guys In A Coat",
  troop_beast_primal_calamity: "Absolute Unit Event",
  troop_machine_tin_drone: "Soup Can Drone",
  troop_machine_servo_helper: "Helpful Paperclip",
  troop_machine_assembly_walker: "Conveyor Belt Legs",
  troop_machine_cog_guardian: "Cog Blocker Deluxe",
  troop_machine_factory_knight: "Forklift Paladin",
  troop_machine_iron_harvester: "Rusty Juice Box",
  troop_machine_mech_paladin: "Chrome Hall Monitor",
  troop_machine_titan_loader: "Big Clanky Frank",
  troop_machine_clockwork_dragon: "Wind-Up Lizard",
  troop_machine_singularity_engine: "Forbidden Blender",
  troop_undead_bone_skitter: "Bone Roomba",
  troop_undead_grave_nibbler: "Toe Nibbler",
  troop_undead_crypt_archer: "Skeleton With WiFi",
  troop_undead_ghoul_captain: "Captain Crusty",
  troop_undead_tomb_knight: "Coffin Bouncer",
  troop_undead_wraith_duelist: "Drama Ghost",
  troop_undead_lich_acolyte: "Homework Lich",
  troop_undead_grave_titan: "Big Dirt Guy",
  troop_undead_dread_lich: "Professor Stinky",
  troop_undead_the_last_coffin: "Final Nap Box",
  troop_memeborn_tiny_goofball: "Lil Goobert",
  troop_memeborn_bonk_intern: "Bonk Intern",
  troop_memeborn_oops_knight: "Oops Knight",
  troop_memeborn_vibe_wizard: "Vibe Check Wizard",
  troop_memeborn_chair_champion: "Folding Chair Steve",
  troop_memeborn_yell_captain: "Caps Lock Captain",
  troop_memeborn_chaos_accountant: "Tax Fraud Wizard",
  troop_memeborn_monday_monster: "Monday Morning",
  troop_memeborn_bababooey_herald: "Bababooey Herald",
  troop_memeborn_the_big_bababooey: "The Big Bababooey",
  spell_sit: "Sit Down Button",
  spell_mana_conversion: "Sell This Creature",
  spell_emergency_funding: "Sketchy Loan",
  spell_disenchant: "Delete The Aura",
  spell_nope: "Nuh Uh",
  spell_reflect: "Uno Reverse-ish",
  spell_disrupt: "Lag Switch",
  spell_quick_jab: "Tiny Slap",
  spell_pack_howl: "Group Chat Howl",
  spell_primal_roar: "Loud Blender Noise",
  spell_overclock: "Overclock The Toaster",
  spell_repair_loop: "Duct Tape Ritual",
  spell_factory_reset: "Factory Reset Panic",
  spell_grave_call: "Wake Up Skeleton",
  spell_bone_storm: "Bone Confetti",
  spell_final_rites: "Last Receipt",
  spell_bonk: "Bonk",
  spell_minor_inconvenience: "Minor Inconvenience",
  spell_unhinged_plan: "Totally Legal Plan",
  spell_arcane_ping: "Wizard Poke",
  spell_time_skip: "Skip The Cutscene",
  spell_supply_drop: "Mystery Lunchbox",
  spell_scrap_blast: "Scrap Yard Sneezing",
  spell_orbital_ping: "Satellite Tap",
  spell_forbidden_coupon: "Forbidden Coupon",
  enchant_mana_spring: "Leaky Mana Faucet",
  enchant_crystal_mine: "Shiny Rock Business",
  enchant_arcane_reservoir: "Wizard Water Cooler",
  enchant_mystic_well: "Suspicious Wishing Well",
  enchant_infinite_generator: "Forever Battery",
  enchant_arcane_shield: "Bubble Wrap Palace",
  enchant_fortress_wall: "Very Serious Wall",
  enchant_magic_barrier: "Nope Screen",
  enchant_counter_matrix: "Spreadsheet Trap",
  enchant_guardian_statue: "Judgy Statue",
  enchant_hunting_ground: "Snack Zone",
  enchant_alpha_den: "Cool Kids Den",
  enchant_assembly_line: "Robot Waiting Room",
  enchant_steel_bunker: "Tin Can Basement",
  enchant_graveyard: "The Nap Yard",
  enchant_haunted_cathedral: "Spooky Food Court",
  enchant_meme_factory: "Meme Factory",
  enchant_bababooey_echo: "Bababooey Echo Chamber",
  enchant_supply_depot: "Coupon Warehouse",
  enchant_orbital_array: "Sky Laser Subscription"
};

function describeTarget(effect) {
  const target = effect.target || effect.selector || "";
  const labels = {
    enemyCore: "enemy Core",
    targetOrEnemyCore: "a target or the enemy Core if troops are cleared",
    targetTroop: "a target troop",
    targetEnchantment: "a target enchantment",
    targetOrFriendlyCore: "a friendly troop or your Core",
    opponentAll: "all enemy cooldowns",
    opponentSpells: "enemy spell cooldowns",
    ownTroops: "your troop cooldowns",
    ownAll: "your cooldowns",
    destroyedTroop: "the defeated troop",
    self: "itself",
    friendlyFaction: `friendly ${effect.faction || "matching"} troops`,
    playedFaction: `played ${effect.faction || "matching"} troops`
  };
  return labels[target] || target || "the target";
}

function effectText(effect) {
  const trigger = {
    spell: "When cast",
    startTurn: "At the start of your turn",
    death: "When it dies",
    onAttack: "When it attacks",
    onPlay: "When played",
    static: "While active",
    onSpellCast: "Whenever you cast a spell",
    onPlayTroop: "Whenever you play a matching troop"
  }[effect.trigger] || "Effect";
  const temporary = effect.temporary ? " temporary" : "";
  const type = effect.type;
  if (type === "manaGain") return `${trigger}: gain +${effect.amount}${temporary} mana.`;
  if (type === "manaGainFromDestroyedCost") return `${trigger}: gain temporary mana equal to the destroyed troop's mana cost.`;
  if (type === "manaGainForFaction") return `${trigger}: if it is ${effect.faction}, gain +${effect.amount}${temporary} mana.`;
  if (type === "maxManaIncrease") return `${trigger}: increase your mana bank cap by ${effect.amount}.`;
  if (type === "damage") return `${trigger}: deal ${effect.amount} damage to ${describeTarget(effect)}.`;
  if (type === "trueDamage") return `${trigger}: deal ${effect.amount} true damage to ${describeTarget(effect)}.`;
  if (type === "trueDamageSelfCore") return `${trigger}: deal ${effect.amount} true damage to your own Core.`;
  if (type === "damageAllTroops") return `${trigger}: deal ${effect.amount} damage to every troop.`;
  if (type === "damageAllEnemies") return `${trigger}: deal ${effect.amount} damage to all enemy troops.`;
  if (type === "heal") return `${trigger}: heal ${describeTarget(effect)} for ${effect.amount} HP.`;
  if (type === "healCore") return `${trigger}: heal your Core for ${effect.amount} HP.`;
  if (type === "statBuff") {
    const parts = [];
    if (effect.attack) parts.push(`+${effect.attack} Attack`);
    if (effect.defense) parts.push(`+${effect.defense} Defense`);
    if (effect.hp) parts.push(`+${effect.hp} HP`);
    return `${trigger}: give ${describeTarget(effect)} ${parts.join(", ")}.`;
  }
  if (type === "destroyTroop") return `${trigger}: destroy ${describeTarget(effect)}.`;
  if (type === "destroyEnchantment") return `${trigger}: destroy ${describeTarget(effect)}.`;
  if (type === "destroyEnchantmentOnHit") return `${trigger}: destroy the enchantment it hits.`;
  if (type === "enchantmentDamageBonus") return `${trigger}: deal +${effect.amount} bonus damage to enchantments.`;
  if (type === "enchantmentDamageReduction") return `${trigger}: reduce damage to your enchantments by ${effect.amount}.`;
  if (type === "enchantmentDamageMultiplier") return `${trigger}: your enchantments take ${Math.round((1 - effect.multiplier) * 100)}% less damage.`;
  if (type === "coreDamageReduction") return `${trigger}: reduce damage to your Core by ${effect.amount}.`;
  if (type === "lifesteal") return `${trigger}: heal your Core for ${effect.amount} after dealing damage.`;
  if (type === "cooldownIncrease") return `${trigger}: increase ${describeTarget(effect)} by ${effect.amount}.`;
  if (type === "cooldownReduction") return `${trigger}: reduce ${describeTarget(effect)} by ${effect.amount}.`;
  if (type === "spellCounter") return `${trigger}: counter the next enemy spell.`;
  if (type === "spellReflection") return `${trigger}: reflect the next enemy spell back if possible.`;
  if (type === "spellCounterFirstEachTurn") return `${trigger}: cancel the first enemy spell each turn.`;
  if (type === "enemySpellCostIncrease") return `${trigger}: enemy spells cost +${effect.amount} mana.`;
  if (type === "firstSpellDiscount") return `${trigger}: your first spell each turn costs ${effect.amount} less.`;
  if (type === "coreAttackBonus") return `${trigger}: ${effect.faction} attackers deal +${effect.amount} Core damage.`;
  if (type === "trampleCoreDamage") return `${trigger}: also deal ${effect.amount} damage to the enemy Core.`;
  return `${trigger}: ${type.replace(/([A-Z])/g, " $1").toLowerCase()}.`;
}

function buildRulesText(card) {
  const details = [];
  if (card.type === "core") {
    details.push(`Core starts with ${card.hp} HP.`);
  }
  if (card.type === "troop" && (card.perks || []).some((perk) => String(perk).toLowerCase().includes("haste"))) {
    details.push("Haste: this troop can attack on the turn it is played.");
  }
  const effectDetails = (card.effects || []).map(effectText);
  if (effectDetails.length) details.push(...effectDetails);
  if (!effectDetails.length && card.perks?.length) details.push(`Flavor role: ${card.perks.join(" | ")}.`);
  return details.join(" ");
}

const cards = [...coreCards, ...troopCards, ...spellCards, ...enchantmentCards].map((card) => ({
  ...card,
  name: memeCardNames[card.id] || card.name,
  effects: cardEffects[card.id] || []
})).map((card) => {
  const text = buildRulesText(card);
  return {
    ...card,
    text,
    rulesText: text
  };
});
const cardsById = new Map(cards.map((card) => [card.id, card]));

module.exports = { cards, cardsById };
