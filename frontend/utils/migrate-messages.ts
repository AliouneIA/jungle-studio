// Utilitaire pour migrer les anciennes réponses depuis fusion_syntheses vers messages
// Appeler depuis la console du navigateur: window.migrateOldMessages()

import { createClient } from '@/utils/supabase/client'

export async function migrateOldMessages() {
  console.group('🔄 MIGRATION DES ANCIENS MESSAGES')

  const supabase = createClient()

  // 1. Récupérer toutes les synthèses qui n'ont pas de message correspondant
  console.log('1️⃣ Fetching fusion_syntheses without corresponding messages...')

  const { data: syntheses, error: fetchError } = await supabase
    .from('fusion_syntheses')
    .select(`
      id,
      run_id,
      final_content,
      created_at,
      fusion_runs!inner(
        id,
        conversation_id,
        user_id
      )
    `)
    .order('created_at', { ascending: true })

  if (fetchError) {
    console.error('❌ Error fetching syntheses:', fetchError)
    console.groupEnd()
    return { success: false, error: fetchError }
  }

  console.log(`✅ Found ${syntheses?.length || 0} fusion syntheses`)

  if (!syntheses || syntheses.length === 0) {
    console.log('ℹ️ No syntheses to migrate')
    console.groupEnd()
    return { success: true, migrated: 0 }
  }

  // 2. Pour chaque synthèse, vérifier si un message assistant existe déjà
  let migratedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const synthesis of syntheses) {
    const runData = Array.isArray(synthesis.fusion_runs)
      ? synthesis.fusion_runs[0]
      : synthesis.fusion_runs

    if (!runData) {
      console.warn('⚠️ No run data for synthesis:', synthesis.id)
      skippedCount++
      continue
    }

    // Vérifier si un message existe déjà
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('fusion_run_id', runData.id)
      .eq('role', 'assistant')
      .single()

    if (existing) {
      skippedCount++
      continue
    }

    // Insérer le message
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: runData.conversation_id,
        user_id: runData.user_id,
        role: 'assistant',
        content: synthesis.final_content,
        is_fusion_result: true,
        fusion_run_id: runData.id,
        created_at: synthesis.created_at
      })

    if (insertError) {
      console.error(`❌ Error inserting message for run ${runData.id}:`, insertError)
      errorCount++
    } else {
      migratedCount++
      if (migratedCount % 10 === 0) {
        console.log(`✅ Migrated ${migratedCount} messages...`)
      }
    }
  }

  console.log('\n📊 MIGRATION SUMMARY:')
  console.log(`✅ Migrated: ${migratedCount} messages`)
  console.log(`⏭️ Skipped: ${skippedCount} messages (already exist)`)
  console.log(`❌ Errors: ${errorCount} messages`)
  console.groupEnd()

  return {
    success: errorCount === 0,
    migrated: migratedCount,
    skipped: skippedCount,
    errors: errorCount
  }
}

// Exposer dans la console du navigateur
if (typeof window !== 'undefined') {
  (window as any).migrateOldMessages = migrateOldMessages
}
