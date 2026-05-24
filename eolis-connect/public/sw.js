const CACHE = 'eolis-v11'
const SHELL_URLS = [
  '/', '/offline.html',
  // Client
  '/fr/accueil',              '/en/accueil',
  '/fr/mes-demandes',         '/en/mes-demandes',
  '/fr/notifications',        '/en/notifications',
  '/fr/depenses',             '/en/depenses',
  '/fr/recharger',            '/en/recharger',
  '/fr/nouvelle-demande',     '/en/nouvelle-demande',
  '/fr/parametres',           '/en/parametres',
  '/fr/aide',                 '/en/aide',
  // Agent
  '/fr/agent/dashboard',      '/en/agent/dashboard',
  '/fr/agent/historique',     '/en/agent/historique',
  '/fr/agent/notifications',  '/en/agent/notifications',
  '/fr/agent/parametres',     '/en/agent/parametres',
  '/fr/agent/aide',           '/en/agent/aide',
  // Finance
  '/fr/finance/dashboard',    '/en/finance/dashboard',
  '/fr/finance/credits',      '/en/finance/credits',
  '/fr/finance/revenus',      '/en/finance/revenus',
  '/fr/finance/depenses',     '/en/finance/depenses',
  '/fr/finance/audit',        '/en/finance/audit',
  '/fr/finance/rapport',      '/en/finance/rapport',
  '/fr/finance/projections',  '/en/finance/projections',
  '/fr/finance/aide',         '/en/finance/aide',
  // Admin / Ops
  '/fr/admin/dashboard',      '/en/admin/dashboard',
  '/fr/admin/credits',        '/en/admin/credits',
  '/fr/admin/utilisateurs',   '/en/admin/utilisateurs',
  '/fr/admin/ia-couts',       '/en/admin/ia-couts',
  '/fr/ops/dashboard',        '/en/ops/dashboard',
  '/fr/ops/classement',       '/en/ops/classement',
  '/fr/ops/performances',     '/en/ops/performances',
  // Auth
  '/fr/login',                '/en/login',
]

self.addEventListener('install', e => {
  // cache.addAll() fails atomically if ANY url has Cache-Control: no-store (Next.js pages).
  // Use individual fetch + cache.put() so each url is cached independently.
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      await Promise.all(SHELL_URLS.map(url =>
        fetch(url, { cache: 'no-cache' })
          .then(res => { if (res.ok) return cache.put(url, res) })
          .catch(() => {})
      ))
      return self.skipWaiting()
    })
  )
})

self.addEventListener('activate', e => {
  // Migrate entries from old caches into the new cache before deleting them.
  // Next.js JS chunks are content-addressed (immutable) so they are safe to copy
  // across versions — this preserves all accumulated chunks and avoids breaking
  // offline for users who haven't opened the app since the last deployment.
  e.waitUntil((async () => {
    const keys = await caches.keys()
    const newCache = await caches.open(CACHE)
    for (const key of keys) {
      if (key === CACHE) continue
      try {
        const oldCache = await caches.open(key)
        const requests = await oldCache.keys()
        for (const req of requests) {
          const res = await oldCache.match(req)
          if (res) await newCache.put(req, res).catch(() => {})
        }
      } catch {}
      await caches.delete(key)
    }
    return self.clients.claim()
  })())
})

self.addEventListener('push', e => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'Eolis Connect', body: e.data.text() } }

  const ticketId = data.ticketId || null
  const url      = data.url || '/'

  // Le backend attend déjà 3s et vérifie si le message est lu avant d'envoyer.
  // Si le push arrive ici c'est qu'il est légitime — on l'affiche directement.
  e.waitUntil(
    self.registration.showNotification(data.title || 'Eolis Connect', {
      body:    data.body || '',
      icon:    '/logo.png',
      badge:   '/logo.png',
      data:    { url, ticketId },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) {
        return list[0].navigate(url).then(c => c && c.focus())
      }
      return clients.openWindow(url)
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

  if (e.data?.type === 'SHOW_SYNC_NOTIFICATION') {
    const { refs = [], sent = 0, lang = 'fr' } = e.data
    const en   = lang === 'en'
    let body
    if (refs.length === 1) {
      body = en
        ? `Your request ${refs[0]} has been sent successfully ✅`
        : `Votre dossier ${refs[0]} a été envoyé avec succès ✅`
    } else if (refs.length > 1) {
      body = en
        ? `Your requests ${refs.join(', ')} have been sent successfully ✅`
        : `Vos dossiers ${refs.join(', ')} ont été envoyés avec succès ✅`
    } else {
      body = en
        ? `${sent} action(s) synced successfully ✅`
        : `${sent} action(s) synchronisée(s) avec succès ✅`
    }
    self.registration.showNotification('Eolis Connect', {
      body, icon: '/logo.png', badge: '/logo.png',
      data: { url: `/${lang}/mes-demandes` }, vibrate: [200, 100, 200],
    })
  }
})

// ── Background Sync ───────────────────────────────────────────────────────────

self.addEventListener('sync', e => {
  if (e.tag === 'sync-pending') e.waitUntil(doBackgroundSync())
})

function swOpenDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('eolis-offline', 1)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function swGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function swGetAll(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('pending', 'readonly').objectStore('pending').index('createdAt').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function swRemove(db, id) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('pending', 'readwrite').objectStore('pending').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

function swInvalidateApiCache(db, key) {
  return new Promise(resolve => {
    const req = db.transaction('cache', 'readwrite').objectStore('cache').delete(key)
    req.onsuccess = () => resolve()
    req.onerror   = () => resolve()
  })
}

function swBump(db, id) {
  return new Promise(resolve => {
    const t   = db.transaction('pending', 'readwrite')
    const s   = t.objectStore('pending')
    const req = s.get(id)
    req.onsuccess = () => {
      const a = req.result
      if (a) { a.retries++; s.put(a) }
      resolve()
    }
    req.onerror = () => resolve()
  })
}

async function doBackgroundSync() {
  try {
    const db      = await swOpenDb()
    const tokRec  = await swGet(db, 'cache', 'auth_token')
    const baseRec = await swGet(db, 'cache', 'api_base')
    const langRec = await swGet(db, 'cache', 'user_lang')
    const token   = tokRec?.data
    const base    = baseRec?.data || 'https://eolisconnect-production-3392.up.railway.app'
    const lang    = langRec?.data || 'fr'
    const en      = lang === 'en'

    if (!token) { db.close(); return }

    const pending = await swGetAll(db)
    if (!pending.length) { db.close(); return }

    let sent = 0
    const refs = []

    for (const action of pending) {
      try {
        if (action.retries >= 3) { await swRemove(db, action.id); continue }
        let ok = false

        if (action.type === 'CREATE_TICKET') {
          const r = await fetch(`${base}/api/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(action.payload),
          })
          ok = r.ok
          if (ok) {
            const data = await r.json().catch(() => ({}))
            if (data.ref) refs.push(data.ref)
            // Invalidate ticket list cache so mes-demandes shows fresh data
            await swInvalidateApiCache(db, '/api/tickets').catch(() => {})
          }
        } else if (action.type === 'SEND_MESSAGE') {
          const { ticketId, ...body } = action.payload
          const r = await fetch(`${base}/api/tickets/${ticketId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
          })
          ok = r.ok
        } else if (action.type === 'AGENT_REPLY' || action.type === 'INTERNAL_NOTE') {
          const { ticketId, content, senderType } = action.payload
          const r = await fetch(`${base}/api/tickets/${ticketId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ content, senderType }),
          })
          ok = r.ok
        } else if (action.type === 'CREDIT_REQUEST') {
          const file = action.files?.[0]
          if (!file) { await swRemove(db, action.id); continue }
          const fd = new FormData()
          fd.append('amount_declared', String(action.payload.amountDeclared))
          fd.append('photo', new Blob([file.data], { type: file.mimeType }), file.name)
          // No Content-Type header — browser sets multipart/form-data boundary automatically
          const r = await fetch(`${base}/api/credits/request`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          })
          ok = r.ok
        }

        if (ok) { await swRemove(db, action.id); sent++ }
        else     { await swBump(db, action.id) }
      } catch { await swBump(db, action.id) }
    }

    db.close()

    if (sent > 0) {
      const title = 'Eolis Connect'
      let body
      if (refs.length === 1) {
        body = en
          ? `Your request ${refs[0]} has been sent successfully ✅`
          : `Votre dossier ${refs[0]} a été envoyé avec succès ✅`
      } else if (refs.length > 1) {
        body = en
          ? `Your requests ${refs.join(', ')} have been sent successfully ✅`
          : `Vos dossiers ${refs.join(', ')} ont été envoyés avec succès ✅`
      } else {
        body = en
          ? `${sent} action(s) synced successfully ✅`
          : `${sent} action(s) synchronisée(s) avec succès ✅`
      }
      self.registration.showNotification(title, {
        body, icon: '/logo.png', badge: '/logo.png',
        data: { url: `/${lang}/mes-demandes` }, vibrate: [200, 100, 200],
      })
    }
  } catch (err) {
    console.error('[sw:sync] failed:', err)
  }
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Only handle same-origin GET (skip API server)
  if (e.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // Navigation (page loads)
  // Two paths to avoid both the online-slow and offline-wait problems:
  //  • Offline (navigator.onLine === false): serve cache immediately, no network attempt
  //  • Online: network-first with no hard timeout (browser manages), cache on success
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      const fallback = async () => {
        // 1. Exact URL match (pre-cached shell pages + any page the user hard-navigated to)
        const cached = await caches.match(e.request)
        if (cached) return cached
        // 2. Parent URL — covers dynamic segments like /mes-demandes/[id], /agent/dossiers/[id]
        const segments = url.pathname.split('/').filter(Boolean)
        if (segments.length > 2) {
          const parent = '/' + segments.slice(0, -1).join('/')
          const parentCached = await caches.match(parent)
          if (parentCached) return parentCached
        }
        // 3. Locale shell as last-resort HTML (Next.js boots and role-based redirect takes over)
        const shellKey = url.pathname.startsWith('/en') ? '/en/accueil' : '/fr/accueil'
        const shell = await caches.match(shellKey) || await caches.match('/')
        if (shell) return shell
        // 4. Absolute last resort — offline page (only if shell was never cached)
        const offline = await caches.match('/offline.html')
        if (offline) return offline
        return new Response('Offline', { status: 503 })
      }

      // Definitely offline — skip network entirely for instant response
      if (self.navigator && !self.navigator.onLine) return fallback()

      // Online — network first, no hard timeout so slow connections still work
      try {
        const res = await fetch(e.request)
        // cache.put() ignores Cache-Control: no-store so Next.js pages are cached
        caches.open(CACHE).then(c => c.put(e.request, res.clone()).catch(() => {}))
        return res
      } catch {
        // Network error (offline mid-request, etc.)
        return fallback()
      }
    })())
    return
  }

  // Assets (_next/static, images, fonts) — stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request)
          .then(res => {
            if (res.ok) cache.put(e.request, res.clone()).catch(() => {})
            return res
          })
          .catch(() => null)
        // Serve cached immediately; update in background
        if (cached) { network.catch(() => {}); return cached }
        return network.then(r => r ?? new Response('', { status: 503 }))
      })
    )
  )
})
