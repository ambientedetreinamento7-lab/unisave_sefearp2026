import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminLayout } from './AdminLayout'
import { supabase } from '../../lib/supabase'
import type { PdiPlan, Profile, Program, UserProgress } from '../../types/database'

export function AdminAnalytics() {
  const [funnel, setFunnel] = useState<{ stage: string; value: number }[]>([])
  const [byProgram, setByProgram] = useState<{ program: string; alunos: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'aluno')
      const { data: plans } = await supabase.from('pdi_plans').select('*')
      const { data: progress } = await supabase.from('user_progress').select('*')
      const { data: programs } = await supabase.from('programs').select('*')

      const cadastros = (profiles as Profile[])?.length ?? 0
      const comTrilha = (profiles as Profile[])?.filter((p) => p.selected_track_id).length ?? 0
      const comPlano = new Set(((plans as PdiPlan[]) ?? []).map((p) => p.user_id)).size
      const completaram = new Set(
        ((progress as UserProgress[]) ?? []).filter((p) => p.status === 'completed').map((p) => p.user_id),
      ).size

      setFunnel([
        { stage: 'Quiz iniciado (cadastros)', value: cadastros },
        { stage: 'Trilha vinculada', value: comTrilha },
        { stage: 'Plano de PDI criado', value: comPlano },
        { stage: 'Ao menos 1 módulo concluído', value: completaram },
      ])

      const grouped = new Map<string, number>()
      for (const p of (profiles as Profile[]) ?? []) {
        if (!p.program_id) continue
        grouped.set(p.program_id, (grouped.get(p.program_id) ?? 0) + 1)
      }
      const programMap = new Map(((programs as Program[]) ?? []).map((p) => [p.id, p.name]))
      setByProgram(
        Array.from(grouped.entries()).map(([id, count]) => ({
          program: programMap.get(id) ?? id,
          alunos: count,
        })),
      )

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-bold text-ink">Funil do evento</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="stage" width={160} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#1A3B6E" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-bold text-ink">Engajamento por curso</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProgram}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="program" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="alunos" fill="#E30613" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
