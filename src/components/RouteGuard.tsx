import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types/database'

export function RouteGuard({ children, allow }: { children: ReactNode; allow?: UserRole[] }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-ink-soft">Carregando…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/entrar" replace />

  if (allow && profile && !allow.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
