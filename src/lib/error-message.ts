/**
 * Sisense's SDK sometimes throws errors whose `message` is itself a
 * stringified JSON payload, e.g. `{"error":true,"type":500,"details":"Socket disconnected"}`
 * (seen in practice when a live-query WebSocket drops mid-export). Extract the
 * human-readable `details` field when present, so the UI shows "Socket
 * disconnected" instead of a raw JSON blob.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const rawMessage = error instanceof Error ? error.message : String(error);
  if (!rawMessage.trim()) return fallback;

  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed && typeof parsed.details === 'string' && parsed.details.trim()) {
      return parsed.details;
    }
  } catch {
    // Not JSON — use the raw message as-is.
  }

  return rawMessage;
}
