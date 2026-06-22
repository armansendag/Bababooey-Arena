# Bababooey Arena

Bababooey Arena is a local/offline and online friend-test prototype for **Battlefield: Codex**. It includes accounts, profiles, friends, collections, loadouts, packs, quests, a deterministic battle engine, live friend matches, casual queue, ranked queue foundation, rewards, match history, and a static browser UI served by the same Node server.

This deployment prep keeps the current JSON-backed store so the game can be tested quickly with friends before moving to a managed database.

## Run Locally

Install dependencies:

```powershell
npm install
```

Start the app:

```powershell
npm start
```

Open:

```text
http://localhost:3000
```

Run tests:

```powershell
npm test
```

Run the deployment smoke test:

```powershell
npm run smoke:deploy
```

## Environment Variables

Copy `.env.example` if you want a local reference:

```powershell
Copy-Item .env.example .env
```

The app currently reads environment variables directly from the process. It does not require `dotenv`.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | Render sets this automatically. Local `npm start` uses `3000` if unset. |
| `DATA_FILE` | No | `data/dev-store.json` | Path for the current JSON store. Render free-tier suggestion: `/tmp/bababooey-arena-store.json`. |
| `NODE_ENV` | No | unset | Set to `production` on Render. |
| `PUBLIC_URL` | No | unset | Documentation hint only for now. Friends use your Render URL directly. |

## Start Command

```text
npm start
```

The server listens on:

```js
process.env.PORT || 3000
```

## Health Check URL

```text
/health
```

Local:

```text
http://localhost:3000/health
```

Render:

```text
https://YOUR-RENDER-SERVICE.onrender.com/health
```

## Deploy To Render Free Tier

1. Push this repository to GitHub.
2. In Render, choose **New +** then **Web Service**.
3. Connect the GitHub repository.
4. Use these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Instance Type | Free |

5. Add environment variables:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATA_FILE` | `/tmp/bababooey-arena-store.json` |

6. Deploy.
7. Open the public Render URL when the deploy finishes.

This repo also includes `render.yaml`, so Render can detect the same recommended settings if you use Blueprint deployment.

## How Friends Connect

After Render deploys, send friends your public URL:

```text
https://YOUR-RENDER-SERVICE.onrender.com
```

Each friend opens the link in a browser. The prototype creates a local test account automatically when no saved session exists. Friends can use the Online screen to connect, challenge accepted friends, or queue for Casual/Ranked testing.

WebSockets use the same host as the page, so no extra client configuration is needed.

## JSON Store For Friend Testing

The current server uses `src/store/jsonStore.js` and writes app state to `DATA_FILE`.

For small friend tests, this is simple and fine:

- accounts
- sessions
- collections
- loadouts
- friendships
- online matches
- match history
- ranked ratings
- coin transactions

On Render free tier, `/tmp/bababooey-arena-store.json` is writable, but it is ephemeral. Data can disappear after restarts, redeploys, service moves, or platform cleanup.

## Important Storage Warning

The JSON store is **not production-safe long-term**.

Known limits:

- no multi-instance safety
- no real transaction isolation
- no backups unless you add them yourself
- data may reset on Render free tier
- large files will become slow and fragile
- simultaneous writes can become risky as traffic grows

Use it only for early public friend testing.

## Future Supabase/Postgres Migration Notes

The `db/` folder contains the current relational schema direction:

- `001_phase1_schema.sql`
- `002_online_friend_matches.sql`
- `003_matchmaking_ranked.sql`

Recommended next persistence step:

1. Create a Supabase project or managed Postgres database.
2. Run the schema migrations in order.
3. Add a Postgres-backed store that implements the same service-facing operations currently handled by the memory/JSON store.
4. Move sessions, profiles, loadouts, collections, matches, event logs, match history, ranked ratings, and coin transactions into Postgres.
5. Keep the battle engine deterministic and server-authoritative.
6. Add migration/export tooling from the JSON file if friend-test data needs to be preserved.

Do not require Postgres for the first friend test. The JSON store is intentionally still supported.

## Deployment Smoke Checklist

Before sending the URL to friends:

- `npm test` passes locally.
- `npm run smoke:deploy` passes locally.
- Render deploy logs show the service listening on the assigned port.
- `https://YOUR-RENDER-SERVICE.onrender.com/health` returns `{ "ok": true }`.
- The public URL loads the Bababooey Arena UI.
- Open the URL in two different browsers or profiles.
- Confirm both clients can reach the Online screen.
- Create or use active loadouts.
- Join Casual Queue from both clients and confirm a match starts.
- Play a few turns and confirm both screens update.

## Production Notes

- The frontend is served from `public/` by `src/app.js`.
- API routes and WebSocket upgrades are served by the same Node process.
- `npm start` works locally and on Render.
- No PostgreSQL service is required for this deployment-prep phase.
