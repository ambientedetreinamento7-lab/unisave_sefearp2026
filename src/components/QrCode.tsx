import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function QrCode({ value, size = 72, className = '' }: { value: string; size?: number; className?: string }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: size * 3, margin: 1, color: { dark: '#000000', light: '#ffffff' } }).then(
      (url) => {
        if (!cancelled) setDataUrl(url)
      },
    )
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!dataUrl) return <div style={{ width: size, height: size }} className={className} />
  return (
    <img
      src={dataUrl}
      alt="QR code de verificação do certificado"
      width={size}
      height={size}
      className={className}
    />
  )
}
