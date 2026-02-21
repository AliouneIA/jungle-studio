-- Add mode column to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode text DEFAULT 'solo';

-- Backfill Manus
UPDATE conversations
SET mode = 'manus'
WHERE id IN (
  SELECT distinct conversation_id
  FROM messages
  WHERE is_manus = true
);

-- Backfill Supernova
-- La logique est de trouver les conversations qui ont au moins un run avec des critiques dans la table fusion_critiques
UPDATE conversations
SET mode = 'supernova'
WHERE id IN (
    SELECT distinct fr.conversation_id 
    FROM fusion_runs fr
    INNER JOIN fusion_critiques fc ON fc.run_id = fr.id
) AND mode = 'solo';

-- Backfill Fusion
-- Trouver les conversations avec des runs ayant > 1 réponse brute et AUCUNE critique
UPDATE conversations
SET mode = 'fusion'
WHERE id IN (
    SELECT distinct fr.conversation_id 
    FROM fusion_runs fr
    INNER JOIN fusion_raw_responses frr ON frr.run_id = fr.id
    WHERE NOT EXISTS (
        SELECT 1 FROM fusion_critiques fc WHERE fc.run_id = fr.id
    )
    GROUP BY fr.conversation_id, fr.id
    HAVING count(frr.id) > 1
) AND mode = 'solo';
