import { useEffect, useState } from 'react'
import { colorForName, initials } from '../lib/avatar'
import { getLevels, levelForPoints, nextLevel } from '../lib/gamification'
import type { GamificationLevel } from '../types/database'
import { BadgeDetailModal } from './BadgeDetailModal'
import { BadgeIcon } from './BadgeIcon'

export function NivelCard({
  name,
  avatarUrl,
  totalPoints,
}: {
  name: string
  avatarUrl: string | null
  totalPoints: number
}) {
  const [levels, setLevels] = useState<GamificationLevel[]>([])
  const [selectedBadge, setSelectedBadge] = useState<GamificationLevel | null>(null)

  useEffect(() => {
    getLevels().then(setLevels)
  }, [])

  const current = levelForPoints(totalPoints, levels)
  const next = nextLevel(totalPoints, levels)
  const reached = levels.filter((l) => l.min_points <= totalPoints)
  const pct = next
    ? Math.round(((totalPoints - (current?.min_points ?? 0)) / (next.min_points - (current?.min_points ?? 0))) * 100)
    : 100

  return (
    <div className="card mt-6 p-5">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-lg font-bold text-white"
              style={{ background: colorForName(name) }}
            >
              {initials(name)}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{name}</p>
          <p className="flex flex-wrap items-center gap-1 text-sm text-ink-soft">
            {current ? (
              <>
                <BadgeIcon icon={current.badge_icon} size={16} /> {current.name}
              </>
            ) : (
              'Sem nível'
            )}{' '}
            · {totalPoints} pontos
          </p>
        </div>
      </div>

      {next && (
        <div className="mt-4">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink-soft">
            Faltam {next.min_points - totalPoints} pontos para <BadgeIcon icon={next.badge_icon} size={14} />{' '}
            {next.name}
          </p>
        </div>
      )}

      {reached.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-ink-soft">Badges conquistadas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reached.map((l) => (
              <button
                key={l.id}
                type="button"
                title={l.name}
                onClick={() => setSelectedBadge(l)}
                className="flex items-center gap-1.5 rounded-full bg-lavender px-3 py-1.5 text-sm font-semibold text-lavender-ink transition hover:brightness-95"
              >
                <BadgeIcon icon={l.badge_icon} size={16} />
                {l.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedBadge && <BadgeDetailModal level={selectedBadge} onClose={() => setSelectedBadge(null)} />}
    </div>
  )
}
