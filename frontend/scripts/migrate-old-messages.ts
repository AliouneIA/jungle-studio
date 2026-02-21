// Script pour migrer les anciennes réponses depuis fusion_syntheses vers messages
// À exécuter une seule fois pour récupérer les anciennes conversations

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function migrateOldMessages() {
  console.log('🔄 Starting migration of old messages from fusion_syntheses...')

  // Exécuter la migration SQL
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
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
        SELECT 1 FROM messages m
        WHERE m.fusion_run_id = fr.id
        AND m.role = 'assistant'
      )
      ORDER BY fs.created_at;
    `
  })

  if (error) {
    console.error('❌ Migration failed:', error)
    return
  }

  console.log('✅ Migration completed successfully!')
  console.log('ℹ️ Data:', data)
}

migrateOldMessages()
