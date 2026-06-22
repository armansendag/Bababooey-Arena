"use strict";

const STARTING_COINS = 1000;
const MAX_OWNED_COPIES = 10;

const DUPLICATE_VALUES = {
  common: 5,
  uncommon: 15,
  rare: 50,
  epic: 150,
  legendary: 500,
  mythic: 2000,
  bababooey: 10000
};

function duplicateCoinValue(rarity) {
  return DUPLICATE_VALUES[rarity] || 0;
}

module.exports = { STARTING_COINS, MAX_OWNED_COPIES, DUPLICATE_VALUES, duplicateCoinValue };
