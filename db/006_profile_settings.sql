BEGIN;

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{"font":"default"}'::jsonb;

UPDATE player_profiles
SET settings = '{"font":"default"}'::jsonb
WHERE settings IS NULL;

COMMIT;
