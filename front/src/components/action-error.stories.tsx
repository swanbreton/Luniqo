import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { apiErrors, networkFailure, raised, REQUEST_ID } from '../../test/handlers/errors'
import { ActionError } from './action-error'

/**
 * Erreur d'une action et ce qu'on peut faire (docs/projet/ERREURS.md § 4) : réessayer sur une
 * panne, attendre sur une 429, rien de plus sur un refus. Toujours à l'endroit de l'action.
 */
const meta = {
  title: 'Interface/Erreur d’une action',
  component: ActionError,
  args: { error: raised(apiErrors.serverError()), onRetry: fn() },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof ActionError>

export default meta
type Story = StoryObj<typeof meta>

/** 5xx : message, référence à donner au support, « Réessayer ». */
export const ErreurServeur: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(`Référence : ${REQUEST_ID}`)
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  },
}

/** Pas de réponse du serveur : « Réessayer ». */
export const HorsLigne: Story = {
  args: { error: networkFailure() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Connexion au serveur impossible. Vérifiez le réseau.')
    await expect(canvas.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  },
}

/** Refus (4xx) : réessayer ne changerait rien, pas de bouton. */
export const Refus: Story = {
  args: { error: raised(apiErrors.nurseryNotFound()) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Crèche introuvable')
    await expect(canvas.queryByRole('button', { name: 'Réessayer' })).toBeNull()
  },
}

/** 429 : compte à rebours hors de l'alerte (role="timer", pas relu à chaque seconde). */
export const TropDeTentatives: Story = {
  args: { error: raised(apiErrors.tooManyAttempts(30)), waitSeconds: 30 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(/^Trop de tentatives, réessayez plus tard$/)
    await expect(canvas.getByRole('timer')).toHaveTextContent('Nouvel essai possible dans 30 s')
    await expect(canvas.queryByRole('button', { name: 'Réessayer' })).toBeNull()
  },
}

/** Grand bouton pour la tablette (mains occupées). */
export const Tablette: Story = { args: { error: raised(apiErrors.unavailable()), large: true } }
