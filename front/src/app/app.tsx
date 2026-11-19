import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, type RouterHistory, RouterProvider } from '@tanstack/react-router'

import { ApiError, ERROR_CODES, errorCategory, isRetryable } from '@/api/errors'
import { createConnectivity } from '@/lib/connectivity'
import { routeTree } from '@/routeTree.gen'

/**
 * Application : cache des données et routeur. `history` permet aux tests de
 * démarrer sur une adresse donnée (historique en mémoire).
 */
export function createApp(history?: RouterHistory) {
  /**
   * Erreurs communes traitées à un seul endroit (ADR-002 § 4) : session expirée
   * (401) → connexion ; second facteur à présenter (code `mfa_required`) → écran
   * du second facteur. Décision sur le code, jamais sur le texte du message.
   * Les autres erreurs restent aux écrans, qui les affichent.
   */
  function onApiError(error: Error, meta: Record<string, unknown> | undefined) {
    if (!(error instanceof ApiError) || meta?.handlesAuthErrors === true) return
    const { pathname, href } = router.state.location
    // La tablette a sa propre authentification (appareil, puis PIN) : ses 401 restent à l'écran.
    if (pathname.startsWith('/connexion') || pathname.startsWith('/tablette')) return
    if (errorCategory(error) === 'authentication') {
      queryClient.removeQueries({ queryKey: ['session'] })
      void router.navigate({ to: '/connexion', search: { redirect: href } })
    } else if (error.code === ERROR_CODES.mfaRequired) {
      // Session relue : en cache (30 s), elle se dirait encore vérifiée et l'écran renverrait à l'accueil.
      queryClient.removeQueries({ queryKey: ['session'] })
      void router.navigate({ to: '/connexion/second-facteur' })
    }
  }

  // Bannière hors ligne : toute réponse reçue prouve que le serveur est joignable.
  const connectivity = createConnectivity(window)
  function onFailure(error: Error) {
    if (errorCategory(error) === 'network') connectivity.reportFailure()
    else if (error instanceof ApiError) connectivity.reportSuccess()
  }

  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        onFailure(error)
        onApiError(error, query.meta)
      },
      onSuccess: () => connectivity.reportSuccess(),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        onFailure(error)
        onApiError(error, mutation.meta)
      },
      onSuccess: () => connectivity.reportSuccess(),
    }),
    defaultOptions: {
      // Nouveaux essais automatiques (docs/projet/ERREURS.md § 4) : lectures seulement, 2 fois,
      // après 1 s puis 2 s, et seulement sur une panne (serveur, réseau) : une 4xx ne se corrige pas.
      queries: {
        retry: (failures, error) => isRetryable(error) && failures < 2,
        retryDelay: (attempt) => 1000 * 2 ** attempt,
      },
      // Une écriture n'est jamais rejouée sans l'utilisateur : rejouer un pointage l'enregistrerait
      // deux fois. Ni mise en pause hors ligne (« online » par défaut) : elle partirait plus tard,
      // seule, à une autre heure. Elle échoue tout de suite et l'écran propose « Réessayer ».
      mutations: { retry: false, networkMode: 'always' },
    },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient, connectivity },
    ...(history === undefined ? {} : { history }),
    defaultPreload: 'intent',
    // Le cache des données est celui de TanStack Query, pas celui du routeur.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })

  return { queryClient, router, connectivity }
}

type AppRouter = ReturnType<typeof createApp>['router']

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}

const app = createApp()

export function App({ instance = app }: { instance?: ReturnType<typeof createApp> }) {
  return (
    <QueryClientProvider client={instance.queryClient}>
      <RouterProvider router={instance.router} />
    </QueryClientProvider>
  )
}
