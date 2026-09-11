import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlatformSettings } from '../context/PlatformSettingsContext'
import { useTheme } from '../context/ThemeContext'
import { colorForName, initials } from '../lib/avatar'
import { getTrialSettings } from '../lib/settings'
import { Icon } from './Icon'
import { InstallAppButton } from './InstallAppButton'
import { NotificationBell } from './NotificationBell'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Cursos' },
  { to: '/meu-pdi', label: 'Meu PDI' },
  { to: '/comunidade', label: 'Comunidade' },
  { to: '/conquistas', label: 'Conquistas' },
  { to: '/certificados', label: 'Certificados' },
  { to: '/ranking', label: 'Ranking' },
]

function daysLeft(createdAt: string, trialDays: number) {
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  return Math.max(0, trialDays - elapsed)
}

export function AppHeader() {
  const { profile, signOut } = useAuth()
  const { branding } = usePlatformSettings()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [trial, setTrial] = useState<{ enabled: boolean; days: number } | null>(null)

  useEffect(() => {
    getTrialSettings().then(setTrial)
  }, [])

  const trialLabel =
    trial?.enabled && profile ? `Degustação: ${daysLeft(profile.created_at, trial.days)}d restantes` : null

  const canSwitchViews = profile && profile.role !== 'aluno'

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-x-4 gap-y-3 px-5 py-3">
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <img src={branding.logoUrl ?? '/logos/UniSave.png'} alt={branding.platformName ?? 'UniSave'} className="h-6 w-auto" />
          <div className="h-5 w-px bg-white/25" />
          <img src={branding.secondaryLogoUrl ?? '/logos/sefea.png'} alt="sefea Ribeirão Preto" className="h-6 w-auto" />
        </Link>

        {profile && (
          <div className="hidden shrink-0 leading-tight xl:block">
            <p className="max-w-[12rem] truncate text-sm font-bold uppercase tracking-wide">{profile.name}</p>
            {trialLabel && <p className="text-xs text-white/60">{trialLabel}</p>}
          </div>
        )}

        {/* Desktop nav */}
        <nav className="hidden min-w-0 flex-1 flex-nowrap items-center gap-1 sm:flex">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              id={`tour-nav-${l.to.replace('/', '')}`}
              to={l.to}
              className={({ isActive }) =>
                `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop controls */}
        <div className="ml-auto hidden shrink-0 items-center gap-1.5 sm:flex">
          <InstallAppButton />

          <button
            id="tour-theme-toggle"
            onClick={toggleTheme}
            aria-label="Alternar tema claro/escuro"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-white/80 hover:bg-white/10"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
          </button>

          <span id="tour-notifications">
            <NotificationBell />
          </span>

          {canSwitchViews && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                title="Alternar visão"
                className="flex items-center gap-1 rounded-full border border-white/25 px-2.5 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/10 xl:px-3"
              >
                <Icon name="shield" size={13} />
                <span className="hidden xl:inline">Alternar visão</span>
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

          {profile && (
            <div className="relative">
              <button
                id="tour-avatar-button"
                onClick={() => setAvatarMenuOpen((v) => !v)}
                aria-label="Menu da conta"
                className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/25"
              >
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
              </button>

              {avatarMenuOpen && (
                <>
                  <button
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setAvatarMenuOpen(false)}
                    aria-label="Fechar menu"
                  />
                  <div className="card absolute right-0 z-20 mt-2 w-52 overflow-hidden p-1.5 text-ink">
                    <Link
                      to="/meu-perfil"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-navy-light"
                    >
                      Meu Perfil
                    </Link>
                    <Link
                      to="/dashboard?tour=nav"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-navy-light"
                    >
                      Tutorial de navegação
                    </Link>
                    <button
                      onClick={signOut}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-red hover:bg-navy-light"
                    >
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Instalar app + hamburguer (mobile) — o botão de instalar fica
            visível direto na barra, não escondido dentro do menu, senão
            quem não abre o menu nunca vê que dá pra instalar o app. */}
        <div className="ml-auto flex items-center gap-2 sm:hidden">
          <InstallAppButton variant="dark" />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 text-white"
          >
            {mobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="border-t border-white/10 px-5 py-4 sm:hidden">
          {profile && (
            <Link
              to="/meu-perfil"
              onClick={() => setMobileOpen(false)}
              className="mb-3 flex items-center gap-3 leading-tight"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/25">
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
              <span>
                <p className="truncate text-sm font-bold uppercase tracking-wide">{profile.name}</p>
                <p className="text-xs text-white/60">Meu Perfil{trialLabel ? ` · ${trialLabel}` : ''}</p>
              </span>
            </Link>
          )}

          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          {canSwitchViews && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wide text-white/50">Alternar visão</p>
              <Link
                to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Área do Aluno
              </Link>
              {(profile.role === 'moderador' || profile.role === 'admin') && (
                <Link
                  to="/moderador"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  Painel Moderador
                </Link>
              )}
              {profile.role === 'admin' && (
                <Link
                  to="/admin/programas"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  Painel Admin
                </Link>
              )}
            </div>
          )}

          <div className="mt-3 border-t border-white/10 pt-3">
            <Link
              to="/dashboard?tour=nav"
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Tutorial de navegação
            </Link>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
            <button
              onClick={toggleTheme}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/25 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
              {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            </button>
            <NotificationBell mobile />
            <button
              onClick={signOut}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/25 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              <Icon name="log-out" size={15} />
              Sair
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
