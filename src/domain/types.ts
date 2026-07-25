export const WORKSPACE_SCHEMA_VERSION = 3 as const

export type Id = string
export type ThemeMode = 'system' | 'light' | 'dark'
export type PlanKind = 'final' | 'proposal' | 'recovery'
export type ItemType = 'activity' | 'transit' | 'lodging' | 'meal' | 'fuel' | 'other'
export type ItemStatus = 'idea' | 'planned' | 'booked' | 'done'
export type ExpenseStatus = 'estimated' | 'actual'
export type SyncState = 'local' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error'

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface Trip {
  id: Id
  name: string
  startDate: string | null
  timezone: string
  currency: 'CLP'
  attachmentLimitBytes: number
  createdAt: string
  updatedAt: string
}

export interface Participant {
  id: Id
  tripId: Id
  name: string
  color: string
  active: boolean
  order: number
}

export interface Plan {
  id: Id
  tripId: Id
  key: string
  name: string
  kind: PlanKind
  ownerParticipantId: Id | null
  basedOnPlanId: Id | null
  createdAt: string
  updatedAt: string
}

export interface TripDay {
  id: Id
  tripId: Id
  planId: Id
  title: string
  ordinal: number
  date: string | null
  notes: string
  updatedAt: string
  deletedAt: string | null
}

export interface ItineraryItem {
  id: Id
  tripId: Id
  planId: Id
  dayId: Id | null
  type: ItemType
  title: string
  location: string
  origin: string
  destination: string
  startTime: string | null
  endTime: string | null
  durationMinutes: number
  order: number
  status: ItemStatus
  isMust: boolean
  assigneeParticipantId: Id | null
  estimateClp: number
  actualClp: number
  notes: string
  mapUrl: string
  reservationUrl: string
  coordinates: Coordinates | null
  locationPending: boolean
  updatedAt: string
  deletedAt: string | null
}

export interface ExpenseSplit {
  participantId: Id
  amountClp: number
  percentage: number
  settled: boolean
}

export interface Expense {
  id: Id
  tripId: Id
  title: string
  amountClp: number
  status: ExpenseStatus
  payerParticipantId: Id | null
  date: string
  category: 'transport' | 'lodging' | 'food' | 'activity' | 'fuel' | 'other'
  linkedItemId: Id | null
  notes: string
  splits: ExpenseSplit[]
  updatedAt: string
  deletedAt: string | null
}

export interface ChecklistTask {
  id: Id
  tripId: Id
  title: string
  category: string
  completed: boolean
  dueDate: string | null
  assigneeParticipantId: Id | null
  linkedDayId: Id | null
  linkedItemId: Id | null
  updatedAt: string
  deletedAt: string | null
}

export interface TripContact {
  id: Id
  tripId: Id
  name: string
  role: string
  phone: string
  email: string
  url: string
  notes: string
  updatedAt: string
  deletedAt: string | null
}

export interface TripDocument {
  id: Id
  tripId: Id
  title: string
  kind: 'link' | 'attachment'
  url: string
  attachmentId: Id | null
  linkedItemId: Id | null
  notes: string
  updatedAt: string
  deletedAt: string | null
}

export interface AttachmentRecord {
  id: Id
  tripId: Id
  linkedItemId: Id | null
  filename: string
  mimeType: string
  sizeBytes: number
  objectPath: string | null
  status: 'local' | 'uploading' | 'uploaded' | 'failed'
  createdAt: string
}

export interface Workspace {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION
  trip: Trip
  participants: Participant[]
  plans: Plan[]
  days: TripDay[]
  items: ItineraryItem[]
  expenses: Expense[]
  tasks: ChecklistTask[]
  contacts: TripContact[]
  documents: TripDocument[]
  selectedPlanId: Id
  profileParticipantId: Id | null
  lastServerSequence: number
  updatedAt: string
}

export type EntityKind =
  | 'trip'
  | 'participant'
  | 'plan'
  | 'day'
  | 'item'
  | 'expense'
  | 'task'
  | 'contact'
  | 'document'

export interface PendingOperation {
  id: Id
  tripId: Id
  entityKind: EntityKind
  entityId: Id
  action: 'upsert' | 'delete'
  payload: unknown
  createdAt: string
  attempts: number
  status: 'pending' | 'syncing' | 'failed'
  error: string | null
}

export interface SnapshotRecord {
  id: Id
  tripId: Id
  reason: string
  workspace: Workspace
  createdAt: string
}

export interface SyncStatus {
  state: SyncState
  pendingCount: number
  lastSyncedAt: string | null
  message: string
}

export type MainTab = 'itinerary' | 'map' | 'expenses' | 'more'

