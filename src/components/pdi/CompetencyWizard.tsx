import { useEffect, useMemo, useState } from 'react'
import {
  addFreeTextItemToCompetency,
  addTrackToCompetency,
  cycleItemStatus,
  getCompetencyPlanItems,
  getTracksBySkillCategory,
  upsertSelfRating,
} from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { ProgressBar } from '../ProgressBar'
import type { PdiJornadaBucket, PdiPlanItem, SkillCategory, SkillRating, Track } from '../../types/database'

const TOTAL_STEPS = 5
const STEP_LABELS = ['Competência', 'Autoavaliação', 'Objetivo', 'Preenchimento', 'Acompanhamento']

const BUCKET_INFO: Record<PdiJornadaBucket, { title: string; question: string }> = {
  pratica: { title: '70% Prática', question: 'Como você vai aplicar o aprendizado no dia a dia?' },
  mentoria: { title: '20% Troca de Conhecimento', question: 'Com quem você vai aprender ou trocar experiências?' },
  formacao: { title: '10% Aprendizagem Formal', question: 'Quais cursos, treinamentos ou leituras você vai realizar?' },
}

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-bg p-2.5">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done ? 'bg-success text-white' : 'border-2 border-gray-300'
        }`}
      >
        {done ? '✓' : ''}
      </span>
      <span className={`text-sm ${done ? 'text-ink' : 'text-ink-soft'}`}>{label}</span>
    </div>
  )
}

function StatusDot({ status, onClick }: { status: PdiPlanItem['status']; onClick?: () => void }) {
  const base = 'h-4 w-4 shrink-0 rounded-full' + (onClick ? ' cursor-pointer' : '')
  if (status === 'concluido') return <span onClick={onClick} className={`${base} bg-success`} />
  if (status === 'em_andamento') {
    return (
      <span
        onClick={onClick}
        className={`${base} border-2 border-brand-red`}
        style={{ background: 'conic-gradient(var(--color-brand-red) 50%, transparent 50%)' }}
      />
    )
  }
  return <span onClick={onClick} className={`${base} border-2 border-gray-300`} />
}

export function CompetencyWizard({
  userId,
  planId,
  category,
  rating,
  onClose,
  onSaved,
}: {
  userId: string
  planId: string
  category: SkillCategory
  rating: SkillRating | undefined
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep] = useState(0)
  const [selfRating, setSelfRating] = useState(rating?.self_rating ?? 0)
  const [objetivo, setObjetivo] = useState(rating?.objetivo ?? '')
  const [items, setItems] = useState<PdiPlanItem[]>([])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [loadingItems, setLoadingItems] = useState(true)
  const [newTaskText, setNewTaskText] = useState<Record<PdiJornadaBucket, string>>({ pratica: '', mentoria: '', formacao: '' })
  const [suggested, setSuggested] = useState<Track[] | null>(null)
  const [addingTrackId, setAddingTrackId] = useState<string | null>(null)

  async function loadItems() {
    setLoadingItems(true)
    const rows = await getCompetencyPlanItems(planId, category.id)
    setItems(rows)
    const pillIds = rows.filter((i) => i.item_type === 'pill' && i.ref_id).map((i) => i.ref_id as string)
    if (pillIds.length) {
      const { data } = await supabase.from('pills').select('id,title').in('id', pillIds)
      const map: Record<string, string> = {}
      for (const row of (data as { id: string; title: string }[]) ?? []) map[row.id] = row.title
      setLabels(map)
    }
    setLoadingItems(false)
  }

  useEffect(() => {
    loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, category.id])

  useEffect(() => {
    if (step !== 3 || suggested !== null) return
    getTracksBySkillCategory(category.id).then(setSuggested)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  async function saveRating(value: number) {
    setSelfRating(value)
    await upsertSelfRating(userId, category.id, value, objetivo || undefined)
    onSaved()
  }

  async function saveObjetivo() {
    await upsertSelfRating(userId, category.id, selfRating > 0 ? selfRating : undefined, objetivo)
    onSaved()
  }

  async function handleCycle(item: PdiPlanItem) {
    await cycleItemStatus(planId, item.id, item.status)
    await loadItems()
    onSaved()
  }

  async function handleAddTask(bucket: PdiJornadaBucket) {
    const text = newTaskText[bucket].trim()
    if (!text) return
    await addFreeTextItemToCompetency(planId, category.id, bucket, text)
    setNewTaskText((prev) => ({ ...prev, [bucket]: '' }))
    await loadItems()
    onSaved()
  }

  async function handleAddTrack(trackId: string) {
    setAddingTrackId(trackId)
    await addTrackToCompetency(planId, category.id, trackId)
    await loadItems()
    onSaved()
    setAddingTrackId(null)
  }

  const grouped = useMemo(() => {
    const g: Record<PdiJornadaBucket, PdiPlanItem[]> = { pratica: [], mentoria: [], formacao: [] }
    for (const item of items) if (item.jornada_bucket) g[item.jornada_bucket].push(item)
    return g
  }, [items])

  const addedTrackIds = useMemo(() => {
    const set = new Set<string>()
    for (const i of items) if (i.item_type === 'trilha' && i.ref_id) set.add(i.ref_id)
    return set
  }, [items])

  const totalItems = items.length
  const concludedItems = items.filter((i) => i.status === 'concluido').length
  const checks = [
    selfRating > 0,
    objetivo.trim().length > 0,
    grouped.pratica.length > 0,
    grouped.mentoria.length > 0,
    grouped.formacao.length > 0,
  ]
  const preenchimentoPct = Math.round((checks.filter(Boolean).length / checks.length) * 100)
  const evolucaoPct = totalItems === 0 ? 0 : Math.round((concludedItems / totalItems) * 100)

  function itemLabel(item: PdiPlanItem) {
    if (item.item_type === 'tarefa_livre') return item.descricao ?? 'Tarefa'
    if (item.item_type === 'trilha' || item.item_type === 'pill') return labels[item.ref_id ?? ''] ?? item.ref_id ?? ''
    return item.descricao ?? ''
  }

  function goNext() {
    if (step === TOTAL_STEPS - 1) {
      onClose()
      return
    }
    if (step === 2) saveObjetivo()
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))
  }

  function goBack() {
    if (step === 0) {
      onClose()
      return
    }
    setStep((s) => Math.max(0, s - 1))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card flex max-h-[90vh] w-full max-w-lg flex-col p-6">
        <div className="shrink-0">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
            <span>
              Passo {step + 1} de {TOTAL_STEPS} — {STEP_LABELS[step]}
            </span>
            <button onClick={onClose} className="text-ink-soft hover:text-navy">
              ✕
            </button>
          </div>
          <div className="progress-track mt-2">
            <div className="progress-fill" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
          </div>
        </div>

        <div className="mt-5 flex-1 overflow-y-auto">
          {step === 0 && (
            <div>
              <h3 className="text-lg font-bold text-ink">{category.name}</h3>
              <p className="text-xs uppercase tracking-wide text-ink-soft">{category.type}</p>
              <p className="mt-4 text-sm text-ink-soft">
                Nas próximas etapas você vai: se autoavaliar de 1 a 5, definir um objetivo, e preencher os 3 blocos
                da metodologia 70/20/10 (Prática, Troca de Conhecimento e Aprendizagem Formal) pra essa competência.
              </p>
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="text-lg font-bold text-ink">Autoavaliação</h3>
              <p className="mt-1 text-sm text-ink-soft">
                De 1 (iniciante) a 5 (domínio avançado), como você avalia "{category.name}" hoje?
              </p>
              <div className="mt-4 flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => saveRating(v)}
                    className={`h-10 w-10 rounded-full text-sm font-bold transition ${
                      selfRating >= v ? 'bg-brand-red text-white' : 'bg-navy-light text-navy'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-lg font-bold text-ink">Objetivo</h3>
              <p className="mt-1 text-sm text-ink-soft">O que você pretende alcançar nessa competência?</p>
              <textarea
                className="mt-4 w-full rounded-xl border border-navy-light px-4 py-3 text-sm outline-none focus:border-navy"
                rows={5}
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                onBlur={saveObjetivo}
                placeholder="Ex.: quero conseguir liderar reuniões com mais confiança até o fim do semestre."
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-ink">Preenchimento 70/20/10</h3>
              {loadingItems && <p className="text-sm text-ink-soft">Carregando…</p>}

              {!loadingItems &&
                (['pratica', 'mentoria'] as PdiJornadaBucket[]).map((bucket) => (
                  <div key={bucket}>
                    <p className="font-semibold text-navy">{BUCKET_INFO[bucket].title}</p>
                    <p className="text-xs text-ink-soft">{BUCKET_INFO[bucket].question}</p>
                    <div className="mt-2 space-y-1.5">
                      {grouped[bucket].map((item) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-lg bg-bg p-2">
                          <StatusDot status={item.status} onClick={() => handleCycle(item)} />
                          <span className="flex-1 text-sm text-ink">{itemLabel(item)}</span>
                        </div>
                      ))}
                      {grouped[bucket].length === 0 && <p className="text-xs text-ink-soft">Nenhum item ainda.</p>}
                    </div>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        className="flex-1 rounded-lg border border-navy-light px-3 py-2 text-sm outline-none focus:border-navy"
                        placeholder="Adicionar item…"
                        value={newTaskText[bucket]}
                        onChange={(e) => setNewTaskText((prev) => ({ ...prev, [bucket]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTask(bucket)}
                      />
                      <button
                        onClick={() => handleAddTask(bucket)}
                        className="rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-dark"
                      >
                        + Adicionar
                      </button>
                    </div>
                  </div>
                ))}

              {!loadingItems && (
                <div>
                  <p className="font-semibold text-navy">{BUCKET_INFO.formacao.title}</p>
                  <p className="text-xs text-ink-soft">{BUCKET_INFO.formacao.question}</p>

                  <div className="mt-2 space-y-1.5">
                    {grouped.formacao
                      .filter((i) => i.item_type === 'tarefa_livre')
                      .map((item) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-lg bg-bg p-2">
                          <StatusDot status={item.status} onClick={() => handleCycle(item)} />
                          <span className="flex-1 text-sm text-ink">{itemLabel(item)}</span>
                        </div>
                      ))}
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="flex-1 rounded-lg border border-navy-light px-3 py-2 text-sm outline-none focus:border-navy"
                      placeholder="Outra tarefa (treinamento externo, leitura…)"
                      value={newTaskText.formacao}
                      onChange={(e) => setNewTaskText((prev) => ({ ...prev, formacao: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask('formacao')}
                    />
                    <button
                      onClick={() => handleAddTask('formacao')}
                      className="rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-dark"
                    >
                      + Adicionar
                    </button>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">Cursos sugeridos</p>
                  {suggested === null && <p className="mt-1 text-xs text-ink-soft">Buscando cursos…</p>}
                  {suggested !== null && suggested.length === 0 && (
                    <p className="mt-1 text-xs text-ink-soft">Nenhum curso vinculado a esta competência ainda.</p>
                  )}
                  <div className="mt-1 space-y-2">
                    {(suggested ?? []).map((track) => {
                      const alreadyAdded = addedTrackIds.has(track.id)
                      return (
                        <div key={track.id} className="flex items-center gap-3 rounded-lg bg-bg p-2">
                          {track.thumbnail_url && (
                            <img src={track.thumbnail_url} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{track.title}</span>
                          {alreadyAdded ? (
                            <span className="shrink-0 rounded-full bg-navy-light px-3 py-1.5 text-xs font-bold text-navy">
                              Já adicionado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddTrack(track.id)}
                              disabled={addingTrackId === track.id}
                              className="shrink-0 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
                            >
                              {addingTrackId === track.id ? 'Adicionando…' : '+ Adicionar ao PDI'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 className="text-lg font-bold text-ink">Acompanhamento</h3>
              <p className="mt-1 text-sm text-ink-soft">Quanto você já preencheu do seu PDI nesta competência.</p>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
                    <span>Preenchimento</span>
                    <span>{preenchimentoPct}%</span>
                  </div>
                  <ProgressBar value={preenchimentoPct} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
                    <span>Evolução</span>
                    <span>{evolucaoPct}%</span>
                  </div>
                  <ProgressBar value={evolucaoPct} />
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <ChecklistRow done={selfRating > 0} label="Autoavaliação preenchida" />
                <ChecklistRow done={objetivo.trim().length > 0} label="Objetivo definido" />
                <ChecklistRow done={grouped.pratica.length > 0} label={`${BUCKET_INFO.pratica.title} — pelo menos 1 item`} />
                <ChecklistRow done={grouped.mentoria.length > 0} label={`${BUCKET_INFO.mentoria.title} — pelo menos 1 item`} />
                <ChecklistRow done={grouped.formacao.length > 0} label={`${BUCKET_INFO.formacao.title} — pelo menos 1 item`} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex shrink-0 gap-2">
          <button onClick={goBack} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">
            {step === 0 ? 'Sair' : '← Etapa anterior'}
          </button>
          <button
            onClick={goNext}
            className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white hover:bg-brand-red-dark"
          >
            {step === TOTAL_STEPS - 1 ? 'Concluir' : 'Próxima etapa →'}
          </button>
        </div>
      </div>
    </div>
  )
}
