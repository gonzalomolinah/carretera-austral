import {
  ATTACHMENT_TOTAL_BYTES,
  DEFAULT_TRIP_ID,
  TIMEZONE,
  participantPalette,
} from './constants'
import { WORKSPACE_SCHEMA_VERSION, type ItineraryItem, type Workspace } from './types'

const createdAt = '2026-07-18T12:00:00.000Z'
const planIds = {
  general: 'ff49b2dd-89f5-472d-9676-b828bc85cd11',
  molina: '13de7857-edb0-4cba-8979-e578c9b922c1',
  inaki: '5526ca17-8c76-4074-8480-3b45ad7c7df0',
  nef: '41fd21c8-4aee-420f-b4ea-9111d50a8e35',
  ross: '56d690a1-410a-4ef5-b8eb-0b772968e1ab',
} as const

const people = ['Molina', 'Iñaki', 'Nef', 'Ross'] as const

const seedStops = [
  ['Llegada a Puerto Montt y provisiones', 'Puerto Montt', 'other', 180, 'Base sugerida para salir temprano al día siguiente.'],
  ['Navegación Hornopirén → Caleta Gonzalo', 'Hornopirén / Caleta Gonzalo', 'transit', 300, 'Reservar el tramo bimodal con anticipación.'],
  ['Parque Pumalín', 'Chaitén - Caleta Gonzalo', 'activity', 240, ''],
  ['Ruta a Futaleufú', 'Futaleufú', 'transit', 360, 'Opción de cruce a Argentina según clima y papeles.'],
  ['Raúl Marín Balmaceda y entorno Queulat', 'La Junta', 'activity', 240, ''],
  ['Isla Magdalena', 'Puerto Cisnes', 'activity', 180, ''],
  ['Parque Queulat y termas', 'Puyuhuapi', 'activity', 360, ''],
  ['Reserva Nacional Río Simpson', 'Coyhaique', 'activity', 180, ''],
  ['Capillas de Mármol', 'Puerto Río Tranquilo', 'activity', 180, ''],
  ['Río Baker: kayak o rafting', 'Puerto Bertrand', 'activity', 240, ''],
  ['Reserva Nacional Jeinimeni', 'Chile Chico', 'activity', 300, ''],
  ['Parque Patagonia y Tamango', 'Cochrane', 'activity', 360, ''],
  ['Pasarelas de Caleta Tortel', 'Caleta Tortel', 'activity', 300, ''],
  ['Puerto Yungay y conexión a Villa O’Higgins', 'Villa O’Higgins', 'transit', 300, 'Cierre o extensión del itinerario.'],
] as const

export function createSeedWorkspace(): Workspace {
  const participants = people.map((name, index) => ({
    id: `2d1015f0-aaf1-46b2-9f93-0a10ab4c4f0${index + 1}`,
    tripId: DEFAULT_TRIP_ID,
    name,
    color: participantPalette[index],
    active: true,
    order: index,
  }))

  const plans = [
    { id: planIds.general, key: 'general', name: 'Itinerario final', kind: 'final' as const, ownerParticipantId: null },
    ...people.map((name, index) => ({
      id: planIds[name === 'Iñaki' ? 'inaki' : name.toLowerCase() as 'molina' | 'nef' | 'ross'],
      key: name === 'Iñaki' ? 'inaki' : name.toLowerCase(),
      name: `Propuesta de ${name}`,
      kind: 'proposal' as const,
      ownerParticipantId: participants[index].id,
    })),
  ].map((plan) => ({
    ...plan,
    tripId: DEFAULT_TRIP_ID,
    basedOnPlanId: null,
    createdAt,
    updatedAt: createdAt,
  }))

  const days = Array.from({ length: 12 }, (_, index) => ({
    id: `bd8e0d0e-3c31-4bb0-94b9-8465c5d25${String(index + 1).padStart(3, '0')}`,
    tripId: DEFAULT_TRIP_ID,
    planId: planIds.general,
    title: `Día ${index + 1}`,
    ordinal: index + 1,
    date: null,
    notes: '',
    updatedAt: createdAt,
    deletedAt: null,
  }))

  const items: ItineraryItem[] = seedStops.map(([title, location, type, durationMinutes, notes], index) => ({
    id: `f0dfc587-7993-4dba-9d10-717ff1ed${String(index + 1).padStart(4, '0')}`,
    tripId: DEFAULT_TRIP_ID,
    planId: planIds.general,
    dayId: days[Math.min(index, days.length - 1)].id,
    type,
    title,
    location,
    origin: '',
    destination: '',
    startTime: null,
    endTime: null,
    durationMinutes,
    order: index,
    status: index === 1 ? 'booked' : 'planned',
    isMust: [0, 1, 2, 6, 8, 11, 12].includes(index),
    assigneeParticipantId: null,
    estimateClp: 0,
    actualClp: 0,
    notes,
    mapUrl: '',
    reservationUrl: '',
    coordinates: null,
    locationPending: false,
    updatedAt: createdAt,
    deletedAt: null,
  }))

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    trip: {
      id: DEFAULT_TRIP_ID,
      name: 'Ruta Austral',
      startDate: null,
      timezone: TIMEZONE,
      currency: 'CLP',
      attachmentLimitBytes: ATTACHMENT_TOTAL_BYTES,
      createdAt,
      updatedAt: createdAt,
    },
    participants,
    plans,
    days,
    items,
    expenses: [],
    tasks: [],
    contacts: [],
    documents: [],
    selectedPlanId: planIds.general,
    profileParticipantId: null,
    lastServerSequence: 0,
    updatedAt: createdAt,
  }
}

export { planIds }
