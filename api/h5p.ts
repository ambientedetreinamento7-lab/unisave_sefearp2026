// Vercel Serverless Function: proxies extracted H5P package files from
// Supabase Storage, re-served under our own domain with the correct
// Content-Type. Same reasoning as api/scorm.ts — Supabase's own domain
// (*.supabase.co) rewrites any HTML/JS-looking response to text/plain with
// a locked-down CSP, which breaks the h5p-standalone player (it fetches
// h5p.json/content.json and library JS/CSS directly from packageUrl).
//
// Reached via an explicit vercel.json rewrite (/api/h5p/(.*) ->
// /api/h5p?path=$1), same convention as api/scorm.ts.
declare const process: { env: Record<string, string | undefined> }
declare const Buffer: { from(data: ArrayBuffer): unknown }

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  xml: 'application/xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'audio/ogg',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
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

  const upstream = await fetch(`${supabaseUrl}/storage/v1/object/public/h5p-packages/${objectPath}`)
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
