import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import { RankingWidget } from '../../components/RankingWidget'
import { useAuth } from '../../context/AuthContext'
import {
  getAllPills,
  getCategories,
  getDashboardSections,
  getFavoritePillIds,
  getFavoritePills,
  getInProgressPills,
  getMostAccessedPills,
  getReactionStatus,
  getRecentlyAddedPills,
  getRecommendedPills,
  getRequiredPills,
  getTrackWithPills,
  getUserProgressMap,
  toggleFavorite,
  trackProgressPct,
} from '../../lib/api'
import { claimDailyAccess, getLastPointsEvent, getRule } from '../../lib/gamification'
import type { Category, DashboardSection, GamificationRule, Pill, UserProgress, Track } from '../../types/database'

const MS_PER_DAY = 86_400_000

export function Dashboard() {
  const { profile, refreshProfile } = useAuth()
  const [track, setTrack] = useState<Track | null>(null)
  const [trackPills, setTrackPills] = useState<Pill[]>([])
  const [allPills, setAllPills] = useState<Pill[]>([])
  const [progress, setProgress] = useState<Record<string, UserProgress>>({})
  const [tab, setTab] = useState<'trilha' | 'catalogo'>('trilha')
  const [loading, setLoading] = useState(true)
  const [accessRule, setAccessRule] = useState<GamificationRule | null>(null)
  const [showAccessModal, setShowAccessModal] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [sections, setSections] = useState<DashboardSection[]>([])
  const [sectionPills, setSectionPills] = useState<Record<string, Pill[]>>({})
  const [reactionStatus, setReactionStatus] = useState<{ enabledPillIds: Set<string>; submittedPillIds: Set<string> }>()

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function load() {
      const [progressMap, pills, cats, favIds, sects] = await Promise.all([
        getUserProgressMap(profile!.id),
        getAllPills(),
        getCategories(),
        getFavoritePillIds(profile!.id),
        getDashboardSections(),
      ])
      if (cancelled) return
      setProgress(progressMap)
      setAllPills(pills)
      setCategories(cats)
      setFavoriteIds(favIds)
      setSections(sects)

      let recommendedPills: Pill[] = []
      if (profile!.selected_track_id) {
        const { track: t, pills: tp } = await getTrackWithPills(profile!.selected_track_id)
        if (cancelled) return
        setTrack(t)
        setTrackPills(tp)
        const status = await getReactionStatus(tp.map((p) => p.id), profile!.id)
        if (!cancelled) setReactionStatus(status)
      }
      recommendedPills = await getRecommendedPills(profile!.program_id, profile!.diagnostic_profile, progressMap)

      const [inProgress, recent, favorites, mostAccessed, required] = await Promise.all([
        getInProgressPills(profile!.id),
        getRecentlyAddedPills(10),
        getFavoritePills(profile!.id),
        getMostAccessedPills(10),
        getRequiredPills(),
      ])
      if (cancelled) return
      setSectionPills({
        em_andamento: inProgress,
        recomendados: recommendedPills,
        recentes: recent,
        favoritos: favorites,
        mais_acessados: mostAccessed,
        obrigatorios: required,
      })
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function checkAccessPoints() {
      const rule = await getRule('daily_access')
      if (cancelled || !rule || !rule.enabled) return
      const lastEvent = await getLastPointsEvent(profile!.id, 'daily_access')
      if (cancelled) return
      const recurrenceDays = rule.recurrence_days ?? 1
      const dueForRefresh =
        !lastEvent || Date.now() - new Date(lastEvent.created_at).getTime() >= recurrenceDays * MS_PER_DAY
      if (dueForRefresh) {
        setAccessRule(rule)
        setShowAccessModal(true)
      }
    }
    checkAccessPoints()
    return () => {
      cancelled = true
    }
  }, [profile])

  async function handleClaimAccessPoints() {
    if (!profile) return
    await claimDailyAccess(profile.id)
    setShowAccessModal(false)
    await refreshProfile()
  }

  async function handleToggleFavorite(pillId: string) {
    if (!profile) return
    const currentlyFavorited = favoriteIds.has(pillId)
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (currentlyFavorited) next.delete(pillId)
      else next.add(pillId)
      return next
    })
    await toggleFavorite(profile.id, pillId, currentlyFavorited)
  }

  const pct = useMemo(
    () => trackProgressPct(trackPills, progress, reactionStatus),
    [trackPills, progress, reactionStatus],
  )
  const completedCount = trackPills.filter((p) => progress[p.id]?.status === 'completed').length

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    return allPills.filter((p) => {
      if (selectedCategoryId && p.category_id !== selectedCategoryId) return false
      if (q && !p.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [allPills, selectedCategoryId, catalogSearch])

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

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
          <div className="min-w-0">
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
              <div className="mt-5 space-y-8">
                {sections
                  .filter((s) => s.enabled && (sectionPills[s.key]?.length ?? 0) > 0)
                  .map((s) => (
                    <CourseRow
                      key={s.key}
                      title={s.label}
                      pills={sectionPills[s.key] ?? []}
                      progress={progress}
                      favoriteIds={favoriteIds}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                {sections.filter((s) => s.enabled && (sectionPills[s.key]?.length ?? 0) > 0).length === 0 && (
                  <p className="text-ink-soft">
                    Nada por aqui ainda — explore o catálogo completo pra começar a montar sua trilha.
                  </p>
                )}
              </div>
            )}

            {tab === 'catalogo' && (
              <div className="mt-5">
                <input
                  className="w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
                  placeholder="Buscar curso pelo nome…"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                />
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                      selectedCategoryId === null ? 'border-navy bg-navy text-white' : 'border-navy-light text-ink-soft'
                    }`}
                  >
                    Todas
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategoryId(c.id)}
                      className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                        selectedCategoryId === c.id ? 'border-navy bg-navy text-white' : 'border-navy-light text-ink-soft'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredCatalog.map((pill) => (
                    <CourseCard
                      key={pill.id}
                      pill={pill}
                      status={progress[pill.id]?.status ?? 'not_started'}
                      favorited={favoriteIds.has(pill.id)}
                      onToggleFavorite={() => handleToggleFavorite(pill.id)}
                    />
                  ))}
                  {filteredCatalog.length === 0 && <p className="col-span-full text-ink-soft">Nenhum curso encontrado.</p>}
                </div>
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
          </div>

          <aside className="mt-6 lg:sticky lg:top-6 lg:mt-0">
            {profile && <RankingWidget currentUserId={profile.id} />}
          </aside>
        </div>
      </main>

      {showAccessModal && accessRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-sm p-6 text-center">
            <p className="text-3xl">🎉</p>
            <h3 className="mt-2 text-lg font-bold text-ink">Você acessou a plataforma!</h3>
            <p className="mt-1 text-sm text-ink-soft">Resgate seus {accessRule.points} pontos por manter a recorrência.</p>
            <button
              onClick={handleClaimAccessPoints}
              className="mt-5 w-full rounded-xl bg-brand-red py-2.5 font-bold text-white hover:bg-brand-red-dark"
            >
              Receber pontos
            </button>
          </div>
        </div>
      )}
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

function CourseRow({
  title,
  pills,
  progress,
  favoriteIds,
  onToggleFavorite,
}: {
  title: string
  pills: Pill[]
  progress: Record<string, UserProgress>
  favoriteIds: Set<string>
  onToggleFavorite: (pillId: string) => void
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-3 flex gap-4 overflow-x-auto pb-1">
        {pills.map((pill) => (
          <div key={pill.id} className="w-64 shrink-0">
            <CourseCard
              pill={pill}
              status={progress[pill.id]?.status ?? 'not_started'}
              favorited={favoriteIds.has(pill.id)}
              onToggleFavorite={() => onToggleFavorite(pill.id)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function CourseCard({
  pill,
  status,
  favorited,
  onToggleFavorite,
}: {
  pill: Pill
  status: UserProgress['status']
  favorited?: boolean
  onToggleFavorite?: () => void
}) {
  return (
    <div className="card relative flex h-full flex-col gap-3 p-4 transition hover:card-highlight">
      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleFavorite()
          }}
          aria-label={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow"
        >
          <Icon name={favorited ? 'heart-filled' : 'heart'} size={14} className={favorited ? 'text-brand-red' : undefined} />
        </button>
      )}
      <Link to={`/curso/${pill.id}`} className="flex flex-1 flex-col gap-3">
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
    </div>
  )
}
