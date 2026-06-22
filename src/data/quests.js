"use strict";

const quests = [
  {
    id: "daily_play_game",
    period: "daily",
    name: "Play a Game",
    objectiveType: "play_game",
    targetValue: 1,
    rewardCoins: 75
  },
  {
    id: "daily_win_game",
    period: "daily",
    name: "Win a Game",
    objectiveType: "win_game",
    targetValue: 1,
    rewardCoins: 125
  },
  {
    id: "weekly_open_packs",
    period: "weekly",
    name: "Open Packs",
    objectiveType: "open_pack",
    targetValue: 3,
    rewardCoins: 300
  },
  {
    id: "weekly_get_rare_plus",
    period: "weekly",
    name: "Get a Rare or Better",
    objectiveType: "get_rare_plus",
    targetValue: 1,
    rewardCoins: 250
  }
];

module.exports = { quests };
