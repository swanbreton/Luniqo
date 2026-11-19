import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { errorMessage } from '@/api/errors'

import { apiErrors, networkFailure, raised } from '../../../test/handlers/errors'
import { EnrollForm } from './enroll-form'

const meta = {
  title: 'Tablettes/Enrôler cet appareil',
  component: EnrollForm,
  args: { onSubmit: fn() },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof EnrollForm>

export default meta
type Story = StoryObj<typeof meta>

export const Vide: Story = {}

export const EnCours: Story = { args: { pending: true } }

export const RefusParLApi: Story = { args: { error: 'Seule la direction peut gérer cette crèche' } }

/** Nom vide : message sous le champ, rien n'est envoyé. */
export const NomManquant: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Nom de la tablette'), '   ')
    await userEvent.click(canvas.getByRole('button', { name: 'Enrôler cet appareil' }))
    await expect(await canvas.findByText('Donnez un nom à la tablette.')).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const Envoi: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Nom de la tablette'), " Tablette de l'entrée ")
    await userEvent.click(canvas.getByRole('button', { name: 'Enrôler cet appareil' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({ label: "Tablette de l'entrée" }, expect.anything())
  },
}

/** Saisie refusée par l'API (422) : message sous le champ, résumé en haut du formulaire. */
export const ErreursParChamp: Story = {
  args: { error: 'Certains champs sont invalides.', fieldErrors: { label: 'Au plus 100 caractères' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Certains champs sont invalides.')
    const field = canvas.getByLabelText('Nom de la tablette')
    await expect(await canvas.findByText('Au plus 100 caractères')).toBeVisible()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription('Au plus 100 caractères')
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
