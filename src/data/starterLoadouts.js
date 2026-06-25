"use strict";

const BEGINNER_LOADOUT = {
  name: "Beginner Starter",
  coreCardId: "core_starter",
  cards: {
    troop_beast_pouncing_cub: 3,
    troop_beast_fang_pup: 3,
    troop_tech_socket_runner: 2,
    spell_quick_jab: 2,
    enchant_hunting_ground: 2
  }
};

const STARTER_LOADOUTS = {
  aggro: {
    name: "Aggro Starter",
    coreCardId: "core_aggro",
    cards: {
      troop_beast_pouncing_cub: 3,
      troop_beast_fang_pup: 3,
      troop_tech_socket_runner: 2,
      spell_quick_jab: 2,
      enchant_hunting_ground: 2
    }
  },
  ramp: {
    name: "Ramp Starter",
    coreCardId: "core_ramp",
    cards: {
      troop_mana_goblin: 3,
      troop_mana_slime: 3,
      troop_mana_golem: 2,
      spell_emergency_funding: 2,
      enchant_mana_spring: 2
    }
  },
  control: {
    name: "Control Starter",
    coreCardId: "core_control",
    cards: {
      troop_arcane_rune_apprentice: 3,
      troop_arcane_glyph_scout: 3,
      troop_arcane_spellblade_adept: 2,
      spell_disenchant: 2,
      enchant_arcane_shield: 2
    }
  },
  beast: {
    name: "Beast Starter",
    coreCardId: "core_beast",
    cards: {
      troop_beast_pouncing_cub: 3,
      troop_beast_fang_pup: 3,
      troop_beast_river_raptor: 2,
      spell_pack_howl: 2,
      enchant_hunting_ground: 2
    }
  },
  machine: {
    name: "Machine Starter",
    coreCardId: "core_machine",
    cards: {
      troop_machine_tin_drone: 3,
      troop_machine_servo_helper: 3,
      troop_machine_assembly_walker: 2,
      spell_overclock: 2,
      enchant_assembly_line: 2
    }
  },
  undead: {
    name: "Undead Starter",
    coreCardId: "core_undead",
    cards: {
      troop_undead_bone_skitter: 3,
      troop_undead_grave_nibbler: 3,
      troop_undead_crypt_archer: 2,
      spell_grave_call: 2,
      enchant_graveyard: 2
    }
  },
  memeborn: {
    name: "Memeborn Starter",
    coreCardId: "core_memeborn",
    cards: {
      troop_memeborn_tiny_goofball: 3,
      troop_memeborn_bonk_intern: 3,
      troop_memeborn_oops_knight: 2,
      spell_bonk: 2,
      enchant_meme_factory: 2
    }
  }
};

const DEFAULT_STARTER_ARCHETYPE = "beginner";

module.exports = { BEGINNER_LOADOUT, DEFAULT_STARTER_ARCHETYPE, STARTER_LOADOUTS };
