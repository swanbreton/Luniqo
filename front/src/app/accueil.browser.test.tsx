import '@/styles/index.css'

import { createMemoryHistory } from '@tanstack/react-router'
import { http, HttpResponse } from 'msw'
import { describe, expect } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { dayAttendance, nursery, nurserySummary, owner } from '../../test/fixtures'
import { test } from '../../test/msw'
import { App, createApp } from './app'

const south = { ...nursery, id: '00000000-0000-4000-8000-0000000000c2', name: 'Micro-crèche Démo Sud' }

function start() {
  return render(<App instance={createApp(createMemoryHistory({ initialEntries: ['/accueil'] }))} />)
}

describe('résumés sur l’accueil', () => {
  test('la direction voit les chiffres de chaque crèche, lisibles en 800 × 600', async ({ worker }) => {
    worker.use(
      http.get('/api/v2/auth/me', () => HttpResponse.json({ ...owner, mfa: 'verified' })),
      http.get('/api/v2/nurseries', () => HttpResponse.json([nursery, south])),
      http.get(`/api/v2/nurseries/${nursery.id}/summary`, () => HttpResponse.json(nurserySummary)),
      http.get(`/api/v2/nurseries/${south.id}/summary`, () => HttpResponse.json({ children: 6, present: 0, staff: 2 })),
    )
    await page.viewport(800, 600)
    const screen = await start()
    const northCard = screen.getByRole('region', { name: nursery.name })
    const southCard = screen.getByRole('region', { name: south.name })
    await expect.element(northCard.getByText('12', { exact: true })).toBeVisible()
    await expect.element(northCard.getByText('8', { exact: true })).toBeVisible()
    await expect.element(northCard.getByText('4', { exact: true })).toBeVisible()
    await expect.element(southCard.getByText('6', { exact: true })).toBeVisible()
    await expect.element(southCard.getByText('0', { exact: true })).toBeVisible()
    await expect.element(southCard.getByText('2', { exact: true })).toBeVisible()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
    for (const element of document.querySelectorAll('dt, dd, [data-slot="card-title"]')) {
      expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth)
    }
  })

  test('un résumé en erreur laisse l’autre carte et les liens utilisables', async ({ worker }) => {
    worker.use(
      http.get('/api/v2/auth/me', () => HttpResponse.json({ ...owner, mfa: 'verified' })),
      http.get('/api/v2/nurseries', () => HttpResponse.json([nursery, south])),
      http.get(`/api/v2/nurseries/${nursery.id}/summary`, () => HttpResponse.json(nurserySummary)),
      http.get(`/api/v2/nurseries/${south.id}/summary`, () =>
        HttpResponse.json({ detail: 'Service indisponible' }, { status: 503 }),
      ),
      http.get(`/api/v2/nurseries/${south.id}`, () => HttpResponse.json(south)),
      http.get(`/api/v2/nurseries/${south.id}/attendance`, () => HttpResponse.json(dayAttendance)),
    )
    const screen = await start()
    const northCard = screen.getByRole('region', { name: nursery.name })
    const southCard = screen.getByRole('region', { name: south.name })
    await expect.element(northCard.getByText('12', { exact: true })).toBeVisible()
    await expect.element(southCard.getByRole('alert').getByText('Impossible de charger le résumé.')).toBeVisible()
    await southCard.getByRole('link', { name: `Présences de ${south.name}` }).click()
    await expect.element(screen.getByRole('heading', { name: `Présences du jour · ${south.name}` })).toBeVisible()
  })
})
