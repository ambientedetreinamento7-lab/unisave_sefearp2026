import { ProgressBar } from '../ProgressBar'
import type { CompetencyPdiSummary } from '../../lib/api'
import type { SkillCategory } from '../../types/database'

const STATUS_LABEL: Record<CompetencyPdiSummary['status'], string> = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  completo: 'Completo',
}

const STATUS_CLASS: Record<CompetencyPdiSummary['status'], string> = {
  nao_iniciado: 'bg-gray-100 text-ink-soft',
  em_andamento: 'bg-sky-50 text-sky-700',
  completo: 'bg-green-50 text-success',
}

export function CompetencyCard({
  category,
  summary,
  isDesafioInicial,
  onClick,
}: {
  category: SkillCategory
  summary: CompetencyPdiSummary | undefined
  isDesafioInicial: boolean
  onClick: () => void
}) {
  const status = summary?.status ?? 'nao_iniciado'
  const preenchimentoPct = summary?.preenchimentoPct ?? 0
  const evolucaoPct = summary?.evolucaoPct ?? 0

  return (
    <div className="card cursor-pointer p-5 transition hover:border-navy" onClick={onClick} role="button">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 font-bold text-ink">
            {isDesafioInicial && <span title="Desafio inicial do PDI Express">★</span>}
            {category.name}
          </p>
          <p className="text-xs uppercase tracking-wide text-ink-soft">{category.type}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

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
    </div>
  )
}
