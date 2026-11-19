import { describe, expect, it } from 'vitest'

import { ApiError, type ErrorCategory, errorCategory, errorMessage, isRetryable, toApiError } from './errors'

describe('toApiError', () => {
  it("reprend le message et le code de l'API", () => {
    const error = toApiError(401, { detail: 'Identifiants invalides', code: 'invalid_credentials' }, null)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Identifiants invalides')
    expect(error.code).toBe('invalid_credentials')
  })

  it('lit le délai de Retry-After sans l’écrire dans le message (décompté à l’écran)', () => {
    const error = toApiError(429, { detail: 'Trop de tentatives, réessayez plus tard' }, '61')
    expect(error.retryAfter).toBe(61)
    expect(error.message).toBe('Trop de tentatives, réessayez plus tard')
  })

  it('ignore un Retry-After qui n’est pas un nombre de secondes', () => {
    expect(toApiError(429, { detail: 'Attendez' }, 'Wed, 21 Oct 2026 07:28:00 GMT').retryAfter).toBeNull()
  })

  it('lit les erreurs par champ d’une saisie refusée', () => {
    const body = {
      detail: 'Certains champs sont invalides.',
      code: 'validation_error',
      fields: { email: 'Champ obligatoire', age: 3 },
    }
    const error = toApiError(422, body, null)
    expect(error.fields).toEqual({ email: 'Champ obligatoire' })
    expect(error.message).toBe('Certains champs sont invalides.')
    expect(error.code).toBe('validation_error')
  })

  it('message générique et sans code pour une réponse inattendue', () => {
    expect(toApiError(502, '<html>', null).message).toMatch(/indisponible/)
    expect(toApiError(502, '<html>', null).code).toBeNull()
    expect(toApiError(418, null, null).message).toMatch(/inattendue/)
  })

  it('lit la référence dans le corps, sinon dans l’en-tête X-Request-ID', () => {
    const body = {
      detail: 'Une erreur est survenue de notre côté.',
      code: 'internal_error',
      request_id: 'ref-corps-1234',
    }
    expect(toApiError(500, body, null, 'ref-entete-5678').requestId).toBe('ref-corps-1234')
    expect(
      toApiError(404, { detail: 'Crèche introuvable', code: 'nursery_not_found' }, null, 'ref-entete-5678').requestId,
    ).toBe('ref-entete-5678')
    // 502 en HTML d'un proxy : pas de corps lisible, la référence de l'en-tête reste.
    expect(toApiError(502, '<html>', null, 'ref-entete-5678').requestId).toBe('ref-entete-5678')
    expect(toApiError(500, null, null).requestId).toBeNull()
  })
})

describe('errorMessage', () => {
  it('distingue une panne réseau', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/réseau/)
    expect(errorMessage(new ApiError(404, 'Crèche introuvable'))).toBe('Crèche introuvable')
    expect(errorMessage('?')).toMatch(/inattendue/)
  })

  it('donne la référence d’une erreur serveur, à transmettre au support', () => {
    const error = toApiError(
      500,
      { detail: 'Une erreur est survenue de notre côté.', code: 'internal_error', request_id: '6f1c0b0e9d2a4c51' },
      null,
    )
    expect(errorMessage(error)).toBe('Une erreur est survenue de notre côté. Référence : 6f1c0b0e9d2a4c51')
    expect(errorMessage(toApiError(502, '<html>', null, 'abc12345'))).toMatch(/indisponible.* Référence : abc12345$/)
  })

  it('ne montre pas de référence pour un refus (4xx), même si l’API en envoie une', () => {
    const error = toApiError(404, { detail: 'Crèche introuvable', code: 'nursery_not_found' }, null, 'ref-12345678')
    expect(errorMessage(error)).toBe('Crèche introuvable')
  })

  it('pas de référence affichée quand il n’y en a pas', () => {
    expect(errorMessage(toApiError(502, '<html>', null))).toBe(
      'Le service est momentanément indisponible. Réessayez dans un instant.',
    )
  })
})

describe('errorCategory', () => {
  it.for<[number, ErrorCategory]>([
    [400, 'validation'],
    [401, 'authentication'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [422, 'validation'],
    [423, 'locked'],
    [429, 'too_many_attempts'],
    [500, 'server'],
    [502, 'server'],
    [503, 'server'],
    [418, 'unexpected'],
  ])('%i → %s', ([status, category]) => {
    expect(errorCategory(new ApiError(status, 'message'))).toBe(category)
  })

  it('coupure réseau : fetch lève une TypeError', () => {
    expect(errorCategory(new TypeError('Failed to fetch'))).toBe('network')
  })

  it('toute autre erreur est inattendue', () => {
    expect(errorCategory(new Error('rendu'))).toBe('unexpected')
    expect(errorCategory(undefined)).toBe('unexpected')
  })
})

describe('isRetryable', () => {
  it('panne du serveur ou du réseau : un nouvel essai peut réussir', () => {
    expect(isRetryable(new ApiError(503, 'indisponible'))).toBe(true)
    expect(isRetryable(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('refus (4xx) ou erreur inattendue : réessayer ne change rien', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 423, 429])
      expect(isRetryable(new ApiError(status, 'refus'))).toBe(false)
    expect(isRetryable(new Error('rendu'))).toBe(false)
  })
})
