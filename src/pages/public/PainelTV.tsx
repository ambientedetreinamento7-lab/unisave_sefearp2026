import { useEffect, useState } from 'react'
import { usePlatformSettings } from '../../context/PlatformSettingsContext'
import { colorForName, initials } from '../../lib/avatar'
import { getRanking } from '../../lib/gamification'
import { getTvPanelSettings } from '../../lib/settings'
import type { PublicProfile, TvPanelSettings } from '../../types/database'

/**
 * Painel de ranking ao vivo pra exibir numa TV no estande — rota
 * deliberadamente fora do menu/nav (só quem tem o link acessa) e sem
 * exigir login, pra poder abrir direto num navegador de TV sem precisar
 * autenticar. Atualiza sozinho em intervalos, sem nenhuma interação
 * necessária. Fundo e cores são configuráveis em Admin > Configurações.
 */
const REFRESH_MS = 20_000

const PRIZES: Record<1 | 2 | 3, { label: string; icon: string }> = {
  1: { label: 'Fone de ouvido', icon: '🎧' },
  2: { label: 'Powerbank', icon: '🔋' },
  3: { label: 'Kit UniSave', icon: '🎁' },
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function PainelTV() {
  const { branding } = usePlatformSettings()
  const [ranking, setRanking] = useState<PublicProfile[]>([])
  const [settings, setSettings] = useState<TvPanelSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    getTvPanelSettings().then(setSettings)
  }, [])

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

  if (loading || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-deep">
        <p className="text-2xl font-semibold text-white/70">Carregando ranking…</p>
      </div>
    )
  }

  const [first, second, third, fourth, fifth] = ranking
  const panelBg = hexToRgba(settings.panelColor, 0.4)
  const panelBgLight = hexToRgba(settings.panelColor, 0.22)
  const gradientCss = `linear-gradient(135deg, ${settings.gradientFrom}, ${settings.gradientTo})`

  return (
    <div className="relative min-h-screen overflow-hidden" style={settings.backgroundType === 'solid' ? { backgroundColor: settings.backgroundColor } : undefined}>
      {/* Fundo — mesmo esquema da tela de login: no modo imagem, a foto fica
          numa camada e o gradiente escolhido vira uma camada de cor por cima
          dela, com intensidade ajustável (settings.overlayOpacity). */}
      {settings.backgroundType === 'gradient' && <div className="absolute inset-0" style={{ backgroundImage: gradientCss }} />}
      {settings.backgroundType === 'image' && settings.backgroundImageUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${settings.backgroundImageUrl})` }}
          />
          <div className="absolute inset-0" style={{ backgroundImage: gradientCss, opacity: settings.overlayOpacity / 100 }} />
        </>
      )}

      <div className="relative z-10 px-12 py-10" style={{ color: settings.textColor }}>
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img src={branding.logoUrl ?? '/logos/UniSave.png'} alt={branding.platformName ?? 'UniSave'} className="h-10 w-auto" />
            <div className="h-8 w-px bg-white/25" />
            <img src={branding.secondaryLogoUrl ?? '/logos/sefea.png'} alt="sefea Ribeirão Preto" className="h-10 w-auto" />
          </div>
          <div className="text-right">
            <h1 className="text-4xl font-extrabold">Ranking ao vivo</h1>
            <p className="mt-1 text-lg opacity-60">Top 5 do momento — continue pontuando pra chegar lá!</p>
          </div>
          <div
            className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-lg font-bold"
            style={{ background: panelBgLight, color: settings.accentColor }}
          >
            <span className="mp-dot h-3 w-3 rounded-full" style={{ background: settings.accentColor }} />
            AO VIVO
          </div>
        </header>

        <div className="mt-10 grid grid-cols-[1.5fr_1fr] gap-10">
          <section>
            <div className="flex items-end justify-center gap-6">
              <PodiumSpot position={2} profile={second} heightClass="h-28" panelBg={panelBgLight} barColor={settings.secondPlaceColor} />
              <PodiumSpot position={1} profile={first} heightClass="h-40" panelBg={panelBgLight} barColor={settings.firstPlaceColor} />
              <PodiumSpot position={3} profile={third} heightClass="h-20" panelBg={panelBgLight} barColor={settings.thirdPlaceColor} />
            </div>

            {(fourth || fifth) && (
              <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-5">
                {fourth && <NextRow position={4} profile={fourth} panelBg={panelBgLight} />}
                {fifth && <NextRow position={5} profile={fifth} panelBg={panelBgLight} />}
              </div>
            )}

            <TvCarousel images={settings.carouselImages} intervalSeconds={settings.carouselIntervalSeconds} />
          </section>

          <section className="rounded-3xl p-6" style={{ background: panelBg }}>
            <h2 className="text-2xl font-bold">Ranking geral</h2>
            <p className="mt-1 text-sm opacity-60">Veja sua posição — o top 5 está mais perto do que parece.</p>
            <div className="mt-5 h-[640px] overflow-hidden">
              <GeneralRankingList entries={ranking} panelBg={panelBgLight} />
            </div>
          </section>
        </div>

        {lastUpdated && (
          <p className="mt-8 text-right text-sm opacity-30">Atualizado às {lastUpdated.toLocaleTimeString('pt-BR')}</p>
        )}
      </div>
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
  panelBg,
  barColor,
}: {
  position: 1 | 2 | 3
  profile?: PublicProfile
  heightClass: string
  panelBg: string
  barColor: string
}) {
  const prize = PRIZES[position]

  return (
    <div className="flex w-56 flex-col items-center">
      <div className="relative">
        {position === 1 && <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl">👑</span>}
        <span
          className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white/80"
          style={{ background: panelBg }}
        >
          {profile ? <Avatar profile={profile} size={96} /> : <span className="text-3xl opacity-30">?</span>}
        </span>
      </div>
      <p className="mt-3 text-center text-xl font-extrabold uppercase leading-tight">{profile?.name ?? 'Aguardando…'}</p>
      <p className="text-base font-semibold opacity-70">{profile ? `${profile.total_points} pts` : ''}</p>
      <span className="mt-2 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold" style={{ background: panelBg }}>
        <span className="text-lg">{prize.icon}</span>
        {prize.label}
      </span>
      <div
        className={`mt-4 flex w-full items-start justify-center rounded-t-2xl pt-2 text-5xl font-black text-white/90 ${heightClass}`}
        style={{ background: barColor }}
      >
        {position}
      </div>
    </div>
  )
}

/** Carrossel de imagens (tamanho recomendado 1326x495, configurável em
 * Admin > Configurações > Painel de TV) exibido abaixo do Top 5 —
 * troca de imagem sozinho, sem interação (ninguém mexe numa TV). */
function TvCarousel({ images, intervalSeconds }: { images: string[]; intervalSeconds: number }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), intervalSeconds * 1000)
    return () => clearInterval(timer)
  }, [images.length, intervalSeconds])

  if (images.length === 0) return null

  return (
    <div className="relative mx-auto mt-10 w-full max-w-3xl overflow-hidden rounded-2xl bg-black/20" style={{ aspectRatio: '1326 / 495' }}>
      {images.map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  )
}

function NextRow({ position, profile, panelBg }: { position: number; profile: PublicProfile; panelBg: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: panelBg }}>
      <span className="w-8 shrink-0 text-center text-2xl font-black opacity-40">#{position}</span>
      <Avatar profile={profile} size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold uppercase leading-tight">{profile.name}</p>
        <p className="text-sm opacity-60">{profile.total_points} pts</p>
      </div>
    </div>
  )
}

// Lista da direita: parada se couber tudo na tela sem rolagem (poucos
// participantes); acima disso, gira sozinha com CSS puro (duplica a lista
// e anima translateY até -50%, que é exatamente a altura de uma cópia —
// fecha o loop sem soluço nem precisar medir altura em JS).
function GeneralRankingList({ entries, panelBg }: { entries: PublicProfile[]; panelBg: string }) {
  if (entries.length === 0) {
    return <p className="opacity-50">Ninguém pontuou ainda.</p>
  }

  const shouldScroll = entries.length > 10
  const rows = (list: PublicProfile[], keySuffix: string) =>
    list.map((p, i) => (
      <div
        key={`${p.id}-${keySuffix}`}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5"
        style={{ background: i % 2 === 1 ? panelBg : undefined }}
      >
        <span className="w-8 shrink-0 text-center text-base font-bold opacity-40">{i + 1}</span>
        <Avatar profile={p} size={38} />
        <span className="min-w-0 flex-1 truncate text-base font-semibold uppercase">{p.name}</span>
        <span className="shrink-0 text-base font-bold opacity-80">{p.total_points} pts</span>
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
