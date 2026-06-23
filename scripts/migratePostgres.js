"use strict";

const { migratePostgres } = require("../src/store/postgresStore");

migratePostgres()
  .then(() => {
    console.log("PostgreSQL migrations applied.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
