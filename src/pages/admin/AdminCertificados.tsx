import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'
import type { Track } from '../../types/database'

export function AdminCertificados() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    const { data } = await supabase.from('tracks').select('*').order('title')
    setTracks((data as Track[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  const selected = tracks.find((t) => t.id === selectedId) ?? null

  return (
    <AdminLayout>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="card max-h-[70vh] overflow-y-auto p-3">
          {tracks.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                selectedId === t.id ? 'bg-navy text-white' : 'text-ink hover:bg-navy-light'
              }`}
            >
              {t.title}
            </button>
          ))}
          {tracks.length === 0 && <p className="p-3 text-sm text-ink-soft">Nenhum curso cadastrado ainda.</p>}
        </div>

        <div>
          {selected ? (
            <CertificateEditor key={selected.id} track={selected} onSaved={reload} />
          ) : (
            <div className="card p-8 text-center text-ink-soft">Selecione um curso à esquerda para configurar o certificado dele.</div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

function CertificateEditor({ track, onSaved }: { track: Track; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(track.certificate_enabled)
  const [message, setMessage] = useState(track.certificate_message ?? '')
  const [backgroundUrl, setBackgroundUrl] = useState(track.certificate_background_url)
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    let finalBackgroundUrl = backgroundUrl

    if (backgroundFile) {
      const path = `certificates/${track.id}-${Date.now()}-${backgroundFile.name}`
      const { error: uploadError } = await supabase.storage.from('covers').upload(path, backgroundFile, {
        upsert: true,
        contentType: backgroundFile.type || 'image/png',
      })
      if (uploadError) {
        setError(uploadError.message)
        setSaving(false)
        return
      }
      const { data } = supabase.storage.from('covers').getPublicUrl(path)
      finalBackgroundUrl = data.publicUrl
    }

    const { error: saveError } = await supabase
      .from('tracks')
      .update({
        certificate_enabled: enabled,
        certificate_message: message || null,
        certificate_background_url: finalBackgroundUrl,
      })
      .eq('id', track.id)
    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }
    setBackgroundUrl(finalBackgroundUrl)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Curso</p>
        <h3 className="text-lg font-bold text-ink">{track.title}</h3>
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Publicado (emite certificado ao concluir 100% do curso)
      </label>

      <div>
        <label className="block text-xs font-semibold text-ink-soft">Imagem de fundo do certificado</label>
        <p className="mt-0.5 text-xs text-ink-soft">Tamanho recomendado: 1400×495px.</p>
        {backgroundUrl && !backgroundFile && (
          <img src={backgroundUrl} alt="Fundo do certificado" className="mt-2 max-h-32 rounded-lg border border-navy-light" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setBackgroundFile(e.target.files?.[0] ?? null)}
          className="mt-2 w-full text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-soft">Mensagem do certificado</label>
        <textarea
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-3"
          rows={5}
          placeholder="Ex: Certificamos que {NOME_COMPLETO} concluiu o curso {NOME_DO_CURSO} com carga horária de {CARGA_HORARIA_CURSO} horas."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="mt-1 text-xs text-ink-soft">
          Variáveis disponíveis: <code>{'{NOME_COMPLETO}'}</code> · <code>{'{NOME_DO_CURSO}'}</code> ·{' '}
          <code>{'{CARGA_HORARIA_CURSO}'}</code> · <code>{'{DATA_CONCLUSAO}'}</code>
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
        Pré-visualizar
      </label>

      {preview && (
        <div
          className="relative flex aspect-[1400/495] w-full items-center justify-center overflow-hidden rounded-xl border border-navy-light bg-cover bg-center p-6 text-center"
          style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
        >
          <p className="max-w-lg text-sm font-medium text-ink">
            {(message || 'Certificamos que {NOME_COMPLETO} concluiu o curso {NOME_DO_CURSO}.')
              .replaceAll('{NOME_COMPLETO}', 'Nome do Aluno')
              .replaceAll('{NOME_DO_CURSO}', track.title)
              .replaceAll('{CARGA_HORARIA_CURSO}', String(track.carga_horaria_total ?? '—'))
              .replaceAll('{DATA_CONCLUSAO}', new Date().toLocaleDateString('pt-BR'))}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-brand-red">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-brand-red px-5 py-2.5 font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
      >
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  )
}
