/** Repete uma chamada de rede com backoff exponencial quando o erro é
 * transitório (rate limit, erro 5xx, ou falha de rede) — pensado pro
 * cadastro do /estande, onde um pico de gente se cadastrando ao mesmo
 * tempo no dia do evento pode esbarrar num rate limit momentâneo do
 * Supabase Auth em vez de um erro definitivo. Não repete erros de
 * validação (4xx que não seja 429), que nunca vão dar certo de novo. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelayMs = 800 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === retries || !isRetryableError(err)) throw err
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 200
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  if (status === 429) return true
  if (typeof status === 'number' && status >= 500) return true
  // fetch falhando de vez (queda momentânea de rede/DNS) lança TypeError,
  // sem status nenhum — vale tentar de novo.
  if (err instanceof TypeError) return true
  return false
}

/** true quando o erro é especificamente um rate limit (status 429) — usado
 * pra dar uma mensagem melhor no lugar do texto cru do Supabase. */
export function isRateLimitError(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 429
}
