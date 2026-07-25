import Dexie, { type EntityTable } from 'dexie'
import { LOCAL_DB_NAME } from '../domain/constants'
import type { AttachmentRecord, PendingOperation, SnapshotRecord, Workspace } from '../domain/types'

interface WorkspaceRow {
  id: string
  workspace: Workspace
  updatedAt: string
}

interface MetaRow {
  key: string
  value: unknown
}

export interface LocalAttachment extends AttachmentRecord {
  blob: Blob
}

class RutaAustralDatabase extends Dexie {
  workspaces!: EntityTable<WorkspaceRow, 'id'>
  operations!: EntityTable<PendingOperation, 'id'>
  snapshots!: EntityTable<SnapshotRecord, 'id'>
  attachments!: EntityTable<LocalAttachment, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor() {
    super(LOCAL_DB_NAME)
    this.version(1).stores({
      workspaces: 'id, updatedAt',
      operations: 'id, tripId, entityKind, entityId, status, createdAt',
      snapshots: 'id, tripId, createdAt',
      attachments: 'id, tripId, linkedItemId, status, createdAt',
      meta: 'key',
    })
  }
}

export const localDb = new RutaAustralDatabase()

export async function readWorkspace(tripId: string): Promise<Workspace | null> {
  return (await localDb.workspaces.get(tripId))?.workspace ?? null
}

export async function writeWorkspace(workspace: Workspace): Promise<void> {
  await localDb.workspaces.put({ id: workspace.trip.id, workspace, updatedAt: workspace.updatedAt })
}

export const isFullWorkspaceOperation = (
  operation: PendingOperation,
): operation is PendingOperation & {
  payload: Record<string, unknown> & { fullWorkspace: unknown }
} => {
  if (operation.entityKind !== 'trip' || !operation.payload || typeof operation.payload !== 'object') return false
  return 'fullWorkspace' in operation.payload
}

export async function persistWorkspaceMutation(
  workspace: Workspace,
  operations: PendingOperation[],
  snapshot?: SnapshotRecord,
): Promise<void> {
  await localDb.transaction('rw', localDb.workspaces, localDb.operations, localDb.snapshots, async () => {
    await localDb.workspaces.put({ id: workspace.trip.id, workspace, updatedAt: workspace.updatedAt })
    if (operations.length) {
      let existing = await localDb.operations
        .where('tripId')
        .equals(workspace.trip.id)
        .and((operation) => operation.status !== 'syncing')
        .toArray()
      for (const operation of operations) {
        const superseded = isFullWorkspaceOperation(operation)
          ? existing
          : existing.filter(
              (candidate) =>
                !isFullWorkspaceOperation(candidate) &&
                candidate.entityKind === operation.entityKind &&
                candidate.entityId === operation.entityId,
            )
        if (superseded.length) await localDb.operations.bulkDelete(superseded.map((candidate) => candidate.id))
        await localDb.operations.put(operation)
        existing = [
          ...existing.filter((candidate) => !superseded.some((supersededOperation) => supersededOperation.id === candidate.id)),
          operation,
        ]
      }
    }
    if (snapshot) await localDb.snapshots.put(snapshot)
  })
}

export async function pendingOperations(tripId: string): Promise<PendingOperation[]> {
  return localDb.operations
    .where('tripId')
    .equals(tripId)
    .and((operation) => operation.status === 'pending' || operation.status === 'failed' || operation.status === 'syncing')
    .sortBy('createdAt')
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await localDb.meta.put({ key, value })
}

export async function getMeta<T>(key: string): Promise<T | null> {
  return ((await localDb.meta.get(key))?.value as T | undefined) ?? null
}

export async function pruneSnapshots(tripId: string, keep = 20): Promise<void> {
  const snapshots = await localDb.snapshots.where('tripId').equals(tripId).reverse().sortBy('createdAt')
  if (snapshots.length > keep) await localDb.snapshots.bulkDelete(snapshots.slice(keep).map((snapshot) => snapshot.id))
}
