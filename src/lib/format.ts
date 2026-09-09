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
