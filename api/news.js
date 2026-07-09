// Vercel Edge Function: NewsData.io proxy (keeps API key server-side).
// Client calls /api/news?q=&category=&country=&language=&page=
// Set NEWSDATA_API_KEY in Vercel project env vars.
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const p = new URL(req.url).searchParams
  const key = process.env.NEWSDATA_API_KEY
  if (!key) {
    return new Response(
      JSON.stringify({ results: [], error: 'NEWSDATA_API_KEY belum diset di Vercel' }),
      { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=60' } }
    )
  }
  const u = new URL('https://newsdata.io/api/1/latest')
  u.searchParams.set('apikey', key)
  const q = p.get('q'); if (q) u.searchParams.set('q', q)
  const country = p.get('country'); if (country) u.searchParams.set('country', country)
  const cat = p.get('category'); if (cat) u.searchParams.set('category', cat)
  u.searchParams.set('language', p.get('language') || 'id,en')
  const page = p.get('page'); if (page) u.searchParams.set('page', page)
  try {
    const r = await fetch(u.toString(), { headers: { 'accept': 'application/json' } })
    const body = await r.text()
    return new Response(body, {
      status: r.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, s-maxage=600, stale-while-revalidate=3600',
        'access-control-allow-origin': '*',
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ results: [], error: String(e) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}
