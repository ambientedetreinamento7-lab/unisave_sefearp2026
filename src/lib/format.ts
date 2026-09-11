/** Storage keys do Supabase (S3-compatible) rejeitam espaço, acento e
 * outros caracteres fora de [a-zA-Z0-9._-] com "Invalid key" — sanitiza o
 * nome original do arquivo antes de compor o path de upload. */
export function sanitizeFileName(name: string): string {
  const withoutAccents = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return withoutAccents.replace(/[^a-zA-Z0-9._-]/g, '-')
}

/** tracks.carga_horaria_total é armazenado em minutos — formata pra
 * "1h30min" (ou só "45min"/"2h" quando um dos dois lados é zero). */
export function formatCargaHoraria(minutes: number | null): string {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}min`
}

/** pills.duration é texto livre (o admin digita algo como "12 min"), mas
 * às vezes vem só o número puro (ex.: "120", "2") sem unidade — nesse caso
 * interpreta como minutos e formata por extenso ("2 horas", "2 minutos").
 * Texto que já tem qualquer coisa além de dígitos fica como o admin
 * escreveu, sem tentar reformatar. */
export function formatPillDuration(raw: string | null): string {
  if (!raw) return '—'
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return trimmed
  const minutes = parseInt(trimmed, 10)
  if (minutes < 60) return `${minutes} minuto${minutes === 1 ? '' : 's'}`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hoursPart = `${h} hora${h === 1 ? '' : 's'}`
  if (m === 0) return hoursPart
  return `${hoursPart} e ${m} minuto${m === 1 ? '' : 's'}`
}

export function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `há ${hr}h`
  const days = Math.floor(hr / 24)
  return `há ${days}d`
}
