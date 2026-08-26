import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AdminLayout } from './AdminLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import { applyCertificateVariables } from '../../lib/certificate'
import { formatCargaHoraria } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { CertificateTemplate } from '../../types/database'

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

function previewVariables(html: string) {
  return applyCertificateVariables(html, {
    nomeCompleto: 'Nome do Aluno',
    nomeDoCurso: 'Nome do Curso',
    cargaHorariaCurso: formatCargaHoraria(40),
    dataConclusao: new Date().toLocaleDateString('pt-BR'),
  })
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
  const confirm = useConfirm()
  const [templates, setTemplates] = useState<CertificateTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    const { data } = await supabase.from('certificate_templates').select('*').order('name')
    setTemplates((data as CertificateTemplate[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  async function createNew() {
    const { data, error } = await supabase
      .from('certificate_templates')
      .insert({ name: 'Novo certificado' })
      .select('*')
      .single()
    if (error) return
    await reload()
    setSelectedId(data.id)
  }

  async function deleteTemplate(id: string) {
    if (
      !(await confirm(
        'Remover este certificado da biblioteca? Cursos que apontam para ele ficam sem certificado até você trocar.',
        { danger: true, confirmLabel: 'Remover' },
      ))
    )
      return
    await supabase.from('certificate_templates').delete().eq('id', id)
    if (selectedId === id) setSelectedId(null)
    reload()
  }

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  const selected = templates.find((t) => t.id === selectedId) ?? null

  return (
    <AdminLayout>
      <p className="mb-4 text-sm text-ink-soft">
        Crie um modelo de certificado aqui — com fundo e variáveis — e depois selecione qual usar em cada curso, em
        "Editar curso". O mesmo modelo pode ser reaproveitado em vários cursos.
      </p>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="card max-h-[70vh] overflow-y-auto p-3">
          <button
            onClick={createNew}
            className="mb-2 block w-full rounded-lg bg-brand-red px-3 py-2 text-left text-sm font-bold text-white hover:bg-brand-red-dark"
          >
            + Novo certificado
          </button>
          {templates.map((t) => (
            <div key={t.id} className="group flex items-center gap-1">
              <button
                onClick={() => setSelectedId(t.id)}
                className={`block flex-1 truncate rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  selectedId === t.id ? 'bg-navy text-white' : 'text-ink hover:bg-navy-light'
                }`}
              >
                {t.name}
              </button>
              <button
                onClick={() => deleteTemplate(t.id)}
                title="Excluir"
                className={`shrink-0 px-1.5 text-xs font-semibold hover:underline ${
                  selectedId === t.id ? 'text-white/80' : 'text-brand-red'
                }`}
              >
                ✕
              </button>
            </div>
          ))}
          {templates.length === 0 && <p className="p-3 text-sm text-ink-soft">Nenhum certificado cadastrado ainda.</p>}
        </div>

        <div>
          {selected ? (
            <CertificateEditor key={selected.id} template={selected} onSaved={reload} />
          ) : (
            <div className="card p-8 text-center text-ink-soft">
              Selecione um certificado à esquerda, ou crie um novo, pra editar o modelo.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

function CertificateEditor({ template, onSaved }: { template: CertificateTemplate; onSaved: () => void }) {
  const [name, setName] = useState(template.name)
  const [message, setMessage] = useState(template.message ?? '')
  const [backgroundUrl, setBackgroundUrl] = useState(template.background_url)
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    let finalBackgroundUrl = backgroundUrl

    if (backgroundFile) {
      const path = `certificates/${template.id}-${Date.now()}-${backgroundFile.name}`
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
      .from('certificate_templates')
      .update({
        name,
        message: message || null,
        background_url: finalBackgroundUrl,
      })
      .eq('id', template.id)
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
        <label className="block text-xs font-semibold text-ink-soft">Nome do certificado</label>
        <input
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5 text-sm font-bold"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

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
          <code>{'{DATA_CONCLUSAO}'}</code>. As variáveis são preenchidas com os dados de cada curso e aluno na hora
          da emissão — o mesmo modelo funciona em qualquer curso que o usar.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
        Pré-visualizar
      </label>

      {preview && (
        <div
          className="relative flex aspect-[1400/895] w-full items-center justify-center bg-cover bg-center p-6 text-center"
          style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
        >
          <div
            className="max-w-lg text-base font-medium leading-relaxed text-ink"
            dangerouslySetInnerHTML={{
              __html: previewVariables(message || 'Certificamos que {NOME_COMPLETO} concluiu o curso {NOME_DO_CURSO}.'),
            }}
          />
        </div>
      )}

      {error && <p className="text-sm text-brand-red">{error}</p>}

      <button
        onClick={save}
        disabled={saving || !name.trim()}
        className="rounded-xl bg-brand-red px-5 py-2.5 font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
      >
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  )
}
