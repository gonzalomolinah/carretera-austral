import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { WorkspaceProvider } from './data/WorkspaceContext'
import { ErrorBoundary } from './ErrorBoundary'

const theme = localStorage.getItem('ruta-austral-theme')
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </ErrorBoundary>
  </StrictMode>,
)

