UPDATE profiles SET username = 'unknown_' || LEFT(user_id::TEXT, 8) WHERE username IS NULL;
UPDATE profiles SET display_name = 'Unknown' WHERE display_name IS NULL;

-- Now enforce NOT NULL
ALTER TABLE profiles
ALTER COLUMN username SET NOT NULL;

ALTER TABLE profiles
ALTER COLUMN display_name SET NOT NULL;
