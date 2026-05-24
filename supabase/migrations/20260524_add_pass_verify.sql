-- Add plain-text password column for fallback login when Edge Function is down
ALTER TABLE users ADD COLUMN IF NOT EXISTS pass_verify text;
