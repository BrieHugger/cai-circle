// ═══════════════════════════════════════════════════════════════
// CAI Circle — AI Summary Edge Function
// Deployed on Supabase (serverless). The Anthropic API key
// lives here, safely on the server — never in the frontend.
//
// To deploy:
//   1. Install Supabase CLI: npm install -g supabase
//   2. supabase login
//   3. supabase link --project-ref lktwqdgteniecauqrlgi
//   4. supabase secrets set ANTHROPIC_API_KEY=[YOUR_SECRET_KEY]
//   5. supabase functions deploy ai-summary
// ═══════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { vendorName, reviews } = await req.json()

    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `You are summarizing vendor reviews for a private community of agricultural professionals. 
Write a concise 2-3 sentence summary of these reviews for "${vendorName}". 
Focus on consistent patterns — what the vendor consistently does well, what they consistently fall short on, and any important flags.
Be direct and factual. Do not use filler phrases.

Reviews:
${reviews}`,
        }],
      }),
    })

    const data = await response.json()
    const summary = data.content?.[0]?.text || 'Unable to generate summary.'

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
