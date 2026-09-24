import QrScanner from 'qr-scanner'
import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export function QrScannerModal({
  onDetected,
  onClose,
}: {
  onDetected: (text: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  // Guarda a versão mais recente sem entrar nas deps do efeito abaixo — o
  // pai (AdminBottons) recria essa função a cada re-render dele, e se ela
  // entrar nas deps o efeito reinicia a câmera no meio da negociação de
  // permissão/stream, o que o navegador reporta como "aborted by the user
  // agent" e trava numa tela preta (só acontecia com o modal já aberto).
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  useEffect(() => {
    if (!videoRef.current) return
    let cancelled = false
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        if (!cancelled) {
          onDetectedRef.current(result.data)
          scanner.stop()
        }
      },
      { preferredCamera: 'environment', highlightScanRegion: true },
    )
    scanner.start().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível acessar a câmera.')
    })
    return () => {
      cancelled = true
      scanner.stop()
      scanner.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-sm p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-ink">Escanear QR</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-ink-soft hover:text-ink">
            <Icon name="x" size={18} />
          </button>
        </div>
        {error ? (
          <p className="mt-4 text-sm text-brand-red">{error} Você pode digitar o código manualmente.</p>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="mt-4 aspect-square w-full rounded-xl bg-black object-cover" />
            <p className="mt-2 text-center text-xs text-ink-soft">Aponte a câmera para o QR na tela do aluno.</p>
          </>
        )}
      </div>
    </div>
  )
}
