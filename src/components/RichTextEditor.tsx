import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

const FONT_SIZES = [
  { value: '2', label: 'Pequeno' },
  { value: '3', label: 'Normal' },
  { value: '5', label: 'Grande' },
  { value: '7', label: 'Título' },
]

/**
 * Editor de texto rico baseado em contentEditable (usado hoje na mensagem
 * do certificado e no Conteúdo Programático do curso). `variables` é
 * opcional — só o certificado precisa do dropdown "+ Inserir variável",
 * já que os tokens ({NOME_COMPLETO} etc.) só fazem sentido lá.
 */
export function RichTextEditor({
  value,
  onChange,
  variables,
}: {
  value: string
  onChange: (html: string) => void
  variables?: { token: string; label: string }[]
}) {
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
        {variables && variables.length > 0 && (
          <>
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
              {variables.map((v) => (
                <option key={v.token} value={v.token}>{v.label}</option>
              ))}
            </select>
          </>
        )}
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
