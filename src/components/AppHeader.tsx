import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Icon } from './Icon'

const TRIAL_DAYS = 14

const NAV_LINKS = [
  { to: '/dashboard', label: 'Trilha' },
  { to: '/meu-pdi', label: 'Meu PDI' },
  { to: '/conquistas', label: 'Conquistas' },
]

function daysLeft(createdAt: string) {
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  return Math.max(0, TRIAL_DAYS - elapsed)
}

export function AppHeader() {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  const canSwitchViews = profile && profile.role !== 'aluno'

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <img src="/logos/UniSave.png" alt="UniSave" className="h-6 w-auto" />
          <div className="h-5 w-px bg-white/25" />
          <img src="/logos/sefea.png" alt="sefea Ribeirão Preto" className="h-6 w-auto" />
        </Link>

        {profile && (
          <div className="leading-tight">
            <p className="max-w-[14rem] truncate text-sm font-bold uppercase tracking-wide">{profile.name}</p>
            <p className="text-xs text-white/60">Degustação: {daysLeft(profile.created_at)}d restantes</p>
          </div>
        )}

        <nav className="flex flex-1 flex-wrap items-center gap-1.5">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Alternar tema claro/escuro"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-white/80 hover:bg-white/10"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
          </button>

          {canSwitchViews && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1 rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10"
              >
                <Icon name="shield" size={13} />
                Alternar visão
                <Icon name="chevron-down" size={13} />
              </button>

              {menuOpen && (
                <>
                  <button
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Fechar menu"
                  />
                  <div className="card absolute right-0 z-20 mt-2 w-56 overflow-hidden p-1.5 text-ink">
                    <Link
                      to="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-navy-light"
                    >
                      Área do Aluno
                    </Link>
                    {(profile.role === 'moderador' || profile.role === 'admin') && (
                      <Link
                        to="/moderador"
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-navy-light"
                      >
                        Painel Moderador
                      </Link>
                    )}
                    {profile.role === 'admin' && (
                      <Link
                        to="/admin/programas"
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-navy-light"
                      >
                        Painel Admin
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={signOut}
            aria-label="Sair"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-white/80 hover:bg-white/10"
          >
            <Icon name="log-out" size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
