import { offlineDb, PendingAction } from './offline-db'
import { apiFetch, apiUpload, apiUrl, getToken } from './api-client'

async function uploadFiles(ticketId: string, files: NonNullable<PendingAction['files']>, messageId?: string) {
  if (!files.length) return
  const token = getToken()
  const fd = new FormData()
  for (const sf of files) fd.append('files', new Blob([sf.data], { type: sf.mimeType }), sf.name)
  const url = messageId
    ? apiUrl(`/api/tickets/${ticketId}/attachments?message_id=${messageId}`)
    : apiUrl(`/api/tickets/${ticketId}/attachments`)
  await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  }).catch(() => {})
}

const MAX_RETRIES = 3

async function execute(action: PendingAction): Promise<string | null> {
  if (action.type === 'CREATE_TICKET') {
    const res = await apiFetch('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(action.payload),
    })
    if (!res.ok) throw new Error('create_ticket_failed')
    const ticket = await res.json()
    await offlineDb.set('/api/tickets', null)

    // Upload queued files grouped by source
    if (action.files && action.files.length > 0 && ticket.id) {
      const bySource: Record<string, typeof action.files> = {}
      for (const f of action.files) {
        const key = f.source ?? ''
        if (!bySource[key]) bySource[key] = []
        bySource[key]!.push(f)
      }
      for (const [source, fls] of Object.entries(bySource)) {
        const fd = new FormData()
        for (const f of fls!) {
          fd.append('files', new Blob([f.data], { type: f.mimeType }), f.name)
        }
        const url = source
          ? `/api/tickets/${ticket.id}/attachments?source=${encodeURIComponent(source)}`
          : `/api/tickets/${ticket.id}/attachments`
        await apiUpload(url, fd).catch(() => {})
      }
    }

    return ticket.ref ?? null
  }

  if (action.type === 'SEND_MESSAGE') {
    const { ticketId, ...body } = action.payload as { ticketId: string; content: string }
    const res = await apiFetch(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('send_message_failed')
    return null
  }

  if (action.type === 'AGENT_REPLY') {
    const { ticketId, content, senderType } = action.payload as { ticketId: string; content: string; senderType: string }
    const res = await apiFetch(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, senderType }),
    })
    if (!res.ok) throw new Error('agent_reply_failed')
    return null
  }

  if (action.type === 'INTERNAL_NOTE') {
    const { ticketId, content } = action.payload as { ticketId: string; content: string }
    const res = await apiFetch(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, senderType: 'INTERNAL_NOTE' }),
    })
    if (!res.ok) throw new Error('internal_note_failed')
    const msg = await res.json().catch(() => null)
    if (action.files?.length && msg?.id) await uploadFiles(ticketId, action.files, msg.id)
    return null
  }

  if (action.type === 'CREDIT_REQUEST' && action.files && action.files.length > 0) {
    const { amountDeclared } = action.payload as { amountDeclared: number }
    const f = action.files[0]!
    const fd = new FormData()
    fd.append('amount_declared', String(amountDeclared))
    fd.append('photo', new Blob([f.data], { type: f.mimeType }), f.name)
    const res = await apiUpload('/api/credits/request', fd)
    if (!res.ok) throw new Error('credit_request_failed')
    return null
  }

  return null
}

export interface SyncResult {
  sent: number
  refs: string[]
}

let _syncing = false

export async function syncPending(): Promise<SyncResult> {
  if (_syncing) return { sent: 0, refs: [] }
  _syncing = true

  const actions = await offlineDb.pending()
  let sent = 0
  const refs: string[] = []

  for (const action of actions) {
    try {
      const ref = await execute(action)
      await offlineDb.remove(action.id)
      sent++
      if (ref) refs.push(ref)
    } catch {
      if (action.retries >= MAX_RETRIES) {
        await offlineDb.remove(action.id) // abandon after too many retries
      } else {
        await offlineDb.bump(action.id)
      }
    }
  }

  _syncing = false

  if (sent > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('eolis-sync-done'))
  }

  return { sent, refs }
}
