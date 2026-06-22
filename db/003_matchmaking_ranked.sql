BEGIN;

DO $$
BEGIN
  CREATE TYPE match_mode AS ENUM ('friend', 'casual', 'ranked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ranked_ratings (
  player_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 1000 CHECK (rating >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matchmaking_queue (
  player_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode match_mode NOT NULL CHECK (mode IN ('casual', 'ranked')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE online_matches
  ADD COLUMN IF NOT EXISTS mode match_mode NOT NULL DEFAULT 'friend';

ALTER TABLE match_history
  ADD COLUMN IF NOT EXISTS mode match_mode NOT NULL DEFAULT 'friend';

ALTER TABLE match_history
  ADD COLUMN IF NOT EXISTS rating_before INTEGER;

ALTER TABLE match_history
  ADD COLUMN IF NOT EXISTS rating_after INTEGER;

ALTER TABLE match_history
  ADD COLUMN IF NOT EXISTS rank_tier_before TEXT;

ALTER TABLE match_history
  ADD COLUMN IF NOT EXISTS rank_tier_after TEXT;

CREATE INDEX IF NOT EXISTS idx_online_matches_mode_status ON online_matches(mode, status);
CREATE INDEX IF NOT EXISTS idx_match_history_mode_result ON match_history(mode, result);
CREATE INDEX IF NOT EXISTS idx_ranked_ratings_rating ON ranked_ratings(rating DESC);

COMMIT;
