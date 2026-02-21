import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const GAMMA_API_KEY = Deno.env.get('GAMMA_API_KEY')
    if (!GAMMA_API_KEY) throw new Error("GAMMA_API_KEY not set")

    const res = await fetch('https://public-api.gamma.app/v1.0/themes?limit=50', {
      headers: { 'X-API-KEY': GAMMA_API_KEY }
    })

    const rawText = await res.text()
    console.log('🎨 Gamma themes response:', res.status, rawText.substring(0, 500))

    let data
    try { data = JSON.parse(rawText) } catch { throw new Error('Non-JSON response: ' + rawText.substring(0, 200)) }

    if (!res.ok) throw new Error('Gamma themes error: ' + JSON.stringify(data))

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('❌ Themes error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
