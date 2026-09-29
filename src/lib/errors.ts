// Supabase/Postgrest errors are plain objects, not `instanceof Error`, so
// `err instanceof Error ? err.message : 'fallback'` silently discards the
// real database error message. This helper extracts it reliably.
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as Record<string, unknown>
    if (typeof anyErr.message === 'string' && anyErr.message) return anyErr.message
    if (typeof anyErr.error_description === 'string' && anyErr.error_description) return anyErr.error_description
    if (typeof anyErr.msg === 'string' && anyErr.msg) return anyErr.msg
    try {
      return JSON.stringify(err)
    } catch {
      return 'Erreur inconnue'
    }
  }
  return String(err)
}
