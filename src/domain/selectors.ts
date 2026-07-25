import type { Expense, ItineraryItem, TripDay, Workspace } from './types'

const byTimeThenOrder = (a: ItineraryItem, b: ItineraryItem): number => {
  if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime) || a.order - b.order
  if (a.startTime) return -1
  if (b.startTime) return 1
  return a.order - b.order
}

export const getActivePlan = (workspace: Workspace) =>
  workspace.plans.find((plan) => plan.id === workspace.selectedPlanId) ?? workspace.plans[0]

export const getPlanDays = (workspace: Workspace, planId = workspace.selectedPlanId): TripDay[] =>
  workspace.days
    .filter((day) => day.planId === planId && !day.deletedAt)
    .sort((a, b) => a.ordinal - b.ordinal)

export const getPlanItems = (workspace: Workspace, planId = workspace.selectedPlanId): ItineraryItem[] =>
  workspace.items.filter((item) => item.planId === planId && !item.deletedAt)

export const getDayItems = (workspace: Workspace, dayId: string): ItineraryItem[] =>
  getPlanItems(workspace).filter((item) => item.dayId === dayId).sort(byTimeThenOrder)

export const getUnassignedItems = (workspace: Workspace): ItineraryItem[] =>
  getPlanItems(workspace).filter((item) => !item.dayId).sort(byTimeThenOrder)

export const getCurrentDayId = (workspace: Workspace): string | null => {
  if (!workspace.trip.startDate) return null
  const days = getPlanDays(workspace)
  const today = new Date().toISOString().slice(0, 10)
  return days.find((day) => day.date === today)?.id ?? null
}

export const getPlanSummary = (workspace: Workspace) => {
  const items = getPlanItems(workspace)
  return {
    itemCount: items.length,
    doneCount: items.filter((item) => item.status === 'done').length,
    durationMinutes: items.reduce((sum, item) => sum + item.durationMinutes, 0),
    estimateClp: items.reduce((sum, item) => sum + item.estimateClp, 0),
    actualClp: items.reduce((sum, item) => sum + item.actualClp, 0),
  }
}

export const getExpenseBalances = (workspace: Workspace) => {
  const balances = new Map(workspace.participants.map((person) => [person.id, 0]))
  const activeExpenses = workspace.expenses.filter((expense) => !expense.deletedAt && expense.status === 'actual')
  for (const expense of activeExpenses) {
    const unsettled = expense.splits.filter((split) => !split.settled)
    const unpaidTotal = unsettled.reduce((sum, split) => sum + split.amountClp, 0)
    if (expense.payerParticipantId) balances.set(expense.payerParticipantId, (balances.get(expense.payerParticipantId) ?? 0) + unpaidTotal)
    for (const split of unsettled) {
      balances.set(split.participantId, (balances.get(split.participantId) ?? 0) - split.amountClp)
    }
  }
  return balances
}

export const splitExpenseEqually = (expense: Pick<Expense, 'amountClp'>, participantIds: string[]) => {
  if (!participantIds.length) return []
  const base = Math.floor(expense.amountClp / participantIds.length)
  let remainder = expense.amountClp - base * participantIds.length
  return participantIds.map((participantId) => {
    const amountClp = base + (remainder-- > 0 ? 1 : 0)
    return {
      participantId,
      amountClp,
      percentage: expense.amountClp ? (amountClp / expense.amountClp) * 100 : 0,
      settled: false,
    }
  })
}
