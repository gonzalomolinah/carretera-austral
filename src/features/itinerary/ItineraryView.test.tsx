import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedWorkspace } from '../../domain/seed'

const mocked = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))

vi.mock('../../data/WorkspaceContext', () => ({
  useWorkspace: () => mocked.value,
}))

import { ItineraryView } from './ItineraryView'

describe('ItineraryView', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.replaceChildren(container)
    root = createRoot(container)
    const workspace = createSeedWorkspace()
    mocked.value = {
      workspace,
      selectPlan: vi.fn(async () => undefined),
      addDay: vi.fn(async () => workspace.days[0]),
      updateDay: vi.fn(async () => undefined),
      deleteDay: vi.fn(async () => undefined),
      addItem: vi.fn(async () => workspace.items[0]),
      updateItem: vi.fn(async () => undefined),
      deleteItem: vi.fn(async () => undefined),
      moveItem: vi.fn(async () => undefined),
      useProposalAsFinal: vi.fn(async () => undefined),
    }
    HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open') }
    globalThis.requestAnimationFrame ??= (callback) => window.setTimeout(callback, 0)
    globalThis.cancelAnimationFrame ??= (handle) => window.clearTimeout(handle)
  })

  it('abre una parada nueva al recibir la solicitud global', async () => {
    const handled = vi.fn()
    await act(async () => {
      root.render(<ItineraryView addRequest={1} onAddRequestHandled={handled} />)
    })

    expect(container.querySelector('dialog[open]')).not.toBeNull()
    expect((container.querySelector('input[name="title"]') as HTMLInputElement).value).toBe('')
    expect(handled).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
  })

  it('reinicia los campos no controlados entre dos sesiones de edición', async () => {
    await act(async () => {
      root.render(<ItineraryView addRequest={0} onAddRequestHandled={() => undefined} />)
    })
    const cards = [...container.querySelectorAll<HTMLButtonElement>('.itinerary-card__main')]

    await act(async () => cards[0].click())
    const firstTitle = (container.querySelector('input[name="title"]') as HTMLInputElement).value
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Cerrar editor"]')?.click())
    await act(async () => cards[1].click())
    const secondTitle = (container.querySelector('input[name="title"]') as HTMLInputElement).value

    expect(firstTitle).not.toBe(secondTitle)
    expect(secondTitle).toBe(createSeedWorkspace().items[1].title)

    await act(async () => root.unmount())
  })

  it('guarda el título del día al salir del campo y no en cada tecla', async () => {
    await act(async () => {
      root.render(<ItineraryView addRequest={0} onAddRequestHandled={() => undefined} />)
    })
    const updateDay = mocked.value.updateDay as ReturnType<typeof vi.fn>
    const input = container.querySelector<HTMLInputElement>('.day-title-input')
    expect(input).not.toBeNull()

    await act(async () => {
      if (!input) return
      input.value = 'Día de prueba'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(updateDay).not.toHaveBeenCalled()

    await act(async () => input?.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(updateDay).toHaveBeenCalledWith(expect.any(String), { title: 'Día de prueba' })

    await act(async () => root.unmount())
  })
})
