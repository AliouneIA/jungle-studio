-- Add canvas_mode column to conversations table
-- This column stores the type of canvas (doc or code) for canvas conversations

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS canvas_mode text;

-- Clean up any invalid data (set invalid values to NULL)
UPDATE conversations
SET canvas_mode = NULL
WHERE canvas_mode IS NOT NULL
  AND canvas_mode NOT IN ('doc', 'code');

-- For canvas mode conversations without canvas_mode, set default to 'doc'
UPDATE conversations
SET canvas_mode = 'doc'
WHERE mode = 'canvas'
  AND canvas_mode IS NULL;

-- Drop existing constraint if it exists
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS canvas_mode_check;

-- Add a check constraint to ensure valid values
ALTER TABLE conversations ADD CONSTRAINT canvas_mode_check
  CHECK (canvas_mode IS NULL OR canvas_mode IN ('doc', 'code'));

-- Comment for documentation
COMMENT ON COLUMN conversations.canvas_mode IS 'Type of canvas: doc (document) or code (code editor). Only used when mode = canvas';
