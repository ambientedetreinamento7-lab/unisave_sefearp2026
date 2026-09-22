import { useEffect, useState } from 'react'
import { getCompetencyPdiSummaries, getDesafioInicialSkillCategoryId, getUserPlans, getVisibleCompetencyIds } from '../../lib/api'
import { getPdiCompetencyVisibilitySettings } from '../../lib/settings'
import type { CompetencyPdiSummary } from '../../lib/api'
import type { DiagnosticProfile, SkillCategory } from '../../types/database'
import { CompetencyCard } from './CompetencyCard'

/**
 * Grid de competências do Painel 70/20/10 — mostra as competências
 * resolvidas por getVisibleCompetencyIds (conforme o toggle do admin em
 * Configurações) com % Preenchimento/Evolução por card. M1: somente
 * leitura, sem o wizard de 5 passos (chega em milestone seguinte).
 */
export function CompetencyGrid({
  userId,
  programId,
  diagnosticProfile,
  categories,
}: {
  userId: string
  programId: string | null
  diagnosticProfile: DiagnosticProfile | null
  categories: SkillCategory[]
}) {
  const [loading, setLoading] = useState(true)
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const [summaries, setSummaries] = useState<Map<string, CompetencyPdiSummary>>(new Map())
  const [desafioInicialId, setDesafioInicialId] = useState<string | null>(null)
  const [modeLabel, setModeLabel] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [visibilitySettings, plans, desafioId] = await Promise.all([
        getPdiCompetencyVisibilitySettings(),
        getUserPlans(userId),
        getDesafioInicialSkillCategoryId(programId, diagnosticProfile),
      ])
      const ids = await getVisibleCompetencyIds(userId, programId, diagnosticProfile, visibilitySettings.mode)
      const planId = plans[0]?.id ?? null
      const sums = await getCompetencyPdiSummaries(userId, planId, ids)
      if (cancelled) return
      setModeLabel(
        visibilitySettings.mode === 'desafio_inicial'
          ? 'Mostrando só a competência do seu maior desafio inicial'
          : 'Mostrando as competências que você já autoavaliou',
      )
      setVisibleIds(ids)
      setSummaries(sums)
      setDesafioInicialId(desafioId)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId, programId, diagnosticProfile])

  if (loading) return <p className="mt-6 text-sm text-ink-soft">Carregando painel 70/20/10…</p>

  const visibleCategories = categories.filter((c) => visibleIds.includes(c.id))

  return (
    <div className="mt-8 border-t border-navy-light pt-6">
      <h3 className="font-bold text-ink">Seu painel 70/20/10</h3>
      <p className="mt-1 text-sm text-ink-soft">{modeLabel}</p>

      {visibleCategories.length === 0 && (
        <p className="mt-4 text-sm text-ink-soft">
          Nenhuma competência pra mostrar ainda — autoavalie pelo menos uma acima pra ela aparecer aqui.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCategories.map((cat) => (
          <CompetencyCard key={cat.id} category={cat} summary={summaries.get(cat.id)} isDesafioInicial={cat.id === desafioInicialId} />
        ))}
      </div>
    </div>
  )
}
