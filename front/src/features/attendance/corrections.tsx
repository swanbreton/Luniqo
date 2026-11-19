import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { $api } from '@/api/client'
import { errorMessage, fieldErrorsOf } from '@/api/errors'
import type { Schemas } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatTime } from '@/lib/dates'

import { AdditionForm } from './addition-form'
import { CorrectionForm } from './correction-form'

const HISTORY = '/api/v2/nurseries/{nursery_id}/attendance/history'
const DAY = '/api/v2/nurseries/{nursery_id}/attendance'
const CORRECTIONS = '/api/v2/nurseries/{nursery_id}/attendance/corrections'
const CHILD = '/api/v2/nurseries/{nursery_id}/children/{child_id}'

/** Après une correction : présences du jour, historique et journal sont relus. */
function useRefresh() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([HISTORY, DAY, CORRECTIONS].map((path) => queryClient.invalidateQueries({ queryKey: ['get', path] })))
}

type CorrectPresenceProps = { nurseryId: string; presence: Schemas['AttendanceOut'] }

/** Bouton « Corriger » d'une ligne, et sa fenêtre. Direction seulement (l'API refuse les autres). */
export function CorrectPresence({ nurseryId, presence }: CorrectPresenceProps) {
  const [open, setOpen] = useState(false)
  const refresh = useRefresh()
  const path = { nursery_id: nurseryId }
  const child = $api.useQuery(
    'get',
    CHILD,
    { params: { path: { ...path, child_id: presence.child_id } } },
    { enabled: open },
  )
  const done = async () => {
    await refresh()
    setOpen(false)
  }
  const correct = $api.useMutation('patch', '/api/v2/nurseries/{nursery_id}/attendance/{attendance_id}', {
    onSuccess: done,
  })
  const remove = $api.useMutation('post', '/api/v2/nurseries/{nursery_id}/attendance/{attendance_id}/cancel', {
    onSuccess: done,
  })
  const target = { params: { path: { ...path, attendance_id: presence.id } } }
  const failure = correct.error ?? remove.error ?? child.error

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        correct.reset()
        remove.reset()
        setOpen(next)
      }}
    >
      <Button
        variant="outline"
        size="sm"
        aria-label={`Corriger la présence de ${presence.child_name}, arrivée à ${formatTime(presence.arrived_at)}`}
        onClick={() => setOpen(true)}
      >
        Corriger
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corriger la présence</DialogTitle>
          <DialogDescription>Le motif et votre nom sont gardés dans le journal des corrections.</DialogDescription>
        </DialogHeader>
        <CorrectionForm
          presence={presence}
          guardians={child.data?.guardians}
          onSubmit={(body) => correct.mutate({ ...target, body })}
          onRemove={(reason) => remove.mutate({ ...target, body: { reason } })}
          pending={correct.isPending || remove.isPending}
          error={failure === null ? null : errorMessage(failure)}
          fieldErrors={fieldErrorsOf(failure)}
        />
      </DialogContent>
    </Dialog>
  )
}

type AddPresenceProps = { nurseryId: string; today: string; defaultDay: string }

/** Bouton « Ajouter une présence oubliée » et sa fenêtre. Direction seulement. */
export function AddPresence({ nurseryId, today, defaultDay }: AddPresenceProps) {
  const [open, setOpen] = useState(false)
  const [childId, setChildId] = useState('')
  const refresh = useRefresh()
  const path = { nursery_id: nurseryId }
  const childList = $api.useQuery(
    'get',
    '/api/v2/nurseries/{nursery_id}/children',
    { params: { path } },
    { enabled: open },
  )
  const child = $api.useQuery(
    'get',
    CHILD,
    { params: { path: { ...path, child_id: childId } } },
    { enabled: open && childId !== '' },
  )
  const add = $api.useMutation('post', DAY, {
    onSuccess: async () => {
      await refresh()
      setOpen(false)
    },
  })
  const failure = add.error ?? childList.error ?? child.error

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        add.reset()
        setChildId('')
        setOpen(next)
      }}
    >
      <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Ajouter une présence oubliée
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une présence oubliée</DialogTitle>
          <DialogDescription>
            Pour une arrivée jamais pointée sur la tablette, sur les 31 derniers jours. Heures de Paris.
          </DialogDescription>
        </DialogHeader>
        <AdditionForm
          childList={childList.data}
          guardians={childId === '' ? undefined : child.data?.guardians}
          onChildChange={setChildId}
          today={today}
          defaultDay={defaultDay}
          onSubmit={(body) => add.mutate({ params: { path }, body })}
          pending={add.isPending}
          error={failure === null ? null : errorMessage(failure)}
          fieldErrors={fieldErrorsOf(failure)}
        />
      </DialogContent>
    </Dialog>
  )
}
