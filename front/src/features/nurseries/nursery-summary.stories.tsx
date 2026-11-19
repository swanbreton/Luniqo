import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

import { ApiError } from '@/api/errors'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { NurserySummaryFigures } from './nursery-summary'

const meta = {
  title: 'Crèches/Résumé sur l’accueil',
  component: NurserySummaryFigures,
  args: { summary: undefined, pending: false, error: null },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Crèche Démo Nord</CardTitle>
          <CardDescription>Toulouse · 12 places</CardDescription>
        </CardHeader>
        <CardContent>
          <Story />
        </CardContent>
      </Card>
    ),
  ],
} satisfies Meta<typeof NurserySummaryFigures>

export default meta
type Story = StoryObj<typeof meta>

export const Chargement: Story = {
  args: { pending: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Chargement du résumé…')
  },
}

export const Valeurs: Story = {
  args: { summary: { children: 12, present: 8, staff: 4 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Enfants accueillis').nextElementSibling).toHaveTextContent('12')
    await expect(canvas.getByText('Présents en ce moment').nextElementSibling).toHaveTextContent('8')
    await expect(canvas.getByText('Personnel').nextElementSibling).toHaveTextContent('4')
  },
}

export const Zero: Story = {
  args: { summary: { children: 0, present: 0, staff: 0 } },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('0')).toHaveLength(3)
  },
}

export const Erreur: Story = {
  args: {
    error: new ApiError(503, 'Le service est momentanément indisponible. Réessayez dans un instant.'),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Impossible de charger le résumé.')
  },
}
