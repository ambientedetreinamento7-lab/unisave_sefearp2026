import { useEffect, useState } from 'react'
import { getCompetencyPdiSummaries, getSkillRatings } from '../../lib/api'
import type { CompetencyPdiSummary } from '../../lib/api'
import type { SkillCategory, SkillRating } from '../../types/database'
import { CompetencyCard } from './CompetencyCard'
import { CompetencyWizard } from './CompetencyWizard'

/**
 * Grid de competências do Painel 70/20/10 — mostra exatamente as
 * competências escolhidas pelo aluno pra este plano (`competencyIds`,
 * até 3, escolhidas no PDI Express ou ao criar o plano), com %
 * Preenchimento/Evolução por card calculados sobre os itens do plano.
 */
export function CompetencyGrid({
  userId,
  planId,
  competencyIds,
  categories,
}: {
  userId: string
  planId: string
  competencyIds: string[]
  categories: SkillCategory[]
}) {
  const [loading, setLoading] = useState(true)
  const [summaries, setSummaries] = useState<Map<string, CompetencyPdiSummary>>(new Map())
  const [ratings, setRatings] = useState<SkillRating[]>([])
  const [selected, setSelected] = useState<SkillCategory | null>(null)

  // Recarrega os dados sem mexer em `loading` — usada como onSaved do
  // wizard. Se usasse a mesma função que mostra "Carregando…", o
  // early-return abaixo desmontaria o CompetencyWizard a cada interação
  // (autoavaliar, salvar objetivo, adicionar item…), resetando o wizard
  // pro passo 1 toda vez.
  async function refresh() {
    const [sums, allRatings] = await Promise.all([
      getCompetencyPdiSummaries(userId, planId, competencyIds),
      getSkillRatings(userId),
    ])
    setSummaries(sums)
    setRatings(allRatings)
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, planId, competencyIds.join(',')])

  if (loading) return <p className="mt-6 text-sm text-ink-soft">Carregando painel 70/20/10…</p>

  const visibleCategories = categories.filter((c) => competencyIds.includes(c.id))

  return (
    <div className="mt-8 border-t border-navy-light pt-6">
      <h3 className="font-bold text-ink">Seu painel 70/20/10</h3>
      <p className="mt-1 text-sm text-ink-soft">As competências escolhidas pra este plano.</p>

      {visibleCategories.length === 0 && (
        <p className="mt-4 text-sm text-ink-soft">Este plano ainda não tem competências escolhidas.</p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCategories.map((cat) => (
          <CompetencyCard key={cat.id} category={cat} summary={summaries.get(cat.id)} onClick={() => setSelected(cat)} />
        ))}
      </div>

      {selected && (
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
