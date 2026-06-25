"use strict";

const { cardsById } = require("../data/cards");
const { applyCommand, createMatch } = require("../domain/battleEngine");
const { validateLoadout } = require("../domain/loadouts");
const { makeId, nowIso } = require("../store/memoryStore");

const WIN_REWARD_COINS = 100;
const LOSS_REWARD_COINS = 25;
const MATCH_REWARDS = {
  friend: { win: WIN_REWARD_COINS, loss: LOSS_REWARD_COINS },
  casual: { win: 50, loss: 10 },
  ranked: { win: 100, loss: 25 }
};
const STARTING_RATING = 1000;
const RANKED_WIN_DELTA = 25;
const RANKED_LOSS_DELTA = -15;
const DEFAULT_DISCONNECT_TIMEOUT_MS = 30000;
const DEFAULT_STALE_MATCH_MS = 24 * 60 * 60 * 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function publicProfile(store, userId) {
  const profile = store.profiles.get(userId);
  return {
    userId,
    username: profile?.username || profile?.displayName || userId,
    displayName: profile?.displayName || userId,
    friendCode: profile?.friendCode || null
  };
}

function rankTierForRating(rating) {
  if (rating >= 2300) return "Bababooey";
  if (rating >= 2000) return "Grandmaster";
  if (rating >= 1800) return "Master";
  if (rating >= 1600) return "Diamond";
  if (rating >= 1400) return "Platinum";
  if (rating >= 1200) return "Gold";
  if (rating >= 1000) return "Silver";
  return "Bronze";
}

function serializeChallenge(store, challenge) {
  return {
    id: challenge.id,
    challenger: publicProfile(store, challenge.challengerId),
    challenged: publicProfile(store, challenge.challengedId),
    status: challenge.status,
    matchId: challenge.matchId,
    createdAt: challenge.createdAt,
    respondedAt: challenge.respondedAt
  };
}

function serializeOnlineMatch(store, match) {
  return {
    id: match.id,
    challengeId: match.challengeId,
    mode: match.mode || "friend",
    status: match.status,
    winnerId: match.winnerId,
    players: match.playerIds.map((id) => publicProfile(store, id)),
    connectedPlayerIds: Array.from(match.connectedPlayerIds || []),
    disconnectedPlayerIds: match.playerIds.filter((id) => !(match.connectedPlayerIds || new Set()).has(id)),
    state: clone(match.state),
    createdAt: match.createdAt,
    endedAt: match.endedAt
  };
}

function createOnlineMatchService(store, options = {}) {
  const cardCatalog = options.cardCatalog || cardsById;
  const disconnectTimeoutMs = options.disconnectTimeoutMs ?? DEFAULT_DISCONNECT_TIMEOUT_MS;
  const staleMatchMs = options.staleMatchMs ?? DEFAULT_STALE_MATCH_MS;
  const nowMs = options.nowMs || (() => Date.now());
  const listeners = new Map();
  const rateBuckets = new Map();
  if (!store.matchmakingQueues) store.matchmakingQueues = { casual: [], ranked: [] };

  function rateLimit(userId, action, limit, windowMs) {
    const key = `${userId}:${action}`;
    const now = nowMs();
    const bucket = (rateBuckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    if (bucket.length >= limit) {
      const error = new Error(`Rate limit exceeded for ${action}. Try again shortly.`);
      error.status = 429;
      throw error;
    }
    bucket.push(now);
    rateBuckets.set(key, bucket);
  }

  function persistStore() {
    if (typeof store.persist === "function") store.persist();
  }

  function logMatchCommand(match, userId, intent, result, status = "accepted") {
    const message = status === "accepted"
      ? `Match command accepted: ${intent?.type || "unknown"}.`
      : `Match command rejected: ${result?.message || "Unknown rejection."}`;
    const metadata = {
      matchId: match?.id || null,
      mode: match?.mode || null,
      commandType: intent?.type || null,
      status
    };
    console.log(`[match:${metadata.matchId || "none"}] ${message}`);
    if (typeof store.logError === "function") {
      store.logError({
        level: status === "accepted" ? "info" : "warn",
        scope: "match_command",
        message,
        status: result?.status || 200,
        userId,
        details: result?.details || null,
        metadata
      });
    }
  }

  function emit(userId, message) {
    const set = listeners.get(userId);
    if (!set) return;
    for (const listener of set) listener(message);
  }

  function emitToMatch(match, message) {
    for (const playerId of match.playerIds) emit(playerId, message);
  }

  function subscribe(userId, listener) {
    if (!listeners.has(userId)) listeners.set(userId, new Set());
    listeners.get(userId).add(listener);
    return () => listeners.get(userId)?.delete(listener);
  }

  function ownedCollection(playerId) {
    return Object.fromEntries(store.playerCards.get(playerId)?.entries() || []);
  }

  function ensureRating(playerId) {
    let rating = store.rankedRatings.get(playerId);
    if (!rating) {
      rating = {
        playerId,
        rating: STARTING_RATING,
        wins: 0,
        losses: 0,
        updatedAt: nowIso()
      };
      store.rankedRatings.set(playerId, rating);
      persistStore();
    }
    return rating;
  }

  function serializeRating(playerId) {
    const rating = ensureRating(playerId);
    return {
      playerId,
      rating: rating.rating,
      tier: rankTierForRating(rating.rating),
      wins: rating.wins,
      losses: rating.losses,
      updatedAt: rating.updatedAt
    };
  }

  function findActiveLoadout(playerId, context = "accepting a challenge") {
    const loadouts = Array.from(store.loadouts.values()).filter((loadout) => loadout.playerId === playerId);
    const loadout = loadouts.find((item) => item.isActive);
    if (!loadout) {
      const error = new Error(`Matchmaking blocked: save and activate a valid deck before ${context}.`);
      error.status = 400;
      throw error;
    }
    const validation = validateLoadout(
      {
        cards: loadout.cards,
        coreCardId: loadout.coreCardId,
        collection: ownedCollection(playerId)
      },
      store.cards
    );
    if (!validation.valid) {
      const error = new Error(`Matchmaking blocked: your active loadout needs fixes before ${context}. Open Loadouts and use Autofill if needed.`);
      error.status = 400;
      error.details = validation.errors;
      throw error;
    }
    return clone({
      id: loadout.id,
      name: loadout.name,
      coreCardId: loadout.coreCardId,
      cards: loadout.cards
    });
  }

  function activeMatchForPlayer(playerId) {
    return Array.from(store.onlineMatches.values()).find((match) => match.status === "active" && match.playerIds.includes(playerId));
  }

  function areFriends(a, b) {
    return Array.from(store.friendships.values()).some((friendship) => {
      return friendship.status === "accepted" &&
        ((friendship.requesterId === a && friendship.addresseeId === b) ||
          (friendship.requesterId === b && friendship.addresseeId === a));
    });
  }

  function sendChallenge(challengerId, challengedId) {
    rateLimit(challengerId, "friend_challenge", 5, 60_000);
    if (!store.users.has(challengedId)) {
      const error = new Error("Challenge failed: that player could not be found. Refresh your friends list and try again.");
      error.status = 404;
      throw error;
    }
    if (challengerId === challengedId) {
      const error = new Error("Challenge failed: you cannot challenge yourself.");
      error.status = 400;
      throw error;
    }
    if (!areFriends(challengerId, challengedId)) {
      const error = new Error("Challenge failed: both players must accept the friend request first.");
      error.status = 403;
      throw error;
    }

    const challenge = {
      id: makeId(),
      challengerId,
      challengedId,
      status: "pending",
      matchId: null,
      createdAt: nowIso(),
      respondedAt: null
    };
    store.friendChallenges.set(challenge.id, challenge);
    persistStore();
    emit(challengedId, { type: "challenge_received", challenge: serializeChallenge(store, challenge) });
    emit(challengerId, { type: "challenge_sent", challenge: serializeChallenge(store, challenge) });
    return serializeChallenge(store, challenge);
  }

  function listChallenges(userId) {
    return Array.from(store.friendChallenges.values())
      .filter((challenge) => challenge.challengerId === userId || challenge.challengedId === userId)
      .map((challenge) => serializeChallenge(store, challenge));
  }

  function declineChallenge(userId, challengeId) {
    const challenge = store.friendChallenges.get(challengeId);
    if (!challenge || challenge.challengedId !== userId || challenge.status !== "pending") {
      const error = new Error("Pending challenge not found.");
      error.status = 404;
      throw error;
    }
    challenge.status = "declined";
    challenge.respondedAt = nowIso();
    persistStore();
    const serialized = serializeChallenge(store, challenge);
    emit(challenge.challengerId, { type: "challenge_declined", challenge: serialized });
    emit(challenge.challengedId, { type: "challenge_declined", challenge: serialized });
    return serialized;
  }

  function persistNewEvents(match, previousLength) {
    const events = match.state.eventLog.slice(previousLength);
    for (const event of events) {
      store.onlineMatchEvents.push({
        matchId: match.id,
        sequence: event.sequence,
        turnNumber: event.turnNumber,
        eventType: event.type,
        playerId: event.playerId,
        payload: clone(event.payload),
        createdAt: nowIso()
      });
    }
  }

  function createOnlineMatch({ playerOneId, playerTwoId, mode = "friend", challengeId = null }) {
    const context = mode === "friend" ? "accepting a challenge" : `joining ${mode} queue`;
    const playerOneLoadout = findActiveLoadout(playerOneId, context);
    const playerTwoLoadout = findActiveLoadout(playerTwoId, context);
    const matchId = makeId();
    const battleState = createMatch(
      {
        player1: { id: playerOneId, loadout: playerOneLoadout },
        player2: { id: playerTwoId, loadout: playerTwoLoadout },
        seed: matchId
      },
      { cardCatalog, matchId }
    );

    const match = {
      id: matchId,
      challengeId,
      mode,
      status: "active",
      winnerId: null,
      playerIds: [playerOneId, playerTwoId],
      playerOneLoadout,
      playerTwoLoadout,
      state: battleState,
      connectedPlayerIds: new Set(),
      disconnectedAt: {},
      disconnectTimers: new Map(),
      rewarded: false,
      createdAt: nowIso(),
      endedAt: null
    };
    store.onlineMatches.set(match.id, match);
    persistNewEvents(match, 0);
    persistStore();
    return match;
  }

  function createMatchFromChallenge(challenge) {
    const match = createOnlineMatch({
      playerOneId: challenge.challengerId,
      playerTwoId: challenge.challengedId,
      mode: "friend",
      challengeId: challenge.id
    });
    challenge.matchId = match.id;
    persistStore();
    return match;
  }

  function acceptChallenge(userId, challengeId) {
    const challenge = store.friendChallenges.get(challengeId);
    if (!challenge || challenge.challengedId !== userId || challenge.status !== "pending") {
      const error = new Error("Pending challenge not found.");
      error.status = 404;
      throw error;
    }
    challenge.status = "accepted";
    challenge.respondedAt = nowIso();
    const match = createMatchFromChallenge(challenge);
    persistStore();
    const payload = serializeOnlineMatch(store, match);
    emitToMatch(match, { type: "match_created", match: payload });
    return payload;
  }

  function listMatches(userId) {
    return Array.from(store.onlineMatches.values())
      .filter((match) => match.playerIds.includes(userId))
      .map((match) => serializeOnlineMatch(store, match));
  }

  function removeFromQueues(userId) {
    for (const mode of ["casual", "ranked"]) {
      store.matchmakingQueues[mode] = (store.matchmakingQueues[mode] || []).filter((entry) => entry.playerId !== userId);
    }
  }

  function queueStatus(userId) {
    for (const mode of ["casual", "ranked"]) {
      const entry = (store.matchmakingQueues[mode] || []).find((item) => item.playerId === userId);
      if (entry) {
        return {
          status: "searching",
          mode,
          joinedAt: entry.joinedAt
        };
      }
    }
    const active = activeMatchForPlayer(userId);
    if (active && ["casual", "ranked"].includes(active.mode)) {
      return {
        status: "matched",
        mode: active.mode,
        matchId: active.id,
        joinedAt: null
      };
    }
    return { status: "idle", mode: null, joinedAt: null, matchId: null };
  }

  function serializeQueueStatus(userId) {
    const status = queueStatus(userId);
    if (status.mode === "ranked") status.rating = serializeRating(userId);
    return status;
  }

  function joinQueue(userId, mode) {
    if (!["casual", "ranked"].includes(mode)) {
      const error = new Error("Matchmaking failed: unsupported queue mode.");
      error.status = 400;
      throw error;
    }
    rateLimit(userId, "matchmaking_queue", 10, 60_000);
    findActiveLoadout(userId, `joining ${mode} queue`);
    if (mode === "ranked") ensureRating(userId);
    if (activeMatchForPlayer(userId)) {
      const error = new Error("Matchmaking failed: finish your active online match before joining another queue.");
      error.status = 400;
      throw error;
    }
    removeFromQueues(userId);
    const queue = store.matchmakingQueues[mode] || [];
    const opponent = queue.find((entry) => entry.playerId !== userId);
    if (!opponent) {
      const entry = { playerId: userId, joinedAt: nowIso() };
      store.matchmakingQueues[mode] = [...queue, entry];
      persistStore();
      const status = serializeQueueStatus(userId);
      emit(userId, { type: "queue_joined", queue: status });
      return { queue: status, match: null };
    }

    store.matchmakingQueues[mode] = queue.filter((entry) => entry.playerId !== opponent.playerId && entry.playerId !== userId);
    const match = createOnlineMatch({ playerOneId: opponent.playerId, playerTwoId: userId, mode });
    const serialized = serializeOnlineMatch(store, match);
    persistStore();
    emit(opponent.playerId, { type: "queue_matched", queue: serializeQueueStatus(opponent.playerId), match: serialized });
    emit(userId, { type: "queue_matched", queue: serializeQueueStatus(userId), match: serialized });
    emitToMatch(match, { type: "match_created", match: serialized });
    return { queue: serializeQueueStatus(userId), match: serialized };
  }

  function cancelQueue(userId) {
    const before = queueStatus(userId);
    removeFromQueues(userId);
    persistStore();
    const status = serializeQueueStatus(userId);
    emit(userId, { type: "queue_cancelled", previous: before, queue: status });
    return status;
  }

  function getMatch(userId, matchId) {
    const match = store.onlineMatches.get(matchId);
    if (!match || !match.playerIds.includes(userId)) {
      const error = new Error("Online match not found.");
      error.status = 404;
      throw error;
    }
    return serializeOnlineMatch(store, match);
  }

  function awardMatch(match) {
    if (match.rewarded || !["finished", "abandoned"].includes(match.status) || !match.winnerId) return;
    if (!match.playerIds.includes(match.winnerId)) {
      const error = new Error("Cannot award match with invalid winner.");
      error.status = 500;
      throw error;
    }
    if (store.matchHistory.some((entry) => entry.matchId === match.id)) {
      match.rewarded = true;
      persistStore();
      return;
    }
    if (store.coinTransactions.some((entry) => entry.sourceId === match.id && ["match_win_reward", "match_loss_reward"].includes(entry.reason))) {
      match.rewarded = true;
      persistStore();
      return;
    }
    match.rewarded = true;
    const mode = match.mode || "friend";
    const rewards = MATCH_REWARDS[mode] || MATCH_REWARDS.friend;
    const ratingChanges = {};
    if (mode === "ranked") {
      for (const playerId of match.playerIds) {
        const didWin = playerId === match.winnerId;
        const rating = ensureRating(playerId);
        const before = rating.rating;
        rating.rating = Math.max(0, rating.rating + (didWin ? RANKED_WIN_DELTA : RANKED_LOSS_DELTA));
        rating.wins += didWin ? 1 : 0;
        rating.losses += didWin ? 0 : 1;
        rating.updatedAt = nowIso();
        ratingChanges[playerId] = {
          before,
          after: rating.rating,
          tierBefore: rankTierForRating(before),
          tierAfter: rankTierForRating(rating.rating)
        };
      }
    }
    for (const playerId of match.playerIds) {
      const didWin = playerId === match.winnerId;
      const reward = didWin ? rewards.win : rewards.loss;
      store.addCoinTransaction({
        playerId,
        amount: reward,
        reason: didWin ? "match_win_reward" : "match_loss_reward",
        sourceId: match.id,
        metadata: { matchId: match.id, mode }
      });
      store.matchHistory.push({
        id: makeId(),
        matchId: match.id,
        mode,
        playerId,
        opponentId: match.playerIds.find((id) => id !== playerId),
        result: didWin ? "win" : "loss",
        rewardCoins: reward,
        ratingBefore: ratingChanges[playerId]?.before ?? null,
        ratingAfter: ratingChanges[playerId]?.after ?? null,
        rankTierBefore: ratingChanges[playerId]?.tierBefore ?? null,
        rankTierAfter: ratingChanges[playerId]?.tierAfter ?? null,
        createdAt: nowIso()
      });
    }
    persistStore();
  }

  function validateTarget(target) {
    if (!target || typeof target !== "object" || Array.isArray(target)) return false;
    if (target.type === "core") return typeof target.playerId === "string" && Object.keys(target).every((key) => ["type", "playerId"].includes(key));
    if (target.type === "troop" || target.type === "enchantment") {
      return typeof target.instanceId === "string" && Object.keys(target).every((key) => ["type", "instanceId"].includes(key));
    }
    return false;
  }

  function validateIntent(intent) {
    if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
      const error = new Error("Invalid command: command must be an object.");
      error.status = 400;
      throw error;
    }
    const allowed = {
      playTroop: ["type", "cardId"],
      playEnchantment: ["type", "cardId"],
      castSpell: ["type", "cardId", "target"],
      attack: ["type", "attackerInstanceId", "target"],
      endTurn: ["type"],
      forfeit: ["type"]
    };
    const allowedKeys = allowed[intent.type];
    if (!allowedKeys) {
      const error = new Error("Invalid command: unsupported command type.");
      error.status = 400;
      throw error;
    }
    const extraKeys = Object.keys(intent).filter((key) => !allowedKeys.includes(key) && key !== "playerId");
    if (extraKeys.length > 0) {
      const error = new Error(`Invalid command: unexpected field ${extraKeys[0]}.`);
      error.status = 400;
      throw error;
    }
    if (["playTroop", "playEnchantment", "castSpell"].includes(intent.type) && typeof intent.cardId !== "string") {
      const error = new Error("Invalid command: cardId is required.");
      error.status = 400;
      throw error;
    }
    if (intent.type === "attack") {
      if (typeof intent.attackerInstanceId !== "string") {
        const error = new Error("Invalid command: attackerInstanceId is required.");
        error.status = 400;
        throw error;
      }
      if (!validateTarget(intent.target)) {
        const error = new Error("Invalid command: attack target is malformed.");
        error.status = 400;
        throw error;
      }
    }
    if (intent.type === "castSpell" && intent.target !== undefined && !validateTarget(intent.target)) {
      const error = new Error("Invalid command: spell target is malformed.");
      error.status = 400;
      throw error;
    }
    return {
      type: intent.type,
      cardId: intent.cardId,
      attackerInstanceId: intent.attackerInstanceId,
      target: intent.target
    };
  }

  function finalizeMatch(match, status, winnerId) {
    if (match.status === "finished" || match.status === "abandoned") return;
    match.status = status;
    match.winnerId = winnerId;
    match.endedAt = nowIso();
    if (match.state.status !== "finished") {
      match.state.status = status;
      match.state.winnerId = winnerId;
      match.state.eventLog.push({
        sequence: match.state.eventLog.length + 1,
        turnNumber: match.state.turnNumber,
        type: status === "abandoned" ? "match_abandoned" : "match_finished",
        playerId: winnerId,
        payload: { winnerId }
      });
      persistNewEvents(match, match.state.eventLog.length - 1);
    }
    awardMatch(match);
    persistStore();
    emitToMatch(match, { type: "match_state", match: serializeOnlineMatch(store, match), result: { status, winnerId } });
  }

  function command(userId, matchId, intent) {
    rateLimit(userId, "match_command", 40, 10_000);
    const match = store.onlineMatches.get(matchId);
    if (!match || !match.playerIds.includes(userId)) {
      const error = new Error("Online match not found.");
      error.status = 404;
      logMatchCommand(null, userId, intent, error, "rejected");
      throw error;
    }
    if (match.status !== "active") {
      const error = new Error("Match is not active.");
      error.status = 400;
      logMatchCommand(match, userId, intent, error, "rejected");
      throw error;
    }
    const previousLength = match.state.eventLog.length;
    let safeIntent;
    try {
      safeIntent = validateIntent(intent);
    } catch (error) {
      logMatchCommand(match, userId, intent, error, "rejected");
      throw error;
    }
    const commandPayload = { ...safeIntent, playerId: userId };
    if (safeIntent.type === "forfeit") {
      const winnerId = match.playerIds.find((id) => id !== userId);
      match.state.eventLog.push({
        sequence: match.state.eventLog.length + 1,
        turnNumber: match.state.turnNumber,
        type: "match_forfeited",
        playerId: userId,
        payload: { winnerId, loserId: userId }
      });
      persistNewEvents(match, previousLength);
      finalizeMatch(match, "finished", winnerId);
      const serialized = serializeOnlineMatch(store, match);
      logMatchCommand(match, userId, safeIntent, { status: 200 }, "accepted");
      return { result: { type: "forfeit", winnerId }, match: serialized };
    }
    let result;
    try {
      result = applyCommand(match.state, commandPayload, { cardCatalog });
    } catch (error) {
      error.message = `Invalid command: ${error.message}`;
      logMatchCommand(match, userId, safeIntent, error, "rejected");
      throw error;
    }
    persistNewEvents(match, previousLength);
    if (match.state.status === "finished") {
      finalizeMatch(match, "finished", match.state.winnerId);
    }
    persistStore();
    const serialized = serializeOnlineMatch(store, match);
    emitToMatch(match, { type: "match_state", match: serialized, result: clone(result) });
    logMatchCommand(match, userId, safeIntent, { status: 200 }, "accepted");
    return { result: clone(result), match: serialized };
  }

  function markConnected(userId, matchId) {
    const match = store.onlineMatches.get(matchId);
    if (!match || !match.playerIds.includes(userId)) return null;
    if (match.disconnectTimers?.has(userId)) {
      clearTimeout(match.disconnectTimers.get(userId));
      match.disconnectTimers.delete(userId);
    }
    match.connectedPlayerIds.add(userId);
    delete match.disconnectedAt?.[userId];
    persistStore();
    const serialized = serializeOnlineMatch(store, match);
    emitToMatch(match, { type: "player_connected", playerId: userId, match: serialized });
    return serialized;
  }

  function markDisconnected(userId, matchId) {
    const match = store.onlineMatches.get(matchId);
    if (!match || !match.playerIds.includes(userId)) return null;
    match.connectedPlayerIds.delete(userId);
    match.disconnectedAt = match.disconnectedAt || {};
    match.disconnectedAt[userId] = nowIso();
    if (match.status === "active" && disconnectTimeoutMs >= 0) {
      match.disconnectTimers = match.disconnectTimers || new Map();
      if (match.disconnectTimers.has(userId)) clearTimeout(match.disconnectTimers.get(userId));
      const timer = setTimeout(() => {
        const latest = store.onlineMatches.get(matchId);
        if (!latest || latest.status !== "active" || latest.connectedPlayerIds.has(userId)) return;
        const winnerId = latest.playerIds.find((id) => id !== userId);
        finalizeMatch(latest, "abandoned", winnerId);
      }, disconnectTimeoutMs);
      if (typeof timer.unref === "function") timer.unref();
      match.disconnectTimers.set(userId, timer);
    }
    persistStore();
    const serialized = serializeOnlineMatch(store, match);
    emitToMatch(match, { type: "player_disconnected", playerId: userId, match: serialized });
    return serialized;
  }

  function history(userId) {
    return store.matchHistory.filter((entry) => entry.playerId === userId);
  }

  function rankedProfile(userId) {
    return serializeRating(userId);
  }

  function leaderboards() {
    for (const playerId of store.users.keys()) ensureRating(playerId);
    const ranked = Array.from(store.rankedRatings.values())
      .map((rating) => ({
        ...publicProfile(store, rating.playerId),
        rating: rating.rating,
        tier: rankTierForRating(rating.rating),
        wins: rating.wins,
        losses: rating.losses
      }))
      .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.displayName.localeCompare(b.displayName))
      .slice(0, 50);
    const casualWins = new Map();
    for (const entry of store.matchHistory) {
      if (entry.mode === "casual" && entry.result === "win") {
        casualWins.set(entry.playerId, (casualWins.get(entry.playerId) || 0) + 1);
      }
    }
    const casual = Array.from(casualWins.entries())
      .map(([playerId, wins]) => ({ ...publicProfile(store, playerId), wins }))
      .sort((a, b) => b.wins - a.wins || a.displayName.localeCompare(b.displayName))
      .slice(0, 50);
    return { ranked, casual };
  }

  function cleanupInactiveMatches() {
    const cutoff = nowMs() - staleMatchMs;
    let cleaned = 0;
    for (const match of store.onlineMatches.values()) {
      if (match.status !== "active") continue;
      const created = Date.parse(match.createdAt);
      if (Number.isFinite(created) && created < cutoff) {
        finalizeMatch(match, "abandoned", null);
        cleaned += 1;
      }
    }
    if (cleaned > 0) persistStore();
    return cleaned;
  }

  return {
    acceptChallenge,
    command,
    declineChallenge,
    getMatch,
    history,
    joinQueue,
    cancelQueue,
    queueStatus: serializeQueueStatus,
    rankedProfile,
    leaderboards,
    cleanupInactiveMatches,
    listChallenges,
    listMatches,
    markConnected,
    markDisconnected,
    sendChallenge,
    subscribe
  };
}

module.exports = {
  LOSS_REWARD_COINS,
  MATCH_REWARDS,
  RANKED_LOSS_DELTA,
  RANKED_WIN_DELTA,
  STARTING_RATING,
  WIN_REWARD_COINS,
  createOnlineMatchService,
  rankTierForRating
};
