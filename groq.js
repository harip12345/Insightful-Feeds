// Vercel Edge Function: secure proxy for Groq AI (OpenAI-compatible chat completions).
// The GROQ_API_KEY stays on the server (set it in Vercel > Project > Settings > Environment Variables).
// Client calls POST /api/groq with { messages, model?, temperature?, max_tokens?, stream? }.
export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const key = (typeof process !== 'undefined' && process.env && process.env.GROQ_API_KEY) || ''
  if (!key) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY belum diset di Environment Variables Vercel.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  let payload
  try {
    payload = await req.json()
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: { 'content-type': 'application/json' } })
  }

  const stream = payload.stream !== false
  const body = JSON.stringify({
    model: payload.model || 'llama-3.1-8b-instant',
    messages: payload.messages || [],
    temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.4,
    max_tokens: payload.max_tokens || 800,
    stream,
  })

  let upstream
  try {
    upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'upstream error' }), { status: 502, headers: { 'content-type': 'application/json' } })
  }

  const headers = new Headers()
  headers.set('content-type', upstream.headers.get('content-type') || (stream ? 'text/event-stream' : 'application/json'))
  headers.set('cache-control', 'no-store')
  return new Response(upstream.body, { status: upstream.status, headers })
}
