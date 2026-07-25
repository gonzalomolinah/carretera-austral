import { LEGACY_STORAGE_KEY } from '../domain/constants'
import { createSeedWorkspace, planIds } from '../domain/seed'
import type { ItineraryItem, ItemType, Workspace } from '../domain/types'
import { normalizeWorkspace, parseWorkspace } from '../domain/validation'
import { getMeta, readWorkspace, setMeta, writeWorkspace } from './localDb'

interface LegacyDay {
  id?: unknown
  name?: unknown
}

interface LegacyItem {
  id?: unknown
  dayId?: unknown
  order?: unknown
  kind?: unknown
  name?: unknown
  location?: unknown
  start?: unknown
  end?: unknown
  type?: unknown
  duration?: unknown
  cost?: unknown
  notes?: unknown
  mapUrl?: unknown
  reservationUrl?: unknown
  marks?: Record<string, unknown>
}

interface LegacyState {
  days?: LegacyDay[]
  items?: LegacyItem[]
}

interface LegacyStore {
  selectedPlanKey?: string
  plans?: Record<string, LegacyState>
}

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value.trim() : fallback)
const number = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const legacyType = (item: LegacyItem): ItemType => {
  const value = text(item.type).toLowerCase()
  const kind = text(item.kind).toLowerCase()
  if (kind === 'trip' || value.includes('traslado') || value.includes('ferry') || value.includes('logística')) return 'transit'
  if (item.marks?.lodging) return 'lodging'
  if (value.includes('gastronom')) return 'meal'
  return value ? 'activity' : 'other'
}

const ensureLegacyStore = (raw: unknown): LegacyStore | null => {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as LegacyStore & LegacyState
  if (candidate.plans && typeof candidate.plans === 'object') return candidate
  if (Array.isArray(candidate.days) && Array.isArray(candidate.items)) {
    return { selectedPlanKey: 'general', plans: { general: candidate } }
  }
  return null
}

function migrateLegacy(raw: string): Workspace | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const store = ensureLegacyStore(parsed)
  if (!store?.plans) return null
  const workspace = createSeedWorkspace()
  workspace.days = []
  workspace.items = []
  const now = new Date().toISOString()
  const planMap: Record<string, string> = planIds

  for (const [planKey, legacyPlan] of Object.entries(store.plans)) {
    const planId = planMap[planKey]
    if (!planId || !legacyPlan || !Array.isArray(legacyPlan.days) || !Array.isArray(legacyPlan.items)) continue
    const dayMap = new Map<string, string>()
    legacyPlan.days.forEach((legacyDay, index) => {
      const dayId = crypto.randomUUID()
      dayMap.set(text(legacyDay.id, `day-${index + 1}`), dayId)
      workspace.days.push({
        id: dayId,
        tripId: workspace.trip.id,
        planId,
        title: text(legacyDay.name, `Día ${index + 1}`),
        ordinal: index + 1,
        date: null,
        notes: '',
        updatedAt: now,
        deletedAt: null,
      })
    })

    legacyPlan.items.forEach((legacyItem, index) => {
      const origin = text(legacyItem.start)
      const destination = text(legacyItem.end)
      const marks = legacyItem.marks ?? {}
      const item: ItineraryItem = {
        id: crypto.randomUUID(),
        tripId: workspace.trip.id,
        planId,
        dayId: typeof legacyItem.dayId === 'string' ? dayMap.get(legacyItem.dayId) ?? null : null,
        type: legacyType(legacyItem),
        title: text(legacyItem.name, origin && destination ? `${origin} → ${destination}` : 'Sin título'),
        location: text(legacyItem.location, origin && destination ? `${origin} → ${destination}` : ''),
        origin,
        destination,
        startTime: null,
        endTime: null,
        durationMinutes: Math.max(0, Math.round(number(legacyItem.duration) * 60)),
        order: number(legacyItem.order) || index,
        status: marks.done ? 'done' : marks.booked ? 'booked' : 'planned',
        isMust: Boolean(marks.must),
        assigneeParticipantId: null,
        estimateClp: Math.max(0, Math.round(number(legacyItem.cost))),
        actualClp: 0,
        notes: text(legacyItem.notes),
        mapUrl: text(legacyItem.mapUrl),
        reservationUrl: text(legacyItem.reservationUrl),
        coordinates: null,
        locationPending: false,
        updatedAt: now,
        deletedAt: null,
      }
      workspace.items.push(item)
    })
  }

  workspace.selectedPlanId = planMap[store.selectedPlanKey ?? 'general'] ?? planIds.general
  workspace.updatedAt = now
  return normalizeWorkspace(workspace)
}

export async function loadOrMigrateWorkspace(): Promise<{ workspace: Workspace; migratedLegacy: boolean }> {
  const seed = createSeedWorkspace()
  const existing = await readWorkspace(seed.trip.id)
  if (existing) {
    try {
      return { workspace: parseWorkspace(existing), migratedLegacy: false }
    } catch {
      await setMeta('invalidWorkspaceRecovery', existing)
      await writeWorkspace(seed)
      return { workspace: seed, migratedLegacy: false }
    }
  }

  const migrationFinished = await getMeta<boolean>('legacyMigrationFinished')
  if (!migrationFinished) {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw) {
      const migrated = migrateLegacy(raw)
      if (migrated) {
        await setMeta('legacyRecoveryBlob', raw)
        await setMeta('legacyMigrationFinished', true)
        await writeWorkspace(migrated)
        return { workspace: migrated, migratedLegacy: true }
      }
    }
  }

  await setMeta('legacyMigrationFinished', true)
  await writeWorkspace(seed)
  return { workspace: seed, migratedLegacy: false }
}
