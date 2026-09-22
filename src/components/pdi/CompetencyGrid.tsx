import { useEffect, useState } from 'react'
import {
  getCompetencyPdiSummaries,
  getDesafioInicialSkillCategoryId,
  getSkillRatings,
  getVisibleCompetencyIds,
} from '../../lib/api'
import { getPdiCompetencyVisibilitySettings } from '../../lib/settings'
import type { CompetencyPdiSummary } from '../../lib/api'
import type { DiagnosticProfile, SkillCategory, SkillRating } from '../../types/database'
import { CompetencyCard } from './CompetencyCard'
import { CompetencyWizard } from './CompetencyWizard'

/**
 * Grid de competências do Painel 70/20/10 — mostra as competências
 * resolvidas por getVisibleCompetencyIds (conforme o toggle do admin em
 * Configurações) com % Preenchimento/Evolução por card, calculados sobre
 * os itens do plano `planId` específico (cada PlanCard tem o seu).
 */
export function CompetencyGrid({
  userId,
  programId,
  diagnosticProfile,
  categories,
  planId,
}: {
  userId: string
  programId: string | null
  diagnosticProfile: DiagnosticProfile | null
  categories: SkillCategory[]
  planId: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const [summaries, setSummaries] = useState<Map<string, CompetencyPdiSummary>>(new Map())
  const [ratings, setRatings] = useState<SkillRating[]>([])
  const [desafioInicialId, setDesafioInicialId] = useState<string | null>(null)
  const [modeLabel, setModeLabel] = useState<string>('')
  const [selected, setSelected] = useState<SkillCategory | null>(null)

  // Recarrega os dados sem mexer em `loading` — usada como onSaved do
  // wizard. Se usasse a mesma função que mostra "Carregando…", o
  // early-return abaixo desmontaria o CompetencyWizard a cada interação
  // (autoavaliar, salvar objetivo, adicionar item…), resetando o wizard
  // pro passo 1 toda vez.
  async function refresh() {
    const [visibilitySettings, desafioId, allRatings] = await Promise.all([
      getPdiCompetencyVisibilitySettings(),
      getDesafioInicialSkillCategoryId(programId, diagnosticProfile),
      getSkillRatings(userId),
    ])
    const ids = await getVisibleCompetencyIds(userId, programId, diagnosticProfile, visibilitySettings.mode)
    const sums = await getCompetencyPdiSummaries(userId, planId, ids)
    setModeLabel(
      visibilitySettings.mode === 'desafio_inicial'
        ? 'Mostrando só a competência do seu maior desafio inicial'
        : 'Mostrando as competências que você já autoavaliou',
    )
    setVisibleIds(ids)
    setSummaries(sums)
    setRatings(allRatings)
    setDesafioInicialId(desafioId)
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, programId, diagnosticProfile, planId])

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
          <CompetencyCard
            key={cat.id}
            category={cat}
            summary={summaries.get(cat.id)}
            isDesafioInicial={cat.id === desafioInicialId}
            onClick={() => setSelected(cat)}
          />
        ))}
      </div>

      {selected && planId && (
        <CompetencyWizard
          userId={userId}
          planId={planId}
          category={selected}
          rating={ratings.find((r) => r.skill_category_id === selected.id)}
          onClose={() => setSelected(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
