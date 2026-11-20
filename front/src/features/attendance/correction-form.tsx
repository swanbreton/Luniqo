import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import type { Schemas } from '@/api/types'
import { Field, SelectField, TextareaField } from '@/components/field'
import { FormError } from '@/components/form-error'
import { Button } from '@/components/ui/button'
import { formatLongDay } from '@/lib/dates'
import { type FieldMap, type ServerFieldErrors, useServerFieldErrors } from '@/lib/server-field-errors'

import {
  changesSomething,
  correctionBody,
  correctionDefaults,
  correctionSchema,
  type CorrectionValues,
  guardianName,
  KEEP,
  NOBODY,
  reasonSchema,
} from './correction'

type Presence = Schemas['AttendanceOut']
type ChildGuardian = Schemas['ChildGuardianOut']

// Champs de l'API (PresenceUpdate) → champs du formulaire.
const FIELDS: FieldMap<CorrectionValues> = {
  arrived_at: 'arrival',
  departed_at: 'departure',
  dropped_off_by: 'droppedOffBy',
  picked_up_by: 'pickedUpBy',
  reason: 'reason',
}
const REMOVE_FIELDS: FieldMap<{ reason: string }> = { reason: 'reason' }

type CorrectionFormProps = {
  presence: Presence
  /** Responsables de l'enfant ; `undefined` pendant leur chargement. */
  guardians: ChildGuardian[] | undefined
  onSubmit: (body: Schemas['PresenceUpdate']) => void
  /** Retirer la présence (pointée sur le mauvais enfant), avec le motif. */
  onRemove: (reason: string) => void
  pending?: boolean
  error?: string | null
  /** Erreurs par champ renvoyées par l'API (422), affichées sous chaque champ. */
  fieldErrors?: ServerFieldErrors | undefined
}

/**
 * Correction d'une présence par la direction : heures, personnes, motif.
 * Seul ce qui change part à l'API ; le retrait demande son propre motif et une confirmation.
 */
export function CorrectionForm({
  presence,
  guardians,
  onSubmit,
  onRemove,
  pending = false,
  error = null,
  fieldErrors,
}: CorrectionFormProps) {
  const [removing, setRemoving] = useState(false)
  const [unchanged, setUnchanged] = useState(false)
  const form = useForm<CorrectionValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: correctionDefaults(presence),
  })
  useServerFieldErrors(form, removing ? undefined : fieldErrors, FIELDS)
  const { errors } = form.formState

  if (removing) {
    return (
      <RemoveForm
        presence={presence}
        onRemove={onRemove}
        onBack={() => setRemoving(false)}
        pending={pending}
        error={error}
        fieldErrors={fieldErrors}
      />
    )
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          const body = correctionBody(presence, values)
          setUnchanged(!changesSomething(body))
          if (changesSomething(body)) onSubmit(body)
        })(event)
      }
    >
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{presence.child_name}</span> · {formatLongDay(presence.day)}.
        Heures de Paris.
      </p>
      <FormError message={unchanged ? 'La correction ne change rien.' : error} />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Arrivée" type="time" error={errors.arrival?.message} {...form.register('arrival')} />
        <Field
          label="Départ"
          hint="Laissez vide si l’enfant est encore là."
          type="time"
          error={errors.departure?.message}
          {...form.register('departure')}
        />
      </div>
      <SelectField
        label="Amené·e par"
        error={errors.droppedOffBy?.message}
        disabled={guardians === undefined}
        {...form.register('droppedOffBy')}
      >
        <option value={KEEP}>Inchangé ({presence.dropped_off_by ?? 'non précisé'})</option>
        <option value={NOBODY}>Non précisé</option>
        {guardians?.map((link) => (
          <option key={link.guardian.id} value={link.guardian.id}>
            {guardianName(link)}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Parti·e avec"
        hint="Choisissez une personne autorisée."
        error={errors.pickedUpBy?.message}
        disabled={guardians === undefined}
        {...form.register('pickedUpBy')}
      >
        <option value={KEEP}>Inchangé ({presence.picked_up_by ?? 'non précisé'})</option>
        <option value={NOBODY}>Non précisé</option>
        {guardians?.map((link) => (
          <option key={link.guardian.id} value={link.guardian.id} disabled={!link.is_authorized_pickup}>
            {guardianName(link)}
            {link.is_authorized_pickup ? '' : ' (non autorisé·e)'}
          </option>
        ))}
      </SelectField>
      <TextareaField label="Motif de la correction" error={errors.reason?.message} {...form.register('reason')} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer la correction'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 text-destructive"
          disabled={pending}
          onClick={() => setRemoving(true)}
        >
          Retirer cette présence…
        </Button>
      </div>
    </form>
  )
}

type RemoveFormProps = {
  presence: Presence
  onRemove: (reason: string) => void
  onBack: () => void
  pending: boolean
  error: string | null
  fieldErrors: ServerFieldErrors | undefined
}

const removeSchema = reasonSchema

/** Retrait d'une présence pointée par erreur : motif, puis confirmation explicite. */
function RemoveForm({ presence, onRemove, onBack, pending, error, fieldErrors }: RemoveFormProps) {
  const form = useForm<{ reason: string }>({ defaultValues: { reason: '' } })
  useServerFieldErrors(form, fieldErrors, REMOVE_FIELDS)
  const { errors } = form.formState

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          const parsed = removeSchema.safeParse(values.reason)
          if (!parsed.success) {
            form.setError('reason', { message: parsed.error.issues[0]?.message ?? 'Motif invalide.' })
            return
          }
          onRemove(parsed.data)
        })(event)
      }
    >
      <p>
        La présence de <strong>{presence.child_name}</strong> du {formatLongDay(presence.day)} disparaîtra du suivi, de
        l&apos;historique, de l&apos;export et de l&apos;espace des familles. Elle restera dans le journal des
        corrections.
      </p>
      <FormError message={error} />
      <TextareaField
        label="Motif du retrait"
        placeholder="Par exemple : pointée sur le mauvais enfant"
        error={errors.reason?.message}
        {...form.register('reason')}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="destructive" className="h-11" disabled={pending}>
          {pending ? 'Retrait…' : 'Retirer la présence'}
        </Button>
        <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={onBack}>
          Revenir à la correction
        </Button>
      </div>
    </form>
  )
}
