// Vercel Serverless Function: mints a Vimeo tus upload link for a video
// post in the rede social interna (Fase C). The Vimeo Pro access token
// never reaches the browser — the client posts the file size/name here,
// this function calls the Vimeo API server-side with the secret token,
// and returns only the one-time upload URL, which the browser then
// uploads the video bytes to directly (so the video never passes through
// our own server/bandwidth).
//
// Same minimal-ambient-types style as api/scorm.ts: this project's Vercel
// build type-checks functions without @types/node, so Node-only globals
// get small ad-hoc declarations here instead of pulling in the full lib.
declare const process: { env: Record<string, string | undefined> }

interface VercelLikeRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

interface VercelLikeResponse {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: unknown): void
}

// Fase C spec: cap uploads to keep the feed light (5 min-ish clips).
const MAX_BYTES = 300 * 1024 * 1024

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  if (req.method !== 'POST') {
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

  // Verify the caller is a real logged-in aluno before we spend a Vimeo
  // upload slot on their behalf.
  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
  })
  if (!authRes.ok) {
    res.statusCode = 401
    res.end('Invalid session')
    return
  }

  let body: { size?: number; name?: string } = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : ((req.body as typeof body) ?? {})
  } catch {
    res.statusCode = 400
    res.end('Invalid JSON body')
    return
  }

  const size = body.size
  if (!size || typeof size !== 'number' || size <= 0) {
    res.statusCode = 400
    res.end('Missing or invalid file size')
    return
  }
  if (size > MAX_BYTES) {
    res.statusCode = 413
    res.end('Video too large — max 300MB')
    return
  }

  const vimeoRes = await fetch('https://api.vimeo.com/me/videos', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${vimeoToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.vimeo.*+json;version=3.4',
    },
    body: JSON.stringify({
      upload: { approach: 'tus', size: String(size) },
      name: body.name || 'Post da Comunidade',
      // Unlisted: not searchable/discoverable on Vimeo, playable only via
      // direct link/embed. embed: 'public' lets the player load on any
      // domain (including ours) instead of depending on a per-account
      // domain whitelist that isn't guaranteed to apply to new uploads —
      // that mismatch was causing the player's generic error screen.
      privacy: { view: 'unlisted', embed: 'public' },
    }),
  })

  if (!vimeoRes.ok) {
    const text = await vimeoRes.text()
    res.statusCode = vimeoRes.status
    res.end(text)
    return
  }

  const data = (await vimeoRes.json()) as { upload: { upload_link: string }; uri: string }
  // The unlisted hash (needed later to embed the video — see
  // api/vimeo-status.ts) isn't reliably populated on this initial create
  // call, before the file itself has been uploaded — it has to be fetched
  // afterwards once the video resource is fully settled.
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ uploadLink: data.upload.upload_link, videoUri: data.uri }))
}
