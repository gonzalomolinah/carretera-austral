import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AppShell, BottomNav, Icon, IconButton, SyncPill, ToastRegion, TopBar, type ToastNotice } from './components'
import { useWorkspace } from './data/WorkspaceContext'
import type { MainTab } from './domain/types'
import { ItineraryView } from './features/itinerary/ItineraryView'
import { registerPwa, type PwaUpdatePrompt } from './pwa/register'

const MapView = lazy(() => import('./features/map/MapView').then((module) => ({ default: module.MapView })))
const ExpensesView = lazy(() => import('./features/expenses/ExpensesView').then((module) => ({ default: module.ExpensesView })))
const MoreView = lazy(() => import('./features/more/MoreView').then((module) => ({ default: module.MoreView })))

const tabLabels: Record<MainTab, string> = {
  itinerary: 'Itinerario', map: 'Mapa', expenses: 'Gastos', more: 'Más',
}

const readInitialTab = (): MainTab => {
  const stored = sessionStorage.getItem('ruta-austral-tab')
  return stored === 'itinerary' || stored === 'map' || stored === 'expenses' || stored === 'more'
    ? stored
    : 'itinerary'
}

const syncPillStatus = (status: ReturnType<typeof useWorkspace>['syncStatus']['state']) => {
  if (status === 'syncing') return 'saving' as const
  if (status === 'synced') return 'synced' as const
  if (status === 'pending') return 'pending' as const
  if (status === 'offline') return 'offline' as const
  if (status === 'error') return 'error' as const
  return 'local' as const
}

export default function App() {
  const { workspace, loading, syncStatus, migratedLegacy, canUndo, canRedo, undo, redo, syncNow } = useWorkspace()
  const [tab, setTab] = useState<MainTab>(readInitialTab)
  const [addRequest, setAddRequest] = useState(0)
  const [notices, setNotices] = useState<ToastNotice[]>([])
  const [updatePrompt, setUpdatePrompt] = useState<PwaUpdatePrompt | null>(null)

  const addNotice = (notice: ToastNotice) => setNotices((current) => [...current.filter((item) => item.id !== notice.id), notice])
  const dismiss = (id: string) => setNotices((current) => current.filter((notice) => notice.id !== id))

  useEffect(() => {
    sessionStorage.setItem('ruta-austral-tab', tab)
  }, [tab])

  useEffect(() => {
    if (!migratedLegacy) return
    addNotice({ id: 'legacy-migrated', tone: 'success', title: 'Datos anteriores recuperados', message: 'La copia local fue migrada y el respaldo original quedó conservado.' })
  }, [migratedLegacy])

  useEffect(() => {
    const handleUndoable = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      const id = `undoable-${Date.now()}`
      setNotices((current) => [
        ...current.filter((notice) => !notice.id.startsWith('undoable-')),
        {
          id,
          tone: 'info',
          title: 'Cambio guardado',
          message: detail?.message ?? 'La acción se puede deshacer.',
          action: { label: 'Deshacer', onClick: () => { void undo(); dismiss(id) } },
        },
      ])
    }
    window.addEventListener('ruta-austral:undoable', handleUndoable)
    return () => window.removeEventListener('ruta-austral:undoable', handleUndoable)
  }, [undo])

  useEffect(() => {
    const handleSyncConflict = (event: Event) => {
      const retry = (event as CustomEvent<{ retry?: () => void }>).detail?.retry
      addNotice({
        id: 'sync-conflict',
        tone: 'danger',
        title: 'Hay cambios en otra copia',
        message: retry
          ? 'No sobrescribimos la versión compartida. Tus cambios siguen guardados aquí; exporta un JSON antes de decidir si quieres reemplazar la copia remota.'
          : 'No sobrescribimos la versión compartida. Tus cambios siguen guardados aquí; exporta un JSON desde Más → Ajustes antes de resolver el conflicto.',
        action: retry ? {
          label: 'Reemplazar copia remota',
          onClick: () => { retry(); dismiss('sync-conflict') },
        } : undefined,
      })
    }
    window.addEventListener('ruta-austral:sync-conflict', handleSyncConflict)
    return () => window.removeEventListener('ruta-austral:sync-conflict', handleSyncConflict)
  }, [])

  useEffect(() => {
    const controller = registerPwa({
      onStatusChange: (detail) => {
        if (detail.status === 'lista-sin-conexion') addNotice({ id: 'offline-ready', tone: 'success', message: 'Ruta Austral ya puede abrirse sin conexión.' })
      },
      onUpdateAvailable: (prompt) => {
        setUpdatePrompt(prompt)
        addNotice({ id: 'pwa-update', tone: 'info', title: 'Nueva versión disponible', message: prompt.message, action: { label: 'Actualizar', onClick: () => void prompt.apply() } })
      },
    })
    return () => controller.dispose()
  }, [])

  const navItems = useMemo(() => [
    { id: 'itinerary', label: 'Itinerario', icon: <Icon name="route" />, onSelect: () => setTab('itinerary') },
    { id: 'map', label: 'Mapa', icon: <Icon name="map" />, onSelect: () => setTab('map') },
    { id: 'expenses', label: 'Gastos', icon: <Icon name="wallet" />, onSelect: () => setTab('expenses') },
    { id: 'more', label: 'Más', icon: <Icon name="more" />, onSelect: () => setTab('more') },
  ], [])

  const profile = workspace.participants.find((person) => person.id === workspace.profileParticipantId)
  const topBar = <TopBar
    title="Ruta Austral"
    titleAs="p"
    eyebrow={tabLabels[tab]}
    subtitle={profile ? `Editando como ${profile.name}` : 'Viaje compartido'}
    leading={<span className="brand-mark" aria-hidden="true"><Icon name="compass" /></span>}
    actions={<>
      <IconButton icon={<Icon name="undo" />} label="Deshacer" disabled={!canUndo} onClick={() => void undo()} />
      <IconButton icon={<Icon name="refresh" />} label="Rehacer" disabled={!canRedo} onClick={() => void redo()} />
    </>}
    status={<SyncPill status={syncPillStatus(syncStatus.state)} label={syncStatus.message} details={syncStatus.pendingCount ? `${syncStatus.pendingCount} cambios pendientes` : undefined} onClick={() => void syncNow()} />}
  />

  if (loading) return <div className="boot-screen"><span className="brand-mark"><Icon name="compass" /></span><strong>Preparando Ruta Austral</strong><p>Abriendo tu copia offline…</p></div>

  return (
    <AppShell mainId="main-content" topBar={topBar} bottomNav={<BottomNav items={navItems} activeId={tab} onChange={(id) => setTab(id as MainTab)} />} toastRegion={<ToastRegion notices={notices} onDismiss={dismiss} />}>
      <Suspense fallback={<div className="view-loading" role="status">Preparando vista…</div>}>
        {tab === 'itinerary' && <ItineraryView addRequest={addRequest} onAddRequestHandled={() => setAddRequest(0)} />}
        {tab === 'map' && <MapView />}
        {tab === 'expenses' && <ExpensesView />}
        {tab === 'more' && <MoreView />}
      </Suspense>
      <button className="global-fab" type="button" onClick={() => { setTab('itinerary'); setAddRequest((value) => value + 1) }} aria-label="Agregar al itinerario"><Icon name="plus" /><span>Agregar</span></button>
      {updatePrompt && <span className="sr-only">Hay una actualización pendiente</span>}
    </AppShell>
  )
}
