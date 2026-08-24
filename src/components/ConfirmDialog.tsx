import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { usePlatformSettings } from '../context/PlatformSettingsContext'
import { Icon } from './Icon'

interface ConfirmOptions {
  title?: string
  danger?: boolean
  confirmLabel?: string
  cancelLabel?: string
}

interface PendingConfirm extends ConfirmOptions {
  message: string
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { branding } = usePlatformSettings()
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const resolver = useRef<(value: boolean) => void>(undefined)

  const confirm = useCallback<ConfirmFn>((message, options) => {
    setPending({ message, ...options })
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function settle(value: boolean) {
    setPending(null)
    resolver.current?.(value)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface shadow-2xl">
            <div className="flex items-center gap-2 bg-navy px-5 py-3">
              <img src={branding.logoUrl ?? '/logos/UniSave.png'} alt="" className="h-4 w-auto" />
              <div className="h-4 w-px bg-white/25" />
              <img src={branding.secondaryLogoUrl ?? '/logos/sefea.png'} alt="" className="h-4 w-auto" />
            </div>
            <div className="px-5 pt-4">
              <div className="flex items-start gap-3">
                <span
                  className="icon-badge h-9 w-9 shrink-0"
                  style={pending.danger ? { background: 'rgba(237,28,36,0.12)', color: 'var(--color-brand-red)' } : undefined}
                >
                  <Icon name={pending.danger ? 'alert-triangle' : 'help-circle'} size={18} />
                </span>
                <div>
                  <p className="font-bold text-ink">{pending.title ?? (pending.danger ? 'Confirmar exclusão' : 'Confirmar ação')}</p>
                  <p className="mt-1 text-sm text-ink-soft">{pending.message}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4">
              <button
                onClick={() => settle(false)}
                className="rounded-full bg-navy-light px-4 py-2 text-sm font-semibold text-navy hover:opacity-80"
              >
                {pending.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                onClick={() => settle(true)}
                className={`rounded-full px-4 py-2 text-sm font-bold text-white ${
                  pending.danger ? 'bg-brand-red hover:bg-brand-red-dark' : 'bg-navy hover:bg-navy-dark'
                }`}
              >
                {pending.confirmLabel ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
