import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedWorkspace } from '../domain/seed'
import type { Workspace } from '../domain/types'
import {
  collectAttachmentGarbage,
  stageLocalAttachmentRestore,
  type LocalAttachmentBackupEntry,
} from './attachments'
import { localDb } from './localDb'

const attachmentId = '018f7738-259e-7cd0-ac72-a0008d7340fc'

const readBlob = (blob: Blob): Promise<string> => blob.text()

const workspaceWithAttachment = (): Workspace => {
  const workspace = createSeedWorkspace()
  workspace.documents.push({
    id: '018f7738-259e-7cd0-ac72-a0008d7340fd',
    tripId: workspace.trip.id,
    title: 'Reserva',
    kind: 'attachment',
    url: '',
    attachmentId,
    linkedItemId: null,
    notes: '',
    updatedAt: '2026-07-18T00:00:00.000Z',
    deletedAt: null,
  })
  return workspace
}

const backupEntry = (tripId: string): LocalAttachmentBackupEntry => ({
  id: attachmentId,
  tripId,
  linkedItemId: null,
  filename: 'reserva.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 7,
  createdAt: '2026-07-18T00:00:00.000Z',
  dataUrl: 'data:application/pdf;base64,YXJjaGl2bw==',
})

describe('adjuntos locales', () => {
  beforeAll(() => {
    vi.stubGlobal('Blob', NodeBlob)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(async () => {
    await Promise.all([
      localDb.workspaces.clear(),
      localDb.operations.clear(),
      localDb.snapshots.clear(),
      localDb.attachments.clear(),
      localDb.meta.clear(),
    ])
  })

  it('restaura un lote y revierte los blobs si falla la importación posterior', async () => {
    const workspace = workspaceWithAttachment()
    const previousBlob = new NodeBlob(['viejo'], { type: 'application/pdf' }) as unknown as Blob
    await localDb.attachments.put({
      id: attachmentId,
      tripId: workspace.trip.id,
      linkedItemId: null,
      filename: 'anterior.pdf',
      mimeType: 'application/pdf',
      sizeBytes: previousBlob.size,
      objectPath: null,
      status: 'local',
      createdAt: '2026-01-01T00:00:00.000Z',
      blob: previousBlob,
    })

    const restore = await stageLocalAttachmentRestore(workspace, [backupEntry(workspace.trip.id)])
    const staged = await localDb.attachments.get(attachmentId)
    expect(staged).toBeDefined()
    expect(staged && await readBlob(staged.blob)).toBe('archivo')

    await restore.rollback()
    const restoredPrevious = await localDb.attachments.get(attachmentId)
    expect(restoredPrevious?.filename).toBe('anterior.pdf')
    expect(restoredPrevious && await readBlob(restoredPrevious.blob)).toBe('viejo')
  })

  it('el GC conserva archivos recuperables por snapshot y borra sólo huérfanos antiguos', async () => {
    const workspace = createSeedWorkspace()
    const protectedWorkspace = workspaceWithAttachment()
    const orphanId = '018f7738-259e-7cd0-ac72-a0008d7340fe'
    const oldBlob = new NodeBlob(['viejo'], { type: 'application/pdf' }) as unknown as Blob
    await localDb.attachments.bulkPut([
      {
        id: attachmentId,
        tripId: workspace.trip.id,
        linkedItemId: null,
        filename: 'protegido.pdf',
        mimeType: 'application/pdf',
        sizeBytes: oldBlob.size,
        objectPath: null,
        status: 'local',
        createdAt: '2026-01-01T00:00:00.000Z',
        blob: oldBlob,
      },
      {
        id: orphanId,
        tripId: workspace.trip.id,
        linkedItemId: null,
        filename: 'huérfano.pdf',
        mimeType: 'application/pdf',
        sizeBytes: oldBlob.size,
        objectPath: null,
        status: 'local',
        createdAt: '2026-01-01T00:00:00.000Z',
        blob: oldBlob,
      },
    ])
    await localDb.snapshots.put({
      id: '018f7738-259e-7cd0-ac72-a0008d7340ff',
      tripId: workspace.trip.id,
      reason: 'Eliminar Reserva',
      workspace: protectedWorkspace,
      createdAt: '2026-07-01T00:00:00.000Z',
    })

    const result = await collectAttachmentGarbage(workspace, {
      now: new Date('2026-07-18T00:00:00.000Z'),
      graceMs: 30 * 24 * 60 * 60 * 1_000,
    })

    expect(result).toEqual({ count: 1, bytes: oldBlob.size })
    expect(await localDb.attachments.get(attachmentId)).toBeDefined()
    expect(await localDb.attachments.get(orphanId)).toBeUndefined()
  })
})
