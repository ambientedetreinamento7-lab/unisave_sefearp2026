import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icon'
import { ScormPlayer } from '../../components/ScormPlayer'
import { useAuth } from '../../context/AuthContext'
import { completePill, markPillInProgress } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { Pill, ScormLibraryItem, UserProgress } from '../../types/database'

export function CoursePlayer() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [pill, setPill] = useState<Pill | null>(null)
  const [scormSource, setScormSource] = useState<{ packageUrl: string; manifestPath: string } | null>(null)
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
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
      const { data: progressData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', profile!.id)
        .eq('pill_id', id!)
        .maybeSingle()
      if (cancelled) return
      const pillRow = pillData as Pill
      setPill(pillRow)
      setProgress(progressData as UserProgress | null)
      setUnavailable(!isAvailable)
      if (!isAvailable) {
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

      setLoading(false)
      if (!progressData) await markPillInProgress(profile!.id, id!)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, profile])

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

  const isCompleted = progress?.status === 'completed'
  const needsFixationQuiz = pill.content_type !== 'scorm'

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-bg pb-16">
      <AppHeader />

      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_280px]">
        <div>
          <Link to="/dashboard" className="text-sm font-medium text-ink-soft hover:text-navy">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold text-ink">{pill.title}</h1>
          {pill.description && <p className="mt-1 text-ink-soft">{pill.description}</p>}

          <div
            ref={playerRef}
            className={`card relative mt-5 overflow-hidden ${
              pill.content_type === 'scorm' ? 'h-[80vh] min-h-[560px]' : 'aspect-video'
            } ${isFullscreen ? 'h-screen w-screen rounded-none' : ''}`}
          >
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={16} />
            </button>
            {pill.content_type === 'video' && pill.content_url && (
              <video controls className="h-full w-full" src={pill.content_url} />
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

          {!needsFixationQuiz && (
            <p className="mt-5 text-sm text-ink-soft">
              {isCompleted
                ? 'Módulo SCORM concluído ✓'
                : 'O progresso deste módulo SCORM é registrado automaticamente pelo pacote.'}
            </p>
          )}
        </div>

        <aside className="card h-fit p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy">Ementa</p>
          <p className="mt-1 text-sm text-ink-soft">{pill.axis}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-navy">Duração</p>
          <p className="mt-1 text-sm text-ink-soft">{pill.duration ?? '—'}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-navy">Status</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {isCompleted ? 'Concluído' : 'Em andamento'}
          </p>
        </aside>
      </main>
    </div>
  )
}
