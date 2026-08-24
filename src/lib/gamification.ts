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
  const { data } = await supabase.from('gamification_levels').select('*').order('min_points')
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

const BRASILIA_TZ = 'America/Sao_Paulo'

// Dia civil em Brasília (não UTC) — o resgate de pontos de acesso deve
// resetar na meia-noite de Brasília, não a cada 24h corridas desde o
// último resgate (isso fazia o horário "andar" — se o aluno resgatasse
// às 16:43 hoje, só liberava de novo às 16:43 do dia seguinte, em vez de
// à meia-noite).
function brasiliaDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BRASILIA_TZ }).format(date)
}

function todayStr() {
  return brasiliaDateStr(new Date())
}

function yesterdayStr() {
  return brasiliaDateStr(new Date(Date.now() - 86_400_000))
}

/** Quantos dias civis de Brasília separam duas datas (0 = mesmo dia). Usado
 * pra saber se já "virou o dia" em Brasília desde o último resgate, em vez
 * de contar 24h corridas a partir do horário exato do último resgate. */
export function brasiliaDaysBetween(a: Date, b: Date): number {
  const [ay, am, ad] = brasiliaDateStr(a).split('-').map(Number)
  const [by, bm, bd] = brasiliaDateStr(b).split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/**
 * Resgata os pontos de acesso do dia (chamado pelo botão "Receber
 * pontos") e atualiza a sequência de dias seguidos: se o último acesso
 * resgatado foi ontem, a sequência continua; qualquer outra coisa, ela
 * reinicia em 1. Quando a sequência bate um múltiplo de
 * gamification_rules.streak_days (regra 'streak_bonus'), concede o bônus
 * — o ref_id é o número do ciclo, então cada marco só pontua uma vez.
 */
export async function claimDailyAccess(userId: string) {
  const today = todayStr()
  const { data: profile } = await supabase
    .from('profiles')
    .select('access_streak, last_access_date')
    .eq('id', userId)
    .single()
  const current = profile as { access_streak: number; last_access_date: string | null } | null
  const newStreak = current?.last_access_date === yesterdayStr() ? (current.access_streak ?? 0) + 1 : 1

  await supabase.from('profiles').update({ access_streak: newStreak, last_access_date: today }).eq('id', userId)
  await awardPoints(userId, 'daily_access', today)

  const streakRule = await getRule('streak_bonus')
  const target = streakRule?.streak_days
  if (streakRule && target && target > 0 && newStreak % target === 0) {
    await awardPoints(userId, 'streak_bonus', `cycle-${newStreak / target}`)
  }
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
  const { data } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('ranking_opt_out', false)
    .order('total_points', { ascending: false })
    .limit(limit)
  return (data as PublicProfile[]) ?? []
}
