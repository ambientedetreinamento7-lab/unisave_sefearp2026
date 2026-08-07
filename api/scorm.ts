// Vercel Serverless Function: proxies extracted SCORM package files from
// Supabase Storage, re-served under our own domain with the correct
// Content-Type. Supabase's own domain (*.supabase.co) rewrites any
// HTML-looking response — from Storage AND from Edge Functions — to
// text/plain with a locked-down CSP, so browsers refuse to execute it.
// Vercel has no such restriction, so this is the reliable path.
//
// Reached via an explicit vercel.json rewrite (/api/scorm/(.*) ->
// /api/scorm?path=$1) rather than the [...path].ts filesystem convention —
// that dynamic-route detection wasn't reliably picked up by this project's
// build, so this sidesteps it entirely with a plain, single, flat function.
//
// Deliberately avoids Node-only globals (Buffer, process) beyond a minimal
// ambient declaration for `process.env` — this project's Vercel build
// type-checks functions without @types/node available. Uint8Array/fetch are
// universal Web APIs and need no extra typing.
declare const process: { env: Record<string, string | undefined> }

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  xml: 'application/xml',
  json: 'application/json',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  swf: 'application/x-shockwave-flash',
}

function contentTypeFor(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

interface VercelLikeRequest {
  query: Record<string, string | string[]>
}

interface VercelLikeResponse {
  status(code: number): VercelLikeResponse
  setHeader(name: string, value: string): void
  send(body: Uint8Array | string): void
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  const raw = req.query.path
  const objectPath = Array.isArray(raw) ? raw.join('/') : raw ?? ''

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  if (!supabaseUrl || !objectPath) {
    res.status(400).send('Missing configuration or file path')
    return
  }

  const upstream = await fetch(`${supabaseUrl}/storage/v1/object/public/scorm-packages/${objectPath}`)
  if (!upstream.ok) {
    res.status(upstream.status).send('Not found')
    return
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer())
  res.setHeader('Content-Type', contentTypeFor(objectPath))
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).send(bytes)
}
