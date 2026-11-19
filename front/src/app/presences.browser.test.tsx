import { createMemoryHistory } from '@tanstack/react-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'

import { dayAttendance, employee, nursery, nurserySummary } from '../../test/fixtures'
import { apiErrors, networkError, reply } from '../../test/handlers/errors'
import { test } from '../../test/msw'
import { App, createApp } from './app'

async function start(url: string) {
  const app = createApp(createMemoryHistory({ initialEntries: [url] }))
  return { app, screen: await render(<App instance={app} />) }
}

describe('présences du jour', () => {
  test("employé : de l'accueil au tableau du jour de sa crèche", async ({ worker }) => {
    worker.use(
      http.get('/api/v2/auth/me', () => HttpResponse.json(employee)),
      http.get('/api/v2/nurseries', () => HttpResponse.json([nursery])),
      http.get(`/api/v2/nurseries/${nursery.id}/summary`, () => HttpResponse.json(nurserySummary)),
      http.get(`/api/v2/nurseries/${nursery.id}`, () => HttpResponse.json(nursery)),
      http.get(`/api/v2/nurseries/${nursery.id}/attendance`, () => HttpResponse.json(dayAttendance)),
    )
    const { screen } = await start('/accueil')
    // Pas de gestion des tablettes pour un employé, mais le suivi des présences.
    await expect.element(screen.getByRole('link', { name: 'Tablettes de Crèche Démo Nord' })).not.toBeInTheDocument()
    await screen.getByRole('link', { name: 'Présences de Crèche Démo Nord' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Présences du jour · Crèche Démo Nord' })).toBeVisible()
    await expect.element(screen.getByRole('row', { name: /Emma Lambert/ })).toBeVisible()
    await expect.element(screen.getByText(/^Mis à jour à \d{2}:\d{2}$/)).toBeVisible()
  })

  test("refus de l'API (crèche d'une autre entreprise) : message affiché", async ({ worker }) => {
    worker.use(
      http.get('/api/v2/auth/me', () => HttpResponse.json(employee)),
      http.get(`/api/v2/nurseries/${nursery.id}`, () => reply(apiErrors.nurseryNotFound())),
      http.get(`/api/v2/nurseries/${nursery.id}/attendance`, () => reply(apiErrors.nurseryNotFound())),
    )
    const { screen } = await start(`/creches/${nursery.id}/presences`)
    await expect.element(screen.getByRole('alert')).toBeVisible()
    await expect.element(screen.getByText('Crèche introuvable')).toBeVisible()
  })

  test.for([
    { cas: 'exception imprévue de l’API (500)', failure: apiErrors.serverError('reference-500-presences') },
    { cas: 'API arrêtée, réponse de la passerelle (503)', failure: apiErrors.unavailable('reference-503-passerelle') },
  ])('$cas : 2 nouveaux essais, puis message, référence et « Réessayer »', async ({ failure }, { worker }) => {
    let attempts = 0
    let down = true
    worker.use(
      http.get('/api/v2/auth/me', () => HttpResponse.json(employee)),
      http.get(`/api/v2/nurseries/${nursery.id}`, () => HttpResponse.json(nursery)),
      http.get(`/api/v2/nurseries/${nursery.id}/attendance`, () => {
        attempts += 1
        return down ? reply(failure) : HttpResponse.json(dayAttendance)
      }),
    )
    const { screen } = await start(`/creches/${nursery.id}/presences`)
    // Lecture rejouée deux fois sur une 5xx (après 1 s puis 2 s) avant d'afficher l'erreur.
    // getByText sur le texte complet : toHaveTextContent échoue sur un texte identique (front/README.md).
    const shown = `${failure.body.detail} Référence : ${failure.body.request_id ?? ''}`
    await expect.element(screen.getByText(shown), { timeout: 10_000 }).toBeVisible()
    expect(attempts).toBe(3)

    // L'API revient : « Réessayer » recharge la liste.
    down = false
    await screen.getByRole('button', { name: 'Réessayer' }).click()
    await expect.element(screen.getByRole('row', { name: /Emma Lambert/ })).toBeVisible()
    expect(attempts).toBe(4)
  })

  test('coupure réseau : bannière hors ligne, retirée dès que le serveur répond', async ({ worker }) => {
    let reachable = false
    worker.use(
      http.get('/api/v2/auth/me', () => HttpResponse.json(employee)),
      http.get(`/api/v2/nurseries/${nursery.id}`, () => HttpResponse.json(nursery)),
      http.get(`/api/v2/nurseries/${nursery.id}/attendance`, () =>
        reachable ? HttpResponse.json(dayAttendance) : networkError(),
      ),
    )
    const { screen } = await start(`/creches/${nursery.id}/presences`)
    const banner = screen.getByText('Hors ligne : connexion au serveur impossible. Vérifiez le réseau.')
    await expect.element(banner, { timeout: 10_000 }).toBeVisible()
    await expect
      .element(screen.getByText('Connexion au serveur impossible. Vérifiez le réseau.', { exact: true }))
      .toBeVisible()

    reachable = true
    await screen.getByRole('button', { name: 'Réessayer' }).click()
    await expect.element(screen.getByRole('row', { name: /Emma Lambert/ })).toBeVisible()
    await expect.element(banner).not.toBeInTheDocument()
  })

  test('le navigateur perd puis retrouve le réseau : bannière affichée puis retirée', async ({ worker }) => {
    worker.use(
      http.get('/api/v2/auth/me', () => HttpResponse.json(employee)),
      http.get(`/api/v2/nurseries/${nursery.id}`, () => HttpResponse.json(nursery)),
      http.get(`/api/v2/nurseries/${nursery.id}/attendance`, () => HttpResponse.json(dayAttendance)),
    )
    const { screen } = await start(`/creches/${nursery.id}/presences`)
    await expect.element(screen.getByRole('row', { name: /Emma Lambert/ })).toBeVisible()
    const banner = screen.getByText('Hors ligne : connexion au serveur impossible. Vérifiez le réseau.')

    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    try {
      window.dispatchEvent(new Event('offline'))
      await expect.element(banner).toBeVisible()
      onLine.mockReturnValue(true)
      window.dispatchEvent(new Event('online'))
      await expect.element(banner).not.toBeInTheDocument()
    } finally {
      onLine.mockRestore()
    }
  })

  test('refus (4xx) : pas de référence affichée, même si l’API en envoie une', async ({ worker }) => {
    worker.use(
      http.get('/api/v2/auth/me', () => HttpResponse.json(employee)),
      http.get(`/api/v2/nurseries/${nursery.id}`, () =>
        HttpResponse.json(apiErrors.nurseryNotFound().body, { status: 404, headers: { 'X-Request-ID': 'ref-404' } }),
      ),
      http.get(`/api/v2/nurseries/${nursery.id}/attendance`, () =>
        HttpResponse.json(apiErrors.nurseryNotFound().body, { status: 404, headers: { 'X-Request-ID': 'ref-404' } }),
      ),
    )
    const { screen } = await start(`/creches/${nursery.id}/presences`)
    // Texte complet du message : aucune référence ajoutée à un refus.
    await expect.element(screen.getByText('Crèche introuvable', { exact: true })).toBeVisible()
  })

  test("famille : l'adresse directe renvoie à l'accueil", async ({ worker }) => {
    worker.use(http.get('/api/v2/auth/me', () => HttpResponse.json({ ...employee, role: 'guardian' })))
    const { app, screen } = await start(`/creches/${nursery.id}/presences`)
    await expect.element(screen.getByText('Votre espace arrive bientôt.')).toBeVisible()
    expect(app.router.state.location.pathname).toBe('/accueil')
  })
})
