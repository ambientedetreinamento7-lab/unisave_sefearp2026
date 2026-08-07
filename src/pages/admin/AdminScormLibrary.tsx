import JSZip from 'jszip'
import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'
import type { ScormLibraryItem } from '../../types/database'

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

export function AdminScormLibrary() {
  const [items, setItems] = useState<ScormLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [formItem, setFormItem] = useState<ScormLibraryItem | 'new' | null>(null)

  async function reload() {
    const { data } = await supabase.from('scorm_library').select('*').order('name')
    setItems((data as ScormLibraryItem[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  async function deleteItem(id: string) {
    if (!confirm('Remover este pacote da biblioteca? Pílulas que apontam para ele ficam sem conteúdo até você trocar.')) return
    await supabase.from('scorm_library').delete().eq('id', id)
    reload()
  }

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <p className="mb-4 text-sm text-ink-soft">
        Pacotes SCORM ficam guardados aqui de forma independente das pílulas. Atualizar um pacote aqui atualiza
        automaticamente todas as pílulas que o utilizam.
      </p>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setFormItem('new')}
          className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark"
        >
          + Novo pacote SCORM
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="card flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold text-ink">{item.name}</p>
              <p className="text-xs text-ink-soft">Arquivo de entrada: {item.manifest_path}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setFormItem(item)}
                className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
              >
                Editar
              </button>
              <button onClick={() => deleteItem(item.id)} className="text-xs font-semibold text-brand-red hover:underline">
                Excluir
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-ink-soft">Nenhum pacote SCORM cadastrado ainda.</p>}
      </div>

      {formItem && (
        <ScormFormModal item={formItem === 'new' ? null : formItem} onClose={() => setFormItem(null)} onSaved={() => { setFormItem(null); reload() }} />
      )}
    </AdminLayout>
  )
}

function ScormFormModal({
  item,
  onClose,
  onSaved,
}: {
  item: ScormLibraryItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [manifestPath, setManifestPath] = useState(item?.manifest_path ?? 'index.html')
  const [file, setFile] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    let packageUrl = item?.package_url ?? null

    if (file) {
      try {
        const zip = await JSZip.loadAsync(file)
        const entries = Object.values(zip.files).filter((f) => !f.dir)
        if (entries.length === 0) throw new Error('O arquivo .zip está vazio.')

        const packageId = crypto.randomUUID()
        let uploaded = 0
        for (const entry of entries) {
          const raw = await entry.async('blob')
          const mime = guessContentType(entry.name)
          const blob = new Blob([raw], { type: mime })
          const { error: uploadError } = await supabase.storage
            .from('scorm-packages')
            .upload(`${packageId}/${entry.name}`, blob, { upsert: true, contentType: mime })
          if (uploadError) throw uploadError
          uploaded += 1
          setUploadPct(Math.round((uploaded / entries.length) * 100))
        }
        // Same-origin proxy required: *.supabase.co downgrades any
        // HTML/JS response to text/plain with a locked CSP, so the package
        // has to be served from our own domain via /api/scorm instead of
        // the public Storage URL directly.
        packageUrl = `/api/scorm/${packageId}`
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao processar o pacote SCORM.')
        setSaving(false)
        return
      }
    }

    if (!packageUrl) {
      setError('Selecione um arquivo .zip.')
      setSaving(false)
      return
    }

    const payload = { name, package_url: packageUrl, manifest_path: manifestPath }
    const { error: saveError } = item
      ? await supabase.from('scorm_library').update(payload).eq('id', item.id)
      : await supabase.from('scorm_library').insert(payload)
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
        <h3 className="text-lg font-bold text-ink">{item ? 'Editar pacote SCORM' : 'Novo pacote SCORM'}</h3>
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Nome do pacote" value={name} onChange={(e) => setName(e.target.value)} />

        {item?.package_url && (
          <p className="text-xs text-ink-soft">Já existe um pacote enviado. Selecione um novo .zip abaixo só se quiser substituí-lo.</p>
        )}
        <input type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
        <input
          className="w-full rounded-xl border border-navy-light px-4 py-3"
          placeholder="Arquivo de entrada (ex: index.html)"
          value={manifestPath}
          onChange={(e) => setManifestPath(e.target.value)}
        />
        {saving && (
          <div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${uploadPct}%` }} /></div>
            <p className="mt-1 text-xs text-ink-soft">Enviando arquivos do pacote… {uploadPct}%</p>
          </div>
        )}

        {error && <p className="text-sm text-brand-red">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">Cancelar</button>
          <button onClick={save} disabled={saving || !name} className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
