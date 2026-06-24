BEGIN;

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{"font":"poppins"}'::jsonb;

UPDATE player_profiles
SET settings = '{"font":"poppins"}'::jsonb
WHERE settings IS NULL;

COMMIT;
