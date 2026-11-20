import type { ReactNode } from 'react'

import type { Schemas } from '@/api/types'
import { formatTime } from '@/lib/dates'

import { isMissingDeparture } from './period'

type Presence = Schemas['AttendanceOut']

type PresenceTableProps = {
  presences: Presence[]
  /** Titre du tableau pour les lecteurs d'écran. */
  caption: string
  /**
   * Jour qu'il est à Paris. Donné, il distingue l'enfant encore présent du
   * départ oublié un jour passé ; sans lui, une arrivée sans départ est un enfant présent.
   */
  today?: string
  /** Action sur une ligne (« Corriger », pour la direction) : ajoute une colonne. */
  action?: ((presence: Presence) => ReactNode) | undefined
}

/** Une ligne par arrivée, avec qui a pointé et qui a amené ou cherché l'enfant (traçabilité du pointage). */
export function PresenceTable({ presences, caption, today, action }: PresenceTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b bg-muted/50 text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Enfant
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Arrivée
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Départ
            </th>
            {action !== undefined && (
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Correction</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {presences.map((presence) => {
            const missing = today !== undefined && isMissingDeparture(presence, today)
            return (
              <tr key={presence.id} className="border-b last:border-0">
                <th scope="row" className="px-4 py-3 font-medium">
                  {presence.child_name}
                  {presence.departed_at === null && !missing && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                      Présent·e
                    </span>
                  )}
                  {presence.corrected && (
                    <span className="ml-2 rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      Corrigée
                    </span>
                  )}
                </th>
                <td className="px-4 py-3">
                  <Moment
                    at={presence.arrived_at}
                    by={presence.arrival_by}
                    with={presence.dropped_off_by}
                    verb="amené·e par"
                  />
                </td>
                <td className="px-4 py-3">
                  {presence.departed_at !== null ? (
                    <Moment
                      at={presence.departed_at}
                      by={presence.departure_by}
                      with={presence.picked_up_by}
                      verb="parti·e avec"
                    />
                  ) : missing ? (
                    <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-xs font-medium text-destructive">
                      Départ non pointé
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                {action !== undefined && <td className="px-4 py-3 text-right">{action(presence)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type MomentProps = { at: string; by: string | null; with: string | null; verb: string }

/** Heure (Paris), puis qui a pointé et la personne de la famille, s'ils sont connus. */
function Moment({ at, by, with: guardian, verb }: MomentProps) {
  return (
    <span className="grid">
      <span className="font-medium">{formatTime(at)}</span>
      {guardian !== null && (
        <span>
          {verb} {guardian}
        </span>
      )}
      {by !== null && <span className="text-muted-foreground">pointé par {by}</span>}
    </span>
  )
}
