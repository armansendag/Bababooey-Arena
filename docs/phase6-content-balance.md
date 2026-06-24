# Phase 6 Content Expansion And Balance

Phase 6 expands the card pool without adding new gameplay systems. The full source-of-truth card database is `src/data/cards.js`; it exports `cards` and `cardsById`.

## Card Counts

| Type | Count |
| --- | ---: |
| Troops | 80 |
| Reusable spells | 25 |
| Enchantments | 20 |
| Selectable cores | 8 |
| Total | 133 |

## Card Schema

Every card has:

- `id`
- `name`
- `type`
- `rarity`
- `faction`
- `manaCost`
- `cooldown`
- `copyTag`
- `perks`

Troops also have `attack`, `defense`, and `hp`.
Enchantments and cores have `hp`.

## Factions

- neutral
- mana
- arcane
- tech
- beast
- machine
- undead
- memeborn

## Rarities And Copy Tags

| Rarity | Default copy tag |
| --- | --- |
| common | standard |
| uncommon | standard |
| rare | limited |
| epic | limited |
| legendary | unique |
| mythic | unique |
| bababooey | unique |

Copy limits are still enforced by the existing loadout validator.

## Starter Archetypes

Starter archetypes live in `src/data/starterLoadouts.js`.

| Archetype | Core | Style |
| --- | --- | --- |
| Aggro | `core_aggro` | Low-cost haste and pressure troops |
| Ramp | `core_ramp` | Mana faction curve and high-cost payoffs |
| Control | `core_control` | Arcane defense, Disenchant, and Shield |
| Beast | `core_beast` | Beast pressure and combat bodies |
| Machine | `core_machine` | Durable machine curve |
| Undead | `core_undead` | Sticky undead curve |
| Memeborn | `core_memeborn` | Low-cost meme pressure and weird value cards |

Each starter loadout contains exactly 20 non-core cards and a legal selected core. Player-built loadouts may use any mix of troops, spells, and enchantments as long as the deck has 20 non-core cards, owned copies, and legal copy limits.

New accounts receive one beginner starter loadout plus starter rewards. Additional archetypes are collection goals, not automatically owned full decks.

## Pack Contents

Packs live in `src/data/packs.js`.

The launch shop includes:

- Starter Pack
- Basic Pack
- Rare Pack
- Epic Pack
- Mythic Pack
- Chaos Pack
- Archetype Pack
- Core Cache

Starter Packs are intentionally low-rarity: commons and uncommons are the main outcome, rares are uncommon, and epics/legendaries/mythics/bababooeys are excluded.

| Pack | Price | Cards | Notes |
| --- | ---: | ---: | --- |
| Starter Pack | 200 | 6 | Better early collection growth with uncommon/rare guarantees |
| Archetype Pack | 350 | 8 | Higher rare-plus rate for building focused decks |
| Core Cache | 500 | 5 | Can contain cores, spells, and enchantments |

Core cards are excluded from normal packs unless the pack sets `includeCores: true`.

## Balance Guardrails

`tests/contentBalance.test.js` checks:

- requested Phase 6 card counts
- all seven starter loadouts validate
- each starter has an opening turn play
- starter mirror matches do not instantly win or brick through the opening turns

The battle engine remains the gameplay source of truth.
