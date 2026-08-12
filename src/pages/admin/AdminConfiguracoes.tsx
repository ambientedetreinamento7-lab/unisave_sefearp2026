import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { getTrialSettings, updateTrialSettings } from '../../lib/settings'

export function AdminConfiguracoes() {
  const [enabled, setEnabled] = useState(true)
  const [days, setDays] = useState(14)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getTrialSettings().then((s) => {
      setEnabled(s.enabled)
      setDays(s.days)
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    await updateTrialSettings({ enabled, days })
    setSaving(false)
    setSaved(true)
  }

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="card max-w-lg p-5">
        <h2 className="font-bold text-ink">Período de degustação</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Contador exibido no cabeçalho pro aluno, contado a partir da data de cadastro dele.
        </p>

        <label className="mt-4 flex items-center gap-2 rounded-xl border border-navy-light p-3 text-sm font-medium text-ink">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Exibir contador de degustação para os alunos
        </label>

        <label className="mt-3 block text-xs font-semibold text-ink-soft">Duração (dias)</label>
        <input
          type="number"
          min={1}
          disabled={!enabled}
          className="mt-1 w-32 rounded-xl border border-navy-light px-4 py-2.5 disabled:opacity-50"
          value={days}
          onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
        />

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-brand-red px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          {saved && <span className="text-sm font-semibold text-success">Salvo!</span>}
        </div>
      </div>
    </AdminLayout>
  )
}
