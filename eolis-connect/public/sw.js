const CACHE = 'eolis-v10'
const SHELL_URLS = ['/', '/fr/accueil', '/en/accueil', '/offline.html']

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

  // Navigation (page loads) — cache fallback immédiat si réseau indisponible
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        }
        return res
      }).catch(async () => {
        // 1. Exact page cached
        const cached = await caches.match(e.request)
        if (cached) return cached
        // 2. App shell (/) — works if JS chunks are cached from a previous online visit
        const shell = await caches.match('/')
        if (shell) return shell
        // 3. Static offline page — no JS dependency, always works
        const offline = await caches.match('/offline.html')
        if (offline) return offline
        return new Response('Offline', { status: 503 })
      })
    )
    return
  }

  // Assets (_next/static, images, fonts) — cache first pour la vitesse
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request)
          .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res })
          .catch(() => null)
        return cached ?? network.then(r => r ?? new Response('', { status: 503 }))
      })
    )
  )
})
