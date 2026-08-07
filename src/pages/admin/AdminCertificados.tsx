import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'
import type { Track } from '../../types/database'

const VARIABLES = [
  { token: '{NOME_COMPLETO}', label: 'Nome completo' },
  { token: '{NOME_DO_CURSO}', label: 'Nome do curso' },
  { token: '{CARGA_HORARIA_CURSO}', label: 'Carga horária' },
  { token: '{DATA_CONCLUSAO}', label: 'Data de conclusão' },
]

const FONT_SIZES = [
  { value: '2', label: 'Pequeno' },
  { value: '3', label: 'Normal' },
  { value: '5', label: 'Grande' },
  { value: '7', label: 'Título' },
]

function applyVariables(html: string, track: Track) {
  return html
    .replaceAll('{NOME_COMPLETO}', 'Nome do Aluno')
    .replaceAll('{NOME_DO_CURSO}', track.title)
    .replaceAll('{CARGA_HORARIA_CURSO}', String(track.carga_horaria_total ?? '—'))
    .replaceAll('{DATA_CONCLUSAO}', new Date().toLocaleDateString('pt-BR'))
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || !editorRef.current) return
    editorRef.current.innerHTML = value
    initialized.current = true
  }, [value])

  function exec(command: string, arg?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, arg)
    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  function insertVariable(token: string) {
    exec('insertText', token)
  }

  return (
    <div className="rounded-xl border border-navy-light">
      <div className="flex flex-wrap items-center gap-1 border-b border-navy-light bg-bg px-2 py-1.5">
        <ToolbarButton label="Negrito" onMouseDown={() => exec('bold')}><b>N</b></ToolbarButton>
        <ToolbarButton label="Itálico" onMouseDown={() => exec('italic')}><i>I</i></ToolbarButton>
        <ToolbarButton label="Sublinhado" onMouseDown={() => exec('underline')}><u>S</u></ToolbarButton>
        <Divider />
        <ToolbarButton label="Alinhar à esquerda" onMouseDown={() => exec('justifyLeft')}>⇤</ToolbarButton>
        <ToolbarButton label="Centralizar" onMouseDown={() => exec('justifyCenter')}>≡</ToolbarButton>
        <ToolbarButton label="Alinhar à direita" onMouseDown={() => exec('justifyRight')}>⇥</ToolbarButton>
        <Divider />
        <select
          className="rounded-md border border-navy-light bg-white px-1.5 py-1 text-xs"
          defaultValue="3"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => exec('fontSize', e.target.value)}
        >
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <input
          type="color"
          title="Cor do texto"
          defaultValue="#1a1a1a"
          className="h-7 w-8 cursor-pointer rounded-md border border-navy-light bg-white p-0.5"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => exec('foreColor', e.target.value)}
        />
        <Divider />
        <select
          className="rounded-md border border-navy-light bg-white px-1.5 py-1 text-xs"
          defaultValue=""
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.value) insertVariable(e.target.value)
            e.target.value = ''
          }}
        >
          <option value="">+ Inserir variável…</option>
          {VARIABLES.map((v) => (
            <option key={v.token} value={v.token}>{v.label}</option>
          ))}
        </select>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[140px] w-full px-4 py-3 text-sm outline-none"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  )
}

function ToolbarButton({
  label,
  onMouseDown,
  children,
}: {
  label: string
  onMouseDown: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown()
      }}
      className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold text-ink hover:bg-navy-light"
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-navy-light" />
}

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
        <p className="mt-0.5 text-xs text-ink-soft">Tamanho recomendado: 1400×895px.</p>
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
        <div className="mt-1">
          <RichTextEditor value={message} onChange={setMessage} />
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Formate o texto com a barra de ferramentas (negrito, cor, alinhamento…) e use "+ Inserir variável" para{' '}
          <code>{'{NOME_COMPLETO}'}</code>, <code>{'{NOME_DO_CURSO}'}</code>, <code>{'{CARGA_HORARIA_CURSO}'}</code> e{' '}
          <code>{'{DATA_CONCLUSAO}'}</code>.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
        Pré-visualizar
      </label>

      {preview && (
        <div
          className="relative flex aspect-[1400/895] w-full items-center justify-center overflow-hidden rounded-xl border border-navy-light bg-cover bg-center p-6 text-center"
          style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
        >
          <div
            className="max-w-lg text-sm font-medium text-ink"
            dangerouslySetInnerHTML={{
              __html: applyVariables(message || 'Certificamos que {NOME_COMPLETO} concluiu o curso {NOME_DO_CURSO}.', track),
            }}
          />
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
