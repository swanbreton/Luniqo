import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import { emmaDetail, nurseryChildren } from '../../../test/fixtures'
import { AdditionForm } from './addition-form'

const meta = {
  title: 'Présences/Ajouter une présence oubliée',
  component: AdditionForm,
  args: {
    childList: nurseryChildren,
    guardians: undefined,
    onChildChange: fn(),
    today: '2026-10-30',
    defaultDay: '2026-10-30',
    onSubmit: fn(),
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AdditionForm>

export default meta
type Story = StoryObj<typeof meta>

/** Choix de l'enfant : la page charge alors ses responsables. */
export const ChoixDeLEnfant: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByLabelText('Jour')).toHaveAttribute('min', '2026-09-29')
    await expect(canvas.getByLabelText('Parti·e avec')).toBeDisabled()
    await userEvent.selectOptions(canvas.getByLabelText('Enfant'), 'Emma Lambert')
    await expect(args.onChildChange).toHaveBeenCalledWith(emmaDetail.id)
  },
}

/** Présence complète, à l'heure de Paris. */
export const Ajout: Story = {
  args: { guardians: emmaDetail.guardians },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByLabelText('Enfant'), 'Emma Lambert')
    await userEvent.clear(canvas.getByLabelText('Jour'))
    await userEvent.type(canvas.getByLabelText('Jour'), '2026-10-29')
    await userEvent.type(canvas.getByLabelText('Arrivée'), '0815')
    await userEvent.type(canvas.getByLabelText(/^Départ/), '1600')
    await expect(canvas.getByRole('option', { name: 'Jeanne Lambert (non autorisé·e)' })).toBeDisabled()
    await userEvent.selectOptions(canvas.getByLabelText('Parti·e avec'), 'Sophie Lambert')
    await userEvent.type(canvas.getByLabelText("Motif de l'ajout"), 'Tablette en panne')
    await userEvent.click(canvas.getByRole('button', { name: 'Ajouter la présence' }))
    await expect(args.onSubmit).toHaveBeenCalledWith({
      child_id: emmaDetail.id,
      arrived_at: '2026-10-29T07:15:00.000Z',
      departed_at: '2026-10-29T15:00:00.000Z',
      dropped_off_by: null,
      picked_up_by: emmaDetail.guardians[0]?.guardian.id,
      reason: 'Tablette en panne',
    })
  },
}

/** Rien de saisi : l'enfant, l'arrivée et le motif sont demandés. */
export const ChampsManquants: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Ajouter la présence' }))
    await expect(canvas.getByText("Choisissez l'enfant.")).toBeVisible()
    await expect(canvas.getByText("Indiquez l'heure d'arrivée.")).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

export const RefusParLApi: Story = {
  args: { error: "Cette présence chevauche une autre présence de l'enfant ce jour-là" },
}

/** Saisie refusée par l'API (422) : message sous le champ, résumé en haut du formulaire. */
export const ErreursParChamp: Story = {
  args: { error: 'Certains champs sont invalides.', fieldErrors: { child_id: 'Identifiant invalide' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Certains champs sont invalides.')
    const field = canvas.getByLabelText('Enfant')
    await expect(await canvas.findByText(/Identifiant invalide/)).toBeVisible()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(/Identifiant invalide/)
  },
}
