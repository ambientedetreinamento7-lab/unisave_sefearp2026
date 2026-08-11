import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { useAuth } from '../../context/AuthContext'
import { colorForName, initials } from '../../lib/avatar'
import { getLevels, getRanking, getRules, levelForPoints } from '../../lib/gamification'
import type { GamificationLevel, GamificationRule, PublicProfile } from '../../types/database'

export function Ranking() {
  const { profile } = useAuth()
  const [ranking, setRanking] = useState<PublicProfile[]>([])
  const [levels, setLevels] = useState<GamificationLevel[]>([])
  const [rules, setRules] = useState<GamificationRule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getRanking(50), getLevels(), getRules()]).then(([r, l, ru]) => {
      setRanking(r)
      setLevels(l)
      setRules(ru.filter((x) => x.enabled))
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <p className="p-8 text-center text-ink-soft">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">Ranking e badges</h1>
        <p className="mt-1 text-ink-soft">Veja sua posição geral, as badges disponíveis e como ganhar pontos.</p>

        <section className="card mt-6 p-5">
          <h2 className="font-bold text-ink">🏆 Ranking geral</h2>
          <div className="mt-3 space-y-1.5">
            {ranking.map((p, i) => (
              <RankingRow
                key={p.id}
                position={i + 1}
                profile={p}
                highlighted={p.id === profile?.id}
                badge={levelForPoints(p.total_points, levels)?.badge_icon}
              />
            ))}
            {ranking.length === 0 && <p className="text-ink-soft">Ninguém pontuou ainda.</p>}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-bold text-ink">Badges</h2>
          <p className="mt-1 text-sm text-ink-soft">Cada nível é uma badge — quanto mais pontos, mais alto você chega.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {levels.map((level) => {
              const unlocked = (profile?.total_points ?? 0) >= level.min_points
              return (
                <div
                  key={level.id}
                  className={`card flex items-center gap-3 p-4 ${unlocked ? '' : 'opacity-50 grayscale'}`}
                >
                  <span className="text-3xl">{level.badge_icon}</span>
                  <div>
                    <p className="font-semibold text-ink">{level.name}</p>
                    <p className="text-xs text-ink-soft">A partir de {level.min_points} pontos</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-bold text-ink">Como funciona a gamificação</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Você ganha pontos ao longo da plataforma. Ao acumular pontos, sobe de nível e desbloqueia badges — o
            ranking acima mostra sua posição em relação aos demais alunos.
          </p>
          <div className="mt-3 space-y-2">
            {rules.map((rule) => (
              <div key={rule.key} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-ink">{rule.label}</p>
                  {rule.key === 'daily_access' && (
                    <p className="text-xs text-ink-soft">Resgatável a cada {rule.recurrence_days ?? 1} dia(s)</p>
                  )}
                  {rule.key === 'streak_bonus' && (
                    <p className="text-xs text-ink-soft">A cada {rule.streak_days ?? '—'} dias seguidos de acesso</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-lavender px-3 py-1 text-sm font-bold text-lavender-ink">
                  +{rule.points} pts
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function RankingRow({
  position,
  profile,
  highlighted,
  badge,
}: {
  position: number
  profile: PublicProfile
  highlighted: boolean
  badge?: string
}) {
  return (
    <Link
      to={highlighted ? '/meu-perfil' : `/perfil/${profile.id}`}
      className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${highlighted ? 'bg-lavender' : 'hover:bg-bg'}`}
    >
      <span className="w-6 shrink-0 text-center text-sm font-bold text-ink-soft">{position}</span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
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
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
        {badge && <span className="mr-1">{badge}</span>}
        {profile.name}
      </span>
      <span className="shrink-0 text-sm font-bold text-navy">{profile.total_points} pts</span>
    </Link>
  )
}
