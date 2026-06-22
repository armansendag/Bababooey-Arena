# Phase 2 Battle Engine

Phase 2 adds a deterministic local battle engine only. It does not include matchmaking, WebSockets, ranked play, friend challenges, spectators, or any live multiplayer transport.

## Files

- `src/domain/battleEngine.js`
  - match state creation
  - validated command reducer
  - turn, mana, cooldown, damage, troop, spell, enchantment, respawn, and event-log rules
- `src/domain/localMatchHarness.js`
  - small two-player local harness for tests and future UI prototyping
- `tests/battleEngine.test.js`
  - core rule coverage

## Match State

Each match tracks:

- `status`: `active` or `finished`
- `winnerId`
- `turnNumber`
- `activePlayerId`
- `eventLog`
- per-player state:
  - `coreHp`, starting at 300
  - `baseMaxMana`, `currentMana`, `temporaryMana`
  - `coinAvailable` for player 2
  - `roster`
  - active `troops`
  - active `enchantments`
  - reusable spell cooldowns

## Commands

Use `applyCommand(state, command)` or the local harness.

Supported commands:

```js
{ type: "playTroop", playerId, cardId }
{ type: "attack", playerId, attackerInstanceId, target }
{ type: "castSpell", playerId, cardId, target }
{ type: "playEnchantment", playerId, cardId }
{ type: "endTurn", playerId }
```

Attack targets:

```js
{ type: "core", playerId }
{ type: "troop", instanceId }
{ type: "enchantment", instanceId }
```

## Rules Implemented

- Core HP starts at 300.
- Player 1 starts the match.
- Mana starts at 1 for the active player.
- Each player's max mana increases by 1 at the start of their own turn, capped at 10.
- Mana refills at the start of turn.
- Temporary mana disappears at end of turn.
- Player 2 gets one `spell_coin` per match for +1 temporary mana.
- Troops cannot attack on the turn they are played unless their card has `Haste`.
- Troops can attack enemy troops, enemy enchantments, or the enemy Core.
- Damage against defended targets is `Attack - currentDefense`, minimum 1.
- Defense acts as a per-turn shield and regenerates to base defense at the start of the owner's turn.
- HP persists until healing or destruction.
- Defeated troops leave the battlefield, enter cooldown, and return to the roster when cooldown expires.
- Spells are reusable and enter cooldown after casting.
- Spell cooldowns tick down at the start of the owner's turn.
- Enchantments have HP and can be attacked directly.
- Destroyed enchantments enter cooldown.
- A player can have only 3 active enchantments.
- The same enchantment cannot be replayed while already active.
- Arcane Shield halves damage dealt to its owner's enchantments, minimum 1.
- No troop battlefield limit is enforced.

## Local Harness Example

```js
const { createLocalMatch } = require("./src/domain/localMatchHarness");

const harness = createLocalMatch({
  player1: { id: "p1", loadout },
  player2: { id: "p2", loadout }
});

const troop = harness.command({ type: "playTroop", playerId: "p1", cardId: "troop_mana_goblin" });
harness.command({ type: "endTurn", playerId: "p1" });
```

The harness mutates one local match state and records every accepted action in `state.eventLog`.
