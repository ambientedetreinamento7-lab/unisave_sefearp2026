import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { colorForName, initials } from '../lib/avatar'
import { getRanking } from '../lib/gamification'
import type { PublicProfile } from '../types/database'

export function RankingWidget({ currentUserId }: { currentUserId: string }) {
  const [ranking, setRanking] = useState<PublicProfile[] | null>(null)

  useEffect(() => {
    getRanking(10).then(setRanking)
  }, [])

  if (!ranking || ranking.length === 0) return null

  const myPosition = ranking.findIndex((p) => p.id === currentUserId)
  const iAmInTop = myPosition !== -1

  return (
    <div className="card mt-6 p-5">
      <h2 className="font-bold text-ink">🏆 Ranking geral</h2>
      <div className="mt-3 space-y-1.5">
        {ranking.map((p, i) => (
          <RankingRow key={p.id} position={i + 1} profile={p} highlighted={p.id === currentUserId} />
        ))}
      </div>
      {!iAmInTop && (
        <p className="mt-3 text-xs text-ink-soft">
          Continue participando pra entrar no top 10 do ranking geral!
        </p>
      )}
    </div>
  )
}

function RankingRow({ position, profile, highlighted }: { position: number; profile: PublicProfile; highlighted: boolean }) {
  return (
    <Link
      to={highlighted ? '/meu-perfil' : `/perfil/${profile.id}`}
      className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${highlighted ? 'bg-lavender' : 'hover:bg-bg'}`}
    >
      <span className="w-5 shrink-0 text-center text-sm font-bold text-ink-soft">{position}</span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-xs font-bold text-white"
            style={{ background: colorForName(profile.name) }}
          >
            {initials(profile.name)}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{profile.name}</span>
      <span className="shrink-0 text-sm font-bold text-navy">{profile.total_points} pts</span>
    </Link>
  )
}
