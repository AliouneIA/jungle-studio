import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const FAL_API_KEY = Deno.env.get('FAL_API_KEY')
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')

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
    const { image_url, prompt, mode } = await req.json()

    if (!image_url) {
      return new Response(JSON.stringify({ error: 'image_url requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // ═══════════════════════════════════════
    // MODE SUPPRESSION D'OBJET — Gemini Edit
    // ═══════════════════════════════════════
    if (mode === 'remove_object' && prompt) {
      console.log('[remove-bg] Mode remove_object via Gemini, prompt:', prompt)

      // Télécharger l'image source
      const imgResponse = await fetch(image_url)
      const imgBuffer = await imgResponse.arrayBuffer()
      const imgBase64 = encode(new Uint8Array(imgBuffer))
      const mimeType = imgResponse.headers.get('content-type') || 'image/png'

      console.log('[remove-bg] Image téléchargée, taille:', imgBuffer.byteLength)

      // Appel Gemini avec instruction d'édition
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: imgBase64
                  }
                },
                {
                  text: `Remove "${prompt}" from this image completely. Fill in the area naturally with the surrounding background, matching colors and patterns seamlessly. Keep everything else exactly the same.`
                }
              ]
            }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE']
            }
          })
        }
      )

      const geminiData = await geminiRes.json()
      console.log('[remove-bg] Gemini réponse status:', geminiRes.status)

      // Extraire l'image générée
      const candidates = geminiData?.candidates || []
      let generatedImageBase64 = null
      let generatedMimeType = 'image/png'

      for (const candidate of candidates) {
        for (const part of (candidate?.content?.parts || [])) {
          if (part.inlineData) {
            generatedImageBase64 = part.inlineData.data
            generatedMimeType = part.inlineData.mimeType || 'image/png'
            break
          }
        }
        if (generatedImageBase64) break
      }

      if (!generatedImageBase64) {
        console.error('[remove-bg] Gemini n\'a pas retourné d\'image:', JSON.stringify(geminiData).substring(0, 500))
        return new Response(JSON.stringify({
          error: 'Gemini n\'a pas généré d\'image',
          raw: geminiData
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }

      // Uploader l'image résultante dans Supabase Storage
      const imageBytes = Uint8Array.from(atob(generatedImageBase64), c => c.charCodeAt(0))
      const fileName = `edited_${Date.now()}.png`

      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('generated_images')
        .upload(fileName, imageBytes, {
          contentType: generatedMimeType,
          upsert: true
        })

      if (uploadError) {
        console.error('[remove-bg] Erreur upload:', uploadError)
        return new Response(JSON.stringify({ error: 'Erreur upload', detail: uploadError }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }

      const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/generated_images/${fileName}`
      console.log('[remove-bg] Image éditée uploadée:', publicUrl)

      return new Response(JSON.stringify({
        success: true,
        status: 'completed',
        mode: 'remove_object',
        image_url: publicUrl
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // ═══════════════════════════════════════
    // AUTRES MODES (FAL.AI)
    // ═══════════════════════════════════════
    let endpoint: string
    let falPayload: any

    if (prompt) {
      // Mode intelligent / Isoler un élément
      endpoint = 'fal-ai/evf-sam'
      falPayload = {
        image_url: image_url,
        prompt: prompt,
        mask_only: false
      }
      console.log('[remove-bg] Mode intelligent (EVF-SAM), prompt:', prompt)
    } else {
      // Mode automatique
      endpoint = 'fal-ai/birefnet'
      falPayload = {
        image_url: image_url
      }
      console.log('[remove-bg] Mode automatique (birefnet)')
    }

    // Soumission à la queue (pour evf-sam ou birefnet)
    const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(falPayload)
    })

    const submitData = await submitRes.json()
    console.log('[remove-bg] Soumission Fal.ai:', JSON.stringify(submitData).substring(0, 300))

    if (!submitData.request_id) {
      // Résultat direct si disponible
      const imageResult = submitData.image?.url || submitData.output?.url || null
      if (imageResult) {
        return new Response(JSON.stringify({
          success: true,
          status: 'completed',
          image_url: imageResult
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        })
      }
    }

    // Extraire le vrai endpoint pour le polling
    let realEndpoint = endpoint
    if (submitData.status_url) {
      const match = submitData.status_url.match(/queue\.fal\.run\/(.+?)\/requests\//)
      if (match) {
        realEndpoint = match[1]
        console.log('[remove-bg] Endpoint réel extrait:', realEndpoint)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      request_id: submitData.request_id,
      endpoint: realEndpoint,
      mode: mode || (prompt ? 'intelligent' : 'automatic'),
      status: 'processing'
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    console.error('[remove-bg] Erreur:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
