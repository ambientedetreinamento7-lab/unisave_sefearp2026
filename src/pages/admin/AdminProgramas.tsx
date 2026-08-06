import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'
import type { Program, SkillCategory } from '../../types/database'

export function AdminProgramas() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [categories, setCategories] = useState<SkillCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('programs').select('*').order('name')
      const { data: c } = await supabase.from('skill_categories').select('*')
      setPrograms((p as Program[]) ?? [])
      setCategories((c as SkillCategory[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="space-y-4">
        {programs.map((p) => (
          <div key={p.id} className="card p-5">
            <h3 className="font-bold text-ink">{p.name}</h3>
            {p.mission && <p className="mt-1 text-sm text-ink-soft">{p.mission}</p>}
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-navy">Taxonomia de skills</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {categories
                .filter((c) => c.program_id === p.id)
                .map((c) => (
                  <span key={c.id} className="rounded-full bg-navy-light px-2.5 py-1 text-xs font-medium text-navy">
                    {c.name} · {c.type}
                  </span>
                ))}
              {categories.filter((c) => c.program_id === p.id).length === 0 && (
                <span className="text-xs text-ink-soft">Nenhuma categoria cadastrada</span>
              )}
            </div>
          </div>
        ))}
        {programs.length === 0 && <p className="text-ink-soft">Nenhum programa cadastrado. Rode o seed SQL.</p>}
      </div>
    </AdminLayout>
  )
}
