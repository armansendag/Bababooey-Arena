"use strict";

const crypto = require("crypto");
const { cards } = require("../data/cards");
const { packs } = require("../data/packs");
const { quests } = require("../data/quests");
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
    playerQuests: Array.from(store.playerQuests.entries())
  };
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
    playerQuests: new Map()
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
      tutorialState: {},
      createdAt,
      updatedAt: createdAt
    };

    store.users.set(id, user);
    store.usersByEmail.set(user.email, user);
    store.profiles.set(id, profile);
    store.profilesByFriendCode.set(friendCode, profile);
    store.playerCards.set(id, new Map([["core_starter", 1]]));
    if (typeof store.persist === "function") store.persist();

    return { user, profile };
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

module.exports = { createMemoryStore, nowIso, makeId, serializeStore };
