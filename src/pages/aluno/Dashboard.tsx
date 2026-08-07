import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
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
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">
          Bem-vindo, {profile?.name.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-ink-soft sm:text-base">
          Continue evoluindo o seu Plano de Desenvolvimento Individual.
        </p>

        {track && (
          <section className="card card-highlight mt-6 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Trilha recomendada</p>
                <h2 className="text-base font-bold text-ink sm:text-lg">{track.title}</h2>
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

        <div className="mt-8 flex gap-2 rounded-full bg-surface p-1 shadow-sm">
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
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trackPills.map((pill) => (
              <CourseCard key={pill.id} pill={pill} status={progress[pill.id]?.status ?? 'not_started'} />
            ))}
            {trackPills.length === 0 && (
              <p className="col-span-full text-ink-soft">Nenhuma pílula cadastrada para sua trilha ainda.</p>
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
                <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
                  {pills.map((pill) => (
                    <CourseCard key={pill.id} pill={pill} status={progress[pill.id]?.status ?? 'not_started'} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}

        {trackPills.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Suas conquistas</h2>
              <Link to="/conquistas" className="text-sm font-semibold text-navy hover:underline">
                Ver todas →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-5">
              {trackPills.slice(0, 5).map((pill) => {
                const unlocked = progress[pill.id]?.status === 'completed'
                return (
                  <div key={pill.id} className="flex flex-col items-center gap-2 text-center">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-full text-xl ${
                        unlocked
                          ? 'bg-gradient-to-br from-gold to-yellow-300 shadow-md'
                          : 'border-2 border-dashed border-navy-light bg-surface text-ink-soft'
                      }`}
                    >
                      {unlocked ? '🏅' : '🔒'}
                    </div>
                    <span className="line-clamp-2 text-[11px] font-medium text-ink-soft">{pill.title}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

const BADGE_COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-purple-100 text-purple-600',
  'bg-rose-100 text-rose-600',
  'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600',
  'bg-cyan-100 text-cyan-600',
]

function colorForAxis(axis: string | null) {
  const s = axis ?? ''
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return BADGE_COLORS[hash % BADGE_COLORS.length]
}

const ACTION_LABEL: Record<UserProgress['status'], string> = {
  completed: 'Revisar',
  in_progress: 'Continuar',
  not_started: 'Iniciar',
}

function CourseCard({ pill, status }: { pill: Pill; status: UserProgress['status'] }) {
  return (
    <Link to={`/curso/${pill.id}`} className="card flex flex-col gap-3 p-4 transition hover:card-highlight">
      {pill.thumbnail_url ? (
        <img src={pill.thumbnail_url} alt="" className="-mx-4 -mt-4 h-28 w-[calc(100%+2rem)] rounded-t-2xl object-cover" />
      ) : (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorForAxis(pill.axis)}`}>
          <Icon name="book" size={18} />
        </span>
      )}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
          {pill.axis} · {pill.duration}
        </p>
        <h3 className="mt-0.5 font-bold text-ink">{pill.title}</h3>
      </div>
      {pill.description && <p className="line-clamp-2 text-sm text-ink-soft">{pill.description}</p>}
      <div className="mt-auto flex items-center justify-end pt-2">
        <span className="flex items-center gap-1.5 rounded-full bg-brand-red px-3.5 py-1.5 text-xs font-bold text-white">
          {ACTION_LABEL[status]}
          <Icon name="arrow-right" size={12} />
        </span>
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
