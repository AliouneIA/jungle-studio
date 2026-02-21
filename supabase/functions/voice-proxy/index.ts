// @ts-nocheck
// supabase/functions/voice-proxy/index.ts

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        if (!OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not set");
        }

        // ✅ Endpoint GA — PAS /v1/realtime/sessions
        const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                session: {
                    type: "realtime",
                    model: "gpt-realtime",
                    audio: {
                        output: {
                            voice: "alloy",
                        },
                    },
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenAI failed:", response.status, errorText);
            throw new Error(`OpenAI Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log("Token generated, keys:", Object.keys(data));

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
