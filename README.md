# Bababooey Arena

Bababooey Arena is a local and online card battler built on a deterministic server-authoritative battle engine.

## New Player Progression

New accounts start with:

- 1000 coins
- 3 free Starter Packs
- 1 free Starter Core
- 1 legal Beginner Starter loadout made from a small tutorial card pool

New accounts do not receive the full card catalog and do not receive every archetype starter deck as owned cards. Collection progress comes from opening packs, earning rewards, and keeping copies over time. Players may own up to 10 copies of each card; only copy 11 and beyond converts to coins.

The launch shop includes Starter Pack, Basic Pack, Rare Pack, Epic Pack, Mythic Pack, Chaos Pack, Archetype Pack, and Core Cache. Starter Packs only roll commons, uncommons, and rare cards. Chaos Pack is now a high-variance fun pack rather than the best value; Epic and Mythic Packs carry the stronger guaranteed premium slots.

### Current Pack Odds

| Pack | Cost | Cards | Guaranteed slots | Rarity odds |
| --- | ---: | ---: | --- | --- |
| Starter Pack | 150 | 6 | 1 uncommon | Common 72 / Uncommon 25 / Rare 3 |
| Basic Pack | 250 | 6 | 1 uncommon | Common 62 / Uncommon 27 / Rare 8 / Epic 2.5 / Legendary 0.45 / Mythic 0.05 |
| Rare Pack | 600 | 6 | 1 rare | Common 42 / Uncommon 34 / Rare 18 / Epic 4.8 / Legendary 1 / Mythic 0.2 |
| Epic Pack | 1400 | 6 | 1 epic | Uncommon 43 / Rare 37 / Epic 16 / Legendary 3 / Mythic 0.8 / Bababooey 0.2 |
| Mythic Pack | 5000 | 6 | 1 mythic | Rare 44 / Epic 34 / Legendary 16 / Mythic 5 / Bababooey 1 |
| Chaos Pack | 1000 | 6 | None | Common 45 / Uncommon 30 / Rare 17 / Epic 6 / Legendary 1.5 / Mythic 0.4 / Bababooey 0.1 |
| Archetype Pack | 450 | 8 | 1 uncommon, 1 rare | Common 46 / Uncommon 32 / Rare 16 / Epic 4.5 / Legendary 1.2 / Mythic 0.28 / Bababooey 0.02 |
| Core Cache | 700 | 5 | 1 core, 1 rare | Common 35 / Uncommon 30 / Rare 23 / Epic 8 / Legendary 2.5 / Mythic 1 / Bababooey 0.5 |

Quests provide extra coin income. One-time quests give larger early boosts for first match, first win, first pack, ranked tryout, and rare pulls. Daily game quests reward one play and one win each day. Repeatable quests reset after claiming and permanently reward steady play, wins, casual/ranked sessions, pack opening, and rare-plus pulls. Online match completion advances `play_game` for both players and `win_game` for the winner.

Ranked matches pay more than casual matches to reward the higher-stakes queue: casual wins/losses grant 50/10 coins, while ranked wins/losses grant 150/40 coins. The repeatable ranked session quest also pays more than the casual session quest.

## Run Locally

Install dependencies, then start the server:

```powershell
npm install
npm start
```

The app listens on `http://localhost:3000` by default. Health check:

```text
http://localhost:3000/health
```

If `DATABASE_URL` is not set, the app uses the JSON dev store at `data/dev-store.json` or `DATA_FILE`. This is convenient for quick friend tests and local development, but JSON storage is not production-safe long term.

## Environment

Copy `.env.example` into your deployment environment and set values there.

```text
PORT=3000
DATA_FILE=data/dev-store.json
DATABASE_URL=
PGSSL=true
ENABLE_ADMIN_DEBUG=false
```

`DATABASE_URL` enables PostgreSQL. Without it, the server falls back to JSON mode.

## PostgreSQL Setup

Production should use PostgreSQL through Neon, Render Postgres, or Supabase Postgres.

The server automatically applies SQL files from `db/` on startup when `DATABASE_URL` is present. You can also run migrations manually:

```powershell
npm run db:migrate
```

PostgreSQL mode persists users, profiles, sessions, collections, loadouts, friends, quests, packs, matches, event logs, ratings, leaderboards, coin transactions, bug reports, and online match snapshots. Online matches and rewards are restored from the durable store after restart, redeploy, or browser refresh.

On startup with PostgreSQL enabled, Render logs should include:

```text
Connected to PostgreSQL database: <database-name>
Migration status: <n> applied, <n> already applied, <n> total.
```

## Developer Reset Tools

Use these only for development, beta cleanup, or a broken test account. Reset tools preserve game content: card catalog, packs, quest definitions, cores, and other static content.

There is no in-game Admin panel. Players can reset only their own progress from Settings by typing `RESET MY STATS`. Run broader reset commands from Command Prompt or PowerShell in the project folder.

Reset one user:

```powershell
npm run reset:user -- <userId>
```

For non-interactive shells:

```powershell
npm run reset:user -- <userId> --confirm "RESET USER <userId>"
```

Full player-data reset deletes users, collections, loadouts, friends, friend requests, quests progress, match history, ratings, coin transactions, pack openings/rewards, event logs, sessions, bug reports, and error logs.

```powershell
npm run reset:all
```

For non-interactive shells:

```powershell
npm run reset:all -- --confirm "RESET ALL PLAYER DATA"
```

After a full reset, every player must register again.

## Deploy To Render With Neon

### GitHub Checklist

1. Commit the project with `package.json`, `package-lock.json`, `db/`, `src/`, `public/`, `.env.example`, and `README.md`.
2. Push to the GitHub repository Render will deploy.
3. Confirm `data/` and `.env` stay ignored.

### Neon Database Checklist

1. Create a Neon project.
2. Create or use the default database.
3. Copy the pooled or direct PostgreSQL connection string.
4. Keep SSL enabled. Neon URLs commonly include `sslmode=require`; `PGSSL=true` also works with this app.
5. Save the connection string for Render as `DATABASE_URL`.

### Render Web Service Checklist

1. Create a Render Web Service from the GitHub repository.
2. Runtime: Node.
3. Build command: `npm install`.
4. Start command: `npm start`.
5. Add environment variables:
   - `PORT` is provided by Render automatically.
   - `DATABASE_URL` from Neon.
   - `PGSSL=true`
   - `ENABLE_ADMIN_DEBUG=false` normally, or `true` temporarily when checking `/debug/persistence`.
6. Health check path: `/health`.
7. Deploy and watch logs for the PostgreSQL and migration messages above.

For Render Postgres, create a Render PostgreSQL database and copy its connection string into `DATABASE_URL`.

For Supabase, copy the project PostgreSQL connection string into `DATABASE_URL`. Keep SSL enabled; add `?sslmode=require` if Supabase provides a URL without SSL mode.

Friends connect by opening the Render public URL in their browser. The same URL serves the frontend, API, and WebSocket match connection.

## Account Identity

Alpha signup asks for only username, email, and password. Usernames are public, unique case-insensitively, 3-16 characters, and limited to letters, numbers, and underscores. Progress is tied to the account `userId`, including coins, collection, loadouts, pack openings, quests, friends, match history, ranked rating, and transactions.

Email verification is intentionally disabled for alpha testing. The frontend keeps the existing session token in local storage so players stay logged in on that device. Players can change their username from Settings, but only once every 30 days.

Settings also include an account-saved UI font picker with a local storage fallback. Poppins is the default font. Font changes apply immediately, persist after refresh/login, and reset safely to Poppins if an unsupported font is received.

Friend codes remain unique. Friends can add each other by either public username or friend code.

## Persistence Verification

Use this checklist after a production deploy:

1. Open `/health` and confirm `{ "ok": true }`.
2. Register two accounts.
3. Open the three free Starter Packs and confirm cards are added without spending coins.
4. Open a paid pack and confirm coins/cards change.
5. Build or activate loadouts.
6. Add the two accounts as friends.
7. Complete a ranked or casual match.
8. Refresh both browsers and confirm the accounts remain logged in.
9. Trigger a Render manual deploy or restart.
10. Log back in and confirm username, coins, collection, loadouts, friends, match history, ranked rating, and rewards still exist.
11. Temporarily set `ENABLE_ADMIN_DEBUG=true`, redeploy, log in, and open `/debug/persistence`.

`/debug/persistence` reports the active store type, database connection state, database name, migration status, and counts for users, collections, loadouts, friends, pack openings, matches, match history, ranked ratings, and coin transactions. Disable `ENABLE_ADMIN_DEBUG` again after checking production.

## JSON Friend Testing

For tiny private tests, you may omit `DATABASE_URL` and let Render use the JSON store. This can work for quick experiments, but data may be lost on restarts or redeploys. Use PostgreSQL for any real beta session.

## Future Database Work

The current PostgreSQL adapter keeps the existing store interface and writes a durable app snapshot while also migrating and seeding the SQL schema. A future Supabase/Postgres migration can move each service to direct normalized table reads and writes once gameplay and content are stable.

## Test

```powershell
npm test
```

## Deployment Smoke Test

1. Open `/health` and confirm `{ "ok": true }`.
2. Register two accounts.
3. Confirm each account has starter decks.
4. Start a casual queue match or friend challenge.
5. Play a few commands and refresh both browsers.
6. Confirm the match restores.
7. Finish the match.
8. Confirm match history and rewards show once.

## Troubleshooting

`Cannot find module 'pg'`: run `npm install` and make sure `package-lock.json` is committed. Render build command should be `npm install`.

`DATABASE_URL is required`: this only appears when running `npm run db:migrate` without a database URL. Set `DATABASE_URL` in Render or your local shell first.

PostgreSQL SSL errors: set `PGSSL=true`. Neon and most hosted Postgres providers require SSL.

App starts in JSON mode on Render: `DATABASE_URL` is missing or blank. Add the Neon connection string to Render environment variables and redeploy.

Migrations fail on an existing manually-created database: use a fresh Neon database for beta testing, or check the `schema_migrations` table before rerunning SQL by hand.

Data disappears after redeploy: confirm startup logs say `PostgreSQL store`, not `JSON store`, and confirm `/debug/persistence` reports `storeType: "postgresql"`.

WebSocket connection fails from friends' browsers: use the Render public `https://` URL, not localhost. The frontend automatically chooses `wss://` on HTTPS.
