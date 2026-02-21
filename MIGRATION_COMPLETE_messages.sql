-- ===================================================================
-- MIGRATION COMPLÈTE : Questions user + Réponses assistant
-- ===================================================================

-- PARTIE 1 : Migrer les QUESTIONS user manquantes
INSERT INTO messages (
    conversation_id,
    user_id,
    role,
    content,
    is_fusion_result,
    created_at
)
SELECT DISTINCT ON (fr.id)
    fr.conversation_id,
    fr.user_id,
    'user' as role,
    fr.prompt_original as content,
    false as is_fusion_result,
    fr.created_at - interval '1 second' as created_at
FROM fusion_runs fr
WHERE NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.conversation_id = fr.conversation_id
    AND m.role = 'user'
    AND m.created_at BETWEEN (fr.created_at - interval '2 minutes') AND (fr.created_at + interval '1 minute')
)
ORDER BY fr.id, fr.created_at;

-- PARTIE 2 : Migrer les RÉPONSES assistant manquantes
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
    COALESCE(fs.final_content, 'Réponse non disponible') as content,
    true as is_fusion_result,
    fr.id as fusion_run_id,
    COALESCE(fs.created_at, fr.created_at) as created_at
FROM fusion_runs fr
LEFT JOIN fusion_syntheses fs ON fs.run_id = fr.id
WHERE NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.fusion_run_id = fr.id
    AND m.role = 'assistant'
)
ORDER BY fr.created_at;

-- PARTIE 3 : Statistiques après migration
SELECT
    'RÉSULTAT DE LA MIGRATION' as info,
    (SELECT COUNT(*) FROM conversations) as total_conversations,
    (SELECT COUNT(*) FROM messages) as total_messages,
    (SELECT COUNT(*) FROM messages WHERE role = 'user') as messages_user,
    (SELECT COUNT(*) FROM messages WHERE role = 'assistant') as messages_assistant,
    (SELECT COUNT(*) FROM conversations WHERE NOT EXISTS (
        SELECT 1 FROM messages WHERE messages.conversation_id = conversations.id
    )) as conversations_vides;
