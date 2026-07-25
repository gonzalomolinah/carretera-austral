import { act, type PropsWithChildren } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedWorkspace } from '../../domain/seed'

const mocked = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))

vi.mock('leaflet', () => ({ divIcon: () => ({}) }))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: PropsWithChildren) => <div data-testid="mapa-base">{children}</div>,
  Marker: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Popup: ({ children }: PropsWithChildren) => <div>{children}</div>,
  TileLayer: () => null,
}))
vi.mock('../../data/WorkspaceContext', () => ({
  useWorkspace: () => mocked.value,
}))

import { MapView } from './MapView'

describe('MapView', () => {
  let container: HTMLDivElement
  let root: Root
  let online = true

  beforeEach(() => {
    container = document.createElement('div')
    document.body.replaceChildren(container)
    root = createRoot(container)
    online = true
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => online,
    })
    mocked.value = {
      workspace: createSeedWorkspace(),
      updateItem: vi.fn(async () => undefined),
    }
  })

  it('reacciona a eventos offline y online sin necesitar otro render', async () => {
    await act(async () => root.render(<MapView />))
    expect(container.textContent).toContain('Mapa online')
    expect(container.querySelector('[data-testid="mapa-base"]')).not.toBeNull()

    online = false
    await act(async () => window.dispatchEvent(new Event('offline')))
    expect(container.textContent).toContain('Sin mapa base')
    expect(container.querySelector('[data-testid="mapa-base"]')).toBeNull()

    online = true
    await act(async () => window.dispatchEvent(new Event('online')))
    expect(container.textContent).toContain('Mapa online')
    expect(container.querySelector('[data-testid="mapa-base"]')).not.toBeNull()

    await act(async () => root.unmount())
  })
})
