import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { tabletChildren } from '../../../test/fixtures'
import { apiErrors, networkFailure, raised, REQUEST_ID } from '../../../test/handlers/errors'
import { PresenceForm } from './presence-form'

const [absent, present] = tabletChildren as [(typeof tabletChildren)[number], (typeof tabletChildren)[number]]

const meta = {
  title: 'Mode tablette/Pointer un enfant',
  component: PresenceForm,
  args: { child: absent, onSubmit: fn(), onCancel: fn() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PresenceForm>

export default meta
type Story = StoryObj<typeof meta>

/** Arrivée : la personne qui amène l'enfant est facultative. */
export const Arrivee: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole('radio', { name: 'Ne pas préciser' })).toBeChecked()
    await userEvent.click(canvas.getByRole('button', { name: "Pointer l'arrivée" }))
    await expect(args.onSubmit).toHaveBeenLastCalledWith(null)
    await userEvent.click(canvas.getByRole('radio', { name: /Karim G\./ }))
    await userEvent.click(canvas.getByRole('button', { name: "Pointer l'arrivée" }))
    await expect(args.onSubmit).toHaveBeenLastCalledWith('00000000-0000-4000-8000-0000000000f2')
  },
}

/** Départ : choix obligatoire, parmi les personnes autorisées seulement. */
export const Depart: Story = {
  args: { child: present },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole('button', { name: 'Pointer le départ' })).toBeDisabled()
    await expect(canvas.getByRole('radio', { name: /Jeanne L\./ })).toBeDisabled()
    await expect(canvas.getByText('Non autorisé·e : prévenir la direction')).toBeVisible()
    await userEvent.click(canvas.getByRole('radio', { name: /Sophie L\./ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Pointer le départ' }))
    await expect(args.onSubmit).toHaveBeenCalledWith('00000000-0000-4000-8000-0000000000f3')
  },
}

export const EnCours: Story = { args: { pending: true } }

/** Refus (403) : réessayer ne changerait rien, pas de bouton « Réessayer ». */
export const RefusParLApi: Story = {
  args: {
    child: present,
    error: raised(apiErrors.pickupNotAuthorized()),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Réessayer' })).toBeNull()
  },
}

export const DepartSansResponsable: Story = { args: { child: { ...present, guardians: [] } } }

/**
 * API arrêtée (503 de la passerelle) : message et référence, rien n'est rejoué tout seul ;
 * « Réessayer » renvoie le même choix, à la demande de l'employée.
 */
export const ErreurServeur: Story = {
  args: { error: raised(apiErrors.unavailable()) },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Le service est momentanément indisponible.')
    await expect(canvas.getByRole('alert')).toHaveTextContent(`Référence : ${REQUEST_ID}`)
    await userEvent.click(canvas.getByRole('radio', { name: /Karim G\./ }))
    await userEvent.click(canvas.getByRole('button', { name: 'Réessayer' }))
    await expect(args.onSubmit).toHaveBeenCalledOnce()
    await expect(args.onSubmit).toHaveBeenCalledWith('00000000-0000-4000-8000-0000000000f2')
  },
}

/** Coupure réseau : aucune réponse de l'API (la demande a pu partir ou non). */
export const HorsLigne: Story = {
  args: { error: networkFailure() },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Connexion au serveur impossible. Vérifiez le réseau.')
    await expect(canvas.getByRole('button', { name: 'Réessayer' })).toBeEnabled()
  },
}
