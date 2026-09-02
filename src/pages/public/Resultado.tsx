import { Link, Navigate, useLocation } from 'react-router-dom'
import { HeroBrandBar } from '../../components/HeroBrandBar'
import { Icon } from '../../components/Icon'
import { PROFILE_INFO } from '../../lib/quiz'
import type { DiagnosticProfile } from '../../types/database'

interface ResultadoState {
  profile: DiagnosticProfile
  program: string
  name: string
  email: string
}

export function Resultado() {
  const location = useLocation()
  const state = location.state as ResultadoState | null

  if (!state) return <Navigate to="/estande" replace />

  const info = PROFILE_INFO[state.profile]
  const firstName = state.name.split(' ')[0]

  return (
    <div className="hero-gradient min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <HeroBrandBar compact />

        <div className="mt-8 text-center sm:mt-10">
          <span className="glass-pill px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide">
            <Icon name="party" size={13} />
            Perfil pronto, {firstName}!
          </span>

          <h1 className="mx-auto mt-5 max-w-lg text-balance text-[clamp(1.7rem,5.5vw,2.4rem)] font-extrabold leading-[1.12] text-white">
            Seu perfil é <span className="text-brand-red">{info.title}</span>
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm text-white/70 sm:text-[15px]">{info.description}</p>
        </div>

        <div className="card mt-8 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white"
              style={{ background: 'var(--color-success)' }}
            >
              {info.avatarLetter}
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Curso recomendado</p>
              <p className="font-bold leading-snug text-ink">{info.trackTitle}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border-2 border-dashed border-red-200 bg-red-50/60 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-red">
              <Icon name="map-pin" size={13} />
              Não perca na feira
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              Palestra: "{info.talk.title}" — {info.talk.location}
            </p>
          </div>

          <Link
            to="/dashboard"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-red py-3.5 text-center font-bold text-white transition hover:bg-brand-red-dark"
          >
            Acessar minha trilha de cursos pós-feira
            <Icon name="arrow-right" size={16} />
          </Link>

          <p className="mt-5 text-center text-xs text-ink-soft">
            Guardamos seu acesso neste dispositivo. Enviamos também um link mágico para{' '}
            <span className="font-semibold text-ink">{state.email}</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
