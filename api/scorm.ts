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
// Writes the response with the raw Node http.ServerResponse API
// (statusCode/setHeader/end) instead of the Express-style status()/send()
// sugar Vercel usually layers on top — that sugar was JSON-serializing the
// body byte-by-byte instead of writing it raw, in this project's runtime.
// end() is the lowest-level primitive and always writes bytes untouched.
//
// This project's Vercel build type-checks functions without @types/node
// available, so Node-only globals need minimal ambient declarations here
// instead of pulling in the full node lib.
declare const process: { env: Record<string, string | undefined> }
declare const Buffer: { from(data: ArrayBuffer): unknown }

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
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: unknown): void
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  const raw = req.query.path
  const objectPath = Array.isArray(raw) ? raw.join('/') : raw ?? ''

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  if (!supabaseUrl || !objectPath) {
    res.statusCode = 400
    res.end('Missing configuration or file path')
    return
  }

  const upstream = await fetch(`${supabaseUrl}/storage/v1/object/public/scorm-packages/${objectPath}`)
  if (!upstream.ok) {
    res.statusCode = upstream.status
    res.end('Not found')
    return
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  res.statusCode = 200
  res.setHeader('Content-Type', contentTypeFor(objectPath))
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.end(buffer)
}
