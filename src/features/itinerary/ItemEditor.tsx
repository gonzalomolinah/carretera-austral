import { useRef, type FormEvent } from 'react'
import { Sheet } from '../../components'
import { itemStatusMeta, itemTypeMeta } from '../../domain/constants'
import type { ItineraryItem, Participant, TripDay } from '../../domain/types'

interface ItemEditorProps {
  open: boolean
  item: ItineraryItem | null
  days: TripDay[]
  participants: Participant[]
  initialDayId: string | null
  onClose: () => void
  onSave: (values: Partial<ItineraryItem>) => Promise<void>
  onDelete?: () => Promise<void>
}

const value = (item: ItineraryItem | null, key: keyof ItineraryItem, fallback = '') =>
  item?.[key] == null ? fallback : String(item[key])

export function ItemEditor({ open, item, days, participants, initialDayId, onClose, onSave, onDelete }: ItemEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await onSave({
      title: String(data.get('title') ?? ''),
      type: String(data.get('type') ?? 'activity') as ItineraryItem['type'],
      dayId: String(data.get('dayId') || '') || null,
      location: String(data.get('location') ?? ''),
      origin: String(data.get('origin') ?? ''),
      destination: String(data.get('destination') ?? ''),
      startTime: String(data.get('startTime') || '') || null,
      endTime: String(data.get('endTime') || '') || null,
      durationMinutes: Math.max(0, Number(data.get('durationMinutes')) || 0),
      status: String(data.get('status') ?? 'planned') as ItineraryItem['status'],
      isMust: data.get('isMust') === 'on',
      assigneeParticipantId: String(data.get('assigneeParticipantId') || '') || null,
      estimateClp: Math.max(0, Number(data.get('estimateClp')) || 0),
      actualClp: Math.max(0, Number(data.get('actualClp')) || 0),
      notes: String(data.get('notes') ?? ''),
      mapUrl: String(data.get('mapUrl') ?? ''),
      reservationUrl: String(data.get('reservationUrl') ?? ''),
    })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}
      title={item ? item.title : 'Nueva parada'}
      description={item ? 'Editar detalle' : 'Agregar al viaje'}
      initialFocusRef={titleRef}
      size="lg"
      side="bottom"
      bodyClassName="feature-sheet-body"
      closeLabel="Cerrar editor"
    >
        <form className="editor-form" onSubmit={submit}>
          <label className="field field--wide">
            <span>Título</span>
            <input ref={titleRef} name="title" defaultValue={value(item, 'title')} maxLength={180} required />
          </label>
          <label className="field">
            <span>Tipo</span>
            <select name="type" defaultValue={value(item, 'type', 'activity')}>
              {Object.entries(itemTypeMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Día</span>
            <select name="dayId" defaultValue={item?.dayId ?? initialDayId ?? ''}>
              <option value="">Sin asignar</option>
              {days.map((day) => <option key={day.id} value={day.id}>{day.title}</option>)}
            </select>
          </label>
          <label className="field field--wide">
            <span>Lugar o referencia</span>
            <input name="location" defaultValue={value(item, 'location')} maxLength={240} placeholder="Ej. Caleta Gonzalo" />
          </label>
          <label className="field">
            <span>Origen</span>
            <input name="origin" defaultValue={value(item, 'origin')} maxLength={240} />
          </label>
          <label className="field">
            <span>Destino</span>
            <input name="destination" defaultValue={value(item, 'destination')} maxLength={240} />
          </label>
          <label className="field">
            <span>Hora inicio</span>
            <input name="startTime" type="time" defaultValue={value(item, 'startTime')} />
          </label>
          <label className="field">
            <span>Hora fin</span>
            <input name="endTime" type="time" defaultValue={value(item, 'endTime')} />
          </label>
          <label className="field">
            <span>Duración (min)</span>
            <input name="durationMinutes" type="number" min="0" max="2880" step="15" defaultValue={value(item, 'durationMinutes', '0')} />
          </label>
          <label className="field">
            <span>Estado</span>
            <select name="status" defaultValue={value(item, 'status', 'planned')}>
              {Object.entries(itemStatusMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Responsable</span>
            <select name="assigneeParticipantId" defaultValue={value(item, 'assigneeParticipantId')}>
              <option value="">Sin asignar</option>
              {participants.filter((person) => person.active).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Estimado (CLP)</span>
            <input name="estimateClp" type="number" min="0" step="1000" defaultValue={value(item, 'estimateClp', '0')} />
          </label>
          <label className="field">
            <span>Real (CLP)</span>
            <input name="actualClp" type="number" min="0" step="1000" defaultValue={value(item, 'actualClp', '0')} />
          </label>
          <label className="field field--wide checkbox-field">
            <input name="isMust" type="checkbox" defaultChecked={item?.isMust} />
            <span>Imprescindible para el viaje</span>
          </label>
          <label className="field field--wide">
            <span>Notas</span>
            <textarea name="notes" rows={4} defaultValue={value(item, 'notes')} maxLength={10_000} />
          </label>
          <label className="field field--wide">
            <span>Enlace de mapa</span>
            <input name="mapUrl" type="url" defaultValue={value(item, 'mapUrl')} placeholder="https://…" />
          </label>
          <label className="field field--wide">
            <span>Reserva o referencia</span>
            <input name="reservationUrl" type="url" defaultValue={value(item, 'reservationUrl')} placeholder="https://…" />
          </label>
          <div className="editor-form__actions field--wide">
            {item && onDelete ? <button className="button button--danger-ghost" type="button" onClick={() => void onDelete().then(onClose)}>Mover a papelera</button> : <span />}
            <button className="button button--primary" type="submit">{item ? 'Guardar cambios' : 'Agregar parada'}</button>
          </div>
        </form>
    </Sheet>
  )
}
