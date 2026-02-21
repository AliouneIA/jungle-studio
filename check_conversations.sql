-- Vérifier l'état des conversations
SELECT
  id,
  title,
  mode,
  canvas_mode,
  created_at,
  (SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id) as message_count
FROM conversations
ORDER BY created_at DESC
LIMIT 20;

-- Compter les conversations par mode
SELECT
  mode,
  COUNT(*) as count
FROM conversations
GROUP BY mode;

-- Vérifier les conversations sans mode défini
SELECT
  id,
  title,
  mode,
  created_at
FROM conversations
WHERE mode IS NULL OR mode = ''
ORDER BY created_at DESC
LIMIT 10;
