"use strict";

const crypto = require("crypto");
const { cards } = require("../data/cards");
const { packs } = require("../data/packs");
const { quests } = require("../data/quests");
const { BEGINNER_LOADOUT } = require("../data/starterLoadouts");
const { STARTING_COINS } = require("../domain/economy");
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomUUID();
}

function mapFromEntries(entries) {
  return new Map(entries || []);
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function usernameSeed(value, fallback) {
  const cleaned = String(value || fallback || "player").split("@")[0].replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const compact = cleaned || "player";
  const padded = compact.length < 3 ? `${compact}___`.slice(0, 3) : compact;
  return padded.slice(0, 16);
}

function allocateUsername(base, used) {
  const seed = usernameSeed(base, "player");
  let candidate = seed;
  let suffix = 1;
  while (used.has(normalizeUsername(candidate)) || !USERNAME_PATTERN.test(candidate)) {
    const tag = String(suffix);
    candidate = `${seed.slice(0, Math.max(3, 16 - tag.length))}${tag}`;
    suffix += 1;
  }
  used.add(normalizeUsername(candidate));
  return candidate;
}

function rebuildUsernameIndex(store) {
  const used = new Set();
  store.usersByUsername = new Map();
  for (const [userId, user] of store.users.entries()) {
    const profile = store.profiles.get(userId);
    const username = user.username || profile?.username || allocateUsername(profile?.displayName || user.email, used);
    const normalizedUsername = normalizeUsername(username);
    used.add(normalizedUsername);
    user.username = username;
    user.normalizedUsername = normalizedUsername;
    if (!Object.prototype.hasOwnProperty.call(user, "usernameLastChangedAt")) user.usernameLastChangedAt = profile?.usernameLastChangedAt || null;
    if (profile) {
      profile.username = username;
      profile.normalizedUsername = normalizedUsername;
      profile.displayName = username;
      profile.settings = { font: "poppins", ...(profile.settings || {}) };
      if (!Object.prototype.hasOwnProperty.call(profile, "usernameLastChangedAt")) profile.usernameLastChangedAt = user.usernameLastChangedAt || null;
    }
    store.usersByUsername.set(normalizedUsername, user);
  }
}

function serializeStore(store) {
  return {
    users: Array.from(store.users.entries()),
    usersByEmail: Array.from(store.usersByEmail.entries()),
    usersByUsername: Array.from(store.usersByUsername.entries()),
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
      disconnectTimers: undefined,
      turnTimer: undefined
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

function removePlayerProgress(store, playerId) {
  const profile = store.profiles.get(playerId);
  if (!profile) {
    const error = new Error("User not found.");
    error.status = 404;
    throw error;
  }

  const relatedMatchIds = new Set();
  for (const match of store.onlineMatches.values()) {
    if (match.playerIds?.includes(playerId)) relatedMatchIds.add(match.id);
  }
  for (const history of store.matchHistory) {
    if (history.playerIds?.includes(playerId)) relatedMatchIds.add(history.matchId);
  }

  store.friendships = new Map(Array.from(store.friendships.entries()).filter(([, friendship]) => (
    friendship.requesterId !== playerId && friendship.addresseeId !== playerId
  )));
  store.friendChallenges = new Map(Array.from(store.friendChallenges.entries()).filter(([, challenge]) => (
    challenge.challengerId !== playerId && challenge.challengedId !== playerId
  )));
  store.onlineMatches = new Map(Array.from(store.onlineMatches.entries()).filter(([matchId, match]) => (
    matchId !== playerId && !match.playerIds?.includes(playerId)
  )));
  store.onlineMatchEvents = store.onlineMatchEvents.filter((event) => !relatedMatchIds.has(event.matchId));
  store.matchHistory = store.matchHistory.filter((history) => !history.playerIds?.includes(playerId));
  store.coinTransactions = store.coinTransactions.filter((transaction) => transaction.playerId !== playerId);
  store.packOpenings = store.packOpenings.filter((opening) => opening.playerId !== playerId);
  store.playerQuests.delete(playerId);
  store.rankedRatings.delete(playerId);
  store.matchmakingQueues.casual = store.matchmakingQueues.casual.filter((entry) => entry.playerId !== playerId);
  store.matchmakingQueues.ranked = store.matchmakingQueues.ranked.filter((entry) => entry.playerId !== playerId);
}

function resetProfileProgress(profile) {
  profile.coins = STARTING_COINS;
  profile.selectedCoreCardId = "core_starter";
  profile.tutorialState = { freePacksOpened: 0 };
  profile.settings = { font: "poppins", ...(profile.settings || {}) };
  profile.freePacks = { starter_pack: 3 };
  profile.updatedAt = nowIso();
  return profile;
}

function clearAllPlayerState(store) {
  store.users.clear();
  store.usersByEmail.clear();
  store.usersByUsername.clear();
  store.sessions.clear();
  store.profiles.clear();
  store.profilesByFriendCode.clear();
  store.playerCards.clear();
  store.loadouts.clear();
  store.friendships.clear();
  store.friendChallenges.clear();
  store.rankedRatings.clear();
  store.matchmakingQueues.casual = [];
  store.matchmakingQueues.ranked = [];
  store.onlineMatches.clear();
  store.onlineMatchEvents = [];
  store.matchHistory = [];
  store.coinTransactions = [];
  store.packOpenings = [];
  store.playerQuests.clear();
  store.errorLogs = [];
  store.bugReports = [];
}

function hydrateStore(store, snapshot) {
  if (!snapshot) return;
  store.users = mapFromEntries(snapshot.users);
  store.usersByEmail = mapFromEntries(snapshot.usersByEmail);
  store.usersByUsername = mapFromEntries(snapshot.usersByUsername);
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
    disconnectTimers: new Map(),
    turnTimer: null
  }]));
  store.onlineMatchEvents = snapshot.onlineMatchEvents || [];
  store.matchHistory = snapshot.matchHistory || [];
  store.coinTransactions = snapshot.coinTransactions || [];
  store.packOpenings = snapshot.packOpenings || [];
  store.playerQuests = mapFromEntries(snapshot.playerQuests);
  store.errorLogs = snapshot.errorLogs || [];
  store.bugReports = snapshot.bugReports || [];
  rebuildUsernameIndex(store);
}

function createMemoryStore(options = {}) {
  const store = {
    users: new Map(),
    usersByEmail: new Map(),
    usersByUsername: new Map(),
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

  store.createUser = function createUser({ email, passwordHash, username, normalizedUsername, friendCode }) {
    const id = makeId();
    const createdAt = nowIso();
    const cleanUsername = username || allocateUsername(email, new Set(store.usersByUsername.keys()));
    const cleanNormalizedUsername = normalizedUsername || normalizeUsername(cleanUsername);
    const user = {
      id,
      email: email.toLowerCase(),
      passwordHash,
      username: cleanUsername,
      normalizedUsername: cleanNormalizedUsername,
      usernameLastChangedAt: null,
      createdAt,
      lastSeenAt: null
    };
    const profile = {
      userId: id,
      username: cleanUsername,
      normalizedUsername: cleanNormalizedUsername,
      usernameLastChangedAt: null,
      displayName: cleanUsername,
      friendCode,
      coins: STARTING_COINS,
      selectedCoreCardId: "core_starter",
      tutorialState: { freePacksOpened: 0 },
      settings: { font: "poppins" },
      freePacks: { starter_pack: 3 },
      createdAt,
      updatedAt: createdAt
    };

    store.users.set(id, user);
    store.usersByEmail.set(user.email, user);
    store.usersByUsername.set(user.normalizedUsername, user);
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
    return store.resetPlayerAccount(playerId);
  };

  store.resetPlayerAccount = function resetPlayerAccount(playerId) {
    const profile = store.profiles.get(playerId);
    if (!profile) {
      const error = new Error("User not found.");
      error.status = 404;
      throw error;
    }
    removePlayerProgress(store, playerId);
    resetProfileProgress(profile);
    seedStarterDeck(store, playerId, { replaceLoadouts: true });
    if (typeof store.persist === "function") store.persist();
    return profile;
  };

  store.resetAllPlayerData = function resetAllPlayerData() {
    clearAllPlayerState(store);
    if (typeof store.persist === "function") store.persist();
    return {
      users: store.users.size,
      collections: store.playerCards.size,
      loadouts: store.loadouts.size,
      matches: store.onlineMatches.size,
      transactions: store.coinTransactions.length
    };
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
