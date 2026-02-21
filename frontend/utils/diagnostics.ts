// Script de diagnostic pour vérifier l'état de la base de données
import { createClient } from '@/utils/supabase/client'

export async function runDiagnostics() {
  const supabase = createClient()
  const results: any = {
    timestamp: new Date().toISOString(),
    checks: []
  }

  console.group('🔍 DIAGNOSTICS SUPABASE')

  // 1. Vérifier l'authentification
  console.log('1️⃣ Checking authentication...')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  results.checks.push({
    name: 'Authentication',
    status: user ? '✅ OK' : '❌ FAILED',
    details: user ? `User ID: ${user.id}` : `Error: ${authError?.message}`,
    user_id: user?.id,
    email: user?.email
  })
  console.log(user ? '✅ User authenticated' : '❌ Not authenticated', user)

  if (!user) {
    console.groupEnd()
    return results
  }

  // 2. Vérifier les conversations
  console.log('2️⃣ Checking conversations...')
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id, title, mode, canvas_mode, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  results.checks.push({
    name: 'Conversations',
    status: convError ? '❌ FAILED' : '✅ OK',
    count: conversations?.length || 0,
    error: convError?.message,
    data: conversations
  })
  console.log(convError ? '❌ Error fetching conversations' : `✅ Found ${conversations?.length} conversations`, conversations)

  // 3. Pour chaque conversation, vérifier les messages
  if (conversations && conversations.length > 0) {
    console.log('3️⃣ Checking messages for each conversation...')
    for (const conv of conversations) {
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })

      results.checks.push({
        name: `Messages for conversation "${conv.title || 'Untitled'}"`,
        conversation_id: conv.id,
        mode: conv.mode,
        canvas_mode: conv.canvas_mode,
        status: msgError ? '❌ FAILED' : messages && messages.length > 0 ? '✅ OK' : '⚠️ EMPTY',
        message_count: messages?.length || 0,
        error: msgError?.message,
        sample_messages: messages?.slice(0, 2).map(m => ({ role: m.role, content: m.content.substring(0, 50) }))
      })
      console.log(`  - ${conv.title || 'Untitled'} (${conv.mode}):`, messages?.length || 0, 'messages')
    }
  }

  // 4. Vérifier les modes disponibles
  console.log('4️⃣ Checking conversation modes distribution...')
  const modeDistribution = conversations?.reduce((acc: any, conv) => {
    const mode = conv.mode || 'undefined'
    acc[mode] = (acc[mode] || 0) + 1
    return acc
  }, {})
  results.checks.push({
    name: 'Mode Distribution',
    status: '✅ OK',
    distribution: modeDistribution
  })
  console.log('  Mode distribution:', modeDistribution)

  // 5. Vérifier les conversations avec canvas_mode mais sans mode='canvas'
  console.log('5️⃣ Checking for mismatched canvas conversations...')
  const mismatchedCanvas = conversations?.filter(c =>
    c.canvas_mode && c.mode !== 'canvas'
  )
  if (mismatchedCanvas && mismatchedCanvas.length > 0) {
    results.checks.push({
      name: 'Mismatched Canvas Conversations',
      status: '⚠️ WARNING',
      count: mismatchedCanvas.length,
      details: 'Conversations have canvas_mode but mode is not "canvas"',
      conversations: mismatchedCanvas
    })
    console.warn('⚠️ Found conversations with canvas_mode but mode != "canvas":', mismatchedCanvas)
  } else {
    results.checks.push({
      name: 'Mismatched Canvas Conversations',
      status: '✅ OK',
      count: 0
    })
    console.log('✅ No mismatched canvas conversations')
  }

  console.groupEnd()
  console.log('\n📊 DIAGNOSTIC RESULTS:', results)

  return results
}

// Fonction à appeler depuis la console du navigateur
if (typeof window !== 'undefined') {
  (window as any).runDiagnostics = runDiagnostics
}
