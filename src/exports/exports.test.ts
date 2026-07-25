import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '../data/localDb'
import { createSeedWorkspace } from '../domain/seed'
import { createPlanGpx } from './gpx'
import { createPlanCalendarEvents } from './ics'
import {
  WORKSPACE_BACKUP_KIND,
  WORKSPACE_BACKUP_VERSION,
  createWorkspaceBackupExport,
  createWorkspaceJsonExport,
  parseWorkspaceBackup,
} from './json'

describe('exportaciones offline', () => {
  beforeEach(async () => {
    await localDb.attachments.clear()
  })

  it('produce un JSON que conserva el workspace', () => {
    const workspace = createSeedWorkspace()
    const result = createWorkspaceJsonExport(workspace, { now: new Date('2026-07-18T00:00:00Z') })
    expect(JSON.parse(result.content)).toEqual(workspace)
    expect(result.filename).toBe('ruta-austral-2026-07-18.json')
  })

  it('acepta el JSON de Workspace antiguo al importar', () => {
    const workspace = createSeedWorkspace()
    const parsed = parseWorkspaceBackup(JSON.parse(createWorkspaceJsonExport(workspace).content))

    expect(parsed.format).toBe('legacy-workspace')
    expect(parsed.workspace).toEqual(workspace)
    expect(parsed.attachments).toEqual([])
  })

  it('crea un respaldo versionado con los adjuntos locales disponibles', async () => {
    const workspace = createSeedWorkspace()
    const attachmentId = '018f7738-259e-7cd0-ac72-a0008d7340fa'
    const blob = new NodeBlob(['reserva'], { type: 'application/pdf' }) as unknown as Blob
    workspace.documents.push({
      id: '018f7738-259e-7cd0-ac72-a0008d7340fb',
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
    await localDb.attachments.put({
      id: attachmentId,
      tripId: workspace.trip.id,
      linkedItemId: null,
      filename: 'reserva.pdf',
      mimeType: 'application/pdf',
      sizeBytes: blob.size,
      objectPath: null,
      status: 'local',
      createdAt: '2026-07-18T00:00:00.000Z',
      blob,
    })

    const result = await createWorkspaceBackupExport(workspace, {
      now: new Date('2026-07-18T00:00:00.000Z'),
    })
    const parsed = parseWorkspaceBackup(JSON.parse(result.content) as unknown)

    expect(result.backup.kind).toBe(WORKSPACE_BACKUP_KIND)
    expect(result.backup.version).toBe(WORKSPACE_BACKUP_VERSION)
    expect(parsed.format).toBe('bundle-v1')
    expect(parsed.attachments).toHaveLength(1)
    expect(parsed.attachments[0].dataUrl).toBe('data:application/pdf;base64,cmVzZXJ2YQ==')
    expect(result.attachmentCount).toBe(1)
    expect(result.backup.missingAttachmentIds).toEqual([])
  })

  it('rechaza un bundle que omite el archivo y tampoco lo declara faltante', () => {
    const workspace = createSeedWorkspace()
    workspace.documents.push({
      id: '018f7738-259e-7cd0-ac72-a0008d7340fd',
      tripId: workspace.trip.id,
      title: 'Reserva',
      kind: 'attachment',
      url: '',
      attachmentId: '018f7738-259e-7cd0-ac72-a0008d7340fc',
      linkedItemId: null,
      notes: '',
      updatedAt: '2026-07-18T00:00:00.000Z',
      deletedAt: null,
    })

    expect(() => parseWorkspaceBackup({
      kind: WORKSPACE_BACKUP_KIND,
      version: WORKSPACE_BACKUP_VERSION,
      exportedAt: '2026-07-18T00:00:00.000Z',
      workspace,
      attachments: [],
      missingAttachmentIds: [],
    })).toThrow(/omite/i)
  })

  it('genera waypoints y ruta GPX solo con coordenadas válidas', () => {
    const workspace = createSeedWorkspace()
    workspace.items[0].coordinates = { latitude: -41.47, longitude: -72.94 }
    workspace.items[1].coordinates = { latitude: -42.39, longitude: -72.42 }
    const gpx = createPlanGpx(workspace)
    expect(gpx).toContain('<wpt lat="-41.47" lon="-72.94">')
    expect(gpx).toContain('<rte>')
    expect(gpx.match(/<rtept/g)).toHaveLength(2)
    expect(gpx).not.toContain('<trk>')
  })

  it('deriva la fecha ICS desde el ordinal aunque falten días intermedios', () => {
    const workspace = createSeedWorkspace()
    const deletedDay = { ...workspace.days[0], ordinal: 1, deletedAt: '2026-07-18T12:00:00.000Z' }
    const activeDay = { ...workspace.days[2], ordinal: 3, date: null, deletedAt: null }
    workspace.trip.startDate = '2026-07-01'
    workspace.days = [deletedDay, activeDay]
    workspace.items = [{
      ...workspace.items[0],
      planId: activeDay.planId,
      dayId: activeDay.id,
      startTime: '09:30',
      deletedAt: null,
    }]

    const result = createPlanCalendarEvents(workspace)

    expect(result.events).toHaveLength(1)
    expect(result.events[0].start).toEqual([2026, 7, 3, 9, 30])
    expect(result.warnings).toEqual([])
  })
})
