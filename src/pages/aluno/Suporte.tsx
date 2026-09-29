import { useEffect, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icon'
import { useConfirm } from '../../components/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { relativeTime } from '../../lib/format'
import { closeTicket, createTicket, getMyTickets, getTicketMessages, replyAsStudent } from '../../lib/support'
import type { SupportMessage, SupportTicket, SupportTicketStatus } from '../../types/database'

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

export function Suporte() {
  const { profile } = useAuth()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)

  async function reload() {
    if (!profile) return
    setTickets(await getMyTickets(profile.id))
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  if (!profile) return null

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Suporte</h1>
            <p className="mt-1 text-ink-soft">Abra um chamado e acompanhe a resposta da nossa equipe por aqui.</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-dark"
          >
            <Icon name="message-circle" size={15} />
            Abrir chamado
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-ink-soft">Carregando…</p>
        ) : (
          <div className="mt-6 space-y-2">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setOpenTicketId(t.id)}
                className="card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:card-highlight"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">Atualizado {relativeTime(t.updated_at)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[t.status]}`}>
                  {STATUS_LABEL[t.status]}
                </span>
              </button>
            ))}
            {tickets.length === 0 && (
              <p className="text-ink-soft">Você ainda não abriu nenhum chamado.</p>
            )}
          </div>
        )}
      </main>

      {creating && (
        <NewTicketModal
          userId={profile.id}
          onClose={() => setCreating(false)}
          onCreated={async (ticket) => {
            setCreating(false)
            await reload()
            setOpenTicketId(ticket.id)
          }}
        />
      )}

      {openTicketId && (
        <TicketModal
          ticketId={openTicketId}
          userId={profile.id}
          onClose={() => setOpenTicketId(null)}
          onChanged={reload}
        />
      )}
    </div>
  )
}

function NewTicketModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string
  onClose: () => void
  onCreated: (ticket: SupportTicket) => void
}) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!subject.trim() || !body.trim()) {
      setError('Preencha o assunto e a mensagem.')
      return
    }
    setSending(true)
    setError('')
    try {
      const ticket = await createTicket(userId, subject.trim(), body.trim())
      onCreated(ticket)
    } catch {
      setError('Não foi possível abrir o chamado. Tente de novo.')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold text-ink">Abrir chamado</h2>
        <label className="mt-4 block text-xs font-semibold text-ink-soft">Assunto</label>
        <input
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
          placeholder="Ex: Não consigo acessar um curso"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <label className="mt-3 block text-xs font-semibold text-ink-soft">Mensagem</label>
        <textarea
          className="mt-1 h-32 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm"
          placeholder="Descreva o que está acontecendo…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={sending}
            className="rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {sending ? 'Enviando…' : 'Abrir chamado'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TicketModal({
  ticketId,
  userId,
  onClose,
  onChanged,
}: {
  ticketId: string
  userId: string
  onClose: () => void
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  async function reload() {
    setMessages(await getTicketMessages(ticketId))
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  // O status/assunto do ticket em si não muda durante a conversa exceto por
  // quem responde por último — busca só uma vez ao abrir, e depois de cada
  // ação local (responder/encerrar) já sabemos o novo estado sem recarregar.
  useEffect(() => {
    getMyTickets(userId).then((all) => setTicket(all.find((t) => t.id === ticketId) ?? null))
  }, [ticketId, userId])

  async function sendReply() {
    if (!reply.trim()) return
    setSending(true)
    await replyAsStudent(ticketId, userId, reply.trim())
    setReply('')
    await reload()
    setTicket((t) => (t ? { ...t, status: 'aberto', updated_at: new Date().toISOString() } : t))
    onChanged()
    setSending(false)
  }

  async function handleClose() {
    if (!(await confirm('Encerrar este chamado? Você pode abrir um novo depois, se precisar.', { confirmLabel: 'Encerrar' })))
      return
    await closeTicket(ticketId)
    setTicket((t) => (t ? { ...t, status: 'fechado' } : t))
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-lg flex-col p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-navy-light p-4">
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{ticket?.subject ?? 'Chamado'}</p>
            {ticket && (
              <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLOR[ticket.status]}`}>
                {STATUS_LABEL[ticket.status]}
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-bg">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading && <p className="text-sm text-ink-soft">Carregando…</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.is_admin ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.is_admin ? 'bg-navy-light text-ink' : 'bg-brand-red text-white'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{m.is_admin ? 'Suporte' : 'Você'}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-[10px] opacity-60">{relativeTime(m.created_at)}</p>
              </div>
            </div>
          ))}
        </div>

        {ticket && ticket.status !== 'fechado' ? (
          <div className="border-t border-navy-light p-3">
            <div className="flex items-end gap-2">
              <textarea
                className="h-16 flex-1 rounded-xl border border-navy-light px-3 py-2 text-sm"
                placeholder="Escreva sua resposta…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
            <button onClick={handleClose} className="mt-2 text-xs font-semibold text-ink-soft hover:underline">
              Encerrar chamado
            </button>
          </div>
        ) : (
          ticket && (
            <div className="border-t border-navy-light p-3 text-center text-xs text-ink-soft">Este chamado foi encerrado.</div>
          )
        )}
      </div>
    </div>
  )
}
