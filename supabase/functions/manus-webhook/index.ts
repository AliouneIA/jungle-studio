// supabase/functions/manus-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const payload = await req.json()
    const eventType = payload.event_type

    console.log(`📩 Manus webhook: ${eventType}`, JSON.stringify(payload))

    if (eventType === 'task_created') {
      const { task_id, task_url } = payload.task_detail
      // Mettre à jour le message avec l'URL de la tâche
      await supabase.from('messages')
        .update({
          manus_task_url: task_url,
          manus_status: 'running'
        })
        .eq('manus_task_id', task_id)

    } else if (eventType === 'task_progress') {
      const { task_id, message, progress_type } = payload.progress_detail

      // Tentative d'insertion dans manus_progress (ignore si la table n'existe pas encore)
      try {
        await supabase.from('manus_progress').insert({
          task_id,
          progress_type: progress_type,
          message,
          received_at: new Date().toISOString()
        })
      } catch (e: unknown) {
        const error = e as Error;
        console.warn('Table manus_progress non disponible:', error.message)
      }

      // Mettre à jour le statut texte du message pour feedback UI immédiat
      await supabase.from('messages')
        .update({ manus_status_text: message })
        .eq('manus_task_id', task_id)

    } else if (eventType === 'task_stopped') {
      const { task_id, message, attachments, stop_reason } = payload.task_detail

      // Parser le message si c'est du JSON structuré
      let finalContent = message
      let structured = null
      try {
        const parsed = JSON.parse(message)
        if (parsed.final_answer) {
          finalContent = parsed.final_answer
          structured = parsed
        }
      } catch {
        // Pas du JSON, garder le message tel quel
      }

      // Assurer que le contenu n'est pas la chaîne technique brute
      if (finalContent && finalContent.startsWith('MANUS_TASK::')) {
        finalContent = 'Mission Manus terminée. Consultez le journal de bord pour plus de détails.'
      }

      await supabase.from('messages')
        .update({
          content: finalContent,
          manus_status: stop_reason === 'finish' ? 'completed' : 'failed',
          manus_attachments: attachments || [],
          manus_structured: structured || payload.task_detail
        })
        .eq('manus_task_id', task_id)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Webhook Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
