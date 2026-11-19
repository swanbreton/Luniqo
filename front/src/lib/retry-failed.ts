type Read = { isError: boolean; refetch: () => Promise<unknown> }

/** Bouton « Réessayer » d'un écran à plusieurs lectures : relance celles qui ont échoué, seulement. */
export function retryFailed(...reads: Read[]): () => void {
  return () => {
    for (const read of reads) if (read.isError) void read.refetch()
  }
}
