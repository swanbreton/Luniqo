import { Delete } from 'lucide-react'
import { useId, useState } from 'react'

import { ActionError } from '@/components/action-error'
import { Button } from '@/components/ui/button'
import { useRetryCountdown } from '@/lib/use-retry-countdown'

export const PIN_LENGTH = 4

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

type PinPadProps = {
  /** Prénom et initiale de l'employé, ex. « Lucas B. ». */
  name: string
  onSubmit: (pin: string) => void
  onCancel: () => void
  pending?: boolean
  /** Erreur de l'envoi : message, et compte à rebours d'une 429 (trop d'erreurs sur la tablette). */
  error?: unknown
}

/**
 * Saisie du PIN : pavé à grands boutons ou clavier, envoi dès le 4e chiffre.
 * Le PIN n'est vérifié que par l'API (ANO-001 : jamais dans le navigateur).
 */
export function PinPad({ name, onSubmit, onCancel, pending = false, error = null }: PinPadProps) {
  const [pin, setPin] = useState('')
  const id = useId()
  // Après une 429, pavé désactivé jusqu'à la fin du délai : chaque essai serait refusé.
  const wait = useRetryCountdown(error)
  const locked = pending || wait > 0

  function change(next: string) {
    const digits = next.replace(/\D/g, '').slice(0, PIN_LENGTH)
    setPin(digits)
    if (digits.length === PIN_LENGTH) onSubmit(digits)
  }

  return (
    <div className="mx-auto grid w-full max-w-sm gap-5">
      <label htmlFor={id} className="text-center text-2xl font-semibold">
        PIN de {name}
      </label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={PIN_LENGTH}
        value={pin}
        disabled={locked}
        aria-invalid={error !== null && error !== undefined}
        onChange={(event) => change(event.target.value)}
        className="h-16 rounded-md border bg-card text-center text-4xl tracking-[0.5em] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <ActionError error={error} waitSeconds={wait} />
      <div className="grid grid-cols-3 gap-3">
        {DIGITS.map((digit) => (
          <PadKey key={digit} label={digit} disabled={locked} onPress={() => change(pin + digit)} />
        ))}
        <Button variant="ghost" className="h-16 text-lg" disabled={pending} onClick={onCancel}>
          Retour
        </Button>
        <PadKey label="0" disabled={locked} onPress={() => change(`${pin}0`)} />
        <Button
          variant="ghost"
          className="h-16"
          aria-label="Effacer le dernier chiffre"
          disabled={locked || pin === ''}
          onClick={() => setPin(pin.slice(0, -1))}
        >
          <Delete aria-hidden="true" className="size-7" />
        </Button>
      </div>
    </div>
  )
}

function PadKey({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Button variant="outline" className="h-16 text-2xl" disabled={disabled} onClick={onPress}>
      {label}
    </Button>
  )
}
