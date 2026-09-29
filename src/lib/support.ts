import { notifySupportReply } from './notifications'
import { supabase } from './supabase'
import type { SupportMessage, SupportTicket } from '../types/database'

export interface SupportTicketWithStudent extends SupportTicket {
  studentName: string
  studentEmail: string
}

export async function getMyTickets(userId: string): Promise<SupportTicket[]> {
  const { data } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  return (data as SupportTicket[]) ?? []
}

export async function getAllTickets(): Promise<SupportTicketWithStudent[]> {
  const { data } = await supabase
    .from('support_tickets')
    .select('*, profiles(name, email)')
    .order('updated_at', { ascending: false })
  type Row = SupportTicket & { profiles: { name: string; email: string } | null }
  return ((data as Row[]) ?? []).map((r) => ({
    ...r,
    studentName: r.profiles?.name ?? '—',
    studentEmail: r.profiles?.email ?? '',
  }))
}

export async function getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at')
  return (data as SupportMessage[]) ?? []
}

/** Abre um chamado novo — o assunto vira a linha do ticket, e a mensagem
 * inicial já entra como a primeira do histórico. */
export async function createTicket(userId: string, subject: string, body: string): Promise<SupportTicket> {
  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({ user_id: userId, subject })
    .select('*')
    .single()
  if (error || !ticket) throw error ?? new Error('Não foi possível abrir o chamado.')
  await supabase.from('support_messages').insert({ ticket_id: ticket.id, author_id: userId, is_admin: false, body })
  return ticket as SupportTicket
}

export async function replyAsStudent(ticketId: string, userId: string, body: string) {
  await supabase.from('support_messages').insert({ ticket_id: ticketId, author_id: userId, is_admin: false, body })
}

/** Resposta do admin — notifica o aluno dono do chamado (link /suporte). */
export async function replyAsAdmin(ticketId: string, adminId: string, body: string) {
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('user_id, subject')
    .eq('id', ticketId)
    .single()
  await supabase.from('support_messages').insert({ ticket_id: ticketId, author_id: adminId, is_admin: true, body })
  const row = ticket as { user_id: string; subject: string } | null
  if (row) await notifySupportReply(row.user_id, row.subject)
}

export async function closeTicket(ticketId: string) {
  await supabase.from('support_tickets').update({ status: 'fechado' }).eq('id', ticketId)
}
