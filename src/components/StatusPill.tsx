import type { PillStatus } from '../types/database'

const CONFIG: Record<PillStatus, { label: string; className: string }> = {
  completed: { label: 'Concluído', className: 'bg-green-50 text-success border border-green-200' },
  in_progress: { label: 'Continuar', className: 'bg-red-50 text-brand-red border border-red-200' },
  not_started: { label: 'Iniciar', className: 'bg-navy-light text-navy border border-navy/10' },
}

export function StatusPill({ status }: { status: PillStatus }) {
  const cfg = CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.className}`}>
      {status === 'completed' && (
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
          <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {cfg.label}
    </span>
  )
}
