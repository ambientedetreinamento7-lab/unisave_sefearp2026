import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { getAllRedemptions, getRedemptionByCode, markRedemptionDelivered } from '../../lib/bottons'
import type { BottonRedemption } from '../../types/database'

export function AdminBottons() {
  const [redemptions, setRedemptions] = useState<BottonRedemption[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [codeSearch, setCodeSearch] = useState('')
  const [codeResult, setCodeResult] = useState<BottonRedemption | null | undefined>(undefined)
  const [searching, setSearching] = useState(false)

  async function reload() {
    setRedemptions(await getAllRedemptions())
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  async function handleSearchCode() {
    if (!codeSearch.trim()) return
    setSearching(true)
    setCodeResult(await getRedemptionByCode(codeSearch))
    setSearching(false)
  }

  async function handleMarkDelivered(id: string) {
    await markRedemptionDelivered(id)
    if (codeResult?.id === id) setCodeResult({ ...codeResult, status: 'delivered', delivered_at: new Date().toISOString() })
    reload()
  }

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return redemptions
    return redemptions.filter(
      (r) =>
        r.student_name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.course_name ?? '').toLowerCase().includes(q),
    )
  }, [redemptions, q])

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <p className="mb-4 text-sm text-ink-soft">
        Quando o aluno voltar no estande informando o código, digite-o abaixo pra conferir nome e curso antes de
        entregar o botton físico.
      </p>

      <div className="card p-5">
        <label className="block text-xs font-semibold text-ink-soft">Buscar por código</label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-xl border border-navy-light px-4 py-2.5 text-sm uppercase tracking-widest outline-none focus:border-navy"
            placeholder="Ex: AB3D-7XQ9"
            value={codeSearch}
            onChange={(e) => setCodeSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchCode()}
          />
          <button
            onClick={handleSearchCode}
            disabled={searching || !codeSearch.trim()}
            className="rounded-xl bg-brand-red px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {codeResult === null && <p className="mt-3 text-sm text-brand-red">Código não encontrado.</p>}
        {codeResult && (
          <div className="mt-4 rounded-xl border border-navy-light p-4">
            <p className="text-lg font-bold text-ink">{codeResult.student_name}</p>
            <p className="text-sm text-ink-soft">{codeResult.course_name ?? 'Sem curso vinculado'}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {codeResult.status === 'delivered' ? '✅ Já entregue' : 'Pendente de entrega'}
            </p>
            {codeResult.status !== 'delivered' && (
              <button
                onClick={() => handleMarkDelivered(codeResult.id)}
                className="mt-3 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
              >
                Marcar como entregue
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold text-ink">Todos os pedidos</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por nome, código ou curso"
          className="w-full max-w-xs rounded-xl border border-navy-light px-4 py-2 text-sm outline-none focus:border-navy"
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-ink-soft">
              <th className="px-4 py-3">Aluno</th>
              <th className="px-4 py-3">Curso</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Pedido em</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-navy-light/60">
                <td className="px-4 py-3 font-semibold text-ink">{r.student_name}</td>
                <td className="px-4 py-3 text-ink-soft">{r.course_name ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-soft">{r.code}</td>
                <td className="px-4 py-3 text-ink-soft">{r.status === 'delivered' ? '✅ Entregue' : 'Pendente'}</td>
                <td className="px-4 py-3 text-ink-soft">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-right">
                  {r.status !== 'delivered' && (
                    <button
                      onClick={() => handleMarkDelivered(r.id)}
                      className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
                    >
                      Marcar entregue
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-ink-soft">
                  {redemptions.length === 0 ? 'Nenhum pedido de resgate ainda.' : 'Nenhum pedido encontrado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}
