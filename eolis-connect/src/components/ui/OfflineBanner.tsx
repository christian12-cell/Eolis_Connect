'use client'

import { useState, useEffect } from 'react'
import { syncPending } from '@/lib/offline-sync'

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const on  = () => { setOffline(false); syncPending().catch(() => {}) }
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return <div className="fixed top-0 inset-x-0 z-[9999] h-1 bg-amber-400" />
}
