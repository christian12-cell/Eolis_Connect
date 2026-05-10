// IndexedDB wrapper — cache API + pending action queue

const DB_NAME = 'eolis-offline'
const DB_VERSION = 1

export interface StoredFile {
  name: string
  mimeType: string
  data: ArrayBuffer
  source?: string
}

export interface PendingAction {
  id: string
  type: 'CREATE_TICKET' | 'SEND_MESSAGE' | 'AGENT_REPLY' | 'INTERNAL_NOTE'
  payload: Record<string, unknown>
  files?: StoredFile[]
  createdAt: number
  retries: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = ev => {
      const db = (ev.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('pending')) {
        const s = db.createObjectStore('pending', { keyPath: 'id' })
        s.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror  = () => reject(req.error)
  })
}

function run<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export const offlineDb = {
  // ── Cache ─────────────────────────────────────────────────────────────────

  async get(key: string): Promise<unknown> {
    try {
      const db = await open()
      const r = await run<{ key: string; data: unknown } | undefined>(db, 'cache', 'readonly', s => s.get(key))
      db.close()
      return r?.data ?? null
    } catch { return null }
  },

  async set(key: string, data: unknown): Promise<void> {
    try {
      const db = await open()
      await run(db, 'cache', 'readwrite', s => s.put({ key, data, ts: Date.now() }))
      db.close()
    } catch {}
  },

  // ── Pending queue ─────────────────────────────────────────────────────────

  async pending(): Promise<PendingAction[]> {
    try {
      const db = await open()
      return new Promise((resolve, reject) => {
        const t  = db.transaction('pending', 'readonly')
        const req = t.objectStore('pending').index('createdAt').getAll()
        req.onsuccess = () => { db.close(); resolve(req.result as PendingAction[]) }
        req.onerror   = () => { db.close(); reject(req.error) }
      })
    } catch { return [] }
  },

  async add(action: Omit<PendingAction, 'id' | 'createdAt' | 'retries'>): Promise<string> {
    const id = crypto.randomUUID()
    const full: PendingAction = { ...action, id, createdAt: Date.now(), retries: 0 }
    try {
      const db = await open()
      await run(db, 'pending', 'readwrite', s => s.put(full))
      db.close()
    } catch {}
    return id
  },

  async remove(id: string): Promise<void> {
    try {
      const db = await open()
      await run(db, 'pending', 'readwrite', s => s.delete(id))
      db.close()
    } catch {}
  },

  async bump(id: string): Promise<void> {
    try {
      const db = await open()
      const t = db.transaction('pending', 'readwrite')
      const s = t.objectStore('pending')
      const req = s.get(id)
      req.onsuccess = () => {
        const a = req.result as PendingAction | undefined
        if (a) { a.retries++; s.put(a) }
        db.close()
      }
    } catch {}
  },

  async hasPending(): Promise<boolean> {
    try {
      const db = await open()
      return new Promise(resolve => {
        const req = db.transaction('pending', 'readonly').objectStore('pending').count()
        req.onsuccess = () => { db.close(); resolve(req.result > 0) }
        req.onerror   = () => { db.close(); resolve(false) }
      })
    } catch { return false }
  },
}

export async function fileToStored(file: File, source?: string): Promise<StoredFile> {
  return { name: file.name, mimeType: file.type, data: await file.arrayBuffer(), source }
}
