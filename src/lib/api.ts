import { supabase } from './supabase'
import { computeTier } from './pdiTier'
import { awardPoints } from './gamification'
import { generateCertificateCode } from './certificate'
import { notifyCourseCompleted, notifyPdiProgress } from './notifications'
import type {
  Category,
  DashboardSection,
  DiagnosticProfile,
  IssuedCertificate,
  PdiJornadaBucket,
  PdiPlan,
  PdiPlanItem,
  Pill,
  PublicCertificate,
  ReactionQuestion,
  ReactionSurvey,
  SkillCategory,
  SkillRating,
  Track,
  UserProgress,
} from '../types/database'

const DEFAULT_SKILL_TARGET = 4

// Distribuição 70-20-10 (spec: metodologia de PDI): a cada 10 itens, 7
// prática, 2 mentoria, 1 formação, ciclando pela ordem dos itens.
const JORNADA_BUCKET_CYCLE: PdiJornadaBucket[] = [
  'pratica', 'pratica', 'pratica', 'pratica', 'pratica', 'pratica', 'pratica',
  'mentoria', 'mentoria',
  'formacao',
]

function bucketForIndex(idx: number): PdiJornadaBucket {
  return JORNADA_BUCKET_CYCLE[idx % JORNADA_BUCKET_CYCLE.length]
}

export async function getTrackWithPills(trackId: string) {
  const { data: track } = await supabase.from('tracks').select('*').eq('id', trackId).single()
  // A trilha's content is whatever is linked in track_pills — not
  // pills.track_id directly — so the same curso can be reused across
  // multiple trilhas (spec: criar trilhas com cursos existentes).
  const { data: links } = await supabase
    .from('track_pills')
    .select('order_index, pills(*)')
    .eq('track_id', trackId)
    .order('order_index')
  const pills = ((links as { pills: Pill }[] | null) ?? []).map((l) => l.pills).filter(Boolean)
  return { track: track as Track | null, pills }
}

/** For a batch of pill.track_id values, resolves which ones are real "Curso
 * com Módulos" (non-catalog, sequential, 2+ pills) — as opposed to a
 * catalog shelf pill or a curated trilha (many independent, freely browsed
 * pills, not meant to collapse into a single card). Used to group a pill
 * list into one card per course instead of one card per module. */
export async function getMultiModuleTracks(
  trackIds: (string | null | undefined)[],
): Promise<Map<string, { track: Track; pills: Pill[] }>> {
  const uniqueIds = [...new Set(trackIds.filter((id): id is string => !!id))]
  const result = new Map<string, { track: Track; pills: Pill[] }>()
  if (uniqueIds.length === 0) return result

  const { data: tracks } = await supabase
    .from('tracks')
    .select('*')
    .in('id', uniqueIds)
    .eq('is_catalog', false)
    .eq('sequential', true)
  const sequentialTracks = (tracks as Track[] | null) ?? []
  if (sequentialTracks.length === 0) return result

  const { data: links } = await supabase
    .from('track_pills')
    .select('track_id, order_index, pills(*)')
    .in(
      'track_id',
      sequentialTracks.map((t) => t.id),
    )
    .order('order_index')
  const pillsByTrack = new Map<string, Pill[]>()
  for (const row of (links as { track_id: string; pills: Pill }[] | null) ?? []) {
    if (!row.pills) continue
    const arr = pillsByTrack.get(row.track_id) ?? []
    arr.push(row.pills)
    pillsByTrack.set(row.track_id, arr)
  }
  for (const track of sequentialTracks) {
    const pills = pillsByTrack.get(track.id) ?? []
    if (pills.length > 1) result.set(track.id, { track, pills })
  }
  return result
}

export async function getUserProgressMap(userId: string): Promise<Record<string, UserProgress>> {
  const { data } = await supabase.from('user_progress').select('*').eq('user_id', userId)
  const map: Record<string, UserProgress> = {}
  for (const row of (data as UserProgress[]) ?? []) {
    map[row.pill_id] = row
  }
  return map
}

/** All pills reachable from at least one published trilha (spec: publicar/despublicar). */
export async function getAllPills(): Promise<Pill[]> {
  const { data } = await supabase
    .from('track_pills')
    .select('pills(*), tracks!inner(published)')
    .eq('tracks.published', true)
  const seen = new Set<string>()
  const pills: Pill[] = []
  for (const row of (data as { pills: Pill }[] | null) ?? []) {
    if (!row.pills || seen.has(row.pills.id)) continue
    seen.add(row.pills.id)
    pills.push(row.pills)
  }
  return pills.sort((a, b) => (a.axis ?? '').localeCompare(b.axis ?? ''))
}

/** Cursos avulsos da Biblioteca de Cursos — nunca sugeridos automaticamente,
 * só aparecem no PDI se o aluno adicionar (spec: biblioteca de cursos). */
/** Pílulas da Biblioteca de Cursos que batem com o (programa, perfil) do
 * quiz do aluno — mesma lógica de match usada pela trilha recomendada
 * (getRecommendedPills), só que aqui pode haver várias trilhas-catálogo
 * (uma por combinação de programa/perfil) em vez de uma trilha curada só. */
export async function getCatalogPills(
  programId: string | null,
  diagnosticProfile: DiagnosticProfile | null,
): Promise<Pill[]> {
  if (!programId || !diagnosticProfile) return []
  const { data } = await supabase
    .from('track_pills')
    .select('pills(*), tracks!inner(published, is_catalog, program_id, diagnostic_profile)')
    .eq('tracks.published', true)
    .eq('tracks.is_catalog', true)
    .eq('tracks.program_id', programId)
    .eq('tracks.diagnostic_profile', diagnosticProfile)
  return ((data as { pills: Pill }[] | null) ?? []).map((r) => r.pills).filter(Boolean)
}

export async function markPillInProgress(
  userId: string,
  pillId: string,
  bookmark?: { location: string; suspendData: string },
) {
  const { data: existing } = await supabase
    .from('user_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('pill_id', pillId)
    .maybeSingle()

  await supabase.from('user_progress').upsert(
    {
      user_id: userId,
      pill_id: pillId,
      status: 'in_progress',
      ...(bookmark ? { scorm_location: bookmark.location, scorm_suspend_data: bookmark.suspendData } : {}),
    },
    { onConflict: 'user_id,pill_id' },
  )
  await awardPoints(userId, 'pill_started', pillId)

  // Só conta pra "Mais acessados" na primeira vez desse aluno nessa
  // pílula — refazer/continuar não deve inflar o contador.
  if (!existing) await supabase.rpc('increment_pill_access_count', { p_pill_id: pillId })
}

/** Marca um tutorial guiado (nav ou PDI) como já visto — concluído ou
 * pulado — pra não reabrir sozinho de novo (segue acessível manualmente).
 * Só concede os 15 pontos quando `completed` é true; awardPoints já é
 * idempotente por rule_key, então reabrir o tutorial pelo menu depois e
 * concluir de novo não pontua uma segunda vez. */
export async function completeTour(userId: string, kind: 'nav' | 'pdi', completed: boolean) {
  const seenField = kind === 'nav' ? 'nav_tutorial_seen' : 'pdi_tutorial_seen'
  await supabase.from('profiles').update({ [seenField]: true }).eq('id', userId)
  if (completed) await awardPoints(userId, kind === 'nav' ? 'nav_tutorial' : 'pdi_tutorial', 'completed')
}

// ---- Catálogo: categorias, favoritos, seções da Minha Trilha ----

export async function getCategories(): Promise<Category[]> {
  const { data } = await supabase.from('categories').select('*').order('order_index')
  return (data as Category[]) ?? []
}

export async function getFavoritePillIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('pill_favorites').select('pill_id').eq('user_id', userId)
  return new Set(((data as { pill_id: string }[]) ?? []).map((r) => r.pill_id))
}

export async function toggleFavorite(userId: string, pillId: string, currentlyFavorited: boolean) {
  if (currentlyFavorited) {
    await supabase.from('pill_favorites').delete().eq('user_id', userId).eq('pill_id', pillId)
  } else {
    await supabase.from('pill_favorites').upsert({ user_id: userId, pill_id: pillId }, { onConflict: 'user_id,pill_id' })
  }
}

export async function getFavoritePills(userId: string): Promise<Pill[]> {
  const { data } = await supabase.from('pill_favorites').select('pills(*)').eq('user_id', userId)
  return ((data as { pills: Pill }[] | null) ?? []).map((r) => r.pills).filter(Boolean)
}

export async function getDashboardSections(): Promise<DashboardSection[]> {
  const { data } = await supabase.from('dashboard_sections').select('*').order('order_index')
  return (data as DashboardSection[]) ?? []
}

export async function getInProgressPills(userId: string): Promise<Pill[]> {
  const { data } = await supabase
    .from('user_progress')
    .select('pills(*)')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
  return ((data as { pills: Pill }[] | null) ?? []).map((r) => r.pills).filter(Boolean)
}

export async function getRecentlyAddedPills(limit = 10): Promise<Pill[]> {
  const { data } = await supabase.from('pills').select('*').order('created_at', { ascending: false }).limit(limit)
  return (data as Pill[]) ?? []
}

export async function getMostAccessedPills(limit = 10): Promise<Pill[]> {
  const { data } = await supabase
    .from('pills')
    .select('*')
    .gt('access_count', 0)
    .order('access_count', { ascending: false })
    .limit(limit)
  return (data as Pill[]) ?? []
}

export async function getRequiredPills(): Promise<Pill[]> {
  const { data } = await supabase.from('pills').select('*').eq('required', true)
  return (data as Pill[]) ?? []
}

/** Cursos da trilha curada que bate com o programa + perfil do quiz do
 * aluno (mesma trilha recomendada no /estande), ainda não concluídos. */
export async function getRecommendedPills(
  programId: string | null,
  diagnosticProfile: DiagnosticProfile | null,
  progress: Record<string, UserProgress>,
): Promise<Pill[]> {
  if (!programId || !diagnosticProfile) return []
  const { data: track } = await supabase
    .from('tracks')
    .select('id')
    .eq('program_id', programId)
    .eq('diagnostic_profile', diagnosticProfile)
    .eq('published', true)
    .eq('is_catalog', false)
    .maybeSingle()
  if (!track) return []
  const { pills } = await getTrackWithPills(track.id)
  return pills.filter((p) => progress[p.id]?.status !== 'completed')
}

// ---- Certificados emitidos (código único + validação pública) ----

/** Busca o certificado já emitido pro par aluno/curso, ou emite um novo
 * com um código único na primeira vez. O código nasce nessa emissão e
 * nunca muda depois — é ele que sustenta a página pública de validação. */
export async function getOrCreateCertificate(
  userId: string,
  trackId: string,
  studentName: string,
  trackTitle: string,
  completedAt: string | null,
): Promise<IssuedCertificate | null> {
  const { data: existing } = await supabase
    .from('issued_certificates')
    .select('*')
    .eq('user_id', userId)
    .eq('track_id', trackId)
    .maybeSingle()
  if (existing) return existing as IssuedCertificate

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('issued_certificates')
      .insert({
        code: generateCertificateCode(),
        user_id: userId,
        track_id: trackId,
        student_name: studentName,
        track_title: trackTitle,
        completed_at: completedAt,
      })
      .select('*')
      .single()
    if (!error) return data as IssuedCertificate
    // code colidiu (extremamente raro) — tenta de novo com outro; qualquer
    // outro erro (ex.: alguém emitiu em paralelo) recupera pela busca.
    if (error.code !== '23505') break
  }
  const { data: fallback } = await supabase
    .from('issued_certificates')
    .select('*')
    .eq('user_id', userId)
    .eq('track_id', trackId)
    .maybeSingle()
  return (fallback as IssuedCertificate) ?? null
}

export async function getIssuedCertificates(): Promise<IssuedCertificate[]> {
  const { data } = await supabase.from('issued_certificates').select('*').order('issued_at', { ascending: false })
  return (data as IssuedCertificate[]) ?? []
}

export async function verifyCertificateByCode(code: string): Promise<PublicCertificate | null> {
  const { data } = await supabase
    .from('public_certificates')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle()
  return (data as PublicCertificate) ?? null
}

export async function completePill(
  userId: string,
  pillId: string,
  score: number | null,
  pillTitle: string,
  pointsOverride?: number | null,
  bookmark?: { location: string; suspendData: string },
) {
  const { data: existing } = await supabase
    .from('user_progress')
    .select('status')
    .eq('user_id', userId)
    .eq('pill_id', pillId)
    .maybeSingle()
  const alreadyCompleted = (existing as { status: string } | null)?.status === 'completed'

  await supabase.from('user_progress').upsert(
    {
      user_id: userId,
      pill_id: pillId,
      status: 'completed',
      quiz_score: score,
      completed_at: new Date().toISOString(),
      ...(bookmark ? { scorm_location: bookmark.location, scorm_suspend_data: bookmark.suspendData } : {}),
    },
    { onConflict: 'user_id,pill_id' },
  )

  // Só notifica/propaga pro PDI na primeira conclusão — refazer o quiz
  // depois não deve gerar spam de notificação nem reprocessar o plano.
  if (alreadyCompleted) return
  await notifyCourseCompleted(userId, pillTitle)
  await awardPoints(userId, 'course_completed', pillId, {
    overridePoints: pointsOverride ?? undefined,
  })
  await syncPillCompletionToPdi(userId, pillId, pillTitle)
}

/**
 * Propaga a conclusão de um curso pros itens do PDI que apontam pra ele
 * (item_type='pill', ref_id=pillId), em qualquer plano do próprio aluno —
 * hoje esse é o único jeito de progress_current/status de um item saírem
 * do estado inicial, já que não existe outro gatilho de sincronização.
 */
async function syncPillCompletionToPdi(userId: string, pillId: string, pillTitle: string) {
  const { data: plans } = await supabase.from('pdi_plans').select('id, title').eq('user_id', userId)
  const planRows = (plans as { id: string; title: string }[]) ?? []
  if (planRows.length === 0) return

  const { data: items } = await supabase
    .from('pdi_plan_items')
    .select('*')
    .in('plan_id', planRows.map((p) => p.id))
    .eq('item_type', 'pill')
    .eq('ref_id', pillId)
  const pendingItems = ((items as PdiPlanItem[]) ?? []).filter((i) => i.status !== 'concluido')
  if (pendingItems.length === 0) return

  await Promise.all(
    pendingItems.map((item) =>
      supabase.from('pdi_plan_items').update({ status: 'concluido', progress_current: item.progress_total }).eq('id', item.id),
    ),
  )

  const affectedPlanIds = [...new Set(pendingItems.map((i) => i.plan_id))]
  for (const planId of affectedPlanIds) {
    await recomputePlanProgress(planId)
    const plan = planRows.find((p) => p.id === planId)
    await notifyPdiProgress(userId, `"${pillTitle}" concluído no plano "${plan?.title ?? ''}"`)
  }
}

async function recomputePlanProgress(planId: string) {
  const items = await getPlanItems(planId)
  if (items.length === 0) return
  const sum = items.reduce((acc, i) => acc + i.progress_current / Math.max(1, i.progress_total), 0)
  const pct = Math.round((sum / items.length) * 100)
  await supabase.from('pdi_plans').update({ progress_pct: pct }).eq('id', planId)
}

/** A pílula com pesquisa de reação habilitada conta como mais um item na
 * conclusão da trilha (spec: reação "além da pílula", soma no %) — por
 * isso o total considera pills.length + quantas têm reactionStatus. */
// Pílulas de avaliação de reação (content_type='reaction') são pílulas
// como outra qualquer aqui — por isso essa conta simples já soma o item
// de reação sem precisar de nenhum caso especial.
export function trackProgressPct(pills: Pill[], progress: Record<string, UserProgress>) {
  if (pills.length === 0) return 0
  const done = pills.filter((p) => progress[p.id]?.status === 'completed').length
  return Math.round((done / pills.length) * 100)
}

// ---- Avaliação de Reação (Kirkpatrick nível 1) ----

export async function getReactionSurveyForPill(
  pillId: string,
): Promise<{ survey: ReactionSurvey; questions: ReactionQuestion[] } | null> {
  const { data: survey } = await supabase.from('reaction_surveys').select('*').eq('pill_id', pillId).maybeSingle()
  if (!survey) return null
  const { data: questions } = await supabase
    .from('reaction_questions')
    .select('*')
    .eq('survey_id', survey.id)
    .order('order_index')
  return { survey: survey as ReactionSurvey, questions: (questions as ReactionQuestion[]) ?? [] }
}

export async function hasSubmittedReaction(surveyId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('reaction_responses')
    .select('id')
    .eq('survey_id', surveyId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

export async function submitReactionResponse(
  surveyId: string,
  userId: string,
  answers: { questionId: string; valueNumber?: number | null; valueText?: string | null }[],
) {
  const { data: response, error } = await supabase
    .from('reaction_responses')
    .insert({ survey_id: surveyId, user_id: userId })
    .select('id')
    .single()
  if (error) throw error
  if (answers.length === 0) return
  await supabase.from('reaction_answers').insert(
    answers.map((a) => ({
      response_id: response.id,
      question_id: a.questionId,
      value_number: a.valueNumber ?? null,
      value_text: a.valueText ?? null,
    })),
  )
}

/** Se a trilha "dona" da pílula (pills.track_id) exige ordem sequencial,
 * retorna o título da primeira pílula anterior ainda não concluída — ou
 * null se o módulo já pode ser acessado. */
export async function getBlockingPill(pill: Pill, userId: string): Promise<{ title: string } | null> {
  if (!pill.track_id) return null
  const { data: track } = await supabase
    .from('tracks')
    .select('sequential, is_catalog')
    .eq('id', pill.track_id)
    .maybeSingle()
  // A "Biblioteca de Cursos" (is_catalog) é uma prateleira compartilhada
  // de pílulas standalone, não um curso com módulos — nunca deve travar
  // ordem sequencial entre pílulas que só coincidem de estar lá.
  if (!track?.sequential || track.is_catalog) return null

  const { data: links } = await supabase
    .from('track_pills')
    .select('order_index, pills(id, title)')
    .eq('track_id', pill.track_id)
    .order('order_index')
  const ordered = (
    (links as unknown as { order_index: number; pills: { id: string; title: string } | null }[]) ?? []
  ).filter((l): l is { order_index: number; pills: { id: string; title: string } } => !!l.pills)
  const currentIndex = ordered.findIndex((l) => l.pills.id === pill.id)
  if (currentIndex <= 0) return null

  const priorIds = ordered.slice(0, currentIndex).map((l) => l.pills.id)
  const { data: progressRows } = await supabase
    .from('user_progress')
    .select('pill_id, status')
    .eq('user_id', userId)
    .in('pill_id', priorIds)
  const completedIds = new Set(
    ((progressRows as { pill_id: string; status: string }[]) ?? [])
      .filter((r) => r.status === 'completed')
      .map((r) => r.pill_id),
  )
  const blocking = ordered.slice(0, currentIndex).find((l) => !completedIds.has(l.pills.id))
  return blocking ? { title: blocking.pills.title } : null
}

// ---- PDI plans ----

export async function getUserPlans(userId: string): Promise<PdiPlan[]> {
  const { data } = await supabase
    .from('pdi_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data as PdiPlan[]) ?? []
}

export async function getPlanItems(planId: string): Promise<PdiPlanItem[]> {
  const { data } = await supabase
    .from('pdi_plan_items')
    .select('*')
    .eq('plan_id', planId)
    .order('order_index')
  return (data as PdiPlanItem[]) ?? []
}

export async function createPlan(
  userId: string,
  title: string,
  origin: 'taxonomia' | 'vazio',
  programId?: string | null,
): Promise<PdiPlan> {
  const { data: plan, error } = await supabase
    .from('pdi_plans')
    .insert({ user_id: userId, title, type: 'plano_pessoal', endorsed: false, progress_pct: 0 })
    .select('*')
    .single()
  if (error) throw error

  if (origin === 'taxonomia' && programId) {
    const { data: categories } = await supabase
      .from('skill_categories')
      .select('*')
      .eq('program_id', programId)
    const items = ((categories as SkillCategory[]) ?? []).map((cat, idx) => ({
      plan_id: plan.id,
      item_type: 'skill_category' as const,
      ref_id: cat.id,
      progress_current: 0,
      progress_total: DEFAULT_SKILL_TARGET,
      status: 'nao_iniciado' as const,
      order_index: idx,
      jornada_bucket: bucketForIndex(idx),
    }))
    if (items.length) await supabase.from('pdi_plan_items').insert(items)
  }

  return plan as PdiPlan
}

export async function removePlan(planId: string) {
  await supabase.from('pdi_plan_items').delete().eq('plan_id', planId)
  await supabase.from('pdi_plans').delete().eq('id', planId)
}

/**
 * Adds a whole track to a plan by expanding it into one `pill` item per
 * pill in the track (spec 9.4) — never a single generic `trilha` item —
 * so each pill's progress stays individually trackable inside the plan.
 */
export async function addTrackToPlan(planId: string, trackId: string) {
  const { pills } = await getTrackWithPills(trackId)
  const { data: existingItems } = await supabase
    .from('pdi_plan_items')
    .select('ref_id')
    .eq('plan_id', planId)
    .eq('item_type', 'pill')
  const existingIds = new Set(((existingItems as { ref_id: string }[]) ?? []).map((i) => i.ref_id))

  const { count } = await supabase
    .from('pdi_plan_items')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
  let orderIndex = count ?? 0

  const newItems = pills
    .filter((p) => !existingIds.has(p.id))
    .map((p) => ({
      plan_id: planId,
      item_type: 'pill' as const,
      ref_id: p.id,
      progress_current: 0,
      progress_total: 1,
      status: 'nao_iniciado' as const,
      order_index: orderIndex,
      jornada_bucket: bucketForIndex(orderIndex++),
    }))

  if (newItems.length) await supabase.from('pdi_plan_items').insert(newItems)
}

/** Adds a single avulso curso (from the Biblioteca de Cursos) to a plan. */
export async function addPillToPlan(planId: string, pillId: string) {
  const { data: existing } = await supabase
    .from('pdi_plan_items')
    .select('id')
    .eq('plan_id', planId)
    .eq('item_type', 'pill')
    .eq('ref_id', pillId)
    .maybeSingle()
  if (existing) return

  const { count } = await supabase
    .from('pdi_plan_items')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
  const orderIndex = count ?? 0

  await supabase.from('pdi_plan_items').insert({
    plan_id: planId,
    item_type: 'pill' as const,
    ref_id: pillId,
    progress_current: 0,
    progress_total: 1,
    status: 'nao_iniciado' as const,
    order_index: orderIndex,
    jornada_bucket: bucketForIndex(orderIndex),
  })
}

export async function createPlanWithPill(userId: string, title: string, pillId: string): Promise<PdiPlan> {
  const { data: plan, error } = await supabase
    .from('pdi_plans')
    .insert({ user_id: userId, title, type: 'plano_pessoal', endorsed: false, progress_pct: 0 })
    .select('*')
    .single()
  if (error) throw error
  await addPillToPlan(plan.id, pillId)
  return plan as PdiPlan
}

export async function createPlanWithTrack(userId: string, title: string, trackId: string): Promise<PdiPlan> {
  const { data: plan, error } = await supabase
    .from('pdi_plans')
    .insert({ user_id: userId, title, type: 'plano_pessoal', endorsed: false, progress_pct: 0 })
    .select('*')
    .single()
  if (error) throw error
  await addTrackToPlan(plan.id, trackId)
  return plan as PdiPlan
}

export async function getSkillCategories(programId: string): Promise<SkillCategory[]> {
  const { data } = await supabase.from('skill_categories').select('*').eq('program_id', programId)
  return (data as SkillCategory[]) ?? []
}

export async function getSkillRatings(userId: string): Promise<SkillRating[]> {
  const { data } = await supabase.from('skill_ratings').select('*').eq('user_id', userId)
  return (data as SkillRating[]) ?? []
}

export async function upsertSelfRating(userId: string, skillCategoryId: string, rating: number) {
  await supabase.from('skill_ratings').upsert(
    { user_id: userId, skill_category_id: skillCategoryId, self_rating: rating, rated_at: new Date().toISOString() },
    { onConflict: 'user_id,skill_category_id' },
  )
}

/** Trilhas publicadas e curadas — exclui a Biblioteca de Cursos (catálogo),
 * que só entra no PDI se o aluno adicionar um curso avulso dela. */
export async function getAllTracks(): Promise<Track[]> {
  const { data } = await supabase.from('tracks').select('*').eq('published', true).eq('is_catalog', false)
  return (data as Track[]) ?? []
}

/**
 * Recalcula a faixa de desempenho (spec: metodologia de PDI 70-20-10) a
 * partir do Balanço de Competências e grava em todos os planos do aluno.
 */
export async function recomputeAndSaveTier(userId: string): Promise<void> {
  const ratings = await getSkillRatings(userId)
  const { tier } = computeTier(ratings)
  await supabase.from('pdi_plans').update({ tier }).eq('user_id', userId)
}

// ---- Admin: composing trilhas out of existing cursos ----

export async function linkPillToTrack(trackId: string, pillId: string) {
  const { count } = await supabase
    .from('track_pills')
    .select('id', { count: 'exact', head: true })
    .eq('track_id', trackId)
  await supabase
    .from('track_pills')
    .upsert({ track_id: trackId, pill_id: pillId, order_index: count ?? 0 }, { onConflict: 'track_id,pill_id' })
}

export async function unlinkPillFromTrack(trackId: string, pillId: string) {
  await supabase.from('track_pills').delete().eq('track_id', trackId).eq('pill_id', pillId)
}
