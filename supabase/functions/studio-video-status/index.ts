// @ts-nocheck
// supabase/functions/studio-video-status/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FAL_API_KEY = Deno.env.get('FAL_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    })
  }

  try {
    const body = await req.json()
    const { request_id } = body

    // Endpoint par défaut ou spécifié
    let endpoint = body.endpoint || 'fal-ai/kling-video/v3/standard/text-to-video'

    // Vérifier si c'est une décomposition
    const isDecomposition = endpoint.includes('qwen-image-layered')

    console.log('[studio-status] Polling:', endpoint, request_id)

    // Vérifier le statut sur fal.ai
    const statusRes = await fetch(
      `https://queue.fal.run/${endpoint}/requests/${request_id}/status?logs=1`,
      {
        method: 'GET',
        headers: { 'Authorization': `Key ${FAL_API_KEY}` }
      }
    )

    if (!statusRes.ok) {
      const errText = await statusRes.text()
      console.error('[studio-status] Status API error:', statusRes.status, errText)
      return new Response(JSON.stringify({ error: `Fal.ai Status API Error (${statusRes.status})`, details: errText.substring(0, 200) }), {
        status: statusRes.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const statusRaw = await statusRes.text()
    let statusData
    try {
      statusData = JSON.parse(statusRaw)
    } catch (e) {
      console.error('[studio-status] Status non-JSON:', statusRaw)
      throw new Error(`Invalid status JSON: ${statusRaw.substring(0, 100)}`)
    }

    console.log('[studio-status] Status:', statusData.status)

    // Si terminé, récupérer le résultat
    if (statusData.status === 'COMPLETED') {
      let resultData
      try {
        const resultRes = await fetch(
          `https://queue.fal.run/${endpoint}/requests/${request_id}`,
          {
            method: 'GET',
            headers: { 'Authorization': `Key ${FAL_API_KEY}` }
          }
        )
        const resultRaw = await resultRes.text()

        if (!resultRes.ok) {
          console.error('[video-status] Result API error:', resultRes.status, resultRaw)
          throw new Error(`Result API Error (${resultRes.status}): ${resultRaw.substring(0, 100)}`)
        }

        try {
          resultData = JSON.parse(resultRaw)
        } catch (e) {
          console.error('[video-status] Result non-JSON:', resultRaw)
          throw new Error(`Invalid result JSON: ${resultRaw.substring(0, 100)}`)
        }

        console.log('[video-status] COMPLETED — clés:', Object.keys(resultData))
      } catch (err) {
        console.error('[video-status] Erreur récupération résultat:', err)
        return new Response(JSON.stringify({ status: 'error', error: 'Erreur récupération résultat', details: String(err) }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }

      // 1. Extraire les types de données possibles
      const videoUrl = resultData?.video?.url || resultData?.output?.video_url || null
      const imageUrl = resultData?.image?.url || resultData?.output?.image_url || resultData?.images?.[0]?.url || null
      const images = resultData?.images || resultData?.output?.images || null
      const layers = resultData?.layers || images || resultData?.output?.layers || []

      // 2. Mettre à jour la DB si c'est une vidéo (présente dans studio_videos)
      if (videoUrl && !isDecomposition) {
        try {
          const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
          await supabase
            .from('studio_videos')
            .update({
              status: 'completed',
              video_url: videoUrl,
              thumbnail_url: resultData?.video?.thumbnail_url || null,
              completed_at: new Date().toISOString()
            })
            .eq('provider_task_id', request_id)
        } catch (dbErr) {
          console.warn('[video-status] DB update skip:', String(dbErr))
        }
      }

      // 3. Retourner le résultat générique
      return new Response(JSON.stringify({
        status: 'completed',
        video_url: videoUrl,
        image: resultData?.image || null,
        image_url: imageUrl,
        images: images,
        layers: layers,
        raw: resultData
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Si échoué
    if (statusData.status === 'FAILED') {
      const errorMsg = statusData.error || 'Erreur inconnue'
      console.error('[studio-status] FAILED:', errorMsg)

      if (!isDecomposition) {
        try {
          const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
          await supabase
            .from('studio_videos')
            .update({ status: 'failed', completed_at: new Date().toISOString() })
            .eq('provider_task_id', request_id)
        } catch (e) { }
      }

      return new Response(JSON.stringify({
        status: 'failed',
        error: errorMsg
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // En cours ou en queue
    return new Response(JSON.stringify({
      status: statusData.status === 'IN_QUEUE' ? 'queued' : 'processing',
      queue_position: statusData.queue_position || null,
      logs: statusData.logs || []
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    console.error('[studio-status] Erreur fatale:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
