import { useEffect, useRef } from 'react'

interface H5pXapiEvent {
  getVerb?: () => string | undefined
  getScore?: () => number | null
  getMaxScore?: () => number | null
}

/**
 * Client-side H5P runtime (usa `h5p-standalone`, sem precisar de um servidor
 * H5P completo em PHP). O player em si (frame.bundle.js/h5p.css) é o RUNTIME
 * do player, servido estático em /h5p-player (copiado de node_modules/
 * h5p-standalone/dist na hora do build — não muda por pacote); packageUrl é
 * o conteúdo (h5p.json + content/ + libraries/) de UM pacote específico,
 * enviado pelo admin na Biblioteca de H5P e servido via /api/h5p/{id}
 * (mesmo proxy same-origin do SCORM — Supabase Storage rebaixa HTML/JS pra
 * text/plain, o que quebraria o player).
 *
 * Progresso: o player global dispara eventos xAPI em window.H5P
 * (H5P.externalDispatcher) — o verbo 'completed' marca a pílula concluída;
 * qualquer interação antes disso já conta como 'in_progress' (like o SCORM).
 */
export function H5pPlayer({
  packageUrl,
  initialCompleted,
  onProgress,
}: {
  packageUrl: string
  initialCompleted?: boolean
  onProgress: (status: 'in_progress' | 'completed') => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let handler: ((event: H5pXapiEvent) => void) | null = null
    let reportedCompleted = initialCompleted ?? false

    async function init() {
      const container = containerRef.current
      if (!container) return
      container.innerHTML = ''

      const { H5P } = await import('h5p-standalone')
      await new H5P(container, {
        h5pJsonPath: packageUrl,
        frameJs: '/h5p-player/frame.bundle.js',
        frameCss: '/h5p-player/styles/h5p.css',
        frame: true,
        copyright: false,
        export: false,
        embed: false,
        fullScreen: true,
      })
      if (cancelled) return

      if (!reportedCompleted) onProgress('in_progress')

      const H5PGlobal = (window as unknown as { H5P?: { externalDispatcher?: { on: Function; off?: Function } } }).H5P
      handler = (event: H5pXapiEvent) => {
        if (event.getVerb?.() !== 'completed') return
        reportedCompleted = true
        onProgress('completed')
      }
      H5PGlobal?.externalDispatcher?.on('xAPI', handler)
    }

    init()
    return () => {
      cancelled = true
      const H5PGlobal = (window as unknown as { H5P?: { externalDispatcher?: { off?: Function } } }).H5P
      if (handler) H5PGlobal?.externalDispatcher?.off?.('xAPI', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageUrl])

  return <div ref={containerRef} className="h-full w-full overflow-auto rounded-xl bg-white" />
}
