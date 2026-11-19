import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { errorMessage } from '@/api/errors'

import { apiErrors, networkFailure, raised } from '../../../test/handlers/errors'
import { PinForm } from './pin-form'

const meta = {
  title: 'Compte/PIN de tablette',
  component: PinForm,
  args: { onSubmit: fn() },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof PinForm>

export default meta
type Story = StoryObj<typeof meta>

export const Vide: Story = {}

export const EnCours: Story = { args: { pending: true } }

export const PinPrevisible: Story = { args: { error: 'Ce PIN est trop prévisible (suite de chiffres).' } }

export const MotDePasseIncorrect: Story = { args: { error: 'Mot de passe incorrect' } }

/** Saisie vérifiée avant l'envoi : format, confirmation, mot de passe. */
export const SaisieInvalide: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Nouveau PIN (4 chiffres)'), '48')
    await userEvent.type(canvas.getByLabelText('Nouveau PIN, une seconde fois'), '4826')
    await userEvent.click(canvas.getByRole('button', { name: 'Enregistrer mon PIN' }))
    await expect(await canvas.findByText('Le PIN doit contenir exactement 4 chiffres.')).toBeVisible()
    await expect(canvas.getByText('Les deux PIN ne correspondent pas.')).toBeVisible()
    await expect(canvas.getByText('Saisissez votre mot de passe actuel.')).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const Envoi: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Nouveau PIN (4 chiffres)'), '4826')
    await userEvent.type(canvas.getByLabelText('Nouveau PIN, une seconde fois'), '4826')
    await userEvent.type(canvas.getByLabelText('Mot de passe actuel'), 'secret')
    await userEvent.click(canvas.getByRole('button', { name: 'Enregistrer mon PIN' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      { pin: '4826', confirmation: '4826', password: 'secret' },
      expect.anything(),
    )
  },
}

/** Saisie refusée par l'API (422) : message sous le champ, résumé en haut du formulaire. */
export const ErreursParChamp: Story = {
  args: { error: 'Certains champs sont invalides.', fieldErrors: { password: 'Au plus 128 caractères' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Certains champs sont invalides.')
    const field = canvas.getByLabelText('Mot de passe actuel')
    await expect(await canvas.findByText('Au plus 128 caractères')).toBeVisible()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription('Au plus 128 caractères')
  },
}

/** Exception imprévue côté serveur (500) : message générique, rien n'est rejoué tout seul. */
export const ErreurServeur: Story = {
  args: { error: raised(apiErrors.serverError()).message },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Une erreur est survenue de notre côté.')
  },
}

/** Coupure réseau : aucune réponse de l'API (la demande a pu partir ou non). */
export const HorsLigne: Story = {
  args: { error: errorMessage(networkFailure()) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Connexion au serveur impossible. Vérifiez le réseau.')
  },
}

/** Trop d'essais (429) : le délai de `Retry-After` est ajouté au message. */
export const TropDeTentatives: Story = {
  args: { error: raised(apiErrors.tooManyAttempts()).message },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Trop de tentatives, réessayez plus tard (dans 15 minutes)',
    )
  },
}
