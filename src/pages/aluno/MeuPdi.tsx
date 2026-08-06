import { useEffect, useMemo, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { ProgressBar } from '../../components/ProgressBar'
import { useAuth } from '../../context/AuthContext'
import {
  addTrackToPlan,
  createPlan,
  createPlanWithTrack,
  getAllTracks,
  getPlanItems,
  getSkillCategories,
  getSkillRatings,
  getUserPlans,
  removePlan,
  upsertSelfRating,
} from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { PdiPlan, PdiPlanItem, Pill, SkillCategory, SkillRating, Track } from '../../types/database'

type Tab = 'pdi' | 'balanco' | 'biblioteca'

export function MeuPdi() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('pdi')

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">Meu PDI</h1>
        <p className="mt-1 text-ink-soft">
          Plano de Desenvolvimento Individual — cruzando sua trilha do evento com a taxonomia de skills do curso.
        </p>

        <div className="mt-6 flex gap-2 rounded-full bg-white p-1 shadow-sm">
          {(
            [
              ['pdi', 'Meu PDI'],
              ['balanco', 'Balanço de Competências'],
              ['biblioteca', 'Biblioteca de Trilhas'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                tab === key ? 'bg-navy text-white' : 'text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {profile && tab === 'pdi' && <MeuPdiTab userId={profile.id} programId={profile.program_id} />}
        {profile && tab === 'balanco' && <BalancoTab userId={profile.id} programId={profile.program_id} />}
        {profile && tab === 'biblioteca' && <BibliotecaTab userId={profile.id} />}
      </main>
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
      {!loading && plans.map((plan) => <PlanCard key={plan.id} plan={plan} onChanged={reload} />)}

      {!loading && plans.length === 0 && (
        <p className="text-ink-soft">Você ainda não tem nenhum plano. Crie o primeiro abaixo.</p>
      )}

      <button
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

function PlanCard({ plan, onChanged }: { plan: PdiPlan; onChanged: () => void }) {
  const [items, setItems] = useState<PdiPlanItem[]>([])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const planItems = await getPlanItems(plan.id)
      if (cancelled) return
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
      if (!cancelled) {
        setLabels(labelMap)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [plan.id])

  const pct = useMemo(() => {
    if (items.length === 0) return 0
    const sum = items.reduce((acc, i) => acc + i.progress_current / Math.max(1, i.progress_total), 0)
    return Math.round((sum / items.length) * 100)
  }, [items])

  async function handleRemove() {
    if (!confirm(`Remover o plano "${plan.title}"? Esta ação não pode ser desfeita.`)) return
    await removePlan(plan.id)
    onChanged()
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

      <div className="mt-4 divide-y divide-navy-light/60">
        {loading && <p className="py-2 text-sm text-ink-soft">Carregando itens…</p>}
        {!loading &&
          items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-2.5">
              <StatusCircle status={item.status} />
              <span className="flex-1 text-sm font-medium text-navy">
                {labels[item.ref_id] ?? item.ref_id}
              </span>
              <span className="text-xs text-ink-soft">
                {item.progress_current} / {item.progress_total}
              </span>
            </div>
          ))}
        {!loading && items.length === 0 && <p className="py-2 text-sm text-ink-soft">Nenhum item ainda.</p>}
      </div>

      <button onClick={handleRemove} className="mt-4 text-sm font-medium text-brand-red hover:underline">
        Remover plano
      </button>
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

function BibliotecaTab({ userId }: { userId: string }) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [plans, setPlans] = useState<PdiPlan[]>([])
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [t, p] = await Promise.all([getAllTracks(), getUserPlans(userId)])
      if (!cancelled) {
        setTracks(t)
        setPlans(p)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  async function handleAdd(track: Track) {
    if (plans.length === 0) {
      await createPlanWithTrack(userId, `PDI — ${track.title}`, track.id)
      setPlans(await getUserPlans(userId))
      return
    }
    setPickerTrack(track)
  }

  if (loading) return <p className="mt-6 text-ink-soft">Carregando…</p>

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {tracks.map((track) => (
        <div key={track.id} className="card p-5">
          <h3 className="font-bold text-ink">{track.title}</h3>
          {track.description && <p className="mt-1 text-sm text-ink-soft">{track.description}</p>}
          <button
            onClick={() => handleAdd(track)}
            className="mt-4 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
          >
            + Adicionar ao PDI
          </button>
        </div>
      ))}
      {tracks.length === 0 && <p className="text-ink-soft">Nenhuma trilha cadastrada ainda.</p>}

      {pickerTrack && (
        <AddToPlanModal
          userId={userId}
          track={pickerTrack}
          plans={plans}
          onClose={() => setPickerTrack(null)}
          onDone={async () => {
            setPickerTrack(null)
            setPlans(await getUserPlans(userId))
          }}
        />
      )}
    </div>
  )
}

function AddToPlanModal({
  userId,
  track,
  plans,
  onClose,
  onDone,
}: {
  userId: string
  track: Track
  plans: PdiPlan[]
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)

  async function addToExisting(planId: string) {
    setSaving(true)
    await addTrackToPlan(planId, track.id)
    setSaving(false)
    onDone()
  }

  async function createNew() {
    setSaving(true)
    await createPlanWithTrack(userId, `PDI — ${track.title}`, track.id)
    setSaving(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-ink">Adicionar "{track.title}" a qual plano?</h3>
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
            + Criar novo plano com esta trilha
          </button>
        </div>
        <button onClick={onClose} className="mt-4 text-sm font-medium text-ink-soft hover:text-navy">
          Cancelar
        </button>
      </div>
    </div>
  )
}
