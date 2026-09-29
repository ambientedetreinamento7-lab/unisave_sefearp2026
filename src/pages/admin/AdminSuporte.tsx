import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { Icon } from '../../components/Icon'
import { useConfirm } from '../../components/ConfirmDialog'
import { relativeTime } from '../../lib/format'
import { closeTicket, getAllTickets, getTicketMessages, replyAsAdmin } from '../../lib/support'
import { useAuth } from '../../context/AuthContext'
import type { SupportMessage, SupportTicketStatus } from '../../types/database'
import type { SupportTicketWithStudent } from '../../lib/support'

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  aberto: 'Aberto',
  respondido: 'Respondido',
  fechado: 'Encerrado',
}

const STATUS_COLOR: Record<SupportTicketStatus, string> = {
  aberto: 'bg-lavender text-lavender-ink',
  respondido: 'bg-success/15 text-success',
  fechado: 'bg-navy-light text-ink-soft',
}

export function AdminSuporte() {
  const { profile } = useAuth()
  const [tickets, setTickets] = useState<SupportTicketWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'' | SupportTicketStatus>('')
  const [search, setSearch] = useState('')
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)

  async function reload() {
    setTickets(await getAllTickets())
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  const filtered = tickets.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false
    const q = search.trim().toLowerCase()
    if (q && !t.subject.toLowerCase().includes(q) && !t.studentName.toLowerCase().includes(q)) return false
    return true
  })

  const openCount = tickets.filter((t) => t.status !== 'fechado').length

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">Chamados de suporte</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {openCount > 0 ? `${openCount} chamado(s) em aberto` : 'Nenhum chamado em aberto'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-lg border border-navy-light px-3 py-1.5 text-sm"
            placeholder="Buscar por aluno ou assunto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-lg border border-navy-light px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="respondido">Respondido</option>
            <option value="fechado">Encerrado</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-ink-soft">Carregando…</p>
      ) : (
        <div className="card mt-5 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-chip text-navy">
              <tr>
                <th className="px-4 py-3">Aluno</th>
                <th className="px-4 py-3">Assunto</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setOpenTicketId(t.id)}
                  className="cursor-pointer border-t border-navy-light/50 hover:bg-bg"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{t.studentName}</p>
                    <p className="text-xs text-ink-soft">{t.studentEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-ink">{t.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_COLOR[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{relativeTime(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-4 text-ink-soft">Nenhum chamado encontrado.</p>}
        </div>
      )}

      {openTicketId && profile && (
        <TicketDetailModal
          ticketId={openTicketId}
          adminId={profile.id}
          onClose={() => setOpenTicketId(null)}
          onChanged={reload}
        />
      )}
    </AdminLayout>
  )
}

function TicketDetailModal({
  ticketId,
  adminId,
  onClose,
  onChanged,
}: {
  ticketId: string
  adminId: string
  onClose: () => void
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  async function reload() {
    setMessages(await getTicketMessages(ticketId))
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  async function send() {
    if (!reply.trim()) return
    setSending(true)
    await replyAsAdmin(ticketId, adminId, reply.trim())
    setReply('')
    await reload()
    onChanged()
    setSending(false)
  }

  async function handleClose() {
    if (!(await confirm('Encerrar este chamado?', { confirmLabel: 'Encerrar' }))) return
    await closeTicket(ticketId)
    onChanged()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-lg flex-col p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-navy-light p-4">
          <p className="font-bold text-ink">Chamado</p>
          <div className="flex items-center gap-2">
            <button onClick={handleClose} className="text-xs font-semibold text-brand-red hover:underline">
              Encerrar
            </button>
            <button onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-bg">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading && <p className="text-sm text-ink-soft">Carregando…</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.is_admin ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.is_admin ? 'bg-brand-red text-white' : 'bg-navy-light text-ink'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{m.is_admin ? 'Suporte' : 'Aluno'}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-[10px] opacity-60">{relativeTime(m.created_at)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-navy-light p-3">
          <div className="flex items-end gap-2">
            <textarea
              className="h-16 flex-1 rounded-xl border border-navy-light px-3 py-2 text-sm"
              placeholder="Responder ao aluno…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <button
              onClick={send}
              disabled={sending || !reply.trim()}
              className="rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
