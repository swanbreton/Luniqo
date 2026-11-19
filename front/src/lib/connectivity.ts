/**
 * Hors ligne ? (docs/projet/ERREURS.md § 4) Le navigateur le dit (`navigator.onLine`), ou une
 * requête vient d'échouer sans réponse alors qu'il se croit en ligne (Wi-Fi sans accès, serveur
 * injoignable). La première réponse reçue, ou le retour du réseau, efface l'échec noté.
 */
export type Connectivity = {
  subscribe: (listener: () => void) => () => void
  /** true si l'application est hors ligne. */
  getSnapshot: () => boolean
  /** Une requête a échoué sans réponse (catégorie `network`). */
  reportFailure: () => void
  /** Une réponse est arrivée, erreur HTTP comprise : le serveur est joignable. */
  reportSuccess: () => void
}

type Environment = Pick<Window, 'addEventListener' | 'removeEventListener'> & { navigator: { onLine: boolean } }

/** `environment` : `window` dans l'application, un double dans les tests unitaires. */
export function createConnectivity(environment: Environment): Connectivity {
  const listeners = new Set<() => void>()
  let failed = false
  let offline = computeOffline()

  function computeOffline() {
    return failed || !environment.navigator.onLine
  }
  function update() {
    const next = computeOffline()
    if (next === offline) return
    offline = next
    for (const listener of listeners) listener()
  }
  function onOnline() {
    failed = false
    update()
  }

  return {
    subscribe(listener) {
      if (listeners.size === 0) {
        environment.addEventListener('online', onOnline)
        environment.addEventListener('offline', update)
        offline = computeOffline()
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          environment.removeEventListener('online', onOnline)
          environment.removeEventListener('offline', update)
        }
      }
    },
    getSnapshot: () => offline,
    reportFailure() {
      failed = true
      update()
    },
    reportSuccess() {
      if (!failed) return
      failed = false
      update()
    },
  }
}
