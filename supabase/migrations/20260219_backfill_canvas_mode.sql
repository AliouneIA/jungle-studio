-- Backfill canvas mode for conversations
-- Set mode = 'canvas' for conversations that have canvas_mode defined

UPDATE conversations
SET mode = 'canvas'
WHERE canvas_mode IS NOT NULL
  AND canvas_mode IN ('doc', 'code')
  AND (mode IS NULL OR mode = 'solo');

-- Add comment for documentation
COMMENT ON COLUMN conversations.mode IS 'Conversation mode: solo (default), fusion, supernova, manus, or canvas';
