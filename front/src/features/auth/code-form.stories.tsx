import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

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

export const CodeInvalide: Story = { args: { error: 'Code invalide' } }

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
  args: { error: 'Certains champs sont invalides.', fieldErrors: { code: 'Au plus 32 caractères' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Certains champs sont invalides.')
    const field = canvas.getByLabelText('Code à 6 chiffres ou code de secours')
    await expect(await canvas.findByText('Au plus 32 caractères')).toBeVisible()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription('Au plus 32 caractères')
  },
}
