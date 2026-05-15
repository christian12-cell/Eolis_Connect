'use client'

import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { syncPending } from '@/lib/offline-sync'

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (offline) return
    setSyncing(true)
    syncPending().finally(() => setSyncing(false))
  }, [offline])

  if (!offline && !syncing) return null

  return (
    <div className={`fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 py-2 px-4 text-white text-xs font-semibold transition-all ${
      offline ? 'bg-orange-500' : 'bg-emerald-500'
    }`}>
      {offline ? (
        <>
          <WifiOff size={13} />
          Mode hors ligne — vos actions seront envoyées dès la reconnexion
        </>
      ) : (
        <>
          <RefreshCw size={13} className="animate-spin" />
          Reconnecté — synchronisation en cours…
        </>
      )}
    </div>
  )
}
