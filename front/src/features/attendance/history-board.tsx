import type { ReactNode } from 'react'

import type { Schemas } from '@/api/types'
import { ActionError } from '@/components/action-error'
import { formatLongDay } from '@/lib/dates'

import { Figure } from './day-board'
import { groupByDay, summarizePeriod } from './period'
import { PresenceTable } from './presence-table'

type HistoryBoardProps = {
  presences: Schemas['AttendanceOut'][] | undefined
  /** Jour qu'il est à Paris : un enfant sans départ aujourd'hui est présent, un jour passé c'est un oubli. */
  today: string
  pending: boolean
  error: unknown
  /** Nouvel essai de la lecture (`refetch`), proposé sur une panne du serveur ou du réseau. */
  onRetry?: (() => void) | undefined
  /** Action sur chaque présence (« Corriger », pour la direction). */
  action?: (presence: Schemas['AttendanceOut']) => ReactNode
}

/** Présences d'une période : chiffres, puis un tableau par jour, du plus ancien au plus récent. */
export function HistoryBoard({ presences, today, pending, error, onRetry, action }: HistoryBoardProps) {
  if (pending) return <p className="text-muted-foreground">Chargement de l&apos;historique…</p>
  if (error !== null && error !== undefined) return <ActionError error={error} onRetry={onRetry} />
  if (presences === undefined || presences.length === 0) {
    return <p className="text-muted-foreground">Aucune arrivée pointée sur cette période.</p>
  }
  const summary = summarizePeriod(presences, today)

  return (
    <div className="grid gap-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Jours avec présence" value={summary.days} />
        <Figure label="Enfants accueillis" value={summary.children} />
        <Figure label="Arrivées" value={summary.arrivals} />
        <Figure label="Départs non pointés" value={summary.missingDepartures} />
      </dl>
      {groupByDay(presences).map(({ day, presences: ofDay }) => {
        const date = formatLongDay(day)
        const title = date.charAt(0).toUpperCase() + date.slice(1)
        return (
          <section key={day} aria-label={title} className="grid gap-2">
            <h2 className="text-lg font-medium">{title}</h2>
            <PresenceTable presences={ofDay} caption={`Présences du ${date}`} today={today} action={action} />
          </section>
        )
      })}
    </div>
  )
}
