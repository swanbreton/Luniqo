import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { tablet } from '../../../test/fixtures'
import { apiErrors, networkFailure, raised } from '../../../test/handlers/errors'
import { TabletList } from './tablet-list'

const now = new Date('2026-10-30T10:00:00Z')

const meta = {
  title: 'Tablettes/Liste des tablettes',
  component: TabletList,
  args: { tablets: undefined, pending: false, error: null, onRevoke: fn(), now },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TabletList>

export default meta
type Story = StoryObj<typeof meta>

export const Chargement: Story = { args: { pending: true } }

export const Vide: Story = { args: { tablets: [] } }

/** Une tablette de chaque état ; seule l'active peut être révoquée. */
export const Liste: Story = {
  args: {
    tablets: [
      tablet,
      {
        ...tablet,
        id: '00000000-0000-4000-8000-0000000000a2',
        label: 'Tablette de la salle de change',
        last_seen_at: null,
        revoked_at: '2026-10-20T08:00:00Z',
      },
      {
        ...tablet,
        id: '00000000-0000-4000-8000-0000000000a3',
        label: 'Ancienne tablette',
        created_at: '2026-07-01T08:00:00Z',
        expires_at: '2026-09-29T08:00:00Z',
      },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('button', { name: 'Révoquer' })).toHaveLength(1)
  },
}

/** Révocation en deux temps : rien n'est envoyé avant la confirmation. */
export const Revocation: Story = {
  args: { tablets: [tablet] },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Révoquer' }))
    await expect(args.onRevoke).not.toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Confirmer la révocation' }))
    await expect(args.onRevoke).toHaveBeenCalledWith(tablet.id)
  },
}

export const RevocationEnCours: Story = {
  args: { tablets: [tablet], revoking: tablet.id },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Révoquer' }))
    await expect(canvas.getByRole('button', { name: 'Révocation…' })).toBeDisabled()
  },
}

export const RevocationRefusee: Story = { args: { tablets: [tablet], revokeError: 'Tablette introuvable' } }

export const Erreur: Story = {
  args: { error: raised(apiErrors.managerRequired()) },
}

/** Exception imprévue côté serveur (500), après les nouveaux essais automatiques de la lecture. */
export const ErreurServeur: Story = {
  args: { ...Erreur.args, error: raised(apiErrors.serverError()) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Une erreur est survenue de notre côté.')
  },
}

/** Coupure réseau : aucune réponse de l'API. */
export const HorsLigne: Story = {
  args: { ...Erreur.args, error: networkFailure() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Connexion au serveur impossible. Vérifiez le réseau.')
  },
}
