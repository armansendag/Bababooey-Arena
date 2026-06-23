"use strict";

const crypto = require("crypto");
const { cards } = require("../data/cards");
const { packs } = require("../data/packs");
const { quests } = require("../data/quests");
const { BEGINNER_LOADOUT } = require("../data/starterLoadouts");
const { STARTING_COINS } = require("../domain/economy");

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomUUID();
}

function mapFromEntries(entries) {
  return new Map(entries || []);
}

function serializeStore(store) {
  return {
    users: Array.from(store.users.entries()),
    usersByEmail: Array.from(store.usersByEmail.entries()),
    sessions: Array.from(store.sessions.entries()),
    profiles: Array.from(store.profiles.entries()),
    profilesByFriendCode: Array.from(store.profilesByFriendCode.entries()),
    playerCards: Array.from(store.playerCards.entries()).map(([playerId, cardsMap]) => [playerId, Array.from(cardsMap.entries())]),
    loadouts: Array.from(store.loadouts.entries()),
    friendships: Array.from(store.friendships.entries()),
    friendChallenges: Array.from(store.friendChallenges.entries()),
    rankedRatings: Array.from(store.rankedRatings.entries()),
    onlineMatches: Array.from(store.onlineMatches.entries()).map(([id, match]) => [id, {
      ...match,
      connectedPlayerIds: Array.from(match.connectedPlayerIds || []),
      disconnectTimers: undefined
    }]),
    onlineMatchEvents: store.onlineMatchEvents,
    matchHistory: store.matchHistory,
    coinTransactions: store.coinTransactions,
    packOpenings: store.packOpenings,
    playerQuests: Array.from(store.playerQuests.entries()),
    errorLogs: store.errorLogs,
    bugReports: store.bugReports
  };
}

function starterCardMap() {
  const owned = new Map([[BEGINNER_LOADOUT.coreCardId, 1]]);
  for (const [cardId, quantity] of Object.entries(BEGINNER_LOADOUT.cards)) {
    owned.set(cardId, quantity);
  }
  return owned;
}

function seedStarterDeck(store, playerId, options = {}) {
  const timestamp = nowIso();
  const profile = store.profiles.get(playerId);
  if (!profile) throw new Error("Profile not found.");

  if (options.resetCoins) {
    profile.coins = STARTING_COINS;
    profile.updatedAt = timestamp;
  }

  store.playerCards.set(playerId, starterCardMap());

  if (options.replaceLoadouts) {
    for (const [id, loadout] of Array.from(store.loadouts.entries())) {
      if (loadout.playerId === playerId) store.loadouts.delete(id);
    }
  } else {
    for (const loadout of store.loadouts.values()) {
      if (loadout.playerId === playerId) loadout.isActive = false;
    }
  }

  const loadout = {
    id: makeId(),
    playerId,
    name: BEGINNER_LOADOUT.name,
    archetype: "beginner",
    coreCardId: BEGINNER_LOADOUT.coreCardId,
    cards: { ...BEGINNER_LOADOUT.cards },
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  store.loadouts.set(loadout.id, loadout);
  return loadout;
}

function hydrateStore(store, snapshot) {
  if (!snapshot) return;
  store.users = mapFromEntries(snapshot.users);
  store.usersByEmail = mapFromEntries(snapshot.usersByEmail);
  store.sessions = mapFromEntries(snapshot.sessions);
  store.profiles = mapFromEntries(snapshot.profiles);
  store.profilesByFriendCode = mapFromEntries(snapshot.profilesByFriendCode);
  store.playerCards = new Map((snapshot.playerCards || []).map(([playerId, entries]) => [playerId, new Map(entries)]));
  store.loadouts = mapFromEntries(snapshot.loadouts);
  store.friendships = mapFromEntries(snapshot.friendships);
  store.friendChallenges = mapFromEntries(snapshot.friendChallenges);
  store.rankedRatings = mapFromEntries(snapshot.rankedRatings);
  store.onlineMatches = new Map((snapshot.onlineMatches || []).map(([id, match]) => [id, {
    ...match,
    connectedPlayerIds: new Set(match.connectedPlayerIds || []),
    disconnectTimers: new Map()
  }]));
  store.onlineMatchEvents = snapshot.onlineMatchEvents || [];
  store.matchHistory = snapshot.matchHistory || [];
  store.coinTransactions = snapshot.coinTransactions || [];
  store.packOpenings = snapshot.packOpenings || [];
  store.playerQuests = mapFromEntries(snapshot.playerQuests);
  store.errorLogs = snapshot.errorLogs || [];
  store.bugReports = snapshot.bugReports || [];
}

function createMemoryStore(options = {}) {
  const store = {
    users: new Map(),
    usersByEmail: new Map(),
    sessions: new Map(),
    profiles: new Map(),
    profilesByFriendCode: new Map(),
    cards: new Map(cards.map((card) => [card.id, card])),
    packs: new Map(packs.map((pack) => [pack.id, pack])),
    quests: new Map(quests.map((quest) => [quest.id, quest])),
    playerCards: new Map(),
    loadouts: new Map(),
    friendships: new Map(),
    friendChallenges: new Map(),
    rankedRatings: new Map(),
    matchmakingQueues: {
      casual: [],
      ranked: []
    },
    onlineMatches: new Map(),
    onlineMatchEvents: [],
    matchHistory: [],
    coinTransactions: [],
    packOpenings: [],
    playerQuests: new Map(),
    errorLogs: [],
    bugReports: []
  };

  hydrateStore(store, options.snapshot);

  store.createUser = function createUser({ email, passwordHash, displayName, friendCode }) {
    const id = makeId();
    const createdAt = nowIso();
    const user = { id, email: email.toLowerCase(), passwordHash, createdAt, lastSeenAt: null };
    const profile = {
      userId: id,
      displayName,
      friendCode,
      coins: STARTING_COINS,
      selectedCoreCardId: "core_starter",
      tutorialState: { freePacksOpened: 0 },
      freePacks: { starter_pack: 3 },
      createdAt,
      updatedAt: createdAt
    };

    store.users.set(id, user);
    store.usersByEmail.set(user.email, user);
    store.profiles.set(id, profile);
    store.profilesByFriendCode.set(friendCode, profile);
    seedStarterDeck(store, id, { replaceLoadouts: true });
    if (typeof store.persist === "function") store.persist();

    return { user, profile };
  };

  store.logError = function logError({ level = "error", scope, message, status = 500, userId = null, details = null, metadata = {} }) {
    const entry = {
      id: makeId(),
      level,
      scope,
      message,
      status,
      userId,
      details,
      metadata,
      createdAt: nowIso()
    };
    store.errorLogs.push(entry);
    store.errorLogs = store.errorLogs.slice(-200);
    if (typeof store.persist === "function") store.persist();
    return entry;
  };

  store.addBugReport = function addBugReport({ reporterId, matchId, message, stateSummary = null }) {
    const report = {
      id: makeId(),
      reporterId,
      matchId,
      message: String(message || "").trim(),
      stateSummary,
      createdAt: nowIso()
    };
    if (!report.message) {
      const error = new Error("Bug report message is required.");
      error.status = 400;
      throw error;
    }
    store.bugReports.push(report);
    if (typeof store.persist === "function") store.persist();
    return report;
  };

  store.resetDevAccount = function resetDevAccount(playerId) {
    const profile = store.profiles.get(playerId);
    if (!profile) {
      const error = new Error("User not found.");
      error.status = 404;
      throw error;
    }
    seedStarterDeck(store, playerId, { resetCoins: true, replaceLoadouts: true });
    store.playerQuests.delete(playerId);
    store.rankedRatings.delete(playerId);
    profile.freePacks = { starter_pack: 3 };
    store.matchmakingQueues.casual = store.matchmakingQueues.casual.filter((entry) => entry.playerId !== playerId);
    store.matchmakingQueues.ranked = store.matchmakingQueues.ranked.filter((entry) => entry.playerId !== playerId);
    if (typeof store.persist === "function") store.persist();
    return profile;
  };

  store.addCoinTransaction = function addCoinTransaction({ playerId, amount, reason, sourceId = null, metadata = {} }) {
    const profile = store.profiles.get(playerId);
    if (!profile) throw new Error("Profile not found.");
    const nextCoins = profile.coins + amount;
    if (nextCoins < 0) throw new Error("Insufficient coins.");
    profile.coins = nextCoins;
    profile.updatedAt = nowIso();

    const transaction = {
      id: makeId(),
      playerId,
      amount,
      reason,
      sourceId,
      metadata,
      createdAt: nowIso()
    };
    store.coinTransactions.push(transaction);
    if (typeof store.persist === "function") store.persist();
    return transaction;
  };

  return store;
}

module.exports = { createMemoryStore, nowIso, makeId, seedStarterDeck, serializeStore };
