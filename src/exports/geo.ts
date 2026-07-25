import { toKML } from '@placemarkio/tokml';
import type { Coordinates, ItineraryItem, ItemType, Workspace } from '../domain/types';
import { createExportFilename, downloadBlob } from './json';

export type GeoJsonPosition = [longitude: number, latitude: number];

export interface GeoJsonPointGeometry {
  type: 'Point';
  coordinates: GeoJsonPosition;
}

export interface GeoJsonLineGeometry {
  type: 'LineString';
  coordinates: GeoJsonPosition[];
}

export type GeoJsonGeometry = GeoJsonPointGeometry | GeoJsonLineGeometry;
export type GeoJsonProperty = string | number | boolean | null;

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string;
  geometry: GeoJsonGeometry;
  properties: Record<string, GeoJsonProperty>;
}

export interface PlanGeoJson {
  type: 'FeatureCollection';
  name: string;
  features: GeoJsonFeature[];
}

export interface GeoExportWarning {
  code: 'coordenadas-faltantes';
  itemId: string;
  message: string;
}

export interface GeoExportOptions {
  planId?: string;
  includeDayRoutes?: boolean;
  includeUnassigned?: boolean;
  filename?: string;
  now?: Date;
}

export interface GeoJsonExportResult {
  filename: string;
  content: string;
  blob: Blob;
  featureCollection: PlanGeoJson;
  pointCount: number;
  routeCount: number;
  warnings: GeoExportWarning[];
}

export interface KmlExportResult {
  filename: string;
  content: string;
  blob: Blob;
  pointCount: number;
  routeCount: number;
  warnings: GeoExportWarning[];
}

const markerColors: Record<ItemType, string> = {
  activity: '#377a70',
  transit: '#cf5b32',
  lodging: '#6e5a94',
  meal: '#c17b2a',
  fuel: '#496a8d',
  other: '#636d68',
};

function validCoordinates(latitude: number, longitude: number): Coordinates | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function coordinatesFromPair(value: string): Coordinates | null {
  const match = value.match(
    /(-?(?:\d{1,2}(?:\.\d+)?|90(?:\.0+)?))\s*[,/]\s*(-?(?:\d{1,3}(?:\.\d+)?|180(?:\.0+)?))/,
  );
  if (!match) return null;
  return validCoordinates(Number(match[1]), Number(match[2]));
}

/** Extrae coordenadas explícitas o coordenadas visibles en enlaces comunes de mapas. */
export function resolveItemCoordinates(item: ItineraryItem): Coordinates | null {
  if (item.coordinates) {
    return validCoordinates(item.coordinates.latitude, item.coordinates.longitude);
  }

  const rawUrl = item.mapUrl.trim();
  if (!rawUrl) return null;

  const googlePath = rawUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|\/|$)/);
  if (googlePath) {
    return validCoordinates(Number(googlePath[1]), Number(googlePath[2]));
  }

  const osmHash = rawUrl.match(/#map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
  if (osmHash) {
    return validCoordinates(Number(osmHash[1]), Number(osmHash[2]));
  }

  try {
    const url = new URL(rawUrl);
    for (const key of ['query', 'q', 'll', 'destination', 'daddr']) {
      const value = url.searchParams.get(key);
      const coordinates = value ? coordinatesFromPair(value) : null;
      if (coordinates) return coordinates;
    }
  } catch {
    return coordinatesFromPair(rawUrl);
  }

  return coordinatesFromPair(rawUrl);
}

function itemDescription(item: ItineraryItem, dayTitle: string): string {
  return [
    dayTitle,
    item.origin && item.destination ? `${item.origin} → ${item.destination}` : '',
    item.notes,
    item.reservationUrl ? `Reserva: ${item.reservationUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function activePlanName(workspace: Workspace, planId: string): string {
  const plan = workspace.plans.find((candidate) => candidate.id === planId);
  return plan ? `${workspace.trip.name} — ${plan.name}` : workspace.trip.name;
}

export function createPlanGeoJson(
  workspace: Workspace,
  options: GeoExportOptions = {},
): Omit<GeoJsonExportResult, 'filename' | 'content' | 'blob'> {
  const planId = options.planId ?? workspace.selectedPlanId;
  const days = workspace.days
    .filter((day) => day.planId === planId && !day.deletedAt)
    .sort((a, b) => a.ordinal - b.ordinal);
  const dayById = new Map(days.map((day) => [day.id, day]));
  const items = workspace.items
    .filter(
      (item) =>
        item.planId === planId &&
        !item.deletedAt &&
        (options.includeUnassigned !== false || item.dayId !== null),
    )
    .sort((a, b) => {
      const dayA = a.dayId ? dayById.get(a.dayId)?.ordinal ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const dayB = b.dayId ? dayById.get(b.dayId)?.ordinal ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      return dayA - dayB || a.order - b.order;
    });

  const warnings: GeoExportWarning[] = [];
  const pointFeatures: GeoJsonFeature[] = [];
  const positionsByDay = new Map<string, GeoJsonPosition[]>();

  for (const item of items) {
    const coordinates = resolveItemCoordinates(item);
    if (!coordinates) {
      warnings.push({
        code: 'coordenadas-faltantes',
        itemId: item.id,
        message: `“${item.title}” no tiene coordenadas y no se incluyó en el mapa exportado.`,
      });
      continue;
    }

    const day = item.dayId ? dayById.get(item.dayId) : undefined;
    const dayTitle = day?.title ?? 'Sin asignar';
    const position: GeoJsonPosition = [coordinates.longitude, coordinates.latitude];

    pointFeatures.push({
      type: 'Feature',
      id: item.id,
      geometry: { type: 'Point', coordinates: position },
      properties: {
        name: item.title,
        description: itemDescription(item, dayTitle),
        day: dayTitle,
        type: item.type,
        status: item.status,
        location: item.location,
        must: item.isMust,
        'marker-color': markerColors[item.type],
      },
    });

    if (day) {
      const positions = positionsByDay.get(day.id) ?? [];
      positions.push(position);
      positionsByDay.set(day.id, positions);
    }
  }

  const routeFeatures: GeoJsonFeature[] = [];
  if (options.includeDayRoutes !== false) {
    for (const day of days) {
      const positions = positionsByDay.get(day.id) ?? [];
      if (positions.length < 2) continue;
      routeFeatures.push({
        type: 'Feature',
        id: `ruta-${day.id}`,
        geometry: { type: 'LineString', coordinates: positions },
        properties: {
          name: `${day.title} — recorrido`,
          description: day.notes,
          day: day.title,
          stroke: '#cf5b32',
          'stroke-width': 4,
          'stroke-opacity': 0.9,
        },
      });
    }
  }

  return {
    featureCollection: {
      type: 'FeatureCollection',
      name: activePlanName(workspace, planId),
      features: [...routeFeatures, ...pointFeatures],
    },
    pointCount: pointFeatures.length,
    routeCount: routeFeatures.length,
    warnings,
  };
}

export function createPlanGeoJsonExport(
  workspace: Workspace,
  options: GeoExportOptions = {},
): GeoJsonExportResult {
  const result = createPlanGeoJson(workspace, options);
  const planId = options.planId ?? workspace.selectedPlanId;
  const content = JSON.stringify(result.featureCollection, null, 2);
  const filename =
    options.filename ?? createExportFilename(activePlanName(workspace, planId), 'geojson', options.now);

  return {
    ...result,
    filename,
    content,
    blob: new Blob([content], { type: 'application/geo+json;charset=utf-8' }),
  };
}

export function createPlanKmlExport(
  workspace: Workspace,
  options: GeoExportOptions = {},
): KmlExportResult {
  const result = createPlanGeoJson(workspace, options);
  const planId = options.planId ?? workspace.selectedPlanId;
  const content = toKML(result.featureCollection);
  const filename =
    options.filename ?? createExportFilename(activePlanName(workspace, planId), 'kml', options.now);

  return {
    filename,
    content,
    blob: new Blob([content], {
      type: 'application/vnd.google-earth.kml+xml;charset=utf-8',
    }),
    pointCount: result.pointCount,
    routeCount: result.routeCount,
    warnings: result.warnings,
  };
}

export function downloadPlanGeoJson(
  workspace: Workspace,
  options: GeoExportOptions = {},
): GeoJsonExportResult {
  const result = createPlanGeoJsonExport(workspace, options);
  downloadBlob(result.blob, result.filename);
  return result;
}

export function downloadPlanKml(
  workspace: Workspace,
  options: GeoExportOptions = {},
): KmlExportResult {
  const result = createPlanKmlExport(workspace, options);
  downloadBlob(result.blob, result.filename);
  return result;
}
