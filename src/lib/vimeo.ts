import { Upload } from 'tus-js-client'

// Spec (Fase C — fluxo de upload de vídeo via Vimeo): mantém o feed leve.
export const MAX_VIDEO_DURATION_SECONDS = 5 * 60

export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve(video.duration)
    }
    video.onerror = () => reject(new Error('Não foi possível ler o vídeo selecionado.'))
    video.src = URL.createObjectURL(file)
  })
}

export interface VimeoUploadResult {
  vimeoId: string
  vimeoHash: string | null
}

/**
 * Fase C: o token da conta Vimeo Pro nunca chega ao navegador — este
 * helper pede um link de upload assinado pro backend (api/vimeo-upload.ts)
 * e sobe o vídeo direto pro Vimeo via tus (upload resumível), sem passar
 * pela nossa infraestrutura.
 */
export async function uploadVideoToVimeo(
  file: File,
  accessToken: string,
  onProgress?: (pct: number) => void,
): Promise<VimeoUploadResult> {
  const linkRes = await fetch('/api/vimeo-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ size: file.size, name: file.name }),
  })
  if (!linkRes.ok) {
    const text = await linkRes.text()
    throw new Error(text || 'Não foi possível iniciar o upload do vídeo.')
  }
  const { uploadLink, videoUri } = (await linkRes.json()) as { uploadLink: string; videoUri: string }

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      uploadUrl: uploadLink,
      chunkSize: 8 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      onError: reject,
      onProgress: (bytesUploaded, bytesTotal) => onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100)),
      onSuccess: () => resolve(),
    })
    upload.start()
  })

  // The unlisted hash is only reliably available once the video resource
  // has settled after the upload — fetch it now, best-effort (a missing
  // hash just means the embed won't have ?h=, which is fine for public
  // videos and only breaks unlisted ones).
  let hash: string | null = null
  try {
    const statusRes = await fetch(`/api/vimeo-status?uri=${encodeURIComponent(videoUri)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (statusRes.ok) {
      const statusData = (await statusRes.json()) as { hash: string | null }
      hash = statusData.hash
    }
  } catch {
    // best-effort — post/story is still created even if this lookup fails
  }

  return { vimeoId: videoUri.split('/').pop() ?? '', vimeoHash: hash }
}
