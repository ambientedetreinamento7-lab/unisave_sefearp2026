import { useEffect, useState } from 'react'
import { colorForName, initials } from '../lib/avatar'
import { getLevels, levelForPoints, nextLevel } from '../lib/gamification'
import type { GamificationLevel } from '../types/database'

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
          <p className="text-sm text-ink-soft">
            {current ? `${current.badge_icon} ${current.name}` : 'Sem nível'} · {totalPoints} pontos
          </p>
        </div>
      </div>

      {next && (
        <div className="mt-4">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Faltam {next.min_points - totalPoints} pontos para {next.badge_icon} {next.name}
          </p>
        </div>
      )}

      {reached.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-ink-soft">Badges conquistadas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reached.map((l) => (
              <span
                key={l.id}
                title={l.name}
                className="flex items-center gap-1.5 rounded-full bg-lavender px-3 py-1.5 text-sm font-semibold text-lavender-ink"
              >
                <span>{l.badge_icon}</span>
                {l.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
