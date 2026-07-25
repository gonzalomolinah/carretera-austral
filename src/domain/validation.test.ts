import { describe, expect, it } from 'vitest'
import { createSeedWorkspace } from './seed'
import {
  assertWorkspaceFitsRemote,
  normalizeWorkspace,
  parseWorkspace,
  sanitizeMoney,
  sanitizeUrl,
} from './validation'

describe('validación de límites no confiables', () => {
  it('acepta solamente enlaces http(s)', () => {
    expect(sanitizeUrl('https://example.com/reserva')).toContain('https://example.com')
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('file:///etc/passwd')).toBe('')
  })

  it('normaliza montos CLP enteros y no negativos', () => {
    expect(sanitizeMoney('1234.7')).toBe(1235)
    expect(sanitizeMoney(-20)).toBe(0)
    expect(sanitizeMoney('no')).toBe(0)
  })
})

describe('datos iniciales', () => {
  it('usa UUID válidos para las entidades sincronizables', () => {
    const workspace = createSeedWorkspace()
    const ids = [
      workspace.trip.id,
      ...workspace.participants.map((entity) => entity.id),
      ...workspace.plans.map((entity) => entity.id),
      ...workspace.days.map((entity) => entity.id),
      ...workspace.items.map((entity) => entity.id),
    ]
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(ids.every((id) => uuid.test(id))).toBe(true)
  })

  it('rechaza respaldos incompletos antes de tocar datos locales', () => {
    expect(() => parseWorkspace({ trip: { name: 'Incompleto' } })).toThrow(/formato/)
  })

  it('elimina entidades duplicadas al cruzar un límite no confiable', () => {
    const workspace = createSeedWorkspace()
    workspace.items.push(structuredClone(workspace.items[0]))
    expect(parseWorkspace(workspace).items).toHaveLength(workspace.items.length - 1)
  })

  it('desasigna referencias a días eliminados lógicamente', () => {
    const workspace = createSeedWorkspace()
    const deletedDay = workspace.days[0]
    const item = workspace.items[0]
    deletedDay.deletedAt = '2026-07-18T12:00:00.000Z'
    item.dayId = deletedDay.id
    workspace.tasks = [{
      id: '234d0f5c-91f1-4a52-9d65-1f4b94a9a010',
      tripId: workspace.trip.id,
      title: 'Revisar tramo eliminado',
      category: 'ruta',
      completed: false,
      dueDate: null,
      assigneeParticipantId: null,
      linkedDayId: deletedDay.id,
      linkedItemId: item.id,
      updatedAt: workspace.updatedAt,
      deletedAt: null,
    }]

    const normalized = normalizeWorkspace(workspace)

    expect(normalized.items.find((candidate) => candidate.id === item.id)?.dayId).toBeNull()
    expect(normalized.tasks[0].linkedDayId).toBeNull()
  })

  it('impide crear un workspace que exceda el límite del RPC remoto', () => {
    const workspace = createSeedWorkspace()
    workspace.contacts = Array.from({ length: 1_500 }, (_, index) => ({
      id: crypto.randomUUID(),
      tripId: workspace.trip.id,
      name: `Contacto ${index}`,
      role: '',
      phone: '',
      email: '',
      url: '',
      notes: 'x'.repeat(5_000),
      updatedAt: workspace.updatedAt,
      deletedAt: null,
    }))

    expect(() => assertWorkspaceFitsRemote(workspace)).toThrow(/7 MB/)
  })
})
