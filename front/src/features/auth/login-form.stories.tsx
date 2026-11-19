import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { errorMessage } from '@/api/errors'

import { apiErrors, networkFailure, raised, REQUEST_ID } from '../../../test/handlers/errors'
import { LoginForm } from './login-form'

const meta = {
  title: 'Authentification/Formulaire de connexion',
  component: LoginForm,
  args: { onSubmit: fn() },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const Vide: Story = {}

export const EnCours: Story = { args: { pending: true } }

export const RefusParLApi: Story = { args: { error: 'Identifiants invalides' } }

export const TropDeTentatives: Story = {
  args: { error: raised(apiErrors.tooManyAttempts()).message },
}

/** Champs vides : messages sous les champs, rien n'est envoyé. */
export const SaisieIncomplete: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Se connecter' }))
    await expect(await canvas.findByText('Saisissez votre adresse e-mail.')).toBeVisible()
    await expect(canvas.getByText('Saisissez votre mot de passe.')).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const Envoi: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Adresse e-mail'), ' employe@demo.test ')
    await userEvent.type(canvas.getByLabelText('Mot de passe'), 'secret')
    await userEvent.click(canvas.getByRole('button', { name: 'Se connecter' }))
    await expect(args.onSubmit).toHaveBeenCalledWith(
      { email: 'employe@demo.test', password: 'secret' },
      expect.anything(),
    )
  },
}

/** Saisie refusée par l'API (422) : message sous le champ, résumé en haut du formulaire. */
export const ErreursParChamp: Story = {
  args: { error: 'Certains champs sont invalides.', fieldErrors: { email: 'Adresse e-mail invalide' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Certains champs sont invalides.')
    const field = canvas.getByLabelText('Adresse e-mail')
    await expect(await canvas.findByText('Adresse e-mail invalide')).toBeVisible()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription('Adresse e-mail invalide')
  },
}

/** Exception imprévue côté serveur (500) : message générique, rien n'est rejoué tout seul. */
export const ErreurServeur: Story = {
  args: { error: errorMessage(raised(apiErrors.serverError())) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Une erreur est survenue de notre côté.')
    // Référence à transmettre au support, retrouvée dans les journaux (LUN-141).
    await expect(canvas.getByRole('alert')).toHaveTextContent(`Référence : ${REQUEST_ID}`)
  },
}

/** Coupure réseau : aucune réponse de l'API (la demande a pu partir ou non). */
export const HorsLigne: Story = {
  args: { error: errorMessage(networkFailure()) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Connexion au serveur impossible. Vérifiez le réseau.')
  },
}
