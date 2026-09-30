import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { getAnnouncementSettings } from '../lib/settings'
import type { AnnouncementBannerSettings } from '../types/database'

/** Chave do sessionStorage inclui o texto do aviso — se o admin trocar a
 * mensagem (ex.: nova palestra), o dismiss antigo não esconde a nova. */
function dismissKey(text: string) {
  return `announcement-dismissed:${text}`
}

export function AnnouncementBanner() {
  const [settings, setSettings] = useState<AnnouncementBannerSettings | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    getAnnouncementSettings().then(setSettings)
  }, [])

  if (!settings || !settings.enabled || !settings.text.trim()) return null

  const now = Date.now()
  if (settings.startAt && now < new Date(settings.startAt).getTime()) return null
  if (settings.endAt && now > new Date(settings.endAt).getTime()) return null
  if (dismissed || sessionStorage.getItem(dismissKey(settings.text))) return null

  const content = (
    <>
      <Icon name="party" size={14} className="shrink-0" />
      <span className="min-w-0 truncate">{settings.text}</span>
      {settings.linkUrl && <span className="shrink-0 font-bold underline underline-offset-2">Saiba mais →</span>}
    </>
  )

  return (
    <div className="flex items-center gap-2 bg-brand-red px-4 py-2 text-xs font-semibold text-white sm:text-sm">
      {settings.linkUrl ? (
        <a href={settings.linkUrl} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2">
          {content}
        </a>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">{content}</div>
      )}
      <button
        onClick={() => {
          sessionStorage.setItem(dismissKey(settings.text), '1')
          setDismissed(true)
        }}
        aria-label="Fechar aviso"
        className="shrink-0 rounded-full p-1 hover:bg-white/15"
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  )
}
