import type { RealtimeChannel } from '@supabase/supabase-js'
import type { PendingOperation, SyncStatus, Workspace } from '../domain/types'
import { normalizeWorkspace, parseWorkspace } from '../domain/validation'
import { isFullWorkspaceOperation, localDb, pendingOperations } from '../data/localDb'
import { supabase } from '../lib/supabase'

interface SyncCallbacks {
  onStatus: (status: SyncStatus) => void
  onRemoteWorkspace: (workspace: Workspace, hasExternalChanges: boolean) => void
  onLocalRebase: (workspace: Workspace) => void
}

const initialStatus: SyncStatus = {
  state: navigator.onLine ? 'local' : 'offline',
  pendingCount: 0,
  lastSyncedAt: null,
  message: navigator.onLine ? 'Guardado en este dispositivo' : 'Sin conexión · cambios guardados',
}

const SYNC_RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000] as const

const withDevicePreferences = (remote: Workspace, local: Workspace): Workspace =>
  normalizeWorkspace({
    ...remote,
    selectedPlanId: remote.plans.some((plan) => plan.id === local.selectedPlanId)
      ? local.selectedPlanId
      : remote.selectedPlanId,
    profileParticipantId: remote.participants.some((person) => person.id === local.profileParticipantId)
      ? local.profileParticipantId
      : null,
  })

export class SyncEngine {
  private channel: RealtimeChannel | null = null
  private remoteTripId: string | null = null
  private bootstrapPromise: Promise<void> | null = null
  private running = false
  private rerunRequested = false
  private stopped = false
  private retryAttempt = 0
  private retryTimer: number | null = null
  private callbacks: SyncCallbacks
  private status = initialStatus

  constructor(callbacks: SyncCallbacks) {
    this.callbacks = callbacks
  }

  private emit(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch }
    this.callbacks.onStatus(this.status)
  }

  async start(workspace: Workspace): Promise<void> {
    this.stopped = false
    this.resetRetryBackoff()
    this.emit({ pendingCount: (await pendingOperations(workspace.trip.id)).length })
    await this.syncNow(workspace)
  }

  async handleOnline(workspace: Workspace): Promise<void> {
    if (this.stopped) return
    this.resetRemoteConnection()
    this.resetRetryBackoff()
    await this.syncNow(workspace)
  }

  private async ensureRemoteReady(workspace: Workspace): Promise<void> {
    if (this.remoteTripId === workspace.trip.id && this.channel) return
    if (this.bootstrapPromise) return this.bootstrapPromise

    this.bootstrapPromise = (async () => {
      const { error } = await supabase.rpc('bootstrap_ruta_austral', {
        target_trip_id: workspace.trip.id,
        seed_workspace: workspace,
      })
      if (error) throw error
      if (this.stopped) return
      this.remoteTripId = workspace.trip.id
      this.subscribe(workspace.trip.id)
    })()

    try {
      await this.bootstrapPromise
    } finally {
      this.bootstrapPromise = null
    }
  }

  stop(): void {
    this.stopped = true
    this.rerunRequested = false
    this.resetRetryBackoff()
    this.resetRemoteConnection()
  }

  private resetRemoteConnection(): void {
    if (this.channel) void supabase.removeChannel(this.channel)
    this.channel = null
    this.remoteTripId = null
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private resetRetryBackoff(): void {
    this.clearRetryTimer()
    this.retryAttempt = 0
  }

  private scheduleRetry(tripId: string): void {
    if (
      this.stopped ||
      !navigator.onLine ||
      this.retryTimer !== null ||
      this.retryAttempt >= SYNC_RETRY_DELAYS_MS.length
    ) return

    const delay = SYNC_RETRY_DELAYS_MS[this.retryAttempt]
    this.retryAttempt += 1
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null
      void this.syncLatest(tripId)
    }, delay)
  }

  private scheduleRerun(tripId: string): void {
    if (this.stopped || !navigator.onLine || this.retryTimer !== null) return
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null
      void this.syncLatest(tripId)
    }, 0)
  }

  async markLocalChange(tripId: string): Promise<void> {
    const count = (await pendingOperations(tripId)).length
    this.emit({
      state: navigator.onLine ? 'pending' : 'offline',
      pendingCount: count,
      message: navigator.onLine
        ? `${count} ${count === 1 ? 'cambio pendiente' : 'cambios pendientes'}`
        : 'Sin conexión · cambios guardados',
    })
  }

  async syncNow(localWorkspace: Workspace): Promise<void> {
    if (this.running) {
      this.rerunRequested = true
      return
    }
    if (this.stopped || !navigator.onLine) {
      if (!navigator.onLine) this.emit({ state: 'offline', message: 'Sin conexión · cambios guardados' })
      return
    }

    this.clearRetryTimer()
    this.running = true
    let pendingAfterCount = 0
    let failed = false
    let retryableFailure = true
    const baseUpdatedAt = localWorkspace.updatedAt
    const operations = await pendingOperations(localWorkspace.trip.id)
    this.emit({ state: 'syncing', pendingCount: operations.length, message: 'Sincronizando…' })

    try {
      await this.ensureRemoteReady(localWorkspace)
      if (this.stopped) return
      if (operations.length) await this.pushOperations(localWorkspace.trip.id, operations)
      const remote = await this.pullWorkspace(localWorkspace.trip.id)
      const hasExternalChanges = Boolean(
        remote &&
        remote.lastServerSequence > localWorkspace.lastServerSequence + operations.length,
      )

      const decision = await localDb.transaction(
        'rw',
        localDb.workspaces,
        localDb.operations,
        async () => {
          const pending = await pendingOperations(localWorkspace.trip.id)
          const latest = await localDb.workspaces.get(localWorkspace.trip.id)
          const canApplyRemote = Boolean(
            remote &&
            latest &&
            pending.length === 0 &&
            latest.workspace.updatedAt === baseUpdatedAt,
          )
          if (!canApplyRemote || !remote || !latest) {
            return { pendingCount: pending.length, applied: null as Workspace | null }
          }
          const merged = withDevicePreferences(remote, latest.workspace)
          await localDb.workspaces.put({
            id: merged.trip.id,
            workspace: merged,
            updatedAt: merged.updatedAt,
          })
          return { pendingCount: 0, applied: merged }
        },
      )

      pendingAfterCount = decision.pendingCount
      if (decision.applied) this.callbacks.onRemoteWorkspace(decision.applied, hasExternalChanges)
      this.resetRetryBackoff()
      const lastSyncedAt = new Date().toISOString()
      this.emit({
        state: pendingAfterCount ? 'pending' : 'synced',
        pendingCount: pendingAfterCount,
        lastSyncedAt,
        message: pendingAfterCount
          ? `${pendingAfterCount} ${pendingAfterCount === 1 ? 'cambio pendiente' : 'cambios pendientes'}`
          : 'Sincronizado',
      })
    } catch (error) {
      failed = true
      const message = error instanceof Error ? error.message : 'No se pudo sincronizar.'
      const revisionConflict = /workspace revision conflict/i.test(message)
      retryableFailure = !revisionConflict
      pendingAfterCount = (await pendingOperations(localWorkspace.trip.id)).length
      this.emit({
        state: 'error',
        pendingCount: pendingAfterCount,
        message: revisionConflict
          ? 'Conflicto remoto · cambios locales protegidos'
          : pendingAfterCount ? 'Cambios pendientes' : 'Error de sincronización',
      })
      if (revisionConflict) {
        try {
          const retry = await this.prepareFullWorkspaceConflict(localWorkspace.trip.id)
          window.dispatchEvent(new CustomEvent('ruta-austral:sync-conflict', {
            detail: { retry },
          }))
        } catch (conflictError) {
          console.warn('No se pudo preparar la resolución del conflicto:', conflictError)
          window.dispatchEvent(new CustomEvent('ruta-austral:sync-conflict'))
        }
      }
      console.warn('Sync error:', message)
    } finally {
      this.running = false
      const shouldRerun = this.rerunRequested || (!failed && pendingAfterCount > 0)
      this.rerunRequested = false
      if (failed) {
        if (retryableFailure) this.scheduleRetry(localWorkspace.trip.id)
      } else if (shouldRerun) {
        this.scheduleRerun(localWorkspace.trip.id)
      }
    }
  }

  private async syncLatest(tripId: string): Promise<void> {
    const latest = await localDb.workspaces.get(tripId)
    if (latest) await this.syncNow(latest.workspace)
  }

  private async prepareFullWorkspaceConflict(tripId: string): Promise<() => void> {
    const remote = await this.pullWorkspace(tripId)
    if (!remote) throw new Error('La copia compartida ya no está disponible.')

    const rebased = await localDb.transaction(
      'rw',
      localDb.workspaces,
      localDb.operations,
      async () => {
        const row = await localDb.workspaces.get(tripId)
        if (!row) throw new Error('No existe una copia local para resolver el conflicto.')
        const workspace = { ...row.workspace, lastServerSequence: remote.lastServerSequence }
        await localDb.workspaces.put({ ...row, workspace, updatedAt: workspace.updatedAt })
        await localDb.operations.where('tripId').equals(tripId).modify((operation) => {
          if (!isFullWorkspaceOperation(operation)) return
          operation.payload = {
            ...operation.payload,
            baseServerSequence: remote.lastServerSequence,
          }
          operation.status = 'pending'
          operation.error = null
        })
        return workspace
      },
    )
    this.callbacks.onLocalRebase(rebased)
    return () => { void this.syncLatest(tripId) }
  }

  private async pushOperations(tripId: string, operations: PendingOperation[]): Promise<void> {
    for (let start = 0; start < operations.length; start += 100) {
      const batch = operations.slice(start, start + 100)
      const ids = batch.map((operation) => operation.id)
      await localDb.operations.where('id').anyOf(ids).modify({ status: 'syncing' })
      const wireOperations = batch.map((operation) => ({
        id: operation.id,
        tripId: operation.tripId,
        entityKind: operation.entityKind,
        entityId: operation.entityId,
        action: operation.action,
        payload: operation.payload,
        createdAt: operation.createdAt,
      }))
      const { error } = await supabase.rpc('apply_workspace_operations', {
        target_trip_id: tripId,
        operations: wireOperations,
      })
      if (error) {
        await localDb.operations.where('id').anyOf(ids).modify((operation) => {
          operation.status = 'failed'
          operation.attempts += 1
          operation.error = error.message
        })
        throw error
      }
      await localDb.operations.bulkDelete(ids)
    }
  }

  private async pullWorkspace(tripId: string): Promise<Workspace | null> {
    const { data, error } = await supabase.rpc('get_app_workspace', {
      target_trip_id: tripId,
    })
    if (error) throw error
    if (!data || typeof data !== 'object' || !('trip' in data)) return null
    return parseWorkspace(data)
  }

  private subscribe(tripId: string): void {
    if (this.channel) void supabase.removeChannel(this.channel)
    const channel = supabase
      .channel(`ruta-workspace:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ruta_workspace_documents',
          filter: `trip_id=eq.${tripId}`,
        },
        () => { void this.syncLatest(tripId) },
      )
    this.channel = channel
    channel.subscribe((status) => {
      if (this.stopped || this.channel !== channel) return
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.channel = null
        this.remoteTripId = null
        void supabase.removeChannel(channel)
        if (this.running) this.rerunRequested = true
        else this.scheduleRetry(tripId)
      }
    })
  }
}
