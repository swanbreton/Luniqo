import { useEffect } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

/** Erreurs par champ renvoyées par l'API (`fields` d'une 422), clé = nom du champ côté API. */
export type ServerFieldErrors = Readonly<Record<string, string>>

/**
 * Champs de l'API → champs du formulaire. L'API parle en snake_case (`arrived_at`),
 * le formulaire a ses propres noms (`arrival`) : la correspondance est explicite.
 */
export type FieldMap<T extends FieldValues> = Readonly<Record<string, Path<T>>>

/**
 * Erreurs à poser sur le formulaire : `[champ du formulaire, message]`.
 * Un champ de l'API absent de la correspondance est ignoré : le résumé en haut du
 * formulaire (`detail`) reste affiché.
 */
export function serverFieldErrors<T extends FieldValues>(
  fieldErrors: ServerFieldErrors | undefined,
  fieldMap: FieldMap<T>,
): [Path<T>, string][] {
  if (fieldErrors === undefined) return []
  return Object.entries(fieldErrors).flatMap(([apiName, message]) => {
    const name = fieldMap[apiName]
    return name === undefined ? [] : [[name, message] as [Path<T>, string]]
  })
}

/**
 * Affiche sous chaque champ l'erreur que l'API lui attribue (`setError` de React Hook Form).
 * Le message disparaît dès que le champ est corrigé et revalidé.
 */
export function useServerFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldErrors: ServerFieldErrors | undefined,
  fieldMap: FieldMap<T>,
) {
  const { setError } = form
  useEffect(() => {
    for (const [name, message] of serverFieldErrors(fieldErrors, fieldMap)) {
      setError(name, { type: 'server', message })
    }
  }, [setError, fieldErrors, fieldMap])
}
