// Vercel Edge Function: cached proxy for Wikipedia / Wikimedia / NASA / museum APIs.
// Usage from the client: /api/proxy?u=<encoded upstream URL>
// Adds CDN caching (s-maxage + stale-while-revalidate) so repeat calls are instant
// and Wikipedia rate limits are avoided. Only allow-listed hosts are proxied.
export const config = { runtime: 'edge' }

const ALLOW = [
  'wikipedia.org',
  'wikimedia.org',
  'nasa.gov',
  'artic.edu',
  'metmuseum.org',
  'inaturalist.org',
  'openalex.org',
  'doaj.org',
  'ebi.ac.uk',
  'europepmc.org',
]

function allowed(hostname) {
  return ALLOW.some((h) => hostname === h || hostname.endsWith('.' + h))
}

export default async function handler(req) {
  const reqUrl = new URL(req.url)
  const target = reqUrl.searchParams.get('u')
  if (!target) return new Response('missing u', { status: 400 })

  let t
  try {
    t = new URL(target)
  } catch (e) {
    return new Response('bad url', { status: 400 })
  }
  if (t.protocol !== 'https:' || !allowed(t.hostname)) {
    return new Response('forbidden host', { status: 403 })
  }

  const isRandom = /\/page\/random\//.test(t.pathname)

  let upstream
  try {
    upstream = await fetch(t.toString(), {
      headers: {
        'User-Agent': 'InsightMindfulApp/1.0 (personal use)',
        Accept: req.headers.get('accept') || 'application/json',
        'Accept-Language': 'id,en;q=0.8',
      },
    })
  } catch (e) {
    return new Response('upstream error', { status: 502 })
  }

  const body = await upstream.arrayBuffer()
  const headers = new Headers()
  const ct = upstream.headers.get('content-type')
  if (ct) headers.set('content-type', ct)
  headers.set('Access-Control-Allow-Origin', '*')
  if (isRandom) {
    headers.set('Cache-Control', 'no-store')
  } else {
    headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  }
  return new Response(body, { status: upstream.status, headers })
}
