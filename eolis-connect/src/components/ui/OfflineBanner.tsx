'use client'

import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { offlineDb } from '@/lib/offline-db'
import { apiFetch, apiUpload, apiUrl, getToken } from '@/lib/api-client'

async function uploadStoredFiles(ticketId: string, files: NonNullable<import('@/lib/offline-db').PendingAction['files']>, messageId?: string) {
  if (!files.length) return
  const token = getToken()
  const fd = new FormData()
  for (const sf of files) {
    const blob = new Blob([sf.data], { type: sf.mimeType })
    fd.append('files', blob, sf.name)
  }
  const url = messageId
    ? apiUrl(`/api/tickets/${ticketId}/attachments?message_id=${messageId}`)
    : apiUrl(`/api/tickets/${ticketId}/attachments`)
  await fetch(url, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd,
  }).catch(() => {})
}

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
    let active = true

    async function flush() {
      const pending = await offlineDb.pending()
      if (!pending.length) return
      setSyncing(true)

      for (const action of pending) {
        if (!active) break

        try {
          if (action.type === 'SEND_MESSAGE') {
            const { ticketId, content } = action.payload as { ticketId: string; content: string }
            const r = await apiFetch(`/api/tickets/${ticketId}/messages`, {
              method: 'POST',
              body: JSON.stringify({ content }),
            })
            if (r.ok) {
              await offlineDb.remove(action.id)
              window.dispatchEvent(new CustomEvent('eolis-sync-done'))
            } else await offlineDb.bump(action.id)
          }

          else if (action.type === 'AGENT_REPLY') {
            const { ticketId, content, senderType } = action.payload as { ticketId: string; content: string; senderType: string }
            const r = await apiFetch(`/api/tickets/${ticketId}/messages`, {
              method: 'POST',
              body: JSON.stringify({ content, senderType }),
            })
            if (r.ok) {
              await offlineDb.remove(action.id)
              window.dispatchEvent(new CustomEvent('eolis-sync-done'))
            } else await offlineDb.bump(action.id)
          }

          else if (action.type === 'INTERNAL_NOTE') {
            const { ticketId, content } = action.payload as { ticketId: string; content: string }
            const r = await apiFetch(`/api/tickets/${ticketId}/messages`, {
              method: 'POST',
              body: JSON.stringify({ content, senderType: 'INTERNAL_NOTE' }),
            })
            if (r.ok) {
              const msg = await r.json().catch(() => null)
              if (action.files?.length && msg?.id) {
                await uploadStoredFiles(ticketId, action.files, msg.id)
              }
              await offlineDb.remove(action.id)
              window.dispatchEvent(new CustomEvent('eolis-sync-done'))
            } else await offlineDb.bump(action.id)
          }

          else if (action.type === 'CREATE_TICKET') {
            const r = await apiFetch('/api/tickets', {
              method: 'POST',
              body: JSON.stringify(action.payload),
            })
            if (r.ok) {
              const data = await r.json().catch(() => null)
              if (data?.id && action.files?.length) {
                await uploadStoredFiles(data.id, action.files)
              }
              await offlineDb.remove(action.id)
              window.dispatchEvent(new CustomEvent('eolis-sync-done'))
            } else await offlineDb.bump(action.id)
          }

        } catch {
          await offlineDb.bump(action.id)
        }
      }

      if (active) setSyncing(false)
    }

    flush()
    return () => { active = false }
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
