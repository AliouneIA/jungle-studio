// supabase/functions/whisper-stt/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Gestion du preflight CORS (le navigateur envoie un OPTIONS avant le POST)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }

    const formData = await req.formData()
    const file = formData.get('file')
    // On récupère le modèle envoyé par le frontend
    // Si absent, on utilise whisper-1 par défaut (rétrocompatible)
    const model = formData.get('model') || 'whisper-1'

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file uploaded' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Les deux modèles utilisent le même endpoint OpenAI
    // whisper-1 = modèle standard, gpt-4o-transcribe = modèle premium plus précis
    // Même prix ($0.006/min) mais gpt-4o-transcribe a un WER de 2.46% vs ~10% pour whisper-1
    const openAiFormData = new FormData()
    openAiFormData.append('file', file, 'audio.webm')
    openAiFormData.append('model', model as string)

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: openAiFormData
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || `OpenAI API error (${response.status})`)
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
