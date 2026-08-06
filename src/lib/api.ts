import { supabase } from './supabase'
import type {
  PdiPlan,
  PdiPlanItem,
  Pill,
  SkillCategory,
  SkillRating,
  Track,
  UserProgress,
} from '../types/database'

const DEFAULT_SKILL_TARGET = 4

export async function getTrackWithPills(trackId: string) {
  const { data: track } = await supabase.from('tracks').select('*').eq('id', trackId).single()
  const { data: pills } = await supabase
    .from('pills')
    .select('*')
    .eq('track_id', trackId)
    .order('id')
  return { track: track as Track | null, pills: (pills as Pill[]) ?? [] }
}

export async function getUserProgressMap(userId: string): Promise<Record<string, UserProgress>> {
  const { data } = await supabase.from('user_progress').select('*').eq('user_id', userId)
  const map: Record<string, UserProgress> = {}
  for (const row of (data as UserProgress[]) ?? []) {
    map[row.pill_id] = row
  }
  return map
}

export async function getAllPills(): Promise<Pill[]> {
  const { data } = await supabase.from('pills').select('*').order('axis')
  return (data as Pill[]) ?? []
}

export async function markPillInProgress(userId: string, pillId: string) {
  await supabase
    .from('user_progress')
    .upsert({ user_id: userId, pill_id: pillId, status: 'in_progress' }, { onConflict: 'user_id,pill_id' })
}

export async function completePill(userId: string, pillId: string, score: number | null) {
  await supabase.from('user_progress').upsert(
    {
      user_id: userId,
      pill_id: pillId,
      status: 'completed',
      quiz_score: score,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,pill_id' },
  )
}

export function trackProgressPct(pills: Pill[], progress: Record<string, UserProgress>) {
  if (pills.length === 0) return 0
  const done = pills.filter((p) => progress[p.id]?.status === 'completed').length
  return Math.round((done / pills.length) * 100)
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
      order_index: orderIndex++,
    }))

  if (newItems.length) await supabase.from('pdi_plan_items').insert(newItems)
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

export async function getAllTracks(): Promise<Track[]> {
  const { data } = await supabase.from('tracks').select('*')
  return (data as Track[]) ?? []
}
