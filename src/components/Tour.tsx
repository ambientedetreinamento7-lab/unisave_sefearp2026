import { useEffect, useState } from 'react'
import { Icon } from './Icon'

export type TourStep = {
  /** CSS selector do elemento a destacar. Omitido = card centralizado
   * (passo de boas-vindas/conclusão, sem elemento específico). */
  target?: string
  title: string
  body: string
  /** Roda antes de medir a posição do alvo — usa pra trocar de aba/rolar
   * a página até o elemento existir no DOM. */
  onEnter?: () => void
}

const CARD_WIDTH = 340
const CARD_MARGIN = 16

export function Tour({
  steps,
  onFinish,
  laterHint,
}: {
  steps: TourStep[]
  onFinish: (completed: boolean) => void
  /** Onde o aluno pode refazer esse tutorial depois, ex.: "no menu do seu
   * avatar, em Tutorial de navegação". Mostrado ao pular/sair. */
  laterHint: string
}) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [skipping, setSkipping] = useState(false)
  const step = steps[index]

  useEffect(() => {
    let cancelled = false
    step.onEnter?.()
    const raf1 = requestAnimationFrame(() => {
      const el = step.target ? document.querySelector(step.target) : null
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      requestAnimationFrame(() => {
        if (!cancelled) setRect(el ? el.getBoundingClientRect() : null)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    function recompute() {
      if (!step.target) return
      const el = document.querySelector(step.target)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  if (skipping) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
        <div className="card w-full max-w-sm p-6 text-center">
          <p className="text-3xl">👋</p>
          <h3 className="mt-2 text-lg font-bold text-ink">Tudo bem!</h3>
          <p className="mt-1 text-sm text-ink-soft">Você pode refazer este tutorial quando quiser, {laterHint}.</p>
          <button
            onClick={() => onFinish(false)}
            className="mt-5 w-full rounded-xl bg-navy py-2.5 font-bold text-white hover:bg-navy-dark"
          >
            Entendi
          </button>
        </div>
      </div>
    )
  }

  const isFirst = index === 0
  const isLast = index === steps.length - 1

  function next() {
    if (isLast) onFinish(true)
    else setIndex((i) => i + 1)
  }

  let cardStyle: React.CSSProperties | null = null
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow > 220 ? rect.bottom + 14 : Math.max(CARD_MARGIN, rect.top - 14 - 220)
    const idealLeft = rect.left + rect.width / 2 - CARD_WIDTH / 2
    const left = Math.min(Math.max(idealLeft, CARD_MARGIN), window.innerWidth - CARD_WIDTH - CARD_MARGIN)
    cardStyle = { top, left, width: CARD_WIDTH }
  }

  return (
    <>
      <div className="fixed inset-0 z-[190]" />
      {rect ? (
        <div
          className="pointer-events-none fixed z-[190] rounded-xl transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(15,23,42,0.65)',
          }}
        />
      ) : (
        <div className="fixed inset-0 z-[190] bg-black/60" />
      )}

      <div
        className={`card fixed z-[200] p-5 transition-all duration-300 ${rect ? '' : 'inset-0 m-auto flex h-fit max-w-sm flex-col items-center p-8 text-center'}`}
        style={rect ? cardStyle! : { width: `calc(100% - ${CARD_MARGIN * 2}px)` }}
      >
        <button
          onClick={() => setSkipping(true)}
          aria-label="Pular tutorial"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-bg hover:text-ink"
        >
          <Icon name="x" size={15} />
        </button>

        {!rect && <p className="text-4xl">👋</p>}
        <h3 className={`pr-6 font-bold text-ink ${rect ? 'text-base' : 'mt-2 text-xl'}`}>{step.title}</h3>
        <p className={`text-ink-soft ${rect ? 'mt-2 text-sm' : 'mt-2 text-sm'}`}>{step.body}</p>

        <div className={`mt-5 flex w-full items-center justify-between gap-2 ${rect ? '' : 'flex-col gap-3'}`}>
          <span className="shrink-0 text-xs font-semibold text-ink-soft">
            Passo {index + 1} de {steps.length}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {!isFirst && (
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-bg"
              >
                Voltar
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-1.5 rounded-full bg-brand-red px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-red-dark"
            >
              {isLast ? 'Concluir' : 'Próximo'}
              <Icon name="arrow-right" size={12} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
