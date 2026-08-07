import JSZip from 'jszip'
import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'
import type { ContentType, DiagnosticProfile, Pill, Program, Track } from '../../types/database'

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  js: 'text/javascript',
  css: 'text/css',
  xml: 'application/xml',
  json: 'application/json',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  swf: 'application/x-shockwave-flash',
}

function guessContentType(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream'
}

export function AdminTrilhas() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [pills, setPills] = useState<Pill[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [trackForm, setTrackForm] = useState<Track | 'new' | null>(null)
  const [pillForm, setPillForm] = useState<{ trackId: string; pill: Pill | null } | null>(null)

  async function deletePill(id: string) {
    if (!confirm('Remover esta pílula? Isso também apaga o progresso dos alunos nela.')) return
    await supabase.from('pills').delete().eq('id', id)
    reload()
  }

  async function reload() {
    const [{ data: t }, { data: p }, { data: prog }] = await Promise.all([
      supabase.from('tracks').select('*'),
      supabase.from('pills').select('*'),
      supabase.from('programs').select('*'),
    ])
    setTracks((t as Track[]) ?? [])
    setPills((p as Pill[]) ?? [])
    setPrograms((prog as Program[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setTrackForm('new')}
          className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark"
        >
          + Novo curso
        </button>
      </div>

      <div className="space-y-4">
        {tracks.map((track) => (
          <div key={track.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-ink">{track.title}</h3>
                <p className="text-xs text-ink-soft">
                  {programs.find((p) => p.id === track.program_id)?.name} · {track.diagnostic_profile}
                  {track.carga_horaria_total != null && <> · {track.carga_horaria_total}h</>}
                  {track.certificate_enabled && <> · 🎓 emite certificado</>}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setTrackForm(track)}
                  className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
                >
                  Editar
                </button>
                <button
                  onClick={() => setPillForm({ trackId: track.id, pill: null })}
                  className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
                >
                  + Pílula
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {pills
                .filter((p) => p.track_id === track.id)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
                    <span className="font-medium text-ink">
                      {p.title}
                      {p.axis && <span className="ml-2 text-xs font-normal text-ink-soft">({p.axis})</span>}
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs uppercase text-ink-soft">{p.content_type}</span>
                      <button
                        onClick={() => setPillForm({ trackId: track.id, pill: p })}
                        className="text-xs font-semibold text-navy hover:underline"
                      >
                        Editar
                      </button>
                      <button onClick={() => deletePill(p.id)} className="text-xs font-semibold text-brand-red hover:underline">
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              {pills.filter((p) => p.track_id === track.id).length === 0 && (
                <p className="text-sm text-ink-soft">Nenhuma pílula cadastrada neste curso ainda.</p>
              )}
            </div>
          </div>
        ))}
        {tracks.length === 0 && <p className="text-ink-soft">Nenhum curso cadastrado ainda.</p>}
      </div>

      {trackForm && (
        <TrackFormModal
          track={trackForm === 'new' ? null : trackForm}
          programs={programs}
          onClose={() => setTrackForm(null)}
          onSaved={() => { setTrackForm(null); reload() }}
        />
      )}
      {pillForm && (
        <PillFormModal
          trackId={pillForm.trackId}
          pill={pillForm.pill}
          onClose={() => setPillForm(null)}
          onSaved={() => { setPillForm(null); reload() }}
        />
      )}
    </AdminLayout>
  )
}

function TrackFormModal({
  track,
  programs,
  onClose,
  onSaved,
}: {
  track: Track | null
  programs: Program[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(track?.title ?? '')
  const [description, setDescription] = useState(track?.description ?? '')
  const [objetivoGeral, setObjetivoGeral] = useState(track?.objetivo_geral ?? '')
  const [publicoAlvo, setPublicoAlvo] = useState(track?.publico_alvo ?? '')
  const [preRequisitos, setPreRequisitos] = useState(track?.pre_requisitos ?? '')
  const [cargaHoraria, setCargaHoraria] = useState(track?.carga_horaria_total?.toString() ?? '')
  const [certificateEnabled, setCertificateEnabled] = useState(track?.certificate_enabled ?? false)
  const [programId, setProgramId] = useState(track?.program_id ?? programs[0]?.id ?? '')
  const [profile, setProfile] = useState<DiagnosticProfile>(track?.diagnostic_profile ?? 'autogestao')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const payload = {
      title,
      description,
      objetivo_geral: objetivoGeral || null,
      publico_alvo: publicoAlvo || null,
      pre_requisitos: preRequisitos || null,
      carga_horaria_total: cargaHoraria ? Number(cargaHoraria) : null,
      certificate_enabled: certificateEnabled,
      program_id: programId,
      diagnostic_profile: profile,
    }
    const { error: saveError } = track
      ? await supabase.from('tracks').update(payload).eq('id', track.id)
      : await supabase.from('tracks').insert(payload)
    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-h-[85vh] w-full max-w-lg space-y-3 overflow-y-auto p-6">
        <h3 className="text-lg font-bold text-ink">{track ? 'Editar curso' : 'Novo curso'}</h3>

        <label className="block text-xs font-semibold text-ink-soft">Nome do curso</label>
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Nome do curso" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="block text-xs font-semibold text-ink-soft">Descrição curta</label>
        <textarea className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Descrição curta (aparece no catálogo)" value={description} onChange={(e) => setDescription(e.target.value)} />

        <label className="block text-xs font-semibold text-ink-soft">Objetivo geral</label>
        <textarea className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="O que o aluno vai alcançar ao concluir o curso" value={objetivoGeral} onChange={(e) => setObjetivoGeral(e.target.value)} />

        <label className="block text-xs font-semibold text-ink-soft">Público-alvo</label>
        <textarea className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Para quem é este curso" value={publicoAlvo} onChange={(e) => setPublicoAlvo(e.target.value)} />

        <label className="block text-xs font-semibold text-ink-soft">Pré-requisitos</label>
        <textarea className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Conhecimentos ou cursos necessários antes deste (opcional)" value={preRequisitos} onChange={(e) => setPreRequisitos(e.target.value)} />

        <label className="block text-xs font-semibold text-ink-soft">Carga horária total (horas)</label>
        <input
          type="number"
          min={0}
          className="w-full rounded-xl border border-navy-light px-4 py-3"
          placeholder="Ex: 40"
          value={cargaHoraria}
          onChange={(e) => setCargaHoraria(e.target.value)}
        />

        <select className="w-full rounded-xl border border-navy-light px-4 py-3" value={programId} onChange={(e) => setProgramId(e.target.value)}>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="w-full rounded-xl border border-navy-light px-4 py-3" value={profile} onChange={(e) => setProfile(e.target.value as DiagnosticProfile)}>
          <option value="autogestao">Autogestão</option>
          <option value="tech_ia">Tech & IA</option>
          <option value="lideranca">Liderança</option>
        </select>

        <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
          <input type="checkbox" checked={certificateEnabled} onChange={(e) => setCertificateEnabled(e.target.checked)} />
          Emite certificado ao concluir 100% das pílulas do curso
        </label>

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">Cancelar</button>
          <button onClick={save} disabled={saving || !title} className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PillFormModal({
  trackId,
  pill,
  onClose,
  onSaved,
}: {
  trackId: string
  pill: Pill | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(pill?.title ?? '')
  const [axis, setAxis] = useState(pill?.axis ?? '')
  const [duration, setDuration] = useState(pill?.duration ?? '')
  const [contentType, setContentType] = useState<ContentType>(pill?.content_type ?? 'video')
  const [contentUrl, setContentUrl] = useState(pill?.content_url ?? '')
  const [scormFile, setScormFile] = useState<File | null>(null)
  const [manifestPath, setManifestPath] = useState(pill?.scorm_manifest_path ?? 'index.html')
  const [uploadPct, setUploadPct] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    // Editing without picking a new .zip keeps whatever package is already
    // uploaded — only swap it out when the admin explicitly selects a file.
    let scormPackageUrl: string | null = pill?.scorm_package_url ?? null

    if (contentType === 'scorm' && scormFile) {
      try {
        // Extract the .zip client-side and upload every entry as its own
        // object under scorm-packages/{packageId}/ — the player needs real
        // files (html/js/css/xml) at that path, not the zip itself.
        const zip = await JSZip.loadAsync(scormFile)
        const entries = Object.values(zip.files).filter((f) => !f.dir)
        if (entries.length === 0) throw new Error('O arquivo .zip está vazio.')

        const packageId = crypto.randomUUID()
        let uploaded = 0
        for (const entry of entries) {
          const raw = await entry.async('blob')
          const mime = guessContentType(entry.name)
          // JSZip hands back blobs with no MIME type set on the Blob itself
          // (only application/octet-stream implied) — some supabase-js
          // versions read the type off the Blob instead of the `contentType`
          // option below, so it has to be baked in here too or html/js/css
          // land in storage as octet-stream and browsers won't parse them.
          const blob = new Blob([raw], { type: mime })
          const { error: uploadError } = await supabase.storage
            .from('scorm-packages')
            .upload(`${packageId}/${entry.name}`, blob, {
              upsert: true,
              contentType: mime,
            })
          if (uploadError) throw uploadError
          uploaded += 1
          setUploadPct(Math.round((uploaded / entries.length) * 100))
        }

        const { data } = supabase.storage.from('scorm-packages').getPublicUrl(packageId)
        scormPackageUrl = data.publicUrl
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao processar o pacote SCORM.')
        setSaving(false)
        return
      }
    }

    const payload = {
      track_id: trackId,
      title,
      axis,
      duration,
      content_type: contentType,
      content_url: contentType !== 'scorm' ? contentUrl : null,
      scorm_package_url: contentType === 'scorm' ? scormPackageUrl : null,
      scorm_manifest_path: contentType === 'scorm' ? manifestPath : null,
    }
    const { error: saveError } = pill
      ? await supabase.from('pills').update(payload).eq('id', pill.id)
      : await supabase.from('pills').insert(payload)
    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md space-y-3 p-6">
        <h3 className="text-lg font-bold text-ink">{pill ? 'Editar pílula' : 'Nova pílula'}</h3>
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Módulo (nome do bloco/etapa do curso)" value={axis} onChange={(e) => setAxis(e.target.value)} />
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Duração (ex: 12 min)" value={duration} onChange={(e) => setDuration(e.target.value)} />

        <select className="w-full rounded-xl border border-navy-light px-4 py-3" value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)}>
          <option value="video">Vídeo</option>
          <option value="iframe">Iframe / embed</option>
          <option value="scorm">SCORM</option>
        </select>

        {contentType !== 'scorm' && (
          <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="URL do conteúdo" value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} />
        )}

        {contentType === 'scorm' && (
          <>
            {pill?.scorm_package_url && (
              <p className="text-xs text-ink-soft">
                Já existe um pacote enviado. Selecione um novo .zip abaixo só se quiser substituí-lo.
              </p>
            )}
            <input type="file" accept=".zip" onChange={(e) => setScormFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
            <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Arquivo de entrada (ex: index.html — veja o imsmanifest.xml do pacote)" value={manifestPath} onChange={(e) => setManifestPath(e.target.value)} />
            {saving && (
              <div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${uploadPct}%` }} /></div>
                <p className="mt-1 text-xs text-ink-soft">Enviando arquivos do pacote… {uploadPct}%</p>
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">Cancelar</button>
          <button onClick={save} disabled={saving || !title} className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
