import type { ItemStatus, ItemType } from './types'

export const LEGACY_STORAGE_KEY = 'carretera-austral-planner-v2'
export const LOCAL_DB_NAME = 'ruta-austral-local-v3'
export const DEFAULT_TRIP_ID = '4d1fe1a8-4f21-4d76-9f45-7fa2b1f74d40'
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
export const ATTACHMENT_TOTAL_BYTES = 250 * 1024 * 1024
// Deja margen para el envoltorio de la operación dentro del límite RPC de 8 MiB.
export const WORKSPACE_SYNC_MAX_BYTES = 7 * 1024 * 1024
export const TIMEZONE = 'America/Santiago'

export const participantPalette = ['#cf5b32', '#377a70', '#8a6d24', '#6e5a94']

export const itemTypeMeta: Record<ItemType, { label: string; icon: string }> = {
  activity: { label: 'Actividad', icon: 'activity' },
  transit: { label: 'Traslado / ferry', icon: 'route' },
  lodging: { label: 'Alojamiento', icon: 'bed' },
  meal: { label: 'Comida', icon: 'utensils' },
  fuel: { label: 'Combustible', icon: 'fuel' },
  other: { label: 'Otro', icon: 'pin' },
}

export const itemStatusMeta: Record<ItemStatus, { label: string }> = {
  idea: { label: 'Idea' },
  planned: { label: 'Planificado' },
  booked: { label: 'Reservado' },
  done: { label: 'Completado' },
}

export const formatClp = (value: number): string =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value || 0)))

export const formatBytes = (value: number): string => {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
