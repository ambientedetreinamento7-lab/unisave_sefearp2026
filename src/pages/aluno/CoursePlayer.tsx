import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { ScormPlayer } from '../../components/ScormPlayer'
import { useAuth } from '../../context/AuthContext'
import { completePill, markPillInProgress } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { Pill, UserProgress } from '../../types/database'

export function CoursePlayer() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [pill, setPill] = useState<Pill | null>(null)
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !profile) return
    let cancelled = false
    async function load() {
      const { data: pillData } = await supabase.from('pills').select('*').eq('id', id).single()
      const { data: progressData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', profile!.id)
        .eq('pill_id', id!)
        .maybeSingle()
      if (cancelled) return
      setPill(pillData as Pill)
      setProgress(progressData as UserProgress | null)
      setLoading(false)
      if (!progressData) await markPillInProgress(profile!.id, id!)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, profile])

  const handleScormProgress = useCallback(
    async (status: 'in_progress' | 'completed', score: number | null) => {
      if (!profile || !id) return
      if (status === 'completed') {
        await completePill(profile.id, id, score)
      } else {
        await markPillInProgress(profile.id, id)
      }
    },
    [profile, id],
  )

  if (loading || !pill) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <p className="p-8 text-center text-ink-soft">Carregando…</p>
      </div>
    )
  }

  const isCompleted = progress?.status === 'completed'
  const needsFixationQuiz = pill.content_type !== 'scorm'

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_280px]">
        <div>
          <Link to="/dashboard" className="text-sm font-medium text-ink-soft hover:text-navy">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold text-ink">{pill.title}</h1>
          {pill.description && <p className="mt-1 text-ink-soft">{pill.description}</p>}

          <div className="card mt-5 aspect-video overflow-hidden">
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
            {pill.content_type === 'scorm' && pill.scorm_package_url && pill.scorm_manifest_path && (
              <ScormPlayer
                packageUrl={pill.scorm_package_url}
                manifestPath={pill.scorm_manifest_path}
                onProgress={handleScormProgress}
              />
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
