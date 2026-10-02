import { useEffect, useState } from 'react'
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
  const [updateReady, setUpdateReady] = useState(false)
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (loading) return
    if (pwa.installableEnabled || isStandalone()) {
      import('virtual:pwa-register').then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          // Nunca recarrega sozinho sem avisar — isso derrubava o que o
          // aluno estivesse fazendo no meio de um curso. Mas também não
          // pode ficar esperando pra sempre: quem deixa a aba sempre em
          // primeiro plano (ex.: admin testando) nunca via a atualização
          // sem forçar um hard refresh manualmente. Agora mostra um aviso
          // que a pessoa decide quando aplicar, e ainda aplica sozinho se
          // a aba for pro segundo plano antes disso (sem pedir nada).
          onNeedReload() {
            setUpdateReady(true)
            setApplyUpdate(() => () => updateSW())
            const reloadIfHidden = () => {
              if (document.visibilityState === 'hidden') updateSW()
            }
            document.addEventListener('visibilitychange', reloadIfHidden)
          },
        })
      })
    }
  }, [pwa.installableEnabled, loading])

  if (!updateReady) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center gap-3 bg-navy px-4 py-3 text-sm font-semibold text-white shadow-lg">
      <span>Uma nova versão da plataforma está disponível.</span>
      <button
        onClick={() => applyUpdate?.()}
        className="rounded-full bg-brand-red px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-red-dark"
      >
        Atualizar agora
      </button>
    </div>
  )
}
