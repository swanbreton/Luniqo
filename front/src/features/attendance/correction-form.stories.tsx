import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { errorMessage } from '@/api/errors'

import type { Schemas } from '@/api/types'

import { emmaDetail, leoDetail, periodAttendance } from '../../../test/fixtures'
import { apiErrors, networkFailure, raised } from '../../../test/handlers/errors'
import { CorrectionForm } from './correction-form'

// Le 28 octobre, Léo est arrivé à 08:50 (Paris) et son départ n'a pas été pointé.
const forgotten = periodAttendance[0] as Schemas['AttendanceOut']
// Le 29, Emma est arrivée à 09:15 et repartie à 16:30.
const emma = periodAttendance[2] as Schemas['AttendanceOut']

const meta = {
  title: 'Présences/Corriger une présence',
  component: CorrectionForm,
  args: { presence: forgotten, guardians: leoDetail.guardians, onSubmit: fn(), onRemove: fn() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CorrectionForm>

export default meta
type Story = StoryObj<typeof meta>

/** Départ oublié : l'heure de départ et la personne venue chercher l'enfant, avec le motif. */
export const DepartOublie: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByLabelText('Arrivée')).toHaveValue('08:50')
    await expect(canvas.getByLabelText(/^Départ/)).toHaveValue('')
    await userEvent.type(canvas.getByLabelText(/^Départ/), '1730')
    await userEvent.selectOptions(canvas.getByLabelText('Parti·e avec'), 'Karim Garnier')
    await userEvent.type(canvas.getByLabelText('Motif de la correction'), 'Départ oublié')
    await userEvent.click(canvas.getByRole('button', { name: 'Enregistrer la correction' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({
      reason: 'Départ oublié',
      departed_at: '2026-10-28T16:30:00.000Z',
      picked_up_by: '00000000-0000-4000-8000-0000000000f2',
    })
  },
}

/** Personne non autorisée : visible, mais impossible à choisir. */
export const PersonneNonAutorisee: Story = {
  args: { presence: emma, guardians: emmaDetail.guardians },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('option', { name: 'Jeanne Lambert (non autorisé·e)' })).toBeDisabled()
    // Sophie l'a amenée et l'a cherchée : « Inchangé » rappelle la personne de chaque liste.
    await expect(canvas.getAllByRole('option', { name: 'Inchangé (Sophie L.)' })).toHaveLength(2)
  },
}

/** Départ avant l'arrivée : refusé avant l'envoi. */
export const DepartAvantArrivee: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^Départ/), '0800')
    await userEvent.type(canvas.getByLabelText('Motif de la correction'), 'Heure de départ')
    await userEvent.click(canvas.getByRole('button', { name: 'Enregistrer la correction' }))
    await expect(canvas.getByText("Le départ précède l'arrivée.")).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Retrait : un motif, puis la confirmation. */
export const Retrait: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Retirer cette présence…' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Retirer la présence' }))
    await expect(canvas.getByText('Indiquez le motif de la correction (5 caractères au moins).')).toBeVisible()
    await userEvent.type(canvas.getByLabelText('Motif du retrait'), 'Pointée sur le mauvais enfant')
    await userEvent.click(canvas.getByRole('button', { name: 'Retirer la présence' }))
    await expect(args.onRemove).toHaveBeenCalledWith('Pointée sur le mauvais enfant')
  },
}

export const ChargementDesResponsables: Story = { args: { guardians: undefined } }

export const RefusParLApi: Story = {
  args: { error: 'Présence de plus de 31 jours : elle ne se corrige plus' },
}

/** Saisie refusée par l'API (422) : message sous le champ, résumé en haut du formulaire. */
export const ErreursParChamp: Story = {
  args: { error: 'Certains champs sont invalides.', fieldErrors: { departed_at: 'Date et heure invalides' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Certains champs sont invalides.')
    const field = canvas.getByLabelText("Départ (vide si l'enfant est encore là)")
    await expect(await canvas.findByText('Date et heure invalides')).toBeVisible()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription('Date et heure invalides')
  },
}

/** Exception imprévue côté serveur (500) : message générique, rien n'est rejoué tout seul. */
export const ErreurServeur: Story = {
  args: { error: errorMessage(raised(apiErrors.serverError())) },
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
