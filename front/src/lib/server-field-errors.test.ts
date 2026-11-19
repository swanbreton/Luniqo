import { describe, expect, it } from 'vitest'

import { ApiError, fieldErrorsOf } from '@/api/errors'

import { serverFieldErrors } from './server-field-errors'

type Values = { arrival: string; reason: string }
const FIELDS = { arrived_at: 'arrival', reason: 'reason' } as const

describe('serverFieldErrors', () => {
  it('pose chaque erreur sous le champ correspondant du formulaire', () => {
    const errors = serverFieldErrors<Values>({ arrived_at: 'Heure invalide', reason: 'Champ obligatoire' }, FIELDS)
    expect(errors).toEqual([
      ['arrival', 'Heure invalide'],
      ['reason', 'Champ obligatoire'],
    ])
  })

  it("ignore un champ que le formulaire n'affiche pas", () => {
    expect(serverFieldErrors<Values>({ nursery_id: 'Identifiant invalide' }, FIELDS)).toEqual([])
  })

  it('ne fait rien sans erreur par champ', () => {
    expect(serverFieldErrors<Values>(undefined, FIELDS)).toEqual([])
  })
})

describe('fieldErrorsOf', () => {
  it("renvoie les champs d'une saisie refusée, toujours le même objet", () => {
    const error = new ApiError(422, 'Certains champs sont invalides.', { reason: 'Champ obligatoire' })
    expect(fieldErrorsOf(error)).toEqual({ reason: 'Champ obligatoire' })
    expect(fieldErrorsOf(error)).toBe(fieldErrorsOf(error))
  })

  it('renvoie undefined sans champ, ou pour une autre erreur', () => {
    expect(fieldErrorsOf(new ApiError(409, 'Arrivée déjà pointée'))).toBeUndefined()
    expect(fieldErrorsOf(new TypeError('Failed to fetch'))).toBeUndefined()
    expect(fieldErrorsOf(null)).toBeUndefined()
  })
})
