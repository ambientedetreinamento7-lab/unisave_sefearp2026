import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'
import type { Profile, UserRole } from '../../types/database'

export function AdminUsuarios() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    const { data } = await supabase.from('profiles').select('*').order('name')
    setUsers((data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  async function changeRole(id: string, role: UserRole) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)))
  }

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy-light text-navy">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Papel</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-navy-light/50">
                <td className="px-4 py-3 font-medium text-ink">{u.name}</td>
                <td className="px-4 py-3 text-ink-soft">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
                    className="rounded-lg border border-navy-light px-2 py-1"
                  >
                    <option value="aluno">Aluno</option>
                    <option value="moderador">Moderador</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-4 text-ink-soft">Nenhum usuário cadastrado.</p>}
      </div>
    </AdminLayout>
  )
}
