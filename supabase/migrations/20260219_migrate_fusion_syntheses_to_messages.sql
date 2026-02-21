-- Migration pour récupérer les anciennes réponses des fusion_syntheses et les insérer dans messages
-- Cela corrige le problème où les anciennes conversations n'affichent que la question user, pas la réponse

-- Insérer les réponses manquantes depuis fusion_syntheses
INSERT INTO messages (conversation_id, user_id, role, content, is_fusion_result, fusion_run_id, created_at)
SELECT
  fr.conversation_id,
  fr.user_id,
  'assistant' as role,
  fs.final_content as content,
  true as is_fusion_result,
  fr.id as fusion_run_id,
  fs.created_at
FROM fusion_syntheses fs
INNER JOIN fusion_runs fr ON fs.run_id = fr.id
WHERE NOT EXISTS (
  -- Vérifier qu'il n'existe pas déjà un message assistant pour ce run
  SELECT 1 FROM messages m
  WHERE m.fusion_run_id = fr.id
  AND m.role = 'assistant'
)
ORDER BY fs.created_at;

-- Afficher un compte des messages migrés
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM messages
  WHERE is_fusion_result = true
  AND created_at >= NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Migration completed: % assistant messages migrated from fusion_syntheses to messages', migrated_count;
END $$;
