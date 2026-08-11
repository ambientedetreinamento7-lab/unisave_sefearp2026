import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { relativeTime } from '../lib/format'
import { clearAll, getNotifications, markAllAsRead, markAsRead } from '../lib/notifications'
import type { Notification, NotificationType } from '../types/database'
import { Icon, type IconName } from './Icon'

const TYPE_ICON: Record<NotificationType, IconName> = {
  reaction: 'heart-filled',
  course_completed: 'graduation-cap',
  pdi_progress: 'target',
  points: 'sparkles',
}

export function NotificationBell({ mobile = false }: { mobile?: boolean }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const unreadCount = notifications.filter((n) => !n.read).length

  async function load() {
    if (!profile) return
    setNotifications(await getNotifications(profile.id))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) await load()
  }

  async function handleClick(n: Notification) {
    setOpen(false)
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      await markAsRead(n.id)
    }
    if (n.link) navigate(n.link)
  }

  async function handleMarkAll() {
    if (!profile) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await markAllAsRead(profile.id)
  }

  async function handleClear() {
    if (!profile) return
    setNotifications([])
    await clearAll(profile.id)
  }

  if (!profile) return null

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        aria-label="Notificações"
        className={
          mobile
            ? 'relative flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/25 py-2 text-sm font-semibold text-white/90 hover:bg-white/10'
            : 'relative flex h-8 w-8 items-center justify-center rounded-full border border-white/25 text-white/80 hover:bg-white/10'
        }
      >
        <Icon name="bell" size={mobile ? 15 : 15} />
        {mobile && 'Notificações'}
        {unreadCount > 0 && (
          <span
            className={
              mobile
                ? 'absolute right-3 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white'
                : 'absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white'
            }
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-label="Fechar notificações" />
          <div className="card absolute right-0 z-20 mt-2 w-80 max-w-[90vw] overflow-hidden text-ink">
            <div className="flex items-center justify-between border-b border-navy-light px-3 py-2">
              <p className="text-sm font-bold text-ink">Notificações</p>
              <div className="flex items-center gap-3">
                {notifications.length > 0 && (
                  <>
                    <button onClick={handleMarkAll} className="text-xs font-semibold text-navy hover:underline">
                      Marcar tudo como lido
                    </button>
                    <button onClick={handleClear} className="text-xs font-semibold text-brand-red hover:underline">
                      Limpar
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-soft">Nenhuma notificação por aqui.</p>}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-2.5 border-b border-navy-light/60 px-3 py-2.5 text-left last:border-0 hover:bg-bg ${
                    n.read ? '' : 'bg-lavender'
                  }`}
                >
                  <span className="icon-badge mt-0.5 h-7 w-7 shrink-0">
                    <Icon name={TYPE_ICON[n.type]} size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{n.title}</span>
                    {n.body && <span className="block text-xs text-ink-soft">{n.body}</span>}
                    <span className="block text-xs text-ink-faint">{relativeTime(n.created_at)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-red" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
