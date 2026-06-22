"use strict";

const { cardsById } = require("../data/cards");

const CORE_HP = 300;
const BASE_MANA_CAP = 10;

class BattleRuleError extends Error {
  constructor(message) {
    super(message);
    this.name = "BattleRuleError";
    this.status = 400;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasPerk(card, perk) {
  return (card.perks || []).some((item) => String(item).toLowerCase().includes(perk.toLowerCase()));
}

function assert(condition, message) {
  if (!condition) throw new BattleRuleError(message);
}

function makeRoster(loadoutCards, cardCatalog) {
  const roster = [];
  let index = 1;
  for (const [cardId, quantity] of Object.entries(loadoutCards)) {
    const card = cardCatalog.get(cardId);
    assert(card, `Unknown card ${cardId}.`);
    assert(card.type !== "core", "Core cards do not belong in the playable roster.");
    for (let copy = 1; copy <= quantity; copy += 1) {
      roster.push({
        rosterId: `r${index}`,
        cardId,
        zone: "ready",
        cooldownRemaining: 0
      });
      index += 1;
    }
  }
  return roster;
}

function createPlayerState({ id, loadout }, seat, cardCatalog) {
  return {
    id,
    seat,
    coreHp: CORE_HP,
    baseMaxMana: 0,
    currentMana: 0,
    temporaryMana: 0,
    coinAvailable: seat === 2,
    roster: makeRoster(loadout.cards, cardCatalog),
    troops: [],
    enchantments: [],
    spellCooldowns: {}
  };
}

function createMatch({ player1, player2, seed = "local" }, options = {}) {
  const cardCatalog = options.cardCatalog || cardsById;
  const state = {
    id: options.matchId || `match_${seed}`,
    status: "active",
    winnerId: null,
    turnNumber: 0,
    activePlayerId: null,
    priorityPlayerId: null,
    nextInstanceNumber: 1,
    eventLog: [],
    players: [
      createPlayerState(player1, 1, cardCatalog),
      createPlayerState(player2, 2, cardCatalog)
    ]
  };

  startTurn(state, state.players[0].id, cardCatalog, "match_start");
  return state;
}

function getPlayer(state, playerId) {
  const player = state.players.find((item) => item.id === playerId);
  assert(player, `Player ${playerId} is not in this match.`);
  return player;
}

function getOpponent(state, playerId) {
  const opponent = state.players.find((item) => item.id !== playerId);
  assert(opponent, "Opponent not found.");
  return opponent;
}

function requireActivePlayer(state, playerId) {
  assert(state.status === "active", "Match is not active.");
  assert(state.activePlayerId === playerId, "It is not this player's turn.");
}

function cardOf(cardCatalog, cardId) {
  const card = cardCatalog.get(cardId);
  assert(card, `Unknown card ${cardId}.`);
  return card;
}

function findReadyRosterCard(player, cardId) {
  return player.roster.find((entry) => entry.cardId === cardId && entry.zone === "ready");
}

function findPlayerTroop(state, instanceId) {
  for (const player of state.players) {
    const troop = player.troops.find((item) => item.instanceId === instanceId);
    if (troop) return { owner: player, troop };
  }
  return null;
}

function findPlayerEnchantment(state, instanceId) {
  for (const player of state.players) {
    const enchantment = player.enchantments.find((item) => item.instanceId === instanceId);
    if (enchantment) return { owner: player, enchantment };
  }
  return null;
}

function makeInstanceId(state, prefix) {
  const id = `${prefix}${state.nextInstanceNumber}`;
  state.nextInstanceNumber += 1;
  return id;
}

function addEvent(state, type, playerId, payload = {}) {
  const event = {
    sequence: state.eventLog.length + 1,
    turnNumber: state.turnNumber,
    type,
    playerId,
    payload: clone(payload)
  };
  state.eventLog.push(event);
  return event;
}

function spendMana(player, amount) {
  assert(amount >= 0, "Mana cost cannot be negative.");
  assert(player.currentMana >= amount, "Not enough mana.");
  player.currentMana -= amount;
}

function tickCooldowns(player) {
  for (const rosterEntry of player.roster) {
    if (rosterEntry.zone === "cooldown") {
      rosterEntry.cooldownRemaining = Math.max(0, rosterEntry.cooldownRemaining - 1);
      if (rosterEntry.cooldownRemaining === 0) {
        rosterEntry.zone = "ready";
      }
    }
  }

  for (const [cardId, remaining] of Object.entries(player.spellCooldowns)) {
    const next = Math.max(0, remaining - 1);
    if (next === 0) delete player.spellCooldowns[cardId];
    else player.spellCooldowns[cardId] = next;
  }
}

function regenerateDefense(player, cardCatalog) {
  for (const troop of player.troops) {
    const card = cardOf(cardCatalog, troop.cardId);
    troop.currentDefense = card.defense || 0;
  }
}

function startTurn(state, playerId, cardCatalog, reason = "turn_start") {
  const player = getPlayer(state, playerId);
  state.turnNumber += 1;
  state.activePlayerId = player.id;
  state.priorityPlayerId = player.id;

  tickCooldowns(player);
  regenerateDefense(player, cardCatalog);
  player.baseMaxMana = Math.min(BASE_MANA_CAP, player.baseMaxMana + 1);
  player.temporaryMana = 0;
  player.currentMana = player.baseMaxMana;

  for (const troop of player.troops) {
    troop.canAttack = true;
    troop.attacksThisTurn = 0;
  }

  addEvent(state, "turn_started", player.id, {
    reason,
    maxMana: player.baseMaxMana,
    currentMana: player.currentMana
  });
}

function endTurn(state, playerId, cardCatalog) {
  requireActivePlayer(state, playerId);
  const player = getPlayer(state, playerId);
  player.currentMana = Math.max(0, player.currentMana - player.temporaryMana);
  player.temporaryMana = 0;
  addEvent(state, "turn_ended", player.id);
  startTurn(state, getOpponent(state, playerId).id, cardCatalog, "turn_passed");
  return state;
}

function playTroop(state, playerId, cardId, options = {}) {
  const cardCatalog = options.cardCatalog || cardsById;
  requireActivePlayer(state, playerId);
  const player = getPlayer(state, playerId);
  const card = cardOf(cardCatalog, cardId);
  assert(card.type === "troop", `${card.name} is not a troop.`);
  const rosterEntry = findReadyRosterCard(player, cardId);
  assert(rosterEntry, `${card.name} is not ready in the roster.`);
  spendMana(player, card.manaCost);

  rosterEntry.zone = "battlefield";
  const troop = {
    instanceId: makeInstanceId(state, "t"),
    rosterId: rosterEntry.rosterId,
    cardId,
    ownerId: player.id,
    hp: card.hp,
    currentDefense: card.defense || 0,
    canAttack: hasPerk(card, "haste"),
    attacksThisTurn: 0,
    playedTurn: state.turnNumber
  };
  player.troops.push(troop);
  addEvent(state, "troop_played", player.id, { cardId, instanceId: troop.instanceId, manaSpent: card.manaCost });
  return troop;
}

function calculateDamage(attack, defense) {
  return Math.max(1, attack - defense);
}

function applyDefendedDamage(target, attack) {
  const absorbed = Math.min(target.currentDefense || 0, attack);
  const damage = calculateDamage(attack, target.currentDefense || 0);
  target.currentDefense = Math.max(0, (target.currentDefense || 0) - absorbed);
  target.hp -= damage;
  return { damage, absorbed };
}

function destroyTroop(state, owner, troop, cardCatalog) {
  const card = cardOf(cardCatalog, troop.cardId);
  owner.troops = owner.troops.filter((item) => item.instanceId !== troop.instanceId);
  const rosterEntry = owner.roster.find((entry) => entry.rosterId === troop.rosterId);
  assert(rosterEntry, "Troop roster entry missing.");
  rosterEntry.zone = "cooldown";
  rosterEntry.cooldownRemaining = card.cooldown;
  addEvent(state, "troop_defeated", owner.id, {
    cardId: troop.cardId,
    instanceId: troop.instanceId,
    cooldown: card.cooldown
  });
}

function destroyEnchantment(state, owner, enchantment, cardCatalog) {
  const card = cardOf(cardCatalog, enchantment.cardId);
  owner.enchantments = owner.enchantments.filter((item) => item.instanceId !== enchantment.instanceId);
  const rosterEntry = owner.roster.find((entry) => entry.rosterId === enchantment.rosterId);
  assert(rosterEntry, "Enchantment roster entry missing.");
  rosterEntry.zone = "cooldown";
  rosterEntry.cooldownRemaining = card.cooldown;
  addEvent(state, "enchantment_destroyed", owner.id, {
    cardId: enchantment.cardId,
    instanceId: enchantment.instanceId,
    cooldown: card.cooldown
  });
}

function hasActiveArcaneShield(player) {
  return player.enchantments.some((item) => item.cardId === "enchant_arcane_shield");
}

function checkWinner(state) {
  for (const player of state.players) {
    if (player.coreHp <= 0) {
      state.status = "finished";
      state.winnerId = getOpponent(state, player.id).id;
      addEvent(state, "match_finished", state.winnerId, { winnerId: state.winnerId });
      return state.winnerId;
    }
  }
  return null;
}

function attack(state, playerId, attackerInstanceId, target, options = {}) {
  const cardCatalog = options.cardCatalog || cardsById;
  requireActivePlayer(state, playerId);
  const attackerLookup = findPlayerTroop(state, attackerInstanceId);
  assert(attackerLookup, "Attacking troop not found.");
  const { owner, troop } = attackerLookup;
  assert(owner.id === playerId, "Cannot attack with an enemy troop.");
  assert(troop.canAttack, "Troop cannot attack yet.");
  assert(troop.attacksThisTurn === 0, "Troop has already attacked this turn.");
  const attackerCard = cardOf(cardCatalog, troop.cardId);
  const opponent = getOpponent(state, playerId);
  let result;

  if (target.type === "core") {
    assert(target.playerId === opponent.id, "Troops may only attack the enemy core.");
    const damage = attackerCard.attack || 0;
    opponent.coreHp -= damage;
    result = { targetType: "core", targetPlayerId: opponent.id, damage, coreHp: opponent.coreHp };
  } else if (target.type === "troop") {
    const targetLookup = findPlayerTroop(state, target.instanceId);
    assert(targetLookup && targetLookup.owner.id === opponent.id, "Enemy troop target not found.");
    const damageResult = applyDefendedDamage(targetLookup.troop, attackerCard.attack || 0);
    result = { targetType: "troop", targetInstanceId: target.instanceId, ...damageResult, hp: targetLookup.troop.hp };
    if (targetLookup.troop.hp <= 0) destroyTroop(state, targetLookup.owner, targetLookup.troop, cardCatalog);
  } else if (target.type === "enchantment") {
    const targetLookup = findPlayerEnchantment(state, target.instanceId);
    assert(targetLookup && targetLookup.owner.id === opponent.id, "Enemy enchantment target not found.");
    let damage = attackerCard.attack || 0;
    if (hasActiveArcaneShield(targetLookup.owner)) damage = Math.max(1, Math.ceil(damage / 2));
    targetLookup.enchantment.hp -= damage;
    result = { targetType: "enchantment", targetInstanceId: target.instanceId, damage, hp: targetLookup.enchantment.hp };
    if (targetLookup.enchantment.hp <= 0) destroyEnchantment(state, targetLookup.owner, targetLookup.enchantment, cardCatalog);
  } else {
    throw new BattleRuleError("Invalid attack target.");
  }

  troop.canAttack = false;
  troop.attacksThisTurn += 1;
  addEvent(state, "troop_attacked", playerId, {
    attackerInstanceId,
    attackerCardId: troop.cardId,
    target,
    result
  });
  checkWinner(state);
  return result;
}

function playEnchantment(state, playerId, cardId, options = {}) {
  const cardCatalog = options.cardCatalog || cardsById;
  requireActivePlayer(state, playerId);
  const player = getPlayer(state, playerId);
  const card = cardOf(cardCatalog, cardId);
  assert(card.type === "enchantment", `${card.name} is not an enchantment.`);
  assert(player.enchantments.length < 3, "Only 3 enchantments may be active.");
  assert(!player.enchantments.some((item) => item.cardId === cardId), "The same enchantment is already active.");
  const rosterEntry = findReadyRosterCard(player, cardId);
  assert(rosterEntry, `${card.name} is not ready in the roster.`);
  spendMana(player, card.manaCost);

  rosterEntry.zone = "active_enchantment";
  const enchantment = {
    instanceId: makeInstanceId(state, "e"),
    rosterId: rosterEntry.rosterId,
    cardId,
    ownerId: player.id,
    hp: card.hp
  };
  player.enchantments.push(enchantment);
  addEvent(state, "enchantment_played", player.id, { cardId, instanceId: enchantment.instanceId, manaSpent: card.manaCost });
  return enchantment;
}

function setSpellCooldown(player, card) {
  player.spellCooldowns[card.id] = card.cooldown;
}

function castCoin(state, player) {
  assert(player.coinAvailable, "Coin has already been used.");
  player.coinAvailable = false;
  player.temporaryMana += 1;
  player.currentMana += 1;
  return { temporaryManaGained: 1 };
}

function destroyTargetEnchantmentBySpell(state, casterId, target, cardCatalog) {
  assert(target && target.type === "enchantment", "Spell requires an enchantment target.");
  const opponent = getOpponent(state, casterId);
  const lookup = findPlayerEnchantment(state, target.instanceId);
  assert(lookup && lookup.owner.id === opponent.id, "Enemy enchantment target not found.");
  destroyEnchantment(state, lookup.owner, lookup.enchantment, cardCatalog);
  return { destroyedInstanceId: target.instanceId };
}

function castSpell(state, playerId, cardId, target = null, options = {}) {
  const cardCatalog = options.cardCatalog || cardsById;
  requireActivePlayer(state, playerId);
  const player = getPlayer(state, playerId);

  if (cardId === "spell_coin") {
    const result = castCoin(state, player);
    addEvent(state, "spell_cast", player.id, { cardId, result });
    return result;
  }

  const card = cardOf(cardCatalog, cardId);
  assert(card.type === "spell", `${card.name} is not a spell.`);
  assert(!player.spellCooldowns[cardId], `${card.name} is on cooldown.`);
  assert(player.roster.some((entry) => entry.cardId === cardId), `${card.name} is not in this player's loadout.`);
  spendMana(player, card.manaCost);

  let result = {};
  if (cardId === "spell_sit") {
    const opponent = getOpponent(state, playerId);
    opponent.coreHp -= 100;
    result = { targetType: "core", damage: 100, coreHp: opponent.coreHp };
  } else if (cardId === "spell_disenchant") {
    result = destroyTargetEnchantmentBySpell(state, playerId, target, cardCatalog);
  } else if (cardId === "spell_emergency_funding") {
    player.temporaryMana += 3;
    player.currentMana += 3;
    player.coreHp -= 25;
    result = { temporaryManaGained: 3, selfCoreDamage: 25, coreHp: player.coreHp };
  } else {
    result = { effect: "cooldown_only" };
  }

  setSpellCooldown(player, card);
  addEvent(state, "spell_cast", player.id, { cardId, target, manaSpent: card.manaCost, cooldown: card.cooldown, result });
  checkWinner(state);
  return result;
}

function applyCommand(state, command, options = {}) {
  const cardCatalog = options.cardCatalog || cardsById;
  switch (command.type) {
    case "playTroop":
      return playTroop(state, command.playerId, command.cardId, { cardCatalog });
    case "attack":
      return attack(state, command.playerId, command.attackerInstanceId, command.target, { cardCatalog });
    case "castSpell":
      return castSpell(state, command.playerId, command.cardId, command.target, { cardCatalog });
    case "playEnchantment":
      return playEnchantment(state, command.playerId, command.cardId, { cardCatalog });
    case "endTurn":
      return endTurn(state, command.playerId, cardCatalog);
    default:
      throw new BattleRuleError(`Unknown command type ${command.type}.`);
  }
}

module.exports = {
  BASE_MANA_CAP,
  CORE_HP,
  BattleRuleError,
  applyCommand,
  attack,
  calculateDamage,
  castSpell,
  createMatch,
  endTurn,
  playEnchantment,
  playTroop
};
