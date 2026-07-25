import { getPlanDays } from '../domain/selectors'
import type { Workspace } from '../domain/types'
import { resolveItemCoordinates } from './geo'
import { createExportFilename, downloadText } from './json'

const xml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
})[character] ?? character)

export function createPlanGpx(workspace: Workspace, planId = workspace.selectedPlanId): string {
  const points = getPlanDays(workspace, planId).flatMap((day) =>
    workspace.items
      .filter((item) => item.planId === planId && item.dayId === day.id && !item.deletedAt)
      .sort((a, b) => a.order - b.order)
      .map((item) => ({ item, day, coordinates: resolveItemCoordinates(item) }))
      .filter((entry) => entry.coordinates),
  )
  const waypoints = points.map(({ item, day, coordinates }) => coordinates &&
    `  <wpt lat="${coordinates.latitude}" lon="${coordinates.longitude}"><name>${xml(item.title)}</name><desc>${xml(`${day.title} · ${item.location}`)}</desc><type>${xml(item.type)}</type></wpt>`).join('\n')
  const routePoints = points.map(({ item, coordinates }) => coordinates &&
    `    <rtept lat="${coordinates.latitude}" lon="${coordinates.longitude}"><name>${xml(item.title)}</name></rtept>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Ruta Austral" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata><name>${xml(workspace.trip.name)}</name><time>${new Date().toISOString()}</time></metadata>
${waypoints}
  <rte><name>${xml(workspace.plans.find((plan) => plan.id === planId)?.name ?? workspace.trip.name)}</name>
${routePoints}
  </rte>
</gpx>`
}

export function downloadPlanGpx(workspace: Workspace, planId = workspace.selectedPlanId): void {
  downloadText(createPlanGpx(workspace, planId), createExportFilename(workspace.trip.name, 'gpx'), 'application/gpx+xml;charset=utf-8')
}

