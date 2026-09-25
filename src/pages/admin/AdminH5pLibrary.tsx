import JSZip from 'jszip'
import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import type { H5pLibraryItem } from '../../types/database'

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  js: 'text/javascript',
  css: 'text/css',
  json: 'application/json',
  xml: 'application/xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'audio/ogg',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
}

function guessContentType(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream'
}

type SortField = 'name' | 'created_at' | 'updated_at'

export function AdminH5pLibrary() {
  const confirm = useConfirm()
  const [items, setItems] = useState<H5pLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [formItem, setFormItem] = useState<H5pLibraryItem | 'new' | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [query, setQuery] = useState('')

  async function reload() {
    const { data } = await supabase.from('h5p_library').select('*').order('created_at')
    setItems((data as H5pLibraryItem[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  async function deleteItem(id: string) {
    if (
      !(await confirm('Remover este pacote da biblioteca? Pílulas que apontam para ele ficam sem conteúdo até você trocar.', {
        danger: true,
        confirmLabel: 'Remover',
      }))
    )
      return
    await supabase.from('h5p_library').delete().eq('id', id)
    reload()
  }

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  // ID de exibição (H5P-001, H5P-002...) é fixo pela ordem de cadastro,
  // independente de como a tabela está ordenada no momento.
  const idByItemId = new Map(
    [...items]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((item, index) => [item.id, `H5P-${String(index + 1).padStart(3, '0')}`]),
  )

  const q = query.trim().toLowerCase()
  const filteredItems = q
    ? items.filter((item) => item.name.toLowerCase().includes(q) || idByItemId.get(item.id)?.toLowerCase().includes(q))
    : items

  const sortedItems = [...filteredItems].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortField === 'name') return a.name.localeCompare(b.name) * dir
    return a[sortField].localeCompare(b[sortField]) * dir
  })

  return (
    <AdminLayout>
      <p className="mb-4 text-sm text-ink-soft">
        Pacotes H5P (.h5p) ficam guardados aqui de forma independente das pílulas. Atualizar um pacote aqui atualiza
        automaticamente todas as pílulas que o utilizam.
      </p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou ID"
          className="w-full max-w-xs rounded-xl border border-navy-light px-4 py-2 text-sm outline-none focus:border-navy"
        />
        <button
          onClick={() => setFormItem('new')}
          className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark"
        >
          + Novo pacote H5P
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-ink-soft">
              <th className="px-4 py-3">ID</th>
              <SortableHeader label="Nome" field="name" sortField={sortField} sortDir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Criado em" field="created_at" sortField={sortField} sortDir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Modificado em" field="updated_at" sortField={sortField} sortDir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => (
              <tr key={item.id} className="border-t border-navy-light/60">
                <td className="px-4 py-3 font-mono text-xs text-ink-soft">{idByItemId.get(item.id)}</td>
                <td className="px-4 py-3 font-semibold text-ink">{item.name}</td>
                <td className="px-4 py-3 text-ink-soft">{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 text-ink-soft">{new Date(item.updated_at).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
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
                </td>
              </tr>
            ))}
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-ink-soft">
                  {items.length === 0 ? 'Nenhum pacote H5P cadastrado ainda.' : 'Nenhum pacote encontrado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formItem && (
        <H5pFormModal item={formItem === 'new' ? null : formItem} onClose={() => setFormItem(null)} onSaved={() => { setFormItem(null); reload() }} />
      )}
    </AdminLayout>
  )
}

function SortableHeader({
  label,
  field,
  sortField,
  sortDir,
  onClick,
}: {
  label: string
  field: SortField
  sortField: SortField
  sortDir: 'asc' | 'desc'
  onClick: (field: SortField) => void
}) {
  const active = field === sortField
  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onClick(field)}
        className={`flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-navy ${active ? 'text-navy' : ''}`}
      >
        {label}
        <span className="text-[10px]">{active ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  )
}

function H5pFormModal({
  item,
  onClose,
  onSaved,
}: {
  item: H5pLibraryItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
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
        if (entries.length === 0) throw new Error('O arquivo .h5p está vazio.')
        if (!entries.some((e) => e.name === 'h5p.json')) {
          throw new Error('Não achei h5p.json na raiz do pacote — confirme que é um arquivo .h5p válido.')
        }

        const packageId = crypto.randomUUID()
        let uploaded = 0
        for (const entry of entries) {
          const raw = await entry.async('blob')
          const mime = guessContentType(entry.name)
          const blob = new Blob([raw], { type: mime })
          const { error: uploadError } = await supabase.storage
            .from('h5p-packages')
            .upload(`${packageId}/${entry.name}`, blob, { upsert: true, contentType: mime })
          if (uploadError) throw uploadError
          uploaded += 1
          setUploadPct(Math.round((uploaded / entries.length) * 100))
        }
        // Same-origin proxy required pelo mesmo motivo do SCORM: *.supabase.co
        // rebaixa qualquer resposta HTML/JS pra text/plain com CSP travado.
        packageUrl = `/api/h5p/${packageId}`
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao processar o pacote H5P.')
        setSaving(false)
        return
      }
    }

    if (!packageUrl) {
      setError('Selecione um arquivo .h5p.')
      setSaving(false)
      return
    }

    const payload = { name, package_url: packageUrl }
    const { error: saveError } = item
      ? await supabase.from('h5p_library').update(payload).eq('id', item.id)
      : await supabase.from('h5p_library').insert(payload)
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
        <h3 className="text-lg font-bold text-ink">{item ? 'Editar pacote H5P' : 'Novo pacote H5P'}</h3>
        <input className="w-full rounded-xl border border-navy-light px-4 py-3" placeholder="Nome do pacote" value={name} onChange={(e) => setName(e.target.value)} />

        {item?.package_url && (
          <p className="text-xs text-ink-soft">Já existe um pacote enviado. Selecione um novo .h5p abaixo só se quiser substituí-lo.</p>
        )}
        <input type="file" accept=".h5p,.zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />

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
