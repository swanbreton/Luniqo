/**
 * Erreurs de l'API, en une seule forme pour tout le front.
 *
 * L'API renvoie `{"detail", "code", "fields"?, "request_id"?}` (docs/projet/ERREURS.md § 2) :
 * `detail` s'affiche tel quel, `code` est stable et sert aux décisions,
 * `fields` donne un message par champ pour une saisie refusée (422),
 * `request_id` la référence d'une erreur serveur (5xx), à donner au support.
 */

export class ApiError extends Error {
  readonly status: number
  /** Erreurs par champ d'une saisie refusée (422), clé = nom du champ côté API. */
  readonly fields: Record<string, string>
  /** Secondes à attendre (en-tête Retry-After d'un 429). */
  readonly retryAfter: number | null
  /** Code stable de l'API (`mfa_required`…) ; null sans corps lisible (panne, réponse inattendue). */
  readonly code: string | null
  /** Référence de la requête (`request_id` du corps, sinon en-tête X-Request-ID) ; retrouvée dans les journaux. */
  readonly requestId: string | null

  constructor(
    status: number,
    message: string,
    fields: Record<string, string> = {},
    retryAfter: number | null = null,
    code: string | null = null,
    requestId: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
    this.retryAfter = retryAfter
    this.code = code
    this.requestId = requestId
  }
}

type ErrorBody = { detail?: unknown; code?: unknown; fields?: unknown; request_id?: unknown }

const UNEXPECTED = 'Une erreur inattendue est survenue. Réessayez dans un instant.'

/** Construit l'erreur à partir de la réponse de l'API, de son corps déjà lu et de ses en-têtes utiles. */
export function toApiError(
  status: number,
  body: unknown,
  retryAfterHeader: string | null,
  requestIdHeader: string | null = null,
): ApiError {
  const retryAfter = parseRetryAfter(retryAfterHeader)
  const { detail, code, fields, request_id } = typeof body === 'object' && body !== null ? (body as ErrorBody) : {}
  const requestId = typeof request_id === 'string' && request_id !== '' ? request_id : requestIdHeader || null
  if (typeof detail === 'string') {
    return new ApiError(
      status,
      withDelay(detail, retryAfter),
      parseFields(fields),
      retryAfter,
      typeof code === 'string' ? code : null,
      requestId,
    )
  }
  if (status >= 500)
    return new ApiError(
      status,
      'Le service est momentanément indisponible. Réessayez dans un instant.',
      {},
      null,
      null,
      requestId,
    )
  return new ApiError(status, UNEXPECTED, {}, null, null, requestId)
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

/**
 * Message à afficher pour n'importe quelle erreur (réseau compris). Une erreur serveur (5xx)
 * donne aussi sa référence : la personne la transmet, on la retrouve dans les journaux
 * (`docker compose logs api | grep <référence>`, docs/projet/ERREURS.md § 3).
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status >= 500 && error.requestId !== null
      ? `${error.message} Référence : ${error.requestId}`
      : error.message
  }
  if (error instanceof TypeError) return 'Connexion au serveur impossible. Vérifiez le réseau.'
  return UNEXPECTED
}
