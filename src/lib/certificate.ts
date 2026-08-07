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
