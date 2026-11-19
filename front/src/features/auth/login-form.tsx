import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Field } from '@/components/field'
import { ActionError } from '@/components/action-error'
import { Button } from '@/components/ui/button'
import { type FieldMap, type ServerFieldErrors, useServerFieldErrors } from '@/lib/server-field-errors'
import { useRetryCountdown } from '@/lib/use-retry-countdown'

// Confort de saisie seulement : l'API reste la référence (ADR-002 § 6).
const schema = z.object({
  email: z.string().trim().min(1, 'Saisissez votre adresse e-mail.').includes('@', {
    message: 'Adresse e-mail invalide.',
  }),
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
})

export type LoginValues = z.infer<typeof schema>

const FIELDS: FieldMap<LoginValues> = { email: 'email', password: 'password' }

type LoginFormProps = {
  onSubmit: (values: LoginValues) => void
  pending?: boolean
  /** Erreur de l'envoi (ApiError, coupure réseau…) : message, et compte à rebours d'une 429. */
  error?: unknown
  /** Erreurs par champ renvoyées par l'API (422), affichées sous chaque champ. */
  fieldErrors?: ServerFieldErrors | undefined
}

export function LoginForm({ onSubmit, pending = false, error = null, fieldErrors }: LoginFormProps) {
  const form = useForm<LoginValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  useServerFieldErrors(form, fieldErrors, FIELDS)
  const { errors } = form.formState
  const wait = useRetryCountdown(error)

  return (
    <form className="grid gap-4" noValidate onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}>
      <ActionError error={error} waitSeconds={wait} />
      <Field
        label="Adresse e-mail"
        type="email"
        autoComplete="username"
        error={errors.email?.message}
        {...form.register('email')}
      />
      <Field
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...form.register('password')}
      />
      <Button type="submit" size="lg" className="h-11" disabled={pending || wait > 0}>
        {pending ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  )
}
