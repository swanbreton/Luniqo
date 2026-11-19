import { $api } from '@/api/client'
import { errorMessage } from '@/api/errors'
import type { Schemas } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type NurserySummaryFiguresProps = {
  summary: Schemas['NurserySummary'] | undefined
  pending: boolean
  error: unknown
  onRetry?: (() => void) | undefined
}

/** Une requête par crèche : son échec reste dans la carte, les liens restent utilisables. */
export function NurserySummary({ nurseryId }: { nurseryId: string }) {
  const query = $api.useQuery(
    'get',
    '/api/v2/nurseries/{nursery_id}/summary',
    { params: { path: { nursery_id: nurseryId } } },
    { refetchInterval: 30_000, retry: false },
  )

  return (
    <NurserySummaryFigures
      summary={query.data}
      pending={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
    />
  )
}

export function NurserySummaryFigures({ summary, pending, error, onRetry }: NurserySummaryFiguresProps) {
  if (pending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Chargement du résumé…
      </p>
    )
  }
  // Une erreur de rafraîchissement doit être visible aussi : ne pas afficher
  // d'anciens chiffres comme s'ils décrivaient encore la situation actuelle.
  if (error !== null && error !== undefined) {
    return (
      <Alert variant="destructive">
        <AlertTitle className="line-clamp-none">Impossible de charger le résumé.</AlertTitle>
        <AlertDescription>
          <p>{errorMessage(error)}</p>
          {onRetry !== undefined && (
            <Button type="button" variant="outline" onClick={onRetry}>
              Réessayer
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }
  if (summary === undefined) return null

  return (
    <dl className="grid grid-cols-3 gap-3">
      <Figure label="Enfants accueillis" value={summary.children} />
      <Figure label="Présents en ce moment" value={summary.present} />
      <Figure label="Personnel" value={summary.staff} />
    </dl>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid min-w-0 grid-rows-[1fr_auto]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
