import { useEffect, useState } from 'react'
import { colorForName, initials } from '../lib/avatar'
import { getLevels, levelBadgeIcon, levelForPoints, nextLevel } from '../lib/gamification'
import { PROGRAMS } from '../lib/quiz'
import type { GamificationLevel } from '../types/database'
import { BadgeDetailModal } from './BadgeDetailModal'
import { BadgeIcon } from './BadgeIcon'

export function NivelCard({
  name,
  avatarUrl,
  totalPoints,
  courseName,
  programId,
}: {
  name: string
  avatarUrl: string | null
  totalPoints: number
  courseName?: string | null
  programId?: string | null
}) {
  const [levels, setLevels] = useState<GamificationLevel[]>([])
  const [selectedBadge, setSelectedBadge] = useState<GamificationLevel | null>(null)

  useEffect(() => {
    getLevels().then(setLevels)
  }, [])

  const current = levelForPoints(totalPoints, levels)
  const next = nextLevel(totalPoints, levels)
  const reached = levels.filter((l) => l.min_points <= totalPoints)
  const courseBadgeUrl = programId ? (PROGRAMS.find((p) => p.id === programId)?.badge ?? null) : null
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
          <p className="flex flex-wrap items-center gap-1 truncate font-bold text-ink">
            {name}
            {courseName && (
              <span className="inline-flex items-center gap-1 font-medium text-ink-soft">
                ·{courseBadgeUrl && <img src={courseBadgeUrl} alt="" className="h-4 w-4 object-contain" />}
                {courseName}
              </span>
            )}
          </p>
          <p className="flex flex-wrap items-center gap-1 text-sm text-ink-soft">
            {current ? (
              <>
                <BadgeIcon icon={levelBadgeIcon(current, levels, programId ?? null)} size={16} /> {current.name}
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
            Faltam {next.min_points - totalPoints} pontos para{' '}
            <BadgeIcon icon={levelBadgeIcon(next, levels, programId ?? null)} size={14} /> {next.name}
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
                onClick={() => setSelectedBadge({ ...l, badge_icon: levelBadgeIcon(l, levels, programId ?? null) ?? l.badge_icon })}
                className="flex items-center gap-1.5 rounded-full bg-lavender px-3 py-1.5 text-sm font-semibold text-lavender-ink transition hover:brightness-95"
              >
                <BadgeIcon icon={levelBadgeIcon(l, levels, programId ?? null)} size={16} />
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
