import * as React from 'react'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/*
 * Fenêtre modale sur l'élément natif <dialog> (showModal) plutôt que le Dialog
 * de Radix : celui-ci injecte une balise <style> pour bloquer le défilement,
 * refusée par notre CSP (`style-src 'self'`). Le navigateur fournit ici le
 * focus gardé dans la fenêtre, Échap, l'arrière-plan inerte et le retour du
 * focus à la fermeture ; le défilement est bloqué en CSS (styles/index.css).
 */

type DialogContextValue = {
  open: boolean
  close: () => void
  titleId: string
  descriptionId: string
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialog(): DialogContextValue {
  const context = React.use(DialogContext)
  if (context === null) throw new Error('Composant de fenêtre hors de <Dialog>')
  return context
}

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const id = React.useId()
  const value = {
    open,
    close: () => onOpenChange(false),
    titleId: `${id}-titre`,
    descriptionId: `${id}-description`,
  }
  return <DialogContext value={value}>{children}</DialogContext>
}

/** Contenu de la fenêtre : monté seulement quand elle est ouverte (un formulaire repart de zéro). */
function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open, close, titleId, descriptionId } = useDialog()
  const ref = React.useRef<HTMLDialogElement>(null)

  React.useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // Échap ou close() : la fenêtre se ferme d'elle-même, l'état suit.
      onClose={() => {
        if (open) close()
      }}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border bg-background p-6 text-start text-foreground shadow-lg backdrop:bg-black/50',
        className,
      )}
    >
      {open && (
        <div className="relative grid gap-4">
          {children}
          <button
            type="button"
            onClick={close}
            className="absolute top-0 right-0 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <XIcon className="size-5" aria-hidden="true" />
            <span className="sr-only">Fermer</span>
          </button>
        </div>
      )}
    </dialog>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('grid gap-2 pr-8', className)} {...props} />
}

function DialogTitle({ className, children, ...props }: Omit<React.ComponentProps<'h2'>, 'id'>) {
  const { titleId } = useDialog()
  return (
    <h2 id={titleId} className={cn('text-lg leading-none font-semibold', className)} {...props}>
      {children}
    </h2>
  )
}

function DialogDescription({ className, ...props }: Omit<React.ComponentProps<'p'>, 'id'>) {
  const { descriptionId } = useDialog()
  return <p id={descriptionId} className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle }
