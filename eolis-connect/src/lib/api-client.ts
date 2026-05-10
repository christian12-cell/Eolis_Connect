import { offlineDb } from './offline-db'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export const apiUrl = (path: string) => `${API}${path}`

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('eolis_token')
}

export function getUser(): any | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('eolis_user')
  return raw ? JSON.parse(raw) : null
}

export function saveSession(token: string, user: any) {
  localStorage.setItem('eolis_token', token)
  localStorage.setItem('eolis_user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('eolis_token')
  localStorage.removeItem('eolis_user')
  // Clear IndexedDB API cache so next login sees fresh data
  try {
    indexedDB.deleteDatabase('eolis-offline')
  } catch {}
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token  = getToken()
  const method = (options.method ?? 'GET').toUpperCase()

  try {
    const res = await fetch(apiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    // Cache successful GET responses for offline use
    if (res.ok && method === 'GET') {
      res.clone().json().then(data => offlineDb.set(path, data)).catch(() => {})
    }

    return res
  } catch {
    // Offline — serve GET from cache with a synthetic Response
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
