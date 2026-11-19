import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { apiErrors, networkFailure, raised } from '../../../test/handlers/errors'
import { PinPad } from './pin-pad'

const meta = {
  title: 'Mode tablette/PIN',
  component: PinPad,
  args: { name: 'Lucas B.', onSubmit: fn(), onCancel: fn() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PinPad>

export default meta
type Story = StoryObj<typeof meta>

/** Pavé tactile : envoi dès le 4e chiffre, sans bouton à presser. */
export const Pave: Story = {
  play: async ({ args, canvas, userEvent }) => {
    for (const digit of ['4', '8', '2']) await userEvent.click(canvas.getByRole('button', { name: digit }))
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Effacer le dernier chiffre' }))
    await userEvent.click(canvas.getByRole('button', { name: '2' }))
    await userEvent.click(canvas.getByRole('button', { name: '6' }))
    await expect(args.onSubmit).toHaveBeenCalledWith('4826')
  },
}

/** Clavier physique : seuls les chiffres comptent. */
export const Clavier: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('PIN de Lucas B.'), '4a8-26')
    await expect(args.onSubmit).toHaveBeenCalledWith('4826')
  },
}

export const Retour: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Retour' }))
    await expect(args.onCancel).toHaveBeenCalled()
  },
}

export const EnCours: Story = { args: { pending: true } }

export const PinIncorrect: Story = { args: { error: raised(apiErrors.pinInvalid()) } }

/** Trop de PIN faux sur la tablette (429) : compte à rebours, pavé désactivé pendant l'attente. */
export const TropDErreurs: Story = {
  args: { error: raised(apiErrors.tabletThrottled()) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(/réessayez plus tard$/)
    await expect(canvas.getByRole('timer')).toHaveTextContent(/^Nouvel essai possible dans (10|9) min \d{2} s$/)
    await expect(canvas.getByRole('button', { name: '5' })).toBeDisabled()
    await expect(canvas.getByLabelText('PIN de Lucas B.')).toBeDisabled()
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
