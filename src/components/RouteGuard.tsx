import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types/database'

export function RouteGuard({ children, allow }: { children: ReactNode; allow?: UserRole[] }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-ink-soft">Carregando…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/entrar" replace />

  // Alunos definem senha na primeira vez, pra não depender de link mágico
  // novo em toda visita (spec: definir senha na primeira vez).
  if (profile?.role === 'aluno' && !profile.password_set && location.pathname !== '/definir-senha') {
    return <Navigate to="/definir-senha" replace />
  }

  if (allow && profile && !allow.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
