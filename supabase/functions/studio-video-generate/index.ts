// @ts-nocheck
// supabase/functions/studio-video-generate/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('🎬 Video generation request:', JSON.stringify(body, null, 2))

    const {
      prompt,
      model = 'grok-video',
      mode = 'standard',
      duration = 5,
      aspect_ratio = '16:9',
      quality = '720p',
      style = 'none',
      style_description = '',
      sound_enabled = true,
      start_frame_url = null,
      end_frame_url = null,
      source_video_url = null,
      character_image_url = null,
      image_url = null,
      user_id
    } = body

    if (!prompt || !user_id) {
      throw new Error('prompt and user_id are required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Enrichir le prompt avec le style
    let enrichedPrompt = prompt.trim()
    if (style_description && style_description.trim() !== '') {
      enrichedPrompt = `${enrichedPrompt}, ${style_description.trim()}`
    } else if (style && style !== 'none' && style !== 'Aucun (naturel)') {
      enrichedPrompt = `${enrichedPrompt}, ${style} style`
    }

    console.log('🎨 Enriched prompt:', enrichedPrompt)

    let provider_task_id = ''
    let video_id = ''
    let actualModel = model

    // ===== 1. GROK VIDEO (xAI) =====
    if (model === 'grok-video') {
      console.log('🤖 Using Grok Video API...')
      const XAI_API_KEY = Deno.env.get('XAI_API_KEY')
      if (!XAI_API_KEY) throw new Error('XAI_API_KEY not set')

      const grokPayload: any = {
        model: 'grok-imagine-video',
        prompt: enrichedPrompt,
        duration: duration, // 1-15 seconds
        aspect_ratio: aspect_ratio,
        resolution: quality === '1080p' ? '1080p' : '720p'
      }

      // Add image if provided (image-to-video)
      if (start_frame_url || image_url) {
        grokPayload.image = start_frame_url || image_url
      }

      const res = await fetch('https://api.x.ai/v1/videos/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${XAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(grokPayload)
      })

      console.log('🤖 Grok response status:', res.status, res.statusText)
      const rawText = await res.text()
      console.log('🤖 Grok raw response:', rawText)

      let data
      try {
        data = JSON.parse(rawText)
      } catch (e) {
        throw new Error(`Grok API returned non-JSON (${res.status}): ${rawText.substring(0, 200)}`)
      }

      if (!res.ok || data.error) {
        throw new Error(`Grok API Error (${res.status}): ${data.error?.message || JSON.stringify(data)}`)
      }

      // Grok returns request_id for polling
      provider_task_id = data.request_id || data.id
      if (!provider_task_id) {
        throw new Error('No request_id returned from Grok API. Response: ' + JSON.stringify(data))
      }
    }

    // ===== 2. VEO 3.1 (Google) =====
    else if (model === 'veo-3.1') {
      console.log('🎥 Using Veo 3.1 API...')
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
      if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY not set')

      const veoPayload: any = {
        instances: [{
          prompt: enrichedPrompt
        }],
        parameters: {
          aspectRatio: aspect_ratio,
          resolution: quality === '1080p' ? '1080p' : '720p',
          durationSeconds: duration
        }
      }

      // Add reference image if provided (image-to-video)
      if (start_frame_url || image_url) {
        veoPayload.parameters.referenceImages = [{
          referenceType: 'asset',
          imageUri: start_frame_url || image_url
        }]
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
          },
          body: JSON.stringify(veoPayload)
        }
      )

      console.log('🎥 Veo response status:', res.status, res.statusText)
      const rawText = await res.text()
      console.log('🎥 Veo raw response:', rawText.substring(0, 500))

      let data
      try {
        data = JSON.parse(rawText)
      } catch (e) {
        throw new Error(`Veo API returned non-JSON (${res.status}): ${rawText.substring(0, 200)}`)
      }

      if (!res.ok || data.error) {
        throw new Error(`Veo API Error (${res.status}): ${data.error?.message || JSON.stringify(data)}`)
      }

      // Veo returns a long-running operation name
      provider_task_id = data.name || data.operationId
      if (!provider_task_id) {
        throw new Error('No operation ID returned from Veo API')
      }
    }

    // ===== 3. RUNWAY GEN-4 =====
    else if (model === 'runway') {
      console.log('🎬 Using Runway Gen-4 API...')
      const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY')
      if (!RUNWAY_API_KEY) throw new Error('RUNWAY_API_KEY not set')

      // Determine if image-to-video or text-to-video
      const isImageToVideo = !!(start_frame_url || image_url)
      const endpoint = isImageToVideo ? '/v1/image_to_video' : '/v1/text_to_video'

      const runwayPayload: any = {
        model: 'gen4.5',
        promptText: enrichedPrompt,
        duration: duration,
        ratio: aspect_ratio === '16:9' ? '1280:720' : (aspect_ratio === '9:16' ? '720:1280' : '960:960')
      }

      // Add image if provided (image-to-video)
      if (isImageToVideo) {
        runwayPayload.promptImage = start_frame_url || image_url
        runwayPayload.position = 'first'
      }

      const res = await fetch(`https://api.dev.runwayml.com${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RUNWAY_API_KEY}`,
          'X-Runway-Version': '2024-11-06',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(runwayPayload)
      })

      console.log('🎬 Runway response status:', res.status, res.statusText)
      const rawText = await res.text()
      console.log('🎬 Runway raw response:', rawText.substring(0, 500))

      let data
      try {
        data = JSON.parse(rawText)
      } catch (e) {
        throw new Error(`Runway API returned non-JSON (${res.status}): ${rawText.substring(0, 200)}`)
      }

      if (!res.ok || data.error) {
        throw new Error(`Runway API Error (${res.status}): ${data.error?.message || JSON.stringify(data)}`)
      }

      provider_task_id = data.id || data.taskId
      if (!provider_task_id) {
        throw new Error('No task ID returned from Runway API')
      }
    }

    // ===== 4. KLING (fal.ai) =====
    else if (model.includes('kling')) {
      console.log('🎨 Using Kling Video API (fal.ai)...')
      const FAL_API_KEY = Deno.env.get('FAL_API_KEY')
      if (!FAL_API_KEY) throw new Error('FAL_API_KEY not set')

      const isPro = model.includes('pro')
      const videoType = (start_frame_url || image_url) ? 'image-to-video' : 'text-to-video'
      const endpoint = `fal-ai/kling-video/v3/${isPro ? 'pro' : 'standard'}/${videoType}`

      console.log('🎨 Kling endpoint:', endpoint)

      const klingPayload: any = {
        prompt: enrichedPrompt,
        duration: String(duration),
        aspect_ratio: aspect_ratio,
        negative_prompt: 'blur, distort, low quality, watermark',
        cfg_scale: 0.5,
        generate_audio: sound_enabled
      }

      if (start_frame_url || image_url) {
        klingPayload.image_url = start_frame_url || image_url
      }

      const res = await fetch(`https://queue.fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(klingPayload)
      })

      const data = await res.json()
      console.log('🎨 Kling response:', JSON.stringify(data).substring(0, 300))

      if (!res.ok || data.error) {
        throw new Error(`Kling API Error: ${data.error?.message || JSON.stringify(data)}`)
      }

      provider_task_id = data.request_id
      if (!provider_task_id) {
        throw new Error('No request_id returned from Kling API')
      }

      actualModel = `kling-3.0-${isPro ? 'pro' : 'standard'}`
    }

    else {
      throw new Error(`Unsupported model: ${model}`)
    }

    // ===== 5. SAVE TO DATABASE =====
    console.log('💾 Saving to database...', { provider_task_id, model: actualModel })

    const dbPayload: any = {
      user_id,
      prompt: prompt.trim(),
      model: actualModel,
      provider_task_id,
      status: 'processing',
      duration: parseInt(String(duration)),
      aspect_ratio,
      quality,
      style_name: style,
      generate_audio: sound_enabled
    }

    if (start_frame_url) dbPayload.image_url = start_frame_url
    if (source_video_url) dbPayload.source_video_url = source_video_url
    if (character_image_url) dbPayload.character_image_url = character_image_url

    const { data: dbData, error: dbError } = await supabase
      .from('studio_videos')
      .insert(dbPayload)
      .select('id')
      .single()

    if (dbError || !dbData) {
      console.error('💥 Database error:', dbError)
      throw new Error(`Database error: ${dbError?.message || 'No data returned'}`)
    }

    video_id = dbData.id
    console.log('✅ Video record created:', video_id)

    // ===== 6. RETURN SUCCESS =====
    return new Response(JSON.stringify({
      success: true,
      id: video_id,
      provider_task_id,
      request_id: provider_task_id, // Alias for compatibility
      model: actualModel,
      status: 'processing',
      message: 'Video generation started successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (err) {
    const error = err as Error
    console.error('❌ Video generation error:', error.message)
    console.error('❌ Stack trace:', error.stack)

    // Determine appropriate HTTP status code
    let statusCode = 400
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      statusCode = 401
    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
      statusCode = 403
    } else if (error.message.includes('404') || error.message.includes('Not Found')) {
      statusCode = 404
    } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
      statusCode = 500
    }

    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})
