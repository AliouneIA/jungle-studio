-- ===================================================================
-- MIGRATION URGENTE : Récupérer les anciennes réponses LLM
-- ===================================================================
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- https://supabase.com/dashboard/project/xrhcaskiudkszbrhuisu/sql
-- ===================================================================

-- ÉTAPE 1 : Vérifier combien de messages manquent
SELECT
    COUNT(*) as "Nombre de réponses à migrer"
FROM fusion_syntheses fs
INNER JOIN fusion_runs fr ON fs.run_id = fr.id
WHERE NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.fusion_run_id = fr.id
    AND m.role = 'assistant'
);

-- ÉTAPE 2 : Migrer les réponses manquantes
INSERT INTO messages (
    conversation_id,
    user_id,
    role,
    content,
    is_fusion_result,
    fusion_run_id,
    created_at
)
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
    SELECT 1 FROM messages m
    WHERE m.fusion_run_id = fr.id
    AND m.role = 'assistant'
)
ORDER BY fs.created_at;

-- ÉTAPE 3 : Vérifier le résultat
SELECT
    c.id,
    c.title,
    c.mode,
    COUNT(m.id) as "Nombre de messages",
    COUNT(CASE WHEN m.role = 'user' THEN 1 END) as "Messages user",
    COUNT(CASE WHEN m.role = 'assistant' THEN 1 END) as "Messages assistant"
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.mode IN ('fusion', 'supernova', 'manus')
GROUP BY c.id, c.title, c.mode
ORDER BY c.created_at DESC
LIMIT 10;
