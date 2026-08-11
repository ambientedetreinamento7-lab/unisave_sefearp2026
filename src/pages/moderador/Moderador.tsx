import { useEffect, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { notifyPdiProgress } from '../../lib/notifications'
import { supabase } from '../../lib/supabase'
import type { PdiPlan, Profile, SkillCategory, SkillRating } from '../../types/database'

export function Moderador() {
  const [students, setStudents] = useState<Profile[]>([])
  const [pendingPlans, setPendingPlans] = useState<(PdiPlan & { profiles: { name: string } | null })[]>([])
  const [gaps, setGaps] = useState<{ category: SkillCategory; avg: number; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: studentsData } = await supabase.from('profiles').select('*').eq('role', 'aluno')
      const { data: plansData } = await supabase
        .from('pdi_plans')
        .select('*, profiles(name)')
        .eq('endorsed', false)
        .eq('type', 'plano_pessoal')

      const { data: ratingsData } = await supabase.from('skill_ratings').select('*')
      const { data: categoriesData } = await supabase.from('skill_categories').select('*')

      const catMap = new Map((categoriesData as SkillCategory[])?.map((c) => [c.id, c]) ?? [])
      const grouped = new Map<string, { sum: number; count: number }>()
      for (const r of (ratingsData as SkillRating[]) ?? []) {
        const rating = r.moderator_rating ?? r.self_rating
        if (rating == null) continue
        const bucket = grouped.get(r.skill_category_id) ?? { sum: 0, count: 0 }
        bucket.sum += rating
        bucket.count += 1
        grouped.set(r.skill_category_id, bucket)
      }
      const gapsComputed = Array.from(grouped.entries())
        .map(([catId, { sum, count }]) => ({
          category: catMap.get(catId)!,
          avg: sum / count,
          count,
        }))
        .filter((g) => g.category)
        .sort((a, b) => a.avg - b.avg)

      setStudents((studentsData as Profile[]) ?? [])
      setPendingPlans((plansData as any) ?? [])
      setGaps(gapsComputed)
      setLoading(false)
    }
    load()
  }, [])

  async function endorse(plan: PdiPlan) {
    await supabase.from('pdi_plans').update({ endorsed: true }).eq('id', plan.id)
    setPendingPlans((prev) => prev.filter((p) => p.id !== plan.id))
    await notifyPdiProgress(plan.user_id, `Seu plano "${plan.title}" foi validado pelo moderador`)
  }

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">Painel do Moderador</h1>
        {loading && <p className="mt-6 text-ink-soft">Carregando…</p>}

        {!loading && (
          <>
            <section className="mt-8">
              <h2 className="font-bold text-ink">Gaps de skill agregados</h2>
              <div className="mt-3 space-y-2">
                {gaps.map((g) => (
                  <div key={g.category.id} className="card flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold text-ink">{g.category.name}</p>
                      <p className="text-xs text-ink-soft">{g.count} avaliações</p>
                    </div>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-brand-red">
                      média {g.avg.toFixed(1)}/5
                    </span>
                  </div>
                ))}
                {gaps.length === 0 && <p className="text-ink-soft">Sem avaliações registradas ainda.</p>}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-bold text-ink">Fila de planos para endosso</h2>
              <div className="mt-3 space-y-2">
                {pendingPlans.map((plan) => (
                  <div key={plan.id} className="card flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold text-ink">{plan.title}</p>
                      <p className="text-xs text-ink-soft">{plan.profiles?.name}</p>
                    </div>
                    <button
                      onClick={() => endorse(plan)}
                      className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark"
                    >
                      Endossar
                    </button>
                  </div>
                ))}
                {pendingPlans.length === 0 && <p className="text-ink-soft">Nenhum plano pendente.</p>}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-bold text-ink">Alunos ({students.length})</h2>
              <div className="mt-3 space-y-2">
                {students.map((s) => (
                  <div key={s.id} className="card flex items-center justify-between p-4">
                    <span className="font-medium text-ink">{s.name}</span>
                    <span className="text-xs text-ink-soft">{s.email}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
