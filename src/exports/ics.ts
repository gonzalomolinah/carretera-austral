import { createEvents, type DateArray, type EventAttributes } from 'ics';
import { getPlanDays, getPlanItems } from '../domain/selectors';
import type { ItineraryItem, ItemType, TripDay, Workspace } from '../domain/types';
import { resolveItemCoordinates } from './geo';
import { createExportFilename, downloadBlob } from './json';

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface CalendarExportWarning {
  code: 'fecha-faltante' | 'sin-dia';
  message: string;
  dayId?: string;
  itemId?: string;
}

export interface CalendarExportOptions {
  planId?: string;
  calendarName?: string;
  defaultStartTime?: string;
  gapMinutes?: number;
  filename?: string;
  now?: Date;
}

export interface CalendarEventsResult {
  calendarName: string;
  events: EventAttributes[];
  warnings: CalendarExportWarning[];
}

export interface CalendarExportResult extends CalendarEventsResult {
  filename: string;
  content: string;
  blob: Blob;
  eventCount: number;
}

const itemTypeLabels: Record<ItemType, string> = {
  activity: 'Actividad',
  transit: 'Traslado / ferry',
  lodging: 'Alojamiento',
  meal: 'Comida',
  fuel: 'Combustible',
  other: 'Otro',
};

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function parseCalendarDate(value: string | null | undefined): CalendarDate | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const candidate: CalendarDate = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const verified = new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day));

  return verified.getUTCFullYear() === candidate.year &&
    verified.getUTCMonth() === candidate.month - 1 &&
    verified.getUTCDate() === candidate.day
    ? candidate
    : null;
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function parseTime(value: string | null | undefined): number | null {
  const match = value?.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function startArray(date: CalendarDate, minutesFromMidnight: number): DateArray {
  const dayOffset = Math.floor(minutesFromMidnight / (24 * 60));
  const normalizedMinutes = ((minutesFromMidnight % (24 * 60)) + 24 * 60) % (24 * 60);
  const eventDate = addDays(date, dayOffset);
  return [
    eventDate.year,
    eventDate.month,
    eventDate.day,
    Math.floor(normalizedMinutes / 60),
    normalizedMinutes % 60,
  ];
}

function eventDuration(item: ItineraryItem, startMinute: number): number {
  const explicitEnd = parseTime(item.endTime);
  if (explicitEnd !== null && item.startTime) {
    const difference = explicitEnd - startMinute;
    return difference > 0 ? difference : difference + 24 * 60;
  }
  return Math.max(15, Math.round(item.durationMinutes || 60));
}

function activePlanName(workspace: Workspace, planId: string): string {
  const plan = workspace.plans.find((candidate) => candidate.id === planId);
  return plan ? `${workspace.trip.name} — ${plan.name}` : workspace.trip.name;
}

function eventLocation(item: ItineraryItem): string {
  if (item.location) return item.location;
  if (item.origin && item.destination) return `${item.origin} → ${item.destination}`;
  return item.origin || item.destination;
}

function eventDescription(
  workspace: Workspace,
  day: TripDay,
  item: ItineraryItem,
): string {
  const costs = [
    item.estimateClp > 0 ? `Estimado: ${clpFormatter.format(item.estimateClp)}` : '',
    item.actualClp > 0 ? `Real: ${clpFormatter.format(item.actualClp)}` : '',
  ].filter(Boolean);

  return [
    `${day.title} · ${itemTypeLabels[item.type]}`,
    `Zona horaria del viaje: ${workspace.trip.timezone}`,
    item.isMust ? 'Marcado como imprescindible.' : '',
    item.notes,
    ...costs,
    item.mapUrl ? `Mapa: ${item.mapUrl}` : '',
    item.reservationUrl ? `Reserva: ${item.reservationUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function stableUid(itemId: string): string {
  const safeId = itemId.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160) || 'parada';
  return `${safeId}@ruta-austral.local`;
}

function dayDate(
  day: TripDay,
  tripStartDate: CalendarDate | null,
): CalendarDate | null {
  return parseCalendarDate(day.date) ?? (tripStartDate ? addDays(tripStartDate, day.ordinal - 1) : null);
}

/** Convierte la propuesta seleccionada a eventos flotantes en la hora local del viaje. */
export function createPlanCalendarEvents(
  workspace: Workspace,
  options: CalendarExportOptions = {},
): CalendarEventsResult {
  const planId = options.planId ?? workspace.selectedPlanId;
  const calendarName = options.calendarName ?? activePlanName(workspace, planId);
  const defaultStartMinute = parseTime(options.defaultStartTime ?? '09:00');

  if (defaultStartMinute === null) {
    throw new Error('La hora inicial del calendario debe usar el formato HH:mm.');
  }

  const gapMinutes = Math.max(0, Math.min(24 * 60, Math.round(options.gapMinutes ?? 15)));
  const tripStartDate = parseCalendarDate(workspace.trip.startDate);
  const days = getPlanDays(workspace, planId);
  const items = getPlanItems(workspace, planId);
  const warnings: CalendarExportWarning[] = [];
  const events: EventAttributes[] = [];
  const assignedItemIds = new Set<string>();

  days.forEach((day) => {
    const itemsForDay = items
      .filter((item) => item.dayId === day.id)
      .sort((a, b) => {
        const startA = parseTime(a.startTime);
        const startB = parseTime(b.startTime);
        if (startA !== null && startB !== null) return startA - startB || a.order - b.order;
        if (startA !== null) return -1;
        if (startB !== null) return 1;
        return a.order - b.order;
      });

    if (itemsForDay.length === 0) return;

    const date = dayDate(day, tripStartDate);
    if (!date) {
      warnings.push({
        code: 'fecha-faltante',
        dayId: day.id,
        message: `“${day.title}” no tiene fecha y se omitió del calendario.`,
      });
      return;
    }

    let cursor = defaultStartMinute;
    for (const item of itemsForDay) {
      assignedItemIds.add(item.id);
      const explicitStart = parseTime(item.startTime);
      const startMinute = explicitStart ?? cursor;
      const durationMinutes = eventDuration(item, startMinute);
      const coordinates = resolveItemCoordinates(item);

      events.push({
        uid: stableUid(item.id),
        title: item.title,
        description: eventDescription(workspace, day, item),
        location: eventLocation(item),
        start: startArray(date, startMinute),
        startInputType: 'local',
        startOutputType: 'local',
        duration: { minutes: durationMinutes },
        status: item.status === 'idea' ? 'TENTATIVE' : 'CONFIRMED',
        busyStatus: item.status === 'idea' ? 'TENTATIVE' : 'BUSY',
        transp: 'OPAQUE',
        categories: [itemTypeLabels[item.type], day.title],
        url: item.reservationUrl || item.mapUrl || undefined,
        geo: coordinates
          ? { lat: coordinates.latitude, lon: coordinates.longitude }
          : undefined,
      });

      cursor = Math.max(cursor, startMinute + durationMinutes + gapMinutes);
    }
  });

  for (const item of items) {
    if (item.dayId === null || (!assignedItemIds.has(item.id) && !days.some((day) => day.id === item.dayId))) {
      warnings.push({
        code: 'sin-dia',
        itemId: item.id,
        message: `“${item.title}” no está asignado a un día y se omitió del calendario.`,
      });
    }
  }

  return { calendarName, events, warnings };
}

export function createPlanCalendarExport(
  workspace: Workspace,
  options: CalendarExportOptions = {},
): CalendarExportResult {
  const result = createPlanCalendarEvents(workspace, options);
  const created = createEvents(result.events, {
    productId: 'ruta-austral/planificador',
    method: 'PUBLISH',
    calName: result.calendarName,
  });

  if (created.error || !created.value) {
    throw new Error('No fue posible generar el calendario.', {
      cause: created.error ?? undefined,
    });
  }

  const filename =
    options.filename ?? createExportFilename(result.calendarName, 'ics', options.now);

  return {
    ...result,
    filename,
    content: created.value,
    blob: new Blob([created.value], { type: 'text/calendar;charset=utf-8' }),
    eventCount: result.events.length,
  };
}

export function downloadPlanCalendar(
  workspace: Workspace,
  options: CalendarExportOptions = {},
): CalendarExportResult {
  const result = createPlanCalendarExport(workspace, options);
  downloadBlob(result.blob, result.filename);
  return result;
}
