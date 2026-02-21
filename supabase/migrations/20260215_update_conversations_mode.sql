-- Add mode column to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode text DEFAULT 'solo';

-- Backfill Manus conversations
UPDATE conversations
SET mode = 'manus'
WHERE id IN (
  SELECT distinct conversation_id
  FROM messages
  WHERE is_manus = true
);

-- Backfill Supernova conversations
UPDATE conversations
SET mode = 'supernova'
WHERE id IN (
    SELECT distinct conversation_id 
    FROM fusion_runs 
    WHERE fusion_critiques IS NOT NULL 
    AND jsonb_array_length(fusion_critiques) > 0
) AND mode = 'solo';

-- Backfill Fusion conversations
UPDATE conversations
SET mode = 'fusion'
WHERE id IN (
    SELECT distinct conversation_id 
    FROM fusion_runs 
    WHERE (fusion_critiques IS NULL OR jsonb_array_length(fusion_critiques) = 0)
    AND fusion_raw_responses IS NOT NULL 
    AND jsonb_array_length(fusion_raw_responses) > 1
) AND mode = 'solo';
