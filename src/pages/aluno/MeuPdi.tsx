import { useEffect, useMemo, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { useConfirm } from '../../components/ConfirmDialog'
import { ProgressBar } from '../../components/ProgressBar'
import { Tour } from '../../components/Tour'
import type { TourStep } from '../../components/Tour'
import { useAuth } from '../../context/AuthContext'
import {
  addPillToPlan,
  addTrackToPlan,
  completeTour,
  createPlan,
  createPlanWithPill,
  createPlanWithTrack,
  getAllTracks,
  getCatalogPills,
  getPlanItems,
  getSkillCategories,
  getSkillRatings,
  getTracksBySkillCategory,
  getTrackWithPills,
  getUserPlans,
  recomputeAndSaveTier,
  removePlan,
  upsertSelfRating,
} from '../../lib/api'
import { getProgramJourney, JORNADA_CADENCE, TIER_META } from '../../lib/pdiJourneys'
import { TIER_LABEL, TIER_RANGE } from '../../lib/pdiTier'
import { supabase } from '../../lib/supabase'
import type { DiagnosticProfile, PdiJornadaBucket, PdiPlan, PdiPlanItem, PdiTier, Pill, SkillCategory, SkillRating, Track } from '../../types/database'

const TIER_BADGE_CLASS: Record<PdiTier, string> = {
  abaixo: 'bg-amber-50 text-amber-700',
  proximo: 'bg-sky-50 text-sky-700',
  dentro: 'bg-green-50 text-success',
  acima: 'bg-purple-50 text-purple-700',
}

const BUCKET_LABEL: Record<PdiJornadaBucket, string> = {
  pratica: 'Prática real · 70%',
  mentoria: 'Mentoria e exposição · 20%',
  formacao: 'Educação formal · 10%',
}

type Tab = 'pdi' | 'balanco' | 'biblioteca'

function pdiTourSteps(setTab: (t: Tab) => void): TourStep[] {
  return [
    {
      title: 'Conheça o Meu PDI 🎯',
      body: 'Aqui você monta seu Plano de Desenvolvimento Individual e acompanha sua evolução. Vamos ver as 3 abas.',
    },
    {
      target: '#pdi-tab-pdi',
      onEnter: () => setTab('pdi'),
      title: 'Aba "Meu PDI"',
      body: 'Seus planos pessoais de desenvolvimento. Cada plano organiza itens em Prática real (70%), Mentoria (20%) e Educação formal (10%) — a metodologia 70-20-10.',
    },
    {
      target: '#pdi-create-plan-btn',
      onEnter: () => setTab('pdi'),
      title: 'Criar um plano',
      body: 'Clique aqui pra criar seu primeiro plano pessoal. Você pode partir da taxonomia de skills do seu curso ou começar do zero.',
    },
    {
      target: '#pdi-tab-balanco',
      onEnter: () => setTab('balanco'),
      title: 'Aba "Balanço de Competências"',
      body: 'Autoavalie suas competências de 1 a 5. É diferente do PDI: aqui você mede onde está hoje, não o que vai fazer a seguir.',
    },
    {
      target: '#pdi-tab-biblioteca',
      onEnter: () => setTab('biblioteca'),
      title: 'Aba "Biblioteca de Trilhas"',
      body: 'Explore trilhas e cursos avulsos além da sua trilha recomendada, e adicione qualquer um deles a um plano pessoal.',
    },
    {
      title: 'Pronto! 🎉',
      body: 'Agora é só montar seu plano e acompanhar o progresso por aqui sempre que quiser.',
    },
  ]
}

export function MeuPdi() {
  const { profile, refreshProfile } = useAuth()
  const [tab, setTab] = useState<Tab>('pdi')
  const [runPdiTour, setRunPdiTour] = useState(false)

  useEffect(() => {
    if (profile && !profile.pdi_tutorial_seen) setRunPdiTour(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function finishPdiTour(userId: string, completed: boolean) {
    setRunPdiTour(false)
    await completeTour(userId, 'pdi', completed)
    await refreshProfile()
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-ink">Meu PDI</h1>
          <button
            onClick={() => setRunPdiTour(true)}
            className="rounded-full border border-navy-light px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-navy-light"
          >
            Tutorial Meu PDI
          </button>
        </div>
        <p className="mt-1 text-ink-soft">
          Plano de Desenvolvimento Individual — cruzando sua trilha do evento com a taxonomia de skills do curso.
        </p>

        <div className="mt-6 flex gap-2 rounded-full bg-surface p-1 shadow-sm">
          {(
            [
              ['pdi', 'Meu PDI'],
              ['balanco', 'Balanço de Competências'],
              ['biblioteca', 'Biblioteca de Trilhas'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              id={`pdi-tab-${key}`}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                tab === key ? 'bg-navy text-white' : 'text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div id="pdi-tab-panel">
          {profile && tab === 'pdi' && <MeuPdiTab userId={profile.id} programId={profile.program_id ?? null} />}
          {profile && tab === 'balanco' && <BalancoTab userId={profile.id} programId={profile.program_id} />}
          {profile && tab === 'biblioteca' && (
            <BibliotecaTab userId={profile.id} programId={profile.program_id} diagnosticProfile={profile.diagnostic_profile} />
          )}
        </div>
      </main>

      {profile && runPdiTour && (
        <Tour
          steps={pdiTourSteps(setTab)}
          onFinish={(completed) => finishPdiTour(profile.id, completed)}
          laterHint='no topo da página Meu PDI, em "Tutorial Meu PDI"'
        />
      )}
    </div>
  )
}

// ---------------- Meu PDI tab ----------------

function MeuPdiTab({ userId, programId }: { userId: string; programId: string | null }) {
  const [plans, setPlans] = useState<PdiPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  async function reload() {
    setLoading(true)
    await recomputeAndSaveTier(userId)
    setPlans(await getUserPlans(userId))
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return (
    <div className="mt-6 space-y-5">
      {loading && <p className="text-ink-soft">Carregando…</p>}
      {!loading && plans.map((plan) => <PlanCard key={plan.id} plan={plan} programId={programId} onChanged={reload} />)}

      {!loading && plans.length === 0 && (
        <p className="text-ink-soft">Você ainda não tem nenhum plano. Crie o primeiro abaixo.</p>
      )}

      <button
        id="pdi-create-plan-btn"
        onClick={() => setShowCreate(true)}
        className="w-full rounded-2xl border-2 border-dashed border-navy-light py-4 font-semibold text-navy hover:border-navy"
      >
        + Criar novo plano pessoal
      </button>

      {showCreate && (
        <CreatePlanModal
          userId={userId}
          programId={programId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function PlanCard({ plan, programId, onChanged }: { plan: PdiPlan; programId: string | null; onChanged: () => void }) {
  const confirm = useConfirm()
  const [items, setItems] = useState<PdiPlanItem[]>([])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  async function loadItems() {
    const planItems = await getPlanItems(plan.id)
    setItems(planItems)

    const pillIds = planItems.filter((i) => i.item_type === 'pill').map((i) => i.ref_id)
    const skillIds = planItems.filter((i) => i.item_type === 'skill_category').map((i) => i.ref_id)

    const labelMap: Record<string, string> = {}
    if (pillIds.length) {
      const { data } = await supabase.from('pills').select('id,title').in('id', pillIds)
      for (const row of (data as Pick<Pill, 'id' | 'title'>[]) ?? []) labelMap[row.id] = row.title
    }
    if (skillIds.length) {
      const { data } = await supabase.from('skill_categories').select('id,name').in('id', skillIds)
      for (const row of (data as Pick<SkillCategory, 'id' | 'name'>[]) ?? []) labelMap[row.id] = row.name
    }
    setLabels(labelMap)
    setLoading(false)
  }

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id])

  const pct = useMemo(() => {
    if (items.length === 0) return 0
    const sum = items.reduce((acc, i) => acc + i.progress_current / Math.max(1, i.progress_total), 0)
    return Math.round((sum / items.length) * 100)
  }, [items])

  async function handleRemove() {
    if (!(await confirm(`Remover o plano "${plan.title}"? Esta ação não pode ser desfeita.`, { danger: true, confirmLabel: 'Remover' }))) return
    await removePlan(plan.id)
    onChanged()
  }

  const tier = plan.tier ?? 'abaixo'
  const journey = getProgramJourney(programId, tier)
  const meta = TIER_META[tier]
  const cadence = JORNADA_CADENCE[tier]

  const grouped: Record<PdiJornadaBucket, PdiPlanItem[]> = { pratica: [], mentoria: [], formacao: [] }
  const ungrouped: PdiPlanItem[] = []
  for (const item of items) {
    if (item.jornada_bucket) grouped[item.jornada_bucket].push(item)
    else ungrouped.push(item)
  }

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink">{plan.title}</h3>
          {plan.endorsed && (
            <span className="mt-1 inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-success">
              Endossado pelo moderador
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-ink-soft">{pct}%</span>
      </div>
      <div className="mt-3">
        <ProgressBar value={pct} />
      </div>

      <div className="mt-5 rounded-2xl border border-navy-light/60 bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-ink">Sua jornada agora — {meta.title}</h4>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIER_BADGE_CLASS[tier]}`}>
            {TIER_LABEL[tier]} <span className="opacity-70">({TIER_RANGE[tier]})</span>
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">{meta.summary}</p>
        {journey.inferred && (
          <p className="mt-1 text-xs italic text-ink-soft">
            Exemplo inferido — este curso ainda não tem PPP próprio analisado.
          </p>
        )}
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="font-semibold text-navy">{BUCKET_LABEL.pratica}</dt>
            <dd className="text-ink-soft">{journey.pratica}</dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">{BUCKET_LABEL.mentoria}</dt>
            <dd className="text-ink-soft">{journey.mentoria}</dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">{BUCKET_LABEL.formacao}</dt>
            <dd className="text-ink-soft">{journey.formacao}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-soft">
          Cadência: {cadence.freq.toLowerCase()} — {cadence.detail}
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {loading && <p className="text-sm text-ink-soft">Carregando itens…</p>}
        {!loading &&
          (['pratica', 'mentoria', 'formacao'] as PdiJornadaBucket[]).map((bucket) =>
            grouped[bucket].length === 0 ? null : (
              <div key={bucket}>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{BUCKET_LABEL[bucket]}</p>
                <div className="mt-1 divide-y divide-navy-light/60">
                  {grouped[bucket].map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      label={labels[item.ref_id] ?? item.ref_id}
                      planId={plan.id}
                      planItems={items}
                      onAdded={loadItems}
                    />
                  ))}
                </div>
              </div>
            ),
          )}
        {!loading && ungrouped.length > 0 && (
          <div className="divide-y divide-navy-light/60">
            {ungrouped.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                label={labels[item.ref_id] ?? item.ref_id}
                planId={plan.id}
                planItems={items}
                onAdded={loadItems}
              />
            ))}
          </div>
        )}
        {!loading && items.length === 0 && <p className="text-sm text-ink-soft">Nenhum item ainda.</p>}
      </div>

      <button onClick={handleRemove} className="mt-4 text-sm font-medium text-brand-red hover:underline">
        Remover plano
      </button>
    </div>
  )
}

const TRACK_STATUS_LABEL: Record<'completed' | 'in_progress' | 'not_started', string> = {
  completed: 'Concluído',
  in_progress: 'Em andamento',
  not_started: 'Ainda não iniciado',
}

const TRACK_STATUS_COLOR: Record<'completed' | 'in_progress' | 'not_started', string> = {
  completed: 'bg-success',
  in_progress: 'bg-navy',
  not_started: 'bg-gray-300 text-ink-soft',
}

function ItemRow({
  item,
  label,
  planId,
  planItems,
  onAdded,
}: {
  item: PdiPlanItem
  label: string
  planId: string
  planItems: PdiPlanItem[]
  onAdded: () => Promise<void>
}) {
  const isSkill = item.item_type === 'skill_category'
  const [open, setOpen] = useState(false)
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [suggested, setSuggested] = useState<Track[] | null>(null)
  const [trackPillsMap, setTrackPillsMap] = useState<Map<string, Pill[]>>(new Map())
  const [addingId, setAddingId] = useState<string | null>(null)

  // Pill items já presentes no plano — usado pra saber se um curso sugerido
  // já foi adicionado (e então mostrar o andamento dele em vez do botão
  // "+ Adicionar", que ficaria enganoso repetido pro mesmo curso).
  const addedPillMap = useMemo(() => {
    const map = new Map<string, PdiPlanItem>()
    for (const i of planItems) if (i.item_type === 'pill') map.set(i.ref_id, i)
    return map
  }, [planItems])

  async function toggle() {
    if (!isSkill) return
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (suggested === null) {
      setLoadingTracks(true)
      const tracks = await getTracksBySkillCategory(item.ref_id)
      const withPills = await Promise.all(tracks.map((t) => getTrackWithPills(t.id)))
      const map = new Map<string, Pill[]>()
      tracks.forEach((t, idx) => map.set(t.id, withPills[idx].pills))
      setTrackPillsMap(map)
      setSuggested(tracks)
      setLoadingTracks(false)
    }
  }

  async function handleAdd(track: Track) {
    setAddingId(track.id)
    await addTrackToPlan(planId, track.id)
    await onAdded()
    setAddingId(null)
  }

  return (
    <div className="py-2.5">
      <div
        className={`flex items-center gap-3 ${isSkill ? 'cursor-pointer' : ''}`}
        onClick={toggle}
        role={isSkill ? 'button' : undefined}
      >
        <StatusCircle status={item.status} />
        <span className="flex-1 text-sm font-medium text-navy">{label}</span>
        <span className="text-xs text-ink-soft">
          {item.progress_current} / {item.progress_total}
        </span>
        {isSkill && <span className="text-xs text-ink-soft">{open ? '▲' : '▼'}</span>}
      </div>

      {isSkill && open && (
        <div className="ml-7 mt-2 rounded-xl bg-bg p-3">
          {loadingTracks && <p className="text-xs text-ink-soft">Buscando cursos…</p>}
          {!loadingTracks && suggested && suggested.length === 0 && (
            <p className="text-xs text-ink-soft">Nenhum curso vinculado a esta competência ainda.</p>
          )}
          {!loadingTracks && suggested && suggested.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Cursos sugeridos</p>
              {suggested.map((track) => {
                const pills = trackPillsMap.get(track.id) ?? []
                const matchedItems = pills
                  .map((p) => addedPillMap.get(p.id))
                  .filter((i): i is PdiPlanItem => !!i)
                const alreadyAdded = matchedItems.length > 0
                const total = pills.length
                const completedCount = matchedItems.filter((i) => i.status === 'concluido').length
                const startedCount = matchedItems.filter((i) => i.status !== 'nao_iniciado').length
                const pct = total ? Math.round((completedCount / total) * 100) : 0
                const status: 'completed' | 'in_progress' | 'not_started' =
                  total > 0 && completedCount === total ? 'completed' : startedCount > 0 ? 'in_progress' : 'not_started'

                return (
                  <div key={track.id} className="flex items-center gap-3 rounded-lg bg-surface p-2">
                    {track.thumbnail_url && (
                      <img src={track.thumbnail_url} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{track.title}</span>
                      {alreadyAdded && (
                        <div className="mt-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-ink-soft">
                            <span>{pct}% concluído</span>
                          </div>
                          <ProgressBar value={pct} />
                        </div>
                      )}
                    </div>
                    {alreadyAdded ? (
                      <span
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-white ${TRACK_STATUS_COLOR[status]}`}
                      >
                        {TRACK_STATUS_LABEL[status]}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(track)}
                        disabled={addingId === track.id}
                        className="shrink-0 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
                      >
                        {addingId === track.id ? 'Adicionando…' : '+ Adicionar ao PDI'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusCircle({ status }: { status: PdiPlanItem['status'] }) {
  if (status === 'concluido') {
    return <span className="h-4 w-4 shrink-0 rounded-full bg-success" />
  }
  if (status === 'em_andamento') {
    return (
      <span className="h-4 w-4 shrink-0 rounded-full border-2 border-brand-red" style={{
        background: 'conic-gradient(var(--color-brand-red) 50%, transparent 50%)',
      }} />
    )
  }
  return <span className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />
}

function CreatePlanModal({
  userId,
  programId,
  onClose,
  onCreated,
}: {
  userId: string
  programId: string | null
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [origin, setOrigin] = useState<'taxonomia' | 'vazio'>('taxonomia')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    setSaving(true)
    await createPlan(userId, title || 'Plano pessoal', origin, programId)
    setSaving(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-ink">Criar novo plano pessoal</h3>
        <input
          className="mt-4 w-full rounded-xl border border-navy-light px-4 py-3 outline-none focus:border-navy"
          placeholder="Título do plano"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 rounded-xl border-2 border-navy-light p-3 has-[:checked]:border-navy">
            <input type="radio" checked={origin === 'taxonomia'} onChange={() => setOrigin('taxonomia')} />
            <div>
              <p className="text-sm font-semibold text-ink">Baseado na taxonomia do curso</p>
              <p className="text-xs text-ink-soft">Pré-popula com as categorias de skill do seu curso</p>
            </div>
          </label>
          <label className="flex items-center gap-2 rounded-xl border-2 border-navy-light p-3 has-[:checked]:border-navy">
            <input type="radio" checked={origin === 'vazio'} onChange={() => setOrigin('vazio')} />
            <div>
              <p className="text-sm font-semibold text-ink">Do zero</p>
              <p className="text-xs text-ink-soft">Comece um plano vazio e adicione itens manualmente</p>
            </div>
          </label>
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {saving ? 'Criando…' : 'Criar plano'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Balanço de Competências tab ----------------

function BalancoTab({ userId, programId }: { userId: string; programId: string | null }) {
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [ratings, setRatings] = useState<SkillRating[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!programId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      const [cats, rats] = await Promise.all([getSkillCategories(programId!), getSkillRatings(userId)])
      if (!cancelled) {
        setCategories(cats)
        setRatings(rats)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId, programId])

  async function rate(categoryId: string, value: number) {
    await upsertSelfRating(userId, categoryId, value)
    setRatings((prev) => {
      const others = prev.filter((r) => r.skill_category_id !== categoryId)
      return [
        ...others,
        { id: '', user_id: userId, skill_category_id: categoryId, self_rating: value, moderator_rating: null, rated_at: '' },
      ]
    })
    await recomputeAndSaveTier(userId)
  }

  if (loading) return <p className="mt-6 text-ink-soft">Carregando…</p>
  if (!programId) return <p className="mt-6 text-ink-soft">Vincule seu curso para ver o balanço de competências.</p>

  return (
    <div className="mt-6 space-y-4">
      {categories.map((cat) => {
        const rating = ratings.find((r) => r.skill_category_id === cat.id)
        return (
          <div key={cat.id} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink">{cat.name}</p>
                <p className="text-xs uppercase tracking-wide text-ink-soft">{cat.type}</p>
              </div>
              {rating?.moderator_rating != null && (
                <span className="text-xs font-semibold text-navy">Moderador: {rating.moderator_rating}/5</span>
              )}
            </div>
            <div className="mt-3 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => rate(cat.id, v)}
                  className={`h-8 w-8 rounded-full text-xs font-bold transition ${
                    (rating?.self_rating ?? 0) >= v ? 'bg-brand-red text-white' : 'bg-navy-light text-navy'
                  }`}
                >
                  {v}
                </button>
              ))}
              <span className="ml-2 self-center text-xs text-ink-soft">Sua autoavaliação</span>
            </div>
          </div>
        )
      })}
      {categories.length === 0 && <p className="text-ink-soft">Nenhuma categoria de skill cadastrada para o curso.</p>}
    </div>
  )
}

// ---------------- Biblioteca de Trilhas tab ----------------

type LibraryItem = { kind: 'track'; track: Track } | { kind: 'pill'; pill: Pill }

function BibliotecaTab({
  userId,
  programId,
  diagnosticProfile,
}: {
  userId: string
  programId: string | null
  diagnosticProfile: DiagnosticProfile | null
}) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [catalogPills, setCatalogPills] = useState<Pill[]>([])
  const [plans, setPlans] = useState<PdiPlan[]>([])
  const [picker, setPicker] = useState<LibraryItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [t, cp, p] = await Promise.all([
        getAllTracks(),
        getCatalogPills(programId, diagnosticProfile),
        getUserPlans(userId),
      ])
      if (!cancelled) {
        setTracks(t)
        setCatalogPills(cp)
        setPlans(p)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId, programId, diagnosticProfile])

  async function handleAddTrack(track: Track) {
    if (plans.length === 0) {
      await createPlanWithTrack(userId, `PDI — ${track.title}`, track.id)
      setPlans(await getUserPlans(userId))
      return
    }
    setPicker({ kind: 'track', track })
  }

  async function handleAddPill(pill: Pill) {
    if (plans.length === 0) {
      await createPlanWithPill(userId, `PDI — ${pill.title}`, pill.id)
      setPlans(await getUserPlans(userId))
      return
    }
    setPicker({ kind: 'pill', pill })
  }

  if (loading) return <p className="mt-6 text-ink-soft">Carregando…</p>

  return (
    <div className="mt-6 space-y-8">
      <div>
        <h3 className="font-bold text-ink">Trilhas</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {tracks.map((track) => (
            <div key={track.id} className="card overflow-hidden">
              {track.thumbnail_url && <img src={track.thumbnail_url} alt="" className="h-28 w-full object-cover" />}
              <div className="p-5">
                <h4 className="font-bold text-ink">{track.title}</h4>
                {track.description && <p className="mt-1 text-sm text-ink-soft">{track.description}</p>}
                <button
                  onClick={() => handleAddTrack(track)}
                  className="mt-4 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
                >
                  + Adicionar ao PDI
                </button>
              </div>
            </div>
          ))}
          {tracks.length === 0 && <p className="text-ink-soft">Nenhuma trilha cadastrada ainda.</p>}
        </div>
      </div>

      <div>
        <h3 className="font-bold text-ink">Cursos avulsos da Biblioteca</h3>
        <p className="text-sm text-ink-soft">Não entram no seu PDI automaticamente — só se você adicionar.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {catalogPills.map((pill) => (
            <div key={pill.id} className="card overflow-hidden">
              {pill.thumbnail_url && <img src={pill.thumbnail_url} alt="" className="h-28 w-full object-cover" />}
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{pill.axis}</p>
                <h4 className="mt-0.5 font-bold text-ink">{pill.title}</h4>
                {pill.description && <p className="mt-1 text-sm text-ink-soft">{pill.description}</p>}
                <button
                  onClick={() => handleAddPill(pill)}
                  className="mt-4 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
                >
                  + Adicionar ao PDI
                </button>
              </div>
            </div>
          ))}
          {catalogPills.length === 0 && (
            <p className="text-ink-soft">
              {programId && diagnosticProfile
                ? 'Nenhum curso avulso disponível para o seu perfil ainda.'
                : 'Vincule seu curso e perfil pra ver os cursos avulsos disponíveis pra você.'}
            </p>
          )}
        </div>
      </div>

      {picker && (
        <AddToPlanModal
          userId={userId}
          item={picker}
          plans={plans}
          onClose={() => setPicker(null)}
          onDone={async () => {
            setPicker(null)
            setPlans(await getUserPlans(userId))
          }}
        />
      )}
    </div>
  )
}

function AddToPlanModal({
  userId,
  item,
  plans,
  onClose,
  onDone,
}: {
  userId: string
  item: LibraryItem
  plans: PdiPlan[]
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const title = item.kind === 'track' ? item.track.title : item.pill.title

  async function addToExisting(planId: string) {
    setSaving(true)
    if (item.kind === 'track') await addTrackToPlan(planId, item.track.id)
    else await addPillToPlan(planId, item.pill.id)
    setSaving(false)
    onDone()
  }

  async function createNew() {
    setSaving(true)
    if (item.kind === 'track') await createPlanWithTrack(userId, `PDI — ${item.track.title}`, item.track.id)
    else await createPlanWithPill(userId, `PDI — ${item.pill.title}`, item.pill.id)
    setSaving(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-ink">Adicionar "{title}" a qual plano?</h3>
        <div className="mt-4 space-y-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => addToExisting(plan.id)}
              disabled={saving}
              className="w-full rounded-xl border-2 border-navy-light p-3 text-left font-semibold text-ink hover:border-navy disabled:opacity-60"
            >
              {plan.title}
            </button>
          ))}
          <button
            onClick={createNew}
            disabled={saving}
            className="w-full rounded-xl border-2 border-dashed border-navy-light p-3 text-left font-semibold text-navy hover:border-navy disabled:opacity-60"
          >
            + Criar novo plano com {item.kind === 'track' ? 'esta trilha' : 'este curso'}
          </button>
        </div>
        <button onClick={onClose} className="mt-4 text-sm font-medium text-ink-soft hover:text-navy">
          Cancelar
        </button>
      </div>
    </div>
  )
}
