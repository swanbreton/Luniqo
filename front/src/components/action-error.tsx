import { errorMessage, isRetryable } from '@/api/errors'
import { FormError } from '@/components/form-error'
import { Button } from '@/components/ui/button'
import { formatWait } from '@/lib/use-retry-countdown'
import { cn } from '@/lib/utils'

type ActionErrorProps = {
  /** Erreur brute de la requête (ApiError, coupure réseau…) ; rien n'est affiché sans erreur. */
  error: unknown
  /** Nouvel essai à la demande : proposé seulement sur une panne du serveur ou du réseau. */
  onRetry?: (() => void) | undefined
  /** Secondes restantes avant un nouvel essai après une 429 (`useRetryCountdown`). */
  waitSeconds?: number
  /** Grand bouton (tablette, mains occupées). */
  large?: boolean
}

/**
 * Erreur d'une action, à l'endroit de l'action, et ce qu'on peut faire (docs/projet/ERREURS.md § 4) :
 * message (référence d'une 5xx comprise), « Réessayer » sur une panne, compte à rebours sur une 429.
 * Jamais de notification flottante.
 */
export function ActionError({ error, onRetry, waitSeconds = 0, large = false }: ActionErrorProps) {
  if (error === null || error === undefined) return null
  return (
    <div className="grid gap-2">
      <FormError message={errorMessage(error)} />
      {waitSeconds > 0 && (
        // Hors de l'alerte et en role="timer" (non annoncé) : pas de relecture à chaque seconde.
        <p role="timer" className="text-sm text-muted-foreground">
          Nouvel essai possible dans {formatWait(waitSeconds)}
        </p>
      )}
      {onRetry !== undefined && isRetryable(error) && (
        <Button
          type="button"
          variant="outline"
          size={large ? 'lg' : 'default'}
          className={cn('justify-self-start', large ? 'h-16 text-xl' : 'h-11')}
          onClick={onRetry}
        >
          Réessayer
        </Button>
      )}
    </div>
  )
}
