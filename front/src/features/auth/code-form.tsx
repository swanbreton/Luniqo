import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Field } from '@/components/field'
import { ActionError } from '@/components/action-error'
import { Button } from '@/components/ui/button'
import { type FieldMap, type ServerFieldErrors, useServerFieldErrors } from '@/lib/server-field-errors'
import { useRetryCountdown } from '@/lib/use-retry-countdown'

const schema = z.object({
  code: z.string().trim().min(1, 'Saisissez le code.').max(32, 'Code trop long.'),
})

export type CodeValues = z.infer<typeof schema>

const FIELDS: FieldMap<CodeValues> = { code: 'code' }

type CodeFormProps = {
  onSubmit: (values: CodeValues) => void
  label?: string
  submitLabel?: string
  pending?: boolean
  /** Erreur de l'envoi (ApiError, coupure réseau…) : message, et compte à rebours d'une 429. */
  error?: unknown
  /** Erreurs par champ renvoyées par l'API (422), affichées sous chaque champ. */
  fieldErrors?: ServerFieldErrors | undefined
}

/** Code de l'application d'authentification (6 chiffres) ou code de secours. */
export function CodeForm({
  onSubmit,
  label = 'Code à 6 chiffres ou code de secours',
  submitLabel = 'Valider',
  pending = false,
  error = null,
  fieldErrors,
}: CodeFormProps) {
  const form = useForm<CodeValues>({ resolver: zodResolver(schema), defaultValues: { code: '' } })
  useServerFieldErrors(form, fieldErrors, FIELDS)
  const wait = useRetryCountdown(error)

  return (
    <form className="grid gap-4" noValidate onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}>
      <ActionError error={error} waitSeconds={wait} />
      <Field
        label={label}
        autoComplete="one-time-code"
        spellCheck={false}
        error={form.formState.errors.code?.message}
        {...form.register('code')}
      />
      <Button type="submit" size="lg" className="h-11" disabled={pending || wait > 0}>
        {pending ? 'Vérification…' : submitLabel}
      </Button>
    </form>
  )
}
