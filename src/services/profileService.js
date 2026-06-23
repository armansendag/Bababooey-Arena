"use strict";

const { nowIso } = require("../store/memoryStore");

function createProfileService(store, authService) {
  function get(userId) {
    return authService.sanitizeProfile(store.profiles.get(userId));
  }

  function update(userId, payload) {
    const profile = store.profiles.get(userId);
    if (!profile) throw Object.assign(new Error("Profile not found."), { status: 404 });
    if (payload.displayName) profile.displayName = String(payload.displayName).trim();
    if (payload.selectedCoreCardId) {
      const card = store.cards.get(payload.selectedCoreCardId);
      const owned = store.playerCards.get(userId)?.get(payload.selectedCoreCardId) || 0;
      if (!card || card.type !== "core" || owned < 1) {
        throw Object.assign(new Error("Selected core must be owned."), { status: 400 });
      }
      profile.selectedCoreCardId = payload.selectedCoreCardId;
    }
    profile.updatedAt = nowIso();
    return authService.sanitizeProfile(profile);
  }

  return { get, update };
}

module.exports = { createProfileService };
