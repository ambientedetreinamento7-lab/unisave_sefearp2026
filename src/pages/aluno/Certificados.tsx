import { toJpeg } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { useEffect, useRef, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { useAuth } from '../../context/AuthContext'
import { applyCertificateVariables } from '../../lib/certificate'
import { awardPoints } from '../../lib/gamification'
import { formatCargaHoraria } from '../../lib/format'
import { getAllTracks, getOrCreateCertificate, getTrackWithPills, getUserProgressMap, trackProgressPct } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { CertificateTemplate, Pill, Track } from '../../types/database'

interface CertificateEntry {
  track: Track
  template: CertificateTemplate | null
  pills: Pill[]
  pct: number
  completedAt: string | null
  code: string | null
}

export function Certificados() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<CertificateEntry[]>([])
  const [openTrackId, setOpenTrackId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function load() {
      const [tracks, progressMap, { data: templatesData }] = await Promise.all([
        getAllTracks(),
        getUserProgressMap(profile!.id),
        supabase.from('certificate_templates').select('*'),
      ])
      const templates = (templatesData as CertificateTemplate[]) ?? []
      const eligible = tracks.filter((t) => t.certificate_enabled)
      const withPills = await Promise.all(eligible.map((t) => getTrackWithPills(t.id)))
      if (cancelled) return

      const list: CertificateEntry[] = withPills.map(({ track, pills }, i) => {
        const completedDates = pills
          .map((p) => progressMap[p.id]?.completed_at)
          .filter((d): d is string => !!d)
        const completedAt = completedDates.length
          ? completedDates.sort().at(-1)!
          : null
        const resolvedTrack = track ?? eligible[i]
        return {
          track: resolvedTrack,
          template: templates.find((t) => t.id === resolvedTrack.certificate_template_id) ?? null,
          pills,
          pct: trackProgressPct(pills, progressMap),
          completedAt,
          code: null,
        }
      })

      setEntries(list)
      setLoading(false)

      for (const entry of list) {
        if (entry.pct === 100 && entry.pills.length > 0) {
          await awardPoints(profile!.id, 'certificate_earned', entry.track.id)
          const cert = await getOrCreateCertificate(
            profile!.id,
            entry.track.id,
            profile!.name,
            entry.track.title,
            entry.completedAt,
          )
          if (cancelled || !cert) continue
          setEntries((prev) => prev.map((e) => (e.track.id === entry.track.id ? { ...e, code: cert.code } : e)))
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader />
        <p className="p-8 text-center text-ink-soft">Carregando…</p>
      </div>
    )
  }

  const earned = entries.filter((e) => e.pct === 100 && e.pills.length > 0)
  const inProgress = entries.filter((e) => !(e.pct === 100 && e.pills.length > 0))
  const openEntry = entries.find((e) => e.track.id === openTrackId) ?? null

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">Certificados</h1>
        <p className="mt-1 text-ink-soft">Seus certificados de conclusão — visualize e compartilhe nas redes sociais.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {earned.map((entry) => (
            <button
              key={entry.track.id}
              onClick={() => setOpenTrackId(entry.track.id)}
              className="card overflow-hidden text-left transition hover:card-highlight"
            >
              <div
                className="flex aspect-[1400/895] w-full items-center justify-center bg-cover bg-center p-4"
                style={
                  entry.template?.background_url
                    ? { backgroundImage: `url(${entry.template.background_url})` }
                    : { background: 'linear-gradient(135deg,#1A3B6E,#373896)' }
                }
              >
                {!entry.template?.background_url && <span className="text-3xl">🏆</span>}
              </div>
              <div className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-success">Concluído</p>
                <h3 className="mt-0.5 font-bold text-ink">{entry.track.title}</h3>
              </div>
            </button>
          ))}
          {earned.length === 0 && (
            <p className="col-span-full text-ink-soft">
              Nenhum certificado conquistado ainda — conclua 100% de um curso com certificado habilitado.
            </p>
          )}
        </div>

        {inProgress.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-ink">Em andamento</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {inProgress.map((entry) => (
                <div key={entry.track.id} className="card flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-navy-light text-lg text-ink-soft">
                    🔒
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{entry.track.title}</p>
                    <p className="text-xs text-ink-soft">{entry.pct}% concluído</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {openEntry && profile && (
        <CertificateModal entry={openEntry} studentName={profile.name} onClose={() => setOpenTrackId(null)} />
      )}
    </div>
  )
}

function CertificateFace({
  template,
  html,
  code,
}: {
  template: CertificateTemplate | null
  html: string
  code: string | null
}) {
  return (
    <div
      className="relative flex aspect-[1400/895] w-full items-center justify-center bg-cover bg-center p-10 text-center"
      style={
        template?.background_url
          ? { backgroundImage: `url(${template.background_url})`, backgroundColor: '#fff' }
          : { background: 'linear-gradient(135deg,#1A3B6E,#373896)', color: '#fff' }
      }
    >
      <div className="max-w-lg text-base font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
      {code && (
        <p className="absolute bottom-3 right-4 text-[10px] font-semibold uppercase tracking-wide opacity-70">
          Código de verificação: {code}
        </p>
      )}
    </div>
  )
}

function SyllabusBlock({ trackTitle, html }: { trackTitle: string; html: string }) {
  return (
    <div className="bg-white p-16 text-ink">
      <p className="text-xs font-bold uppercase tracking-wide text-navy">Conteúdo Programático</p>
      <h2 className="mt-1 text-2xl font-extrabold text-ink">{trackTitle}</h2>
      <div className="mt-6 text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

function CertificateModal({
  entry,
  studentName,
  onClose,
}: {
  entry: CertificateEntry
  studentName: string
  onClose: () => void
}) {
  const verifyUrl = entry.code ? `${window.location.origin}/validar-certificado?codigo=${entry.code}` : null
  const certRef = useRef<HTMLDivElement>(null)
  const syllabusRef = useRef<HTMLDivElement>(null)
  const combinedRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [shareError, setShareError] = useState('')

  const samePage = entry.track.certificate_syllabus_same_page && !!entry.track.conteudo_programatico

  const html = applyCertificateVariables(
    entry.template?.message || 'Certificamos que {NOME_COMPLETO} concluiu o curso {NOME_DO_CURSO}.',
    {
      nomeCompleto: studentName,
      nomeDoCurso: entry.track.title,
      cargaHorariaCurso: formatCargaHoraria(entry.track.carga_horaria_total),
      dataConclusao: entry.completedAt
        ? new Date(entry.completedAt).toLocaleDateString('pt-BR')
        : new Date().toLocaleDateString('pt-BR'),
    },
  )

  // Carrega a imagem numa <img> só pra ler as dimensões reais em pixel do
  // JPEG gerado (toJpeg não devolve isso) — o jsPDF usa esse tamanho exato
  // como tamanho da página (unit: 'px'), sem precisar converter pra mm.
  function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = reject
      img.src = dataUrl
    })
  }

  // JPEG em vez de PNG: pro tipo de conteúdo aqui (fundo + texto, não
  // wireframe/ícones) o PNG (sem perdas) gerava um PDF bem mais pesado do
  // que precisa — JPEG com qualidade alta fica visualmente igual e reduz
  // bastante o tamanho do arquivo final.
  async function capture(node: HTMLElement) {
    const dataUrl = await toJpeg(node, { pixelRatio: 3, backgroundColor: '#ffffff', quality: 0.92 })
    const size = await loadImageSize(dataUrl)
    return { dataUrl, size }
  }

  async function renderPdfBlob(): Promise<Blob | null> {
    if (!certRef.current) return null

    if (samePage && combinedRef.current) {
      const combined = await capture(combinedRef.current)
      const pdf = new jsPDF({
        unit: 'px',
        format: [combined.size.width, combined.size.height],
        orientation: combined.size.width >= combined.size.height ? 'landscape' : 'portrait',
        compress: true,
      })
      pdf.addImage(combined.dataUrl, 'JPEG', 0, 0, combined.size.width, combined.size.height)
      return pdf.output('blob')
    }

    const cert = await capture(certRef.current)
    const pdf = new jsPDF({
      unit: 'px',
      format: [cert.size.width, cert.size.height],
      orientation: cert.size.width >= cert.size.height ? 'landscape' : 'portrait',
      compress: true,
    })
    pdf.addImage(cert.dataUrl, 'JPEG', 0, 0, cert.size.width, cert.size.height)

    if (entry.track.conteudo_programatico && syllabusRef.current) {
      const syllabus = await capture(syllabusRef.current)
      pdf.addPage([syllabus.size.width, syllabus.size.height], syllabus.size.width >= syllabus.size.height ? 'landscape' : 'portrait')
      pdf.addImage(syllabus.dataUrl, 'JPEG', 0, 0, syllabus.size.width, syllabus.size.height)
    }

    return pdf.output('blob')
  }

  async function handleDownload() {
    setDownloading(true)
    setShareError('')
    try {
      const blob = await renderPdfBlob()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `certificado-${entry.track.title.toLowerCase().replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setShareError('Não foi possível gerar o PDF do certificado.')
    }
    setDownloading(false)
  }

  async function handleShare() {
    setDownloading(true)
    setShareError('')
    try {
      const blob = await renderPdfBlob()
      if (!blob) return
      const file = new File([blob], `certificado-${entry.track.title}.pdf`, { type: 'application/pdf' })
      const shareText = `Concluí o curso "${entry.track.title}"! 🎓`
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: 'Meu certificado', text: shareText })
      } else {
        await handleDownload()
        setShareError('Compartilhamento direto não é suportado neste navegador — o PDF foi baixado, poste manualmente.')
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setShareError('Não foi possível compartilhar o certificado.')
      }
    }
    setDownloading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">{entry.track.title}</h3>
          <button onClick={onClose} className="text-sm font-medium text-ink-soft hover:text-navy">
            Fechar
          </button>
        </div>

        {/* Moldura só pra tela — não faz parte do que é capturado, senão a
            imagem baixada/compartilhada saía com borda arredondada de UI,
            como print de tela em vez de um certificado de verdade. */}
        <div className="mt-4 overflow-hidden rounded-xl border border-navy-light shadow-sm">
          <div ref={certRef}>
            <CertificateFace template={entry.template} html={html} code={entry.code} />
          </div>
        </div>

        {entry.code && (
          <p className="mt-3 text-xs text-ink-soft">
            Autenticidade verificável em{' '}
            <a href={verifyUrl!} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:underline">
              {verifyUrl}
            </a>
          </p>
        )}

        {entry.track.conteudo_programatico && (
          <p className="mt-2 text-xs text-ink-soft">
            {samePage
              ? 'O PDF gerado inclui o conteúdo programático deste curso logo abaixo do certificado, na mesma página.'
              : 'O PDF gerado inclui uma 2ª página com o conteúdo programático deste curso.'}
          </p>
        )}

        {/* Fora da tela de propósito — só existe pro html-to-image conseguir
            capturar o conteúdo programático (junto ou separado do
            certificado, conforme configurado no curso), sem aparecer na
            pré-visualização acima. */}
        {entry.track.conteudo_programatico && !samePage && (
          <div className="fixed left-[-9999px] top-0" aria-hidden="true">
            <div ref={syllabusRef} className="w-[1000px]">
              <SyllabusBlock trackTitle={entry.track.title} html={entry.track.conteudo_programatico} />
            </div>
          </div>
        )}
        {entry.track.conteudo_programatico && samePage && (
          <div className="fixed left-[-9999px] top-0" aria-hidden="true">
            <div ref={combinedRef} className="w-[1400px]">
              <CertificateFace template={entry.template} html={html} code={entry.code} />
              <SyllabusBlock trackTitle={entry.track.title} html={entry.track.conteudo_programatico} />
            </div>
          </div>
        )}

        {shareError && <p className="mt-3 text-sm text-brand-red">{shareError}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
          >
            {downloading ? 'Gerando…' : 'Baixar PDF'}
          </button>
          <button
            onClick={handleShare}
            disabled={downloading}
            className="rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            Compartilhar
          </button>
        </div>
      </div>
    </div>
  )
}
