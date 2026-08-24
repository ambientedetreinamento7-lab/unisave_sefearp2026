import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import { ScormPlayer } from '../../components/ScormPlayer'
import { useAuth } from '../../context/AuthContext'
import { completePill, getBlockingPill, getTrackWithPills, getUserProgressMap, markPillInProgress } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { Pill, ScormLibraryItem, UserProgress } from '../../types/database'

const CONTENT_TYPE_ICON: Record<Pill['content_type'], string> = {
  video: '▶',
  iframe: '▶',
  scorm: '▶',
  reaction: '📝',
}

// Links do Vimeo/YouTube (mesmo os de "compartilhar") não são um arquivo de
// vídeo direto — a tag <video> não consegue tocá-los. Precisam do player
// embutido em iframe. Detecta esses casos e devolve os dados de embed
// corretos; null significa "é mesmo um arquivo de vídeo direto (mp4 etc.),
// usa <video>".
function getVideoEmbedInfo(url: string): { provider: 'vimeo' | 'youtube'; embedUrl: string } | null {
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/)
  if (vimeoMatch) {
    const [, videoId, hash] = vimeoMatch
    return {
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${videoId}${hash ? `?h=${hash}` : ''}`,
    }
  }
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/)
  if (youtubeMatch) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?enablejsapi=1`,
    }
  }
  return null
}

// Carrega um <script> externo uma única vez (cache por src), devolvendo uma
// promise que resolve quando o script já está pronto — usado pros SDKs
// oficiais do Vimeo Player e do YouTube IFrame, que só existem via CDN deles
// (não são pacotes npm instaláveis).
const loadedScripts = new Map<string, Promise<void>>()
function loadScript(src: string): Promise<void> {
  let promise = loadedScripts.get(src)
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Falha ao carregar ${src}`))
      document.head.appendChild(script)
    })
    loadedScripts.set(src, promise)
  }
  return promise
}

// Tolerância de "pulo pra frente" antes de ser considerado skip — cobre a
// flutuação normal de timeupdate/heartbeat dos players, sem travar o aluno.
const SKIP_TOLERANCE_SECONDS = 2

export function CoursePlayer() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [pill, setPill] = useState<Pill | null>(null)
  const [scormSource, setScormSource] = useState<{ packageUrl: string; manifestPath: string } | null>(null)
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [modules, setModules] = useState<Pill[]>([])
  const [moduleProgress, setModuleProgress] = useState<Record<string, UserProgress>>({})
  const [sequential, setSequential] = useState(false)
  const [hasQuiz, setHasQuiz] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [blockedBy, setBlockedBy] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [completing, setCompleting] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === playerRef.current)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      playerRef.current?.requestFullscreen()
    }
  }

  useEffect(() => {
    if (!id || !profile) return
    let cancelled = false
    async function load() {
      const { data: pillData } = await supabase.from('pills').select('*').eq('id', id).single()
      // Unpublishing every trilha that links to this curso (spec: publicar/
      // despublicar) makes it unavailable, even via a direct link.
      const { data: links } = await supabase
        .from('track_pills')
        .select('tracks(published)')
        .eq('pill_id', id)
      const isAvailable = ((links as { tracks: { published: boolean } | null }[] | null) ?? []).some(
        (l) => l.tracks?.published,
      )
      const { count: quizCount } = await supabase
        .from('quizzes')
        .select('id', { count: 'exact', head: true })
        .eq('pill_id', id!)
      const { data: progressData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', profile!.id)
        .eq('pill_id', id!)
        .maybeSingle()
      if (cancelled) return
      const pillRow = pillData as Pill
      setPill(pillRow)
      setHasQuiz((quizCount ?? 0) > 0)
      setProgress(progressData as UserProgress | null)
      setUnavailable(!isAvailable)
      if (!isAvailable) {
        setLoading(false)
        return
      }

      const blocking = await getBlockingPill(pillRow, profile!.id)
      if (cancelled) return
      setBlockedBy(blocking?.title ?? null)
      if (blocking) {
        setLoading(false)
        return
      }

      // Prefer the SCORM Library entry when the pill references one — that
      // way updating the library package automatically reaches every pill
      // pointing to it, instead of each pill carrying its own stale copy.
      if (pillRow?.content_type === 'scorm') {
        if (pillRow.scorm_library_id) {
          const { data: libItem } = await supabase
            .from('scorm_library')
            .select('*')
            .eq('id', pillRow.scorm_library_id)
            .maybeSingle()
          const lib = libItem as ScormLibraryItem | null
          if (!cancelled && lib) setScormSource({ packageUrl: lib.package_url, manifestPath: lib.manifest_path })
        } else if (pillRow.scorm_package_url && pillRow.scorm_manifest_path) {
          setScormSource({ packageUrl: pillRow.scorm_package_url, manifestPath: pillRow.scorm_manifest_path })
        }
      }

      // Lista de módulos do curso "dono" desta pílula, pra mostrar o
      // painel lateral com thumbs de tudo que compõe o curso (vídeos,
      // SCORMs e avaliações de reação), igual uma trilha de conteúdo.
      // A "Biblioteca de Cursos" (is_catalog) é uma prateleira
      // compartilhada de pílulas standalone, não um curso com módulos —
      // sem essa checagem, abrir qualquer pílula da biblioteca listaria
      // as outras ~50 pílulas de cursos completamente diferentes.
      if (pillRow.track_id) {
        const [{ track: homeTrack, pills: trackModules }, progressMap] = await Promise.all([
          getTrackWithPills(pillRow.track_id),
          getUserProgressMap(profile!.id),
        ])
        if (!cancelled && homeTrack && !homeTrack.is_catalog) {
          setModules(trackModules)
          setModuleProgress(progressMap)
          setSequential(homeTrack.sequential)
        }
      }

      setLoading(false)
      if (!progressData) await markPillInProgress(profile!.id, id!)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, profile])

  const completeModule = useCallback(async () => {
    if (!profile || !id) return
    setCompleting(true)
    await completePill(profile.id, id, null, pill?.title ?? 'Curso', pill?.points_override)
    const { data: progressData } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', profile.id)
      .eq('pill_id', id)
      .maybeSingle()
    setProgress(progressData as UserProgress | null)
    setCompleting(false)
  }, [profile, id, pill])

  // Antiskip: guarda até onde o aluno já assistiu de fato — usado tanto
  // pra vídeo nativo (<video>) quanto pros embeds do Vimeo/YouTube abaixo,
  // pra impedir avançar sem ter passado por aquele trecho e pra saber
  // quando o vídeo foi realmente assistido até o fim.
  const videoRef = useRef<HTMLVideoElement>(null)
  const embedIframeRef = useRef<HTMLIFrameElement>(null)
  const watchedFarthestRef = useRef(0)
  const autoCompletedRef = useRef(false)

  useEffect(() => {
    watchedFarthestRef.current = 0
    autoCompletedRef.current = false
  }, [pill?.id])

  function handleVideoTimeUpdate(e: SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget
    if (v.currentTime > watchedFarthestRef.current) watchedFarthestRef.current = v.currentTime
  }

  function handleVideoSeeking(e: SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget
    if (v.currentTime > watchedFarthestRef.current + SKIP_TOLERANCE_SECONDS) {
      v.currentTime = watchedFarthestRef.current
    }
  }

  function handleVideoEnded(e: SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget
    if (!autoCompletedRef.current && watchedFarthestRef.current >= v.duration - SKIP_TOLERANCE_SECONDS) {
      autoCompletedRef.current = true
      completeModule()
    }
  }

  // Mesma lógica de antiskip + conclusão automática, só que pros embeds
  // (Vimeo/YouTube não são a tag <video>, então usam os SDKs oficiais
  // deles via postMessage). Só entra em ação quando esse módulo não é o
  // último-com-quiz (aí quem conclui é o quiz, não o vídeo).
  useEffect(() => {
    if (!pill || pill.content_type !== 'video' || !pill.content_url) return
    const embedInfo = getVideoEmbedInfo(pill.content_url)
    if (!embedInfo) return

    const isLastModuleNow = modules.length > 0 && modules[modules.length - 1].id === pill.id
    const gatedByQuiz = isLastModuleNow && hasQuiz
    if (gatedByQuiz) return

    let cancelled = false
    let cleanup: (() => void) | null = null

    async function setup() {
      const iframeEl = embedIframeRef.current
      if (!iframeEl) return

      if (embedInfo!.provider === 'vimeo') {
        await loadScript('https://player.vimeo.com/api/player.js')
        if (cancelled) return
        const player = new (window as any).Vimeo.Player(iframeEl)
        const onTimeUpdate = ({ seconds }: { seconds: number }) => {
          if (seconds > watchedFarthestRef.current) watchedFarthestRef.current = seconds
        }
        const onSeeked = ({ seconds }: { seconds: number }) => {
          if (seconds > watchedFarthestRef.current + SKIP_TOLERANCE_SECONDS) {
            player.setCurrentTime(watchedFarthestRef.current)
          }
        }
        const onEnded = () => {
          if (!autoCompletedRef.current) {
            autoCompletedRef.current = true
            completeModule()
          }
        }
        player.on('timeupdate', onTimeUpdate)
        player.on('seeked', onSeeked)
        player.on('ended', onEnded)
        cleanup = () => {
          player.off('timeupdate', onTimeUpdate)
          player.off('seeked', onSeeked)
          player.off('ended', onEnded)
        }
      } else {
        await loadScript('https://www.youtube.com/iframe_api')
        if (cancelled) return
        const YTNS = (window as any).YT
        const ready: Promise<void> = YTNS?.Player
          ? Promise.resolve()
          : new Promise((resolve) => {
              const prev = (window as any).onYouTubeIframeAPIReady
              ;(window as any).onYouTubeIframeAPIReady = () => {
                prev?.()
                resolve()
              }
            })
        await ready
        if (cancelled) return
        const YT = (window as any).YT
        let lastTime = 0
        let pollInterval: ReturnType<typeof setInterval> | null = null
        const player = new YT.Player(iframeEl, {
          events: {
            onReady: () => {
              pollInterval = setInterval(() => {
                const t = player.getCurrentTime?.()
                if (typeof t !== 'number') return
                if (t > lastTime + SKIP_TOLERANCE_SECONDS) {
                  player.seekTo(watchedFarthestRef.current, true)
                } else if (t > watchedFarthestRef.current) {
                  watchedFarthestRef.current = t
                }
                lastTime = t
              }, 1000)
            },
            onStateChange: (e: { data: number }) => {
              if (e.data === YT.PlayerState.ENDED && !autoCompletedRef.current) {
                autoCompletedRef.current = true
                completeModule()
              }
            },
          },
        })
        cleanup = () => {
          if (pollInterval) clearInterval(pollInterval)
          player.destroy?.()
        }
      }
    }

    setup()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [pill, modules, hasQuiz, completeModule])

  const handleScormProgress = useCallback(
    async (
      status: 'in_progress' | 'completed',
      score: number | null,
      bookmark: { location: string; suspendData: string },
    ) => {
      if (!profile || !id) return
      if (status === 'completed') {
        await completePill(profile.id, id, score, pill?.title ?? 'Curso', pill?.points_override, bookmark)
      } else {
        await markPillInProgress(profile.id, id, bookmark)
      }
    },
    [profile, id, pill],
  )

  if (loading || !pill) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <p className="p-8 text-center text-ink-soft">Carregando…</p>
      </div>
    )
  }

  if (unavailable) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-ink">Este curso não está disponível no momento</h1>
          <p className="mt-2 text-ink-soft">A trilha que continha este curso foi despublicada pelo admin.</p>
          <Link to="/dashboard" className="mt-6 inline-block rounded-xl bg-navy px-5 py-2.5 font-semibold text-white">
            Voltar ao painel
          </Link>
        </div>
      </div>
    )
  }

  if (blockedBy) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <span className="text-3xl">🔒</span>
          <h1 className="mt-3 text-xl font-bold text-ink">Este curso segue uma ordem sequencial</h1>
          <p className="mt-2 text-ink-soft">
            Conclua o módulo "{blockedBy}" antes de acessar "{pill.title}".
          </p>
          <Link to="/dashboard" className="mt-6 inline-block rounded-xl bg-navy px-5 py-2.5 font-semibold text-white">
            Voltar ao painel
          </Link>
        </div>
      </div>
    )
  }

  const isCompleted = progress?.status === 'completed'
  const isLastModule = modules.length > 0 && modules[modules.length - 1].id === pill.id
  // Quiz de fixação é só do último módulo do curso, e só quando o admin
  // cadastrou um pra ele — os demais módulos concluem direto, sem quiz.
  const needsFixationQuiz =
    pill.content_type !== 'scorm' && pill.content_type !== 'reaction' && isLastModule && hasQuiz
  const videoEmbedInfo = pill.content_type === 'video' && pill.content_url ? getVideoEmbedInfo(pill.content_url) : null
  // Vídeo conclui sozinho ao ser assistido até o fim sem pular (ver refs
  // acima); iframe genérico não dá pra rastrear, então só conclui manual.
  // "Permitir concluir manualmente" (admin) libera o botão também no vídeo.
  const needsPlainCompletion =
    !needsFixationQuiz &&
    (pill.content_type === 'iframe' || (pill.content_type === 'video' && pill.allow_manual_completion))
  const isStrictVideoTracking = pill.content_type === 'video' && !needsFixationQuiz && !pill.allow_manual_completion

  // Um módulo trava (quando o curso é sequencial) se algum módulo anterior
  // na ordem ainda não foi concluído — mesma regra do getBlockingPill.
  let unlockedSoFar = true
  const moduleStates = modules.map((m) => {
    const completed = moduleProgress[m.id]?.status === 'completed'
    const locked = sequential && !unlockedSoFar
    if (!completed) unlockedSoFar = false
    return { pill: m, completed, locked }
  })
  const courseCompletedCount = moduleStates.filter((m) => m.completed).length
  const coursePct = modules.length ? Math.round((courseCompletedCount / modules.length) * 100) : 0

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-bg pb-16">
      <AppHeader />

      <main
        className={`mx-auto w-full max-w-6xl gap-6 px-4 py-8 ${
          modules.length > 1 ? 'lg:grid lg:grid-cols-[280px_1fr] lg:items-start' : 'max-w-4xl'
        }`}
      >
        {modules.length > 1 && (
          <aside className="card mb-6 h-fit max-h-[75vh] overflow-y-auto p-4 lg:sticky lg:top-6 lg:mb-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-navy">Módulos do curso</p>
              <span className="text-xs font-bold text-ink-soft">{coursePct}%</span>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-soft">
              {courseCompletedCount}/{modules.length} concluído{courseCompletedCount === 1 ? '' : 's'}
            </p>
            <div className="mt-2">
              <ProgressBar value={coursePct} />
            </div>
            <div className="mt-3 space-y-1.5">
              {moduleStates.map(({ pill: m, completed, locked }) => {
                const isCurrent = m.id === pill.id
                const content = (
                  <div
                    className={`flex items-center gap-2.5 rounded-xl p-2 transition ${
                      isCurrent ? 'bg-navy-light' : locked ? 'opacity-50' : 'hover:bg-bg'
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-navy text-sm text-white">
                      {m.thumbnail_url ? (
                        <img src={m.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        CONTENT_TYPE_ICON[m.content_type]
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${isCurrent ? 'text-navy' : 'text-ink'}`}>
                        {m.title}
                      </span>
                      <span className="block text-xs text-ink-soft">{m.duration ?? '—'}</span>
                    </span>
                    <span className="shrink-0 text-sm">{locked ? '🔒' : completed ? '✅' : ''}</span>
                  </div>
                )
                return locked ? (
                  <div key={m.id} title="Conclua os módulos anteriores para desbloquear">
                    {content}
                  </div>
                ) : (
                  <Link key={m.id} to={`/curso/${m.id}`}>
                    {content}
                  </Link>
                )
              })}
            </div>
          </aside>
        )}

        <div className="min-w-0">
          <Link to="/dashboard" className="text-sm font-medium text-ink-soft hover:text-navy">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold text-ink">{pill.title}</h1>
          {pill.description && <p className="mt-1 text-ink-soft">{pill.description}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {pill.axis && (
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink-soft">
                {pill.axis}
              </span>
            )}
            <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink-soft">
              {pill.duration ?? '—'}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isCompleted ? 'bg-green-50 text-success' : 'bg-navy-light text-navy'
              }`}
            >
              {isCompleted ? 'Concluído' : 'Em andamento'}
            </span>
          </div>

          {pill.content_type === 'reaction' ? (
            <div className="card mt-5 flex flex-col items-center gap-3 p-10 text-center">
              <span className="text-4xl">📝</span>
              {isCompleted ? (
                <p className="font-semibold text-success">Avaliação de reação respondida ✓</p>
              ) : (
                <>
                  <p className="font-semibold text-ink">Avalie sua experiência com este curso</p>
                  <p className="max-w-sm text-sm text-ink-soft">
                    Leva menos de um minuto e ajuda a melhorar o conteúdo.
                  </p>
                  <button
                    onClick={() => navigate(`/curso/${id}/reacao`)}
                    className="mt-2 rounded-xl bg-brand-red px-6 py-2.5 font-bold text-white hover:bg-brand-red-dark"
                  >
                    Responder avaliação
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <div
                ref={playerRef}
                className={`card relative mt-5 overflow-hidden ${
                  pill.content_type === 'scorm' ? 'h-[80vh] min-h-[560px]' : 'aspect-video'
                } ${isFullscreen ? 'h-screen w-screen rounded-none' : ''}`}
              >
                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                  // Fica no canto esquerdo (não direito) de propósito: o
                  // canto superior direito é onde a maioria dos pacotes
                  // SCORM posiciona o próprio botão de fechar/sair — se o
                  // nosso botão ficasse em cima, os cliques do aluno no "X"
                  // do pacote iam pra tela cheia em vez de pro fechamento
                  // real do conteúdo (que é o que dispara LMSFinish).
                  className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={16} />
                </button>
                {pill.content_type === 'video' && pill.content_url && (
                  videoEmbedInfo ? (
                    <iframe
                      ref={embedIframeRef}
                      src={videoEmbedInfo.embedUrl}
                      title={pill.title}
                      className="h-full w-full border-0"
                      allow="autoplay; fullscreen; picture-in-picture"
                    />
                  ) : (
                    <video
                      ref={videoRef}
                      controls
                      controlsList={isStrictVideoTracking ? 'nodownload noplaybackrate' : 'nodownload'}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onSeeking={isStrictVideoTracking ? handleVideoSeeking : undefined}
                      onEnded={handleVideoEnded}
                      className="h-full w-full"
                      src={pill.content_url}
                    />
                  )
                )}
                {pill.content_type === 'iframe' && pill.content_url && (
                  <iframe
                    src={pill.content_url}
                    title={pill.title}
                    className="h-full w-full border-0"
                    allow="autoplay; fullscreen"
                  />
                )}
                {pill.content_type === 'scorm' && scormSource && (
                  <ScormPlayer
                    packageUrl={scormSource.packageUrl}
                    manifestPath={scormSource.manifestPath}
                    initialLocation={progress?.scorm_location}
                    initialSuspendData={progress?.scorm_suspend_data}
                    onProgress={handleScormProgress}
                  />
                )}
                {pill.content_type === 'scorm' && !scormSource && (
                  <div className="flex h-full items-center justify-center text-ink-soft">Conteúdo indisponível</div>
                )}
                {!pill.content_url && pill.content_type !== 'scorm' && (
                  <div className="flex h-full items-center justify-center text-ink-soft">Conteúdo indisponível</div>
                )}
              </div>

              {needsFixationQuiz && (
                <button
                  onClick={() => navigate(`/curso/${id}/quiz`)}
                  disabled={isCompleted}
                  className="mt-5 w-full rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-50 sm:w-auto sm:px-8"
                >
                  {isCompleted ? 'Módulo concluído ✓' : 'Concluir Módulo e Fazer Quiz de Fixação'}
                </button>
              )}

              {needsPlainCompletion && (
                <button
                  onClick={completeModule}
                  disabled={isCompleted || completing}
                  className="mt-5 w-full rounded-xl bg-brand-red py-3 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-50 sm:w-auto sm:px-8"
                >
                  {isCompleted ? 'Módulo concluído ✓' : completing ? 'Concluindo…' : 'Concluir Módulo'}
                </button>
              )}

              {pill.content_type === 'scorm' && (
                <div className="mt-5 space-y-1 text-sm text-ink-soft">
                  <p>
                    {isCompleted
                      ? 'Módulo SCORM concluído ✓'
                      : 'O progresso deste módulo SCORM é registrado automaticamente pelo pacote.'}
                  </p>
                  {!isCompleted && (
                    <p>
                      Se você já terminou o conteúdo e o módulo continua aparecendo como "Em andamento",
                      atualize a página (F5) — às vezes a confirmação de conclusão só aparece depois disso.
                    </p>
                  )}
                </div>
              )}

              {isStrictVideoTracking && (
                <p className="mt-5 text-sm text-ink-soft">
                  {isCompleted
                    ? 'Módulo concluído ✓'
                    : 'Assista o vídeo até o final, sem pular trechos, para concluir este módulo automaticamente.'}
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
