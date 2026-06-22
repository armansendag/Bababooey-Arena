BEGIN;

CREATE TYPE friend_challenge_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
CREATE TYPE online_match_status AS ENUM ('active', 'finished', 'abandoned');

ALTER TYPE transaction_reason ADD VALUE IF NOT EXISTS 'match_win_reward';
ALTER TYPE transaction_reason ADD VALUE IF NOT EXISTS 'match_loss_reward';

CREATE TABLE friend_challenges (
  id UUID PRIMARY KEY,
  challenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenged_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status friend_challenge_status NOT NULL DEFAULT 'pending',
  match_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (challenger_id <> challenged_id)
);

CREATE TABLE online_matches (
  id UUID PRIMARY KEY,
  challenge_id UUID REFERENCES friend_challenges(id),
  status online_match_status NOT NULL DEFAULT 'active',
  player_one_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_two_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES users(id),
  player_one_loadout_snapshot JSONB NOT NULL,
  player_two_loadout_snapshot JSONB NOT NULL,
  latest_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE friend_challenges
  ADD CONSTRAINT friend_challenges_match_id_fk
  FOREIGN KEY (match_id) REFERENCES online_matches(id);

CREATE TABLE online_match_events (
  match_id UUID NOT NULL REFERENCES online_matches(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  turn_number INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  player_id UUID REFERENCES users(id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, sequence)
);

CREATE TABLE match_history (
  id UUID PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES online_matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('win', 'loss')),
  reward_coins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX friend_challenges_challenged_status_idx ON friend_challenges(challenged_id, status);
CREATE INDEX online_matches_player_one_idx ON online_matches(player_one_id, created_at DESC);
CREATE INDEX online_matches_player_two_idx ON online_matches(player_two_id, created_at DESC);
CREATE INDEX match_history_player_idx ON match_history(player_id, created_at DESC);

COMMIT;
