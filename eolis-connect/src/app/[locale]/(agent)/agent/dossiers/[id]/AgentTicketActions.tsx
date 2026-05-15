'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send, Lock, UserCheck, CheckCircle, Paperclip, Upload,
  X, FileText, Download, Loader2, Plus, MessageSquare, Trash2,
} from 'lucide-react'
import { apiFetch, apiUpload, getToken, apiUrl } from '@/lib/api-client'
import { useTicketWS } from '@/lib/useTicketWS'
import { offlineDb, fileToStored } from '@/lib/offline-db'
import { formatDate } from '@/lib/utils'
import { DocCardRow } from '@/components/ui/DocCard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawMessage {
  id: string
  senderId: string
  senderType: string
  content: string
  documentDescription?: string | null
  sender?: { firstName: string; lastName: string; role: string } | null
  createdAt: string
  isRead: boolean
  isDeleted?: boolean
}

interface Props {
  ticketId: string
  ticketRef: string
  ticketStatus: string
  agentId: string | null
  currentAgentId: string
  currentAgentName: string
  currentAgentRole: string
  clientPhone: string | null
  attachments: any[]
  locale: string
}

type Mode = 'reply' | 'docrequest' | 'finalize'
type Tab  = 'client' | 'internal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function staffBubbleClass(senderRole?: string) {
  if (senderRole === 'OPS_ADMIN')    return 'bg-[#4A8FC4] text-white'
  if (senderRole === 'SYSTEM_ADMIN') return 'bg-[#8B5A2B] text-white'
  return 'bg-[#1B3A5C] text-white'
}

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImg = file.type.startsWith('image/')
  const [url] = useState<string | null>(() => isImg ? URL.createObjectURL(file) : null)
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return (
    <div className="relative flex-shrink-0">
      {isImg && url ? (
        <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-white shadow-md">
          <img src={url} alt={file.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm max-w-[150px]">
          <FileText size={20} className="text-blue-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{file.name}</p>
            <p className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      )}
      <button onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 shadow flex items-center justify-center z-10">
        <X size={10} className="text-white" />
      </button>
    </div>
  )
}

function AttachmentBubble({ att, onDownload, dark, locale }: { att: any; onDownload: () => void; dark?: boolean; locale?: string }) {
  const isImg = att.mimeType?.startsWith('image/')
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const blobRef = useRef<string | null>(null)
  const isFr = locale !== 'en'
  useEffect(() => {
    if (!isImg) return
    const token = getToken()
    fetch(apiUrl(`/api/attachments/${att.id}/download`), {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    }).then(r => r.blob()).then(b => {
      const u = URL.createObjectURL(b)
      blobRef.current = u
      setImgSrc(u)
    }).catch(() => {})
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current) }
  }, [att.id, isImg])

  if (isImg) {
    return (
      <button onClick={onDownload} className="block rounded-xl overflow-hidden max-w-[200px] shadow-sm mt-1">
        {imgSrc
          ? <img src={imgSrc} alt={att.filename} className="max-w-full max-h-48 object-cover rounded-xl" />
          : (
            <div className={`rounded-xl overflow-hidden ${dark ? 'bg-white/20' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 size={13} className={`animate-spin flex-shrink-0 ${dark ? 'text-blue-200' : 'text-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${dark ? 'text-white' : 'text-gray-700'}`}>{att.filename}</p>
                  <p className={`text-[10px] ${dark ? 'text-blue-200' : 'text-gray-400'}`}>
                    {isFr ? 'Image · chargement...' : 'Image · loading...'}
                  </p>
                </div>
              </div>
              <div className={`h-1 ${dark ? 'bg-white/10' : 'bg-gray-200'}`}>
                <div className={`h-full w-2/5 ${dark ? 'bg-blue-300' : 'bg-blue-400'} animate-pulse rounded-full`} />
              </div>
            </div>
          )
        }
      </button>
    )
  }
  return (
    <button onClick={onDownload}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl mt-1 text-left transition-colors max-w-[200px] ${dark ? 'bg-white/15 hover:bg-white/25' : 'bg-black/8 hover:bg-black/12'}`}>
      <FileText size={18} className={dark ? 'text-blue-200 flex-shrink-0' : 'text-blue-500 flex-shrink-0'} />
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-medium truncate ${dark ? 'text-white' : 'text-gray-800'}`}>{att.filename}</p>
        {att.size && <p className={`text-[10px] ${dark ? 'text-blue-200' : 'text-gray-400'}`}>{(att.size / 1024).toFixed(1)} KB</p>}
      </div>
      <Download size={11} className={dark ? 'text-blue-200 flex-shrink-0' : 'text-gray-400 flex-shrink-0'} />
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentTicketActions({
  ticketId, ticketRef, ticketStatus,
  agentId, currentAgentId, currentAgentName, currentAgentRole,
  clientPhone, attachments: initialAttachments, locale,
}: Props) {
  const isFr = locale === 'fr'

  const [messages, setMessages]           = useState<RawMessage[]>([])
  const [attachments, setAttachments]     = useState<any[]>(initialAttachments)
  const [localStatus, setLocalStatus]     = useState(ticketStatus)
  const [localAgentId, setLocalAgentId]   = useState(agentId)
  const [chatTab, setChatTab]             = useState<Tab>('client')
  const [mode, setMode]                   = useState<Mode>('reply')
  const [text, setText]                   = useState('')
  const [docList, setDocList]             = useState<string[]>([''])
  const [finalText, setFinalText]         = useState('')
  const [finalFiles, setFinalFiles]       = useState<File[]>([])
  const [sending, setSending]             = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [takenByOther, setTakenByOther]   = useState(false)
  const [allStaff, setAllStaff]           = useState<any[]>([])
  const [mentionUsers, setMentionUsers]   = useState<any[]>([])

  interface FileUploadA {
    uid: string; file: File; previewUrl: string | null
    status: 'uploading' | 'done' | 'error'; attachmentId?: string
  }
  const [replyUploads, setReplyUploads]       = useState<FileUploadA[]>([])
  const [internalUploads, setInternalUploads] = useState<FileUploadA[]>([])

  const bottomRef             = useRef<HTMLDivElement>(null)
  const chatScrollRef         = useRef<HTMLDivElement>(null)
  const fileRef               = useRef<HTMLInputElement>(null)
  const prevClientLenRef      = useRef(0)
  const prevInternalLenRef    = useRef(0)
  const [isClientScrolledUp,   setIsClientScrolledUp]   = useState(false)
  const [clientUnread,         setClientUnread]          = useState(0)
  const [isInternalScrolledUp, setIsInternalScrolledUp] = useState(false)
  const [internalUnread,       setInternalUnread]        = useState(0)

  const t = {
    reopen:        isFr ? 'Réouvrir le dossier' : 'Reopen ticket',
    reopenConfirm: isFr ? 'Confirmer la réouverture ?' : 'Confirm reopening?',
    deleted:       isFr ? 'Message supprimé' : 'Message deleted',
    deleteMsg:     isFr ? 'Supprimer ce message ?' : 'Delete this message?',
    deleteTooLate: isFr ? 'Délai de 5 min dépassé' : '5 min window expired',
    take:        isFr ? 'Prendre en charge' : 'Take ownership',
    finalize:    isFr ? 'Finaliser' : 'Finalize',
    docReq:      isFr ? 'Demander docs' : 'Request docs',
    replyPh:     isFr ? 'Répondre au client...' : 'Reply to client...',
    notePh:      isFr ? 'Note interne · tapez @ pour mentionner...' : 'Internal note · type @ to mention...',
    addDoc:      isFr ? 'Ajouter un document' : 'Add a document',
    docPh:       isFr ? 'Ex: BL original, Facture...' : 'E.g.: Original BL, Invoice...',
    sendDocReq:  isFr ? 'Envoyer la demande' : 'Send request',
    finalTitle:  isFr ? 'Réponse finale et clôture' : 'Final response & closure',
    finalSub:    isFr ? 'Ce message sera envoyé au client et le dossier sera clôturé.' : 'This message will be sent to the client and the ticket will be closed.',
    finalPh:     isFr ? 'Réponse finale pour le client...' : 'Final response for the client...',
    finalSend:   isFr ? '✅ Clôturer et envoyer' : '✅ Close & send',
    addFiles:    isFr ? 'Joindre des fichiers' : 'Attach files',
    cancel:      isFr ? 'Annuler' : 'Cancel',
    send:        isFr ? 'Envoyer' : 'Send',
    noClientMsg: isFr ? "Aucun échange avec le client" : 'No client messages yet',
    noInternMsg: isFr ? "Aucune note interne" : 'No internal notes yet',
    closed:      isFr ? 'Dossier clôturé — aucune action possible' : 'Ticket closed — no actions available',
    noteLabel:   isFr ? '🔒 NOTE INTERNE' : '🔒 INTERNAL NOTE',
    docLabel:    isFr ? '📎 DOCUMENTS REQUIS' : '📎 DOCUMENTS REQUIRED',
    finalLabel:  isFr ? '✅ RÉPONSE FINALE' : '✅ FINAL RESPONSE',
    docsLabel:   isFr ? '✅ Documents envoyés' : '✅ Documents sent',
    tabClient:   isFr ? 'Chat client' : 'Client chat',
    tabInternal: isFr ? 'Notes internes' : 'Internal notes',
  }

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    apiFetch(`/api/tickets/${ticketId}/messages`).then(r => r.json()).then(msgs => {
      if (Array.isArray(msgs)) {
        setMessages(msgs)
        prevClientLenRef.current   = msgs.filter((m: any) => m.senderType !== 'INTERNAL_NOTE').length
        prevInternalLenRef.current = msgs.filter((m: any) => m.senderType === 'INTERNAL_NOTE').length
      }
    }).catch(() => {})
    apiFetch('/api/users/staff/mentions').then(r => r.json()).then(staff => {
      if (Array.isArray(staff)) setAllStaff(staff)
    }).catch(() => {})
    apiFetch(`/api/tickets/${ticketId}/messages/mark-read`, { method: 'POST' }).catch(() => {})
  }, [ticketId])

  // WebSocket — real-time updates
  useTicketWS(ticketId, {
    onMessagesUpdated: () => {
      // Auto-mark notifications as read since agent is actively viewing the ticket
      apiFetch(`/api/tickets/${ticketId}/messages/mark-read`, { method: 'POST' }).catch(() => {})
      Promise.all([
        apiFetch(`/api/tickets/${ticketId}/messages`).then(r => r.json()),
        apiFetch(`/api/tickets/${ticketId}`).then(r => r.json()),
      ]).then(([msgs, tkt]) => {
        if (Array.isArray(msgs)) setMessages(prev => {
          const serverIds = new Set(msgs.map((m: any) => m.id))
          const prevById = new Map(prev.map(m => [m.id, m]))
          const mergedMsgs = msgs.map((m: any) => {
            const local = prevById.get(m.id) as any
            if (local?._localFiles?.length) return { ...m, _localFiles: local._localFiles }
            const pending = prev.find((p: any) =>
              p.pending && !serverIds.has(p.id) &&
              p.content === m.content && p.senderType === m.senderType &&
              (p as any)._localFiles?.length > 0
            )
            if (pending) return { ...m, _localFiles: (pending as any)._localFiles }
            return m
          })
          const stillPending = prev.filter(m => (m as any).pending && !serverIds.has(m.id))
          return [...mergedMsgs, ...stillPending]
        })
        if (tkt?.attachments) setAttachments(tkt.attachments)
      }).catch(() => {})
    },
    onTicketUpdated: () => {
      apiFetch(`/api/tickets/${ticketId}`).then(r => r.json()).then(tkt => {
        if (tkt?.attachments) setAttachments(tkt.attachments)
        if (tkt?.status) setLocalStatus(tkt.status)
        if (tkt?.agentId && tkt.agentId !== currentAgentId) setTakenByOther(true)
      }).catch(() => {})
    },
  })

  useEffect(() => {
    const iv = setInterval(() => {
      Promise.all([
        apiFetch(`/api/tickets/${ticketId}/messages`).then(r => r.json()),
        apiFetch(`/api/tickets/${ticketId}`).then(r => r.json()),
      ]).then(([msgs, tkt]) => {
        if (Array.isArray(msgs)) {
          setMessages(prev => {
            const serverIds = new Set(msgs.map((m: any) => m.id))
            const prevById = new Map(prev.map(m => [m.id, m]))
            const mergedMsgs = msgs.map((m: any) => {
              const local = prevById.get(m.id) as any
              return local?._localFiles?.length ? { ...m, _localFiles: local._localFiles } : m
            })
            const stillPending = prev.filter(m => (m as any).pending && !serverIds.has(m.id))
            return [...mergedMsgs, ...stillPending]
          })
        }
        if (tkt?.attachments) setAttachments(tkt.attachments)
        // Detect if ticket was taken by another agent while we were on the page
        if (tkt?.agentId && tkt.agentId !== currentAgentId && localAgentId !== tkt.agentId && !takenByOther) {
          setLocalAgentId(tkt.agentId)
          setLocalStatus(tkt.status)
          setTakenByOther(true)
        }
      }).catch(() => {})
    }, 8000)
    return () => clearInterval(iv)
  }, [ticketId, takenByOther, currentAgentId, localAgentId])

  useEffect(() => {
    const clientMsgs   = messages.filter(m => m.senderType !== 'INTERNAL_NOTE')
    const internalMsgs = messages.filter(m => m.senderType === 'INTERNAL_NOTE')
    const el = chatScrollRef.current
    const nearBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 150 : true

    // ── Client messages ──
    const prevC  = prevClientLenRef.current
    const newC   = clientMsgs.length - prevC
    prevClientLenRef.current = clientMsgs.length
    if (newC > 0) {
      const newMsgs = clientMsgs.slice(-newC)
      const myOwn   = newMsgs.some((m: any) => m.senderId === currentAgentId && m.pending)
      if (chatTab === 'client') {
        if (nearBottom || myOwn) {
          el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
          setClientUnread(0); setIsClientScrolledUp(false)
        } else {
          const n = newMsgs.filter((m: any) => m.senderId !== currentAgentId).length
          if (n > 0) { setIsClientScrolledUp(true); setClientUnread(p => p + n) }
        }
      } else if (!myOwn) {
        const n = newMsgs.filter((m: any) => m.senderId !== currentAgentId).length
        setClientUnread(p => p + n)
      }
    }

    // ── Internal notes ──
    const prevI  = prevInternalLenRef.current
    const newI   = internalMsgs.length - prevI
    prevInternalLenRef.current = internalMsgs.length
    if (newI > 0) {
      const newNotes = internalMsgs.slice(-newI)
      const myOwn    = newNotes.some((m: any) => m.senderId === currentAgentId && m.pending)
      if (chatTab === 'internal') {
        if (nearBottom || myOwn) {
          el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
          setInternalUnread(0); setIsInternalScrolledUp(false)
        } else {
          const n = newNotes.filter((m: any) => m.senderId !== currentAgentId).length
          if (n > 0) { setIsInternalScrolledUp(true); setInternalUnread(p => p + n) }
        }
      } else if (!myOwn) {
        const n = newNotes.filter((m: any) => m.senderId !== currentAgentId).length
        setInternalUnread(p => p + n)
      }
    }
  }, [messages, currentAgentId, chatTab])

  function handleAgentChatScroll() {
    const el = chatScrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    if (chatTab === 'client') {
      if (nearBottom) { setIsClientScrolledUp(false); setClientUnread(0) }
      else setIsClientScrolledUp(true)
    } else {
      if (nearBottom) { setIsInternalScrolledUp(false); setInternalUnread(0) }
      else setIsInternalScrolledUp(true)
    }
  }

  function scrollAgentToBottom() {
    const el = chatScrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    if (chatTab === 'client') { setIsClientScrolledUp(false); setClientUnread(0) }
    else { setIsInternalScrolledUp(false); setInternalUnread(0) }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const clientMessages   = messages.filter(m => m.senderType !== 'INTERNAL_NOTE')
  const internalMessages = messages.filter(m => m.senderType === 'INTERNAL_NOTE')
  const displayMessages  = chatTab === 'client' ? clientMessages : internalMessages

  const isAssignedToMe = localAgentId === currentAgentId
  const isUnassigned   = !localAgentId
  const isClosed       = localStatus === 'CLOSED' || localStatus === 'TREATED'
  const isAdmin        = currentAgentRole === 'SYSTEM_ADMIN' || currentAgentRole === 'OPS_ADMIN'
  const canAct         = (isAssignedToMe || isAdmin) && !isClosed
  // Admins can take over any open ticket not already theirs; agents only take unassigned PENDING ones
  const canTake        = !isClosed && (isUnassigned || (!isAssignedToMe && isAdmin))

  // True if there's a DOCUMENT_REQUEST with no DOCS_SUBMITTED after it
  const hasPendingDocRequest = messages.some((m, idx) => {
    if (m.senderType !== 'DOCUMENT_REQUEST') return false
    return !messages.slice(idx + 1).some(n => n.senderType === 'DOCS_SUBMITTED')
  })

  // ── Tab switching ─────────────────────────────────────────────────────────

  function switchTab(tab: Tab) {
    setChatTab(tab)
    setMode('reply')
    setText('')
    setMentionUsers([])
    // Reset unread + scroll state for the tab we're switching to
    if (tab === 'client') { setIsClientScrolledUp(false); setClientUnread(0) }
    else { setIsInternalScrolledUp(false); setInternalUnread(0) }
    setTimeout(() => {
      const el = chatScrollRef.current
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  // ── File download ─────────────────────────────────────────────────────────

  function downloadFile(att: any) {
    const token = getToken()
    fetch(apiUrl(`/api/attachments/${att.id}/download`), {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = att.filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    })
  }

  // ── @mention helpers ──────────────────────────────────────────────────────

  function handleInternalChange(val: string) {
    setText(val)
    const lastAt = val.lastIndexOf('@')
    if (lastAt !== -1) {
      const afterAt = val.slice(lastAt + 1)
      const spaceIdx = afterAt.search(/\s/)
      if (spaceIdx === -1 && afterAt.length <= 30) {
        const query = afterAt.toLowerCase()
        setMentionUsers(
          allStaff.filter(u =>
            u.username.toLowerCase().includes(query) ||
            u.firstName.toLowerCase().includes(query) ||
            u.lastName.toLowerCase().includes(query)
          ).slice(0, 5)
        )
        return
      }
    }
    setMentionUsers([])
  }

  function insertMention(user: any) {
    const lastAt = text.lastIndexOf('@')
    const afterAt = text.slice(lastAt + 1)
    const spaceIdx = afterAt.search(/\s/)
    const tail = spaceIdx === -1 ? '' : afterAt.slice(spaceIdx)
    setText(text.slice(0, lastAt) + `@${user.username} ` + tail)
    setMentionUsers([])
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleAgentFiles(files: File[], tab: Tab) {
    const setter = tab === 'client' ? setReplyUploads : setInternalUploads
    const newUploads: FileUploadA[] = files.map(file => ({
      uid: `fu-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      status: 'uploading' as const,
    }))
    setter(prev => [...prev, ...newUploads])
    newUploads.forEach(fu => {
      const fd = new FormData()
      fd.append('files', fu.file)
      apiUpload(`/api/tickets/${ticketId}/attachments?source=pre-upload`, fd)
        .then(r => r.json())
        .then(atts => setter(prev => prev.map(f => f.uid === fu.uid ? { ...f, status: 'done', attachmentId: atts[0]?.id } : f)))
        .catch(() => setter(prev => prev.map(f => f.uid === fu.uid ? { ...f, status: 'error' } : f)))
    })
  }

  function removeAgentFile(uid: string, tab: Tab) {
    const uploads = tab === 'client' ? replyUploads : internalUploads
    const setter  = tab === 'client' ? setReplyUploads : setInternalUploads
    const fu = uploads.find(f => f.uid === uid)
    if (fu) {
      if (fu.previewUrl) URL.revokeObjectURL(fu.previewUrl)
      if (fu.attachmentId) apiFetch(`/api/attachments/${fu.attachmentId}`, { method: 'DELETE' }).catch(() => {})
    }
    setter(prev => prev.filter(f => f.uid !== uid))
  }

  async function takeTicket() {
    setActionLoading('take')
    const res = await apiFetch(`/api/tickets/${ticketId}/take`, { method: 'PATCH' })
    if (res.ok) { setLocalStatus('IN_PROGRESS'); setLocalAgentId(currentAgentId) }
    setActionLoading(null)
  }

  async function deleteMessage(msgId: string) {
    if (!confirm(t.deleteMsg)) return
    const res = await apiFetch(`/api/tickets/${ticketId}/messages/${msgId}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, content: '' } : m))
    } else {
      const data = await res.json().catch(() => ({}))
      if (data.detail === 'delete_too_late') alert(t.deleteTooLate)
    }
  }

  async function reopenTicket() {
    if (!confirm(t.reopenConfirm)) return
    setActionLoading('reopen')
    const res = await apiFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    })
    if (res.ok) { setLocalStatus('IN_PROGRESS') }
    setActionLoading(null)
  }

  async function adminCloseTicket() {
    if (!confirm(isFr ? 'Clôturer ce dossier directement sans réponse finale ?' : 'Close this ticket directly without a final response?')) return
    setActionLoading('adminclose')
    const res = await apiFetch(`/api/tickets/${ticketId}/close`, { method: 'PATCH' })
    if (res.ok) { setLocalStatus('TREATED') }
    setActionLoading(null)
  }

  async function sendReply() {
    const uploads = chatTab === 'client' ? replyUploads : internalUploads
    const hasUploading = uploads.some(f => f.status === 'uploading')
    const noContent = !text.trim() && uploads.length === 0
    if (noContent || sending || hasUploading) return

    setSending(true)
    const senderType = chatTab === 'internal' ? 'INTERNAL_NOTE' : 'AGENT'
    const content = text.trim() || ' '
    const attachmentIds = uploads.filter(f => f.status === 'done' && f.attachmentId).map(f => f.attachmentId!)
    const previewData = uploads.map(fu => ({
      url: fu.previewUrl, filename: fu.file.name, size: fu.file.size, mimeType: fu.file.type,
    }))

    if (chatTab === 'client') setReplyUploads([])
    else setInternalUploads([])

    const tempId = `pending-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId, senderId: currentAgentId, senderType,
      content, sender: null, createdAt: new Date().toISOString(),
      isRead: false, pending: true, _previewData: previewData,
    } as any])

    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, senderType, attachmentIds: attachmentIds.length ? attachmentIds : undefined }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages(prev => {
          // Replace temp, then dedup: WS may have added the real msg before POST response arrived
          const replaced = prev.map(m => m.id === tempId ? { ...msg, _previewData: previewData } : m)
          const seen = new Set<string>()
          return replaced.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true })
        })
        const tkt = await apiFetch(`/api/tickets/${ticketId}`).then(r => r.json()).catch(() => null)
        if (tkt?.attachments) {
          setAttachments(tkt.attachments)
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, _previewData: [] } : m))
        }
      }
    } catch {
      await offlineDb.add({ type: chatTab === 'internal' ? 'INTERNAL_NOTE' : 'AGENT_REPLY', payload: { ticketId, content, senderType } })
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m } : m))
    }

    setText('')
    setMode('reply')
    setMentionUsers([])
    setSending(false)
  }

  async function sendDocRequest() {
    const valid = docList.filter(d => d.trim())
    if (!valid.length || sending) return
    setSending(true)
    const res = await apiFetch(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content: isFr ? `Documents requis : ${valid.join(', ')}` : `Documents required: ${valid.join(', ')}`,
        senderType: 'DOCUMENT_REQUEST',
        documentDescription: JSON.stringify(valid),
      }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      setDocList([''])
      setMode('reply')
    }
    setSending(false)
  }

  async function sendFinalResponse() {
    if (!finalText.trim() || sending) return
    setSending(true)
    const res = await apiFetch(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: finalText, senderType: 'FINAL_RESPONSE' }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      if (finalFiles.length > 0 && msg.id) {
        const fd = new FormData()
        finalFiles.forEach(f => fd.append('files', f))
        const up = await apiUpload(`/api/tickets/${ticketId}/attachments?message_id=${msg.id}`, fd).catch(() => null)
        if (up?.ok) {
          const newAtts = await up.json().catch(() => [])
          setAttachments(prev => [...prev, ...newAtts])
        }
      }
      setFinalText('')
      setFinalFiles([])
      setMode('reply')
      setLocalStatus('CLOSED')
    }
    setSending(false)
  }

  // ── Message rendering ─────────────────────────────────────────────────────

  function renderMessage(msg: RawMessage) {
    const isClient    = msg.senderType === 'CLIENT'
    const isDocsSubmit = msg.senderType === 'DOCS_SUBMITTED'
    const senderName  = msg.sender ? `${msg.sender.firstName} ${msg.sender.lastName}` : currentAgentName
    const senderRole  = msg.sender?.role ?? 'AGENT'

    if (msg.senderType === 'INTERNAL_NOTE') {
      const isMine = msg.senderId === currentAgentId
      const roleColor = senderRole === 'OPS_ADMIN' ? 'text-purple-700 border-purple-200 bg-purple-50'
        : senderRole === 'SYSTEM_ADMIN' ? 'text-red-700 border-red-200 bg-red-50'
        : 'text-amber-700 border-amber-200 bg-amber-50'
      const noteAtts = attachments.filter(a => a.messageId === msg.id)
      const highlightMentions = (content: string) =>
        content.split(/(@\w+)/g).map((part, i) =>
          part.startsWith('@')
            ? <span key={i} className="font-bold bg-white/60 rounded px-0.5">{part}</span>
            : part
        )
      return (
        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[82%] border px-4 py-2.5 ${roleColor} ${
            isMine ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm'
          }`}>
            {!isMine && (
              <p className="text-[10px] font-bold mb-1 uppercase tracking-wide">
                🔒 {senderName}
              </p>
            )}
            {isMine && (
              <p className="text-[10px] font-bold mb-1 uppercase tracking-wide opacity-60">🔒</p>
            )}
            <p className="text-sm leading-relaxed">{highlightMentions(msg.content.trim())}</p>
            {noteAtts.length > 0 && (
              <div className="mt-2 pt-2 border-t border-current/20">
                <DocCardRow attachments={noteAtts} onDownload={att => downloadFile(att)} size="sm" />
              </div>
            )}
            <p className={`text-[10px] opacity-60 mt-1 ${isMine ? 'text-right' : ''}`}>{formatDate(msg.createdAt, locale)}</p>
          </div>
        </div>
      )
    }

    if (msg.senderType === 'DOCUMENT_REQUEST') {
      let docs: string[] = []
      try { docs = JSON.parse(msg.documentDescription ?? '[]') } catch { docs = [] }
      const msgIdx = messages.indexOf(msg)
      const isAnswered = messages.slice(msgIdx + 1).some(n => n.senderType === 'DOCS_SUBMITTED')
      return (
        <div key={msg.id} className="flex justify-center">
          <div className="max-w-[85%] w-full bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide flex items-center gap-1">
                <Paperclip size={10} /> {t.docLabel}
              </p>
              {isAnswered ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle size={9} /> {isFr ? 'Répondu' : 'Answered'}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {isFr ? '⏳ En attente' : '⏳ Pending'}
                </span>
              )}
            </div>
            {docs.length > 0
              ? <ul className="space-y-1 mb-2">{docs.map((d, i) => (
                  <li key={i} className={`text-sm flex items-center gap-1.5 ${isAnswered ? 'text-orange-400 line-through' : 'text-orange-800'}`}>
                    <span className="text-orange-400 font-bold flex-shrink-0">{i + 1}.</span> {d}
                  </li>
                ))}</ul>
              : <p className="text-sm text-orange-800 mb-2">{msg.content}</p>
            }
            <p className="text-[10px] text-orange-400">{formatDate(msg.createdAt, locale)}</p>
          </div>
        </div>
      )
    }

    if (msg.senderType === 'FINAL_RESPONSE') {
      const finalAtts = attachments.filter(a => a.messageId === msg.id)
      return (
        <div key={msg.id} className="flex justify-center w-full">
          <div className="max-w-[90%] w-full border-2 border-emerald-400 rounded-xl overflow-hidden">
            <div className="bg-emerald-500 px-4 py-2 flex items-center gap-2">
              <CheckCircle size={14} className="text-white" />
              <p className="text-[10px] font-bold text-white uppercase">{t.finalLabel}</p>
              <span className="ml-auto text-[10px] text-emerald-100">{senderName}</span>
            </div>
            <div className="bg-emerald-50 px-4 py-3">
              <p className="text-sm text-emerald-900 leading-relaxed">{msg.content}</p>
              {finalAtts.length > 0 && (
                <div className="mt-3 pt-2 border-t border-emerald-200">
                  <DocCardRow attachments={finalAtts} onDownload={att => downloadFile(att)} size="sm" />
                </div>
              )}
              <p className="text-[10px] text-emerald-500 mt-2">{formatDate(msg.createdAt, locale)}</p>
            </div>
          </div>
        </div>
      )
    }

    if (isDocsSubmit) {
      const atts = attachments.filter(a => a.messageId === msg.id)
      return (
        <div key={msg.id} className="flex justify-start">
          <div className="max-w-[85%] bg-teal-50 border border-teal-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
            <p className="text-[10px] font-bold text-teal-600 mb-1.5 flex items-center gap-1">
              <CheckCircle size={10} /> {t.docsLabel}
            </p>
            {atts.length > 0 && <DocCardRow attachments={atts} onDownload={att => downloadFile(att)} size="sm" />}
            <p className="text-[10px] text-teal-400 mt-2">{formatDate(msg.createdAt, locale)}</p>
          </div>
        </div>
      )
    }

    // Normal CLIENT / AGENT message
    const isPending   = (msg as any).pending === true
    const isMine      = msg.senderId === currentAgentId
    const withinLimit = !isPending && (Date.now() - new Date(msg.createdAt).getTime()) < 5 * 60 * 1000
    const canDelete   = isMine && withinLimit && !msg.isDeleted

    if (msg.isDeleted) {
      return (
        <div key={msg.id} className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
          <div className="px-4 py-2 rounded-2xl text-xs text-gray-400 italic border border-dashed border-gray-200">
            🚫 {t.deleted}
          </div>
        </div>
      )
    }

    const msgAtts = attachments.filter((a: any) => a.messageId === msg.id)
    const previewData: any[] = (msg as any)._previewData ?? []
    const showLocalPreview = previewData.length > 0 && msgAtts.length === 0
    const showAttachmentPlaceholder = !showLocalPreview && msgAtts.length === 0 && (msg as any).attachmentCount > 0

    return (
      <div key={msg.id} className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
        <div className={`max-w-[75%] flex flex-col gap-1 ${isClient ? 'items-start' : 'items-end'} ${isPending ? 'opacity-60' : ''}`}>
          <span className="text-[10px] text-gray-400 px-1">{senderName}</span>
          <div className="relative group">
            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              isClient ? 'bg-[#D6E7F5] text-gray-900 rounded-tl-sm' : `${staffBubbleClass(senderRole)} rounded-tr-sm`
            }`}>
              {msg.content.trim() !== '' && msg.content !== ' ' && <p>{msg.content}</p>}
              {msgAtts.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {msgAtts.map((att: any) => (
                    <AttachmentBubble key={att.id} att={att} onDownload={() => downloadFile(att)} dark={!isClient} locale={locale} />
                  ))}
                </div>
              )}
              {showLocalPreview && (
                <div className="flex flex-col gap-1 mt-1">
                  {previewData.map((pd: any, i: number) => pd.url ? (
                    <img key={i} src={pd.url} alt={pd.filename} className="max-w-full max-h-48 object-cover rounded-xl" />
                  ) : (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isClient ? 'bg-white/25 border border-white/30' : 'bg-black/8'}`}>
                      <FileText size={16} className={isClient ? 'text-blue-100 flex-shrink-0' : 'text-blue-500 flex-shrink-0'} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium truncate ${isClient ? 'text-white' : 'text-gray-800'}`}>{pd.filename}</p>
                        <p className={`text-[10px] ${isClient ? 'text-blue-200' : 'text-gray-400'}`}>{(pd.size/1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showAttachmentPlaceholder && (
                <p className={`text-[10px] italic mt-1 ${isClient ? 'text-gray-500' : 'text-blue-200'}`}>
                  📎 {isFr ? 'Ce message contient un document — il apparaîtra dès que possible.' : 'This message has an attached document — it will appear shortly.'}
                </p>
              )}
            </div>
            {canDelete && (
              <button
                onClick={() => deleteMessage(msg.id)}
                className={`absolute -top-1.5 ${isClient ? 'right-0 -mr-6' : 'left-0 -ml-6'} opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-red-100 flex items-center justify-center`}>
                <Trash2 size={10} className="text-red-500" />
              </button>
            )}
          </div>
          <span className="text-[10px] text-gray-400 px-1 flex items-center gap-1">
            {isPending ? '⏱ En attente...' : formatDate(msg.createdAt, locale)}
            {isMine && !isPending && msg.isRead && (
              <span className="font-medium">{isFr ? '· Lu' : '· Read'}</span>
            )}
          </span>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col relative" style={{ height: '650px' }}>

      {/* ── Popup double prise en charge ── */}
      {takenByOther && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <UserCheck size={28} className="text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">
              {isFr ? 'Dossier pris en charge' : 'Ticket taken'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {isFr
                ? "Ce dossier vient d'être pris en charge par un autre agent. Veuillez retourner à la liste des dossiers."
                : 'This ticket has just been taken by another agent. Please go back to the ticket list.'}
            </p>
            <button
              onClick={() => window.history.back()}
              className="w-full py-3 rounded-xl bg-[#1B3A5C] text-white font-bold text-sm"
            >
              {isFr ? 'Retour aux dossiers' : 'Back to tickets'}
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex flex-shrink-0 border-b border-gray-100">
        <button onClick={() => switchTab('client')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 ${
            chatTab === 'client'
              ? 'border-[#1B3A5C] text-[#1B3A5C]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}>
          <MessageSquare size={14} />
          {t.tabClient}
          {clientMessages.length > 0 && (
            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
              chatTab === 'client' ? 'bg-[#1B3A5C]/10 text-[#1B3A5C]' : 'bg-gray-100 text-gray-500'
            }`}>
              {clientMessages.length}
            </span>
          )}
        </button>
        <button onClick={() => switchTab('internal')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 ${
            chatTab === 'internal'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}>
          <Lock size={14} />
          {t.tabInternal}
          {(internalMessages.length > 0 || internalUnread > 0) && (
            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
              chatTab === 'internal' ? 'bg-amber-100 text-amber-600' : internalUnread > 0 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {chatTab !== 'internal' && internalUnread > 0 ? internalUnread : internalMessages.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Action buttons (client tab only) ── */}
      {chatTab === 'client' && (localStatus === 'PENDING' || canAct) && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
          {canTake && (
            <button onClick={takeTicket} disabled={actionLoading === 'take'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B3A5C] text-white text-xs font-semibold hover:bg-[#152d47] disabled:opacity-60 transition-colors">
              {actionLoading === 'take' ? <Spinner /> : <UserCheck size={13} />}
              {isAdmin && !isUnassigned && !isAssignedToMe
                ? (isFr ? 'Reprendre le dossier' : 'Take over')
                : t.take}
            </button>
          )}
          {localStatus === 'IN_PROGRESS' && (isAssignedToMe || isAdmin) && (
            <button onClick={() => setMode(mode === 'finalize' ? 'reply' : 'finalize')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                mode === 'finalize'
                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}>
              <CheckCircle size={13} /> {t.finalize}
            </button>
          )}
          {isAdmin && localStatus === 'IN_PROGRESS' && (
            <button onClick={adminCloseTicket} disabled={actionLoading === 'adminclose'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 disabled:opacity-60 transition-colors">
              {actionLoading === 'adminclose' ? <Spinner /> : <X size={13} />}
              {isFr ? 'Clôturer (admin)' : 'Close (admin)'}
            </button>
          )}
          {canAct && (
            <button
              onClick={() => !hasPendingDocRequest && setMode(mode === 'docrequest' ? 'reply' : 'docrequest')}
              disabled={hasPendingDocRequest}
              title={hasPendingDocRequest ? (isFr ? 'Une demande est déjà en attente de réponse' : 'A request is already pending a response') : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-colors ${
                hasPendingDocRequest
                  ? 'border-orange-200 text-orange-300 cursor-not-allowed'
                  : mode === 'docrequest'
                  ? 'bg-orange-100 text-orange-700 border-orange-300'
                  : 'border-orange-300 text-orange-600 hover:bg-orange-50'
              }`}>
              <Paperclip size={13} />
              {hasPendingDocRequest
                ? (isFr ? 'En attente...' : 'Pending...')
                : t.docReq}
            </button>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={chatScrollRef} onScroll={handleAgentChatScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F5F7FA] relative">
        {/* Info banner — message deletion */}
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-[11px] text-blue-500">
          <span>ℹ️</span>
          <span>
            {chatTab === 'client'
              ? (isFr ? 'Survolez un message pour le supprimer (5 min max après envoi).' : 'Hover a message to delete it (within 5 min of sending).')
              : (isFr ? 'Notes internes : survolez pour supprimer (5 min max).' : 'Internal notes: hover to delete (within 5 min).')}
          </span>
        </div>
        {displayMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-sm">
              {chatTab === 'client' ? t.noClientMsg : t.noInternMsg}
            </p>
          </div>
        ) : displayMessages.map(renderMessage)}
        <div ref={bottomRef} />

        {/* Bandeau nouveaux messages */}
        {(chatTab === 'client' ? isClientScrolledUp && clientUnread > 0 : isInternalScrolledUp && internalUnread > 0) && (
          <button onClick={scrollAgentToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-[#1B3A5C] text-white text-xs font-semibold shadow-lg mx-auto w-fit">
            <span>↓</span>
            {chatTab === 'client' ? clientUnread : internalUnread} {isFr ? 'nouveau' : 'new'}{(chatTab === 'client' ? clientUnread : internalUnread) > 1 && isFr ? 'x' : ''}
          </button>
        )}
      </div>

      {/* Flèche scroll-to-bottom */}
      {(chatTab === 'client' ? isClientScrolledUp : isInternalScrolledUp) && (
        <button onClick={scrollAgentToBottom}
          className="absolute bottom-24 right-4 z-20 w-9 h-9 rounded-full bg-[#1B3A5C] shadow-lg flex items-center justify-center">
          {(chatTab === 'client' ? clientUnread : internalUnread) > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {(chatTab === 'client' ? clientUnread : internalUnread) > 9 ? '9+' : (chatTab === 'client' ? clientUnread : internalUnread)}
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M3 8l4 4 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* ── Input panels ── */}
      <div className="flex-shrink-0 border-t border-gray-100">

        {/* CLIENT TAB inputs */}
        {chatTab === 'client' && (
          <>
            {/* Finalize panel */}
            {mode === 'finalize' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-600" />
                  <p className="text-sm font-bold text-emerald-700">{t.finalTitle}</p>
                </div>
                <p className="text-xs text-gray-500">{t.finalSub}</p>
                <textarea value={finalText} onChange={e => setFinalText(e.target.value)}
                  placeholder={t.finalPh} rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
                <input ref={fileRef} type="file" multiple className="hidden"
                  onChange={e => setFinalFiles(Array.from(e.target.files ?? []))} />
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                    <Upload size={12} /> {t.addFiles}
                    {finalFiles.length > 0 && <span className="ml-1 font-bold text-emerald-600">({finalFiles.length})</span>}
                  </button>
                  {finalFiles.map((f, i) => (
                    <span key={i} className="flex items-center gap-1 text-[10px] bg-gray-100 rounded px-2 py-1">
                      {f.name}
                      <button onClick={() => setFinalFiles(prev => prev.filter((_, idx) => idx !== i))}>
                        <X size={10} className="text-gray-400 hover:text-red-500" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setMode('reply')}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                    {t.cancel}
                  </button>
                  <button onClick={sendFinalResponse} disabled={!finalText.trim() || sending}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                    {t.finalSend}
                  </button>
                </div>
              </div>
            )}

            {/* Document request panel */}
            {mode === 'docrequest' && (
              <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                <div className="flex items-center gap-2">
                  <Paperclip size={14} className="text-orange-600" />
                  <p className="text-sm font-bold text-orange-700">{t.docReq}</p>
                </div>
                <p className="text-xs text-gray-500">
                  {isFr ? "Listez chaque document. Le client aura un emplacement d'upload par document." : 'List each document. The client gets one upload slot per document.'}
                </p>
                <div className="space-y-2">
                  {docList.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-orange-500 w-5 flex-shrink-0">{i + 1}.</span>
                      <input value={doc}
                        onChange={e => setDocList(prev => prev.map((d, idx) => idx === i ? e.target.value : d))}
                        placeholder={t.docPh}
                        className="flex-1 px-3 py-2 rounded-xl border border-orange-200 bg-orange-50 text-sm focus:outline-none focus:border-orange-400" />
                      {docList.length > 1 && (
                        <button onClick={() => setDocList(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-gray-400 hover:text-red-500 flex-shrink-0">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setDocList(prev => [...prev, ''])}
                  className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium">
                  <Plus size={12} /> {t.addDoc}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => { setMode('reply'); setDocList(['']) }}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                    {t.cancel}
                  </button>
                  <button onClick={sendDocRequest} disabled={docList.every(d => !d.trim()) || sending}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors">
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {t.sendDocReq}
                  </button>
                </div>
              </div>
            )}

            {/* Reply input */}
            {mode === 'reply' && (
              <div className="px-4 py-3">
                {isClosed ? (
                  <div className="flex items-center justify-between py-1">
                    <p className="text-xs text-gray-400">{t.closed}</p>
                    {isAdmin && (
                      <button onClick={reopenTicket} disabled={actionLoading === 'reopen'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors">
                        {actionLoading === 'reopen' ? <Spinner /> : <MessageSquare size={13} />}
                        {t.reopen}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {replyUploads.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                        {replyUploads.map(fu => (
                          <div key={fu.uid} className="relative flex-shrink-0">
                            {fu.previewUrl
                              ? <div className="w-16 h-16 rounded-xl overflow-hidden border border-white shadow"><img src={fu.previewUrl} alt={fu.file.name} className={`w-full h-full object-cover ${fu.status==='uploading'?'opacity-60':''}`} />{fu.status==='uploading'&&<div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl"><Loader2 size={12} className="text-white animate-spin"/></div>}</div>
                              : <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-sm">{fu.status==='uploading'?<Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0"/>:<FileText size={13} className="text-blue-500 flex-shrink-0"/>}<span className="text-[10px] truncate max-w-[80px] text-gray-700">{fu.file.name}</span></div>
                            }
                            <button onClick={() => removeAgentFile(fu.uid,'client')} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center z-10"><X size={8} className="text-white"/></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 items-end">
                      <label className="flex-shrink-0 mb-2.5 text-gray-400 hover:text-[#1B3A5C] transition-colors cursor-pointer"
                        title={isFr ? 'Joindre un fichier' : 'Attach file'}>
                        <Paperclip size={18} />
                        <input type="file" multiple className="sr-only"
                          accept="image/*,application/pdf,.doc,.docx"
                          onChange={e => {
                            const files = Array.from(e.target.files ?? [])
                            if (files.length > 0) handleAgentFiles(files, 'client')
                            e.target.value = ''
                          }} />
                      </label>
                      <textarea value={text} onChange={e => setText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                        placeholder={t.replyPh} rows={2}
                        className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none focus:border-[#1B3A5C] resize-none transition-colors" />
                      <button onClick={sendReply} disabled={(!text.trim() && replyUploads.length === 0) || sending || replyUploads.some(f=>f.status==='uploading')}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#1B3A5C] text-white disabled:opacity-40 hover:bg-[#152d47] transition-colors flex-shrink-0">
                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* INTERNAL TAB input */}
        {chatTab === 'internal' && (
          <div className="px-4 py-3 bg-amber-50">
            <p className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold mb-2 uppercase tracking-wide">
              <Lock size={10} /> {isFr ? 'Staff uniquement · @ pour mentionner' : 'Staff only · @ to mention'}
            </p>
            <div className="relative">
              {/* @mention dropdown */}
              {mentionUsers.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-amber-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  {mentionUsers.map(u => (
                    <button key={u.id} onMouseDown={e => { e.preventDefault(); insertMention(u) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50 text-left transition-colors">
                      <div className="w-7 h-7 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">{u.firstName[0]}{u.lastName[0]}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">@{u.username}</p>
                        <p className="text-[10px] text-gray-400">{u.firstName} {u.lastName} · {u.role.replace(/_/g, ' ')}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* File previews */}
              {internalUploads.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 p-2 bg-amber-50 rounded-xl border border-amber-100">
                  {internalUploads.map(fu => (
                    <div key={fu.uid} className="relative flex-shrink-0">
                      {fu.previewUrl
                        ? <div className="w-14 h-14 rounded-xl overflow-hidden border border-white shadow"><img src={fu.previewUrl} alt={fu.file.name} className={`w-full h-full object-cover ${fu.status==='uploading'?'opacity-60':''}`}/>{fu.status==='uploading'&&<div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl"><Loader2 size={10} className="text-white animate-spin"/></div>}</div>
                        : <div className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-xl px-2 py-1.5">{fu.status==='uploading'?<Loader2 size={12} className="text-amber-400 animate-spin"/>:<FileText size={12} className="text-amber-500"/>}<span className="text-[10px] truncate max-w-[80px] text-gray-700">{fu.file.name}</span></div>
                      }
                      <button onClick={() => removeAgentFile(fu.uid,'internal')} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center z-10"><X size={8} className="text-white"/></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <label className="flex-shrink-0 mb-2.5 text-amber-500 hover:text-amber-600 transition-colors cursor-pointer"
                  title={isFr ? 'Joindre un fichier' : 'Attach file'}>
                  <Paperclip size={18} />
                  <input type="file" multiple className="sr-only"
                    onChange={e => {
                      const files = Array.from(e.target.files ?? [])
                      if (files.length > 0) handleAgentFiles(files, 'internal')
                      e.target.value = ''
                    }} />
                </label>
                <textarea value={text}
                  onChange={e => handleInternalChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                  onBlur={() => setTimeout(() => setMentionUsers([]), 150)}
                  placeholder={t.notePh} rows={2}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-amber-200 bg-white text-sm focus:outline-none focus:border-amber-400 resize-none transition-colors" />
                <button onClick={sendReply}
                  disabled={(!text.trim() && internalUploads.length === 0) || sending || internalUploads.some(f=>f.status==='uploading')}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500 text-white disabled:opacity-40 hover:bg-amber-600 transition-colors flex-shrink-0">
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
