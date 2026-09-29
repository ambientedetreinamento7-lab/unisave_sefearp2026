import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HeroBrandBar } from '../../components/HeroBrandBar'
import { Icon } from '../../components/Icon'
import { applyCertificateVariables } from '../../lib/certificate'
import { formatCargaHoraria } from '../../lib/format'
import { verifyCertificateByCode } from '../../lib/api'
import type { PublicCertificate } from '../../types/database'

type Result = 'idle' | 'checking' | 'found' | 'not_found'

export function ValidarCertificado() {
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(searchParams.get('codigo') ?? '')
  const [result, setResult] = useState<Result>('idle')
  const [certificate, setCertificate] = useState<PublicCertificate | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  async function verify(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    setResult('checking')
    setPreviewOpen(false)
    const found = await verifyCertificateByCode(trimmed)
    setCertificate(found)
    setResult(found ? 'found' : 'not_found')
  }

  useEffect(() => {
    if (searchParams.get('codigo')) verify(searchParams.get('codigo')!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="hero-gradient min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <HeroBrandBar compact />

        <div className="mt-8 text-center sm:mt-10">
          <span className="glass-pill px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide">
            <Icon name="trophy" size={13} />
            Validação de Certificados
          </span>
          <h1 className="mx-auto mt-5 max-w-lg text-balance text-[clamp(1.6rem,5vw,2.2rem)] font-extrabold leading-[1.15] text-white">
            Confira a autenticidade de um certificado emitido pela UniSave
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/70">
            Informe o código de verificação impresso no certificado. Não é necessário fazer login.
          </p>
        </div>

        <div className="card mt-8 p-6">
          <label className="block text-xs font-semibold text-ink-soft">Código de verificação</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-xl border border-navy-light px-4 py-3 uppercase tracking-widest"
              placeholder="Ex: AB3D-7XQ9"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verify(code)}
            />
            <button
              onClick={() => verify(code)}
              disabled={result === 'checking' || !code.trim()}
              className="rounded-xl bg-brand-red px-6 py-3 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
            >
              {result === 'checking' ? 'Verificando…' : 'Verificar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Dica: o código não usa as letras "O"/"I"/"L" nem os números "0"/"1", para evitar confusão.
          </p>

          {result === 'found' && certificate && (
            <div className="alert-success mt-5 flex items-start gap-3 rounded-xl border p-4">
              <span className="mt-0.5 shrink-0 text-xl">✅</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">Certificado válido</p>
                <p className="mt-1 text-sm text-ink-soft">
                  <strong className="text-ink">{certificate.student_name}</strong> concluiu o curso{' '}
                  <strong className="text-ink">{certificate.track_title}</strong>.
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Emitido em {new Date(certificate.issued_at).toLocaleDateString('pt-BR')}
                  {certificate.completed_at && (
                    <> · concluído em {new Date(certificate.completed_at).toLocaleDateString('pt-BR')}</>
                  )}
                </p>

                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="mt-3 flex w-40 flex-col overflow-hidden rounded-lg border border-navy-light text-left shadow-sm transition hover:shadow-md"
                >
                  <div
                    className="flex aspect-[1400/895] w-full items-center justify-center bg-cover bg-center"
                    style={
                      certificate.template_background_url
                        ? { backgroundImage: `url(${certificate.template_background_url})` }
                        : { background: 'linear-gradient(135deg,#1A3B6E,#373896)' }
                    }
                  >
                    {!certificate.template_background_url && <span className="text-xl">🏆</span>}
                  </div>
                  <span className="bg-surface px-2 py-1.5 text-[11px] font-semibold text-navy">Ver certificado →</span>
                </button>
              </div>
            </div>
          )}

          {result === 'not_found' && (
            <div className="alert-danger mt-5 flex items-start gap-3 rounded-xl border p-4">
              <Icon name="alert-triangle" size={20} className="mt-0.5 shrink-0 text-brand-red" />
              <div>
                <p className="font-bold text-ink">Código não encontrado</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Confira se digitou o código corretamente, respeitando maiúsculas e minúsculas.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {previewOpen && certificate && <CertificatePreviewModal certificate={certificate} onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}

function CertificatePreviewModal({ certificate, onClose }: { certificate: PublicCertificate; onClose: () => void }) {
  const html = applyCertificateVariables(
    certificate.template_message || 'Certificamos que {NOME_COMPLETO} concluiu o curso {NOME_DO_CURSO}.',
    {
      nomeCompleto: certificate.student_name,
      nomeDoCurso: certificate.track_title,
      cargaHorariaCurso: formatCargaHoraria(certificate.carga_horaria_total),
      dataConclusao: certificate.completed_at
        ? new Date(certificate.completed_at).toLocaleDateString('pt-BR')
        : new Date(certificate.issued_at).toLocaleDateString('pt-BR'),
    },
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end pb-2">
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink-soft hover:bg-white"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div
          className="relative flex aspect-[1400/895] w-full items-center justify-center rounded-xl bg-cover bg-center p-10 text-center shadow-2xl"
          style={
            certificate.template_background_url
              ? { backgroundImage: `url(${certificate.template_background_url})`, backgroundColor: '#fff' }
              : { background: 'linear-gradient(135deg,#1A3B6E,#373896)', color: '#fff' }
          }
        >
          <div className="max-w-lg text-base font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  )
}
