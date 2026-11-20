import { useId } from 'react'

import { cn } from '@/lib/utils'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FieldProps = Omit<React.ComponentProps<typeof Input>, 'id'> & {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

/** Champ de formulaire : libellé, aide et erreur reliés au champ. */
export function Field({ label, error, hint, ...input }: FieldProps) {
  const id = useId()
  const described = [hint === undefined ? null : `${id}-aide`, error === undefined ? null : `${id}-erreur`]
    .filter((value) => value !== null)
    .join(' ')
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={described === '' ? undefined : described}
        className="h-11"
        {...input}
      />
      {hint !== undefined && (
        <p id={`${id}-aide`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-erreur`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

// Mêmes bordures et focus que `Input`, pour les listes et les zones de texte.
const control =
  'w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none md:text-sm dark:bg-input/30 ' +
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20'

type ControlProps = { label: string; error?: string | undefined; hint?: string | undefined }

/** Liste déroulante native (lecteurs d'écran et tablettes la connaissent), libellé et erreur reliés. */
export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...select
}: Omit<React.ComponentProps<'select'>, 'id'> & ControlProps) {
  const id = useId()
  const described = [hint === undefined ? null : `${id}-aide`, error === undefined ? null : `${id}-erreur`]
    .filter((value) => value !== null)
    .join(' ')
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={described === '' ? undefined : described}
        className={cn(control, 'h-11', className)}
        {...select}
      >
        {children}
      </select>
      {hint !== undefined && (
        <p id={`${id}-aide`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-erreur`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Zone de texte sur plusieurs lignes, libellé et erreur reliés. */
export function TextareaField({
  label,
  error,
  hint,
  className,
  ...textarea
}: Omit<React.ComponentProps<'textarea'>, 'id'> & ControlProps) {
  const id = useId()
  const described = [hint === undefined ? null : `${id}-aide`, error === undefined ? null : `${id}-erreur`]
    .filter((value) => value !== null)
    .join(' ')
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error !== undefined}
        aria-describedby={described === '' ? undefined : described}
        className={cn(control, 'py-2', className)}
        {...textarea}
      />
      {hint !== undefined && (
        <p id={`${id}-aide`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-erreur`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
