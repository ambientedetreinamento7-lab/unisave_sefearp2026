import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlatformSettings } from '../context/PlatformSettingsContext'
import { useInactivityLogout } from '../lib/useInactivityLogout'
import type { UserRole } from '../types/database'

export function RouteGuard({ children, allow }: { children: ReactNode; allow?: UserRole[] }) {
  const { session, profile, loading, signOut } = useAuth()
  const { maintenance, legal, session: sessionSettings, loading: settingsLoading } = usePlatformSettings()
  const location = useLocation()
  const navigate = useNavigate()

  const handleInactivityTimeout = useCallback(() => {
    signOut().then(() => navigate('/entrar', { replace: true }))
  }, [signOut, navigate])
  useInactivityLogout(session ? sessionSettings.inactivityTimeoutMinutes : null, handleInactivityTimeout)

  if (loading || settingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-ink-soft">Carregando…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/entrar" replace />

  // Modo manutenção (spec: Configurações → Modo manutenção) — admin
  // sempre passa, pra conseguir desligar de novo.
  if (maintenance.enabled && profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="card max-w-md p-8 text-center">
          <span className="text-3xl">🛠️</span>
          <h1 className="mt-3 text-lg font-bold text-ink">Plataforma em manutenção</h1>
          <p className="mt-2 text-sm text-ink-soft">{maintenance.message}</p>
        </div>
      </div>
    )
  }

  // Alunos definem senha na primeira vez, pra não depender de link mágico
  // novo em toda visita (spec: definir senha na primeira vez).
  if (profile?.role === 'aluno' && !profile.password_set && location.pathname !== '/definir-senha') {
    return <Navigate to="/definir-senha" replace />
  }

  // Termos de Uso (spec: Configurações → Legal/LGPD) — só ativa quando o
  // admin de fato configurou um link de termos; mudar termsVersion força
  // reaceite de todo mundo.
  if (
    legal.termsUrl &&
    profile &&
    profile.terms_accepted_version !== legal.termsVersion &&
    location.pathname !== '/aceitar-termos'
  ) {
    return <Navigate to="/aceitar-termos" replace />
  }

  if (allow && profile && !allow.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
