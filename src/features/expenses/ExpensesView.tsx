import { useMemo, useState, type FormEvent } from 'react'
import { Sheet } from '../../components'
import { formatClp } from '../../domain/constants'
import { getExpenseBalances, splitExpenseEqually } from '../../domain/selectors'
import type { Expense, ExpenseSplit } from '../../domain/types'
import { useWorkspace } from '../../data/WorkspaceContext'

const categoryLabels: Record<Expense['category'], string> = {
  transport: 'Traslado', lodging: 'Alojamiento', food: 'Comida', activity: 'Actividad', fuel: 'Combustible', other: 'Otro',
}

export function ExpensesView() {
  const { workspace, addExpense, updateExpense, deleteExpense } = useWorkspace()
  const [formOpen, setFormOpen] = useState(false)
  const [formSession, setFormSession] = useState(0)
  const [amount, setAmount] = useState(0)
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')
  const [formError, setFormError] = useState('')
  const expenses = workspace.expenses.filter((expense) => !expense.deletedAt).sort((a, b) => b.date.localeCompare(a.date))
  const actualTotal = expenses.filter((expense) => expense.status === 'actual').reduce((sum, expense) => sum + expense.amountClp, 0)
  const estimatedTotal = expenses.filter((expense) => expense.status === 'estimated').reduce((sum, expense) => sum + expense.amountClp, 0)
  const balances = getExpenseBalances(workspace)
  const openForm = () => {
    setFormError('')
    setFormSession((session) => session + 1)
    setFormOpen(true)
  }
  const closeForm = () => {
    setFormOpen(false)
    setAmount(0)
    setFormError('')
  }

  const settlements = useMemo(() => {
    const creditors = [...balances.entries()].filter(([, balance]) => balance > 0).map(([id, value]) => ({ id, value }))
    const debtors = [...balances.entries()].filter(([, balance]) => balance < 0).map(([id, value]) => ({ id, value: -value }))
    const suggestions: Array<{ from: string; to: string; amount: number }> = []
    let creditor = 0; let debtor = 0
    while (creditor < creditors.length && debtor < debtors.length) {
      const amount = Math.min(creditors[creditor].value, debtors[debtor].value)
      if (amount > 0) suggestions.push({ from: debtors[debtor].id, to: creditors[creditor].id, amount })
      creditors[creditor].value -= amount; debtors[debtor].value -= amount
      if (creditors[creditor].value <= 0) creditor += 1
      if (debtors[debtor].value <= 0) debtor += 1
    }
    return suggestions
  }, [balances])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const amountClp = Math.max(0, Math.round(Number(data.get('amountClp')) || 0))
    const activeIds = workspace.participants.filter((person) => person.active).map((person) => person.id)
    let splits: ExpenseSplit[]
    if (splitMode === 'equal') {
      splits = splitExpenseEqually({ amountClp }, activeIds)
    } else {
      splits = activeIds.map((participantId) => {
        const splitAmount = Math.max(0, Math.round(Number(data.get(`split-${participantId}`)) || 0))
        return { participantId, amountClp: splitAmount, percentage: amountClp ? splitAmount / amountClp * 100 : 0, settled: false }
      })
      const splitTotal = splits.reduce((sum, split) => sum + split.amountClp, 0)
      if (splitTotal !== amountClp) {
        setFormError(`Los montos personalizados deben sumar ${formatClp(amountClp)}.`)
        return
      }
    }
    setFormError('')
    const now = new Date().toISOString()
    await addExpense({
      id: crypto.randomUUID(), tripId: workspace.trip.id, title: String(data.get('title') ?? ''), amountClp,
      status: String(data.get('status')) as Expense['status'], payerParticipantId: String(data.get('payer') || '') || null,
      date: String(data.get('date') || now.slice(0, 10)), category: String(data.get('category')) as Expense['category'],
      linkedItemId: null, notes: String(data.get('notes') ?? ''), splits, updatedAt: now, deletedAt: null,
    })
    closeForm(); event.currentTarget.reset()
  }

  const personName = (id: string) => workspace.participants.find((person) => person.id === id)?.name ?? 'Viajero'

  return (
    <div className="screen expenses-screen">
      <header className="screen-heading">
        <div><p className="eyebrow">CLP · grupo completo</p><h1>Gastos del viaje</h1><p>Registra lo estimado y lo pagado, y cierra cuentas sin planillas.</p></div>
        <button className="button button--primary" type="button" onClick={openForm}>＋ Agregar gasto</button>
      </header>

      <section className="money-summary" aria-label="Resumen de gastos">
        <article><span>Presupuesto</span><strong>{formatClp(estimatedTotal)}</strong><small>estimado</small></article>
        <article className="money-summary__primary"><span>Pagado</span><strong>{formatClp(actualTotal)}</strong><small>{expenses.filter((expense) => expense.status === 'actual').length} movimientos</small></article>
        <article><span>Total registrado</span><strong>{formatClp(actualTotal + estimatedTotal)}</strong><small>estimado + pagado</small></article>
      </section>

      <div className="expenses-layout">
        <section className="expense-list-section">
          <div className="section-title-row"><div><p className="eyebrow">Registro</p><h2>Movimientos</h2></div><span>{expenses.length} gastos</span></div>
          {expenses.length === 0 ? (
            <div className="illustrated-empty"><span aria-hidden="true">₱</span><h3>Aún no hay gastos</h3><p>Agrega estimaciones ahora y cámbialas a reales cuando alguien pague.</p><button className="button button--primary" type="button" onClick={openForm}>Agregar el primero</button></div>
          ) : (
            <div className="expense-list">{expenses.map((expense) => (
              <article className="expense-card" key={expense.id}>
                <div className={`expense-card__icon expense-card__icon--${expense.category}`} aria-hidden="true">{categoryLabels[expense.category].slice(0, 1)}</div>
                <div className="expense-card__body">
                  <div><strong>{expense.title}</strong><span>{categoryLabels[expense.category]} · {expense.date}</span></div>
                  <div className="expense-card__people">Pagó {expense.payerParticipantId ? personName(expense.payerParticipantId) : 'sin asignar'} · {expense.splits.filter((split) => split.settled).length}/{expense.splits.length} saldados</div>
                </div>
                <div className="expense-card__amount"><strong>{formatClp(expense.amountClp)}</strong><button type="button" className={`status-chip status-chip--${expense.status}`} onClick={() => void updateExpense(expense.id, { status: expense.status === 'actual' ? 'estimated' : 'actual' })}>{expense.status === 'actual' ? 'Real' : 'Estimado'}</button></div>
                <details className="expense-card__details">
                  <summary>Ver división</summary>
                  <ul>{expense.splits.map((split) => (
                    <li key={split.participantId}><span>{personName(split.participantId)} · {formatClp(split.amountClp)}</span><label><input type="checkbox" checked={split.settled} onChange={() => void updateExpense(expense.id, { splits: expense.splits.map((candidate) => candidate.participantId === split.participantId ? { ...candidate, settled: !candidate.settled } : candidate) })} /> Saldado</label></li>
                  ))}</ul>
                  <button className="button button--danger-ghost" type="button" onClick={() => void deleteExpense(expense.id)}>Mover a papelera</button>
                </details>
              </article>
            ))}</div>
          )}
        </section>

        <aside className="settlement-panel">
          <p className="eyebrow">Cierre de cuentas</p><h2>Transferencias sugeridas</h2>
          {settlements.length ? <ul>{settlements.map((settlement, index) => (
            <li key={`${settlement.from}-${settlement.to}-${index}`}><div><strong>{personName(settlement.from)}</strong><span>paga a {personName(settlement.to)}</span></div><b>{formatClp(settlement.amount)}</b></li>
          ))}</ul> : <div className="balanced-state"><span>✓</span><strong>Todo está equilibrado</strong><p>No quedan divisiones reales pendientes.</p></div>}
        </aside>
      </div>

      <Sheet
        open={formOpen}
        onOpenChange={(nextOpen) => { if (!nextOpen) closeForm() }}
        title="Agregar gasto"
        description="Nuevo movimiento"
        size="md"
        side="bottom"
        bodyClassName="feature-sheet-body"
      >
            <form key={formSession} className="editor-form" onSubmit={submit}>
              <label className="field field--wide"><span>Descripción</span><input name="title" required maxLength={180} autoFocus placeholder="Ej. Ferry Hornopirén" /></label>
              <label className="field"><span>Monto CLP</span><input name="amountClp" type="number" min="0" step="100" required value={amount || ''} onChange={(event) => setAmount(Number(event.target.value))} /></label>
              <label className="field"><span>Tipo</span><select name="status" defaultValue="actual"><option value="actual">Real</option><option value="estimated">Estimado</option></select></label>
              <label className="field"><span>Categoría</span><select name="category" defaultValue="transport">{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="field"><span>Fecha</span><input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
              <label className="field field--wide"><span>Pagó</span><select name="payer" defaultValue={workspace.profileParticipantId ?? ''}><option value="">Sin asignar</option>{workspace.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <fieldset className="field field--wide split-fieldset"><legend>División</legend><div className="segmented-control"><button type="button" className={splitMode === 'equal' ? 'is-active' : ''} onClick={() => setSplitMode('equal')}>Partes iguales</button><button type="button" className={splitMode === 'custom' ? 'is-active' : ''} onClick={() => setSplitMode('custom')}>Montos personalizados</button></div>
                {splitMode === 'custom' && <div className="custom-splits">{workspace.participants.map((person) => <label key={person.id}><span>{person.name}</span><input name={`split-${person.id}`} type="number" min="0" step="100" defaultValue={Math.floor(amount / workspace.participants.length)} /></label>)}</div>}
              </fieldset>
              <label className="field field--wide"><span>Notas</span><textarea name="notes" rows={3} /></label>
              {formError && <p className="form-note form-note--error field--wide" role="alert">{formError}</p>}
              <div className="editor-form__actions field--wide"><button className="button button--quiet" type="button" onClick={closeForm}>Cancelar</button><button className="button button--primary" type="submit">Agregar gasto</button></div>
            </form>
      </Sheet>
    </div>
  )
}
