import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'

const LINKS = [
  { to: '/admin/programas', label: 'Programas' },
  { to: '/admin/trilhas', label: 'Cursos' },
  { to: '/admin/scorms', label: 'Biblioteca de SCORMs' },
  { to: '/admin/certificados', label: 'Certificados' },
  { to: '/admin/comunidade', label: 'Comunidade' },
  { to: '/admin/quizzes', label: 'Quizzes' },
  { to: '/admin/grade', label: 'Grade Curricular' },
  { to: '/admin/gamificacao', label: 'Gamificação' },
  { to: '/admin/usuarios', label: 'Usuários' },
  { to: '/admin/analytics', label: 'Analytics' },
]

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">Painel do Admin</h1>
        <nav className="mt-5 flex flex-wrap gap-2">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-navy text-white' : 'bg-surface text-ink-soft hover:text-navy'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  )
}
