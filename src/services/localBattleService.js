"use strict";

const { cardsById } = require("../data/cards");
const { applyCommand, createMatch } = require("../domain/battleEngine");
const { makeId } = require("../store/memoryStore");

const DEMO_LOADOUT = {
  coreCardId: "core_starter",
  cards: {
    troop_mana_goblin: 3,
    troop_mana_slime: 3,
    troop_mana_golem: 2,
    troop_mana_dragon: 1,
    troop_enchantment_eater: 3,
    troop_arcane_hunter: 2,
    troop_demolition_bot: 2,
    spell_sit: 1,
    spell_emergency_funding: 1,
    spell_disenchant: 1,
    enchant_mana_spring: 1
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createLocalBattleService(options = {}) {
  const cardCatalog = options.cardCatalog || cardsById;
  const sessions = new Map();

  function createDemoMatch() {
    const id = makeId();
    const state = createMatch(
      {
        player1: { id: "player_1", loadout: DEMO_LOADOUT },
        player2: { id: "player_2", loadout: DEMO_LOADOUT },
        seed: id
      },
      { cardCatalog, matchId: id }
    );
    sessions.set(id, state);
    return clone(state);
  }

  function getMatch(id) {
    const state = sessions.get(id);
    if (!state) {
      const error = new Error("Local match not found.");
      error.status = 404;
      throw error;
    }
    return clone(state);
  }

  function command(id, commandPayload) {
    const state = sessions.get(id);
    if (!state) {
      const error = new Error("Local match not found.");
      error.status = 404;
      throw error;
    }
    const result = applyCommand(state, commandPayload, { cardCatalog });
    return { result: clone(result), state: clone(state) };
  }

  function runDemoScript() {
    const state = createDemoMatch();
    let current = sessions.get(state.id);
    const firstTroop = command(current.id, { type: "playTroop", playerId: "player_1", cardId: "troop_mana_goblin" });
    current = firstTroop.state;
    command(current.id, { type: "endTurn", playerId: "player_1" });
    command(current.id, { type: "castSpell", playerId: "player_2", cardId: "spell_coin" });
    const secondTroop = command(current.id, { type: "playTroop", playerId: "player_2", cardId: "troop_mana_goblin" });
    current = secondTroop.state;
    command(current.id, { type: "endTurn", playerId: "player_2" });
    command(current.id, {
      type: "attack",
      playerId: "player_1",
      attackerInstanceId: firstTroop.result.instanceId,
      target: { type: "troop", instanceId: secondTroop.result.instanceId }
    });
    return getMatch(current.id);
  }

  return { createDemoMatch, getMatch, command, runDemoScript, sessions };
}

module.exports = { DEMO_LOADOUT, createLocalBattleService };
