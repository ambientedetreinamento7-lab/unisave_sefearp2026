import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const

/**
 * Desloga sozinho depois de X minutos sem interação (spec: Configurações →
 * Segurança de sessão). `timeoutMinutes` nulo/undefined desativa — sem
 * limite, mesmo comportamento de antes dessa feature existir.
 *
 * Escopo client-side de propósito: revogar sessão em outros dispositivos
 * exigiria a service-role key do Supabase, que não roda no navegador do
 * aluno — fica fora, é uma limitação conhecida, não um esquecimento.
 */
export function useInactivityLogout(timeoutMinutes: number | null | undefined, onTimeout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(onTimeout, timeoutMinutes! * 60 * 1000)
    }

    reset()
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset))
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset))
    }
  }, [timeoutMinutes, onTimeout])
}
