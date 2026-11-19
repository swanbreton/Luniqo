import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { apiErrors, networkFailure, raised } from '../../../test/handlers/errors'
import { CodeForm } from './code-form'

const meta = {
  title: 'Authentification/Code du second facteur',
  component: CodeForm,
  args: { onSubmit: fn() },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
} satisfies Meta<typeof CodeForm>

export default meta
type Story = StoryObj<typeof meta>

export const Vide: Story = {}

export const CodeInvalide: Story = { args: { error: raised(apiErrors.invalidCode()) } }

export const Activation: Story = { args: { label: "Code affiché par l'application", submitLabel: 'Activer' } }

export const Envoi: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Code à 6 chiffres ou code de secours'), '123456')
    await userEvent.click(canvas.getByRole('button', { name: 'Valider' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({ code: '123456' }, expect.anything())
  },
}

/** Saisie refusée par l'API (422) : message sous le champ, résumé en haut du formulaire. */
export const ErreursParChamp: Story = {
  args: {
    error: raised(apiErrors.validation({ code: 'Au plus 32 caractères' })),
    fieldErrors: { code: 'Au plus 32 caractères' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Certains champs sont invalides.')
    const field = canvas.getByLabelText('Code à 6 chiffres ou code de secours')
    await expect(await canvas.findByText('Au plus 32 caractères')).toBeVisible()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription('Au plus 32 caractères')
  },
}

/** Exception imprévue côté serveur (500) : message générique, rien n'est rejoué tout seul. */
export const ErreurServeur: Story = {
  args: { error: raised(apiErrors.serverError()) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Une erreur est survenue de notre côté.')
  },
}

/** Coupure réseau : aucune réponse de l'API (la demande a pu partir ou non). */
export const HorsLigne: Story = {
  args: { error: networkFailure() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Connexion au serveur impossible. Vérifiez le réseau.')
  },
}

/** Trop d'essais (429) : compte à rebours tiré de `Retry-After`, envoi désactivé pendant l'attente. */
export const TropDeTentatives: Story = {
  args: { error: raised(apiErrors.tooManyAttempts()) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(/^Trop de tentatives, réessayez plus tard$/)
    // Délai de Retry-After décompté en direct, bouton désactivé jusqu'au bout (ERREURS.md § 4).
    await expect(canvas.getByRole('timer')).toHaveTextContent(/^Nouvel essai possible dans 1[45] min \d{2} s$/)
    await expect(canvas.getByRole('button', { name: 'Valider' })).toBeDisabled()
  },
}
