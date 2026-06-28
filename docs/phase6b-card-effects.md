# Phase 6B Card Effect Hooks

Phase 6B makes the Phase 6 card database executable through generic battle-engine effect metadata. The source of truth is `effects` on cards in `src/data/cards.js`.

## Audit Summary

| Card group | Total | Active metadata effects | Already engine-supported text | Text/passive stat only |
| --- | ---: | ---: | ---: | ---: |
| Troops | 80 | 18 | Haste/stat bodies | 62 |
| Spells | 25 | 25 | Reusable cooldowns | 0 |
| Enchantments | 20 | 20 | HP/destruction/cooldown | 0 |
| Cores | 8 | 7 | Core HP | 1 |
| Total | 133 | 70 | varies | 63 |

Cards without explicit `effects` are still playable and balanced through mana cost, cooldown, attack, defense, HP, rarity, faction, and copy tag. Flavor-only perk text such as "large body", "curve piece", or "finisher" is treated as stat identity, not a hidden rule.

## Generic Effect Handlers

Implemented in `src/domain/battleEngine.js`:

- `damage`
- `trueDamage`
- `heal`
- `healCore`
- `statBuff`
- `manaGain`
- `manaGainFromDestroyedCost`
- `maxManaIncrease` (implemented as mana bank cap increase under the banked mana system)
- `cooldownReduction`
- `cooldownIncrease`
- `spellCounter`
- `spellReflection`
- `enchantmentDamageBonus`
- `enchantmentDamageMultiplier`
- `enchantmentDamageReduction`
- `destroyEnchantment`
- `destroyTroop`
- `coreDamageReduction`
- `lifesteal`
- `death`
- `startTurn`
- `onPlay`
- `onPlayTroop`
- `onAttack`
- `onSpellCast`

## Active Examples

| Effect family | Example cards |
| --- | --- |
| Damage | Sit, Quick Jab, Bonk, Scrap Blast |
| True damage | Orbital Ping, Emergency Funding self-damage |
| Healing | Repair Loop, Haunted Cathedral, Mech Paladin |
| Stat buffs | Pack Alpha, Pack Howl, Primal Roar, Overclock |
| Mana gain | Coin, Emergency Funding, Mana Goblin, Crystal Mine, Supply Drop |
| Mana bank cap increase | Mana Spring |
| Cooldown changes | Time Skip, Grave Call, Disrupt, Minor Inconvenience |
| Spell countering | Nope, Magic Barrier |
| Spell reflection | Reflect |
| Enchantment damage/destruction | Enchantment Eater, Arcane Hunter, Demolition Bot, Disenchant |
| Core damage reduction | Fortress Wall, Steel Bunker, Factory Core, Prism Core |
| Lifesteal | Wraith Duelist, Iron Harvester |
| Death triggers | Mana Slime, Grave Nibbler, Graveyard, Crypt Core |
| Start-of-turn effects | Mana Golem, Mana Dragon, Crystal Mine, Infinite Generator, Orbital Array |
| On-play effects | Shield Captain, Pack Alpha, Oops Knight, Mech Paladin |
| On-attack effects | Thunder Rhino, Chair Champion, Wraith Duelist |

## Effect Timing

- Static effects are read while their source core, troop, or enchantment is active.
- Start-of-turn effects run after cooldown ticks, defense regeneration, and banked owner-turn mana gain.
- On-play troop effects run immediately after the troop enters the battlefield.
- Spell counters and reflections are consumed one at a time by the next enemy spell.
- Death triggers run after the defeated troop moves back to roster cooldown.
- Spell/enchantment/troop cooldown rules remain unchanged.

## Tests

`tests/cardEffects.test.js` covers at least one card from each major effect family. The existing battle, online, and content tests continue to validate deterministic command behavior.
