import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { getAnnouncementSettings } from '../lib/settings'
import type { AnnouncementBannerSettings } from '../types/database'

/** Chave do sessionStorage inclui o conteúdo do aviso (imagem ou texto) —
 * se o admin trocar a mensagem/imagem (ex.: nova palestra), o dismiss
 * antigo não esconde a nova. */
function dismissKey(settings: AnnouncementBannerSettings) {
  return `announcement-dismissed:${settings.imageUrl ?? settings.text}`
}

/** Anúncio configurável (Admin > Configurações) exibido no topo do
 * Dashboard, no mesmo lugar/tamanho do carrossel de banners de curso
 * (1326x495) — pra coisas como divulgar uma palestra, com imagem e link
 * clicáveis. */
export function AnnouncementBanner() {
  const [settings, setSettings] = useState<AnnouncementBannerSettings | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    getAnnouncementSettings().then(setSettings)
  }, [])

  if (!settings || !settings.enabled) return null
  if (!settings.imageUrl && !settings.text.trim()) return null

  const now = Date.now()
  if (settings.startAt && now < new Date(settings.startAt).getTime()) return null
  if (settings.endAt && now > new Date(settings.endAt).getTime()) return null
  if (dismissed || sessionStorage.getItem(dismissKey(settings))) return null

  function dismiss() {
    sessionStorage.setItem(dismissKey(settings!), '1')
    setDismissed(true)
  }

  if (settings.imageUrl) {
    const image = (
      <img src={settings.imageUrl} alt={settings.text} className="block w-full" style={{ aspectRatio: '1326 / 495' }} />
    )
    return (
      <div className="relative mt-6 w-full overflow-hidden rounded-2xl bg-navy-light">
        {settings.linkUrl ? (
          <a href={settings.linkUrl} target="_blank" rel="noreferrer">
            {image}
          </a>
        ) : (
          image
        )}
        <button
          onClick={dismiss}
          aria-label="Fechar aviso"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <Icon name="x" size={15} />
        </button>
      </div>
    )
  }

  const content = (
    <>
      <Icon name="party" size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{settings.text}</span>
      {settings.linkUrl && <span className="shrink-0 font-bold underline underline-offset-2">Saiba mais →</span>}
    </>
  )

  return (
    <div className="relative mt-6 flex items-center gap-3 rounded-2xl bg-brand-red px-5 py-4 pr-12 text-sm font-semibold text-white sm:text-base">
      {settings.linkUrl ? (
        <a href={settings.linkUrl} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
          {content}
        </a>
      ) : (
        content
      )}
      <button
        onClick={dismiss}
        aria-label="Fechar aviso"
        className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full hover:bg-white/15"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}
