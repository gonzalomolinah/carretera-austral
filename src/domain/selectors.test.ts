import { describe, expect, it } from 'vitest'
import { createSeedWorkspace } from './seed'
import { getDayItems, getExpenseBalances, splitExpenseEqually } from './selectors'

describe('selectores del dominio', () => {
  it('divide CLP sin perder pesos por redondeo', () => {
    const splits = splitExpenseEqually({ amountClp: 10_001 }, ['a', 'b', 'c', 'd'])
    expect(splits.map((split) => split.amountClp)).toEqual([2501, 2500, 2500, 2500])
    expect(splits.reduce((sum, split) => sum + split.amountClp, 0)).toBe(10_001)
  })

  it('ordena hitos con hora antes que los manuales', () => {
    const workspace = createSeedWorkspace()
    const dayId = workspace.days[0].id
    workspace.items = [
      { ...workspace.items[0], id: 'manual', dayId, startTime: null, order: 0 },
      { ...workspace.items[0], id: 'late', dayId, startTime: '11:30', order: 2 },
      { ...workspace.items[0], id: 'early', dayId, startTime: '08:15', order: 1 },
    ]
    expect(getDayItems(workspace, dayId).map((item) => item.id)).toEqual(['early', 'late', 'manual'])
  })

  it('omite divisiones ya saldadas del balance', () => {
    const workspace = createSeedWorkspace()
    const [payer, other] = workspace.participants
    workspace.expenses = [{
      id: 'expense', tripId: workspace.trip.id, title: 'Bencina', amountClp: 20_000, status: 'actual',
      payerParticipantId: payer.id, date: '2026-01-01', category: 'fuel', linkedItemId: null, notes: '',
      splits: [
        { participantId: payer.id, amountClp: 10_000, percentage: 50, settled: true },
        { participantId: other.id, amountClp: 10_000, percentage: 50, settled: false },
      ], updatedAt: '2026-01-01T00:00:00Z', deletedAt: null,
    }]
    const balances = getExpenseBalances(workspace)
    expect(balances.get(payer.id)).toBe(10_000)
    expect(balances.get(other.id)).toBe(-10_000)
  })
})

