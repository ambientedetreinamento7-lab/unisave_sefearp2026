import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from './Logo'

export function AppHeader({ scarcityLabel }: { scarcityLabel?: string }) {
  const { profile, signOut } = useAuth()

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <Logo compact />
        </Link>

        <div className="flex items-center gap-3">
          {scarcityLabel && (
            <span className="rounded-full bg-brand-red px-3 py-1 text-xs font-semibold text-white">
              {scarcityLabel}
            </span>
          )}
          {profile && (
            <span className="hidden text-sm text-white/80 sm:inline">Olá, {profile.name.split(' ')[0]}</span>
          )}
          <button
            onClick={signOut}
            className="rounded-full border border-white/30 px-3 py-1 text-xs font-medium text-white/90 hover:bg-white/10"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}
