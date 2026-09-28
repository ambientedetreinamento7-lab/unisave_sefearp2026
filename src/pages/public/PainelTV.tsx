import { useEffect, useState } from 'react'
import { colorForName, initials } from '../../lib/avatar'
import { getRanking } from '../../lib/gamification'
import type { PublicProfile } from '../../types/database'

/**
 * Painel de ranking ao vivo pra exibir numa TV no estande — rota
 * deliberadamente fora do menu/nav (só quem tem o link acessa) e sem
 * exigir login, pra poder abrir direto num navegador de TV sem precisar
 * autenticar. Atualiza sozinho em intervalos, sem nenhuma interação
 * necessária.
 */
const REFRESH_MS = 20_000

const PRIZES: Record<1 | 2 | 3, { label: string; icon: string }> = {
  1: { label: 'Fone de ouvido', icon: '🎧' },
  2: { label: 'Powerbank', icon: '🔋' },
  3: { label: 'Kit UniSave', icon: '🎁' },
}

export function PainelTV() {
  const [ranking, setRanking] = useState<PublicProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const r = await getRanking(30)
      if (cancelled) return
      setRanking(r)
      setLastUpdated(new Date())
      setLoading(false)
    }
    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-deep">
        <p className="text-2xl font-semibold text-white/70">Carregando ranking…</p>
      </div>
    )
  }

  const [first, second, third, fourth, fifth] = ranking

  return (
    <div className="min-h-screen bg-navy-deep px-12 py-10 text-white">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold">Ranking ao vivo</h1>
          <p className="mt-1 text-lg text-white/60">Top 5 do momento — continue pontuando pra chegar lá!</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-lg font-bold text-brand-red">
          <span className="mp-dot h-3 w-3 rounded-full bg-brand-red" />
          AO VIVO
        </div>
      </header>

      <div className="mt-10 grid grid-cols-[1.5fr_1fr] gap-10">
        <section>
          <div className="flex items-end justify-center gap-6">
            <PodiumSpot position={2} profile={second} heightClass="h-28" />
            <PodiumSpot position={1} profile={first} heightClass="h-40" />
            <PodiumSpot position={3} profile={third} heightClass="h-20" />
          </div>

          {(fourth || fifth) && (
            <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-5">
              {fourth && <NextRow position={4} profile={fourth} />}
              {fifth && <NextRow position={5} profile={fifth} />}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white/5 p-6">
          <h2 className="text-2xl font-bold">Ranking geral</h2>
          <p className="mt-1 text-sm text-white/60">Veja sua posição — o top 5 está mais perto do que parece.</p>
          <div className="mt-5 h-[640px] overflow-hidden">
            <GeneralRankingList entries={ranking} />
          </div>
        </section>
      </div>

      {lastUpdated && (
        <p className="mt-8 text-right text-sm text-white/30">
          Atualizado às {lastUpdated.toLocaleTimeString('pt-BR')}
        </p>
      )}
    </div>
  )
}

function Avatar({ profile, size }: { profile: PublicProfile; size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: profile.avatar_url ? undefined : colorForName(profile.name) }}
    >
      {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(profile.name)}
    </span>
  )
}

function PodiumSpot({
  position,
  profile,
  heightClass,
}: {
  position: 1 | 2 | 3
  profile?: PublicProfile
  heightClass: string
}) {
  const prize = PRIZES[position]
  const blockColor =
    position === 1
      ? 'bg-gradient-to-b from-yellow-300 to-yellow-500'
      : position === 2
        ? 'bg-gradient-to-b from-slate-300 to-slate-400'
        : 'bg-gradient-to-b from-amber-600 to-amber-800'

  return (
    <div className="flex w-56 flex-col items-center">
      <div className="relative">
        {position === 1 && <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl">👑</span>}
        <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white/80 bg-white/10">
          {profile ? <Avatar profile={profile} size={96} /> : <span className="text-3xl text-white/30">?</span>}
        </span>
      </div>
      <p className="mt-3 max-w-full truncate text-xl font-extrabold">{profile?.name ?? 'Aguardando…'}</p>
      <p className="text-base font-semibold text-white/70">{profile ? `${profile.total_points} pts` : ''}</p>
      <span className="mt-2 flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold">
        <span className="text-lg">{prize.icon}</span>
        {prize.label}
      </span>
      <div
        className={`mt-4 flex w-full items-start justify-center rounded-t-2xl pt-2 text-5xl font-black text-white/90 ${blockColor} ${heightClass}`}
      >
        {position}
      </div>
    </div>
  )
}

function NextRow({ position, profile }: { position: number; profile: PublicProfile }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
      <span className="w-8 shrink-0 text-center text-2xl font-black text-white/40">#{position}</span>
      <Avatar profile={profile} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold">{profile.name}</p>
        <p className="text-sm text-white/60">{profile.total_points} pts</p>
      </div>
    </div>
  )
}

// Lista da direita: parada se couber tudo na tela sem rolagem (poucos
// participantes); acima disso, gira sozinha com CSS puro (duplica a lista
// e anima translateY até -50%, que é exatamente a altura de uma cópia —
// fecha o loop sem soluço nem precisar medir altura em JS).
function GeneralRankingList({ entries }: { entries: PublicProfile[] }) {
  if (entries.length === 0) {
    return <p className="text-white/50">Ninguém pontuou ainda.</p>
  }

  const shouldScroll = entries.length > 10
  const rows = (list: PublicProfile[], keySuffix: string) =>
    list.map((p, i) => (
      <div key={`${p.id}-${keySuffix}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 odd:bg-white/5">
        <span className="w-8 shrink-0 text-center text-base font-bold text-white/40">{i + 1}</span>
        <Avatar profile={p} size={38} />
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{p.name}</span>
        <span className="shrink-0 text-base font-bold text-white/80">{p.total_points} pts</span>
      </div>
    ))

  if (!shouldScroll) {
    return <div className="flex flex-col gap-2">{rows(entries, 'a')}</div>
  }

  const duration = Math.max(entries.length * 2.2, 20)
  return (
    <div className="h-full overflow-hidden">
      <div className="flex flex-col gap-2" style={{ animation: `tv-scroll-up ${duration}s linear infinite` }}>
        {rows(entries, 'a')}
        {rows(entries, 'b')}
      </div>
    </div>
  )
}
