"use strict";

const { nowIso } = require("../store/memoryStore");
const { normalizeUsername, validateUsername } = require("./authService");

const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function createProfileService(store, authService) {
  function get(userId) {
    return authService.sanitizeProfile(store.profiles.get(userId));
  }

  function update(userId, payload) {
    const profile = store.profiles.get(userId);
    if (!profile) throw Object.assign(new Error("Profile not found."), { status: 404 });
    const requestedUsername = payload.username ?? payload.displayName;
    if (requestedUsername) {
      const username = validateUsername(requestedUsername);
      const normalizedUsername = normalizeUsername(username);
      if (normalizedUsername !== profile.normalizedUsername) {
        const lastChanged = profile.usernameLastChangedAt ? new Date(profile.usernameLastChangedAt).getTime() : 0;
        if (lastChanged && Date.now() - lastChanged < USERNAME_CHANGE_COOLDOWN_MS) {
          throw Object.assign(new Error("Username can only be changed once every 30 days."), { status: 400 });
        }
        if (store.usersByUsername?.has(normalizedUsername)) {
          throw Object.assign(new Error("Username is already taken."), { status: 409 });
        }
        const user = store.users.get(userId);
        if (user?.normalizedUsername) store.usersByUsername.delete(user.normalizedUsername);
        if (user) {
          user.username = username;
          user.normalizedUsername = normalizedUsername;
          user.usernameLastChangedAt = nowIso();
          store.usersByUsername.set(normalizedUsername, user);
        }
        profile.username = username;
        profile.normalizedUsername = normalizedUsername;
        profile.usernameLastChangedAt = user?.usernameLastChangedAt || nowIso();
      }
      profile.displayName = username;
    }
    if (payload.selectedCoreCardId) {
      const card = store.cards.get(payload.selectedCoreCardId);
      const owned = store.playerCards.get(userId)?.get(payload.selectedCoreCardId) || 0;
      if (!card || card.type !== "core" || owned < 1) {
        throw Object.assign(new Error("Selected core must be owned."), { status: 400 });
      }
      profile.selectedCoreCardId = payload.selectedCoreCardId;
    }
    profile.updatedAt = nowIso();
    if (typeof store.persist === "function") store.persist();
    return authService.sanitizeProfile(profile);
  }

  return { get, update };
}

module.exports = { USERNAME_CHANGE_COOLDOWN_MS, createProfileService };
