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

Each starter loadout contains exactly 12 non-core cards and a legal selected core: 8 troops, 2 spells, and 2 enchantments. Player-built loadouts must follow that same 8/2/2 composition, owned copies, and legal copy limits before they can be saved, activated, or used in queue.

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

| Pack | Price | Cards | Guaranteed | Odds |
| --- | ---: | ---: | --- | --- |
| Starter Pack | 150 | 6 | 1 uncommon | Common 72 / Uncommon 25 / Rare 3 |
| Basic Pack | 250 | 6 | 1 uncommon | Common 62 / Uncommon 27 / Rare 8 / Epic 2.5 / Legendary 0.45 / Mythic 0.05 |
| Rare Pack | 600 | 6 | 1 rare | Common 42 / Uncommon 34 / Rare 18 / Epic 4.8 / Legendary 1 / Mythic 0.2 |
| Epic Pack | 1400 | 6 | 1 epic | Uncommon 43 / Rare 37 / Epic 16 / Legendary 3 / Mythic 0.8 / Bababooey 0.2 |
| Mythic Pack | 5000 | 6 | 1 mythic | Rare 44 / Epic 34 / Legendary 16 / Mythic 5 / Bababooey 1 |
| Chaos Pack | 1000 | 6 | None | Common 45 / Uncommon 30 / Rare 17 / Epic 6 / Legendary 1.5 / Mythic 0.4 / Bababooey 0.1 |
| Archetype Pack | 450 | 8 | 1 uncommon, 1 rare | Common 46 / Uncommon 32 / Rare 16 / Epic 4.5 / Legendary 1.2 / Mythic 0.28 / Bababooey 0.02 |
| Core Cache | 700 | 5 | 1 core, 1 rare | Common 35 / Uncommon 30 / Rare 23 / Epic 8 / Legendary 2.5 / Mythic 1 / Bababooey 0.5 |

Core cards are excluded from normal packs unless the pack sets `includeCores: true`.

Chaos Pack is intentionally swingy, but its expected rarity value is lower than Epic Pack. Epic and Mythic packs are the premium chase packs because their guaranteed slots protect the buyer from low-roll outcomes.

## Balance Guardrails

`tests/contentBalance.test.js` checks:

- requested Phase 6 card counts
- all seven starter loadouts validate
- each starter has an opening turn play
- starter mirror matches do not instantly win or brick through the opening turns
- pack expected value ordering keeps premium packs ahead of Chaos

The battle engine remains the gameplay source of truth.
