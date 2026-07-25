import { divIcon } from 'leaflet'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getPlanItems } from '../../domain/selectors'
import type { ItineraryItem } from '../../domain/types'
import { useWorkspace } from '../../data/WorkspaceContext'

interface GeocodingResult {
  id: number
  name: string
  latitude: number
  longitude: number
  admin1?: string
  country?: string
}

const markerIcon = divIcon({
  className: 'route-map-marker',
  html: '<span aria-hidden="true"></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
})

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    update()
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

export function MapView() {
  const { workspace, updateItem } = useWorkspace()
  const items = getPlanItems(workspace)
  const mapped = items.filter((item) => item.coordinates)
  const pending = items.filter((item) => !item.coordinates && item.location)
  const [selected, setSelected] = useState<ItineraryItem | null>(pending[0] ?? null)
  const [query, setQuery] = useState(selected?.location ?? '')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const online = useOnlineStatus()
  const center = useMemo<[number, number]>(() => {
    const coordinate = mapped[0]?.coordinates
    return coordinate ? [coordinate.latitude, coordinate.longitude] : [-44.1, -72.2]
  }, [mapped])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim() || !online) return
    setSearching(true); setError('')
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5&language=es&format=json`)
      if (!response.ok) throw new Error('No se pudo consultar el buscador.')
      const payload = await response.json() as { results?: GeocodingResult[] }
      setResults(payload.results ?? [])
      if (!payload.results?.length) setError('No encontramos coincidencias. Puedes conservar el texto y resolverlo más tarde.')
    } catch {
      setError('El buscador no está disponible. El lugar seguirá guardado como texto.')
    } finally {
      setSearching(false)
    }
  }

  const choose = async (result: GeocodingResult) => {
    if (!selected) return
    await updateItem(selected.id, {
      location: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
      coordinates: { latitude: result.latitude, longitude: result.longitude },
      locationPending: false,
    })
    setSelected(null); setResults([]); setQuery('')
  }

  return (
    <div className="screen map-screen">
      <header className="screen-heading">
        <div><p className="eyebrow">Vista territorial</p><h1>Mapa del viaje</h1><p>Los pines ayudan a orientarse; el orden lo define el itinerario.</p></div>
        <span className={`connectivity-badge ${online ? '' : 'is-offline'}`}>{online ? 'Mapa online' : 'Sin mapa base'}</span>
      </header>

      <div className="map-layout">
        <section className="map-panel" aria-label="Mapa de lugares guardados">
          {online ? (
            <MapContainer key={`${center[0]}-${center[1]}`} center={center} zoom={6} scrollWheelZoom className="route-map">
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {mapped.map((item, index) => item.coordinates && (
                <Marker key={item.id} position={[item.coordinates.latitude, item.coordinates.longitude]} icon={markerIcon} title={item.title}>
                  <Popup><strong>{index + 1}. {item.title}</strong><br />{item.location}</Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="offline-map">
              <div className="offline-map__contours" aria-hidden="true" />
              <strong>El mapa base necesita internet</strong>
              <p>Tus coordenadas y el orden de los lugares siguen disponibles en la lista.</p>
            </div>
          )}
        </section>

        <aside className="map-sidebar">
          <section>
            <div className="section-title-row"><div><p className="eyebrow">Orden planificado</p><h2>{mapped.length} lugares ubicados</h2></div></div>
            <ol className="map-place-list">
              {mapped.map((item, index) => (
                <li key={item.id}>
                  <span>{index + 1}</span><div><strong>{item.title}</strong><small>{item.location}</small></div>
                  <button type="button" onClick={() => { setSelected(item); setQuery(item.location) }}>Editar pin</button>
                </li>
              ))}
            </ol>
          </section>

          <section className="geocode-card">
            <p className="eyebrow">Resolver ubicación</p>
            <h2>{selected ? selected.title : 'Elige una parada'}</h2>
            {pending.length > 0 && (
              <select value={selected?.id ?? ''} onChange={(event) => {
                const item = items.find((candidate) => candidate.id === event.target.value) ?? null
                setSelected(item); setQuery(item?.location ?? ''); setResults([])
              }} aria-label="Parada por ubicar">
                <option value="">Seleccionar…</option>
                {pending.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            )}
            <form onSubmit={search} className="geocode-form">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar localidad" disabled={!selected} />
              <button className="button button--primary" type="submit" disabled={!selected || !online || searching}>{searching ? 'Buscando…' : 'Buscar'}</button>
            </form>
            {error && <p className="form-note form-note--error" role="status">{error}</p>}
            {results.length > 0 && <ul className="search-results">{results.map((result) => (
              <li key={result.id}><button type="button" onClick={() => void choose(result)}><strong>{result.name}</strong><span>{[result.admin1, result.country].filter(Boolean).join(', ')}</span></button></li>
            ))}</ul>}
          </section>
        </aside>
      </div>
    </div>
  )
}
