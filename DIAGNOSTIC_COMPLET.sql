-- ===================================================================
-- DIAGNOSTIC COMPLET DES MESSAGES MANQUANTS
-- ===================================================================

-- 1. Conversations sans aucun message
SELECT
    'Conversations VIDES (aucun message)' as diagnostic,
    COUNT(*) as count
FROM conversations c
WHERE NOT EXISTS (
    SELECT 1 FROM messages m WHERE m.conversation_id = c.id
);

-- 2. Conversations avec seulement message user (pas de réponse)
SELECT
    'Conversations avec SEULEMENT question user' as diagnostic,
    COUNT(*) as count
FROM conversations c
WHERE EXISTS (
    SELECT 1 FROM messages m
    WHERE m.conversation_id = c.id AND m.role = 'user'
)
AND NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.conversation_id = c.id AND m.role = 'assistant'
);

-- 3. Fusion runs qui ont une synthèse mais pas de message assistant
SELECT
    'Fusion runs avec synthèse MAIS pas de message assistant' as diagnostic,
    COUNT(*) as count
FROM fusion_runs fr
INNER JOIN fusion_syntheses fs ON fs.run_id = fr.id
WHERE NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.fusion_run_id = fr.id AND m.role = 'assistant'
);

-- 4. Liste détaillée des 10 conversations les plus récentes avec leurs messages
SELECT
    c.id,
    c.title,
    c.mode,
    c.created_at,
    (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as total_messages,
    (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND role = 'user') as user_messages,
    (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND role = 'assistant') as assistant_messages,
    (SELECT COUNT(*) FROM fusion_runs WHERE conversation_id = c.id) as fusion_runs_count,
    (SELECT COUNT(*) FROM fusion_syntheses fs
     INNER JOIN fusion_runs fr ON fs.run_id = fr.id
     WHERE fr.conversation_id = c.id) as syntheses_count
FROM conversations c
ORDER BY c.created_at DESC
LIMIT 10;

-- 5. Vérifier si les questions user sont aussi manquantes
SELECT
    'Fusion runs SANS message user' as diagnostic,
    COUNT(*) as count
FROM fusion_runs fr
WHERE NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.conversation_id = fr.conversation_id
    AND m.role = 'user'
    AND m.created_at <= fr.created_at + interval '1 minute'
    AND m.created_at >= fr.created_at - interval '1 minute'
);
