// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ""

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const body = await req.json()
    console.log('🎨 Studio request:', JSON.stringify(body))
    console.log('🔑 GOOGLE_API_KEY:', Deno.env.get('GOOGLE_API_KEY') ? 'OK' : 'MISSING')
    console.log('🔑 XAI_API_KEY:', Deno.env.get('XAI_API_KEY') ? 'OK' : 'MISSING')

    const { prompt, model, count, ratio, quality, style, style_description, user_id, reference_image_url, upscale, source = 'studio' } = body
    const countInt = parseInt(String(count)) || 1

    const batch_id = body.batch_id || crypto.randomUUID()
    // Enrichir le prompt avec le style
    let enrichedPrompt = prompt
    if (style_description && style_description.trim() !== '') {
      enrichedPrompt = `${prompt.trim()}, ${style_description.trim()}`
    } else if (style && style !== 'none' && style !== 'Aucun (naturel)') {
      enrichedPrompt = `${prompt.trim()}, ${style} style`
    }

    console.log('🎨 Enriched prompt:', enrichedPrompt)

    // Mappage des dimensions pour Gemini
    const ratioToDimension: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '4:3': '1024x1024', // Fallback
      '3:2': '1024x1024'  // Fallback
    }

    // Générer count images en parallèle
    const promises = Array.from({ length: countInt }, async () => {
      let imageUrl = null

      if (model === 'nano-banana-pro' || !model) {
        // Appeler Gemini 3 Pro Preview Image
        const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')
        if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not set (Server Side)")

        let parts: any[] = [{ text: enrichedPrompt }]
        let generationConfig: any = {
          // responseModalities: ['IMAGE'], // Parfois supporté, parfois non
          // imageDimension: ratioToDimension[ratio] || '1024x1024'
        }

        // Si mode upscale avec image de référence
        if (upscale && reference_image_url) {
          console.log('🔍 Upscale mode - downloading reference image...')
          try {
            const imgRes = await fetch(reference_image_url)
            const imgBuffer = new Uint8Array(await imgRes.arrayBuffer())
            let binary = ''
            const chunkSize = 8192
            for (let i = 0; i < imgBuffer.length; i += chunkSize) {
              binary += String.fromCharCode(...imgBuffer.subarray(i, i + chunkSize))
            }
            const base64 = btoa(binary)
            const ext = reference_image_url.split('.').pop()?.toLowerCase() || 'jpg'
            const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'

            parts = [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: enrichedPrompt }
            ]
            generationConfig = {
              responseModalities: ['IMAGE', 'TEXT']
            }
          } catch (e) {
            console.error('❌ Error downloading reference image:', e)
            // Fallback to text prompt only if download fails
          }
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig,
              // Ajout de safetySettings permissifs pour éviter les blocages silencieux qui causent des erreurs 500
              safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
              ]
            })
          }
        )
        const data = await res.json()
        if (data.error) throw new Error(`Gemini API Error: ${data.error.message || JSON.stringify(data.error)}`)

        // NOTE: L'API Gemini retourne souvent du base64 dans `inlineData`.
        const inlineData = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData
        if (!inlineData && !data.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error("No image data returned from Gemini (Safety block or model error). Response: " + JSON.stringify(data))
        }

        if (inlineData && inlineData.mimeType.startsWith('image')) {
          // Upload to Supabase Storage
          const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
          const buffer = Uint8Array.from(atob(inlineData.data), c => c.charCodeAt(0))
          const fileName = `${user_id}/${crypto.randomUUID()}.png`

          const { data: uploadData, error: uploadError } = await supabaseAdmin
            .storage
            .from('generated_images')
            .upload(fileName, buffer, { contentType: 'image/png', upsert: true })

          if (uploadError) throw new Error(`Storage Upload Error: ${uploadError.message}`)

          const { data: { publicUrl } } = supabaseAdmin
            .storage
            .from('generated_images')
            .getPublicUrl(fileName)

          imageUrl = publicUrl
        } else {
          // Fallback si Gemini renvoie du texte (ex: "Je ne peux pas générer ça")
          const textResp = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
          if (textResp) throw new Error("Gemini refused to generate image: " + textResp)
        }

      } else if (model === 'grok-imagine-pro') {
        const XAI_API_KEY = Deno.env.get('XAI_API_KEY')
        if (!XAI_API_KEY) throw new Error("XAI_API_KEY not set")

        const res = await fetch('https://api.x.ai/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${XAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'grok-imagine-image-pro',
            prompt: enrichedPrompt,
            n: 1
          })
        })

        const data = await res.json()
        console.log('🤖 Grok response:', JSON.stringify(data))
        if (data.error) throw new Error(`xAI API Error: ${data.error.message || JSON.stringify(data.error)}`)
        imageUrl = data.data?.[0]?.url
      }

      return imageUrl
    })

    const imageUrls = (await Promise.all(promises)).filter((url: string | null): url is string => url !== null)

    if (imageUrls.length === 0) {
      throw new Error("No images generated (All promises failed or returned null)")
    }

    // Stocker en base
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Insérer les images générées
    await Promise.all(imageUrls.map(async (url: string) => {
      return supabase.from('studio_images').insert({
        user_id: user_id, // Ensure user_id is passed correctly in JSON body
        prompt: prompt,
        model: model || 'nano-banana-pro',
        ratio: ratio || '1:1',
        quality: quality || 'standard',
        style_name: style || null,
        image_url: url,
        batch_id: batch_id,
        source: source
      })
    }))

    return new Response(JSON.stringify({
      batch_id,
      images: imageUrls,
      count: imageUrls.length
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    const error = err as Error
    console.error('❌ Studio error:', error.message, error.stack)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, // Return 400 to show message in frontend instead of generic 500
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})

