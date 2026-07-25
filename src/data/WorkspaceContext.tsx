import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PropsWithChildren,
} from 'react'
import { createSeedWorkspace } from '../domain/seed'
import type {
  ChecklistTask,
  EntityKind,
  Expense,
  ItineraryItem,
  PendingOperation,
  Plan,
  SnapshotRecord,
  SyncStatus,
  TripContact,
  TripDay,
  TripDocument,
  Workspace,
} from '../domain/types'
import { assertWorkspaceFitsRemote, normalizeWorkspace, parseWorkspace } from '../domain/validation'
import { SyncEngine } from '../sync/syncEngine'
import { loadOrMigrateWorkspace } from './legacyMigration'
import { persistWorkspaceMutation, pruneSnapshots, writeWorkspace } from './localDb'

type MutableEntity = TripDay | ItineraryItem | Expense | ChecklistTask | TripContact | TripDocument | Plan

interface CommitOptions {
  history?: boolean
  snapshotReason?: string
}

interface WorkspaceContextValue {
  workspace: Workspace
  loading: boolean
  syncStatus: SyncStatus
  migratedLegacy: boolean
  canUndo: boolean
  canRedo: boolean
  selectPlan: (planId: string) => Promise<void>
  selectProfile: (participantId: string | null) => Promise<void>
  updateTrip: (patch: Partial<Workspace['trip']>) => Promise<void>
  addDay: () => Promise<TripDay>
  updateDay: (dayId: string, patch: Partial<TripDay>) => Promise<void>
  deleteDay: (dayId: string) => Promise<void>
  addItem: (input: Partial<ItineraryItem>) => Promise<ItineraryItem>
  updateItem: (itemId: string, patch: Partial<ItineraryItem>) => Promise<void>
  deleteItem: (itemId: string) => Promise<void>
  moveItem: (itemId: string, dayId: string | null, direction?: -1 | 1) => Promise<void>
  useProposalAsFinal: (proposalPlanId: string) => Promise<void>
  addExpense: (expense: Expense) => Promise<void>
  updateExpense: (expenseId: string, patch: Partial<Expense>) => Promise<void>
  deleteExpense: (expenseId: string) => Promise<void>
  addTask: (task: ChecklistTask) => Promise<void>
  updateTask: (taskId: string, patch: Partial<ChecklistTask>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  addContact: (contact: TripContact) => Promise<void>
  deleteContact: (contactId: string) => Promise<void>
  addDocument: (document: TripDocument) => Promise<void>
  deleteDocument: (documentId: string) => Promise<void>
  importWorkspace: (workspace: unknown) => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
  syncNow: () => Promise<void>
}

const defaultSyncStatus: SyncStatus = {
  state: navigator.onLine ? 'local' : 'offline',
  pendingCount: 0,
  lastSyncedAt: null,
  message: navigator.onLine ? 'Guardado en este dispositivo' : 'Sin conexión · cambios guardados',
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

const entityKind = (entity: MutableEntity): EntityKind => {
  if ('type' in entity && 'durationMinutes' in entity) return 'item'
  if ('splits' in entity) return 'expense'
  if ('completed' in entity) return 'task'
  if ('phone' in entity) return 'contact'
  if ('attachmentId' in entity) return 'document'
  if ('ordinal' in entity) return 'day'
  return 'plan'
}

const operationFor = (tripId: string, entity: MutableEntity, action: 'upsert' | 'delete' = 'upsert'): PendingOperation => ({
  id: crypto.randomUUID(),
  tripId,
  entityKind: entityKind(entity),
  entityId: entity.id,
  action,
  payload: entity,
  createdAt: new Date().toISOString(),
  attempts: 0,
  status: 'pending',
  error: null,
})

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [workspace, setWorkspace] = useState<Workspace>(() => createSeedWorkspace())
  const [loading, setLoading] = useState(true)
  const [migratedLegacy, setMigratedLegacy] = useState(false)
  const [syncStatus, setSyncStatus] = useState(defaultSyncStatus)
  const [historyVersion, setHistoryVersion] = useState(0)
  const workspaceRef = useRef(workspace)
  const undoStack = useRef<Workspace[]>([])
  const redoStack = useRef<Workspace[]>([])
  const syncEngine = useRef<SyncEngine | null>(null)
  const syncTimer = useRef<number | null>(null)

  const invalidateHistory = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
    setHistoryVersion((value) => value + 1)
  }, [])

  const applyWorkspace = useCallback((next: Workspace) => {
    workspaceRef.current = next
    setWorkspace(next)
  }, [])

  const scheduleSync = useCallback((next: Workspace) => {
    if (syncTimer.current) window.clearTimeout(syncTimer.current)
    syncTimer.current = window.setTimeout(() => void syncEngine.current?.syncNow(next), 900)
  }, [])

  useEffect(() => {
    let active = true
    const engine = new SyncEngine({
      onStatus: (status) => active && setSyncStatus(status),
      onRemoteWorkspace: (remote, hasExternalChanges) => {
        if (!active) return
        const current = workspaceRef.current
        const merged = normalizeWorkspace({
          ...remote,
          selectedPlanId: remote.plans.some((plan) => plan.id === current.selectedPlanId)
            ? current.selectedPlanId
            : remote.selectedPlanId,
          profileParticipantId: current.profileParticipantId,
        })
        if (hasExternalChanges) invalidateHistory()
        applyWorkspace(merged)
      },
      onLocalRebase: (rebased) => {
        if (active) applyWorkspace(rebased)
      },
    })
    syncEngine.current = engine
    void loadOrMigrateWorkspace()
      .then(({ workspace: loaded, migratedLegacy: didMigrate }) => {
        if (!active) return
        applyWorkspace(loaded)
        setMigratedLegacy(didMigrate)
        setLoading(false)
        void engine.start(loaded)
      })
      .catch((error) => {
        console.error('No se pudo abrir la base local:', error)
        setLoading(false)
        setSyncStatus({ state: 'error', pendingCount: 0, lastSyncedAt: null, message: 'Error de almacenamiento local' })
      })

    const flush = () => void engine.syncNow(workspaceRef.current)
    const handleOnline = () => void engine.handleOnline(workspaceRef.current)
    const handleVisibility = () => document.visibilityState === 'visible' && flush()
    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', flush)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      active = false
      engine.stop()
      if (syncTimer.current) window.clearTimeout(syncTimer.current)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', flush)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [applyWorkspace, invalidateHistory])

  const commit = useCallback(
    async (candidate: Workspace, operations: PendingOperation[], options: CommitOptions = {}) => {
      const previous = workspaceRef.current
      const next = normalizeWorkspace({ ...candidate, updatedAt: new Date().toISOString() })
      assertWorkspaceFitsRemote(next)
      if (options.history !== false) {
        undoStack.current = [...undoStack.current.slice(-19), structuredClone(previous)]
        redoStack.current = []
        setHistoryVersion((value) => value + 1)
      }
      const snapshot: SnapshotRecord | undefined = options.snapshotReason
        ? {
            id: crypto.randomUUID(),
            tripId: previous.trip.id,
            reason: options.snapshotReason,
            workspace: structuredClone(previous),
            createdAt: new Date().toISOString(),
          }
        : undefined
      await persistWorkspaceMutation(next, operations, snapshot)
      if (snapshot) void pruneSnapshots(next.trip.id)
      applyWorkspace(next)
      if (options.snapshotReason) {
        window.dispatchEvent(new CustomEvent('ruta-austral:undoable', {
          detail: { message: options.snapshotReason },
        }))
      }
      await syncEngine.current?.markLocalChange(next.trip.id)
      scheduleSync(next)
    },
    [applyWorkspace, scheduleSync],
  )

  const selectPlan = useCallback(async (planId: string) => {
    const current = workspaceRef.current
    if (!current.plans.some((plan) => plan.id === planId)) return
    const next = { ...current, selectedPlanId: planId }
    await writeWorkspace(next)
    applyWorkspace(next)
  }, [applyWorkspace])

  const selectProfile = useCallback(async (participantId: string | null) => {
    const current = workspaceRef.current
    const next = { ...current, profileParticipantId: participantId }
    await writeWorkspace(next)
    applyWorkspace(next)
  }, [applyWorkspace])

  const updateTrip = useCallback(async (patch: Partial<Workspace['trip']>) => {
    const current = workspaceRef.current
    const trip = { ...current.trip, ...patch, updatedAt: new Date().toISOString() }
    const operation: PendingOperation = {
      id: crypto.randomUUID(), tripId: trip.id, entityKind: 'trip', entityId: trip.id, action: 'upsert', payload: trip,
      createdAt: trip.updatedAt, attempts: 0, status: 'pending', error: null,
    }
    await commit({ ...current, trip }, [operation])
  }, [commit])

  const addDay = useCallback(async () => {
    const current = workspaceRef.current
    const planDays = current.days.filter((day) => day.planId === current.selectedPlanId && !day.deletedAt)
    const nextOrdinal = Math.max(0, ...planDays.map((day) => day.ordinal)) + 1
    const now = new Date().toISOString()
    const day: TripDay = {
      id: crypto.randomUUID(), tripId: current.trip.id, planId: current.selectedPlanId,
      title: `Día ${nextOrdinal}`, ordinal: nextOrdinal, date: null, notes: '', updatedAt: now, deletedAt: null,
    }
    await commit({ ...current, days: [...current.days, day] }, [operationFor(current.trip.id, day)])
    return day
  }, [commit])

  const updateDay = useCallback(async (dayId: string, patch: Partial<TripDay>) => {
    const current = workspaceRef.current
    let changed: TripDay | null = null
    const days = current.days.map((day) => {
      if (day.id !== dayId) return day
      changed = { ...day, ...patch, updatedAt: new Date().toISOString() }
      return changed
    })
    if (changed) await commit({ ...current, days }, [operationFor(current.trip.id, changed)])
  }, [commit])

  const deleteDay = useCallback(async (dayId: string) => {
    const current = workspaceRef.current
    const now = new Date().toISOString()
    const changedDay = current.days.find((day) => day.id === dayId)
    if (!changedDay) return
    const deletedDay = { ...changedDay, deletedAt: now, updatedAt: now }
    const changedItems = current.items
      .filter((item) => item.dayId === dayId && !item.deletedAt)
      .map((item) => ({ ...item, dayId: null, updatedAt: now }))
    await commit(
      {
        ...current,
        days: current.days.map((day) => (day.id === dayId ? deletedDay : day)),
        items: current.items.map((item) => changedItems.find((candidate) => candidate.id === item.id) ?? item),
      },
      [operationFor(current.trip.id, deletedDay, 'delete'), ...changedItems.map((item) => operationFor(current.trip.id, item))],
      { snapshotReason: `Eliminar ${changedDay.title}` },
    )
  }, [commit])

  const addItem = useCallback(async (input: Partial<ItineraryItem>) => {
    const current = workspaceRef.current
    const now = new Date().toISOString()
    const siblingCount = current.items.filter((item) => item.planId === current.selectedPlanId && item.dayId === (input.dayId ?? null)).length
    const item: ItineraryItem = {
      id: crypto.randomUUID(), tripId: current.trip.id, planId: current.selectedPlanId, dayId: input.dayId ?? null,
      type: input.type ?? 'activity', title: input.title?.trim() || 'Nueva parada', location: input.location ?? '',
      origin: input.origin ?? '', destination: input.destination ?? '', startTime: input.startTime ?? null,
      endTime: input.endTime ?? null, durationMinutes: input.durationMinutes ?? 0, order: siblingCount,
      status: input.status ?? 'planned', isMust: input.isMust ?? false,
      assigneeParticipantId: input.assigneeParticipantId ?? null, estimateClp: input.estimateClp ?? 0,
      actualClp: input.actualClp ?? 0, notes: input.notes ?? '', mapUrl: input.mapUrl ?? '',
      reservationUrl: input.reservationUrl ?? '', coordinates: input.coordinates ?? null,
      locationPending: input.locationPending ?? false, updatedAt: now, deletedAt: null,
    }
    await commit({ ...current, items: [...current.items, item] }, [operationFor(current.trip.id, item)])
    return item
  }, [commit])

  const updateItem = useCallback(async (itemId: string, patch: Partial<ItineraryItem>) => {
    const current = workspaceRef.current
    let changed: ItineraryItem | null = null
    const items = current.items.map((item) => {
      if (item.id !== itemId) return item
      changed = { ...item, ...patch, updatedAt: new Date().toISOString() }
      return changed
    })
    if (changed) await commit({ ...current, items }, [operationFor(current.trip.id, changed)])
  }, [commit])

  const deleteItem = useCallback(async (itemId: string) => {
    const current = workspaceRef.current
    const existing = current.items.find((item) => item.id === itemId)
    if (!existing) return
    const deleted = { ...existing, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await commit(
      { ...current, items: current.items.map((item) => (item.id === itemId ? deleted : item)) },
      [operationFor(current.trip.id, deleted, 'delete')],
      { snapshotReason: `Eliminar ${existing.title}` },
    )
  }, [commit])

  const moveItem = useCallback(async (itemId: string, dayId: string | null, direction?: -1 | 1) => {
    const current = workspaceRef.current
    const item = current.items.find((candidate) => candidate.id === itemId)
    if (!item) return
    const now = new Date().toISOString()

    if (direction && item.dayId === dayId) {
      const siblings = current.items
        .filter((candidate) => candidate.planId === item.planId && candidate.dayId === dayId && !candidate.deletedAt)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      const currentIndex = siblings.findIndex((candidate) => candidate.id === itemId)
      const targetIndex = Math.max(0, Math.min(siblings.length - 1, currentIndex + direction))
      if (currentIndex < 0 || currentIndex === targetIndex) return
      const reordered = [...siblings]
      const [moving] = reordered.splice(currentIndex, 1)
      reordered.splice(targetIndex, 0, moving)
      const changedById = new Map(
        reordered
          .map((candidate, order) => candidate.order === order
            ? null
            : [candidate.id, { ...candidate, order, updatedAt: now }] as const)
          .filter((entry): entry is readonly [string, ItineraryItem] => entry !== null),
      )
      const changed = [...changedById.values()]
      await commit(
        { ...current, items: current.items.map((candidate) => changedById.get(candidate.id) ?? candidate) },
        changed.map((candidate) => operationFor(current.trip.id, candidate)),
      )
      return
    }

    const order = current.items.filter(
      (candidate) => candidate.planId === item.planId && candidate.dayId === dayId && !candidate.deletedAt && candidate.id !== item.id,
    ).length
    const changed = { ...item, dayId, order, updatedAt: now }
    await commit(
      { ...current, items: current.items.map((candidate) => candidate.id === itemId ? changed : candidate) },
      [operationFor(current.trip.id, changed)],
    )
  }, [commit])

  const useProposalAsFinal = useCallback(async (proposalPlanId: string) => {
    const current = workspaceRef.current
    const proposal = current.plans.find((plan) => plan.id === proposalPlanId && plan.kind === 'proposal')
    const finalPlan = current.plans.find((plan) => plan.kind === 'final')
    if (!proposal || !finalPlan) return
    const now = new Date().toISOString()
    const sourceDays = current.days.filter((day) => day.planId === proposal.id && !day.deletedAt)
    const dayMap = new Map<string, string>()
    const newDays = sourceDays.map((day) => {
      const id = crypto.randomUUID(); dayMap.set(day.id, id)
      return { ...day, id, planId: finalPlan.id, updatedAt: now }
    })
    const newItems = current.items.filter((item) => item.planId === proposal.id && !item.deletedAt).map((item) => ({
      ...item, id: crypto.randomUUID(), planId: finalPlan.id, dayId: item.dayId ? dayMap.get(item.dayId) ?? null : null, updatedAt: now,
    }))
    const oldDays = current.days.filter((day) => day.planId === finalPlan.id && !day.deletedAt).map((day) => ({ ...day, deletedAt: now, updatedAt: now }))
    const oldItems = current.items.filter((item) => item.planId === finalPlan.id && !item.deletedAt).map((item) => ({ ...item, deletedAt: now, updatedAt: now }))
    const next = {
      ...current, selectedPlanId: finalPlan.id,
      days: [...current.days.map((day) => oldDays.find((old) => old.id === day.id) ?? day), ...newDays],
      items: [...current.items.map((item) => oldItems.find((old) => old.id === item.id) ?? item), ...newItems],
    }
    await commit(next, [
      ...oldDays.map((day) => operationFor(current.trip.id, day, 'delete')),
      ...oldItems.map((item) => operationFor(current.trip.id, item, 'delete')),
      ...newDays.map((day) => operationFor(current.trip.id, day)),
      ...newItems.map((item) => operationFor(current.trip.id, item)),
    ], { snapshotReason: `Usar ${proposal.name} como itinerario final` })
  }, [commit])

  const addExpense = useCallback(async (expense: Expense) => {
    const current = workspaceRef.current
    await commit({ ...current, expenses: [...current.expenses, expense] }, [operationFor(current.trip.id, expense)])
  }, [commit])

  const updateExpense = useCallback(async (expenseId: string, patch: Partial<Expense>) => {
    const current = workspaceRef.current
    let changed: Expense | null = null
    const expenses = current.expenses.map((expense) => {
      if (expense.id !== expenseId) return expense
      changed = { ...expense, ...patch, updatedAt: new Date().toISOString() }
      return changed
    })
    if (changed) await commit({ ...current, expenses }, [operationFor(current.trip.id, changed)])
  }, [commit])

  const deleteExpense = useCallback(async (expenseId: string) => {
    const current = workspaceRef.current
    const expense = current.expenses.find((candidate) => candidate.id === expenseId)
    if (!expense) return
    const deleted = { ...expense, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await commit(
      { ...current, expenses: current.expenses.map((candidate) => candidate.id === expenseId ? deleted : candidate) },
      [operationFor(current.trip.id, deleted, 'delete')],
      { snapshotReason: `Eliminar ${expense.title}` },
    )
  }, [commit])

  const addTask = useCallback(async (task: ChecklistTask) => {
    const current = workspaceRef.current
    await commit({ ...current, tasks: [...current.tasks, task] }, [operationFor(current.trip.id, task)])
  }, [commit])

  const updateTask = useCallback(async (taskId: string, patch: Partial<ChecklistTask>) => {
    const current = workspaceRef.current
    let changed: ChecklistTask | null = null
    const tasks = current.tasks.map((task) => {
      if (task.id !== taskId) return task
      changed = { ...task, ...patch, updatedAt: new Date().toISOString() }; return changed
    })
    if (changed) await commit({ ...current, tasks }, [operationFor(current.trip.id, changed)])
  }, [commit])

  const deleteTask = useCallback(async (taskId: string) => {
    const current = workspaceRef.current
    const task = current.tasks.find((candidate) => candidate.id === taskId); if (!task) return
    const deleted = { ...task, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await commit(
      { ...current, tasks: current.tasks.map((candidate) => candidate.id === taskId ? deleted : candidate) },
      [operationFor(current.trip.id, deleted, 'delete')],
      { snapshotReason: `Eliminar ${task.title}` },
    )
  }, [commit])

  const addContact = useCallback(async (contact: TripContact) => {
    const current = workspaceRef.current
    await commit({ ...current, contacts: [...current.contacts, contact] }, [operationFor(current.trip.id, contact)])
  }, [commit])

  const deleteContact = useCallback(async (contactId: string) => {
    const current = workspaceRef.current
    const contact = current.contacts.find((candidate) => candidate.id === contactId); if (!contact) return
    const deleted = { ...contact, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await commit(
      { ...current, contacts: current.contacts.map((candidate) => candidate.id === contactId ? deleted : candidate) },
      [operationFor(current.trip.id, deleted, 'delete')],
      { snapshotReason: `Eliminar ${contact.name}` },
    )
  }, [commit])

  const addDocument = useCallback(async (document: TripDocument) => {
    const current = workspaceRef.current
    await commit({ ...current, documents: [...current.documents, document] }, [operationFor(current.trip.id, document)])
  }, [commit])

  const deleteDocument = useCallback(async (documentId: string) => {
    const current = workspaceRef.current
    const document = current.documents.find((candidate) => candidate.id === documentId); if (!document) return
    const deleted = { ...document, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await commit(
      { ...current, documents: current.documents.map((candidate) => candidate.id === documentId ? deleted : candidate) },
      [operationFor(current.trip.id, deleted, 'delete')],
      { snapshotReason: `Eliminar ${document.title}` },
    )
  }, [commit])

  const importWorkspace = useCallback(async (input: unknown) => {
    const parsed = parseWorkspace(input)
    const current = workspaceRef.current
    if (parsed.trip.id !== current.trip.id) {
      throw new Error('El respaldo pertenece a otro viaje y no puede reemplazar esta ruta.')
    }
    const next = { ...parsed, lastServerSequence: current.lastServerSequence }
    const op: PendingOperation = {
      id: crypto.randomUUID(), tripId: next.trip.id, entityKind: 'trip', entityId: next.trip.id,
      action: 'upsert', payload: {
        fullWorkspace: next,
        baseServerSequence: current.lastServerSequence,
      }, createdAt: new Date().toISOString(), attempts: 0, status: 'pending', error: null,
    }
    await commit(next, [op], { snapshotReason: 'Importar respaldo JSON' })
  }, [commit])

  const restoreFromStack = useCallback(async (from: MutableRefObject<Workspace[]>, to: MutableRefObject<Workspace[]>) => {
    const target = from.current.pop(); if (!target) return
    const current = workspaceRef.current
    to.current.push(structuredClone(current))
    const now = new Date().toISOString()
    const restored = { ...target, updatedAt: now, lastServerSequence: current.lastServerSequence }
    assertWorkspaceFitsRemote(restored)
    const op: PendingOperation = {
      id: crypto.randomUUID(), tripId: restored.trip.id, entityKind: 'trip', entityId: restored.trip.id,
      action: 'upsert', payload: {
        fullWorkspace: restored,
        baseServerSequence: current.lastServerSequence,
      }, createdAt: now, attempts: 0, status: 'pending', error: null,
    }
    await persistWorkspaceMutation(restored, [op])
    applyWorkspace(restored)
    setHistoryVersion((value) => value + 1)
    await syncEngine.current?.markLocalChange(restored.trip.id)
    scheduleSync(restored)
  }, [applyWorkspace, scheduleSync])

  const undo = useCallback(() => restoreFromStack(undoStack, redoStack), [restoreFromStack])
  const redo = useCallback(() => restoreFromStack(redoStack, undoStack), [restoreFromStack])
  const syncNow = useCallback(() => syncEngine.current?.syncNow(workspaceRef.current) ?? Promise.resolve(), [])

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspace, loading, syncStatus, migratedLegacy,
    canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0,
    selectPlan, selectProfile, updateTrip, addDay, updateDay, deleteDay,
    addItem, updateItem, deleteItem, moveItem, useProposalAsFinal,
    addExpense, updateExpense, deleteExpense, addTask, updateTask, deleteTask,
    addContact, deleteContact, addDocument, deleteDocument, importWorkspace,
    undo, redo, syncNow,
  }), [
    workspace, loading, syncStatus, migratedLegacy, historyVersion, selectPlan, selectProfile, updateTrip,
    addDay, updateDay, deleteDay, addItem, updateItem, deleteItem, moveItem, useProposalAsFinal,
    addExpense, updateExpense, deleteExpense, addTask, updateTask, deleteTask, addContact, deleteContact,
    addDocument, deleteDocument, importWorkspace, undo, redo, syncNow,
  ])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace debe usarse dentro de WorkspaceProvider.')
  return value
}
