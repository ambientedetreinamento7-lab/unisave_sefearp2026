import type { GamificationLevel } from '../types/database'
import { BadgeIcon } from './BadgeIcon'

export function BadgeDetailModal({ level, onClose }: { level: GamificationLevel; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-lavender">
          <BadgeIcon icon={level.badge_icon} size={56} />
        </div>
        <h3 className="mt-4 text-lg font-bold text-ink">{level.name}</h3>
        <p className="mt-1 text-xs font-semibold text-ink-soft">A partir de {level.min_points} pontos</p>
        {level.description && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{level.description}</p>}
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-navy py-2.5 font-bold text-white hover:bg-navy-dark"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
