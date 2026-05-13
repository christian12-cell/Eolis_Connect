const CACHE = 'eolis-v3'
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
