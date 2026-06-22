BEGIN;

CREATE TYPE card_type AS ENUM ('troop', 'spell', 'enchantment', 'core');
CREATE TYPE card_rarity AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'bababooey');
CREATE TYPE copy_tag AS ENUM ('standard', 'limited', 'unique');
CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE quest_period AS ENUM ('daily', 'weekly');
CREATE TYPE transaction_reason AS ENUM (
  'tutorial_reward',
  'pack_purchase',
  'duplicate_conversion',
  'quest_reward',
  'admin_grant'
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE player_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL UNIQUE,
  friend_code TEXT NOT NULL UNIQUE,
  coins INTEGER NOT NULL DEFAULT 1000 CHECK (coins >= 0),
  selected_core_card_id TEXT,
  tutorial_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type card_type NOT NULL,
  rarity card_rarity NOT NULL,
  faction TEXT NOT NULL,
  mana_cost INTEGER NOT NULL CHECK (mana_cost >= 0),
  cooldown INTEGER NOT NULL CHECK (cooldown >= 0),
  copy_tag copy_tag NOT NULL,
  attack INTEGER CHECK (attack IS NULL OR attack >= 0),
  defense INTEGER CHECK (defense IS NULL OR defense >= 0),
  hp INTEGER CHECK (hp IS NULL OR hp > 0),
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE player_cards (
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id),
  owned_count INTEGER NOT NULL DEFAULT 0 CHECK (owned_count >= 0 AND owned_count <= 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, card_id)
);

CREATE TABLE loadouts (
  id UUID PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  core_card_id TEXT NOT NULL REFERENCES cards(id),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loadout_cards (
  loadout_id UUID NOT NULL REFERENCES loadouts(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (loadout_id, card_id)
);

CREATE TABLE friendships (
  id UUID PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status friend_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);

CREATE TABLE coin_transactions (
  id UUID PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason transaction_reason NOT NULL,
  source_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  cards_per_pack INTEGER NOT NULL CHECK (cards_per_pack > 0),
  drop_table JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE pack_openings (
  id UUID PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id TEXT NOT NULL REFERENCES packs(id),
  results JSONB NOT NULL,
  duplicate_coins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quests (
  id TEXT PRIMARY KEY,
  period quest_period NOT NULL,
  name TEXT NOT NULL,
  objective_type TEXT NOT NULL,
  target_value INTEGER NOT NULL CHECK (target_value > 0),
  reward_coins INTEGER NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE player_quests (
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL REFERENCES quests(id),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  period_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, quest_id)
);

CREATE INDEX player_cards_player_id_idx ON player_cards(player_id);
CREATE INDEX loadouts_player_id_idx ON loadouts(player_id);
CREATE INDEX friendships_addressee_status_idx ON friendships(addressee_id, status);
CREATE INDEX coin_transactions_player_id_created_at_idx ON coin_transactions(player_id, created_at DESC);
CREATE INDEX player_quests_player_id_idx ON player_quests(player_id);

COMMIT;
