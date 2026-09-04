import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icon'
import { ProgressBar } from '../../components/ProgressBar'
import { RankingWidget } from '../../components/RankingWidget'
import { Tour } from '../../components/Tour'
import type { TourStep } from '../../components/Tour'
import { useAuth } from '../../context/AuthContext'
import {
  completeTour,
  getAllPills,
  getBannerTracks,
  getCategories,
  getDashboardSections,
  getFavoritePillIds,
  getFavoritePills,
  getInProgressPills,
  getMostAccessedPills,
  getMultiModuleTracks,
  getPdiCoursePills,
  getRecentlyAddedPills,
  getRecommendedPills,
  getRequiredPills,
  getTrackWithPills,
  getUserProgressMap,
  toggleFavorite,
  trackProgressPct,
} from '../../lib/api'
import { brasiliaDaysBetween, claimDailyAccess, getLastPointsEvent, getRule } from '../../lib/gamification'
import { formatCargaHoraria } from '../../lib/format'
import type { Category, DashboardSection, GamificationRule, Pill, UserProgress, Track } from '../../types/database'

const NAV_TOUR_STEPS: TourStep[] = [
  {
    title: 'Bem-vindo(a) à plataforma! 👋',
    body: 'Vamos te mostrar rapidinho como navegar por aqui. Leva menos de um minuto.',
  },
  {
    target: '#tour-nav-dashboard',
    title: 'Cursos',
    body: 'Sua página inicial: cursos em andamento, recomendados, mais acessados e o catálogo completo pra explorar.',
  },
  {
    target: '#tour-dashboard-tabs',
    title: 'Meus Cursos x Catálogo Completo',
    body: '"Meus Cursos" mostra o que já faz sentido pra você (em andamento, recomendados, favoritos). "Explorar Catálogo Completo" lista todos os cursos disponíveis.',
  },
  {
    target: '#tour-nav-meu-pdi',
    title: 'Meu PDI',
    body: 'Seu Plano de Desenvolvimento Individual. Tem um tutorial específico pra essa página — vamos te avisar quando você chegar lá.',
  },
  {
    target: '#tour-nav-comunidade',
    title: 'Comunidade',
    body: 'O mural social do evento: publique, curta e comente com outros participantes.',
  },
  {
    target: '#tour-nav-conquistas',
    title: 'Conquistas',
    body: 'Suas badges e marcos desbloqueados conforme você avança nos cursos.',
  },
  {
    target: '#tour-nav-certificados',
    title: 'Certificados',
    body: 'Certificados emitidos automaticamente ao concluir 100% de um curso com certificação habilitada.',
  },
  {
    target: '#tour-ranking-widget',
    title: 'Ranking',
    body: 'Sua posição no ranking geral de pontos, ganhos concluindo cursos, tutoriais e mantendo o acesso em dia.',
  },
  {
    target: '#tour-notifications',
    title: 'Notificações',
    body: 'O sino te avisa sobre reações, conclusões de curso e pontos ganhos.',
  },
  {
    target: '#tour-avatar-button',
    title: 'Seu perfil',
    body: 'Edite seu perfil, refaça este tutorial quando quiser (em "Tutorial de navegação") ou saia da conta por aqui.',
  },
  {
    title: 'Pronto! 🎉',
    body: 'Você já conhece o essencial. Bons estudos — e não esqueça de fazer o Tutorial do Meu PDI quando visitar aquela página pela primeira vez.',
  },
]

export function Dashboard() {
  const { profile, refreshProfile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [track, setTrack] = useState<Track | null>(null)
  const [trackPills, setTrackPills] = useState<Pill[]>([])
  const [allPills, setAllPills] = useState<Pill[]>([])
  const [progress, setProgress] = useState<Record<string, UserProgress>>({})
  const [tab, setTab] = useState<'trilha' | 'catalogo'>('trilha')
  const [loading, setLoading] = useState(true)
  const [accessRule, setAccessRule] = useState<GamificationRule | null>(null)
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [runNavTour, setRunNavTour] = useState(false)

  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [sections, setSections] = useState<DashboardSection[]>([])
  const [sectionPills, setSectionPills] = useState<Record<string, Pill[]>>({})
  const [multiModuleTracks, setMultiModuleTracks] = useState<Map<string, { track: Track; pills: Pill[] }>>(new Map())
  const [bannerTracks, setBannerTracks] = useState<{ track: Track; pills: Pill[] }[]>([])
  const [pdiPills, setPdiPills] = useState<Pill[]>([])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function load() {
      const [progressMap, pills, cats, favIds, sects, banners] = await Promise.all([
        getUserProgressMap(profile!.id),
        getAllPills(),
        getCategories(),
        getFavoritePillIds(profile!.id),
        getDashboardSections(),
        getBannerTracks(),
      ])
      if (cancelled) return
      setProgress(progressMap)
      setAllPills(pills)
      setCategories(cats)
      setFavoriteIds(favIds)
      setSections(sects)
      setBannerTracks(banners)

      let recommendedPills: Pill[] = []
      if (profile!.selected_track_id) {
        const { track: t, pills: tp } = await getTrackWithPills(profile!.selected_track_id)
        if (!cancelled) {
          setTrack(t)
          setTrackPills(tp)
        }
      }
      recommendedPills = await getRecommendedPills(profile!.program_id, profile!.diagnostic_profile, progressMap)

      const [inProgress, recent, favorites, mostAccessed, required, pdiCourses] = await Promise.all([
        getInProgressPills(profile!.id),
        getRecentlyAddedPills(10),
        getFavoritePills(profile!.id),
        getMostAccessedPills(10),
        getRequiredPills(),
        getPdiCoursePills(profile!.id),
      ])
      if (cancelled) return
      const sectionPillsResult = {
        em_andamento: inProgress,
        recomendados: recommendedPills,
        recentes: recent,
        favoritos: favorites,
        mais_acessados: mostAccessed,
        obrigatorios: required,
      }
      setSectionPills(sectionPillsResult)
      setPdiPills(pdiCourses)

      // "Curso com Módulos" (trilha sequencial com 2+ pílulas) deve aparecer
      // como 1 card por curso em vez de 1 card por módulo — diferente de
      // uma trilha curada comum, cujas pílulas continuam sendo browsáveis
      // individualmente (não é sequencial).
      const allTrackIds = [...pills, ...Object.values(sectionPillsResult).flat(), ...pdiCourses].map(
        (p) => p.track_id,
      )
      const tracksMap = await getMultiModuleTracks(allTrackIds)
      if (!cancelled) setMultiModuleTracks(tracksMap)

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
        !lastEvent || brasiliaDaysBetween(new Date(lastEvent.created_at), new Date()) >= recurrenceDays
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

  // Abre sozinho no primeiro acesso do aluno (spec: tour guiado). Reabrir
  // manualmente pelo menu do avatar usa ?tour=nav pra forçar mesmo já
  // tendo sido visto antes.
  useEffect(() => {
    if (!profile || loading) return
    if (searchParams.get('tour') === 'nav') {
      setRunNavTour(true)
      const next = new URLSearchParams(searchParams)
      next.delete('tour')
      setSearchParams(next, { replace: true })
    } else if (!profile.nav_tutorial_seen) {
      setRunNavTour(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, loading])

  async function handleNavTourFinish(completed: boolean) {
    setRunNavTour(false)
    if (!profile) return
    await completeTour(profile.id, 'nav', completed)
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

  const pct = useMemo(() => trackProgressPct(trackPills, progress), [trackPills, progress])
  const completedCount = trackPills.filter((p) => progress[p.id]?.status === 'completed').length

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    return allPills.filter((p) => {
      if (selectedCategoryId) {
        // Um "Curso com Módulos" pode ter a categoria só no curso (não em
        // cada aula) — nesse caso a pílula ainda passa no filtro se a
        // categoria do curso-mãe bater, senão o card do curso inteiro
        // sumiria do catálogo por causa de uma aula sem categoria própria.
        const courseCategoryId = multiModuleTracks.get(p.track_id)?.track.category_id
        if (p.category_id !== selectedCategoryId && courseCategoryId !== selectedCategoryId) return false
      }
      if (q && !p.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [allPills, selectedCategoryId, catalogSearch, multiModuleTracks])

  const catalogCards = useMemo(
    () => collapseToCourseCards(filteredCatalog, multiModuleTracks),
    [filteredCatalog, multiModuleTracks],
  )

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

            {bannerTracks.length > 0 && (
              <BannerCarousel
                items={bannerTracks}
                progress={progress}
                favoriteIds={favoriteIds}
                onToggleFavorite={handleToggleFavorite}
              />
            )}

            {track && (
              <section className="card card-highlight mt-6 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Curso recomendado</p>
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

            <div id="tour-dashboard-tabs" className="mt-8 flex gap-2 rounded-full bg-surface p-1 shadow-sm">
              <button
                onClick={() => setTab('trilha')}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                  tab === 'trilha' ? 'bg-navy text-white' : 'text-ink-soft'
                }`}
              >
                Meus Cursos
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
                {pdiPills.length > 0 && (
                  <CourseRow
                    title="Meu PDI"
                    pills={pdiPills}
                    progress={progress}
                    favoriteIds={favoriteIds}
                    onToggleFavorite={handleToggleFavorite}
                    multiModuleTracks={multiModuleTracks}
                  />
                )}
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
                      multiModuleTracks={multiModuleTracks}
                    />
                  ))}
                {pdiPills.length === 0 &&
                  sections.filter((s) => s.enabled && (sectionPills[s.key]?.length ?? 0) > 0).length === 0 && (
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
                  {catalogCards.map((item) => (
                    <CourseCard
                      key={item.kind === 'pill' ? item.pill.id : item.track.id}
                      item={item}
                      progress={progress}
                      favorited={item.kind === 'pill' ? favoriteIds.has(item.pill.id) : undefined}
                      onToggleFavorite={item.kind === 'pill' ? () => handleToggleFavorite(item.pill.id) : undefined}
                    />
                  ))}
                  {catalogCards.length === 0 && <p className="col-span-full text-ink-soft">Nenhum curso encontrado.</p>}
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

          <aside id="tour-ranking-widget" className="mt-6 lg:sticky lg:top-6 lg:mt-0">
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

      {runNavTour && (
        <Tour
          steps={NAV_TOUR_STEPS}
          onFinish={handleNavTourFinish}
          laterHint='no menu do seu avatar, em "Tutorial de navegação"'
        />
      )}
    </div>
  )
}

// Cada eixo/curso cai sempre na mesma família de cor (mesmo hash), só que
// agora como gradiente — usado na capa de fallback do card, pra ele nunca
// ficar com um cantinho de ícone boiando num card quase todo em branco.
const COVER_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-fuchsia-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
]

function gradientForAxis(axis: string | null) {
  const s = axis ?? ''
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length]
}

const ACTION_LABEL: Record<UserProgress['status'], string> = {
  completed: 'Revisar',
  in_progress: 'Continuar',
  not_started: 'Iniciar',
}

// Vermelho pra chamar atenção pro que ainda não começou, navy pra retomar
// o que já está em andamento, verde (mesma cor de "concluído" no resto do
// app) pra revisar algo já finalizado.
const ACTION_COLOR: Record<UserProgress['status'], string> = {
  completed: 'bg-success hover:bg-green-700',
  in_progress: 'bg-navy hover:bg-navy-dark',
  not_started: 'bg-brand-red hover:bg-brand-red-dark',
}

type DisplayCard = { kind: 'pill'; pill: Pill } | { kind: 'course'; track: Track; modules: Pill[] }

/** Colapsa uma lista de pílulas em cards de exibição: pílulas de um "Curso
 * com Módulos" (trilha sequencial, 2+ pílulas) viram 1 card de curso só
 * (dedupado), enquanto pílulas avulsas ou de trilhas curadas comuns
 * continuam 1 card por pílula, como sempre. */
function collapseToCourseCards(
  pills: Pill[],
  multiModuleTracks: Map<string, { track: Track; pills: Pill[] }>,
): DisplayCard[] {
  const seenTracks = new Set<string>()
  const cards: DisplayCard[] = []
  for (const pill of pills) {
    const group = multiModuleTracks.get(pill.track_id)
    if (group) {
      if (seenTracks.has(group.track.id)) continue
      seenTracks.add(group.track.id)
      cards.push({ kind: 'course', track: group.track, modules: group.pills })
    } else {
      cards.push({ kind: 'pill', pill })
    }
  }
  return cards
}

function BannerCarousel({
  items,
  progress,
  favoriteIds,
  onToggleFavorite,
}: {
  items: { track: Track; pills: Pill[] }[]
  progress: Record<string, UserProgress>
  favoriteIds: Set<string>
  onToggleFavorite: (pillId: string) => void
}) {
  const [index, setIndex] = useState(0)
  const count = items.length

  useEffect(() => {
    if (count <= 1) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 6000)
    return () => clearInterval(timer)
  }, [count])

  // Se a lista de banners mudar (ex: um expirou), não deixa o índice
  // apontar pra fora dos limites.
  const current = items[index] ?? items[0]
  if (!current) return null

  // "Iniciar" e "favoritar" apontam pro primeiro módulo não concluído do
  // curso (ou o primeiro, se nenhum foi começado ainda) — mesma regra do
  // card de curso normal.
  const target = current.pills.find((p) => progress[p.id]?.status !== 'completed') ?? current.pills[0]
  const favorited = target ? favoriteIds.has(target.id) : false

  return (
    <div
      className="group relative mt-6 w-full overflow-hidden rounded-2xl bg-navy-light"
      style={{ aspectRatio: '1326 / 495' }}
    >
      {items.map((item, i) => (
        <img
          key={item.track.id}
          src={item.track.cover_url ?? undefined}
          alt={item.track.title}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />

      {target && (
        <div className="absolute bottom-4 left-4 flex items-center gap-3">
          <Link
            to={`/curso/${target.id}`}
            aria-label="Iniciar curso"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-red text-white shadow-lg transition hover:scale-105 hover:bg-brand-red-dark"
          >
            <span className="ml-0.5 text-lg">▶</span>
          </Link>
          <button
            onClick={() => onToggleFavorite(target.id)}
            aria-label={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow-lg transition hover:scale-105"
          >
            <Icon name={favorited ? 'heart-filled' : 'heart'} size={18} className={favorited ? 'text-brand-red' : undefined} />
          </button>
        </div>
      )}

      {count > 1 && (
        <>
          <button
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
            aria-label="Banner anterior"
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white opacity-0 transition hover:bg-black/50 group-hover:opacity-100"
          >
            ‹
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % count)}
            aria-label="Próximo banner"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white opacity-0 transition hover:bg-black/50 group-hover:opacity-100"
          >
            ›
          </button>
          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {items.map((item, i) => (
              <button
                key={item.track.id}
                onClick={() => setIndex(i)}
                aria-label={`Ir para o banner ${i + 1}`}
                className={`h-1.5 w-4 rounded-full transition ${i === index ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function CourseRow({
  title,
  pills,
  progress,
  favoriteIds,
  onToggleFavorite,
  multiModuleTracks,
}: {
  title: string
  pills: Pill[]
  progress: Record<string, UserProgress>
  favoriteIds: Set<string>
  onToggleFavorite: (pillId: string) => void
  multiModuleTracks: Map<string, { track: Track; pills: Pill[] }>
}) {
  const cards = collapseToCourseCards(pills, multiModuleTracks)
  return (
    <section>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-3 flex gap-4 overflow-x-auto pb-1">
        {cards.map((item) => (
          <div key={item.kind === 'pill' ? item.pill.id : item.track.id} className="w-64 shrink-0">
            <CourseCard
              item={item}
              progress={progress}
              favorited={item.kind === 'pill' ? favoriteIds.has(item.pill.id) : undefined}
              onToggleFavorite={item.kind === 'pill' ? () => onToggleFavorite(item.pill.id) : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function CourseCard({
  item,
  progress,
  favorited,
  onToggleFavorite,
}: {
  item: DisplayCard
  progress: Record<string, UserProgress>
  favorited?: boolean
  onToggleFavorite?: () => void
}) {
  const isCourse = item.kind === 'course'
  const title = isCourse ? item.track.title : item.pill.title
  const description = isCourse ? item.track.description : item.pill.description
  const thumbnailUrl = isCourse ? item.track.thumbnail_url ?? item.track.cover_url : item.pill.thumbnail_url
  const axis = isCourse ? item.track.title : item.pill.axis
  const metaLine = isCourse
    ? `${item.modules.length} ${item.modules.length === 1 ? 'módulo' : 'módulos'}${item.track.carga_horaria_total ? ` · ${formatCargaHoraria(item.track.carga_horaria_total)}` : ''}`
    : `${item.pill.axis} · ${item.pill.duration}`

  let status: UserProgress['status'] = 'not_started'
  let linkTargetId: string
  let pct = 0
  if (isCourse) {
    const completedCount = item.modules.filter((m) => progress[m.id]?.status === 'completed').length
    const started = item.modules.some((m) => progress[m.id]?.status !== undefined)
    status = completedCount === item.modules.length ? 'completed' : started ? 'in_progress' : 'not_started'
    linkTargetId = (item.modules.find((m) => progress[m.id]?.status !== 'completed') ?? item.modules[0]).id
    pct = item.modules.length ? Math.round((completedCount / item.modules.length) * 100) : 0
  } else {
    status = progress[item.pill.id]?.status ?? 'not_started'
    linkTargetId = item.pill.id
  }

  return (
    <div className="card relative flex h-full flex-col overflow-hidden p-0 transition duration-200 hover:-translate-y-1 hover:shadow-lg">
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
      <Link to={`/curso/${linkTargetId}`} className="flex flex-1 flex-col">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-32 w-full shrink-0 object-cover" />
        ) : (
          <div className={`relative flex h-32 w-full shrink-0 items-center justify-center bg-gradient-to-br ${gradientForAxis(axis)}`}>
            <Icon name={isCourse ? 'graduation-cap' : 'book'} size={34} className="text-white/90" />
            {isCourse && (
              <span className="absolute left-3 top-3 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                Curso
              </span>
            )}
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-navy">{metaLine}</p>
          <h3 className="-mt-1 font-bold leading-snug text-ink">{title}</h3>
          {description && <p className="line-clamp-2 text-sm text-ink-soft">{description}</p>}
          {isCourse && status !== 'not_started' && (
            <div className="mt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-ink-soft">
                <span>{pct}% concluído</span>
              </div>
              <ProgressBar value={pct} />
            </div>
          )}
          <div className="mt-auto flex items-center justify-end pt-2">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-white transition ${ACTION_COLOR[status]}`}
            >
              {ACTION_LABEL[status]}
              <Icon name="arrow-right" size={12} />
            </span>
          </div>
        </div>
      </Link>
    </div>
  )
}
