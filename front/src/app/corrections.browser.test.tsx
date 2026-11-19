import { createMemoryHistory } from '@tanstack/react-router'
import { http, HttpResponse } from 'msw'
import { describe, expect } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'

import type { Schemas } from '@/api/types'
import { addDays, parisInstant, todayInParis } from '@/lib/dates'

import {
  corrections,
  emmaDetail,
  employee,
  leoDetail,
  nursery,
  nurseryChildren,
  owner,
  periodAttendance,
} from '../../test/fixtures'
import { apiErrors, reply } from '../../test/handlers/errors'
import { test } from '../../test/msw'
import { App, createApp } from './app'

const director = { ...owner, mfa: 'verified' as const }
const BASE = `/api/v2/nurseries/${nursery.id}`
const HISTORY = `${BASE}/attendance/history`
const CORRECTIONS = `${BASE}/attendance/corrections`

// Jours relatifs à aujourd'hui (Paris) : le délai de 31 jours ne rend pas le test caduc avec le temps.
const today = todayInParis()
const yesterday = addDays(today, -1)
const PAGE = `/creches/${nursery.id}/presences/historique?du=${addDays(today, -40)}&au=${today}`

// Hier, Léo est arrivé à 08:50 et son départ n'a pas été pointé.
const forgotten: Schemas['AttendanceOut'] = {
  ...(periodAttendance[0] as Schemas['AttendanceOut']),
  day: yesterday,
  arrived_at: parisInstant(yesterday, '08:50'),
}
// Il y a 35 jours : trop ancien pour être corrigé.
const tooOld: Schemas['AttendanceOut'] = {
  ...forgotten,
  id: '00000000-0000-4000-8000-0000000000c9',
  day: addDays(today, -35),
  arrived_at: parisInstant(addDays(today, -35), '08:00'),
  departed_at: parisInstant(addDays(today, -35), '17:00'),
}

async function start(url = PAGE) {
  const app = createApp(createMemoryHistory({ initialEntries: [url] }))
  return { app, screen: await render(<App instance={app} />) }
}

function directorApi(presences: Schemas['AttendanceOut'][] = [tooOld, forgotten]) {
  const reads = { history: 0, corrections: 0 }
  return {
    reads,
    handlers: [
      http.get('/api/v2/auth/me', () => HttpResponse.json(director)),
      http.get(BASE, () => HttpResponse.json(nursery)),
      http.get(HISTORY, () => {
        reads.history += 1
        return HttpResponse.json(presences)
      }),
      http.get(CORRECTIONS, () => {
        reads.corrections += 1
        return HttpResponse.json(corrections)
      }),
      http.get(`${BASE}/children/${leoDetail.id}`, () => HttpResponse.json(leoDetail)),
      http.get(`${BASE}/children/${emmaDetail.id}`, () => HttpResponse.json(emmaDetail)),
      http.get(`${BASE}/children`, () => HttpResponse.json(nurseryChildren)),
    ],
  }
}

describe('corrections des pointages', () => {
  test('direction : départ oublié corrigé, seuls les champs changés partent, tout est relu', async ({ worker }) => {
    const api = directorApi()
    let sent: unknown = null
    worker.use(
      ...api.handlers,
      http.patch(`${BASE}/attendance/${forgotten.id}`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ ...forgotten, departed_at: parisInstant(yesterday, '17:30'), corrected: true })
      }),
    )
    const { screen } = await start()
    // Le journal de la période est affiché sous les tableaux.
    await expect.element(screen.getByText('Motif : Départ pointé en retard')).toBeVisible()
    await expect.element(screen.getByText('Départ : 17:20 → 17:05')).toBeVisible()
    // Présence de plus de 31 jours : plus de bouton.
    await expect.element(screen.getByRole('button', { name: /^Corriger la présence/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Corriger la présence/ }).elements()).toHaveLength(1)

    await screen.getByRole('button', { name: 'Corriger la présence de Léo Garnier, arrivée à 08:50' }).click()
    const dialog = screen.getByRole('dialog', { name: 'Corriger la présence' })
    await expect.element(dialog.getByLabelText('Parti·e avec')).toBeEnabled()
    await dialog.getByLabelText(/^Départ/).fill('17:30')
    await dialog.getByLabelText('Parti·e avec').selectOptions('Karim Garnier')
    await dialog.getByLabelText('Motif de la correction').fill('  Départ oublié sur la tablette ')
    const before = { ...api.reads }
    await dialog.getByRole('button', { name: 'Enregistrer la correction' }).click()

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument()
    expect(sent).toEqual({
      reason: 'Départ oublié sur la tablette',
      departed_at: parisInstant(yesterday, '17:30'),
      picked_up_by: leoDetail.guardians[1]?.guardian.id,
    })
    await expect.poll(() => api.reads.history).toBeGreaterThan(before.history)
    await expect.poll(() => api.reads.corrections).toBeGreaterThan(before.corrections)
  })

  test("correction refusée par l'API : message affiché, la fenêtre reste ouverte", async ({ worker }) => {
    worker.use(
      ...directorApi().handlers,
      http.patch(`${BASE}/attendance/${forgotten.id}`, () => reply(apiErrors.presenceOverlap())),
    )
    const { screen } = await start()
    await screen.getByRole('button', { name: 'Corriger la présence de Léo Garnier, arrivée à 08:50' }).click()
    const dialog = screen.getByRole('dialog', { name: 'Corriger la présence' })
    await dialog.getByLabelText('Arrivée').fill('07:30')
    await dialog.getByLabelText('Motif de la correction').fill('Arrivée pointée en retard')
    await dialog.getByRole('button', { name: 'Enregistrer la correction' }).click()

    await expect
      .element(dialog.getByText("Cette présence chevauche une autre présence de l'enfant ce jour-là"))
      .toBeVisible()
  })

  test('erreurs par champ de l’API : sous les champs du formulaire, noms de l’API traduits', async ({ worker }) => {
    worker.use(
      ...directorApi().handlers,
      http.patch(`${BASE}/attendance/${forgotten.id}`, () =>
        reply(apiErrors.validation({ arrived_at: 'Date et heure invalides', reason: 'Au plus 500 caractères' })),
      ),
    )
    const { screen } = await start()
    await screen.getByRole('button', { name: 'Corriger la présence de Léo Garnier, arrivée à 08:50' }).click()
    const dialog = screen.getByRole('dialog', { name: 'Corriger la présence' })
    await dialog.getByLabelText('Arrivée').fill('07:30')
    await dialog.getByLabelText('Motif de la correction').fill('Arrivée pointée en retard')
    await dialog.getByRole('button', { name: 'Enregistrer la correction' }).click()

    await expect.element(dialog.getByText('Certains champs sont invalides.')).toBeVisible()
    // arrived_at (API) → « Arrivée », reason → « Motif de la correction ».
    await expect.element(dialog.getByLabelText('Arrivée')).toHaveAccessibleDescription('Date et heure invalides')
    await expect
      .element(dialog.getByLabelText('Motif de la correction'))
      .toHaveAccessibleDescription(/Au plus 500 caractères/)
  })

  test("correction sans changement ou sans motif : refusée avant d'appeler l'API", async ({ worker }) => {
    // Aucune route PATCH prévue : un appel ferait échouer le test.
    worker.use(...directorApi().handlers)
    const { screen } = await start()
    await screen.getByRole('button', { name: 'Corriger la présence de Léo Garnier, arrivée à 08:50' }).click()
    const dialog = screen.getByRole('dialog', { name: 'Corriger la présence' })
    await dialog.getByRole('button', { name: 'Enregistrer la correction' }).click()
    await expect.element(dialog.getByText('Indiquez le motif de la correction (5 caractères au moins).')).toBeVisible()
    await dialog.getByLabelText('Motif de la correction').fill('Vérification sans changement')
    await dialog.getByRole('button', { name: 'Enregistrer la correction' }).click()
    await expect.element(dialog.getByText('La correction ne change rien.')).toBeVisible()
  })

  test('Échap ferme la fenêtre ; rouverte, elle repart de zéro et rend le focus au bouton', async ({ worker }) => {
    worker.use(...directorApi().handlers)
    const { screen } = await start()
    const open = screen.getByRole('button', { name: 'Corriger la présence de Léo Garnier, arrivée à 08:50' })
    await open.click()
    const dialog = screen.getByRole('dialog', { name: 'Corriger la présence' })
    await dialog.getByLabelText('Motif de la correction').fill('Texte abandonné')
    await userEvent.keyboard('{Escape}')

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument()
    await expect.element(open).toHaveFocus()
    await open.click()
    await expect.element(dialog.getByLabelText('Motif de la correction')).toHaveValue('')
  })

  test('retrait d’une présence pointée par erreur : motif puis confirmation', async ({ worker }) => {
    let sent: unknown = null
    worker.use(
      ...directorApi().handlers,
      http.post(`${BASE}/attendance/${forgotten.id}/cancel`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(corrections[1])
      }),
    )
    const { screen } = await start()
    await screen.getByRole('button', { name: 'Corriger la présence de Léo Garnier, arrivée à 08:50' }).click()
    const dialog = screen.getByRole('dialog', { name: 'Corriger la présence' })
    await dialog.getByRole('button', { name: 'Retirer cette présence…' }).click()
    await dialog.getByLabelText('Motif du retrait').fill('Pointée sur le mauvais enfant')
    await dialog.getByRole('button', { name: 'Retirer la présence' }).click()

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument()
    expect(sent).toEqual({ reason: 'Pointée sur le mauvais enfant' })
  })

  test('présence oubliée ajoutée : seules les personnes autorisées peuvent être choisies au départ', async ({
    worker,
  }) => {
    let sent: unknown = null
    worker.use(
      ...directorApi().handlers,
      http.post(`${BASE}/attendance`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ ...forgotten, corrected: true }, { status: 201 })
      }),
    )
    const { screen } = await start()
    await screen.getByRole('button', { name: 'Ajouter une présence oubliée' }).click()
    const dialog = screen.getByRole('dialog', { name: 'Ajouter une présence oubliée' })
    await expect.element(dialog.getByRole('option', { name: 'Emma Lambert' })).toBeInTheDocument()
    await dialog.getByLabelText('Enfant').selectOptions('Emma Lambert')
    await expect.element(dialog.getByRole('option', { name: 'Jeanne Lambert (non autorisé·e)' })).toBeDisabled()
    await dialog.getByLabelText('Jour').fill(yesterday)
    await dialog.getByLabelText('Arrivée').fill('08:15')
    await dialog.getByLabelText(/^Départ/).fill('16:00')
    await dialog.getByLabelText('Parti·e avec').selectOptions('Sophie Lambert')
    await dialog.getByLabelText("Motif de l'ajout").fill('Tablette en panne ce matin-là')
    await dialog.getByRole('button', { name: 'Ajouter la présence' }).click()

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument()
    expect(sent).toEqual({
      child_id: emmaDetail.id,
      arrived_at: parisInstant(yesterday, '08:15'),
      departed_at: parisInstant(yesterday, '16:00'),
      dropped_off_by: null,
      picked_up_by: emmaDetail.guardians[0]?.guardian.id,
      reason: 'Tablette en panne ce matin-là',
    })
  })

  test("employé : ni bouton de correction, ni journal (l'API les refuserait)", async ({ worker }) => {
    // Pas de route pour le journal : la page ne doit pas le demander.
    worker.use(
      http.get('/api/v2/auth/me', () => HttpResponse.json(employee)),
      http.get(BASE, () => HttpResponse.json(nursery)),
      http.get(HISTORY, () => HttpResponse.json([forgotten])),
    )
    const { screen } = await start()
    await expect.element(screen.getByText('Départ non pointé')).toBeVisible()
    expect(screen.getByRole('button', { name: /Corriger/ }).elements()).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Ajouter une présence oubliée' }).elements()).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Journal des corrections' }).elements()).toHaveLength(0)
  })
})
