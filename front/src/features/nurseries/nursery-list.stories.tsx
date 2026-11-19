import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

import { apiErrors, networkFailure, raised } from '../../../test/handlers/errors'
import { NurseryList } from './nursery-list'

const nursery = {
  id: '00000000-0000-4000-8000-0000000000c1',
  enterprise_id: '00000000-0000-4000-8000-0000000000e1',
  name: 'Crèche Démo Nord',
  address: null,
  postal_code: null,
  city: 'Toulouse',
  phone: null,
  email: null,
  capacity: 12,
  is_active: true,
}

const meta = {
  title: 'Crèches/Liste des crèches',
  component: NurseryList,
  args: { nurseries: undefined, pending: false, error: null },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof NurseryList>

export default meta
type Story = StoryObj<typeof meta>

export const Chargement: Story = { args: { pending: true } }

export const Vide: Story = { args: { nurseries: [] } }

export const Liste: Story = {
  args: {
    nurseries: [
      nursery,
      { ...nursery, id: '00000000-0000-4000-8000-0000000000c2', name: 'Micro-crèche Démo Sud', capacity: 10 },
    ],
  },
}

/** Direction : la route ajoute ses liens à chaque crèche. */
export const Direction: Story = {
  args: {
    ...Liste.args,
    actions: (item) => (
      <a href={`#${item.id}`} className="text-primary underline underline-offset-4">
        Tablettes
      </a>
    ),
  },
}

export const Erreur: Story = {
  args: { error: raised(apiErrors.unavailable()) },
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
