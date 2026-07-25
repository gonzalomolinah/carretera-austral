import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatBytes, formatClp } from '../../domain/constants'
import type { ChecklistTask, TripContact, TripDocument } from '../../domain/types'
import { useWorkspace } from '../../data/WorkspaceContext'
import {
  ATTACHMENT_GC_GRACE_DAYS,
  attachmentUsage,
  collectAttachmentGarbage,
  downloadLocalAttachment,
  removeLocalAttachment,
  saveLocalAttachment,
  stageLocalAttachmentRestore,
} from '../../data/attachments'
import { getMeta, setMeta } from '../../data/localDb'
import {
  MAX_WORKSPACE_BACKUP_FILE_BYTES,
  downloadPlanCalendar,
  downloadPlanGeoJson,
  downloadPlanGpx,
  downloadPlanKml,
  downloadWorkspaceBackup,
  parseWorkspaceBackup,
} from '../../exports'

type MoreSection = 'checklist' | 'documents' | 'contacts' | 'weather' | 'settings'

const sections: Array<{ id: MoreSection; label: string; icon: string }> = [
  { id: 'checklist', label: 'Checklist', icon: '✓' },
  { id: 'documents', label: 'Documentos', icon: '▤' },
  { id: 'contacts', label: 'Contactos', icon: '☎' },
  { id: 'weather', label: 'Clima', icon: '☁' },
  { id: 'settings', label: 'Ajustes', icon: '⚙' },
]

export function MoreView() {
  const [section, setSection] = useState<MoreSection>('checklist')
  return (
    <div className="screen more-screen">
      <header className="screen-heading"><div><p className="eyebrow">Centro operativo</p><h1>Más herramientas</h1><p>Preparativos, archivos y referencias que mantienen el viaje bajo control.</p></div></header>
      <div className="more-layout">
        <nav className="more-nav" aria-label="Herramientas del viaje">{sections.map((item) => <button key={item.id} aria-current={section === item.id ? 'page' : undefined} className={section === item.id ? 'is-active' : ''} type="button" onClick={() => setSection(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
        <div className="more-content">
          {section === 'checklist' && <ChecklistPanel />}
          {section === 'documents' && <DocumentsPanel />}
          {section === 'contacts' && <ContactsPanel />}
          {section === 'weather' && <WeatherPanel />}
          {section === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  )
}

function ChecklistPanel() {
  const { workspace, addTask, updateTask, deleteTask } = useWorkspace()
  const [showCompleted, setShowCompleted] = useState(true)
  const tasks = workspace.tasks.filter((task) => !task.deletedAt && (showCompleted || !task.completed))
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const now = new Date().toISOString()
    const task: ChecklistTask = {
      id: crypto.randomUUID(), tripId: workspace.trip.id, title: String(data.get('title') ?? ''), category: String(data.get('category') || 'General'),
      completed: false, dueDate: String(data.get('dueDate') || '') || null, assigneeParticipantId: String(data.get('assignee') || '') || null,
      linkedDayId: null, linkedItemId: null, updatedAt: now, deletedAt: null,
    }
    await addTask(task); event.currentTarget.reset()
  }
  const grouped = useMemo(() => {
    const groups = new Map<string, ChecklistTask[]>()
    for (const task of tasks) {
      const category = task.category || 'General'
      groups.set(category, [...(groups.get(category) ?? []), task])
    }
    return groups
  }, [tasks])
  return <section aria-labelledby="checklist-title">
    <div className="section-title-row"><div><p className="eyebrow">Antes y durante</p><h2 id="checklist-title">Checklist central</h2></div><label className="toggle-label"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /> Ver completadas</label></div>
    <form className="quick-add-form" onSubmit={submit}>
      <input name="title" required maxLength={180} placeholder="Agregar una tarea" aria-label="Nueva tarea" />
      <select name="category" aria-label="Categoría"><option>Documentos</option><option>Vehículo</option><option>Reservas</option><option>Equipaje</option><option>Compras</option><option>General</option></select>
      <select name="assignee" aria-label="Responsable"><option value="">Todos</option>{workspace.participants.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select>
      <input name="dueDate" type="date" aria-label="Fecha límite" />
      <button className="button button--primary" type="submit">Agregar</button>
    </form>
    {tasks.length ? <div className="checklist-groups">{[...grouped.entries()].map(([category, categoryTasks]) => <section key={category}><h3>{category}<span>{categoryTasks.filter((task) => task.completed).length}/{categoryTasks.length}</span></h3><ul>{categoryTasks.map((task) => <li className={task.completed ? 'is-completed' : ''} key={task.id}><label><input type="checkbox" checked={task.completed} onChange={() => void updateTask(task.id, { completed: !task.completed })} /><span><strong>{task.title}</strong><small>{task.dueDate ? `Antes del ${task.dueDate}` : 'Sin fecha'} · {task.assigneeParticipantId ? workspace.participants.find((person) => person.id === task.assigneeParticipantId)?.name : 'Todos'}</small></span></label><button className="icon-action" type="button" onClick={() => void deleteTask(task.id)} aria-label={`Eliminar ${task.title}`}>×</button></li>)}</ul></section>)}</div> : <div className="illustrated-empty"><span>✓</span><h3>Preparativos al día</h3><p>Agrega documentos, reservas y compras que no quieres olvidar.</p></div>}
  </section>
}

function DocumentsPanel() {
  const { workspace, addDocument, deleteDocument } = useWorkspace()
  const [usage, setUsage] = useState(0)
  const [message, setMessage] = useState('')
  const documents = workspace.documents.filter((document) => !document.deletedAt)
  useEffect(() => { void attachmentUsage(workspace.trip.id).then(setUsage) }, [workspace.trip.id, documents.length])
  const addLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const now = new Date().toISOString()
    const document: TripDocument = { id: crypto.randomUUID(), tripId: workspace.trip.id, title: String(data.get('title') ?? ''), kind: 'link', url: String(data.get('url') ?? ''), attachmentId: null, linkedItemId: null, notes: '', updatedAt: now, deletedAt: null }
    await addDocument(document); event.currentTarget.reset()
  }
  const addFile = async (file: File | null) => {
    if (!file) return
    let attachmentId: string | null = null
    let documentSaved = false
    try {
      const attachment = await saveLocalAttachment(workspace.trip.id, file, null)
      attachmentId = attachment.id
      const now = new Date().toISOString()
      await addDocument({ id: crypto.randomUUID(), tripId: workspace.trip.id, title: file.name, kind: 'attachment', url: '', attachmentId: attachment.id, linkedItemId: null, notes: '', updatedAt: now, deletedAt: null })
      documentSaved = true
      setUsage(await attachmentUsage(workspace.trip.id))
      setMessage(`${file.name} quedó disponible offline en este dispositivo.`)
    } catch (error) {
      if (attachmentId && !documentSaved) await removeLocalAttachment(attachmentId, workspace.trip.id).catch(() => false)
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el archivo.')
    }
  }
  const downloadAttachment = async (attachmentId: string | null) => {
    if (!attachmentId) return
    try {
      await downloadLocalAttachment(attachmentId)
      setMessage('Descarga iniciada.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo abrir el archivo.')
    }
  }
  const deleteWithRetention = async (document: TripDocument) => {
    await deleteDocument(document.id)
    setMessage(document.kind === 'attachment'
      ? 'El documento se eliminó, pero su archivo queda conservado para Deshacer.'
      : 'El enlace se eliminó y se puede deshacer.')
  }
  const cleanupOrphans = async () => {
    try {
      const result = await collectAttachmentGarbage(workspace)
      setUsage(await attachmentUsage(workspace.trip.id))
      setMessage(result.count
        ? `Se liberaron ${formatBytes(result.bytes)} de ${result.count} archivo${result.count === 1 ? '' : 's'} huérfano${result.count === 1 ? '' : 's'}.`
        : `No hay archivos huérfanos con más de ${ATTACHMENT_GC_GRACE_DAYS} días.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo limpiar el almacenamiento local.')
    }
  }
  return <section aria-labelledby="documents-title">
    <div className="section-title-row"><div><p className="eyebrow">Bóveda del viaje</p><h2 id="documents-title">Documentos y reservas</h2></div><span>{formatBytes(usage)} / 250 MB offline</span></div>
    <div className="document-actions"><form onSubmit={addLink}><input name="title" required placeholder="Nombre del enlace" aria-label="Nombre del documento" /><input name="url" type="url" required placeholder="https://…" aria-label="URL" /><button className="button button--primary" type="submit">Guardar enlace</button></form><label className="button button--quiet file-button">Adjuntar archivo<input type="file" onChange={(event) => { void addFile(event.target.files?.[0] ?? null); event.currentTarget.value = '' }} /></label></div>
    <div className="document-maintenance"><p>Los archivos eliminados se conservan mientras un snapshot permita Deshacer. La limpieza sólo borra blobs sin referencia con al menos {ATTACHMENT_GC_GRACE_DAYS} días.</p><button className="button button--quiet" type="button" onClick={() => void cleanupOrphans()}>Limpiar archivos huérfanos</button></div>
    {message && <p className="form-note" role="status">{message}</p>}
    {documents.length ? <div className="document-grid">{documents.map((document) => <article key={document.id}><span className="document-icon">{document.kind === 'link' ? '↗' : '▤'}</span><div><strong>{document.title}</strong><small>{document.kind === 'link' ? 'Enlace' : 'Offline en el dispositivo que lo adjuntó'}</small></div>{document.url && <a href={document.url} target="_blank" rel="noreferrer">Abrir</a>}{document.kind === 'attachment' && <button type="button" onClick={() => void downloadAttachment(document.attachmentId)}>Descargar</button>}<button className="icon-action" type="button" onClick={() => void deleteWithRetention(document)} aria-label={`Eliminar ${document.title}`}>×</button></article>)}</div> : <div className="illustrated-empty"><span>▤</span><h3>Todo a mano, incluso offline</h3><p>Guarda pasajes, reservas, seguros y enlaces importantes.</p></div>}
  </section>
}

function ContactsPanel() {
  const { workspace, addContact, deleteContact } = useWorkspace()
  const contacts = workspace.contacts.filter((contact) => !contact.deletedAt)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const now = new Date().toISOString()
    const contact: TripContact = { id: crypto.randomUUID(), tripId: workspace.trip.id, name: String(data.get('name') ?? ''), role: String(data.get('role') ?? ''), phone: String(data.get('phone') ?? ''), email: String(data.get('email') ?? ''), url: '', notes: '', updatedAt: now, deletedAt: null }
    await addContact(contact); event.currentTarget.reset()
  }
  return <section aria-labelledby="contacts-title"><div className="section-title-row"><div><p className="eyebrow">Referencias</p><h2 id="contacts-title">Contactos útiles</h2></div></div>
    <form className="quick-add-form" onSubmit={submit}><input name="name" required placeholder="Nombre" /><input name="role" placeholder="Rol o lugar" /><input name="phone" type="tel" placeholder="Teléfono" /><input name="email" type="email" placeholder="Email" /><button className="button button--primary">Agregar</button></form>
    {contacts.length ? <div className="contact-grid">{contacts.map((contact) => <article key={contact.id}><div className="contact-avatar">{contact.name.slice(0, 1)}</div><div><strong>{contact.name}</strong><span>{contact.role || 'Contacto del viaje'}</span><p>{contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>} {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}</p></div><button className="icon-action" type="button" onClick={() => void deleteContact(contact.id)} aria-label={`Eliminar ${contact.name}`}>×</button></article>)}</div> : <div className="illustrated-empty"><span>☎</span><h3>Sin contactos guardados</h3><p>Registra ferries, alojamientos, emergencias o guías locales.</p></div>}
  </section>
}

interface WeatherPayload { daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; wind_speed_10m_max: number[] } }
const weatherLabel = (code: number) => code === 0 ? 'Despejado' : code <= 3 ? 'Parcialmente nublado' : code <= 48 ? 'Niebla' : code <= 67 ? 'Lluvia' : code <= 77 ? 'Nieve' : code <= 82 ? 'Chubascos' : 'Tormenta'

function WeatherPanel() {
  const { workspace } = useWorkspace()
  const places = workspace.items.filter((item) => item.planId === workspace.selectedPlanId && item.coordinates && !item.deletedAt)
  const [itemId, setItemId] = useState(places[0]?.id ?? '')
  const [weather, setWeather] = useState<WeatherPayload | null>(null)
  const [message, setMessage] = useState('')
  const selected = places.find((item) => item.id === itemId) ?? places[0]
  const load = async () => {
    if (!selected?.coordinates) return
    const cacheKey = `weather:${selected.id}`
    if (!navigator.onLine) { setWeather(await getMeta<WeatherPayload>(cacheKey)); setMessage('Pronóstico guardado anteriormente. Conéctate para actualizarlo.'); return }
    setMessage('Actualizando pronóstico…')
    try {
      const { latitude, longitude } = selected.coordinates
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=America%2FSantiago&forecast_days=7`)
      if (!response.ok) throw new Error()
      const data = await response.json() as WeatherPayload; setWeather(data); await setMeta(cacheKey, data); setMessage('Pronóstico de Open-Meteo · actualizado ahora')
    } catch { setWeather(await getMeta<WeatherPayload>(cacheKey)); setMessage('No pudimos actualizar. Mostrando la última copia disponible.') }
  }
  useEffect(() => { void load() }, [itemId])
  return <section aria-labelledby="weather-title"><div className="section-title-row"><div><p className="eyebrow">Decidir con contexto</p><h2 id="weather-title">Clima de la ruta</h2></div><select value={selected?.id ?? ''} onChange={(event) => setItemId(event.target.value)} aria-label="Lugar del pronóstico">{places.map((item) => <option key={item.id} value={item.id}>{item.location || item.title}</option>)}</select></div>
    {!selected ? <div className="illustrated-empty"><span>⌖</span><h3>Primero ubica un lugar</h3><p>Agrega un pin desde Mapa para consultar su pronóstico.</p></div> : <><p className="weather-message" role="status">{message}</p>{weather && <div className="weather-grid">{weather.daily.time.map((date, index) => <article key={date}><span>{new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))}</span><strong>{Math.round(weather.daily.temperature_2m_max[index])}°</strong><small>{weatherLabel(weather.daily.weather_code[index])}</small><p>{weather.daily.precipitation_probability_max[index]}% lluvia · {Math.round(weather.daily.wind_speed_10m_max[index])} km/h</p></article>)}</div>}</>}
    <div className="official-links"><a href="https://www.barcazas.cl/" target="_blank" rel="noreferrer">Estado de barcazas ↗</a><a href="https://www.mop.gob.cl/" target="_blank" rel="noreferrer">Ministerio de Obras Públicas ↗</a><a href="https://www.conaf.cl/parques-nacionales/" target="_blank" rel="noreferrer">Parques CONAF ↗</a></div>
  </section>
}

function SettingsPanel() {
  const { workspace, updateTrip, selectProfile, importWorkspace, syncNow } = useWorkspace()
  const [theme, setTheme] = useState(localStorage.getItem('ruta-austral-theme') ?? 'system')
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null)
  const [exporting, setExporting] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const applyTheme = (next: string) => { setTheme(next); localStorage.setItem('ruta-austral-theme', next); if (next === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = next }
  useEffect(() => { void (async () => { const estimate = await navigator.storage?.estimate?.(); const persisted = await navigator.storage?.persisted?.(); setStorage({ usage: estimate?.usage ?? 0, quota: estimate?.quota ?? 0, persisted: Boolean(persisted) }) })() }, [])
  const runExport = async (name: string, action: () => unknown | Promise<unknown>) => {
    setExporting(name)
    setExportMessage('')
    try {
      const result = await action()
      setExportMessage(typeof result === 'string' ? result : 'Descarga preparada correctamente.')
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'No se pudo preparar la descarga.')
    } finally {
      setExporting('')
    }
  }
  const importJson = async (file: File | null) => {
    if (!file) return
    try {
      if (file.size > MAX_WORKSPACE_BACKUP_FILE_BYTES) {
        throw new Error('El respaldo supera el máximo de 350 MB que puede procesar el navegador.')
      }
      const parsed = parseWorkspaceBackup(JSON.parse(await file.text()) as unknown)
      if (parsed.workspace.trip.id !== workspace.trip.id) {
        throw new Error('El respaldo pertenece a otro viaje y no puede reemplazar esta ruta.')
      }
      const restore = await stageLocalAttachmentRestore(parsed.workspace, parsed.attachments)
      try {
        await importWorkspace(parsed.workspace)
        restore.commit()
      } catch (error) {
        await restore.rollback()
        throw error
      }
      if (parsed.format === 'legacy-workspace') {
        setImportMessage('Workspace antiguo importado. Ese formato no contenía los archivos adjuntos locales.')
      } else if (parsed.missingAttachmentIds.length) {
        setImportMessage(`Respaldo importado con ${restore.restoredCount} adjuntos. ${parsed.missingAttachmentIds.length} archivo${parsed.missingAttachmentIds.length === 1 ? '' : 's'} no venía${parsed.missingAttachmentIds.length === 1 ? '' : 'n'} incluido${parsed.missingAttachmentIds.length === 1 ? '' : 's'}.`)
      } else {
        setImportMessage(`Respaldo importado con ${restore.restoredCount} adjunto${restore.restoredCount === 1 ? '' : 's'} local${restore.restoredCount === 1 ? '' : 'es'}.`)
      }
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'No se pudo importar el respaldo.')
    }
  }
  const requestPersistence = async () => { await navigator.storage?.persist?.(); const estimate = await navigator.storage?.estimate?.(); setStorage({ usage: estimate?.usage ?? 0, quota: estimate?.quota ?? 0, persisted: Boolean(await navigator.storage?.persisted?.()) }) }
  return <section aria-labelledby="settings-title"><div className="section-title-row"><div><p className="eyebrow">Preferencias y respaldo</p><h2 id="settings-title">Ajustes</h2></div><button className="button button--quiet" type="button" onClick={() => void syncNow()}>Sincronizar ahora</button></div>
    <div className="settings-grid">
      <section className="settings-card"><h3>Viaje</h3><label className="field"><span>Nombre</span><input defaultValue={workspace.trip.name} onBlur={(event) => void updateTrip({ name: event.target.value })} /></label><label className="field"><span>Fecha de inicio</span><input type="date" defaultValue={workspace.trip.startDate ?? ''} onBlur={(event) => void updateTrip({ startDate: event.target.value || null })} /></label></section>
      <section className="settings-card"><h3>Este dispositivo</h3><label className="field"><span>¿Quién está usando la app?</span><select value={workspace.profileParticipantId ?? ''} onChange={(event) => void selectProfile(event.target.value || null)}><option value="">Sin elegir</option>{workspace.participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><p>La elección es local; no hay cuenta ni contraseña.</p></section>
      <section className="settings-card"><h3>Apariencia</h3><div className="segmented-control"><button type="button" className={theme === 'system' ? 'is-active' : ''} onClick={() => applyTheme('system')}>Sistema</button><button type="button" className={theme === 'light' ? 'is-active' : ''} onClick={() => applyTheme('light')}>Claro</button><button type="button" className={theme === 'dark' ? 'is-active' : ''} onClick={() => applyTheme('dark')}>Oscuro</button></div></section>
      <section className="settings-card"><h3>Uso offline</h3><p>{storage ? `${formatBytes(storage.usage)} usados de ${formatBytes(storage.quota)}` : 'Calculando almacenamiento…'}</p><p>{storage?.persisted ? 'El navegador marcó estos datos como persistentes.' : 'El dispositivo puede liberar estos datos si necesita espacio.'}</p><button className="button button--quiet" type="button" onClick={() => void requestPersistence()}>Solicitar almacenamiento persistente</button></section>
    </div>
    <section className="export-section"><div><p className="eyebrow">Roadbook y compatibilidad</p><h3>Exportar el viaje</h3></div><div className="export-grid">
      <button type="button" onClick={() => void runExport('pdf', async () => { const { downloadRoadbookPdf } = await import('../../exports/pdf'); await downloadRoadbookPdf(workspace) })}><strong>PDF</strong><span>{exporting === 'pdf' ? 'Generando…' : 'Roadbook completo'}</span></button>
      <button type="button" onClick={() => void runExport('ics', () => downloadPlanCalendar(workspace))}><strong>ICS</strong><span>Calendario por hito</span></button>
      <button type="button" onClick={() => void runExport('gpx', () => downloadPlanGpx(workspace))}><strong>GPX</strong><span>Waypoints y ruta</span></button>
      <button type="button" onClick={() => void runExport('kml', () => downloadPlanKml(workspace))}><strong>KML</strong><span>Google Earth</span></button>
      <button type="button" onClick={() => void runExport('geojson', () => downloadPlanGeoJson(workspace))}><strong>GEO</strong><span>GeoJSON abierto</span></button>
      <button type="button" onClick={() => void runExport('json', async () => { const result = await downloadWorkspaceBackup(workspace); const missing = result.backup.missingAttachmentIds.length; return missing ? `Respaldo creado con ${result.attachmentCount} adjuntos; ${missing} no estaba${missing === 1 ? '' : 'n'} disponible${missing === 1 ? '' : 's'} en este dispositivo.` : `Respaldo creado con ${result.attachmentCount} adjunto${result.attachmentCount === 1 ? '' : 's'} local${result.attachmentCount === 1 ? '' : 'es'}.` })}><strong>JSON</strong><span>Workspace + adjuntos locales</span></button>
    </div><p className="form-note">El JSON incluye los archivos disponibles en este dispositivo y reporta cualquier adjunto ausente.</p>{exportMessage && <p className="form-note" role="status">{exportMessage}</p>}</section>
    <section className="settings-card import-card"><div><h3>Importar respaldo</h3><p>Valida el workspace y todos los adjuntos antes de reemplazar datos. También acepta el JSON antiguo sin archivos.</p>{importMessage && <p role="status">{importMessage}</p>}</div><label className="button button--quiet file-button">Elegir JSON<input type="file" accept="application/json,.json" onChange={(event) => { void importJson(event.target.files?.[0] ?? null); event.currentTarget.value = '' }} /></label></section>
    <section className="install-guide"><div><p className="eyebrow">iPhone · iOS 17+</p><h3>Instalar Ruta Austral</h3><p>Primero verifica que diga “Sincronizado”. Después abre Compartir, elige “Añadir a pantalla de inicio” y abre la app una vez con internet.</p></div><ol><li>Compartir</li><li>Añadir a inicio</li><li>Abrir online</li></ol></section>
    <a className="legacy-link" href="/legacy/index.html" target="_blank" rel="noreferrer">Abrir versión anterior en modo de recuperación ↗</a>
  </section>
}
