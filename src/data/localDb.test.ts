import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedWorkspace } from '../domain/seed'
import type { PendingOperation } from '../domain/types'
import { localDb, pendingOperations, persistWorkspaceMutation } from './localDb'

const operation = (id: string, title: string): PendingOperation => ({
  id,
  tripId: createSeedWorkspace().trip.id,
  entityKind: 'item',
  entityId: 'f0dfc587-7993-4dba-9d10-717ff1ed0001',
  action: 'upsert',
  payload: { id: 'f0dfc587-7993-4dba-9d10-717ff1ed0001', title },
  createdAt: '2026-07-18T12:00:00.000Z',
  attempts: 0,
  status: 'pending',
  error: null,
})

const tripOperation = (
  id: string,
  payload: PendingOperation['payload'],
  createdAt: string,
): PendingOperation => ({
  id,
  tripId: createSeedWorkspace().trip.id,
  entityKind: 'trip',
  entityId: createSeedWorkspace().trip.id,
  action: 'upsert',
  payload,
  createdAt,
  attempts: 0,
  status: 'pending',
  error: null,
})

describe('outbox local', () => {
  beforeEach(async () => {
    await Promise.all([
      localDb.workspaces.clear(),
      localDb.operations.clear(),
      localDb.snapshots.clear(),
      localDb.attachments.clear(),
      localDb.meta.clear(),
    ])
  })

  it('compacta operaciones consecutivas de la misma entidad', async () => {
    const workspace = createSeedWorkspace()
    const first = operation('018f7738-259e-7cd0-ac72-a0008d7340f1', 'Primero')
    const last = operation('018f7738-259e-7cd0-ac72-a0008d7340f2', 'Último')
    await persistWorkspaceMutation(workspace, [first, last])

    const queued = await pendingOperations(workspace.trip.id)
    expect(queued).toHaveLength(1)
    expect(queued[0].id).toBe(last.id)
  })

  it('recupera una operación que quedó sincronizando tras un cierre abrupto', async () => {
    const workspace = createSeedWorkspace()
    const queued = { ...operation('018f7738-259e-7cd0-ac72-a0008d7340f3', 'Pendiente'), status: 'syncing' as const }
    await persistWorkspaceMutation(workspace, [queued])

    expect((await pendingOperations(workspace.trip.id)).map((entry) => entry.id)).toEqual([queued.id])
  })

  it('conserva un workspace completo antes de una actualizacion posterior del viaje', async () => {
    const workspace = createSeedWorkspace()
    const fullWorkspace = tripOperation(
      '018f7738-259e-7cd0-ac72-a0008d7340f4',
      { fullWorkspace: workspace },
      '2026-07-18T12:00:00.000Z',
    )
    const tripUpdate = tripOperation(
      '018f7738-259e-7cd0-ac72-a0008d7340f5',
      { ...workspace.trip, name: 'Ruta actualizada' },
      '2026-07-18T12:00:01.000Z',
    )

    await persistWorkspaceMutation(workspace, [fullWorkspace])
    await persistWorkspaceMutation(workspace, [tripUpdate])

    expect((await pendingOperations(workspace.trip.id)).map((entry) => entry.id)).toEqual([
      fullWorkspace.id,
      tripUpdate.id,
    ])
  })

  it('un workspace completo posterior reemplaza todos los deltas locales previos', async () => {
    const workspace = createSeedWorkspace()
    const itemUpdate = operation('018f7738-259e-7cd0-ac72-a0008d7340f6', 'Cambio local')
    const tripUpdate = tripOperation(
      '018f7738-259e-7cd0-ac72-a0008d7340f7',
      { ...workspace.trip, name: 'Nombre previo' },
      '2026-07-18T12:00:01.000Z',
    )
    const fullWorkspace = tripOperation(
      '018f7738-259e-7cd0-ac72-a0008d7340f8',
      { fullWorkspace: workspace },
      '2026-07-18T12:00:02.000Z',
    )

    await persistWorkspaceMutation(workspace, [itemUpdate, tripUpdate])
    await persistWorkspaceMutation(workspace, [fullWorkspace])

    expect((await pendingOperations(workspace.trip.id)).map((entry) => entry.id)).toEqual([fullWorkspace.id])
  })
})
