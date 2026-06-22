"use strict";

const { makeId, nowIso } = require("../store/memoryStore");
const { validateLoadout } = require("../domain/loadouts");

function serializeLoadout(loadout) {
  return {
    id: loadout.id,
    playerId: loadout.playerId,
    name: loadout.name,
    coreCardId: loadout.coreCardId,
    cards: loadout.cards,
    isActive: loadout.isActive,
    createdAt: loadout.createdAt,
    updatedAt: loadout.updatedAt
  };
}

function createLoadoutService(store, collectionService) {
  function validate(playerId, payload) {
    return validateLoadout(
      {
        cards: payload.cards,
        coreCardId: payload.coreCardId,
        collection: collectionService.ownedMap(playerId)
      },
      store.cards
    );
  }

  function list(playerId) {
    return Array.from(store.loadouts.values())
      .filter((loadout) => loadout.playerId === playerId)
      .map(serializeLoadout);
  }

  function create(playerId, payload) {
    const result = validate(playerId, payload);
    if (!result.valid) throw Object.assign(new Error("Loadout is invalid."), { status: 400, details: result.errors });
    const timestamp = nowIso();
    const loadout = {
      id: makeId(),
      playerId,
      name: String(payload.name || "New Loadout").trim(),
      coreCardId: payload.coreCardId,
      cards: result.normalizedCards,
      isActive: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    store.loadouts.set(loadout.id, loadout);
    if (typeof store.persist === "function") store.persist();
    return serializeLoadout(loadout);
  }

  function update(playerId, id, payload) {
    const loadout = store.loadouts.get(id);
    if (!loadout || loadout.playerId !== playerId) throw Object.assign(new Error("Loadout not found."), { status: 404 });
    const merged = {
      name: payload.name ?? loadout.name,
      coreCardId: payload.coreCardId ?? loadout.coreCardId,
      cards: payload.cards ?? loadout.cards
    };
    const result = validate(playerId, merged);
    if (!result.valid) throw Object.assign(new Error("Loadout is invalid."), { status: 400, details: result.errors });
    loadout.name = String(merged.name || loadout.name).trim();
    loadout.coreCardId = merged.coreCardId;
    loadout.cards = result.normalizedCards;
    loadout.updatedAt = nowIso();
    if (typeof store.persist === "function") store.persist();
    return serializeLoadout(loadout);
  }

  function setActive(playerId, id) {
    const loadout = store.loadouts.get(id);
    if (!loadout || loadout.playerId !== playerId) throw Object.assign(new Error("Loadout not found."), { status: 404 });
    for (const item of store.loadouts.values()) {
      if (item.playerId === playerId) item.isActive = false;
    }
    loadout.isActive = true;
    loadout.updatedAt = nowIso();
    if (typeof store.persist === "function") store.persist();
    return serializeLoadout(loadout);
  }

  return { validate, list, create, update, setActive };
}

module.exports = { createLoadoutService };
