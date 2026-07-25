import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { formatClp, itemStatusMeta, itemTypeMeta } from '../../domain/constants'
import { getDayItems, getPlanDays, getPlanItems, getPlanSummary, getUnassignedItems } from '../../domain/selectors'
import type { ItineraryItem } from '../../domain/types'
import { useWorkspace } from '../../data/WorkspaceContext'
import { ItemEditor } from './ItemEditor'

interface ItineraryViewProps {
  addRequest: number
  onAddRequestHandled: () => void
}

const durationLabel = (minutes: number) => {
  if (!minutes) return ''
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours ? `${hours} h` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ')
}

const dayDate = (startDate: string | null, ordinal: number, explicit: string | null) => {
  const raw = explicit || (startDate ? new Date(`${startDate}T12:00:00`) : null)
  if (!raw) return null
  const date = typeof raw === 'string' ? new Date(`${raw}T12:00:00`) : raw
  if (!explicit) date.setDate(date.getDate() + ordinal - 1)
  return new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
}

export function ItineraryView({ addRequest, onAddRequestHandled }: ItineraryViewProps) {
  const {
    workspace, selectPlan, addDay, updateDay, deleteDay, addItem, updateItem, deleteItem, moveItem, useProposalAsFinal,
  } = useWorkspace()
  const [editing, setEditing] = useState<ItineraryItem | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSession, setEditorSession] = useState(0)
  const [initialDayId, setInitialDayId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'must' | 'booked' | 'pending'>('all')
  const days = getPlanDays(workspace)
  const allItems = getPlanItems(workspace)
  const summary = getPlanSummary(workspace)
  const activePlan = workspace.plans.find((plan) => plan.id === workspace.selectedPlanId)
  const finalPlan = workspace.plans.find((plan) => plan.kind === 'final')
  const visiblePlans = workspace.plans.filter((plan) => plan.kind !== 'recovery')
  const planTabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const handledAddRequest = useRef(0)
  const firstDayId = days[0]?.id ?? null

  useEffect(() => {
    if (addRequest <= 0) {
      handledAddRequest.current = 0
      return
    }
    if (handledAddRequest.current === addRequest) return
    handledAddRequest.current = addRequest
    setEditing(null)
    setInitialDayId(firstDayId)
    setEditorSession((session) => session + 1)
    setEditorOpen(true)
    onAddRequestHandled()
  }, [addRequest, firstDayId, onAddRequestHandled])

  const handlePlanTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const lastIndex = visiblePlans.length - 1
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? lastIndex
        : event.key === 'ArrowRight'
          ? (index + 1) % visiblePlans.length
          : (index - 1 + visiblePlans.length) % visiblePlans.length
    const plan = visiblePlans[nextIndex]
    if (!plan) return
    void selectPlan(plan.id)
    planTabRefs.current[nextIndex]?.focus()
  }

  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-CL')
    return (item: ItineraryItem) => {
      const textMatch = !term || `${item.title} ${item.location} ${item.notes}`.toLocaleLowerCase('es-CL').includes(term)
      const filterMatch = filter === 'all' || (filter === 'must' && item.isMust) ||
        (filter === 'booked' && item.status === 'booked') || (filter === 'pending' && item.status !== 'done')
      return textMatch && filterMatch
    }
  }, [filter, search])

  const openNew = (dayId: string | null) => {
    setEditing(null); setInitialDayId(dayId); setEditorSession((session) => session + 1); setEditorOpen(true)
  }

  const openEdit = (item: ItineraryItem) => {
    setEditing(item); setInitialDayId(item.dayId); setEditorSession((session) => session + 1); setEditorOpen(true)
  }

  const reorderDisabled = Boolean(search.trim()) || filter !== 'all'

  const renderItem = (item: ItineraryItem) => {
    const meta = itemTypeMeta[item.type]
    return (
      <article className={`itinerary-card itinerary-card--${item.type}`} key={item.id}>
        <button className="itinerary-card__main" type="button" onClick={() => openEdit(item)} aria-label={`Abrir ${item.title}`}>
          <span className="itinerary-card__time">{item.startTime || '—'}</span>
          <span className="itinerary-card__body">
            <span className="itinerary-card__topline">
              <span className="type-badge">{meta.label}</span>
              {item.isMust && <span className="must-badge">Esencial</span>}
            </span>
            <strong>{item.title}</strong>
            <span className="itinerary-card__meta">
              {item.location && <span>{item.location}</span>}
              {item.durationMinutes > 0 && <span>{durationLabel(item.durationMinutes)}</span>}
              {(item.actualClp || item.estimateClp) > 0 && <span>{formatClp(item.actualClp || item.estimateClp)}</span>}
            </span>
          </span>
          <span className={`status-dot status-dot--${item.status}`} title={itemStatusMeta[item.status].label}>
            <span className="sr-only">Estado: {itemStatusMeta[item.status].label}</span>
          </span>
        </button>
        <div className="itinerary-card__quick-actions" aria-label={`Acciones para ${item.title}`}>
          <button type="button" disabled={reorderDisabled} onClick={() => void moveItem(item.id, item.dayId, -1)} aria-label="Mover antes" title={reorderDisabled ? 'Quita los filtros para reordenar' : undefined}>↑</button>
          <button type="button" disabled={reorderDisabled} onClick={() => void moveItem(item.id, item.dayId, 1)} aria-label="Mover después" title={reorderDisabled ? 'Quita los filtros para reordenar' : undefined}>↓</button>
          <select value={item.dayId ?? ''} onChange={(event) => void moveItem(item.id, event.target.value || null)} aria-label="Mover a otro día">
            <option value="">Sin asignar</option>
            {days.map((day) => <option key={day.id} value={day.id}>{day.title}</option>)}
          </select>
        </div>
      </article>
    )
  }

  return (
    <div className="screen itinerary-screen">
      <section className="trip-hero" aria-labelledby="trip-title">
        <div>
          <p className="eyebrow">Carretera Austral · Patagonia</p>
          <h1 id="trip-title">{workspace.trip.name}</h1>
          <p>{workspace.trip.startDate ? `Comienza el ${new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date(`${workspace.trip.startDate}T12:00:00`))}` : 'Fechas abiertas · organiza primero, decide después'}</p>
        </div>
        <div className="trip-hero__stats" aria-label="Resumen del itinerario">
          <span><strong>{summary.itemCount}</strong> paradas</span>
          <span><strong>{Math.round(summary.durationMinutes / 60)}</strong> horas</span>
          <span><strong>{summary.doneCount}</strong> listas</span>
        </div>
      </section>

      <section className="plan-switcher" aria-label="Propuestas del viaje">
        <div className="plan-tabs" role="tablist" aria-label="Elegir itinerario">
          {visiblePlans.map((plan, index) => (
            <button key={plan.id} type="button" role="tab" aria-selected={plan.id === workspace.selectedPlanId}
              ref={(node) => { planTabRefs.current[index] = node }}
              tabIndex={plan.id === workspace.selectedPlanId ? 0 : -1}
              className={plan.id === workspace.selectedPlanId ? 'is-active' : ''}
              onKeyDown={(event) => handlePlanTabKeyDown(event, index)}
              onClick={() => void selectPlan(plan.id)}>
              {plan.kind === 'final' ? 'Final' : plan.name.replace('Propuesta de ', '')}
            </button>
          ))}
        </div>
        {activePlan?.kind === 'proposal' && finalPlan && (
          <button className="button button--quiet" type="button" onClick={() => void useProposalAsFinal(activePlan.id)}>
            Usar como base final
          </button>
        )}
      </section>

      <section className="itinerary-tools" aria-label="Buscar y filtrar">
        <label className="search-field">
          <span className="sr-only">Buscar en el itinerario</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lugar, nota o actividad" />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Filtrar itinerario">
          <option value="all">Todo</option>
          <option value="must">Esenciales</option>
          <option value="booked">Reservado</option>
          <option value="pending">Pendiente</option>
        </select>
      </section>

      <div className="agenda">
        {days.map((day) => {
          const items = getDayItems(workspace, day.id).filter(matches)
          const date = dayDate(workspace.trip.startDate, day.ordinal, day.date)
          return (
            <section className="day-section" key={day.id} aria-labelledby={`heading-${day.id}`}>
              <header className="day-section__header">
                <div className="day-number" aria-hidden="true">{day.ordinal}</div>
                <div>
                  <input
                    key={`${day.id}:${day.updatedAt}`}
                    id={`heading-${day.id}`}
                    className="day-title-input"
                    defaultValue={day.title}
                    onBlur={(event) => {
                      if (event.target.value !== day.title) void updateDay(day.id, { title: event.target.value })
                    }}
                    aria-label={`Nombre del día ${day.ordinal}`}
                  />
                  {date && <p>{date}</p>}
                </div>
                <div className="day-section__actions">
                  <button type="button" onClick={() => openNew(day.id)}>+ Agregar</button>
                  <button type="button" className="icon-action" onClick={() => void deleteDay(day.id)} aria-label={`Eliminar ${day.title}`}>⋯</button>
                </div>
              </header>
              <div className="day-section__items">
                {items.length ? items.map(renderItem) : (
                  <button className="day-empty" type="button" onClick={() => openNew(day.id)}>
                    <span>Este día está libre</span><small>Agregar una parada</small>
                  </button>
                )}
              </div>
            </section>
          )
        })}

        {getUnassignedItems(workspace).filter(matches).length > 0 && (
          <section className="day-section day-section--unassigned" aria-labelledby="unassigned-title">
            <header className="day-section__header">
              <div className="day-number">?</div>
              <div><h2 id="unassigned-title">Sin asignar</h2><p>Ideas todavía sin día</p></div>
              <button type="button" onClick={() => openNew(null)}>+ Agregar</button>
            </header>
            <div className="day-section__items">{getUnassignedItems(workspace).filter(matches).map(renderItem)}</div>
          </section>
        )}
      </div>

      <button className="add-day-card" type="button" onClick={() => void addDay()}>
        <span>＋</span><strong>Agregar otro día</strong><small>Extiende la ruta cuando lo necesites</small>
      </button>

      <ItemEditor key={editorSession} open={editorOpen} item={editing} days={days} participants={workspace.participants} initialDayId={initialDayId}
        onClose={() => setEditorOpen(false)}
        onSave={async (values) => { if (editing) await updateItem(editing.id, values); else await addItem(values) }}
        onDelete={editing ? () => deleteItem(editing.id) : undefined} />
    </div>
  )
}
