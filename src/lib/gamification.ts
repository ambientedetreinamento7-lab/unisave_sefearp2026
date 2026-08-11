import { notifyPoints } from './notifications'
import { supabase } from './supabase'
import type { GamificationLevel, GamificationRule, PublicProfile, UserPointsEvent } from '../types/database'

export async function getRules(): Promise<GamificationRule[]> {
  const { data } = await supabase.from('gamification_rules').select('*')
  return (data as GamificationRule[]) ?? []
}

export async function getRule(key: string): Promise<GamificationRule | null> {
  const { data } = await supabase.from('gamification_rules').select('*').eq('key', key).maybeSingle()
  return (data as GamificationRule | null) ?? null
}

export async function getLevels(): Promise<GamificationLevel[]> {
  const { data } = await supabase.from('gamification_levels').select('*').order('order_index')
  return (data as GamificationLevel[]) ?? []
}

export function levelForPoints(points: number, levels: GamificationLevel[]): GamificationLevel | null {
  const reached = levels.filter((l) => l.min_points <= points)
  return reached.length ? reached[reached.length - 1] : null
}

export function nextLevel(points: number, levels: GamificationLevel[]): GamificationLevel | null {
  return levels.find((l) => l.min_points > points) ?? null
}

/**
 * Concede pontos por uma ação — idempotente via a unique constraint
 * (user_id, rule_key, ref_id) em user_points_events: se já foi concedida
 * antes, o upsert não insere nada e essa função não faz mais nada (sem
 * pontuar de novo, sem notificar de novo).
 */
export async function awardPoints(
  userId: string,
  ruleKey: string,
  refId: string,
  opts?: { overridePoints?: number },
) {
  const rule = await getRule(ruleKey)
  if (!rule || !rule.enabled) return
  const points = opts?.overridePoints ?? rule.points
  if (points <= 0) return

  const { data, error } = await supabase
    .from('user_points_events')
    .upsert({ user_id: userId, rule_key: ruleKey, ref_id: refId, points }, { onConflict: 'user_id,rule_key,ref_id', ignoreDuplicates: true })
    .select('id')
  if (error || !data || data.length === 0) return // já tinha sido concedido antes

  const { data: profile } = await supabase.from('profiles').select('total_points').eq('id', userId).single()
  const currentTotal = (profile as { total_points: number } | null)?.total_points ?? 0
  await supabase.from('profiles').update({ total_points: currentTotal + points }).eq('id', userId)
  await notifyPoints(userId, points, rule.label)
}

export async function getLastPointsEvent(userId: string, ruleKey: string): Promise<UserPointsEvent | null> {
  const { data } = await supabase
    .from('user_points_events')
    .select('*')
    .eq('user_id', userId)
    .eq('rule_key', ruleKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as UserPointsEvent | null) ?? null
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data } = await supabase.from('public_profiles').select('*').eq('id', userId).maybeSingle()
  return (data as PublicProfile | null) ?? null
}

export async function getRanking(limit = 10): Promise<PublicProfile[]> {
  const { data } = await supabase.from('public_profiles').select('*').order('total_points', { ascending: false }).limit(limit)
  return (data as PublicProfile[]) ?? []
}
