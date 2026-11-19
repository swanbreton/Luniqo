import type { Schemas } from '@/api/types'
import { ActionError } from '@/components/action-error'

import { PresenceTable } from './presence-table'
import { summarize } from './summary'

type Presence = Schemas['AttendanceOut']

type DayBoardProps = {
  presences: Presence[] | undefined
  pending: boolean
  error: unknown
  /** Nouvel essai de la lecture (`refetch`), proposé sur une panne du serveur ou du réseau. */
  onRetry?: (() => void) | undefined
}

/**
 * Présences du jour d'une crèche : chiffres, puis une ligne par arrivée, avec
 * qui a pointé et qui a amené ou cherché l'enfant (traçabilité du pointage).
 */
export function DayBoard({ presences, pending, error, onRetry }: DayBoardProps) {
  if (pending) return <p className="text-muted-foreground">Chargement des présences…</p>
  if (error !== null && error !== undefined) return <ActionError error={error} onRetry={onRetry} />
  if (presences === undefined || presences.length === 0) {
    return <p className="text-muted-foreground">Aucune arrivée pointée aujourd&apos;hui.</p>
  }
  const summary = summarize(presences)

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-3 gap-3">
        <Figure label="Présents en ce moment" value={summary.present} />
        <Figure label="Arrivées" value={summary.arrivals} />
        <Figure label="Départs" value={summary.departures} />
      </dl>
      <PresenceTable presences={presences} caption="Présences du jour, par heure d'arrivée" />
    </div>
  )
}

export function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-3xl font-semibold">{value}</dd>
    </div>
  )
}
