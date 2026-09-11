// gamification_levels.badge_icon guarda ou um emoji digitado à mão, ou a
// URL de uma imagem/SVG enviada pelo admin — sem coluna nova no banco,
// distingue os dois só olhando o formato do valor.
function isImageUrl(value: string): boolean {
  return /^https?:\/\//.test(value) || /^\//.test(value)
}

export function BadgeIcon({
  icon,
  size = 24,
  className = '',
}: {
  icon: string | null | undefined
  size?: number
  className?: string
}) {
  if (!icon) return null

  if (isImageUrl(icon)) {
    return (
      <img
        src={icon}
        alt=""
        className={`inline-block shrink-0 object-contain align-middle ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span className={`inline-block align-middle leading-none ${className}`} style={{ fontSize: size }}>
      {icon}
    </span>
  )
}
