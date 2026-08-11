import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import { supabase } from '../../lib/supabase'
import type { GamificationLevel, GamificationRule } from '../../types/database'

export function AdminGamificacao() {
  const confirm = useConfirm()
  const [rules, setRules] = useState<GamificationRule[]>([])
  const [levels, setLevels] = useState<GamificationLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [ruleForm, setRuleForm] = useState<GamificationRule | null>(null)
  const [levelForm, setLevelForm] = useState<GamificationLevel | 'new' | null>(null)

  async function reload() {
    const [{ data: r }, { data: l }] = await Promise.all([
      supabase.from('gamification_rules').select('*').order('key'),
      supabase.from('gamification_levels').select('*').order('min_points'),
    ])
    setRules((r as GamificationRule[]) ?? [])
    setLevels((l as GamificationLevel[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  async function toggleEnabled(rule: GamificationRule) {
    await supabase.from('gamification_rules').update({ enabled: !rule.enabled }).eq('key', rule.key)
    reload()
  }

  async function deleteLevel(id: string) {
    if (!(await confirm('Excluir este nível? Alunos que já atingiram essa faixa perdem o badge correspondente.', { danger: true, confirmLabel: 'Excluir' })))
      return
    await supabase.from('gamification_levels').delete().eq('id', id)
    reload()
  }

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <section>
        <h2 className="font-bold text-ink">Regras de pontuação</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Quantos pontos cada ação vale. Desative uma regra pra parar de conceder pontos por ela sem apagar o histórico.
        </p>
        <div className="mt-4 space-y-2">
          {rules.map((rule) => (
            <div key={rule.key} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-ink">{rule.label}</p>
                <p className="text-xs text-ink-soft">
                  {rule.points} pontos{rule.recurrence_days ? ` · a cada ${rule.recurrence_days} dia(s)` : ''}
                  {!rule.enabled && ' · desativada'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleEnabled(rule)}
                  className="rounded-xl border border-navy-light px-3 py-1.5 text-sm font-semibold text-navy hover:bg-navy-light"
                >
                  {rule.enabled ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => setRuleForm(rule)}
                  className="rounded-xl bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-dark"
                >
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-ink">Níveis</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Organizados automaticamente pelos pontos mínimos — o nível do aluno é o de maior pontuação mínima que ele já atingiu.
            </p>
          </div>
          <button
            onClick={() => setLevelForm('new')}
            className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark"
          >
            + Nível
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {levels.map((level) => (
            <div key={level.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{level.badge_icon}</span>
                <div>
                  <p className="font-semibold text-ink">{level.name}</p>
                  <p className="text-xs text-ink-soft">A partir de {level.min_points} pontos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLevelForm(level)}
                  className="rounded-xl border border-navy-light px-3 py-1.5 text-sm font-semibold text-navy hover:bg-navy-light"
                >
                  Editar
                </button>
                <button
                  onClick={() => deleteLevel(level.id)}
                  className="rounded-xl border border-brand-red/30 px-3 py-1.5 text-sm font-semibold text-brand-red hover:bg-brand-red/10"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {levels.length === 0 && <p className="text-ink-soft">Nenhum nível cadastrado ainda.</p>}
        </div>
      </section>

      {ruleForm && <RuleFormModal rule={ruleForm} onClose={() => setRuleForm(null)} onSaved={() => { setRuleForm(null); reload() }} />}
      {levelForm && (
        <LevelFormModal
          level={levelForm === 'new' ? null : levelForm}
          onClose={() => setLevelForm(null)}
          onSaved={() => { setLevelForm(null); reload() }}
        />
      )}
    </AdminLayout>
  )
}

function RuleFormModal({ rule, onClose, onSaved }: { rule: GamificationRule; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(rule.label)
  const [points, setPoints] = useState(rule.points)
  const [recurrenceDays, setRecurrenceDays] = useState(rule.recurrence_days ?? '')
  const [streakDays, setStreakDays] = useState(rule.streak_days ?? '')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    await supabase
      .from('gamification_rules')
      .update({
        label: label.trim(),
        points,
        recurrence_days: recurrenceDays === '' ? null : Number(recurrenceDays),
        streak_days: streakDays === '' ? null : Number(streakDays),
      })
      .eq('key', rule.key)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-5">
        <h3 className="text-lg font-bold text-ink">Editar regra</h3>

        <label className="mt-4 block text-xs font-semibold text-ink-soft">Rótulo</label>
        <input
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />

        <label className="mt-3 block text-xs font-semibold text-ink-soft">Pontos</label>
        <input
          type="number"
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5"
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
        />

        {rule.key === 'daily_access' && (
          <>
            <label className="mt-3 block text-xs font-semibold text-ink-soft">Intervalo entre resgates (dias)</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5"
              value={recurrenceDays}
              onChange={(e) => setRecurrenceDays(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </>
        )}

        {rule.key === 'streak_bonus' && (
          <>
            <label className="mt-3 block text-xs font-semibold text-ink-soft">Dias seguidos pra repetir o bônus</label>
            <input
              type="number"
              min={2}
              className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5"
              value={streakDays}
              onChange={(e) => setStreakDays(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </>
        )}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !label.trim()}
            className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LevelFormModal({
  level,
  onClose,
  onSaved,
}: {
  level: GamificationLevel | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(level?.name ?? '')
  const [minPoints, setMinPoints] = useState(level?.min_points ?? 0)
  const [badgeIcon, setBadgeIcon] = useState(level?.badge_icon ?? '🏅')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    const payload = { name: name.trim(), min_points: minPoints, badge_icon: badgeIcon.trim() }
    if (level) {
      await supabase.from('gamification_levels').update(payload).eq('id', level.id)
    } else {
      await supabase.from('gamification_levels').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-5">
        <h3 className="text-lg font-bold text-ink">{level ? 'Editar nível' : 'Novo nível'}</h3>

        <label className="mt-4 block text-xs font-semibold text-ink-soft">Nome</label>
        <input
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="mt-3 block text-xs font-semibold text-ink-soft">Pontos mínimos</label>
        <input
          type="number"
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5"
          value={minPoints}
          onChange={(e) => setMinPoints(Number(e.target.value))}
        />

        <label className="mt-3 block text-xs font-semibold text-ink-soft">Emoji do badge</label>
        <input
          className="mt-1 w-full rounded-xl border border-navy-light px-4 py-2.5"
          value={badgeIcon}
          onChange={(e) => setBadgeIcon(e.target.value)}
        />

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !name.trim() || !badgeIcon.trim()}
            className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
