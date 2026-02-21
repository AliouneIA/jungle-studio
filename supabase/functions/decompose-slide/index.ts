// @ts-nocheck
// supabase/functions/decompose-slide/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const FAL_API_KEY = Deno.env.get('FAL_API_KEY')

serve(async (req: Request) => {
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
    const { image_url, num_layers } = await req.json()

    if (!image_url) {
      return new Response(JSON.stringify({ error: 'image_url requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const endpoint = 'fal-ai/qwen-image-layered'
    console.log('[decompose-slide] Soumission à fal.ai:', image_url, 'en', num_layers || 6, 'calques')

    // Soumettre à la queue fal.ai
    const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: image_url,
        num_layers: num_layers || 6
      })
    })

    const submitData = await submitRes.json()
    console.log('[decompose-slide] Réponse soumission:', JSON.stringify(submitData))

    if (!submitData.request_id) {
      console.error('[decompose-slide] Pas de request_id!')
      return new Response(JSON.stringify({ error: 'Pas de request_id de fal.ai', raw: submitData }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    let realEndpoint = endpoint
    if (submitData.status_url) {
      const match = submitData.status_url.match(/queue\.fal\.run\/(.+?)\/requests\//)
      if (match) {
        realEndpoint = match[1]
        console.log('[decompose-slide] Endpoint réel extrait:', realEndpoint)
      }
    }

    // Retourner le request_id au frontend
    return new Response(JSON.stringify({
      success: true,
      request_id: submitData.request_id,
      endpoint: realEndpoint,
      status: 'processing',
      message: 'Décomposition soumise à fal.ai'
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    const error = err as Error
    console.error('[decompose-slide] Erreur:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
