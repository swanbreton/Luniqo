import type { Schemas } from '@/api/types'
import { ActionError } from '@/components/action-error'
import { formatDateTime, formatDay } from '@/lib/dates'

import { describeChanges, KIND_LABELS } from './correction'

type CorrectionLogProps = {
  entries: Schemas['CorrectionOut'][] | undefined
  pending: boolean
  error: unknown
  /** Nouvel essai de la lecture (`refetch`), proposé sur une panne du serveur ou du réseau. */
  onRetry?: (() => void) | undefined
}

/**
 * Journal des corrections de la période (jour de la présence corrigée) : qui,
 * quand, pourquoi, et ce qui a changé. Il ne s'efface pas, même quand la présence est retirée.
 */
export function CorrectionLog({ entries, pending, error, onRetry }: CorrectionLogProps) {
  if (pending) return <p className="text-muted-foreground">Chargement du journal…</p>
  if (error !== null && error !== undefined) return <ActionError error={error} onRetry={onRetry} />
  if (entries === undefined || entries.length === 0) {
    return <p className="text-muted-foreground">Aucune correction sur cette période.</p>
  }
  return (
    <ol className="grid gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="grid gap-1 rounded-lg border bg-card p-4">
          <p className="font-medium">
            {KIND_LABELS[entry.kind]} · {entry.child_name} · {formatDay(entry.day)}
          </p>
          <ul className="text-sm">
            {describeChanges(entry.before, entry.after).map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
          <p className="text-sm">Motif : {entry.reason}</p>
          <p className="text-sm text-muted-foreground">
            Par {entry.corrected_by}, le {formatDateTime(entry.corrected_at)}
          </p>
        </li>
      ))}
    </ol>
  )
}
