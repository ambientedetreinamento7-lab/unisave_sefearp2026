// Vercel Serverless Function: looks up a just-uploaded Vimeo video's
// "unlisted" hash. Vimeo's player refuses to embed an unlisted video by ID
// alone — it needs that hash as a ?h=... query param — but the hash isn't
// reliably present on the response from api/vimeo-upload.ts's initial
// creation call (made before the file itself has finished uploading). This
// is called once the client's tus upload completes, when the video
// resource is fully settled and the hash is guaranteed to be there.
//
// Same minimal-ambient-types style as api/scorm.ts and api/vimeo-upload.ts.
declare const process: { env: Record<string, string | undefined> }

interface VercelLikeRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query: Record<string, string | string[]>
}

interface VercelLikeResponse {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: unknown): void
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  const authHeader = req.headers.authorization
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const vimeoToken = process.env.VIMEO_ACCESS_TOKEN

  if (!supabaseUrl || !supabaseAnonKey || !vimeoToken) {
    res.statusCode = 500
    res.end('Missing server configuration (Supabase or Vimeo env vars)')
    return
  }
  if (!token) {
    res.statusCode = 401
    res.end('Missing Authorization header')
    return
  }

  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
  })
  if (!authRes.ok) {
    res.statusCode = 401
    res.end('Invalid session')
    return
  }

  const rawUri = req.query.uri
  const uri = Array.isArray(rawUri) ? rawUri[0] : rawUri
  if (!uri || !uri.startsWith('/videos/')) {
    res.statusCode = 400
    res.end('Missing or invalid uri')
    return
  }

  const vimeoRes = await fetch(`https://api.vimeo.com${uri}?fields=link`, {
    headers: {
      Authorization: `bearer ${vimeoToken}`,
      Accept: 'application/vnd.vimeo.*+json;version=3.4',
    },
  })
  if (!vimeoRes.ok) {
    const text = await vimeoRes.text()
    res.statusCode = vimeoRes.status
    res.end(text)
    return
  }

  const data = (await vimeoRes.json()) as { link?: string }
  // Unlisted video links look like "https://vimeo.com/816967760/1a2b3c4d5e"
  // — the hash is the last path segment. Public/non-unlisted videos have no
  // extra segment, so this naturally comes back null for them.
  const parts = (data.link ?? '').split('/')
  const hash = parts.length > 4 ? parts[parts.length - 1] : null

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ hash }))
}
