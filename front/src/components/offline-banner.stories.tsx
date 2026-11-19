import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

import { OfflineBanner } from './offline-banner'

/** Bannière en haut de toutes les pages tant que l'application est hors ligne. */
const meta = {
  title: 'Interface/Bannière hors ligne',
  component: OfflineBanner,
  args: { offline: true },
} satisfies Meta<typeof OfflineBanner>

export default meta
type Story = StoryObj<typeof meta>

/** Réseau perdu ou serveur injoignable : message annoncé (role="status"). */
export const HorsLigne: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Hors ligne : connexion au serveur impossible. Vérifiez le réseau.',
    )
  },
}

/** En ligne : rien n'est affiché. */
export const EnLigne: Story = {
  args: { offline: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement()
  },
}
