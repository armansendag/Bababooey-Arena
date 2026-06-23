"use strict";

const path = require("path");
const { createJsonBackedStore } = require("./jsonStore");

async function createConfiguredStore(options = {}) {
  const env = options.env || process.env;
  if (env.DATABASE_URL) {
    const { createPostgresBackedStore } = require("./postgresStore");
    return createPostgresBackedStore({
      databaseUrl: env.DATABASE_URL,
      ssl: options.ssl
    });
  }

  const dataFile = env.DATA_FILE || path.join(__dirname, "..", "..", "data", "dev-store.json");
  return createJsonBackedStore(dataFile);
}

module.exports = { createConfiguredStore };
