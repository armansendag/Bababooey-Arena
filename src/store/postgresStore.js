"use strict";

const fs = require("fs");
const path = require("path");
const { cards } = require("../data/cards");
const { packs } = require("../data/packs");
const { quests } = require("../data/quests");
const { createMemoryStore, serializeStore } = require("./memoryStore");

const DEFAULT_SNAPSHOT_ID = "default";

function requirePg() {
  try {
    return require("pg");
  } catch (error) {
    const missing = new Error("DATABASE_URL is set, but the pg package is not installed. Run npm install before starting with PostgreSQL.");
    missing.cause = error;
    throw missing;
  }
}

function inferSsl(databaseUrl = process.env.DATABASE_URL) {
  if (process.env.PGSSL === "false") return false;
  if (process.env.PGSSL === "true") return { rejectUnauthorized: false };
  if (!databaseUrl) return false;
  if (/localhost|127\.0\.0\.1/i.test(databaseUrl)) return false;
  return { rejectUnauthorized: false };
}

function migrationFiles(migrationsDir) {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

async function seedCatalog(client) {
  for (const card of cards) {
    await client.query(
      `INSERT INTO cards
        (id, name, type, rarity, faction, mana_cost, cooldown, copy_tag, attack, defense, hp, perks, rules, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, true)
       ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        rarity = EXCLUDED.rarity,
        faction = EXCLUDED.faction,
        mana_cost = EXCLUDED.mana_cost,
        cooldown = EXCLUDED.cooldown,
        copy_tag = EXCLUDED.copy_tag,
        attack = EXCLUDED.attack,
        defense = EXCLUDED.defense,
        hp = EXCLUDED.hp,
        perks = EXCLUDED.perks,
        rules = EXCLUDED.rules,
        is_active = true`,
      [
        card.id,
        card.name,
        card.type,
        card.rarity,
        card.faction,
        card.manaCost || 0,
        card.cooldown || 0,
        card.copyTag || "standard",
        card.attack ?? null,
        card.defense ?? null,
        card.hp ?? null,
        JSON.stringify(card.perks || []),
        JSON.stringify({ effects: card.effects || [], text: card.text || null })
      ]
    );
  }

  for (const pack of packs) {
    await client.query(
      `INSERT INTO packs (id, name, price, cards_per_pack, drop_table, is_active)
       VALUES ($1, $2, $3, $4, $5::jsonb, true)
       ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        cards_per_pack = EXCLUDED.cards_per_pack,
        drop_table = EXCLUDED.drop_table,
        is_active = true`,
      [
        pack.id,
        pack.name,
        pack.price,
        pack.cardsPerPack,
        JSON.stringify({
          dropTable: pack.dropTable,
          guaranteedSlots: pack.guaranteedSlots || [],
          includeCores: Boolean(pack.includeCores),
          types: pack.types || null
        })
      ]
    );
  }

  for (const quest of quests) {
    await client.query(
      `INSERT INTO quests (id, period, name, objective_type, target_value, reward_coins, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (id) DO UPDATE SET
        period = EXCLUDED.period,
        name = EXCLUDED.name,
        objective_type = EXCLUDED.objective_type,
        target_value = EXCLUDED.target_value,
        reward_coins = EXCLUDED.reward_coins,
        is_active = true`,
      [quest.id, quest.period, quest.name, quest.objectiveType, quest.targetValue, quest.rewardCoins]
    );
  }
}

async function migratePostgres(options = {}) {
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to run PostgreSQL migrations.");

  const migrationsDir = options.migrationsDir || path.join(__dirname, "..", "..", "db");
  const { Client } = requirePg();
  const client = new Client({
    connectionString: databaseUrl,
    ssl: options.ssl === undefined ? inferSsl(databaseUrl) : options.ssl
  });

  await client.connect();
  const status = {
    databaseName: null,
    applied: [],
    skipped: [],
    total: 0,
    catalogSeeded: false
  };
  try {
    const database = await client.query("SELECT current_database() AS name");
    status.databaseName = database.rows[0]?.name || null;
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = migrationFiles(migrationsDir);
    status.total = files.length;
    for (const file of files) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [file]);
      if (applied.rowCount > 0) {
        status.skipped.push(file);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      status.applied.push(file);
    }

    await seedCatalog(client);
    status.catalogSeeded = true;
    return status;
  } finally {
    await client.end();
  }
}

async function readSnapshot(pool, snapshotId) {
  const result = await pool.query("SELECT snapshot FROM app_snapshots WHERE id = $1", [snapshotId]);
  return result.rows[0]?.snapshot || null;
}

async function writeSnapshot(pool, snapshotId, snapshot) {
  await pool.query(
    `INSERT INTO app_snapshots (id, snapshot, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`,
    [snapshotId, JSON.stringify(snapshot)]
  );
}

async function createPostgresBackedStore(options = {}) {
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to create a PostgreSQL store.");

  const migrationStatus = await migratePostgres(options);

  const { Pool } = requirePg();
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: options.ssl === undefined ? inferSsl(databaseUrl) : options.ssl
  });
  pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error);
  });
  const snapshotId = options.snapshotId || DEFAULT_SNAPSHOT_ID;
  const snapshot = await readSnapshot(pool, snapshotId);
  const store = createMemoryStore({ snapshot });
  store.persistence = {
    type: "postgresql",
    connected: true,
    databaseName: migrationStatus.databaseName,
    snapshotId,
    ssl: options.ssl === undefined ? Boolean(inferSsl(databaseUrl)) : Boolean(options.ssl),
    migrationStatus
  };

  let pendingPersist = Promise.resolve();
  store.persist = function persist() {
    const currentSnapshot = serializeStore(store);
    pendingPersist = pendingPersist
      .then(() => writeSnapshot(pool, snapshotId, currentSnapshot))
      .catch((error) => {
        console.error("PostgreSQL store persist failed:", error);
      });
    return pendingPersist;
  };
  store.flush = function flush() {
    return pendingPersist;
  };
  store.close = async function close() {
    await pendingPersist;
    await pool.end();
  };

  if (!snapshot) store.persist();
  return store;
}

module.exports = {
  createPostgresBackedStore,
  inferSsl,
  migratePostgres,
  seedCatalog
};
