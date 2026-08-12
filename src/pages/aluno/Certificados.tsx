import { toPng } from 'html-to-image'
import { useEffect, useRef, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { useAuth } from '../../context/AuthContext'
import { applyCertificateVariables } from '../../lib/certificate'
import { awardPoints } from '../../lib/gamification'
import { getAllTracks, getOrCreateCertificate, getTrackWithPills, getUserProgressMap, trackProgressPct } from '../../lib/api'
import type { Pill, Track } from '../../types/database'

interface CertificateEntry {
  track: Track
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
      const [tracks, progressMap] = await Promise.all([getAllTracks(), getUserProgressMap(profile!.id)])
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
        return { track: track ?? eligible[i], pills, pct: trackProgressPct(pills, progressMap), completedAt, code: null }
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
                  entry.track.certificate_background_url
                    ? { backgroundImage: `url(${entry.track.certificate_background_url})` }
                    : { background: 'linear-gradient(135deg,#1A3B6E,#373896)' }
                }
              >
                {!entry.track.certificate_background_url && <span className="text-3xl">🏆</span>}
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
  const [downloading, setDownloading] = useState(false)
  const [shareError, setShareError] = useState('')

  const html = applyCertificateVariables(
    entry.track.certificate_message || 'Certificamos que {NOME_COMPLETO} concluiu o curso {NOME_DO_CURSO}.',
    {
      nomeCompleto: studentName,
      nomeDoCurso: entry.track.title,
      cargaHorariaCurso: String(entry.track.carga_horaria_total ?? '—'),
      dataConclusao: entry.completedAt
        ? new Date(entry.completedAt).toLocaleDateString('pt-BR')
        : new Date().toLocaleDateString('pt-BR'),
    },
  )

  async function renderImage(): Promise<Blob | null> {
    if (!certRef.current) return null
    const dataUrl = await toPng(certRef.current, { pixelRatio: 2 })
    const res = await fetch(dataUrl)
    return res.blob()
  }

  async function handleDownload() {
    setDownloading(true)
    setShareError('')
    try {
      const blob = await renderImage()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `certificado-${entry.track.title.toLowerCase().replace(/\s+/g, '-')}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setShareError('Não foi possível gerar a imagem do certificado.')
    }
    setDownloading(false)
  }

  async function handleShare() {
    setDownloading(true)
    setShareError('')
    try {
      const blob = await renderImage()
      if (!blob) return
      const file = new File([blob], `certificado-${entry.track.title}.png`, { type: 'image/png' })
      const shareText = `Concluí o curso "${entry.track.title}"! 🎓`
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: 'Meu certificado', text: shareText })
      } else {
        await handleDownload()
        setShareError('Compartilhamento direto não é suportado neste navegador — a imagem foi baixada, poste manualmente.')
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

        <div
          ref={certRef}
          className="relative mt-4 flex aspect-[1400/895] w-full items-center justify-center overflow-hidden rounded-xl border border-navy-light bg-cover bg-center p-8 text-center"
          style={
            entry.track.certificate_background_url
              ? { backgroundImage: `url(${entry.track.certificate_background_url})`, backgroundColor: '#fff' }
              : { background: 'linear-gradient(135deg,#1A3B6E,#373896)', color: '#fff' }
          }
        >
          <div className="max-w-lg text-sm font-medium" dangerouslySetInnerHTML={{ __html: html }} />
          {entry.code && (
            <p className="absolute bottom-3 right-4 text-[10px] font-semibold uppercase tracking-wide opacity-70">
              Código de verificação: {entry.code}
            </p>
          )}
        </div>

        {entry.code && (
          <p className="mt-3 text-xs text-ink-soft">
            Autenticidade verificável em{' '}
            <a href={verifyUrl!} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:underline">
              {verifyUrl}
            </a>
          </p>
        )}

        {shareError && <p className="mt-3 text-sm text-brand-red">{shareError}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
          >
            {downloading ? 'Gerando…' : 'Baixar imagem'}
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
