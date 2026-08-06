import { useEffect, useMemo, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { useAuth } from '../../context/AuthContext'
import { getTrackWithPills, getUserProgressMap, trackProgressPct } from '../../lib/api'
import type { Pill, Track, UserProgress } from '../../types/database'

export function Conquistas() {
  const { profile } = useAuth()
  const [track, setTrack] = useState<Track | null>(null)
  const [pills, setPills] = useState<Pill[]>([])
  const [progress, setProgress] = useState<Record<string, UserProgress>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function load() {
      const progressMap = await getUserProgressMap(profile!.id)
      if (cancelled) return
      setProgress(progressMap)
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

  const pct = useMemo(() => trackProgressPct(pills, progress), [pills, progress])
  const trackComplete = pct === 100 && pills.length > 0

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
      <main className="mx-auto max-w-4xl px-4 py-8">
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
                      : 'border-2 border-dashed border-gray-300 bg-white text-gray-300'
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
            Disponível para download assim que 100% da trilha for concluída.
          </p>
          <button
            disabled={!trackComplete}
            className="mt-4 rounded-xl bg-brand-red px-5 py-2.5 font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-40"
          >
            {trackComplete ? 'Baixar relatório de PDI (PDF)' : `Progresso da trilha: ${pct}%`}
          </button>
        </div>
      </main>
    </div>
  )
}
