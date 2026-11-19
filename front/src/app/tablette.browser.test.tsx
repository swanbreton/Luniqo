import { createMemoryHistory } from '@tanstack/react-router'
import { http, HttpResponse } from 'msw'
import { describe, expect } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import { errorMessage } from '@/api/errors'
import type { Schemas } from '@/api/types'

import { employee, tabletActor, tabletChildren, tabletInfo } from '../../test/fixtures'
import { apiErrors, networkError, raised, reply } from '../../test/handlers/errors'
import { test } from '../../test/msw'
import { App, createApp } from './app'

async function start() {
  const app = createApp(createMemoryHistory({ initialEntries: ['/tablette'] }))
  return { app, screen: await render(<App instance={app} />) }
}

const childrenOfDay = http.get('/api/v2/tablet/children', () => HttpResponse.json(tabletChildren))

const noActionSession = http.get('/api/v2/tablet/session', () => reply(apiErrors.pinSessionRequired()))

describe('mode tablette', () => {
  test("tablette non enrôlée : explication, et pas de renvoi vers l'écran de connexion", async ({ worker }) => {
    worker.use(
      http.get('/api/v2/tablet', () => reply(apiErrors.tabletRequired())),
      noActionSession,
    )
    const { app, screen } = await start()
    await expect.element(screen.getByRole('heading', { name: 'Tablette non enrôlée' })).toBeVisible()
    expect(app.router.state.location.pathname).toBe('/tablette')
  })

  test('PIN refusé puis accepté, puis fin de session', async ({ worker }) => {
    let actor: Schemas['TabletActorOut'] | null = null
    const sent: unknown[] = []
    worker.use(
      http.get('/api/v2/tablet', () => HttpResponse.json(tabletInfo)),
      http.get('/api/v2/tablet/session', () =>
        actor === null ? reply(apiErrors.pinSessionRequired()) : HttpResponse.json(actor),
      ),
      http.post('/api/v2/tablet/session', async ({ request }) => {
        const body = (await request.json()) as { pin: string }
        sent.push(body)
        if (body.pin !== '4826') return reply(apiErrors.pinInvalid())
        actor = { ...tabletActor, expires_at: new Date(Date.now() + 120_000).toISOString() }
        return HttpResponse.json(actor, { status: 201 })
      }),
      childrenOfDay,
      http.delete('/api/v2/tablet/session', () => {
        actor = null
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { app, screen } = await start()
    await expect.element(screen.getByRole('heading', { name: /Crèche Démo Nord/ })).toBeVisible()
    await screen.getByRole('button', { name: 'Lucas B.' }).click()

    await screen.getByLabelText('PIN de Lucas B.').fill('1111')
    await expect.element(screen.getByRole('alert')).toHaveTextContent('PIN incorrect')
    // Saisie refusée effacée, et la 401 du PIN ne renvoie pas vers la connexion.
    await expect.element(screen.getByLabelText('PIN de Lucas B.')).toHaveValue('')
    expect(app.router.state.location.pathname).toBe('/tablette')

    await screen.getByLabelText('PIN de Lucas B.').fill('4826')
    await expect.element(screen.getByRole('heading', { name: 'Bonjour Lucas B.' })).toBeVisible()
    expect(sent).toEqual([
      { user_id: employee.id, pin: '1111' },
      { user_id: employee.id, pin: '4826' },
    ])

    await screen.getByRole('button', { name: 'Terminer' }).click()
    await expect.element(screen.getByRole('heading', { name: 'Qui êtes-vous ?' })).toBeVisible()
  })

  test("PIN bloqué : retour à la liste avec le message de l'API, liste relue", async ({ worker }) => {
    let info = tabletInfo
    worker.use(
      http.get('/api/v2/tablet', () => HttpResponse.json(info)),
      noActionSession,
      http.post('/api/v2/tablet/session', () => {
        info = {
          ...tabletInfo,
          staff: tabletInfo.staff.map((member) =>
            member.id === employee.id ? { ...member, pin_locked: true } : member,
          ),
        }
        return reply(apiErrors.pinLocked())
      }),
    )
    const { screen } = await start()
    await screen.getByRole('button', { name: 'Lucas B.' }).click()
    await screen.getByLabelText('PIN de Lucas B.').fill('9999')

    await expect
      .element(screen.getByText('PIN bloqué après 3 erreurs : demandez à la direction de le débloquer'))
      .toBeVisible()
    await expect.element(screen.getByRole('button', { name: /Lucas B\./ })).toBeDisabled()
  })

  test("fin des 2 minutes : retour à la liste sans geste de l'employé", async ({ worker }) => {
    let actor: Schemas['TabletActorOut'] | null = {
      ...tabletActor,
      expires_at: new Date(Date.now() + 1_000).toISOString(),
    }
    worker.use(
      http.get('/api/v2/tablet', () => HttpResponse.json(tabletInfo)),
      http.get('/api/v2/tablet/session', () => {
        if (actor !== null && new Date(actor.expires_at).getTime() <= Date.now()) actor = null
        return actor === null ? reply(apiErrors.pinSessionRequired()) : HttpResponse.json(actor)
      }),
      childrenOfDay,
    )
    const { screen } = await start()
    // Session déjà ouverte au chargement : l'employé identifié est affiché.
    await expect.element(screen.getByRole('heading', { name: 'Bonjour Lucas B.' })).toBeVisible()
    await expect.element(screen.getByRole('heading', { name: 'Qui êtes-vous ?' })).toBeVisible()
  })

  describe('pointage', () => {
    const session = http.get('/api/v2/tablet/session', () =>
      HttpResponse.json({ ...tabletActor, expires_at: new Date(Date.now() + 120_000).toISOString() }),
    )
    const [leo, emma] = tabletChildren as [Schemas['TabletChild'], Schemas['TabletChild']]

    test("arrivée sans préciser qui amène l'enfant, puis liste relue", async ({ worker }) => {
      let children = tabletChildren
      let sent: unknown = null
      worker.use(
        http.get('/api/v2/tablet', () => HttpResponse.json(tabletInfo)),
        session,
        http.get('/api/v2/tablet/children', () => HttpResponse.json(children)),
        http.post(`/api/v2/tablet/children/${leo.id}/arrival`, async ({ request }) => {
          sent = await request.json()
          children = children.map((child) =>
            child.id === leo.id ? { ...child, presence: 'present', arrived_at: '2026-10-30T07:58:00Z' } : child,
          )
          return HttpResponse.json(
            {
              id: '00000000-0000-4000-8000-0000000000b1',
              child_id: leo.id,
              child_name: 'Léo Garnier',
              day: '2026-10-30',
              arrived_at: '2026-10-30T07:58:00Z',
              arrival_by: 'Lucas B.',
              dropped_off_by: null,
              departed_at: null,
              departure_by: null,
              picked_up_by: null,
            },
            { status: 201 },
          )
        }),
      )
      const { screen } = await start()
      await screen.getByRole('button', { name: /Léo Garnier/ }).click()
      await expect.element(screen.getByRole('heading', { name: 'Arrivée de Léo Garnier' })).toBeVisible()
      await screen.getByRole('button', { name: "Pointer l'arrivée" }).click()

      await expect.element(screen.getByText('Arrivée de Léo Garnier pointée à 08:58.')).toBeVisible()
      expect(sent).toEqual({ dropped_off_by: null })
      await expect
        .element(screen.getByRole('button', { name: /Léo Garnier/ }).getByText('Arrivé·e à 08:58'))
        .toBeVisible()
      await expect.element(screen.getByRole('heading', { name: 'Présents (2)' })).toBeVisible()
    })

    test("départ : la personne autorisée part avec l'enfant ; un refus de l'API reste affiché", async ({ worker }) => {
      const sent: unknown[] = []
      worker.use(
        http.get('/api/v2/tablet', () => HttpResponse.json(tabletInfo)),
        session,
        childrenOfDay,
        http.post(`/api/v2/tablet/children/${emma.id}/departure`, async ({ request }) => {
          sent.push(await request.json())
          return reply(apiErrors.pickupNotAuthorized())
        }),
      )
      const { app, screen } = await start()
      await screen.getByRole('button', { name: /Emma Lambert/ }).click()
      await screen.getByRole('radio', { name: /Sophie L\./ }).click()
      await screen.getByRole('button', { name: 'Pointer le départ' }).click()

      await expect
        .element(
          screen.getByText("Cette personne n'est pas autorisée à venir chercher l'enfant : prévenir la direction"),
        )
        .toBeVisible()
      expect(sent).toEqual([{ picked_up_by: '00000000-0000-4000-8000-0000000000f3' }])
      // Un 403 du pointage ne renvoie ni vers la connexion ni vers le second facteur.
      expect(app.router.state.location.pathname).toBe('/tablette')
    })

    test.for([
      {
        cas: 'API arrêtée, réponse de la passerelle (503)',
        failure: () => reply(apiErrors.unavailable()),
        message: errorMessage(raised(apiErrors.unavailable())),
      },
      {
        cas: 'erreur serveur',
        failure: () => reply(apiErrors.serverError()),
        // Message de l'API suivi de la référence à transmettre au support (LUN-141).
        message: errorMessage(raised(apiErrors.serverError())),
      },
      {
        cas: 'coupure réseau',
        failure: networkError,
        message: 'Connexion au serveur impossible. Vérifiez le réseau.',
      },
    ])(
      '$cas pendant un pointage, en 800 × 600 : jamais rejoué tout seul, « Réessayer » à portée de main',
      async ({ failure, message }, { worker }) => {
        let attempts = 0
        worker.use(
          http.get('/api/v2/tablet', () => HttpResponse.json(tabletInfo)),
          session,
          childrenOfDay,
          http.post(`/api/v2/tablet/children/${leo.id}/arrival`, () => {
            attempts += 1
            return failure()
          }),
        )
        // Tablette de la crèche : petit écran, mains occupées.
        await page.viewport(800, 600)
        const { screen } = await start()
        await screen.getByRole('button', { name: /Léo Garnier/ }).click()
        await screen.getByRole('button', { name: "Pointer l'arrivée" }).click()

        await expect.element(screen.getByText(message)).toBeVisible()
        // Une écriture n'est jamais rejouée sans l'employée : elle pourrait être enregistrée deux fois.
        await new Promise((resolve) => setTimeout(resolve, 1_500))
        expect(attempts).toBe(1)
        // Le formulaire reste ouvert et propose « Réessayer », visible sans défiler.
        await expect.element(screen.getByRole('button', { name: "Pointer l'arrivée" })).toBeEnabled()
        const retry = screen.getByRole('button', { name: 'Réessayer' })
        await expect.element(retry).toBeInViewport()
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
        // À la demande de l'employée : le même choix est renvoyé, une fois.
        await retry.click()
        await expect.poll(() => attempts).toBe(2)
      },
    )

    test("session expirée pendant le pointage : retour au choix de l'employé, avec la raison", async ({ worker }) => {
      worker.use(
        http.get('/api/v2/tablet', () => HttpResponse.json(tabletInfo)),
        session,
        childrenOfDay,
        http.post(`/api/v2/tablet/children/${leo.id}/arrival`, () => reply(apiErrors.pinSessionRequired())),
      )
      const { screen } = await start()
      await screen.getByRole('button', { name: /Léo Garnier/ }).click()
      await screen.getByRole('button', { name: "Pointer l'arrivée" }).click()

      await expect.element(screen.getByRole('heading', { name: 'Qui êtes-vous ?' })).toBeVisible()
      await expect.element(screen.getByText('Session terminée : saisissez à nouveau votre PIN.')).toBeVisible()
    })
  })
})
