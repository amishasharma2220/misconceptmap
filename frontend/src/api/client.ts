const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const TOKEN_KEY = 'mm.token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable (private mode): stay signed in for this tab only */
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      // FastAPI validation errors: [{loc: [...], msg: "..."}]
      return detail
        .map((d: { loc?: unknown[]; msg?: string }) => {
          const field = d.loc?.filter((x) => x !== 'body').join('.')
          return field ? `${field}: ${d.msg}` : d.msg
        })
        .join('; ')
    }
  }
  return fallback
}

// ---- slow-request tracking: the free server sleeps when idle and takes up to a minute to wake.
const SLOW_AFTER_MS = 4000
let slowCount = 0
const slowListeners = new Set<() => void>()
const setSlow = (delta: number) => {
  slowCount += delta
  slowListeners.forEach((cb) => cb())
}
/** For useSyncExternalStore: true while any request has been waiting longer than 4 seconds. */
export const slowRequests = {
  subscribe: (cb: () => void) => {
    slowListeners.add(cb)
    return () => void slowListeners.delete(cb)
  },
  get: () => slowCount > 0,
}

/** Wake the server as soon as the site opens, so it is ready by the time someone signs in. */
export function wakeServer() {
  fetch(`${API_URL}/health`).catch(() => {})
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  let slow = false
  const timer = setTimeout(() => {
    slow = true
    setSlow(1)
  }, SLOW_AFTER_MS)
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(
      0,
      import.meta.env.PROD
        ? "Can't reach the server. Check your connection and try again in a minute."
        : 'Cannot reach the API. Is the backend running on port 8000?',
    )
  } finally {
    clearTimeout(timer)
    if (slow) setSlow(-1)
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, messageFrom(body, `${res.status} ${res.statusText}`))
  return body as T
}

export const apiGet = <T>(path: string) => api<T>(path)
export const apiSend = <T>(method: string, path: string, data?: unknown) =>
  api<T>(path, { method, body: data === undefined ? undefined : JSON.stringify(data) })

export type Health = { status: string; db: string }
