import { useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'

interface CsvRow {
  program_id: string
  period: string
  course_name: string
}

export function AdminGrade() {
  const [rows, setRows] = useState<CsvRow[]>([])
  const [status, setStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle')

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const [header, ...lines] = text.trim().split('\n')
      const cols = header.split(',').map((c) => c.trim())
      const parsed = lines
        .filter(Boolean)
        .map((line) => {
          const values = line.split(',')
          const obj: Record<string, string> = {}
          cols.forEach((c, i) => (obj[c] = (values[i] ?? '').trim()))
          return obj as unknown as CsvRow
        })
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  async function importRows() {
    setStatus('importing')
    const { error } = await supabase.from('curriculum_grid').insert(rows)
    setStatus(error ? 'error' : 'done')
  }

  return (
    <AdminLayout>
      <div className="card p-6">
        <h2 className="font-bold text-ink">Import da grade curricular por curso (CSV)</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Cabeçalho esperado: <code className="rounded bg-bg px-1.5 py-0.5">program_id,period,course_name</code>
        </p>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="mt-4 text-sm"
        />

        {rows.length > 0 && (
          <>
            <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-navy-light">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy-light text-navy">
                  <tr>
                    <th className="px-3 py-2">program_id</th>
                    <th className="px-3 py-2">period</th>
                    <th className="px-3 py-2">course_name</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-navy-light/50">
                      <td className="px-3 py-2">{r.program_id}</td>
                      <td className="px-3 py-2">{r.period}</td>
                      <td className="px-3 py-2">{r.course_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={importRows}
              disabled={status === 'importing'}
              className="mt-4 rounded-xl bg-brand-red px-5 py-2.5 font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
            >
              {status === 'importing' ? 'Importando…' : `Importar ${rows.length} linhas`}
            </button>
            {status === 'done' && <p className="mt-2 text-sm text-success">Importado com sucesso!</p>}
            {status === 'error' && (
              <p className="mt-2 text-sm text-brand-red">
                Erro ao importar — verifique se a tabela `curriculum_grid` existe no seu projeto Supabase.
              </p>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}
