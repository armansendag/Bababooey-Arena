# Phase 1 API

All protected endpoints require:

```http
Authorization: Bearer <token>
```

## Public

- `GET /health`
- `POST /auth/register`
  - body: `{ "username": "...", "email": "...", "password": "..." }`
  - creates a unique public username, 1000 coins, 3 free Starter Packs, 1 free Core, and one legal Beginner Starter loadout
  - usernames are case-insensitively unique, 3-16 characters, and allow only letters, numbers, and underscores
  - does not grant the full card catalog
- `POST /auth/login`
  - body: `{ "email": "...", "password": "..." }`

## Profile

- `GET /me`
- `PATCH /me`
  - body: `{ "username": "...", "selectedCoreCardId": "core_starter" }`
  - username changes are limited to once every 30 days

## Cards and Collection

- `GET /cards`
- `GET /collection`

## Friends

- `GET /friends`
- `POST /friends`
  - body: `{ "identifier": "username-or-BBY-code" }`
  - `friendCode`, `username`, and `identifier` request fields are accepted for compatibility
- `POST /friends/:id/accept`
- `POST /friends/:id/decline`

## Loadouts

- `GET /loadouts`
- `POST /loadouts`
- `PATCH /loadouts/:id`
- `POST /loadouts/:id/activate`
- `POST /loadouts/validate`

Loadout rules:

- exactly 20 non-core cards
- any mix of troops, spells, and enchantments is allowed
- Standard cards: up to 3 copies
- Limited cards: up to 2 copies
- Unique cards: 1 copy
- selected core must be owned

## Packs

- `GET /shop/packs`
  - returns all launch packs with name, cost, card count, rarity odds, guaranteed slots, and description
- `POST /shop/packs/:id/open`

Pack opening is server-side. It consumes a free pack entitlement first when available, otherwise charges coins, grants cards, converts only copies beyond 10 to coins, saves the opening, and advances pack-related quests.

## Quests

- `GET /quests`
- `POST /quests/progress`
  - body: `{ "objectiveType": "play_game", "amount": 1 }`
- `POST /quests/:id/claim`

The `/quests/progress` endpoint is present for local development and admin-style testing. In production, most quest progress should be emitted by trusted backend events.

## Out of Scope for Phase 1

No battle engine, matchmaking, realtime match commands, stake matches, ranked play, or spectator mode endpoints are implemented yet.
