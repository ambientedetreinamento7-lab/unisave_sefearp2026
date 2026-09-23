import { useEffect, useMemo, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { useAuth } from '../../context/AuthContext'
import { getTrackWithPills, getUserPlans, getUserProgressMap } from '../../lib/api'
import type { Pill, PdiPlan, Track, UserProgress } from '../../types/database'

export function Conquistas() {
  const { profile } = useAuth()
  const [track, setTrack] = useState<Track | null>(null)
  const [pills, setPills] = useState<Pill[]>([])
  const [progress, setProgress] = useState<Record<string, UserProgress>>({})
  const [plans, setPlans] = useState<PdiPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function load() {
      const [progressMap, userPlans] = await Promise.all([getUserProgressMap(profile!.id), getUserPlans(profile!.id)])
      if (cancelled) return
      setProgress(progressMap)
      setPlans(userPlans)
      if (profile!.selected_track_id) {
        const { track: t, pills: p } = await getTrackWithPills(profile!.selected_track_id)
        if (!cancelled) {
          setTrack(t)
          setPills(p)
        }
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  // O relatório é sobre o PDI inteiro (todos os planos do aluno), não só a
  // trilha recomendada — badges continuam por pílula da trilha, mas esse
  // card reflete a média de progress_pct de cada PdiPlan.
  const pdiPct = useMemo(() => {
    if (plans.length === 0) return 0
    return Math.round(plans.reduce((sum, p) => sum + p.progress_pct, 0) / plans.length)
  }, [plans])
  const pdiComplete = plans.length > 0 && plans.every((p) => p.progress_pct === 100)

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <p className="p-8 text-center text-ink-soft">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">Minhas conquistas</h1>
        <p className="mt-1 text-ink-soft">Badges desbloqueadas ao concluir cada pílula da trilha {track?.title}.</p>

        <div className="mt-6 grid grid-cols-3 gap-5 sm:grid-cols-5">
          {pills.map((pill) => {
            const unlocked = progress[pill.id]?.status === 'completed'
            return (
              <div key={pill.id} className="flex flex-col items-center gap-2 text-center">
                <div
                  className={`flex h-17 w-17 items-center justify-center rounded-full text-2xl ${
                    unlocked
                      ? 'bg-gradient-to-br from-gold to-yellow-300 shadow-md'
                      : 'border-2 border-dashed border-navy-light bg-surface text-ink-soft'
                  }`}
                  style={{ width: 68, height: 68 }}
                >
                  {unlocked ? '🏅' : '🔒'}
                </div>
                <span className="text-xs font-medium text-ink-soft">{pill.title}</span>
              </div>
            )
          })}
        </div>

        <div className="card mt-10 p-6">
          <h2 className="font-bold text-ink">Relatório de PDI e certificado</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Disponível para download assim que 100% do seu PDI for concluído.
          </p>
          <button
            disabled={!pdiComplete}
            className="mt-4 rounded-xl bg-brand-red px-5 py-2.5 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-40"
          >
            {pdiComplete ? 'Baixar relatório de PDI (PDF)' : `Progresso do PDI: ${pdiPct}%`}
          </button>
        </div>
      </main>
    </div>
  )
}
