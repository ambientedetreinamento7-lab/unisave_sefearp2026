/** auth.users guarda o e-mail sempre em minúsculas (GoTrue normaliza) —
 * sem aplicar o mesmo aqui antes de mandar pra qualquer RPC/chamada de
 * auth, "Ana@x.com" e "ana@x.com" viram duas contas/leads diferentes em
 * vez de uma só (spec: mesmo e-mail nunca pode virar mais de uma conta). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Storage keys do Supabase (S3-compatible) rejeitam espaço, acento e
 * outros caracteres fora de [a-zA-Z0-9._-] com "Invalid key" — sanitiza o
 * nome original do arquivo antes de compor o path de upload. */
export function sanitizeFileName(name: string): string {
  const withoutAccents = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return withoutAccents.replace(/[^a-zA-Z0-9._-]/g, '-')
}

// Zero-width space/joiner, marcas de direção, seletores de variação, BOM —
// construído por código de caractere (em vez de um literal \uXXXX no
// regex) porque colar o próprio caractere invisível no arquivo-fonte
// quebra a ferramenta de edição (ela não enxerga o caractere, então não
// consegue casar a string de novo numa edição seguinte).
const INVISIBLE_CHAR_CODES = [
  0x200b, 0x200c, 0x200d, 0x200e, 0x200f, // zero-width space/joiner/marcas de direção
  0x2028, 0x2029, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x202f, // separadores/formatação direcional
  0xfe00, 0xfe01, 0xfe02, 0xfe03, 0xfe04, 0xfe05, 0xfe06, 0xfe07, 0xfe08, 0xfe09, 0xfe0a,
  0xfe0b, 0xfe0c, 0xfe0d, 0xfe0e, 0xfe0f, // seletores de variação
  0xfeff, // BOM / zero-width no-break space
]
const INVISIBLE_CHARS_PATTERN = new RegExp(`[${INVISIBLE_CHAR_CODES.map((c) => String.fromCharCode(c)).join('')}]`, 'g')

/** Remove caracteres Unicode invisíveis que às vezes acabam colados sem
 * querer num campo de texto editado pelo admin (ex.: copiado de um emoji
 * picker ou de outro app/WhatsApp). Na maioria dos dispositivos esses
 * caracteres ficam invisíveis, mas em fontes mais limitadas (alguns
 * Android/MIUI) aparecem como um glifo quebrado — às vezes bem parecido
 * com uma cruz — no meio ou no lugar do texto. Usar ao exibir texto curto
 * vindo do admin (rótulos, nomes de nível etc.).
 */
export function sanitizeDisplayText(text: string): string {
  return text.replace(INVISIBLE_CHARS_PATTERN, '').trim()
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
