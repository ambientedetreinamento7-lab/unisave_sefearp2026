import { supabase } from './supabase'
import type { Notification, NotificationType } from '../types/database'

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data as Notification[]) ?? []
}

export async function markAsRead(id: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', id)
}

export async function markAllAsRead(userId: string) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
}

export async function clearAll(userId: string) {
  await supabase.from('notifications').delete().eq('user_id', userId)
}

async function createNotification(input: { userId: string; type: NotificationType; title: string; body?: string; link?: string }) {
  await supabase.from('notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  })
}

export async function notifyReaction(recipientId: string, actorName: string, context: string) {
  await createNotification({
    userId: recipientId,
    type: 'reaction',
    title: `${actorName} reagiu ao seu ${context}`,
    link: '/comunidade',
  })
}

export async function notifyCourseCompleted(userId: string, pillTitle: string) {
  await createNotification({
    userId,
    type: 'course_completed',
    title: `Você concluiu "${pillTitle}"`,
    link: '/dashboard',
  })
}

export async function notifyPdiProgress(userId: string, message: string) {
  await createNotification({
    userId,
    type: 'pdi_progress',
    title: message,
    link: '/meu-pdi',
  })
}
