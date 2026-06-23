"use strict";

const { cardsById } = require("../data/cards");

const CORE_HP = 50;
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

function cardEffects(card, trigger = null) {
  const effects = card.effects || [];
  return trigger ? effects.filter((effect) => effect.trigger === trigger) : effects;
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
  const coreCard = cardOf(cardCatalog, loadout.coreCardId);
  assert(coreCard.type === "core", "Loadout core card must be a core.");
  return {
    id,
    seat,
    coreCardId: coreCard.id,
    coreHp: coreCard.hp || CORE_HP,
    baseMaxMana: 0,
    currentMana: 0,
    temporaryMana: 0,
    coinAvailable: seat === 2,
    pendingSpellCounters: 0,
    pendingSpellReflects: 0,
    firstSpellDiscountUsedTurn: null,
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
    troop.maxHp = troop.maxHp || card.hp;
    troop.currentDefense = effectiveDefense(card, troop);
  }
}

function activeEffectSources(player, cardCatalog) {
  const sources = [];
  const core = cardOf(cardCatalog, player.coreCardId || "core_starter");
  sources.push({ card: core, instance: null, owner: player, sourceType: "core" });
  for (const troop of player.troops) {
    sources.push({ card: cardOf(cardCatalog, troop.cardId), instance: troop, owner: player, sourceType: "troop" });
  }
  for (const enchantment of player.enchantments) {
    sources.push({ card: cardOf(cardCatalog, enchantment.cardId), instance: enchantment, owner: player, sourceType: "enchantment" });
  }
  return sources;
}

function activeEffects(player, cardCatalog, trigger = null) {
  return activeEffectSources(player, cardCatalog).flatMap((source) => {
    return cardEffects(source.card, trigger).map((effect) => ({ ...effect, source }));
  });
}

function sumActiveEffects(player, cardCatalog, type) {
  return activeEffects(player, cardCatalog, "static")
    .filter((effect) => effect.type === type)
    .reduce((sum, effect) => sum + (effect.amount || 0), 0);
}

function effectiveMaxMana(player, cardCatalog) {
  return BASE_MANA_CAP + sumActiveEffects(player, cardCatalog, "maxManaIncrease");
}

function effectiveAttack(card, troop) {
  return Math.max(0, (card.attack || 0) + (troop.attackBuff || 0));
}

function effectiveDefense(card, troop) {
  return Math.max(0, (card.defense || 0) + (troop.defenseBuff || 0));
}

function healCore(player, amount, cardCatalog) {
  const core = cardOf(cardCatalog, player.coreCardId || "core_starter");
  player.coreHp = Math.min(core.hp || CORE_HP, player.coreHp + amount);
  return { healed: amount, coreHp: player.coreHp };
}

function gainMana(player, amount, temporary = true) {
  if (temporary) player.temporaryMana += amount;
  player.currentMana += amount;
  return { manaGained: amount, temporary };
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
  player.currentMana = Math.min(effectiveMaxMana(player, cardCatalog), player.baseMaxMana + sumActiveEffects(player, cardCatalog, "maxManaIncrease"));

  for (const troop of player.troops) {
    troop.canAttack = true;
    troop.attacksThisTurn = 0;
  }

  const startEffects = activeEffects(player, cardCatalog, "startTurn").filter((effect) => effect.ownerOnly);
  const startResults = [];
  for (const effect of startEffects) {
    startResults.push(resolveEffect(state, player, effect, { cardCatalog, sourceCard: effect.source.card }));
  }

  addEvent(state, "turn_started", player.id, {
    reason,
    maxMana: player.baseMaxMana,
    effectiveMaxMana: effectiveMaxMana(player, cardCatalog),
    currentMana: player.currentMana,
    effects: startResults
  });
  checkWinner(state);
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
    maxHp: card.hp,
    attackBuff: 0,
    defenseBuff: 0,
    currentDefense: effectiveDefense(card, { attackBuff: 0, defenseBuff: 0 }),
    canAttack: hasPerk(card, "haste"),
    attacksThisTurn: 0,
    playedTurn: state.turnNumber
  };
  player.troops.push(troop);
  const effects = [
    ...cardEffects(card, "onPlay").map((effect) => resolveEffect(state, player, effect, { cardCatalog, sourceCard: card, sourceInstance: troop })),
    ...runTriggeredEffects(state, player, "onPlayTroop", { cardCatalog, playedCard: card, playedTroop: troop })
  ];
  addEvent(state, "troop_played", player.id, { cardId, instanceId: troop.instanceId, manaSpent: card.manaCost, effects });
  checkWinner(state);
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

function damageTroop(state, lookup, amount, cardCatalog, options = {}) {
  const troop = lookup.troop;
  let result;
  if (options.trueDamage) {
    troop.hp -= amount;
    result = { damage: amount, absorbed: 0, hp: troop.hp };
  } else {
    result = applyDefendedDamage(troop, amount);
  }
  if (troop.hp <= 0) destroyTroop(state, lookup.owner, troop, cardCatalog);
  return { targetType: "troop", targetInstanceId: troop.instanceId, ...result, hp: troop.hp };
}

function damageEnchantment(state, lookup, amount, cardCatalog, options = {}) {
  const owner = lookup.owner;
  let damage = amount;
  if (!options.trueDamage) {
    for (const effect of activeEffects(owner, cardCatalog, "static")) {
      if (effect.type === "enchantmentDamageMultiplier") damage = Math.max(1, Math.ceil(damage * effect.multiplier));
      if (effect.type === "enchantmentDamageReduction") damage = Math.max(1, damage - (effect.amount || 0));
    }
  }
  lookup.enchantment.hp -= damage;
  const result = { targetType: "enchantment", targetInstanceId: lookup.enchantment.instanceId, damage, hp: lookup.enchantment.hp };
  if (lookup.enchantment.hp <= 0) destroyEnchantment(state, owner, lookup.enchantment, cardCatalog);
  return result;
}

function damageCore(state, sourcePlayer, targetPlayer, amount, cardCatalog, options = {}) {
  let damage = amount;
  if (!options.trueDamage) {
    damage = Math.max(0, damage - sumActiveEffects(targetPlayer, cardCatalog, "coreDamageReduction"));
  }
  targetPlayer.coreHp -= damage;
  const result = { targetType: "core", targetPlayerId: targetPlayer.id, damage, coreHp: targetPlayer.coreHp };
  checkWinner(state);
  return result;
}

function targetLookupFromTarget(state, playerId, target) {
  const opponent = getOpponent(state, playerId);
  if (!target || target.type === "core") return { kind: "core", player: target?.playerId ? getPlayer(state, target.playerId) : opponent };
  if (target.type === "troop") {
    const lookup = findPlayerTroop(state, target.instanceId);
    assert(lookup, "Troop target not found.");
    return { kind: "troop", lookup };
  }
  if (target.type === "enchantment") {
    const lookup = findPlayerEnchantment(state, target.instanceId);
    assert(lookup, "Enchantment target not found.");
    return { kind: "enchantment", lookup };
  }
  throw new BattleRuleError("Invalid target.");
}

function buffTroop(troop, { attack = 0, defense = 0, hp = 0 }, cardCatalog) {
  const card = cardOf(cardCatalog, troop.cardId);
  troop.attackBuff = (troop.attackBuff || 0) + attack;
  troop.defenseBuff = (troop.defenseBuff || 0) + defense;
  troop.maxHp = (troop.maxHp || card.hp) + hp;
  troop.hp += hp;
  if (defense) troop.currentDefense = Math.max(0, (troop.currentDefense || 0) + defense);
  return { instanceId: troop.instanceId, attackBuff: troop.attackBuff || 0, defenseBuff: troop.defenseBuff || 0, hp: troop.hp };
}

function matchingTroops(player, selector, context, cardCatalog) {
  if (selector === "self" && context.sourceInstance?.cardId) return [context.sourceInstance];
  if (selector === "playedFaction") {
    const playedCard = context.playedCard;
    if (!playedCard || playedCard.faction !== context.effect.faction) return [];
    return context.playedTroop ? [context.playedTroop] : [];
  }
  if (selector === "friendlyFaction") {
    return player.troops.filter((troop) => cardOf(cardCatalog, troop.cardId).faction === context.effect.faction);
  }
  if (selector === "allFriendly") return player.troops;
  return [];
}

function adjustCooldowns(player, amount, target, context = {}) {
  const changed = [];
  if (target === "ownAll" || target === "opponentAll") {
    for (const entry of player.roster) {
      if (entry.zone === "cooldown") {
        entry.cooldownRemaining = Math.max(0, entry.cooldownRemaining + amount);
        if (entry.cooldownRemaining === 0) entry.zone = "ready";
        changed.push(entry.cardId);
      }
    }
    for (const [cardId, remaining] of Object.entries(player.spellCooldowns)) {
      const next = Math.max(0, remaining + amount);
      if (next === 0) delete player.spellCooldowns[cardId];
      else player.spellCooldowns[cardId] = next;
      changed.push(cardId);
    }
  }
  if (target === "ownTroops") {
    for (const entry of player.roster) {
      if (entry.zone === "cooldown") {
        entry.cooldownRemaining = Math.max(0, entry.cooldownRemaining + amount);
        if (entry.cooldownRemaining === 0) entry.zone = "ready";
        changed.push(entry.cardId);
      }
    }
  }
  if (target === "opponentSpells") {
    for (const [cardId, remaining] of Object.entries(player.spellCooldowns)) {
      player.spellCooldowns[cardId] = Math.max(1, remaining + amount);
      changed.push(cardId);
    }
  }
  if (target === "destroyedTroop" && context.destroyedRosterEntry) {
    context.destroyedRosterEntry.cooldownRemaining = Math.max(0, context.destroyedRosterEntry.cooldownRemaining + amount);
    if (context.destroyedRosterEntry.cooldownRemaining === 0) context.destroyedRosterEntry.zone = "ready";
    changed.push(context.destroyedRosterEntry.cardId);
  }
  return { cooldownChanged: changed, amount };
}

function resolveEffect(state, player, effect, context = {}) {
  const cardCatalog = context.cardCatalog || cardsById;
  const opponent = getOpponent(state, player.id);
  const reflected = context.reflected;
  const sourceCard = context.sourceCard || effect.source?.card;
  switch (effect.type) {
    case "damage":
    case "trueDamage": {
      const trueDamage = effect.type === "trueDamage" || context.trueDamage;
      if (effect.target === "enemyCore") {
        return damageCore(state, player, reflected ? player : opponent, effect.amount, cardCatalog, { trueDamage });
      }
      const targetInfo = targetLookupFromTarget(state, player.id, context.target);
      if (effect.target === "targetOrEnemyCore" && targetInfo.kind === "core") return damageCore(state, player, reflected ? player : targetInfo.player, effect.amount, cardCatalog, { trueDamage });
      if (targetInfo.kind === "troop") return damageTroop(state, targetInfo.lookup, effect.amount, cardCatalog, { trueDamage });
      if (targetInfo.kind === "enchantment") return damageEnchantment(state, targetInfo.lookup, effect.amount, cardCatalog, { trueDamage });
      return damageCore(state, player, reflected ? player : opponent, effect.amount, cardCatalog, { trueDamage });
    }
    case "trueDamageSelfCore":
      return damageCore(state, player, player, effect.amount, cardCatalog, { trueDamage: true });
    case "heal":
      if (context.target?.type === "troop") {
        const lookup = findPlayerTroop(state, context.target.instanceId);
        assert(lookup && lookup.owner.id === player.id, "Friendly troop target not found.");
        const card = cardOf(cardCatalog, lookup.troop.cardId);
        lookup.troop.hp = Math.min(lookup.troop.maxHp || card.hp, lookup.troop.hp + effect.amount);
        return { healed: effect.amount, hp: lookup.troop.hp };
      }
      return healCore(player, effect.amount, cardCatalog);
    case "healCore":
      return healCore(player, effect.amount, cardCatalog);
    case "manaGain":
      return gainMana(player, effect.amount, effect.temporary !== false);
    case "statBuff": {
      const targets = matchingTroops(player, effect.selector, { ...context, effect, sourceInstance: effect.source?.instance || context.sourceInstance }, cardCatalog);
      return { buffed: targets.map((troop) => buffTroop(troop, effect, cardCatalog)) };
    }
    case "lifesteal": {
      const amount = effect.amount || context.attackResult?.damage || 0;
      return healCore(player, amount, cardCatalog);
    }
    case "trampleCoreDamage":
      return damageCore(state, player, opponent, effect.amount || 1, cardCatalog);
    case "destroyTroop": {
      assert(context.target?.type === "troop", "Spell requires a troop target.");
      const lookup = findPlayerTroop(state, context.target.instanceId);
      assert(lookup, "Troop target not found.");
      const destroyedCard = cardOf(cardCatalog, lookup.troop.cardId);
      destroyTroop(state, lookup.owner, lookup.troop, cardCatalog);
      context.destroyedCard = destroyedCard;
      return { destroyedInstanceId: context.target.instanceId, destroyedCardId: destroyedCard.id };
    }
    case "destroyEnchantment": {
      assert(context.target?.type === "enchantment", "Spell requires an enchantment target.");
      const lookup = findPlayerEnchantment(state, context.target.instanceId);
      assert(lookup && lookup.owner.id === opponent.id, "Enemy enchantment target not found.");
      destroyEnchantment(state, lookup.owner, lookup.enchantment, cardCatalog);
      return { destroyedInstanceId: context.target.instanceId };
    }
    case "manaGainFromDestroyedCost": {
      const amount = context.destroyedCard?.manaCost || 0;
      return gainMana(player, amount, effect.temporary !== false);
    }
    case "spellCounter":
      player.pendingSpellCounters += effect.amount || 1;
      return { pendingSpellCounters: player.pendingSpellCounters };
    case "spellReflection":
      player.pendingSpellReflects += effect.amount || 1;
      return { pendingSpellReflects: player.pendingSpellReflects };
    case "cooldownIncrease":
      return adjustCooldowns(effect.target?.startsWith("opponent") ? opponent : player, effect.amount || 1, effect.target, context);
    case "cooldownReduction":
      return adjustCooldowns(player, -(effect.amount || 1), effect.target, context);
    case "damageAllTroops": {
      const results = [];
      for (const targetPlayer of state.players) {
        for (const troop of [...targetPlayer.troops]) results.push(damageTroop(state, { owner: targetPlayer, troop }, effect.amount, cardCatalog));
      }
      return { damaged: results };
    }
    case "damageAllEnemies": {
      const results = [];
      for (const troop of [...opponent.troops]) results.push(damageTroop(state, { owner: opponent, troop }, effect.amount, cardCatalog));
      return { damaged: results };
    }
    case "manaGainForFaction":
      if (sourceCard?.faction === effect.faction || context.triggerCard?.faction === effect.faction || context.playedCard?.faction === effect.faction) return gainMana(player, effect.amount, effect.temporary !== false);
      return { skipped: true };
    default:
      return { effect: effect.type, skipped: true };
  }
}

function runTriggeredEffects(state, player, trigger, context = {}) {
  const cardCatalog = context.cardCatalog || cardsById;
  const results = [];
  for (const effect of activeEffects(player, cardCatalog, trigger)) {
    if (trigger === "death" && effect.source?.sourceType === "troop") continue;
    if (effect.ownerOnly && context.ownerOnly === false) continue;
    results.push(resolveEffect(state, player, effect, { ...context, cardCatalog, triggerCard: context.sourceCard, sourceCard: effect.source.card }));
  }
  return results;
}

function destroyTroop(state, owner, troop, cardCatalog) {
  const card = cardOf(cardCatalog, troop.cardId);
  owner.troops = owner.troops.filter((item) => item.instanceId !== troop.instanceId);
  const rosterEntry = owner.roster.find((entry) => entry.rosterId === troop.rosterId);
  assert(rosterEntry, "Troop roster entry missing.");
  rosterEntry.zone = "cooldown";
  rosterEntry.cooldownRemaining = card.cooldown;
  const deathContext = { cardCatalog, destroyedCard: card, destroyedTroop: troop, destroyedRosterEntry: rosterEntry };
  const effects = [
    ...cardEffects(card, "death").map((effect) => resolveEffect(state, owner, effect, { ...deathContext, sourceCard: card })),
    ...runTriggeredEffects(state, owner, "death", deathContext)
  ];
  addEvent(state, "troop_defeated", owner.id, {
    cardId: troop.cardId,
    instanceId: troop.instanceId,
    cooldown: rosterEntry.cooldownRemaining,
    effects
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
  const attackEffects = cardEffects(attackerCard, "onAttack");
  let attackValue = effectiveAttack(attackerCard, troop);
  for (const effect of activeEffects(owner, cardCatalog, "onAttack")) {
    if (effect.type === "coreAttackBonus" && attackerCard.faction === effect.faction) attackValue += effect.amount || 0;
  }
  let result;

  if (target.type === "core") {
    assert(target.playerId === opponent.id, "Troops may only attack the enemy core.");
    result = damageCore(state, owner, opponent, attackValue, cardCatalog);
  } else if (target.type === "troop") {
    const targetLookup = findPlayerTroop(state, target.instanceId);
    assert(targetLookup && targetLookup.owner.id === opponent.id, "Enemy troop target not found.");
    result = damageTroop(state, targetLookup, attackValue, cardCatalog);
  } else if (target.type === "enchantment") {
    const targetLookup = findPlayerEnchantment(state, target.instanceId);
    assert(targetLookup && targetLookup.owner.id === opponent.id, "Enemy enchantment target not found.");
    const bonus = attackEffects
      .filter((effect) => effect.type === "enchantmentDamageBonus")
      .reduce((sum, effect) => sum + (effect.amount || 0), 0);
    result = damageEnchantment(state, targetLookup, attackValue + bonus, cardCatalog);
    if (targetLookup.owner.enchantments.some((item) => item.instanceId === target.instanceId)) {
      for (const effect of attackEffects.filter((item) => item.type === "destroyEnchantmentOnHit")) {
        destroyEnchantment(state, targetLookup.owner, targetLookup.enchantment, cardCatalog);
        result.destroyedByEffect = effect.type;
      }
    }
  } else {
    throw new BattleRuleError("Invalid attack target.");
  }

  const triggeredEffects = attackEffects
    .filter((effect) => !["enchantmentDamageBonus", "destroyEnchantmentOnHit"].includes(effect.type))
    .map((effect) => resolveEffect(state, owner, effect, { cardCatalog, sourceCard: attackerCard, sourceInstance: troop, target, attackResult: result }));

  troop.canAttack = false;
  troop.attacksThisTurn += 1;
  addEvent(state, "troop_attacked", playerId, {
    attackerInstanceId,
    attackerCardId: troop.cardId,
    target,
    result,
    effects: triggeredEffects
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

function spellCostFor(state, player, card, cardCatalog) {
  const opponent = getOpponent(state, player.id);
  let cost = card.manaCost + sumActiveEffects(opponent, cardCatalog, "enemySpellCostIncrease");
  const discount = sumActiveEffects(player, cardCatalog, "firstSpellDiscount");
  if (discount > 0 && player.firstSpellDiscountUsedTurn !== state.turnNumber) {
    cost = Math.max(0, cost - discount);
  }
  return cost;
}

function markSpellDiscountUsed(state, player, cardCatalog) {
  if (sumActiveEffects(player, cardCatalog, "firstSpellDiscount") > 0 && player.firstSpellDiscountUsedTurn !== state.turnNumber) {
    player.firstSpellDiscountUsedTurn = state.turnNumber;
    return true;
  }
  return false;
}

function consumeSpellCounter(state, caster, cardCatalog) {
  const opponent = getOpponent(state, caster.id);
  if (opponent.pendingSpellCounters > 0) {
    opponent.pendingSpellCounters -= 1;
    return { countered: true, source: "pending_counter" };
  }
  const barrier = opponent.enchantments.find((enchantment) => {
    const card = cardOf(cardCatalog, enchantment.cardId);
    return cardEffects(card, "static").some((effect) => effect.type === "spellCounterFirstEachTurn") &&
      enchantment.lastCounterTurn !== state.turnNumber;
  });
  if (barrier) {
    barrier.lastCounterTurn = state.turnNumber;
    return { countered: true, source: barrier.cardId };
  }
  return null;
}

function consumeSpellReflection(state, caster) {
  const opponent = getOpponent(state, caster.id);
  if (opponent.pendingSpellReflects > 0) {
    opponent.pendingSpellReflects -= 1;
    return { reflected: true, source: "pending_reflection" };
  }
  return null;
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
  const manaSpent = spellCostFor(state, player, card, cardCatalog);
  spendMana(player, manaSpent);
  const discountUsed = markSpellDiscountUsed(state, player, cardCatalog);
  setSpellCooldown(player, card);

  const counter = cardId === "spell_coin" ? null : consumeSpellCounter(state, player, cardCatalog);
  const reflection = counter ? null : consumeSpellReflection(state, player);
  const effectContext = { cardCatalog, sourceCard: card, target, reflected: Boolean(reflection) };
  const effectResults = counter ? [] : cardEffects(card, "spell").map((effect) => resolveEffect(state, player, effect, effectContext));
  const triggeredEffects = counter ? [] : runTriggeredEffects(state, player, "onSpellCast", { cardCatalog, sourceCard: card, target });
  const result = counter
    ? { countered: true, source: counter.source }
    : { effects: effectResults, triggeredEffects, reflected: Boolean(reflection), reflectionSource: reflection?.source || null };

  addEvent(state, "spell_cast", player.id, { cardId, target, manaSpent, cooldown: card.cooldown, discountUsed, result });
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
