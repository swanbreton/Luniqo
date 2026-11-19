import { useEffect, useState } from 'react'

import { ApiError } from '@/api/errors'

/**
 * Secondes à attendre avant un nouvel essai après une 429 (`Retry-After`), décomptées en direct.
 * Repart à chaque nouvelle erreur ; 0 sans erreur ou sans délai. L'écran désactive l'action
 * tant que le compte n'est pas à 0 (docs/projet/ERREURS.md § 4).
 */
export function useRetryCountdown(error: unknown): number {
  const seconds = error instanceof ApiError ? error.retryAfter : null
  // Secondes écoulées depuis la réception de cette erreur-là (une autre erreur repart de 0).
  const [tick, setTick] = useState<{ error: unknown; elapsed: number }>({ error: null, elapsed: 0 })
  const elapsed = tick.error === error ? tick.elapsed : 0

  useEffect(() => {
    if (seconds === null || seconds <= 0) return
    const start = Date.now()
    // Mesuré sur l'horloge, pas en comptant les intervalles : un onglet en arrière-plan les retarde.
    const timer = setInterval(() => {
      const next = Math.floor((Date.now() - start) / 1000)
      setTick({ error, elapsed: next })
      if (next >= seconds) clearInterval(timer)
    }, 250)
    return () => clearInterval(timer)
  }, [error, seconds])

  return seconds === null ? 0 : Math.max(0, seconds - elapsed)
}

/** « 45 s », « 14 min 05 s ». */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const rest = seconds % 60
  return `${Math.floor(seconds / 60)} min ${String(rest).padStart(2, '0')} s`
}
