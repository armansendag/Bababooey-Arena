"use strict";

const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const { createConfiguredStore } = require("../src/store/configuredStore");

function argValue(name) {
  const exact = `--${name}`;
  const withEquals = `${exact}=`;
  const index = process.argv.indexOf(exact);
  if (index >= 0) return process.argv[index + 1] || "";
  const found = process.argv.find((arg) => arg.startsWith(withEquals));
  return found ? found.slice(withEquals.length) : "";
}

async function askConfirmation(expected) {
  const supplied = argValue("confirm");
  if (supplied) return supplied;

  if (!process.stdin.isTTY) {
    throw new Error(`Refusing reset without confirmation. Re-run with --confirm "${expected}".`);
  }

  const rl = readline.createInterface({ input, output });
  try {
    return await rl.question(`Type ${expected} to continue: `);
  } finally {
    rl.close();
  }
}

async function main() {
  const mode = process.argv[2];
  if (!["all", "user"].includes(mode)) {
    throw new Error("Usage: node scripts/resetStore.js <all|user> [userId] [--confirm \"...\"]");
  }

  const store = await createConfiguredStore();
  try {
    if (mode === "all") {
      const expected = "RESET ALL PLAYER DATA";
      const actual = await askConfirmation(expected);
      if (actual !== expected) throw new Error("Confirmation did not match. Reset cancelled.");
      const result = store.resetAllPlayerData();
      if (typeof store.flush === "function") await store.flush();
      console.log(`All player data reset. Users: ${result.users}, collections: ${result.collections}, loadouts: ${result.loadouts}.`);
      return;
    }

    const userId = process.argv[3];
    if (!userId || userId.startsWith("--")) throw new Error("Usage: node scripts/resetStore.js user <userId> [--confirm \"RESET USER <userId>\"]");
    const expected = `RESET USER ${userId}`;
    const actual = await askConfirmation(expected);
    if (actual !== expected) throw new Error("Confirmation did not match. Reset cancelled.");
    store.resetPlayerAccount(userId);
    if (typeof store.flush === "function") await store.flush();
    console.log(`User ${userId} reset to starter progression.`);
  } finally {
    if (typeof store.close === "function") await store.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
