import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import { grantManualPoints } from '../../lib/gamification'
import { supabase } from '../../lib/supabase'
import type { Profile, UserRole } from '../../types/database'

export function AdminUsuarios() {
  const confirm = useConfirm()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [grantingIds, setGrantingIds] = useState<string[] | null>(null)

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

  async function setRankingOptOut(ids: string[], optOut: boolean) {
    setBusy(true)
    await supabase.from('profiles').update({ ranking_opt_out: optOut }).in('id', ids)
    setUsers((prev) => prev.map((u) => (ids.includes(u.id) ? { ...u, ranking_opt_out: optOut } : u)))
    setBusy(false)
  }

  async function applyGrant(ids: string[], points: number, reason: string) {
    setBusy(true)
    await Promise.all(ids.map((id) => grantManualPoints(id, points, reason)))
    const { data } = await supabase.from('profiles').select('id, total_points').in('id', ids)
    const totalsById = new Map(((data as { id: string; total_points: number }[]) ?? []).map((r) => [r.id, r.total_points]))
    setUsers((prev) => prev.map((u) => (totalsById.has(u.id) ? { ...u, total_points: totalsById.get(u.id)! } : u)))
    setBusy(false)
    setGrantingIds(null)
  }

  async function deleteUsers(ids: string[]) {
    const label = ids.length === 1 ? 'este usuário' : `${ids.length} usuários selecionados`
    if (
      !(await confirm(
        `Excluir ${label} definitivamente? A conta de acesso e todos os dados (progresso, PDI, posts, certificados, pontos) são apagados de vez. Essa ação não pode ser desfeita.`,
        { danger: true, confirmLabel: 'Excluir' },
      ))
    )
      return
    setBusy(true)
    await Promise.all(ids.map((id) => supabase.rpc('admin_delete_user', { p_user_id: id })))
    setUsers((prev) => prev.filter((u) => !ids.includes(u.id)))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
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
            onClick={() => setGrantingIds(selectedIds)}
            disabled={busy}
            className="rounded-lg border border-success/30 bg-surface px-3 py-1.5 text-xs font-semibold text-success hover:border-success disabled:opacity-50"
          >
            Conceder pontos
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
          <button
            onClick={() => setRankingOptOut(selectedIds, true)}
            disabled={busy}
            className="rounded-lg border border-navy-light bg-surface px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy disabled:opacity-50"
          >
            Ocultar do ranking
          </button>
          <button
            onClick={() => setRankingOptOut(selectedIds, false)}
            disabled={busy}
            className="rounded-lg border border-navy-light bg-surface px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy disabled:opacity-50"
          >
            Mostrar no ranking
          </button>
          <button
            onClick={() => deleteUsers(selectedIds)}
            disabled={busy}
            className="rounded-lg bg-brand-red px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-red-dark disabled:opacity-50"
          >
            Excluir usuário
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-chip text-navy">
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
              <th className="px-4 py-3">Ranking</th>
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
                  <label className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                    <input
                      type="checkbox"
                      checked={!u.ranking_opt_out}
                      disabled={busy}
                      onChange={(e) => setRankingOptOut([u.id], !e.target.checked)}
                    />
                    Aparece
                  </label>
                </td>
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
                      onClick={() => setGrantingIds([u.id])}
                      disabled={busy}
                      className="rounded-lg border border-success/30 px-2.5 py-1 text-xs font-semibold text-success hover:border-success disabled:opacity-50"
                    >
                      Conceder pontos
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
                    <button
                      onClick={() => deleteUsers([u.id])}
                      disabled={busy}
                      className="rounded-lg bg-brand-red px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-red-dark disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-4 text-ink-soft">Nenhum usuário cadastrado.</p>}
      </div>

      {grantingIds && (
        <GrantPointsModal
          count={grantingIds.length}
          busy={busy}
          onClose={() => setGrantingIds(null)}
          onConfirm={(points, reason) => applyGrant(grantingIds, points, reason)}
        />
      )}
    </AdminLayout>
  )
}

function GrantPointsModal({
  count,
  busy,
  onClose,
  onConfirm,
}: {
  count: number
  busy: boolean
  onClose: () => void
  onConfirm: (points: number, reason: string) => void
}) {
  const [points, setPoints] = useState(0)
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold text-ink">
          Conceder pontos {count === 1 ? 'a este aluno' : `a ${count} alunos selecionados`}
        </h2>
        <label className="mt-4 block text-xs font-semibold text-ink-soft">Pontos (negativo pra descontar)</label>
        <input
          type="number"
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          autoFocus
        />
        <label className="mt-3 block text-xs font-semibold text-ink-soft">Motivo (aparece na notificação do aluno)</label>
        <input
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
          placeholder="Ex: Participação na palestra de hoje"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(points, reason)}
            disabled={busy || points === 0}
            className="rounded-xl bg-success px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Aplicando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
