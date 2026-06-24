# Phase 3 Playable Prototype

Phase 3 adds a local/offline frontend prototype served by the existing Node app. It does not add realtime multiplayer, matchmaking, ranked play, WebSockets, or friend challenges.

## Run

```powershell
npm start
```

Open:

```text
http://localhost:3000
```

## Screens

- Home
- Collection
- Loadout Builder
- Pack Opening
- Quests
- Local Battle

The app bootstraps a local prototype account in memory, grants a demo collection, prepares a local match, and starts on Home.

## Battle Flow

The battle screen renders state from the Phase 2 battle engine:

- Core HP for both players
- current turn and active player
- current banked mana and mana bank cap
- available active-player roster
- active troops
- active enchantments
- troop, spell, and enchantment cooldowns
- event log
- winner state

UI commands call local HTTP endpoints backed by `src/domain/battleEngine.js`:

- play troop
- play enchantment
- cast spell
- attack troop, enchantment, or Core once enemy troops are cleared
- end turn

The UI does not resolve battle rules itself. It renders returned engine state and displays engine validation errors when commands are invalid.

## Prototype API

- `POST /prototype/bootstrap`
- `POST /local-matches`
- `GET /local-matches/:id`
- `POST /local-matches/:id/commands`
- `POST /local-matches/demo-script`

These endpoints are local prototype helpers only and are not realtime multiplayer infrastructure.

## Verification

`tests/localPrototype.test.js` starts the app in-process and proves the UI-facing flow can:

- load the static app shell
- bootstrap a local account
- read collection data
- create a local match
- play a troop
- end turns
- use Player 2 Coin
- play another troop
- attack through the same command endpoint used by the UI

## Phase 3.5 Quality Pass

The local/offline prototype now includes a more game-like battle presentation:

- rarity-framed cards
- mana cost badges
- type icons and faction labels
- cooldown overlays and disabled reasons
- hover and double-click card details
- match-start screen with both players, Cores, and loadout previews
- match-end screen with winner, rewards preview, and event summary
- tutorial overlay for mana, cooldowns, troops, spells, enchantments, Core HP, and ending turns
- settings overlay for sound, animation speed, and reduced motion
- targeting guide, highlighted valid targets, and selected attacker/spell state
- combat feedback for attacks, damage numbers, core hits, defeats, and enchantment breaks
- responsive desktop/mobile layout improvements

Rules remain server-side/local-engine authoritative. UI commands still call `/local-matches/:id/commands` and render the returned battle state.

The automated prototype tests now also prove a full local match can finish through the command endpoint.
