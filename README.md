# Bababooey Arena

Phase 1 implementation for **Battlefield: Codex**.

This scaffold intentionally does not include the battle engine yet. It covers:

- PostgreSQL schema
- Authentication and profiles
- Friend system
- Collection ownership
- Loadout builder validation
- Pack opening and duplicate conversion
- Daily/weekly quest tracking

## Run

```powershell
npm start
```

The server listens on `http://localhost:3000` by default.

## Test

```powershell
npm test
```

The current implementation uses an in-memory store for local development and tests. The durable PostgreSQL contract lives in `db/001_phase1_schema.sql`.
