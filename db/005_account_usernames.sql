BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS normalized_username TEXT,
  ADD COLUMN IF NOT EXISTS username_last_changed_at TIMESTAMPTZ;

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS normalized_username TEXT,
  ADD COLUMN IF NOT EXISTS username_last_changed_at TIMESTAMPTZ;

WITH generated AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(
        CASE
          WHEN LENGTH(base_name) < 3 THEN RPAD(base_name, 3, '_')
          ELSE base_name
        END
      )
      ORDER BY created_at, id
    ) AS duplicate_number,
    CASE
      WHEN LENGTH(base_name) < 3 THEN RPAD(base_name, 3, '_')
      ELSE base_name
    END AS seed_name
  FROM (
    SELECT
      id,
      created_at,
      LEFT(
        COALESCE(
          NULLIF(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^A-Za-z0-9_]+', '_', 'g'), ''),
          'player'
        ),
        16
      ) AS base_name
    FROM users
    WHERE username IS NULL OR normalized_username IS NULL
  ) source
),
final_names AS (
  SELECT
    id,
    CASE
      WHEN duplicate_number = 1 THEN seed_name
      ELSE LEFT(seed_name, GREATEST(3, 16 - LENGTH(duplicate_number::text))) || duplicate_number::text
    END AS username
  FROM generated
)
UPDATE users
SET
  username = final_names.username,
  normalized_username = LOWER(final_names.username)
FROM final_names
WHERE users.id = final_names.id;

UPDATE player_profiles profile
SET
  username = COALESCE(profile.username, users.username),
  normalized_username = COALESCE(profile.normalized_username, users.normalized_username),
  username_last_changed_at = COALESCE(profile.username_last_changed_at, users.username_last_changed_at),
  display_name = COALESCE(profile.username, users.username, profile.display_name)
FROM users
WHERE users.id = profile.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS users_normalized_username_unique_idx
  ON users(normalized_username)
  WHERE normalized_username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS player_profiles_normalized_username_unique_idx
  ON player_profiles(normalized_username)
  WHERE normalized_username IS NOT NULL;

COMMIT;
