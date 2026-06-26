"use strict";

const { nowIso } = require("../store/memoryStore");

function createQuestService(store) {
  function periodExpired(quest, playerQuest) {
    if (!["daily", "weekly"].includes(quest.period)) return false;
    const startedAt = Date.parse(playerQuest.periodStartedAt);
    if (!Number.isFinite(startedAt)) return true;
    const now = Date.now();
    if (quest.period === "daily") {
      const started = new Date(startedAt);
      const current = new Date(now);
      return started.getUTCFullYear() !== current.getUTCFullYear() ||
        started.getUTCMonth() !== current.getUTCMonth() ||
        started.getUTCDate() !== current.getUTCDate();
    }
    return now - startedAt >= 7 * 24 * 60 * 60 * 1000;
  }

  function refreshPeriodQuest(quest, playerQuest) {
    if (!periodExpired(quest, playerQuest)) return playerQuest;
    playerQuest.progress = 0;
    playerQuest.completedAt = null;
    playerQuest.claimedAt = null;
    playerQuest.periodStartedAt = nowIso();
    return playerQuest;
  }

  function ensurePlayerQuest(playerId, questId) {
    const key = `${playerId}:${questId}`;
    let playerQuest = store.playerQuests.get(key);
    if (!playerQuest) {
      playerQuest = {
        playerId,
        questId,
        progress: 0,
        completedAt: null,
        claimedAt: null,
        periodStartedAt: nowIso()
      };
      store.playerQuests.set(key, playerQuest);
    }
    return playerQuest;
  }

  function list(playerId) {
    return Array.from(store.quests.values()).map((quest) => {
      const playerQuest = ensurePlayerQuest(playerId, quest.id);
      refreshPeriodQuest(quest, playerQuest);
      return serialize(quest, playerQuest);
    });
  }

  function recordProgress(playerId, objectiveType, amount = 1) {
    const updated = [];
    for (const quest of store.quests.values()) {
      if (quest.objectiveType !== objectiveType) continue;
      const playerQuest = ensurePlayerQuest(playerId, quest.id);
      refreshPeriodQuest(quest, playerQuest);
      if (playerQuest.claimedAt && quest.period !== "repeatable") continue;
      playerQuest.progress = Math.min(quest.targetValue, playerQuest.progress + amount);
      if (playerQuest.progress >= quest.targetValue && !playerQuest.completedAt) {
        playerQuest.completedAt = nowIso();
      }
      updated.push(serialize(quest, playerQuest));
    }
    if (updated.length > 0 && typeof store.persist === "function") store.persist();
    return updated;
  }

  function claim(playerId, questId) {
    const quest = store.quests.get(questId);
    if (!quest) throw Object.assign(new Error("Quest not found."), { status: 404 });
    const playerQuest = ensurePlayerQuest(playerId, questId);
    refreshPeriodQuest(quest, playerQuest);
    if (!playerQuest.completedAt) throw Object.assign(new Error("Quest is not complete."), { status: 400 });
    if (playerQuest.claimedAt && quest.period !== "repeatable") throw Object.assign(new Error("Quest is already claimed."), { status: 400 });
    playerQuest.claimedAt = nowIso();
    if (quest.rewardCoins > 0) {
      store.addCoinTransaction({ playerId, amount: quest.rewardCoins, reason: "quest_reward", sourceId: quest.id });
    }
    if (quest.period === "repeatable") {
      playerQuest.progress = 0;
      playerQuest.completedAt = null;
      playerQuest.claimedAt = null;
      playerQuest.periodStartedAt = nowIso();
    }
    return serialize(quest, playerQuest);
  }

  function serialize(quest, playerQuest) {
    return {
      id: quest.id,
      period: quest.period,
      name: quest.name,
      objectiveType: quest.objectiveType,
      targetValue: quest.targetValue,
      rewardCoins: quest.rewardCoins,
      progress: playerQuest.progress,
      completedAt: playerQuest.completedAt,
      claimedAt: playerQuest.claimedAt
    };
  }

  return { list, recordProgress, claim };
}

module.exports = { createQuestService };
