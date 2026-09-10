import { useEffect } from 'react'
import { usePlatformSettings } from '../context/PlatformSettingsContext'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * Liga/desliga a instalabilidade do PWA em runtime, sem precisar de novo
 * deploy: com o toggle desligado, nenhum visitante novo recebe o service
 * worker (então o navegador não oferece instalar); com ligado, registra
 * normalmente. Quem já instalou continua funcionando mesmo se o admin
 * desligar depois — só novas instalações são afetadas (spec: Configurações
 * → App instalável).
 *
 * Importante: não tentamos desregistrar um service worker já ativo quando
 * o toggle é desligado. Um SW ativo com clientsClaim intercepta a própria
 * navegação e serve o app a partir do cache — o JS que faria o
 * "desregistrar" rodaria a partir desse mesmo cache antigo e nunca veria a
 * config nova, travando o visitante num loop. Só controlamos o registro de
 * quem ainda não tem um SW; quem já tem (instalado ou não) é deixado como
 * está, e continua recebendo as atualizações normais de cache do Workbox.
 */
export function PwaController() {
  const { pwa, loading } = usePlatformSettings()

  useEffect(() => {
    if (loading) return
    if (pwa.installableEnabled || isStandalone()) {
      import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
    }
  }, [pwa.installableEnabled, loading])

  return null
}
