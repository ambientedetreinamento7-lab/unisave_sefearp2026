import type { PdiTier, SkillRating } from '../types/database'

// 3/5 é a nota "dentro do esperado" na escala 1-5 do Balanço de Competências
// — mesma referência usada nas faixas da metodologia de PDI 70-20-10.
const EXPECTED_RATING = 3

export const TIER_LABEL: Record<PdiTier, string> = {
  abaixo: 'Abaixo do Esperado',
  proximo: 'Próximo ao Esperado',
  dentro: 'Dentro do Esperado',
  acima: 'Acima do Esperado',
}

export const TIER_RANGE: Record<PdiTier, string> = {
  abaixo: '< 70%',
  proximo: '70–89%',
  dentro: '90–110%',
  acima: '> 110%',
}

export function tierFromPct(pct: number): PdiTier {
  if (pct < 70) return 'abaixo'
  if (pct < 90) return 'proximo'
  if (pct <= 110) return 'dentro'
  return 'acima'
}

export function computeTier(ratings: SkillRating[]): { tier: PdiTier; pct: number } {
  const values = ratings
    .map((r) => r.moderator_rating ?? r.self_rating)
    .filter((v): v is number => v != null)

  if (values.length === 0) return { tier: 'abaixo', pct: 0 }

  const avg = values.reduce((sum, v) => sum + v, 0) / values.length
  const pct = Math.round((avg / EXPECTED_RATING) * 100)
  return { tier: tierFromPct(pct), pct }
}
