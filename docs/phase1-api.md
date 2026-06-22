# Phase 1 API

All protected endpoints require:

```http
Authorization: Bearer <token>
```

## Public

- `GET /health`
- `POST /auth/register`
  - body: `{ "email": "...", "password": "...", "displayName": "..." }`
- `POST /auth/login`
  - body: `{ "email": "...", "password": "..." }`

## Profile

- `GET /me`
- `PATCH /me`
  - body: `{ "displayName": "...", "selectedCoreCardId": "core_starter" }`

## Cards and Collection

- `GET /cards`
- `GET /collection`

## Friends

- `GET /friends`
- `POST /friends`
  - body: `{ "friendCode": "BBY-ABC123" }`
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
- 14-16 troops
- up to 3 spells
- up to 3 enchantments
- Standard cards: up to 3 copies
- Limited cards: up to 2 copies
- Unique cards: 1 copy
- selected core must be owned

## Packs

- `GET /shop/packs`
- `POST /shop/packs/:id/open`

Pack opening charges coins, grants cards, converts copies beyond 10 to coins, and advances pack-related quests.

## Quests

- `GET /quests`
- `POST /quests/progress`
  - body: `{ "objectiveType": "play_game", "amount": 1 }`
- `POST /quests/:id/claim`

The `/quests/progress` endpoint is present for local development and admin-style testing. In production, most quest progress should be emitted by trusted backend events.

## Out of Scope for Phase 1

No battle engine, matchmaking, realtime match commands, stake matches, ranked play, or spectator mode endpoints are implemented yet.
