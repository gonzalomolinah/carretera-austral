import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryState { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no recuperable en Ruta Austral:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="fatal-screen"><div className="fatal-screen__mark">△</div><p className="eyebrow">Algo salió mal</p><h1>La ruta local sigue guardada</h1><p>Recarga la aplicación. Si el problema continúa, exporta el respaldo desde la versión anterior antes de borrar datos del sitio.</p><div><button className="button button--primary" onClick={() => window.location.reload()}>Recargar</button><a className="button button--quiet" href="/legacy/index.html">Abrir recuperación</a></div><details><summary>Detalle técnico</summary><pre>{this.state.error.message}</pre></details></main>
  }
}

