import { useEffect, useRef } from 'react'
import type { Scorm12API as Scorm12APIType } from 'scorm-again'

/**
 * Client-side SCORM runtime bridge (uses `scorm-again`). Injects a
 * Scorm12API onto `window` before the sandboxed iframe loads its
 * imsmanifest entry point, so the package's internal
 * LMSSetValue/LMSCommit calls resolve.
 *
 * Wire `onProgress` to persist cmi.core.lesson_status / score.raw into
 * `user_progress` (see spec section 10.4).
 */
export function ScormPlayer({
  packageUrl,
  manifestPath,
  onProgress,
}: {
  packageUrl: string
  manifestPath: string
  onProgress: (status: 'in_progress' | 'completed', score: number | null) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let api: Scorm12APIType | undefined
    let cancelled = false

    async function init() {
      const { Scorm12API } = await import('scorm-again')
      api = new Scorm12API({ autocommit: true, logLevel: 1 })
      api.on('LMSCommit', () => {
        if (!api || cancelled) return
        const status = api.cmi.core.lesson_status
        const raw = api.cmi.core.score.raw
        const score = raw !== '' ? Number(raw) : null
        onProgress(status === 'completed' || status === 'passed' ? 'completed' : 'in_progress', score)
      })
      ;(window as unknown as { API: Scorm12APIType }).API = api
    }

    init()
    return () => {
      cancelled = true
      if (api) delete (window as { API?: Scorm12APIType }).API
    }
  }, [onProgress])

  const entryUrl = `${packageUrl.replace(/\/$/, '')}/${manifestPath.replace(/^\//, '')}`

  return (
    <iframe
      ref={iframeRef}
      src={entryUrl}
      title="Conteúdo SCORM"
      className="h-full w-full rounded-xl border-0"
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
  )
}
