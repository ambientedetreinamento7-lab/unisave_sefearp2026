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
  const [showTrackForm, setShowTrackForm] = useState(false)
  const [showPillForm, setShowPillForm] = useState<string | null>(null)

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
          onClick={() => setShowTrackForm(true)}
          className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark"
        >
          + Nova trilha
        </button>
      </div>

      <div className="space-y-4">
        {tracks.map((track) => (
          <div key={track.id} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-ink">{track.title}</h3>
                <p className="text-xs text-ink-soft">
                  {programs.find((p) => p.id === track.program_id)?.name} · {track.diagnostic_profile}
                </p>
              </div>
              <button
                onClick={() => setShowPillForm(track.id)}
                className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
              >
                + Pílula
              </button>
            </div>
            <div className="mt-3 space-y-1">
              {pills
                .filter((p) => p.track_id === track.id)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm">
                    <span className="font-medium text-ink">{p.title}</span>
                    <span className="text-xs uppercase text-ink-soft">{p.content_type}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {tracks.length === 0 && <p className="text-ink-soft">Nenhuma trilha cadastrada ainda.</p>}
      </div>

      {showTrackForm && (
        <TrackFormModal programs={programs} onClose={() => setShowTrackForm(false)} onSaved={() => { setShowTrackForm(false); reload() }} />
      )}
      {showPillForm && (
        <PillFormModal trackId={showPillForm} onClose={() => setShowPillForm(null)} onSaved={() => { setShowPillForm(null); reload() }} />
      )}
    </AdminLayout>
  )
}

function TrackFormModal({ programs, onClose, onSaved }: { programs: Program[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [programId, setProgramId] = useState(programs[0]?.id ?? '')
  const [profile, setProfile] = useState<DiagnosticProfile>('autogestao')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('tracks').insert({ title, description, program_id: programId, diagnostic_profile: profile })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md space-y-3 p-6">
        <h3 className="text-lg font-bold text-ink">Nova trilha</h3>
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
        <select className="w-full rounded-xl border border-navy-light px-4 py-3" value={programId} onChange={(e) => setProgramId(e.target.value)}>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="w-full rounded-xl border border-navy-light px-4 py-3" value={profile} onChange={(e) => setProfile(e.target.value as DiagnosticProfile)}>
          <option value="autogestao">Autogestão</option>
          <option value="tech_ia">Tech & IA</option>
          <option value="lideranca">Liderança</option>
        </select>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">Cancelar</button>
          <button onClick={save} disabled={saving || !title} className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white disabled:opacity-60">Salvar</button>
        </div>
      </div>
    </div>
  )
}

function PillFormModal({ trackId, onClose, onSaved }: { trackId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [axis, setAxis] = useState('')
  const [duration, setDuration] = useState('')
  const [contentType, setContentType] = useState<ContentType>('video')
  const [contentUrl, setContentUrl] = useState('')
  const [scormFile, setScormFile] = useState<File | null>(null)
  const [manifestPath, setManifestPath] = useState('index_lms.html')
  const [uploadPct, setUploadPct] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    let scormPackageUrl: string | null = null

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
          const blob = await entry.async('blob')
          const { error: uploadError } = await supabase.storage
            .from('scorm-packages')
            .upload(`${packageId}/${entry.name}`, blob, {
              upsert: true,
              contentType: guessContentType(entry.name),
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

    const { error: insertError } = await supabase.from('pills').insert({
      track_id: trackId,
      title,
      axis,
      duration,
      content_type: contentType,
      content_url: contentType !== 'scorm' ? contentUrl : null,
      scorm_package_url: contentType === 'scorm' ? scormPackageUrl : null,
      scorm_manifest_path: contentType === 'scorm' ? manifestPath : null,
    })
    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md space-y-3 p-6">
        <h3 className="text-lg font-bold text-ink">Nova pílula</h3>
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Eixo temático" value={axis} onChange={(e) => setAxis(e.target.value)} />
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
            <input type="file" accept=".zip" onChange={(e) => setScormFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
            <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Arquivo de entrada (ex: index_lms.html — veja o imsmanifest.xml do pacote)" value={manifestPath} onChange={(e) => setManifestPath(e.target.value)} />
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
