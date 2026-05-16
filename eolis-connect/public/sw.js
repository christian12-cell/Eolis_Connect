const CACHE = 'eolis-v4'
const SHELL_URLS = ['/', '/fr/accueil', '/en/accueil']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  // Delete old cache versions
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'Eolis Connect', body: e.data.text() } }

  const ticketId = data.ticketId || null
  const url      = data.url || '/'

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Si le user est déjà sur la conversation en question → pas de notif
      if (ticketId) {
        const alreadyThere = list.some(c => c.visibilityState === 'visible' && c.url.includes(ticketId))
        if (alreadyThere) return
      }
      return self.registration.showNotification(data.title || 'Eolis Connect', {
        body:    data.body || '',
        icon:    '/logo.png',
        badge:   '/logo.png',
        data:    { url, ticketId },
        vibrate: [200, 100, 200],
      })
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

// Ferme les notifs affichées pour un ticket quand le user ouvre la conversation
self.addEventListener('message', e => {
  if (e.data?.type === 'CLOSE_NOTIFICATIONS' && e.data.ticketId) {
    self.registration.getNotifications().then(notifs => {
      notifs.forEach(n => {
        if (n.data?.ticketId === e.data.ticketId) n.close()
      })
    })
  }
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Only handle same-origin GET (skip API server)
  if (e.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        // Always fetch from network to keep cache fresh
        const network = fetch(e.request)
          .then(res => {
            if (res.ok) cache.put(e.request, res.clone())
            return res
          })
          .catch(() => null)

        // Navigation (page loads): network first, cache fallback, then app shell
        if (e.request.mode === 'navigate') {
          return network.then(r => r ?? cached)
            .then(r => r ?? caches.open(CACHE).then(c => c.match('/')))
            .then(r => r ?? new Response('Offline', { status: 503 }))
        }

        // Assets (_next/static, images, fonts): cache first for speed
        return cached ?? network.then(r => r ?? new Response('', { status: 503 }))
      })
    )
  )
})
