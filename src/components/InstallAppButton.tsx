import { useEffect, useState } from 'react'
import { usePlatformSettings } from '../context/PlatformSettingsContext'
import { Icon } from './Icon'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * Botão "Instalar app" com o tema da plataforma — complementa o ícone
 * nativo que o Chrome/Edge já mostram sozinhos, deixando mais óbvio pro
 * aluno que dá pra instalar (spec: Configurações → App instalável). Só
 * aparece quando o navegador de fato ofereceu instalar (beforeinstallprompt)
 * e o admin não desligou a instalabilidade.
 */
export function InstallAppButton({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { pwa } = usePlatformSettings()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) return

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!deferredPrompt || !pwa.installableEnabled) return null

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  const classes =
    variant === 'dark'
      ? 'border-white/25 text-white/90 hover:bg-white/10'
      : 'border-navy-light text-navy hover:bg-navy-light'

  return (
    <button
      onClick={install}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${classes}`}
    >
      <Icon name="download" size={14} />
      Instalar app
    </button>
  )
}
