// Vercel Edge Function: server-side text extractor so AI can read full journal
// content from arbitrary source links (HTML). PDFs cannot be parsed here.
// Usage: /api/extract?u=<encoded https url>  ->  { text, kind, chars }
export const config = { runtime: 'edge' }

const PRIVATE = [/^127\./, /^10\./, /^0\.0\.0\.0$/, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./]

function isPrivate(h) {
  if (!h) return true
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true
  return PRIVATE.some((re) => re.test(h))
}

function stripHtml(html) {
  let s = html
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  s = s.replace(/<head[\s\S]*?<\/head>/gi, ' ')
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  s = s.replace(/<!--[\s\S]*?-->/g, ' ')
  s = s.replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/section)>/gi, '\n')
  s = s.replace(/<[^>]+>/g, ' ')
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'")
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return s
}

function json(obj, status, cache) {
  const h = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  if (cache) h['cache-control'] = cache
  return new Response(JSON.stringify(obj), { status: status || 200, headers: h })
}

export default async function handler(req) {
  const reqUrl = new URL(req.url)
  const target = reqUrl.searchParams.get('u')
  if (!target) return json({ error: 'missing u' }, 400)
  let t
  try { t = new URL(target) } catch (e) { return json({ error: 'bad url' }, 400) }
  if (t.protocol !== 'https:') return json({ error: 'https only' }, 400)
  if (isPrivate(t.hostname)) return json({ error: 'forbidden host' }, 403)

  try {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 15000)
    const r = await fetch(target, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; InsightBot/1.0)', accept: 'text/html,application/xhtml+xml,application/xml,text/plain,*/*' },
      redirect: 'follow',
      signal: ctrl.signal,
    })
    clearTimeout(to)
    const ct = (r.headers.get('content-type') || '').toLowerCase()
    const path = target.toLowerCase().split('?')[0]
    if (ct.includes('pdf') || path.endsWith('.pdf')) {
      return json({ text: '', kind: 'pdf', note: 'PDF tidak dapat diekstrak teksnya di server ini.' }, 200, 'public, s-maxage=3600')
    }
    let body = await r.text()
    if (body.length > 1500000) body = body.slice(0, 1500000)
    let text = stripHtml(body)
    if (text.length > 24000) text = text.slice(0, 24000)
    return json({ text, kind: 'html', chars: text.length }, 200, 'public, s-maxage=3600, stale-while-revalidate=86400')
  } catch (e) {
    return json({ error: 'fetch failed' }, 502)
  }
}
