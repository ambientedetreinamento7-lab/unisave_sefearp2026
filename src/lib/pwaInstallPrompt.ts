export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// beforeinstallprompt dispara no máximo uma vez por carregamento de página,
// muitas vezes antes de qualquer componente React montar — se um componente
// só anexasse o listener no próprio useEffect, corria o risco real de nunca
// ver o evento (perdido pra sempre naquela sessão). Este módulo é importado
// no topo de main.tsx, antes do React montar, pra capturar o evento o mais
// cedo possível; componentes assinam via useSyncExternalStore.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e as BeforeInstallPromptEvent
  notify()
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  notify()
})

export function getDeferredInstallPrompt() {
  return deferredPrompt
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function promptInstall() {
  if (!deferredPrompt) return
  await deferredPrompt.prompt()
  await deferredPrompt.userChoice
  deferredPrompt = null
  notify()
}
