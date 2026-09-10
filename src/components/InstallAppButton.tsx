import { useSyncExternalStore } from 'react'
import { usePlatformSettings } from '../context/PlatformSettingsContext'
import { getDeferredInstallPrompt, promptInstall, subscribeInstallPrompt } from '../lib/pwaInstallPrompt'
import { Icon } from './Icon'

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
 * aparece quando o navegador de fato ofereceu instalar (beforeinstallprompt,
 * capturado globalmente em lib/pwaInstallPrompt.ts) e o admin não desligou
 * a instalabilidade.
 */
export function InstallAppButton({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { pwa } = usePlatformSettings()
  const deferredPrompt = useSyncExternalStore(subscribeInstallPrompt, getDeferredInstallPrompt)

  if (!deferredPrompt || !pwa.installableEnabled || isStandalone()) return null

  const classes =
    variant === 'dark'
      ? 'border-white/25 text-white/90 hover:bg-white/10'
      : 'border-navy-light text-navy hover:bg-navy-light'

  return (
    <button
      onClick={promptInstall}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${classes}`}
    >
      <Icon name="download" size={14} />
      Instalar app
    </button>
  )
}
