import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import { StatusPill } from '../../components/StatusPill'
import { useAuth } from '../../context/AuthContext'
import { getAllPills, getTrackWithPills, getUserProgressMap, trackProgressPct } from '../../lib/api'
import type { Pill, UserProgress, Track } from '../../types/database'

export function Dashboard() {
  const { profile } = useAuth()
  const [track, setTrack] = useState<Track | null>(null)
  const [trackPills, setTrackPills] = useState<Pill[]>([])
  const [allPills, setAllPills] = useState<Pill[]>([])
  const [progress, setProgress] = useState<Record<string, UserProgress>>({})
  const [tab, setTab] = useState<'trilha' | 'catalogo'>('trilha')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function load() {
      const [progressMap, pills] = await Promise.all([
        getUserProgressMap(profile!.id),
        getAllPills(),
      ])
      if (cancelled) return
      setProgress(progressMap)
      setAllPills(pills)

      if (profile!.selected_track_id) {
        const { track: t, pills: tp } = await getTrackWithPills(profile!.selected_track_id)
        if (!cancelled) {
          setTrack(t)
          setTrackPills(tp)
        }
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  const pct = useMemo(() => trackProgressPct(trackPills, progress), [trackPills, progress])
  const completedCount = trackPills.filter((p) => progress[p.id]?.status === 'completed').length

  const catalogByAxis = useMemo(() => {
    const groups: Record<string, Pill[]> = {}
    for (const p of allPills) {
      const axis = p.axis ?? 'Outros'
      groups[axis] = groups[axis] ?? []
      groups[axis].push(p)
    }
    return groups
  }, [allPills])

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
      <AppHeader scarcityLabel="Vagas limitadas na trilha do evento" />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">
          Bem-vindo, {profile?.name.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-ink-soft">Continue evoluindo o seu Plano de Desenvolvimento Individual.</p>

        {track && (
          <section className="card card-highlight mt-6 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Trilha recomendada</p>
                <h2 className="text-lg font-bold text-ink">{track.title}</h2>
              </div>
              <span className="text-sm font-semibold text-ink-soft">
                {completedCount} de {trackPills.length}
              </span>
            </div>
            <div className="mt-4">
              <ProgressBar value={pct} />
            </div>
          </section>
        )}

        <div className="mt-8 flex gap-2 rounded-full bg-white p-1 shadow-sm">
          <button
            onClick={() => setTab('trilha')}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              tab === 'trilha' ? 'bg-navy text-white' : 'text-ink-soft'
            }`}
          >
            Minha Trilha
          </button>
          <button
            onClick={() => setTab('catalogo')}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              tab === 'catalogo' ? 'bg-navy text-white' : 'text-ink-soft'
            }`}
          >
            Explorar Catálogo Completo
          </button>
        </div>

        {tab === 'trilha' && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {trackPills.map((pill) => (
              <CourseCard key={pill.id} pill={pill} status={progress[pill.id]?.status ?? 'not_started'} />
            ))}
            {trackPills.length === 0 && (
              <p className="col-span-2 text-ink-soft">Nenhuma pílula cadastrada para sua trilha ainda.</p>
            )}
          </div>
        )}

        {tab === 'catalogo' && (
          <div className="mt-5 space-y-3">
            {Object.entries(catalogByAxis).map(([axis, pills]) => (
              <details key={axis} className="card overflow-hidden" open>
                <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 font-semibold text-ink">
                  <LayersIcon /> {axis}
                </summary>
                <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
                  {pills.map((pill) => (
                    <CourseCard key={pill.id} pill={pill} status={progress[pill.id]?.status ?? 'not_started'} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}

        <Link
          to="/conquistas"
          className="mt-8 block rounded-2xl border-2 border-dashed border-navy-light p-5 text-center font-semibold text-navy hover:border-navy"
        >
          Ver minhas conquistas e badges →
        </Link>
      </main>
    </div>
  )
}

function CourseCard({ pill, status }: { pill: Pill; status: UserProgress['status'] }) {
  return (
    <Link to={`/curso/${pill.id}`} className="card flex flex-col gap-3 p-4 transition hover:card-highlight">
      <div className="flex items-start justify-between gap-3">
        <span className="icon-badge h-10 w-10 shrink-0">
          <Icon name="book" size={18} />
        </span>
        <StatusPill status={status} />
      </div>
      <h3 className="font-semibold text-ink">{pill.title}</h3>
      {pill.description && <p className="line-clamp-2 text-sm text-ink-soft">{pill.description}</p>}
      <div className="mt-auto flex items-center justify-between text-xs text-ink-soft">
        <span>{pill.axis}</span>
        <span>{pill.duration}</span>
      </div>
    </Link>
  )
}

function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-navy">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
