"use strict";

const { makeId, nowIso } = require("../store/memoryStore");
const { normalizeUsername } = require("./authService");

function publicProfile(profile) {
  return {
    userId: profile.userId,
    username: profile.username || profile.displayName,
    displayName: profile.displayName,
    friendCode: profile.friendCode
  };
}

function createFriendService(store) {
  function existingPair(a, b) {
    return Array.from(store.friendships.values()).find((friendship) => {
      return (
        (friendship.requesterId === a && friendship.addresseeId === b) ||
        (friendship.requesterId === b && friendship.addresseeId === a)
      );
    });
  }

  function findTarget(identifier) {
    const value = String(identifier || "").trim();
    if (!value) return null;
    const byCode = store.profilesByFriendCode.get(value.toUpperCase());
    if (byCode) return byCode;
    const user = store.usersByUsername?.get(normalizeUsername(value));
    return user ? store.profiles.get(user.id) : null;
  }

  function sendRequest(playerId, identifier) {
    const target = findTarget(identifier);
    if (!target) throw Object.assign(new Error("Player not found by username or friend code."), { status: 404 });
    if (target.userId === playerId) throw Object.assign(new Error("Cannot friend yourself."), { status: 400 });
    const existing = existingPair(playerId, target.userId);
    if (existing) return serialize(existing);

    const timestamp = nowIso();
    const friendship = {
      id: makeId(),
      requesterId: playerId,
      addresseeId: target.userId,
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.friendships.set(friendship.id, friendship);
    if (typeof store.persist === "function") store.persist();
    return serialize(friendship);
  }

  function respond(playerId, friendshipId, accepted) {
    const friendship = store.friendships.get(friendshipId);
    if (!friendship || friendship.addresseeId !== playerId) {
      throw Object.assign(new Error("Friend request not found."), { status: 404 });
    }
    friendship.status = accepted ? "accepted" : "blocked";
    friendship.updatedAt = nowIso();
    if (typeof store.persist === "function") store.persist();
    return serialize(friendship);
  }

  function list(playerId) {
    return Array.from(store.friendships.values())
      .filter((friendship) => friendship.requesterId === playerId || friendship.addresseeId === playerId)
      .map(serialize);
  }

  function serialize(friendship) {
    const requester = store.profiles.get(friendship.requesterId);
    const addressee = store.profiles.get(friendship.addresseeId);
    return {
      id: friendship.id,
      status: friendship.status,
      requester: publicProfile(requester),
      addressee: publicProfile(addressee),
      createdAt: friendship.createdAt,
      updatedAt: friendship.updatedAt
    };
  }

  return { sendRequest, respond, list };
}

module.exports = { createFriendService };
