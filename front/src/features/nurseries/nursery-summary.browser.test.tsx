import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, expect } from 'vitest'
import { render } from 'vitest-browser-react'

import { nursery, nurserySummary } from '../../../test/fixtures'
import { test } from '../../../test/msw'
import { NurserySummary } from './nursery-summary'

const SUMMARY = `/api/v2/nurseries/${nursery.id}/summary`

function start() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NurserySummary nurseryId={nursery.id} />
    </QueryClientProvider>,
  )
}

describe('résumé de crèche', () => {
  test('chargement puis valeurs renvoyées par l’API', async ({ worker }) => {
    let release: (() => void) | undefined
    const response = new Promise<Response>((resolve) => {
      release = () => resolve(HttpResponse.json(nurserySummary))
    })
    worker.use(http.get(SUMMARY, () => response))
    const screen = await start()
    try {
      await expect.element(screen.getByRole('status')).toBeVisible()
    } finally {
      release?.()
    }
    await expect.element(screen.getByText('12', { exact: true })).toBeVisible()
    await expect.element(screen.getByText('8', { exact: true })).toBeVisible()
    await expect.element(screen.getByText('4', { exact: true })).toBeVisible()
    await expect.element(screen.getByRole('status')).not.toBeInTheDocument()
  })

  test('une crèche vide affiche trois zéros', async ({ worker }) => {
    worker.use(http.get(SUMMARY, () => HttpResponse.json({ children: 0, present: 0, staff: 0 })))
    const screen = await start()
    await expect.element(screen.getByText('0', { exact: true }).nth(2)).toBeVisible()
    await expect.element(screen.getByText('Enfants accueillis')).toBeVisible()
    await expect.element(screen.getByText('Présents en ce moment')).toBeVisible()
    await expect.element(screen.getByText('Personnel')).toBeVisible()
  })

  test('une erreur peut être réessayée', async ({ worker }) => {
    worker.use(http.get(SUMMARY, () => HttpResponse.json({ detail: 'Service indisponible' }, { status: 503 })))
    const screen = await start()
    await expect.element(screen.getByRole('alert').getByText('Impossible de charger le résumé.')).toBeVisible()
    worker.use(http.get(SUMMARY, () => HttpResponse.json(nurserySummary)))
    await screen.getByRole('button', { name: 'Réessayer' }).click()
    await expect.element(screen.getByText('12', { exact: true })).toBeVisible()
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument()
  })
})
