"use strict";

const quests = [
  {
    id: "one_time_first_match",
    period: "one_time",
    name: "First Bababooey Brawl",
    objectiveType: "play_game",
    targetValue: 1,
    rewardCoins: 200
  },
  {
    id: "one_time_first_win",
    period: "one_time",
    name: "First Dub Secured",
    objectiveType: "win_game",
    targetValue: 1,
    rewardCoins: 350
  },
  {
    id: "one_time_pack_starter",
    period: "one_time",
    name: "Open Your First Pack",
    objectiveType: "open_pack",
    targetValue: 1,
    rewardCoins: 125
  },
  {
    id: "one_time_pack_goblin",
    period: "one_time",
    name: "Pack Goblin Warmup",
    objectiveType: "open_pack",
    targetValue: 5,
    rewardCoins: 400
  },
  {
    id: "one_time_ranked_tryout",
    period: "one_time",
    name: "Ranked Tryout",
    objectiveType: "play_ranked",
    targetValue: 1,
    rewardCoins: 250
  },
  {
    id: "one_time_rare_pull",
    period: "one_time",
    name: "Shiny Card Moment",
    objectiveType: "get_rare_plus",
    targetValue: 1,
    rewardCoins: 225
  },
  {
    id: "daily_play_game",
    period: "daily",
    name: "Daily Game Check-In",
    objectiveType: "play_game",
    targetValue: 1,
    rewardCoins: 90
  },
  {
    id: "daily_win_game",
    period: "daily",
    name: "Daily Dub Bonus",
    objectiveType: "win_game",
    targetValue: 1,
    rewardCoins: 160
  },
  {
    id: "repeat_play_game",
    period: "repeatable",
    name: "Keep Playing",
    objectiveType: "play_game",
    targetValue: 1,
    rewardCoins: 35
  },
  {
    id: "repeat_win_game",
    period: "repeatable",
    name: "Keep Winning",
    objectiveType: "win_game",
    targetValue: 1,
    rewardCoins: 75
  },
  {
    id: "repeat_play_three_games",
    period: "repeatable",
    name: "Three Game Session",
    objectiveType: "play_game",
    targetValue: 3,
    rewardCoins: 140
  },
  {
    id: "repeat_win_three_games",
    period: "repeatable",
    name: "Three Dubs Deep",
    objectiveType: "win_game",
    targetValue: 3,
    rewardCoins: 275
  },
  {
    id: "repeat_casual_grind",
    period: "repeatable",
    name: "Casual Coin Printer",
    objectiveType: "play_casual",
    targetValue: 5,
    rewardCoins: 180
  },
  {
    id: "repeat_ranked_grind",
    period: "repeatable",
    name: "Ranked Ladder Snacks",
    objectiveType: "play_ranked",
    targetValue: 5,
    rewardCoins: 400
  },
  {
    id: "repeat_open_pack",
    period: "repeatable",
    name: "Open Packs",
    objectiveType: "open_pack",
    targetValue: 3,
    rewardCoins: 240
  },
  {
    id: "repeat_rare_plus",
    period: "repeatable",
    name: "Rare or Better Chase",
    objectiveType: "get_rare_plus",
    targetValue: 2,
    rewardCoins: 300
  }
];

module.exports = { quests };
