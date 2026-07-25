import { ATTACHMENT_MAX_BYTES, ATTACHMENT_TOTAL_BYTES } from '../domain/constants'
import type { AttachmentRecord, Workspace } from '../domain/types'
import { localDb, type LocalAttachment } from './localDb'

export const ATTACHMENT_GC_GRACE_DAYS = 30
const ATTACHMENT_GC_GRACE_MS = ATTACHMENT_GC_GRACE_DAYS * 24 * 60 * 60 * 1_000
const MAX_BACKUP_ATTACHMENTS = 5_000
const MAX_DATA_URL_CHARS = Math.ceil(ATTACHMENT_MAX_BYTES / 3) * 4 + 256
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MIME_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i

export interface LocalAttachmentBackupEntry {
  id: string
  tripId: string
  linkedItemId: string | null
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  dataUrl: string
}

export interface LocalAttachmentBackupSnapshot {
  attachments: LocalAttachmentBackupEntry[]
  missingAttachmentIds: string[]
  totalBytes: number
}

export interface AttachmentRestoreSession {
  restoredCount: number
  totalBytes: number
  commit: () => void
  rollback: () => Promise<void>
}

export interface AttachmentGarbageCollectionOptions {
  dryRun?: boolean
  graceMs?: number
  now?: Date
}

export interface AttachmentGarbageCollectionResult {
  count: number
  bytes: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const safeFilename = (value: string): string =>
  value.replace(/[\\/\u0000-\u001f\u007f]+/g, '-').trim().slice(0, 240) || 'adjunto'

const referencedAttachmentIds = (workspace: Workspace, includeDeleted: boolean): Set<string> =>
  new Set(
    workspace.documents
      .filter((document) =>
        document.kind === 'attachment' &&
        document.attachmentId &&
        (includeDeleted || !document.deletedAt),
      )
      .map((document) => document.attachmentId as string),
  )

const blobToDataUrl = async (blob: Blob, mimeType: string): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

const dataUrlToBlob = (entry: LocalAttachmentBackupEntry): Blob => {
  const comma = entry.dataUrl.indexOf(',')
  if (comma < 0) throw new Error(`El adjunto ${entry.filename} no usa un data URL válido.`)
  const header = entry.dataUrl.slice(0, comma)
  const encoded = entry.dataUrl.slice(comma + 1)
  const match = /^data:([^;,]+);base64$/i.exec(header)
  if (!match || match[1].toLowerCase() !== entry.mimeType.toLowerCase()) {
    throw new Error(`El tipo de archivo de ${entry.filename} no coincide con su contenido.`)
  }
  if (encoded.length > MAX_DATA_URL_CHARS || encoded.length % 4 !== 0 || !/^[a-z0-9+/]*={0,2}$/i.test(encoded)) {
    throw new Error(`El adjunto ${entry.filename} tiene datos base64 inválidos.`)
  }
  let binary: string
  try {
    binary = atob(encoded)
  } catch {
    throw new Error(`El adjunto ${entry.filename} tiene datos base64 inválidos.`)
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const blob = new Blob([bytes], { type: entry.mimeType })
  if (blob.size !== entry.sizeBytes) {
    throw new Error(`El tamaño declarado de ${entry.filename} no coincide con el archivo.`)
  }
  return blob
}

export function validateLocalAttachmentBackupEntries(input: unknown): LocalAttachmentBackupEntry[] {
  if (!Array.isArray(input) || input.length > MAX_BACKUP_ATTACHMENTS) {
    throw new Error('El respaldo contiene una lista de adjuntos inválida o demasiado grande.')
  }
  return input.map((value, index) => {
    if (!isRecord(value)) throw new Error(`El adjunto ${index + 1} del respaldo no es válido.`)
    const { id, tripId, linkedItemId, filename, mimeType, sizeBytes, createdAt, dataUrl } = value
    if (
      typeof id !== 'string' || !UUID_PATTERN.test(id) ||
      typeof tripId !== 'string' || !UUID_PATTERN.test(tripId) ||
      (linkedItemId !== null && (typeof linkedItemId !== 'string' || !UUID_PATTERN.test(linkedItemId))) ||
      typeof filename !== 'string' || filename.length < 1 || filename.length > 240 ||
      typeof mimeType !== 'string' || !MIME_PATTERN.test(mimeType) ||
      !Number.isInteger(sizeBytes) || Number(sizeBytes) < 0 || Number(sizeBytes) > ATTACHMENT_MAX_BYTES ||
      typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt)) ||
      typeof dataUrl !== 'string' || dataUrl.length > MAX_DATA_URL_CHARS
    ) {
      throw new Error(`El adjunto ${index + 1} del respaldo tiene metadata inválida.`)
    }
    return {
      id,
      tripId,
      linkedItemId,
      filename: safeFilename(filename),
      mimeType: mimeType.toLowerCase(),
      sizeBytes: Number(sizeBytes),
      createdAt,
      dataUrl,
    }
  })
}

export async function attachmentUsage(tripId: string): Promise<number> {
  const rows = await localDb.attachments.where('tripId').equals(tripId).toArray()
  return rows.reduce((sum, row) => sum + row.sizeBytes, 0)
}

export async function saveLocalAttachment(
  tripId: string,
  file: File,
  linkedItemId: string | null,
): Promise<AttachmentRecord> {
  if (file.size > ATTACHMENT_MAX_BYTES) throw new Error('Cada archivo puede pesar como máximo 10 MB.')
  const used = await attachmentUsage(tripId)
  if (used + file.size > ATTACHMENT_TOTAL_BYTES) throw new Error('Los adjuntos offline alcanzaron el límite de 250 MB.')
  const record: LocalAttachment = {
    id: crypto.randomUUID(),
    tripId,
    linkedItemId,
    filename: file.name.slice(0, 240),
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    objectPath: null,
    status: 'local',
    createdAt: new Date().toISOString(),
    blob: file,
  }
  await localDb.attachments.put(record)
  const { blob: _blob, ...metadata } = record
  return metadata
}

export async function removeLocalAttachment(id: string, tripId: string): Promise<boolean> {
  return localDb.transaction('rw', localDb.attachments, async () => {
    const record = await localDb.attachments.get(id)
    if (!record || record.tripId !== tripId) return false
    await localDb.attachments.delete(id)
    return true
  })
}

export async function exportLocalAttachments(workspace: Workspace): Promise<LocalAttachmentBackupSnapshot> {
  const referencedIds = [...referencedAttachmentIds(workspace, false)]
  const rows = await localDb.attachments.bulkGet(referencedIds)
  const attachments: LocalAttachmentBackupEntry[] = []
  const missingAttachmentIds: string[] = []
  let totalBytes = 0

  for (let index = 0; index < referencedIds.length; index += 1) {
    const id = referencedIds[index]
    const row = rows[index]
    if (!row || row.tripId !== workspace.trip.id || row.blob.size !== row.sizeBytes) {
      missingAttachmentIds.push(id)
      continue
    }
    if (row.sizeBytes > ATTACHMENT_MAX_BYTES || totalBytes + row.sizeBytes > ATTACHMENT_TOTAL_BYTES) {
      missingAttachmentIds.push(id)
      continue
    }
    attachments.push({
      id: row.id,
      tripId: row.tripId,
      linkedItemId: row.linkedItemId,
      filename: safeFilename(row.filename),
      mimeType: MIME_PATTERN.test(row.mimeType) ? row.mimeType.toLowerCase() : 'application/octet-stream',
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
      dataUrl: await blobToDataUrl(
        row.blob,
        MIME_PATTERN.test(row.mimeType) ? row.mimeType.toLowerCase() : 'application/octet-stream',
      ),
    })
    totalBytes += row.sizeBytes
  }

  return { attachments, missingAttachmentIds, totalBytes }
}

/**
 * Valida y escribe todos los blobs como un lote. El caller confirma el lote
 * sólo después de importar el Workspace; si eso falla, rollback restaura las
 * filas anteriores y elimina las nuevas.
 */
export async function stageLocalAttachmentRestore(
  workspace: Workspace,
  input: unknown,
): Promise<AttachmentRestoreSession> {
  const entries = validateLocalAttachmentBackupEntries(input)
  const referencedIds = referencedAttachmentIds(workspace, false)
  const itemIds = new Set(workspace.items.map((item) => item.id))
  const seen = new Set<string>()
  const restoredAt = new Date().toISOString()
  let totalBytes = 0

  const records: LocalAttachment[] = entries.map((entry) => {
    if (seen.has(entry.id)) throw new Error(`El respaldo repite el adjunto ${entry.filename}.`)
    seen.add(entry.id)
    if (entry.tripId !== workspace.trip.id || !referencedIds.has(entry.id)) {
      throw new Error(`El adjunto ${entry.filename} no pertenece a este respaldo.`)
    }
    if (entry.linkedItemId && !itemIds.has(entry.linkedItemId)) {
      throw new Error(`El adjunto ${entry.filename} apunta a una parada inexistente.`)
    }
    const blob = dataUrlToBlob(entry)
    totalBytes += blob.size
    if (totalBytes > ATTACHMENT_TOTAL_BYTES) {
      throw new Error('Los adjuntos del respaldo superan el límite local de 250 MB.')
    }
    return {
      id: entry.id,
      tripId: workspace.trip.id,
      linkedItemId: entry.linkedItemId,
      filename: entry.filename,
      mimeType: entry.mimeType,
      sizeBytes: blob.size,
      objectPath: null,
      status: 'local',
      // Reiniciar la antigüedad evita que el GC borre un archivo recién restaurado.
      createdAt: restoredAt,
      blob,
    }
  })

  const previous = new Map<string, LocalAttachment | undefined>()
  await localDb.transaction('rw', localDb.attachments, async () => {
    const existing = await localDb.attachments.bulkGet(records.map((record) => record.id))
    const tripRows = await localDb.attachments.where('tripId').equals(workspace.trip.id).toArray()
    let projectedBytes = tripRows.reduce((sum, row) => sum + row.sizeBytes, 0)
    existing.forEach((row, index) => {
      const record = records[index]
      if (row && row.tripId !== workspace.trip.id) {
        throw new Error(`El id de ${record.filename} ya pertenece a otro viaje.`)
      }
      previous.set(record.id, row)
      projectedBytes -= row?.sizeBytes ?? 0
      projectedBytes += record.sizeBytes
    })
    if (projectedBytes > ATTACHMENT_TOTAL_BYTES) {
      throw new Error('No hay espacio dentro del límite de 250 MB para restaurar los adjuntos.')
    }
    if (records.length) await localDb.attachments.bulkPut(records)
  })

  let finished = false
  return {
    restoredCount: records.length,
    totalBytes,
    commit() {
      finished = true
    },
    async rollback() {
      if (finished) return
      await localDb.transaction('rw', localDb.attachments, async () => {
        for (const record of records) {
          const oldRecord = previous.get(record.id)
          if (oldRecord) await localDb.attachments.put(oldRecord)
          else await localDb.attachments.delete(record.id)
        }
      })
      finished = true
    },
  }
}

/**
 * Borra exclusivamente blobs sin documento activo ni snapshot recuperable.
 * La gracia protege Undo/Redo en memoria y restauraciones recientes.
 */
export async function collectAttachmentGarbage(
  workspace: Workspace,
  options: AttachmentGarbageCollectionOptions = {},
): Promise<AttachmentGarbageCollectionResult> {
  const graceMs = Math.max(options.graceMs ?? ATTACHMENT_GC_GRACE_MS, 0)
  const now = options.now?.getTime() ?? Date.now()
  return localDb.transaction(
    'rw',
    localDb.attachments,
    localDb.snapshots,
    localDb.workspaces,
    async () => {
      const keep = referencedAttachmentIds(workspace, false)
      const stored = await localDb.workspaces.get(workspace.trip.id)
      if (stored) referencedAttachmentIds(stored.workspace, false).forEach((id) => keep.add(id))
      const snapshots = await localDb.snapshots.where('tripId').equals(workspace.trip.id).toArray()
      snapshots.forEach((snapshot) =>
        referencedAttachmentIds(snapshot.workspace, false).forEach((id) => keep.add(id)),
      )
      const rows = await localDb.attachments.where('tripId').equals(workspace.trip.id).toArray()
      const garbage = rows.filter((row) => {
        const createdAt = Date.parse(row.createdAt)
        return !keep.has(row.id) && Number.isFinite(createdAt) && createdAt <= now - graceMs
      })
      if (!options.dryRun && garbage.length) {
        await localDb.attachments.bulkDelete(garbage.map((row) => row.id))
      }
      return {
        count: garbage.length,
        bytes: garbage.reduce((sum, row) => sum + row.sizeBytes, 0),
      }
    },
  )
}

export async function downloadLocalAttachment(id: string): Promise<void> {
  const record = await localDb.attachments.get(id)
  if (!record) throw new Error('El archivo ya no está disponible en este dispositivo.')
  const url = URL.createObjectURL(record.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = record.filename
  anchor.rel = 'noopener'
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
