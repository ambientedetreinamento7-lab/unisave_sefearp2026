import { useState } from 'react'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const CURRENT_YEAR = new Date().getFullYear()

function daysInMonth(month: string, year: string): number {
  if (!month || !year) return 31
  return new Date(Number(year), Number(month), 0).getDate()
}

/** Substitui o <input type="date"> nativo por 3 selects (dia/mês/ano) pra
 * datas-alvo de metas do PDI — mesmo raciocínio do BirthDateSelect: o
 * calendário nativo varia muito de aparência/comportamento entre
 * navegadores e é desconfortável no celular, enquanto um dropdown é
 * previsível em qualquer dispositivo. Intervalo de anos curto (ano atual
 * -1 a +3) porque é sempre uma meta de curto/médio prazo, não data de
 * nascimento. `value`/`onChange` usam o mesmo formato ISO (YYYY-MM-DD, ou
 * string vazia) que o input nativo já usava. */
export function TargetDateSelect({
  value,
  onChange,
  selectClassName = 'rounded-lg border border-navy-light px-1.5 py-1 text-xs text-ink-soft outline-none focus:border-navy',
}: {
  value: string
  onChange: (value: string) => void
  selectClassName?: string
}) {
  const [[year, month, day], setParts] = useState<[string, string, string]>(() =>
    value ? (value.split('-') as [string, string, string]) : ['', '', ''],
  )
  const years = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i)

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
    <div className="flex gap-1">
      <select className={selectClassName} value={day} onChange={(e) => update(e.target.value, month, year)}>
        <option value="">Dia</option>
        {Array.from({ length: daysInMonth(month, year) }, (_, i) => i + 1).map((d) => (
          <option key={d} value={String(d).padStart(2, '0')}>
            {d}
          </option>
        ))}
      </select>
      <select className={selectClassName} value={month} onChange={(e) => handleMonthChange(e.target.value)}>
        <option value="">Mês</option>
        {MONTHS_SHORT.map((label, idx) => (
          <option key={label} value={String(idx + 1).padStart(2, '0')}>
            {label}
          </option>
        ))}
      </select>
      <select className={selectClassName} value={year} onChange={(e) => handleYearChange(e.target.value)}>
        <option value="">Ano</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
