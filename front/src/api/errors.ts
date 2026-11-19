/**
 * Erreurs de l'API, en une seule forme pour tout le front.
 *
 * L'API renvoie `{"detail", "code", "fields"?}` (docs/projet/ERREURS.md § 2) :
 * `detail` s'affiche tel quel, `code` est stable et sert aux décisions,
 * `fields` donne un message par champ pour une saisie refusée (422).
 */

export class ApiError extends Error {
  readonly status: number
  /** Erreurs par champ d'une saisie refusée (422), clé = nom du champ côté API. */
  readonly fields: Record<string, string>
  /** Secondes à attendre (en-tête Retry-After d'un 429). */
  readonly retryAfter: number | null
  /** Code stable de l'API (`mfa_required`…) ; null sans corps lisible (panne, réponse inattendue). */
  readonly code: string | null

  constructor(
    status: number,
    message: string,
    fields: Record<string, string> = {},
    retryAfter: number | null = null,
    code: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
    this.retryAfter = retryAfter
    this.code = code
  }
}

type ErrorBody = { detail?: unknown; code?: unknown; fields?: unknown }

const UNEXPECTED = 'Une erreur inattendue est survenue. Réessayez dans un instant.'

/** Construit l'erreur à partir de la réponse de l'API et de son corps déjà lu. */
export function toApiError(status: number, body: unknown, retryAfterHeader: string | null): ApiError {
  const retryAfter = parseRetryAfter(retryAfterHeader)
  const { detail, code, fields } = typeof body === 'object' && body !== null ? (body as ErrorBody) : {}
  if (typeof detail === 'string') {
    return new ApiError(
      status,
      withDelay(detail, retryAfter),
      parseFields(fields),
      retryAfter,
      typeof code === 'string' ? code : null,
    )
  }
  if (status >= 500)
    return new ApiError(status, 'Le service est momentanément indisponible. Réessayez dans un instant.')
  return new ApiError(status, UNEXPECTED)
}

function parseFields(fields: unknown): Record<string, string> {
  if (typeof fields !== 'object' || fields === null) return {}
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function parseRetryAfter(header: string | null): number | null {
  if (header === null || !/^\d+$/.test(header)) return null
  return Number(header)
}

function withDelay(message: string, retryAfter: number | null): string {
  if (retryAfter === null) return message
  const minutes = Math.ceil(retryAfter / 60)
  return `${message} (dans ${minutes} minute${minutes > 1 ? 's' : ''})`
}

/**
 * Codes de l'API sur lesquels le front décide (catalogue : docs/projet/ERREURS.md § 2).
 * Ne jamais comparer `message` : il peut être reformulé, le code jamais.
 */
export const ERROR_CODES = {
  mfaRequired: 'mfa_required',
  pinLocked: 'pin_locked',
  pinNotSet: 'pin_not_set',
} as const

/** Erreurs par champ d'une saisie refusée, ou `undefined` ; même objet tant que l'erreur ne change pas. */
export function fieldErrorsOf(error: unknown): Readonly<Record<string, string>> | undefined {
  return error instanceof ApiError && Object.keys(error.fields).length > 0 ? error.fields : undefined
}

/** Message à afficher pour n'importe quelle erreur (réseau compris). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) return 'Connexion au serveur impossible. Vérifiez le réseau.'
  return UNEXPECTED
}
