import { WifiOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import type { Connectivity } from '@/lib/connectivity'

/** Bannière en haut de toutes les pages tant que l'application est hors ligne (docs/projet/ERREURS.md § 4). */
export function OfflineBanner({ offline }: { offline: boolean }) {
  // role="status" toujours présent : l'apparition du message est annoncée par les lecteurs d'écran.
  return (
    <div role="status" className="sticky top-0 z-50">
      {offline && (
        <p className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-sm font-medium text-white">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          Hors ligne : connexion au serveur impossible. Vérifiez le réseau.
        </p>
      )}
    </div>
  )
}

/** La bannière, branchée sur l'état du réseau de l'application. */
export function ConnectivityBanner({ connectivity }: { connectivity: Connectivity }) {
  const offline = useSyncExternalStore(connectivity.subscribe, connectivity.getSnapshot, () => false)
  return <OfflineBanner offline={offline} />
}
