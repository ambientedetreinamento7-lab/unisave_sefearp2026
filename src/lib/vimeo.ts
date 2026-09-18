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
}

/** Aceita tanto o id puro (ex.: "123456789") quanto uma URL colada do Vimeo
 * (ex.: "https://vimeo.com/123456789") — devolve só o id, ou null se não
 * reconhecer o formato. */
export function parseVimeoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return trimmed
  const match = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return match ? match[1] : null
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

  return { vimeoId: videoUri.split('/').pop() ?? '' }
}
