import { offlineDb } from './offline-db'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export const apiUrl = (path: string) => `${API}${path}`

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('eolis_token')
}

// sessionStorage is cleared when the app process is killed (RAM release, app close on mobile).
// getUser() returns null without the session marker → page redirects to /login.
// This forces re-authentication after app close even if the JWT hasn't expired yet.
export function getUser(): any | null {
  if (typeof window === 'undefined') return null
  if (!sessionStorage.getItem('eolis_session')) return null
  const raw = localStorage.getItem('eolis_user')
  return raw ? JSON.parse(raw) : null
}

export function saveSession(token: string, user: any) {
  localStorage.setItem('eolis_token', token)
  localStorage.setItem('eolis_user', JSON.stringify(user))
  sessionStorage.setItem('eolis_session', '1')
  // Store for service worker background sync (SW cannot access localStorage)
  offlineDb.set('auth_token', token)
  offlineDb.set('api_base', API)
  offlineDb.set('user_lang', user?.language ?? 'fr')
}

export function isTokenExpired(): boolean {
  const token = getToken()
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp < Date.now() / 1000
  } catch {
    return true
  }
}

export function checkSessionAndRedirect(locale = 'fr'): boolean {
  if (typeof window === 'undefined') return false
  if (isTokenExpired()) {
    clearSession()
    window.location.href = `/${locale}/login`
    return true
  }
  return false
}

export function clearSession() {
  localStorage.removeItem('eolis_token')
  localStorage.removeItem('eolis_user')
  sessionStorage.removeItem('eolis_session')
  // Clear IndexedDB API cache so next login sees fresh data
  try {
    indexedDB.deleteDatabase('eolis-offline')
  } catch {}
}

export async function apiFetch(path: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const token  = getToken()
  const method = (options.method ?? 'GET').toUpperCase()

  // Offline shortcut for GET: serve cache immediately, no network wait
  if (typeof navigator !== 'undefined' && !navigator.onLine && method === 'GET') {
    const cached = await offlineDb.get(path)
    if (cached !== null) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Eolis-Cache': '1' },
      })
    }
    throw new Error('offline')
  }

  const { timeout: timeoutOpt, ...fetchOptions } = options
  const controller = new AbortController()
  const timeoutMs  = timeoutOpt ?? (method === 'GET' ? 3000 : 15000)
  const timeoutId  = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(apiUrl(path), {
      ...fetchOptions,
      signal: fetchOptions.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions.headers,
      },
    })
    clearTimeout(timeoutId)

    // Cache successful GET responses for offline use
    if (res.ok && method === 'GET') {
      res.clone().json().then(data => offlineDb.set(path, data)).catch(() => {})
    }

    // Auto-logout on 401 (token expired or revoked)
    if (res.status === 401 && typeof window !== 'undefined') {
      const errData = await res.clone().json().catch(() => ({}))
      clearSession()
      if (errData?.detail === 'account_deleted') {
        // Show popup in the current layout — don't redirect yet
        window.dispatchEvent(new CustomEvent('eolis:account_deleted'))
      } else {
        const localeSeg = window.location.pathname.split('/')[1]
        const locale = ['fr', 'en'].includes(localeSeg) ? localeSeg : 'fr'
        window.location.href = `/${locale}/login`
      }
    }

    return res
  } catch {
    clearTimeout(timeoutId)
    // Offline or timeout — serve GET from cache with a synthetic Response
    if (method === 'GET') {
      const cached = await offlineDb.get(path)
      if (cached !== null) {
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Eolis-Cache': '1' },
        })
      }
    }
    throw new Error('offline')
  }
}

export async function apiUpload(path: string, formData: FormData): Promise<Response> {
  const token = getToken()
  return fetch(apiUrl(path), {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  })
}
