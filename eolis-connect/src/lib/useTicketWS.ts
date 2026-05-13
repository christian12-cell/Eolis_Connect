'use client'
import { useEffect, useRef, useCallback } from 'react'
import { getToken } from './api-client'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function wsUrl(ticketId: string, token: string): string {
  const base = API.replace(/^https?/, m => m === 'https' ? 'wss' : 'ws')
  return `${base}/ws/ticket/${ticketId}?token=${encodeURIComponent(token)}`
}

interface Options {
  onMessagesUpdated: () => void
  onTicketUpdated:   () => void
}

export function useTicketWS(ticketId: string, { onMessagesUpdated, onTicketUpdated }: Options) {
  const wsRef      = useRef<WebSocket | null>(null)
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deadRef    = useRef(false)

  const onMsg = useCallback(onMessagesUpdated, [])
  const onTkt = useCallback(onTicketUpdated, [])

  useEffect(() => {
    if (!ticketId) return
    deadRef.current = false

    function connect() {
      if (deadRef.current) return
      const token = getToken()
      if (!token) return

      const ws = new WebSocket(wsUrl(ticketId, token))
      wsRef.current = ws

      ws.onopen = () => {
        // Ping every 25s to keep connection alive on Railway
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping')
        }, 25_000)
      }

      ws.onmessage = (e) => {
        if (e.data === 'pong') return
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'messages_updated') onMsg()
          if (data.type === 'ticket_updated')   { onTkt(); onMsg() }
        } catch {}
      }

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current)
        if (!deadRef.current) {
          retryRef.current = setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      deadRef.current = true
      wsRef.current?.close()
      if (pingRef.current)  clearInterval(pingRef.current)
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [ticketId, onMsg, onTkt])
}
