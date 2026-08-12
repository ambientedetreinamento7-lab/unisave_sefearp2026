import { useEffect, useRef } from 'react'
import type { Scorm12API as Scorm12APIType } from 'scorm-again'

/**
 * Client-side SCORM runtime bridge (uses `scorm-again`). Injects a
 * Scorm12API onto `window` before the sandboxed iframe loads its
 * imsmanifest entry point, so the package's internal
 * LMSSetValue/LMSCommit calls resolve.
 *
 * Preloads cmi.core.lesson_location / cmi.suspend_data from the last
 * saved bookmark before the package boots, so it resumes where the
 * student left off instead of restarting from the first slide — and
 * reports the current location/suspend_data back on every commit so
 * `onProgress` can persist it.
 */
export function ScormPlayer({
  packageUrl,
  manifestPath,
  initialLocation,
  initialSuspendData,
  onProgress,
}: {
  packageUrl: string
  manifestPath: string
  initialLocation?: string | null
  initialSuspendData?: string | null
  onProgress: (
    status: 'in_progress' | 'completed',
    score: number | null,
    bookmark: { location: string; suspendData: string },
  ) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let api: Scorm12APIType | undefined
    let cancelled = false

    async function init() {
      const { Scorm12API } = await import('scorm-again')
      api = new Scorm12API({ autocommit: true, logLevel: 1 })
      if (initialLocation) api.cmi.core.lesson_location = initialLocation
      if (initialSuspendData) api.cmi.suspend_data = initialSuspendData
      api.cmi.core.entry = initialLocation ? 'resume' : 'ab-initio'
      api.on('LMSCommit', () => {
        if (!api || cancelled) return
        const status = api.cmi.core.lesson_status
        const raw = api.cmi.core.score.raw
        const score = raw !== '' ? Number(raw) : null
        onProgress(status === 'completed' || status === 'passed' ? 'completed' : 'in_progress', score, {
          location: api.cmi.core.lesson_location,
          suspendData: api.cmi.suspend_data,
        })
      })
      ;(window as unknown as { API: Scorm12APIType }).API = api
    }

    init()
    return () => {
      cancelled = true
      // Flush o estado mais recente antes do iframe ser desmontado (troca
      // de curso, saída da página) — sem isso, o autocommit de 10s pode
      // perder os últimos segundos de progresso do aluno.
      api?.LMSCommit('')
      if (api) delete (window as { API?: Scorm12APIType }).API
    }
  }, [initialLocation, initialSuspendData, onProgress])

  const entryUrl = `${packageUrl.replace(/\/$/, '')}/${manifestPath.replace(/^\//, '')}`

  return (
    <iframe
      ref={iframeRef}
      src={entryUrl}
      title="Conteúdo SCORM"
      className="h-full w-full rounded-xl border-0"
      // Some SCORM packages (e.g. cloud-hosted players like Lizza/SmartLMS)
      // nest a second iframe to stream remote content and use fullscreen /
      // external links — sandbox flags propagate to that nested frame, so
      // these need to be allowed here too, not just at the top level.
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-fullscreen"
      allow="fullscreen"
      allowFullScreen
    />
  )
}
