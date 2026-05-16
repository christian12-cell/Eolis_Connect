import { apiUrl, getToken } from './api-client'

const VAPID_KEY_LS = 'eolis_vapid_pk'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(apiUrl('/api/push/vapid-public-key'))
    const data = await res.json()
    return data.publicKey || null
  } catch { return null }
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const publicKey = await getVapidPublicKey()
    if (!publicKey) return false

    const reg = await navigator.serviceWorker.ready

    // Si la clé VAPID a changé (ou localStorage vide = réinstall PWA), on unsubscribe d'abord
    const storedKey = localStorage.getItem(VAPID_KEY_LS)
    if (storedKey !== publicKey) {
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
    }

    let sub: PushSubscription
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    } catch {
      // Fallback : unsubscribe force puis retry (cas edge PWA réinstallée)
      const stale = await reg.pushManager.getSubscription()
      if (stale) await stale.unsubscribe()
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }

    localStorage.setItem(VAPID_KEY_LS, publicKey)

    const json = sub.toJSON()
    const token = getToken()
    if (!token) return false

    await fetch(apiUrl('/api/push/subscribe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }),
    })
    return true
  } catch { return false }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    const token = getToken()
    if (!token) return
    await fetch(apiUrl('/api/push/subscribe'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint }),
    })
  } catch {}
}

export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch { return false }
}
