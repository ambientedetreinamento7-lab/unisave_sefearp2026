import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Sem isso, qualquer exceção não tratada durante o render (em qualquer
 * página) derrubava a árvore React inteira e deixava uma tela branca sem
 * nenhuma pista do que quebrou — nem pro usuário, nem pra debugar depois.
 * Loga no console (visível no DevTools) e mostra uma mensagem com opção de
 * recarregar, em vez de ficar em branco.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado na UI:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg px-4">
          <div className="card max-w-md p-8 text-center">
            <span className="text-3xl">⚠️</span>
            <h1 className="mt-3 text-lg font-bold text-ink">Algo deu errado</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Ocorreu um erro inesperado nesta tela. Tente recarregar a página — se o problema continuar, avise o
              suporte com a mensagem abaixo.
            </p>
            <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-surface p-3 text-left text-xs text-brand-red">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 w-full rounded-xl bg-brand-red py-2.5 font-bold text-white hover:bg-brand-red-dark"
            >
              Recarregar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
