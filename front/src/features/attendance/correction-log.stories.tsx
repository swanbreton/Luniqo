import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

import { corrections } from '../../../test/fixtures'
import { apiErrors, networkFailure, raised } from '../../../test/handlers/errors'
import { CorrectionLog } from './correction-log'

const meta = {
  title: 'Présences/Journal des corrections',
  component: CorrectionLog,
  args: { entries: corrections, pending: false, error: null },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CorrectionLog>

export default meta
type Story = StoryObj<typeof meta>

/** Une heure corrigée, puis une présence retirée : qui, quand, pourquoi, ce qui a changé. */
export const Journal: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Présence corrigée · Léo Garnier · 29 octobre 2026')).toBeVisible()
    await expect(canvas.getByText('Départ : 17:20 → 17:05')).toBeVisible()
    await expect(canvas.getByText('Présence retirée · Emma Lambert · 29 octobre 2026')).toBeVisible()
    await expect(canvas.getByText('Motif : Pointée sur le mauvais enfant')).toBeVisible()
    await expect(canvas.getAllByText(/^Par Camille Martin, le 30 octobre 2026 à/)).toHaveLength(2)
  },
}

export const Chargement: Story = { args: { entries: undefined, pending: true } }

export const AucuneCorrection: Story = { args: { entries: [] } }

export const Erreur: Story = {
  args: { entries: undefined, error: raised(apiErrors.managerRequired()) },
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
