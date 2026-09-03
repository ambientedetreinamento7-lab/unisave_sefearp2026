import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import type { Profile, UserRole } from '../../types/database'

export function AdminUsuarios() {
  const confirm = useConfirm()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

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

  async function resetProgress(ids: string[]) {
    const label = ids.length === 1 ? 'este aluno' : `${ids.length} alunos selecionados`
    if (
      !(await confirm(
        `Resetar o progresso de cursos de ${label}? Todas as aulas concluídas/em andamento voltam ao início. Essa ação não pode ser desfeita.`,
        { danger: true, confirmLabel: 'Resetar progresso' },
      ))
    )
      return
    setBusy(true)
    await supabase.from('user_progress').delete().in('user_id', ids)
    setBusy(false)
  }

  async function resetPoints(ids: string[]) {
    const label = ids.length === 1 ? 'este aluno' : `${ids.length} alunos selecionados`
    if (
      !(await confirm(
        `Resetar os pontos de ${label}? O total zera e o histórico de pontuação é apagado. Essa ação não pode ser desfeita.`,
        { danger: true, confirmLabel: 'Resetar pontos' },
      ))
    )
      return
    setBusy(true)
    await supabase.from('user_points_events').delete().in('user_id', ids)
    await supabase.from('profiles').update({ total_points: 0 }).in('id', ids)
    setUsers((prev) => prev.map((u) => (ids.includes(u.id) ? { ...u, total_points: 0 } : u)))
    setBusy(false)
  }

  async function resetPassword(ids: string[]) {
    const label = ids.length === 1 ? 'este aluno' : `${ids.length} alunos selecionados`
    if (
      !(await confirm(
        `Resetar a senha de ${label} para "Mudar@123"? No próximo login, será obrigatório definir uma nova senha antes de continuar. Essa ação não pode ser desfeita.`,
        { danger: true, confirmLabel: 'Resetar senha' },
      ))
    )
      return
    setBusy(true)
    await Promise.all(ids.map((id) => supabase.rpc('admin_reset_password_to_default', { p_user_id: id })))
    setUsers((prev) => prev.map((u) => (ids.includes(u.id) ? { ...u, password_set: false } : u)))
    setBusy(false)
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === users.length ? new Set() : new Set(users.map((u) => u.id))))
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected])

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-navy-light bg-lavender p-3">
          <span className="text-sm font-semibold text-lavender-ink">{selectedIds.length} selecionado(s)</span>
          <button
            onClick={() => resetProgress(selectedIds)}
            disabled={busy}
            className="rounded-lg border border-navy-light bg-surface px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy disabled:opacity-50"
          >
            Resetar progresso
          </button>
          <button
            onClick={() => resetPoints(selectedIds)}
            disabled={busy}
            className="rounded-lg border border-brand-red/30 bg-surface px-3 py-1.5 text-xs font-semibold text-brand-red hover:border-brand-red disabled:opacity-50"
          >
            Resetar pontos
          </button>
          <button
            onClick={() => resetPassword(selectedIds)}
            disabled={busy}
            className="rounded-lg border border-brand-red/30 bg-surface px-3 py-1.5 text-xs font-semibold text-brand-red hover:border-brand-red disabled:opacity-50"
          >
            Resetar senha
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy-light text-navy">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={users.length > 0 && selected.size === users.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Pontos</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-navy-light/50">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelected(u.id)} />
                </td>
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
                <td className="px-4 py-3 text-ink-soft">{u.total_points}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => resetProgress([u.id])}
                      disabled={busy}
                      className="rounded-lg border border-navy-light px-2.5 py-1 text-xs font-semibold text-navy hover:border-navy disabled:opacity-50"
                    >
                      Resetar progresso
                    </button>
                    <button
                      onClick={() => resetPoints([u.id])}
                      disabled={busy}
                      className="rounded-lg border border-brand-red/30 px-2.5 py-1 text-xs font-semibold text-brand-red hover:border-brand-red disabled:opacity-50"
                    >
                      Resetar pontos
                    </button>
                    <button
                      onClick={() => resetPassword([u.id])}
                      disabled={busy}
                      className="rounded-lg border border-brand-red/30 px-2.5 py-1 text-xs font-semibold text-brand-red hover:border-brand-red disabled:opacity-50"
                    >
                      Resetar senha
                    </button>
                  </div>
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
