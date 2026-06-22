"use strict";

const { applyCommand, createMatch } = require("./battleEngine");

function createLocalMatch(players, options = {}) {
  const state = createMatch(players, options);

  return {
    state,
    command(command) {
      return applyCommand(state, command, options);
    },
    run(commands) {
      return commands.map((command) => this.command(command));
    },
    snapshot() {
      return JSON.parse(JSON.stringify(state));
    }
  };
}

module.exports = { createLocalMatch };
