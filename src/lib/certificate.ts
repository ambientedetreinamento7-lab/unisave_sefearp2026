export interface CertificateVariables {
  nomeCompleto: string
  nomeDoCurso: string
  cargaHorariaCurso: string
  dataConclusao: string
}

export function applyCertificateVariables(html: string, vars: CertificateVariables): string {
  return html
    .replaceAll('{NOME_COMPLETO}', vars.nomeCompleto)
    .replaceAll('{NOME_DO_CURSO}', vars.nomeDoCurso)
    .replaceAll('{CARGA_HORARIA_CURSO}', vars.cargaHorariaCurso)
    .replaceAll('{DATA_CONCLUSAO}', vars.dataConclusao)
}

// Sem 0/O e 1/I/L — evita confusão na digitação manual (mesma dica que a
// própria tela de validação exibe pro aluno).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateCertificateCode(): string {
  const block = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('')
  return `${block()}-${block()}`
}
