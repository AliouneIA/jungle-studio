// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function downloadAndStoreVideo(
  videoUrl: string,
  videoId: string,
  supabase: any,
  apiKey?: string
): Promise<string> {
  try {
    const downloadUrl = apiKey
      ? (videoUrl.includes('?') ? `${videoUrl}&key=${apiKey}` : `${videoUrl}?key=${apiKey}`)
      : videoUrl

    console.log('📥 Downloading video to Storage...')
    const videoRes = await fetch(downloadUrl)
    if (!videoRes.ok) {
      console.error('❌ Download failed:', videoRes.status)
      return videoUrl
    }

    const videoBlob = await videoRes.arrayBuffer()
    const fileName = `generated/${videoId}.mp4`

    const { error: uploadError } = await supabase.storage
      .from('studio')
      .upload(fileName, videoBlob, {
        contentType: 'video/mp4',
        upsert: true
      })

    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError)
      return videoUrl
    }

    const { data: urlData } = supabase.storage.from('studio').getPublicUrl(fileName)
    console.log('✅ Video stored in Storage:', urlData.publicUrl)
    return urlData.publicUrl
  } catch (err) {
    console.error('❌ Store video error:', err)
    return videoUrl
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const rawBody = await req.text()
    console.log('📥 Poll Request Body:', rawBody)
    const body = JSON.parse(rawBody)
    const { video_id, provider_task_id, model } = body

    if (!video_id || !provider_task_id || !model) {
      console.error('❌ Missing fields:', { video_id, provider_task_id, model })
      throw new Error(`video_id, provider_task_id and model required (got: vid=${video_id}, task=${provider_task_id}, model=${model})`)
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let video_url = ''
    let status = 'processing'

    if (model === 'grok-video') {
      const XAI_API_KEY = Deno.env.get('XAI_API_KEY')
      const res = await fetch(`https://api.x.ai/v1/videos/${provider_task_id}`, {
        headers: { 'Authorization': `Bearer ${XAI_API_KEY}` }
      })
      const rawText = await res.text()
      console.log('🔄 Grok poll:', rawText.substring(0, 300))
      let data
      try { data = JSON.parse(rawText) } catch { throw new Error('Poll non-JSON: ' + rawText.substring(0, 200)) }

      if (data.video?.url) {
        // Télécharger et stocker dans Supabase Storage
        video_url = await downloadAndStoreVideo(data.video.url, video_id, supabase)
        status = 'done'
      } else if (data.status === 'failed' || data.status === 'error' || data.status === 'expired') {
        status = 'failed'
      } else if (data.status === 'pending') {
        status = 'processing'
      }

    } else if (model === 'veo-3.1') {
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${provider_task_id}?key=${GEMINI_API_KEY}`
      )
      const rawText = await res.text()
      console.log('🔄 Veo poll:', rawText.substring(0, 300))
      let data
      try { data = JSON.parse(rawText) } catch { throw new Error('Poll non-JSON: ' + rawText.substring(0, 200)) }

      if (data.done) {
        const videos = data.response?.generateVideoResponse?.generatedSamples || []
        const rawVideoUrl = videos[0]?.video?.uri || videos[0]?.video?.url || ''
        if (rawVideoUrl) {
          const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY')
          video_url = await downloadAndStoreVideo(rawVideoUrl, video_id, supabase, GEMINI_API_KEY)
          status = 'done'
        } else {
          status = 'failed'
        }
      }
      if (data.error) status = 'failed'
    } else if (model === 'runway') {
      const RUNWAY_API_KEY = Deno.env.get('RUNWAY_API_KEY')
      const res = await fetch(
        `https://api.dev.runwayml.com/v1/tasks/${provider_task_id}`,
        {
          headers: {
            'Authorization': `Bearer ${RUNWAY_API_KEY}`,
            'X-Runway-Version': '2024-11-06'
          }
        }
      )
      const rawText = await res.text()
      console.log('🔄 Runway poll:', rawText.substring(0, 300))
      let data
      try { data = JSON.parse(rawText) } catch { throw new Error('Poll non-JSON') }

      if (data.status === 'SUCCEEDED') {
        const rawUrl = data.output?.[0] || ''
        if (rawUrl) {
          video_url = await downloadAndStoreVideo(rawUrl, video_id, supabase)
          status = 'done'
        } else {
          status = 'failed'
        }
      } else if (data.status === 'FAILED') {
        status = 'failed'
      }
    } else if (model.includes('kling')) {
      const FAL_API_KEY = Deno.env.get('FAL_API_KEY')

      // Kling on fal.ai can be standard or pro, but the status endpoint is the same if we have the request_id
      // We need to know the endpoint used to poll the result. 
      // For now we assume a default or we can try to find it in DB. 
      // Actually studio-video-generate stores it in model as 'kling-3.0-standard' etc.

      const isPro = model.includes('pro')

      // Fetch the video record to see if it was image-to-video
      const { data: videoRecord } = await supabase
        .from('studio_videos')
        .select('image_url')
        .eq('id', video_id)
        .single()

      const videoType = videoRecord?.image_url ? 'image-to-video' : 'text-to-video'
      const endpoint = `fal-ai/kling-video/v3/${isPro ? 'pro' : 'standard'}/${videoType}`

      // Essayer de récupérer directement le résultat
      const res = await fetch(
        `https://queue.fal.run/${endpoint}/requests/${provider_task_id}`,
        { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
      )

      console.log('🔄 Kling poll response status:', res.status)

      if (!res.ok) {
        if (res.status === 404) {
          // Requête introuvable ou pas encore prête
          console.log('⏳ Kling request not ready yet')
          status = 'processing'
        } else {
          const errText = await res.text()
          console.error(`❌ Kling poll failed (${res.status}):`, errText)
          throw new Error(`Kling poll failed: ${res.status}`)
        }
      } else {
        const resultData = await res.json()
        console.log('🔄 Kling poll data:', JSON.stringify(resultData).substring(0, 200))

        // Vérifier si le résultat est disponible
        if (resultData.video?.url || resultData.output?.video_url) {
          const rawUrl = resultData.video?.url || resultData.output?.video_url
          video_url = await downloadAndStoreVideo(rawUrl, video_id, supabase)
          status = 'done'
        } else if (resultData.status === 'FAILED') {
          status = 'failed'
        } else {
          // Toujours en cours
          status = 'processing'
        }
      }
    }

    // Mettre à jour la base si terminé
    if (status !== 'processing') {
      await supabase.from('studio_videos').update({
        status, video_url: video_url || null,
        completed_at: status === 'done' ? new Date().toISOString() : null,
        error_message: status === 'failed' ? 'Generation failed' : null
      }).eq('id', video_id)
      console.log('✅ Video updated:', video_id, status)
    }

    return new Response(JSON.stringify({ status, video_url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    const error = err as Error
    console.error('❌ Poll error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
