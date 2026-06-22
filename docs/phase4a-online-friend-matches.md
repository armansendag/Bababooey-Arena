# Phase 4A Online Friend Matches

Phase 4A adds live online friend matches only. It does not add ranked matchmaking, ranked queues, stake matches, or public matchmaking.

## Backend

- WebSocket endpoint: `GET /ws?token=<auth token>`
- HTTP friend challenge endpoints:
  - `GET /friend-challenges`
  - `POST /friend-challenges`
  - `POST /friend-challenges/:id/accept`
  - `POST /friend-challenges/:id/decline`
- Online match endpoints:
  - `GET /online-matches`
  - `GET /online-matches/:id`
  - `POST /online-matches/:id/commands`
  - `GET /match-history`

The server remains authoritative:

- clients send intent commands only
- the server overwrites `playerId` from the authenticated session
- commands are validated through `src/domain/battleEngine.js`
- accepted commands broadcast updated match state to both players
- invalid commands return WebSocket or HTTP errors

## WebSocket Messages

Client to server:

```js
{ type: "subscribe_match", matchId }
{ type: "command", matchId, command }
{ type: "ping" }
```

Server to client:

```js
{ type: "connected", userId, challenges, matches }
{ type: "challenge_received", challenge }
{ type: "challenge_sent", challenge }
{ type: "challenge_declined", challenge }
{ type: "match_created", match }
{ type: "match_snapshot", match }
{ type: "match_state", match, result }
{ type: "player_connected", playerId, match }
{ type: "player_disconnected", playerId, match }
{ type: "command_ack", matchId, result }
{ type: "error", error, status }
{ type: "pong" }
```

## Persistence Contract

Migration `db/002_online_friend_matches.sql` adds:

- `friend_challenges`
- `online_matches`
- `online_match_events`
- `match_history`
- match win/loss coin transaction reasons

The local development runtime mirrors this in memory through `createMemoryStore()`.

## Rewards

When an online friend match finishes:

- winner receives 100 coins
- loser receives 25 coins
- both players get match history rows
- final engine event log is stored in `online_match_events`

## Frontend

The Online tab shows:

- WebSocket connection status
- pending challenge notifications
- accept/decline controls
- challenge buttons for accepted friends
- online match resume/play controls

The existing battle UI is reused for online matches. Online commands are sent over WebSocket when connected, with HTTP fallback while reconnecting.

## Tests

`tests/onlineMatch.test.js` covers:

- WebSocket auth/connection
- challenge accept and match creation
- valid and invalid commands
- reconnect snapshot
- full online friend match completion with history and rewards

## Phase 4B Hardening

Phase 4B keeps the same scope: online friend matches only. It still does not include ranked matchmaking, public queues, or stake matches.

Added hardening:

- restart-safe store snapshots for local/mock persistence tests
- persistent event-log/history contract through `db/002_online_friend_matches.sql`
- browser-refresh reconnect using saved auth token and active online match id
- disconnect timeout handling
- abandoned match finalization
- periodic cleanup for stale active matches
- duplicate reward prevention through match history and transaction checks
- server-side reward validation before coin grants
- friend challenge rate limits
- online command rate limits
- malformed command rejection before the battle engine is called
- clearer `Invalid command: ...` errors for rejected gameplay intents

Current persistence note:

- The production database contract is represented by SQL migrations.
- `npm start` uses a JSON-backed local store at `data/dev-store.json` by default so friend-test matches, event logs, rewards, and history can survive local server restarts.
- Tests use the in-memory store plus snapshot hydration to prove restart behavior without requiring a live PostgreSQL server.
- When a PostgreSQL adapter is introduced, it should implement the same records used by `friend_challenges`, `online_matches`, `online_match_events`, and `match_history`.

Disconnect behavior:

- A disconnected player is marked disconnected and the opponent is notified.
- If the player reconnects before the timeout, the match remains active and a fresh snapshot is sent.
- If the timeout expires, the match is marked abandoned and the connected opponent wins by forfeit.

Rewards:

- Rewards are granted only from server finalization.
- Clients cannot submit coin values, winners, cooldowns, or outcomes.
- A match can only grant one pair of win/loss rewards, even after snapshot restore.
