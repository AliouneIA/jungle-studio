// Script de test pour vérifier le chargement des messages
// À exécuter dans la console : window.testMessages()

import { createClient } from '@/utils/supabase/client'

export async function testMessages() {
  console.group('🧪 TEST CHARGEMENT DES MESSAGES')

  const supabase = createClient()

  // 1. Vérifier l'authentification
  console.log('1️⃣ Checking auth...')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('❌ Not authenticated')
    console.groupEnd()
    return
  }
  console.log('✅ User:', user.email)

  // 2. Récupérer la première conversation
  console.log('2️⃣ Fetching first conversation...')
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (convError || !conversations || conversations.length === 0) {
    console.error('❌ No conversations found:', convError)
    console.groupEnd()
    return
  }

  const conv = conversations[0]
  console.log('✅ Conversation:', conv.id, conv.title, conv.mode)

  // 3. Charger les messages de cette conversation
  console.log('3️⃣ Loading messages for conversation:', conv.id)
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })

  if (msgError) {
    console.error('❌ Error loading messages:', msgError)
    console.groupEnd()
    return
  }

  console.log(`✅ Loaded ${messages?.length || 0} messages`)

  if (messages && messages.length > 0) {
    console.log('📝 Messages:')
    messages.forEach((m, i) => {
      console.log(`  ${i + 1}. [${m.role}] ${m.content.substring(0, 100)}...`)
    })
  } else {
    console.warn('⚠️ No messages found for this conversation!')
  }

  // 4. Vérifier si c'est une conversation fusion/supernova
  if (conv.mode === 'fusion' || conv.mode === 'supernova') {
    console.log('4️⃣ Checking fusion_runs...')
    const { data: runs, error: runsError } = await supabase
      .from('fusion_runs')
      .select('*, fusion_syntheses(*)')
      .eq('conversation_id', conv.id)

    if (runsError) {
      console.error('❌ Error loading fusion_runs:', runsError)
    } else {
      console.log(`✅ Found ${runs?.length || 0} fusion runs`)
      if (runs && runs.length > 0) {
        runs.forEach((run, i) => {
          const hasSynthesis = run.fusion_syntheses && run.fusion_syntheses.length > 0
          console.log(`  ${i + 1}. Run ${run.id}: ${hasSynthesis ? '✅ Has synthesis' : '❌ No synthesis'}`)
        })
      }
    }
  }

  console.groupEnd()

  return {
    conversation: conv,
    messages: messages || [],
    messageCount: messages?.length || 0
  }
}

// Exposer dans la console
if (typeof window !== 'undefined') {
  (window as any).testMessages = testMessages
}
