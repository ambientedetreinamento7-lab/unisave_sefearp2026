import { useState } from 'react'
import { Icon } from './Icon'

/** Ícone de "?" que revela uma explicação num popover ao tocar/clicar —
 * usado pra tirar texto explicativo longo do fluxo principal da página
 * (ex.: nota sobre progresso de SCORM), sem esconder a informação de
 * quem precisar dela. */
export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Mais informações"
        className="flex h-5 w-5 items-center justify-center rounded-full text-ink-soft hover:text-navy"
      >
        <Icon name="help-circle" size={15} />
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
          />
          <div className="card absolute right-0 top-6 z-20 w-64 max-w-[calc(100vw-2rem)] p-3 text-left text-xs font-normal normal-case leading-relaxed text-ink-soft shadow-lg">
            {text}
          </div>
        </>
      )}
    </span>
  )
}
