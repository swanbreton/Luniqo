import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import type { Schemas } from '@/api/types'
import { Field, SelectField, TextareaField } from '@/components/field'
import { FormError } from '@/components/form-error'
import { Button } from '@/components/ui/button'
import { type FieldMap, type ServerFieldErrors, useServerFieldErrors } from '@/lib/server-field-errors'

import { additionBody, additionSchema, type AdditionValues, correctableDays, guardianName, NOBODY } from './correction'

// Champs de l'API (PresenceCreate) → champs du formulaire. Le jour se déduit des heures.
const FIELDS: FieldMap<AdditionValues> = {
  child_id: 'childId',
  arrived_at: 'arrival',
  departed_at: 'departure',
  dropped_off_by: 'droppedOffBy',
  picked_up_by: 'pickedUpBy',
  reason: 'reason',
}

type AdditionFormProps = {
  /** Enfants de la crèche. */
  childList: Schemas['ChildOut'][] | undefined
  /** Responsables de l'enfant choisi ; `undefined` tant qu'aucun n'est choisi ou pendant le chargement. */
  guardians: Schemas['ChildGuardianOut'][] | undefined
  onChildChange: (childId: string) => void
  /** Jour qu'il est à Paris : la date se choisit sur les 31 derniers jours, comme l'API l'accepte. */
  today: string
  /** Jour proposé : la fin de la période affichée. */
  defaultDay: string
  onSubmit: (body: Schemas['PresenceCreate']) => void
  pending?: boolean
  error?: string | null
  /** Erreurs par champ renvoyées par l'API (422), affichées sous chaque champ. */
  fieldErrors?: ServerFieldErrors | undefined
}

/** Présence oubliée (arrivée jamais pointée), ajoutée après coup par la direction, avec un motif. */
export function AdditionForm({
  childList,
  guardians,
  onChildChange,
  today,
  defaultDay,
  onSubmit,
  pending = false,
  error = null,
  fieldErrors,
}: AdditionFormProps) {
  const days = correctableDays(today)
  const form = useForm<AdditionValues>({
    resolver: zodResolver(additionSchema),
    defaultValues: {
      childId: '',
      day: defaultDay < days.min || defaultDay > days.max ? today : defaultDay,
      arrival: '',
      departure: '',
      droppedOffBy: NOBODY,
      pickedUpBy: NOBODY,
      reason: '',
    },
  })
  useServerFieldErrors(form, fieldErrors, FIELDS)
  const { errors } = form.formState
  const child = form.register('childId')

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => void form.handleSubmit((values) => onSubmit(additionBody(values)))(event)}
    >
      <FormError message={error} />
      <SelectField
        label="Enfant"
        error={errors.childId?.message}
        disabled={childList === undefined}
        {...child}
        onChange={(event) => {
          void child.onChange(event)
          form.setValue('droppedOffBy', NOBODY)
          form.setValue('pickedUpBy', NOBODY)
          onChildChange(event.target.value)
        }}
      >
        <option value="">{childList === undefined ? 'Chargement…' : 'Choisir un enfant'}</option>
        {childList?.map((item) => (
          <option key={item.id} value={item.id}>
            {item.first_name} {item.last_name}
          </option>
        ))}
      </SelectField>
      <Field
        label="Jour"
        type="date"
        min={days.min}
        max={days.max}
        required
        error={errors.day?.message}
        {...form.register('day')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Arrivée" type="time" error={errors.arrival?.message} {...form.register('arrival')} />
        <Field
          label="Départ (vide si l'enfant est encore là)"
          type="time"
          error={errors.departure?.message}
          {...form.register('departure')}
        />
      </div>
      <SelectField
        label="Amené·e par"
        disabled={guardians === undefined}
        error={errors.droppedOffBy?.message}
        {...form.register('droppedOffBy')}
      >
        <option value={NOBODY}>Non précisé</option>
        {guardians?.map((link) => (
          <option key={link.guardian.id} value={link.guardian.id}>
            {guardianName(link)}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Parti·e avec"
        hint="Seules les personnes autorisées à venir chercher l'enfant peuvent être choisies."
        disabled={guardians === undefined}
        error={errors.pickedUpBy?.message}
        {...form.register('pickedUpBy')}
      >
        <option value={NOBODY}>Non précisé</option>
        {guardians?.map((link) => (
          <option key={link.guardian.id} value={link.guardian.id} disabled={!link.is_authorized_pickup}>
            {guardianName(link)}
            {link.is_authorized_pickup ? '' : ' (non autorisé·e)'}
          </option>
        ))}
      </SelectField>
      <TextareaField
        label="Motif de l'ajout"
        hint="Gardé dans le journal des corrections, avec votre nom et l'heure."
        error={errors.reason?.message}
        {...form.register('reason')}
      />
      <Button type="submit" className="h-11 justify-self-start" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Ajouter la présence'}
      </Button>
    </form>
  )
}
