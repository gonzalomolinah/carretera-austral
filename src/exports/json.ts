import {
  exportLocalAttachments,
  validateLocalAttachmentBackupEntries,
  type LocalAttachmentBackupEntry,
} from '../data/attachments';
import type { Workspace } from '../domain/types';
import { parseWorkspace } from '../domain/validation';

const DEFAULT_MIME_TYPE = 'application/octet-stream';
export const WORKSPACE_BACKUP_KIND = 'ruta-austral-workspace-backup' as const;
export const WORKSPACE_BACKUP_VERSION = 1 as const;
export const MAX_WORKSPACE_BACKUP_FILE_BYTES = 350 * 1024 * 1024;

export interface JsonExportOptions {
  filename?: string;
  pretty?: boolean;
  now?: Date;
}

export interface JsonExportResult {
  filename: string;
  content: string;
  blob: Blob;
}

export interface WorkspaceBackupV1 {
  kind: typeof WORKSPACE_BACKUP_KIND;
  version: typeof WORKSPACE_BACKUP_VERSION;
  exportedAt: string;
  workspace: Workspace;
  attachments: LocalAttachmentBackupEntry[];
  missingAttachmentIds: string[];
}

export interface WorkspaceBackupExportResult extends JsonExportResult {
  backup: WorkspaceBackupV1;
  attachmentCount: number;
  attachmentBytes: number;
}

export interface ParsedWorkspaceBackup {
  format: 'bundle-v1' | 'legacy-workspace';
  workspace: Workspace;
  attachments: LocalAttachmentBackupEntry[];
  missingAttachmentIds: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function normalizedExtension(extension: string): string {
  return extension.replace(/^\.+/, '').toLowerCase() || 'txt';
}

export function createExportFilename(
  label: string,
  extension: string,
  now: Date = new Date(),
): string {
  const safeLabel = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  const date = Number.isNaN(now.getTime()) ? new Date() : now;
  const datePart = date.toISOString().slice(0, 10);

  return `${safeLabel || 'ruta-austral'}-${datePart}.${normalizedExtension(extension)}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('La descarga sólo está disponible desde un navegador.');
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // WebKit necesita que la URL sobreviva al evento que inicia la descarga.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

/** Exportación legada: conserva el Workspace, pero no contiene blobs locales. */
export function createWorkspaceJsonExport(
  workspace: Workspace,
  options: JsonExportOptions = {},
): JsonExportResult {
  const content = JSON.stringify(workspace, null, options.pretty === false ? 0 : 2);
  const filename =
    options.filename ?? createExportFilename(workspace.trip.name, 'json', options.now);

  return {
    filename,
    content,
    blob: new Blob([content], { type: 'application/json;charset=utf-8' }),
  };
}

/**
 * Crea el formato versionado actual. Incluye todos los blobs locales que sigan
 * disponibles y declara de forma explícita los ids que faltan en el dispositivo.
 */
export async function createWorkspaceBackupExport(
  workspace: Workspace,
  options: JsonExportOptions = {},
): Promise<WorkspaceBackupExportResult> {
  const snapshot = await exportLocalAttachments(workspace);
  const exportedAt = (options.now ?? new Date()).toISOString();
  const backup: WorkspaceBackupV1 = {
    kind: WORKSPACE_BACKUP_KIND,
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt,
    workspace,
    attachments: snapshot.attachments,
    missingAttachmentIds: snapshot.missingAttachmentIds,
  };
  const content = JSON.stringify(backup, null, options.pretty === false ? 0 : 2);
  const filename =
    options.filename ?? createExportFilename(workspace.trip.name, 'json', options.now);
  return {
    filename,
    content,
    blob: new Blob([content], { type: 'application/json;charset=utf-8' }),
    backup,
    attachmentCount: snapshot.attachments.length,
    attachmentBytes: snapshot.totalBytes,
  };
}

export async function downloadWorkspaceBackup(
  workspace: Workspace,
  options: JsonExportOptions = {},
): Promise<WorkspaceBackupExportResult> {
  const result = await createWorkspaceBackupExport(workspace, options);
  downloadBlob(result.blob, result.filename);
  return result;
}

/** Acepta el bundle actual y también un Workspace JSON previo sin envoltorio. */
export function parseWorkspaceBackup(input: unknown): ParsedWorkspaceBackup {
  if (!isRecord(input) || input.kind !== WORKSPACE_BACKUP_KIND) {
    return {
      format: 'legacy-workspace',
      workspace: parseWorkspace(input),
      attachments: [],
      missingAttachmentIds: [],
    };
  }
  if (input.version !== WORKSPACE_BACKUP_VERSION) {
    throw new Error(`La versión ${String(input.version)} del respaldo no es compatible.`);
  }
  if (typeof input.exportedAt !== 'string' || !Number.isFinite(Date.parse(input.exportedAt))) {
    throw new Error('El respaldo no tiene una fecha de exportación válida.');
  }
  const workspace = parseWorkspace(input.workspace);
  const attachments = validateLocalAttachmentBackupEntries(input.attachments);
  if (!Array.isArray(input.missingAttachmentIds) || input.missingAttachmentIds.length > 5_000) {
    throw new Error('El manifiesto de adjuntos faltantes no es válido.');
  }
  const referencedIds = new Set(
    workspace.documents
      .filter((document) => !document.deletedAt && document.kind === 'attachment' && document.attachmentId)
      .map((document) => document.attachmentId as string),
  );
  const includedIds = new Set(attachments.map((attachment) => attachment.id));
  for (const attachment of attachments) {
    if (!referencedIds.has(attachment.id) || attachment.tripId !== workspace.trip.id) {
      throw new Error('El respaldo incluye un adjunto que no pertenece al workspace.');
    }
  }
  const missingAttachmentIds = [...new Set(input.missingAttachmentIds.map((id) => {
    if (typeof id !== 'string' || !referencedIds.has(id)) {
      throw new Error('El respaldo declara un adjunto faltante que no pertenece al workspace.');
    }
    return id;
  }))].filter((id) => !includedIds.has(id));
  const declaredMissingIds = new Set(missingAttachmentIds);
  if ([...referencedIds].some((id) => !includedIds.has(id) && !declaredMissingIds.has(id))) {
    throw new Error('El manifiesto del respaldo omite uno o más archivos adjuntos.');
  }

  return { format: 'bundle-v1', workspace, attachments, missingAttachmentIds };
}

export function downloadWorkspaceJson(
  workspace: Workspace,
  options: JsonExportOptions = {},
): JsonExportResult {
  const result = createWorkspaceJsonExport(workspace, options);
  downloadBlob(result.blob, result.filename);
  return result;
}

export function downloadText(
  content: string,
  filename: string,
  mimeType = DEFAULT_MIME_TYPE,
): Blob {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
  return blob;
}
