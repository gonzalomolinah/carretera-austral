import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('abre el itinerario y navega por las cuatro áreas', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ruta Austral', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mapa' }).click()
  await expect(page.getByRole('heading', { name: 'Mapa del viaje' })).toBeVisible()
  await page.getByRole('button', { name: 'Gastos' }).click()
  await expect(page.getByRole('heading', { name: 'Gastos del viaje' })).toBeVisible()
  await page.getByRole('button', { name: 'Más' }).click()
  await expect(page.getByRole('heading', { name: 'Más herramientas' })).toBeVisible()
})

test('permite crear una parada y conservarla tras recargar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Agregar al itinerario' }).click()
  await page.getByLabel('Título').fill('Parada de prueba offline')
  await page.getByRole('button', { name: 'Agregar parada' }).click()
  await expect(page.getByText('Parada de prueba offline')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Parada de prueba offline')).toBeVisible()
})

test('la pantalla inicial no presenta infracciones axe críticas', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
  expect(results.violations.filter((violation) => violation.impact === 'critical')).toEqual([])
})

