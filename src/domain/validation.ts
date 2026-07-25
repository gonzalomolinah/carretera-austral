import { z } from 'zod'
import { WORKSPACE_SYNC_MAX_BYTES } from './constants'
import { WORKSPACE_SCHEMA_VERSION, type Workspace } from './types'

const idSchema = z.string().uuid()
const nullableIdSchema = idSchema.nullable()
const timestampSchema = z.string().min(1).max(100)
const nullableTextSchema = z.string().max(100).nullable()

const participantSchema = z.object({
  id: idSchema,
  tripId: idSchema,
  name: z.string(),
  color: z.string(),
  active: z.boolean(),
  order: z.number(),
})

const planSchema = z.object({
  id: idSchema,
  tripId: idSchema,
  key: z.string(),
  name: z.string(),
  kind: z.enum(['final', 'proposal', 'recovery']),
  ownerParticipantId: nullableIdSchema,
  basedOnPlanId: nullableIdSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const daySchema = z.object({
  id: idSchema,
  tripId: idSchema,
  planId: idSchema,
  title: z.string(),
  ordinal: z.number(),
  date: nullableTextSchema,
  notes: z.string(),
  updatedAt: timestampSchema,
  deletedAt: nullableTextSchema,
})

const itemSchema = z.object({
  id: idSchema,
  tripId: idSchema,
  planId: idSchema,
  dayId: nullableIdSchema,
  type: z.enum(['activity', 'transit', 'lodging', 'meal', 'fuel', 'other']),
  title: z.string(),
  location: z.string(),
  origin: z.string(),
  destination: z.string(),
  startTime: nullableTextSchema,
  endTime: nullableTextSchema,
  durationMinutes: z.number(),
  order: z.number(),
  status: z.enum(['idea', 'planned', 'booked', 'done']),
  isMust: z.boolean(),
  assigneeParticipantId: nullableIdSchema,
  estimateClp: z.number(),
  actualClp: z.number(),
  notes: z.string(),
  mapUrl: z.string(),
  reservationUrl: z.string(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).nullable(),
  locationPending: z.boolean(),
  updatedAt: timestampSchema,
  deletedAt: nullableTextSchema,
})

const expenseSchema = z.object({
  id: idSchema,
  tripId: idSchema,
  title: z.string(),
  amountClp: z.number(),
  status: z.enum(['estimated', 'actual']),
  payerParticipantId: nullableIdSchema,
  date: z.string(),
  category: z.enum(['transport', 'lodging', 'food', 'activity', 'fuel', 'other']),
  linkedItemId: nullableIdSchema,
  notes: z.string(),
  splits: z.array(z.object({
    participantId: idSchema,
    amountClp: z.number(),
    percentage: z.number(),
    settled: z.boolean(),
  })).max(100),
  updatedAt: timestampSchema,
  deletedAt: nullableTextSchema,
})

const taskSchema = z.object({
  id: idSchema,
  tripId: idSchema,
  title: z.string(),
  category: z.string(),
  completed: z.boolean(),
  dueDate: nullableTextSchema,
  assigneeParticipantId: nullableIdSchema,
  linkedDayId: nullableIdSchema,
  linkedItemId: nullableIdSchema,
  updatedAt: timestampSchema,
  deletedAt: nullableTextSchema,
})

const contactSchema = z.object({
  id: idSchema,
  tripId: idSchema,
  name: z.string(),
  role: z.string(),
  phone: z.string(),
  email: z.string(),
  url: z.string(),
  notes: z.string(),
  updatedAt: timestampSchema,
  deletedAt: nullableTextSchema,
})

const documentSchema = z.object({
  id: idSchema,
  tripId: idSchema,
  title: z.string(),
  kind: z.enum(['link', 'attachment']),
  url: z.string(),
  attachmentId: nullableIdSchema,
  linkedItemId: nullableIdSchema,
  notes: z.string(),
  updatedAt: timestampSchema,
  deletedAt: nullableTextSchema,
})

const workspaceBoundarySchema = z.object({
  schemaVersion: z.number().int().min(1),
  trip: z.object({
    id: idSchema,
    name: z.string(),
    startDate: nullableTextSchema,
    timezone: z.string(),
    currency: z.literal('CLP'),
    attachmentLimitBytes: z.number(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  }),
  participants: z.array(participantSchema).min(1).max(100),
  plans: z.array(planSchema).min(1).max(100),
  days: z.array(daySchema).max(2_000),
  items: z.array(itemSchema).max(20_000),
  expenses: z.array(expenseSchema).max(20_000),
  tasks: z.array(taskSchema).max(20_000),
  contacts: z.array(contactSchema).max(2_000),
  documents: z.array(documentSchema).max(5_000),
  selectedPlanId: idSchema,
  profileParticipantId: nullableIdSchema,
  lastServerSequence: z.number().int().nonnegative(),
  updatedAt: timestampSchema,
})

const safeText = (value: unknown, max = 500): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

export const sanitizeUrl = (value: unknown): string => {
  const text = safeText(value, 2000)
  if (!text) return ''
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export const sanitizeMoney = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable()

export const workspaceJsonBytes = (workspace: Workspace): number =>
  new TextEncoder().encode(JSON.stringify(workspace)).byteLength

export function assertWorkspaceFitsRemote(workspace: Workspace): void {
  if (workspaceJsonBytes(workspace) > WORKSPACE_SYNC_MAX_BYTES) {
    throw new Error('El viaje supera el límite de sincronización de 7 MB. Reduce notas o elimina datos antes de continuar.')
  }
}

const uniqueById = <T extends { id: string }>(entries: T[]): T[] => {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  })
}

export function parseWorkspace(input: unknown): Workspace {
  const result = workspaceBoundarySchema.safeParse(input)
  if (!result.success) {
    const firstIssue = result.error.issues[0]
    const location = firstIssue?.path.length ? ` (${firstIssue.path.join('.')})` : ''
    throw new Error(`El respaldo no tiene un formato de Ruta Austral válido${location}.`)
  }
  const workspace = normalizeWorkspace(result.data as Workspace)
  assertWorkspaceFitsRemote(workspace)
  return workspace
}

export function normalizeWorkspace(input: Workspace): Workspace {
  const now = new Date().toISOString()
  const participants = uniqueById(input.participants)
  const plans = uniqueById(input.plans)
  const days = uniqueById(input.days)
  const items = uniqueById(input.items)
  const participantIds = new Set(participants.map((person) => person.id))
  const planIds = new Set(plans.map((plan) => plan.id))
  const activeDayIds = new Set(days.filter((day) => !day.deletedAt).map((day) => day.id))
  const itemIds = new Set(items.map((item) => item.id))
  const selectedPlanId = planIds.has(input.selectedPlanId) ? input.selectedPlanId : plans[0]?.id ?? ''
  const dayPlanIds = new Map(days.map((day) => [day.id, planIds.has(day.planId) ? day.planId : selectedPlanId]))

  return {
    ...input,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    trip: {
      ...input.trip,
      name: safeText(input.trip.name, 120) || 'Ruta Austral',
      currency: 'CLP',
      updatedAt: input.trip.updatedAt || now,
    },
    participants: participants.map((person, index) => ({
      ...person,
      tripId: input.trip.id,
      name: safeText(person.name, 60) || `Viajero ${index + 1}`,
      order: Number.isFinite(person.order) ? person.order : index,
    })),
    plans: plans.map((plan) => ({
      ...plan,
      tripId: input.trip.id,
      key: safeText(plan.key, 60) || plan.id,
      name: safeText(plan.name, 100) || 'Propuesta',
      ownerParticipantId: plan.ownerParticipantId && participantIds.has(plan.ownerParticipantId) ? plan.ownerParticipantId : null,
      basedOnPlanId: plan.basedOnPlanId && planIds.has(plan.basedOnPlanId) ? plan.basedOnPlanId : null,
    })),
    days: days.map((day) => ({
      ...day,
      tripId: input.trip.id,
      planId: planIds.has(day.planId) ? day.planId : selectedPlanId,
      title: safeText(day.title, 100) || `Día ${day.ordinal}`,
      notes: safeText(day.notes, 5000),
      ordinal: Math.max(1, Math.round(day.ordinal || 1)),
    })),
    items: items.map((item, index) => {
      const resolvedPlanId = planIds.has(item.planId) ? item.planId : selectedPlanId
      return {
        ...item,
        tripId: input.trip.id,
        planId: resolvedPlanId,
        dayId: item.dayId && activeDayIds.has(item.dayId) && dayPlanIds.get(item.dayId) === resolvedPlanId
          ? item.dayId
          : null,
        title: safeText(item.title, 180) || 'Sin título',
        location: safeText(item.location, 240),
        origin: safeText(item.origin, 240),
        destination: safeText(item.destination, 240),
        durationMinutes: Math.max(0, Math.round(Number(item.durationMinutes) || 0)),
        order: Number.isFinite(item.order) ? item.order : index,
        assigneeParticipantId:
          item.assigneeParticipantId && participantIds.has(item.assigneeParticipantId) ? item.assigneeParticipantId : null,
        estimateClp: sanitizeMoney(item.estimateClp),
        actualClp: sanitizeMoney(item.actualClp),
        notes: safeText(item.notes, 10_000),
        mapUrl: sanitizeUrl(item.mapUrl),
        reservationUrl: sanitizeUrl(item.reservationUrl),
      }
    }),
    expenses: uniqueById(input.expenses).map((expense) => ({
      ...expense,
      tripId: input.trip.id,
      title: safeText(expense.title, 180) || 'Gasto',
      amountClp: sanitizeMoney(expense.amountClp),
      notes: safeText(expense.notes, 5000),
      payerParticipantId: expense.payerParticipantId && participantIds.has(expense.payerParticipantId)
        ? expense.payerParticipantId
        : null,
      linkedItemId: expense.linkedItemId && itemIds.has(expense.linkedItemId) ? expense.linkedItemId : null,
      splits: expense.splits
        .filter((split) => participantIds.has(split.participantId))
        .map((split) => ({
          ...split,
          amountClp: sanitizeMoney(split.amountClp),
          percentage: Number.isFinite(split.percentage) ? Math.max(0, split.percentage) : 0,
        })),
    })),
    tasks: uniqueById(input.tasks).map((task) => ({
      ...task,
      tripId: input.trip.id,
      title: safeText(task.title, 180) || 'Tarea',
      category: safeText(task.category, 80),
      assigneeParticipantId: task.assigneeParticipantId && participantIds.has(task.assigneeParticipantId)
        ? task.assigneeParticipantId
        : null,
      linkedDayId: task.linkedDayId && activeDayIds.has(task.linkedDayId) ? task.linkedDayId : null,
      linkedItemId: task.linkedItemId && itemIds.has(task.linkedItemId) ? task.linkedItemId : null,
    })),
    contacts: uniqueById(input.contacts).map((contact) => ({
      ...contact,
      tripId: input.trip.id,
      name: safeText(contact.name, 120) || 'Contacto',
      role: safeText(contact.role, 100),
      phone: safeText(contact.phone, 80),
      email: safeText(contact.email, 180),
      url: sanitizeUrl(contact.url),
      notes: safeText(contact.notes, 5000),
    })),
    documents: uniqueById(input.documents).map((document) => ({
      ...document,
      tripId: input.trip.id,
      title: safeText(document.title, 180) || 'Documento',
      url: sanitizeUrl(document.url),
      linkedItemId: document.linkedItemId && itemIds.has(document.linkedItemId) ? document.linkedItemId : null,
      notes: safeText(document.notes, 5000),
    })),
    selectedPlanId,
    profileParticipantId:
      input.profileParticipantId && participantIds.has(input.profileParticipantId) ? input.profileParticipantId : null,
    updatedAt: input.updatedAt || now,
  }
}
