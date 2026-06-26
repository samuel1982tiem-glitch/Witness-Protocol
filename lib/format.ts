export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(ms)
}

/** Convert epoch ms to a value usable by <input type="datetime-local">. */
export function toDateTimeLocal(ms: number): string {
  const d = new Date(ms)
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60000)
  return local.toISOString().slice(0, 16)
}

export function fromDateTimeLocal(value: string): number {
  return new Date(value).getTime()
}

export function shortHash(hash: string, len = 12): string {
  if (hash.length <= len * 2) return hash
  return `${hash.slice(0, len)}…${hash.slice(-len)}`
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
