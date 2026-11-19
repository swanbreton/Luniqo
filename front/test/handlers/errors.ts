import { HttpResponse } from 'msw'

import { type ApiError, toApiError } from '@/api/errors'
import type { Schemas } from '@/api/types'

/**
 * Erreurs de l'API prêtes à l'emploi (docs/projet/ERREURS.md § 2 et 5).
 *
 * Un cas d'erreur est écrit une fois, à la forme exacte de l'API, et sert à deux endroits :
 * - tests d'intégration : `reply(apiErrors.serverError())` est la réponse MSW ;
 * - stories : `raised(apiErrors.serverError())` est l'erreur que le client lèverait
 *   (`toApiError`, comme `src/api/client.ts`), message d'attente d'une 429 compris.
 *
 * Messages et codes recopiés de l'API (`api/app/`) : si l'API en reformule un, le changer ici.
 */

/**
 * Corps envoyé par l'API. `detail` et `code` viennent du contrat généré ; `fields` n'est envoyé
 * que pour une saisie refusée (le type généré l'annonce toujours, à `null`) ; `request_id`
 * accompagne une 5xx depuis LUN-140.
 */
export type ErrorBody = Pick<Schemas['Error'], 'detail' | 'code'> & {
  fields?: Record<string, string>
  request_id?: string
}

/** Erreur rendue par l'API : statut, corps, et délai `Retry-After` d'une 429. */
export type ErrorCase = { status: number; body: ErrorBody; retryAfter?: number }

/** Référence fictive d'une requête, comme celles de l'API (32 caractères hexadécimaux). */
export const REQUEST_ID = '6f1c0b0e9d2a4c51a7e3d90b4f2c8e17'

function error(status: number, code: string, detail: string): ErrorCase {
  return { status, body: { detail, code } }
}

export const apiErrors = {
  // --- Transverses (dépendances communes à de nombreuses routes) ---
  authRequired: () => error(401, 'auth_required', 'Authentification requise'),
  mfaRequired: () => error(403, 'mfa_required', 'Second facteur requis'),
  roleRefused: () => error(403, 'role_refused', 'Action non autorisée pour ce rôle'),
  managerRequired: () => error(403, 'manager_required', 'Seule la direction peut gérer cette crèche'),
  nurseryNotFound: () => error(404, 'nursery_not_found', 'Crèche introuvable'),
  tabletRequired: () => error(401, 'tablet_required', 'Tablette non enrôlée, expirée ou révoquée'),
  pinSessionRequired: () =>
    error(401, 'pin_session_required', 'Session de tablette absente ou expirée : saisir le PIN'),

  /** 422 de saisie : un message par champ, sous les noms de l'API. */
  validation: (fields: Record<string, string>): ErrorCase => ({
    status: 422,
    body: { detail: 'Certains champs sont invalides.', code: 'validation_error', fields },
  }),

  /** 429 avec `Retry-After` (15 minutes par défaut, comme la connexion). */
  tooManyAttempts: (retryAfter = 900): ErrorCase => ({
    ...error(429, 'too_many_attempts', 'Trop de tentatives, réessayez plus tard'),
    retryAfter,
  }),

  /** 500 d'une exception imprévue : message générique et référence à donner au support. */
  serverError: (requestId = REQUEST_ID): ErrorCase => ({
    status: 500,
    body: {
      detail:
        'Une erreur est survenue de notre côté. Réessayez dans un instant ; si elle revient, donnez la référence à la crèche.',
      code: 'internal_error',
      request_id: requestId,
    },
  }),

  /** 503 de la passerelle quand l'API ne répond plus (LUN-139). */
  unavailable: (requestId = REQUEST_ID): ErrorCase => ({
    status: 503,
    body: {
      detail: 'Le service est momentanément indisponible. Réessayez dans un instant.',
      code: 'service_unavailable',
      request_id: requestId,
    },
  }),

  // --- Refus métier utilisés par les tests et les stories ---
  invalidCredentials: () => error(401, 'invalid_credentials', 'Identifiants invalides'),
  invalidCode: () => error(401, 'invalid_code', 'Code invalide'),
  pinInvalid: () => error(401, 'pin_invalid', 'PIN incorrect'),
  pinLocked: () => error(423, 'pin_locked', 'PIN bloqué après 3 erreurs : demandez à la direction de le débloquer'),
  /** 429 de la tablette après trop de PIN faux, toutes personnes confondues. */
  tabletThrottled: (retryAfter = 600): ErrorCase => ({
    ...error(429, 'tablet_throttled', "Trop d'erreurs de PIN sur cette tablette, réessayez plus tard"),
    retryAfter,
  }),
  pinPolicy: (detail = 'Ce PIN est trop prévisible (suite de chiffres).') => error(422, 'pin_policy', detail),
  wrongPassword: () => error(403, 'wrong_password', 'Mot de passe incorrect'),
  pickupNotAuthorized: () =>
    error(
      403,
      'pickup_not_authorized',
      "Cette personne n'est pas autorisée à venir chercher l'enfant : prévenir la direction",
    ),
  presenceOverlap: () =>
    error(409, 'presence_overlap', "Cette présence chevauche une autre présence de l'enfant ce jour-là"),

  /** Refus propre à un écran, absent de ce catalogue : statut, code et message de l'API. */
  refusal: error,
} as const

/** Réponse MSW de l'erreur, avec `Retry-After` et `X-Request-ID` comme l'API. */
export function reply({ status, body, retryAfter }: ErrorCase) {
  const headers: Record<string, string> = {}
  if (retryAfter !== undefined) headers['Retry-After'] = String(retryAfter)
  if (body.request_id !== undefined) headers['X-Request-ID'] = body.request_id
  return HttpResponse.json(body, { status, headers })
}

/** Coupure réseau : aucune réponse, `fetch` échoue (serveur injoignable, Wi-Fi coupé). */
export function networkError() {
  return HttpResponse.error()
}

/** Erreur que le client du front lève pour ce cas (`src/api/client.ts`), pour les stories. */
export function raised({ status, body, retryAfter }: ErrorCase): ApiError {
  return toApiError(status, body, retryAfter === undefined ? null : String(retryAfter), body.request_id ?? null)
}

/** Erreur que `fetch` lève sur une coupure réseau, pour les stories. */
export function networkFailure(): TypeError {
  return new TypeError('Failed to fetch')
}
