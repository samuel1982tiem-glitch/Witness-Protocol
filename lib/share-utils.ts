/**
 * The native Share sheet throws when the user backs out/cancels without
 * picking an app (e.g. "Share canceled"). That isn't a real failure -- the
 * file was already written to disk successfully before Share.share() was
 * called. Callers should treat this case as a silent no-op rather than
 * surfacing an error message.
 */
export function isShareCancelled(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /cancel/i.test(message)
}
