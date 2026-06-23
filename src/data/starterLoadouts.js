"use strict";

const STARTER_LOADOUTS = {
  aggro: {
    name: "Aggro Starter",
    coreCardId: "core_aggro",
    cards: {
      troop_beast_pouncing_cub: 3,
      troop_beast_fang_pup: 3,
      troop_tech_socket_runner: 2,
      troop_memeborn_tiny_goofball: 2,
      troop_beast_river_raptor: 2,
      troop_beast_horned_charger: 2,
      troop_neutral_banner_squire: 1,
      spell_quick_jab: 2,
      spell_bonk: 1,
      enchant_hunting_ground: 2
    }
  },
  ramp: {
    name: "Ramp Starter",
    coreCardId: "core_ramp",
    cards: {
      troop_mana_goblin: 3,
      troop_mana_slime: 3,
      troop_mana_sprout_channeler: 3,
      troop_mana_lotus_adept: 2,
      troop_mana_golem: 2,
      troop_mana_crystal_herder: 2,
      troop_mana_leyline_giant: 1,
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
      troop_arcane_mirror_savant: 2,
      troop_arcane_nullmage_guard: 2,
      troop_neutral_shield_captain: 2,
      troop_arcane_astral_binder: 1,
      spell_disenchant: 2,
      spell_disrupt: 1,
      enchant_arcane_shield: 2
    }
  },
  beast: {
    name: "Beast Starter",
    coreCardId: "core_beast",
    cards: {
      troop_beast_pouncing_cub: 3,
      troop_beast_fang_pup: 3,
      troop_beast_river_raptor: 3,
      troop_beast_horned_charger: 2,
      troop_beast_pack_alpha: 2,
      troop_beast_thunder_rhino: 2,
      troop_beast_skyclaw_roc: 1,
      spell_pack_howl: 2,
      enchant_hunting_ground: 1,
      enchant_alpha_den: 1
    }
  },
  machine: {
    name: "Machine Starter",
    coreCardId: "core_machine",
    cards: {
      troop_machine_tin_drone: 3,
      troop_machine_servo_helper: 3,
      troop_machine_assembly_walker: 3,
      troop_machine_cog_guardian: 2,
      troop_machine_factory_knight: 2,
      troop_machine_iron_harvester: 2,
      troop_tech_wrench_rookie: 1,
      spell_overclock: 2,
      enchant_assembly_line: 1,
      enchant_steel_bunker: 1
    }
  },
  undead: {
    name: "Undead Starter",
    coreCardId: "core_undead",
    cards: {
      troop_undead_bone_skitter: 3,
      troop_undead_grave_nibbler: 3,
      troop_undead_crypt_archer: 3,
      troop_undead_ghoul_captain: 2,
      troop_undead_tomb_knight: 2,
      troop_undead_wraith_duelist: 2,
      troop_undead_lich_acolyte: 1,
      spell_grave_call: 2,
      enchant_graveyard: 1,
      enchant_haunted_cathedral: 1
    }
  },
  memeborn: {
    name: "Memeborn Starter",
    coreCardId: "core_memeborn",
    cards: {
      troop_memeborn_tiny_goofball: 3,
      troop_memeborn_bonk_intern: 3,
      troop_memeborn_oops_knight: 3,
      troop_memeborn_vibe_wizard: 2,
      troop_memeborn_chair_champion: 2,
      troop_memeborn_yell_captain: 2,
      troop_memeborn_chaos_accountant: 1,
      spell_bonk: 2,
      spell_minor_inconvenience: 1,
      enchant_meme_factory: 1
    }
  }
};

const DEFAULT_STARTER_ARCHETYPE = "aggro";

module.exports = { DEFAULT_STARTER_ARCHETYPE, STARTER_LOADOUTS };
