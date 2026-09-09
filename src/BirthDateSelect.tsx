import { useState } from 'react'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const CURRENT_YEAR = new Date().getFullYear()

function daysInMonth(month: string, year: string): number {
  if (!month || !year) return 31
  return new Date(Number(year), Number(month), 0).getDate()
}

/** Substitui o <input type="date"> nativo por 3 selects (dia/mês/ano) — o
 * calendário nativo obriga a clicar mês a mês pra voltar décadas até um
 * ano de nascimento, bem mais lento (e pior no celular) do que escolher
 * direto num dropdown. `value`/`onChange` usam o mesmo formato ISO
 * (YYYY-MM-DD, ou string vazia) que o input nativo já usava.
 *
 * Guarda dia/mês/ano como estado próprio (inicializado a partir de
 * `value`) em vez de derivar só do `value` combinado — assim escolher um
 * campo isoladamente (ex.: só o dia, antes de mês/ano) continua visível
 * na tela mesmo enquanto a data ainda não está completa; onChange só
 * dispara quando os 3 já foram escolhidos. */
export function BirthDateSelect({
  value,
  onChange,
  minAge = 14,
  maxAge = 90,
  selectClassName = 'w-full rounded-xl border border-navy-light px-2 py-2.5 text-sm outline-none focus:border-navy',
}: {
  value: string
  onChange: (value: string) => void
  minAge?: number
  maxAge?: number
  selectClassName?: string
}) {
  const [[year, month, day], setParts] = useState<[string, string, string]>(() =>
    value ? (value.split('-') as [string, string, string]) : ['', '', ''],
  )
  const years = Array.from({ length: maxAge - minAge + 1 }, (_, i) => CURRENT_YEAR - minAge - i)

  function update(nextDay: string, nextMonth: string, nextYear: string) {
    setParts([nextYear, nextMonth, nextDay])
    onChange(nextDay && nextMonth && nextYear ? `${nextYear}-${nextMonth}-${nextDay}` : '')
  }

  function handleMonthChange(nextMonth: string) {
    const max = daysInMonth(nextMonth, year)
    update(Number(day) > max ? String(max).padStart(2, '0') : day, nextMonth, year)
  }

  function handleYearChange(nextYear: string) {
    const max = daysInMonth(month, nextYear)
    update(Number(day) > max ? String(max).padStart(2, '0') : day, month, nextYear)
  }

  return (
    <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2">
      <select className={selectClassName} value={day} onChange={(e) => update(e.target.value, month, year)}>
        <option value="">Dia</option>
        {Array.from({ length: daysInMonth(month, year) }, (_, i) => i + 1).map((d) => (
          <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
        ))}
      </select>
      <select className={selectClassName} value={month} onChange={(e) => handleMonthChange(e.target.value)}>
        <option value="">Mês</option>
        {MONTHS.map((label, idx) => (
          <option key={label} value={String(idx + 1).padStart(2, '0')}>{label}</option>
        ))}
      </select>
      <select className={selectClassName} value={year} onChange={(e) => handleYearChange(e.target.value)}>
        <option value="">Ano</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
