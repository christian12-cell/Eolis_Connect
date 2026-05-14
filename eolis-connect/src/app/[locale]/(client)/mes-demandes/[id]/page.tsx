'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft, Globe, Send, Star, Ship, Package, FileText,
  MessageCircle, Paperclip, Download, ChevronDown, Upload, CheckCircle,
  X, Loader2, Camera, Trash2, Mic, Zap,
} from 'lucide-react'
import { DocCardRow } from '@/components/ui/DocCard'
import { VoiceRecorder } from '@/components/ui/VoiceRecorder'
import { ScannerModal } from '@/components/scanner/ScannerModal'
import { getUser, apiFetch, apiUpload, getToken, apiUrl } from '@/lib/api-client'
import { useTicketWS } from '@/lib/useTicketWS'
import { offlineDb, fileToStored } from '@/lib/offline-db'
import { formatDate } from '@/lib/utils'

const STATUS_STYLE: Record<string, string> = {
  PENDING:     'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  TREATED:     'bg-emerald-100 text-emerald-700',
  CLOSED:      'bg-gray-100 text-gray-500',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ParsedContainer { qty: number; type: string; isoNumber?: string }
interface ParsedEquipment {
  isMulti: boolean
  sameVessel: boolean | null
  containers: ParsedContainer[]
}

function parseEquipmentType(raw: string): ParsedEquipment {
  if (!raw.startsWith('MULTI')) {
    return { isMulti: false, sameVessel: null, containers: [{ qty: 1, type: raw }] }
  }
  const sameVessel =
    raw.includes('même navire') || raw.includes('same vessel') ? true :
    raw.includes('navires distincts') || raw.includes('separate vessels') ? false :
    null
  const colonIdx = raw.indexOf(' : ')
  if (colonIdx === -1) return { isMulti: true, sameVessel, containers: [] }
  const containers = raw.slice(colonIdx + 3).split(' | ').map(part => {
    // support old format "2× 20 pieds [ISO]" and new format "20 pieds [ISO]"
    const m = part.match(/^(?:(\d+)×\s+)?(.+?)(?:\s+\[([^\]]+)\])?$/)
    if (!m) return { qty: 1, type: part }
    return { qty: m[1] ? parseInt(m[1]) : 1, type: m[2].trim(), isoNumber: m[3] || undefined }
  })
  return { isMulti: true, sameVessel, containers }
}

interface VesselDesc { name: string; description: string }

function parseMultiDescription(desc: string): VesselDesc[] | null {
  const regex = /(?:Navire|Vessel) \d+ — ([^:]+) :\n([\s\S]*?)(?=\n\n(?:Navire|Vessel) \d+|$)/g
  const matches = [...desc.matchAll(regex)]
  if (matches.length < 2) return null
  return matches.map(m => ({ name: m[1].trim(), description: m[2].trim() }))
}

interface VesselLogistics {
  shipLine: string | null
  shipName: string | null
  voyageNumber: string | null
  shipDate: string | null
  code: string | null
}

function parseVesselData(raw: string | null | undefined): VesselLogistics[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

function parseBLData(raw: string | null | undefined): any | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    // BL data is a plain object (not array) with these keys
    if (!Array.isArray(parsed) && typeof parsed === 'object' && ('pickup' in parsed || 'turnIn' in parsed || 'bookingItems' in parsed || 'turn_in' in parsed || 'booking_items' in parsed)) {
      return parsed
    }
    return null
  } catch { return null }
}

// ── Sub-components ────────────────────────────────────────────────────────────

// Preview d'un fichier local (avant ou pendant envoi)
function FilePreview({ file, onRemove, uploading }: { file: File; onRemove?: () => void; uploading?: boolean }) {
  const isImg = file.type.startsWith('image/')
  const [url] = useState<string | null>(() => isImg ? URL.createObjectURL(file) : null)
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  if (isImg && url) {
    return (
      <div className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 border-white shadow-md">
        <img src={url} alt={file.name} className={`w-full h-full object-cover ${uploading ? 'opacity-60' : ''}`} />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Loader2 size={16} className="text-white animate-spin" />
          </div>
        )}
        {onRemove && !uploading && (
          <button onClick={onRemove}
            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 shadow flex items-center justify-center">
            <X size={10} className="text-white" />
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="relative flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm max-w-[160px]">
      <FileText size={20} className="text-blue-500 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-800 truncate">{file.name}</p>
        <p className="text-[10px] text-gray-400">
          {uploading ? 'Envoi...' : `${(file.size / 1024).toFixed(1)} KB`}
        </p>
      </div>
      {uploading && <Loader2 size={12} className="text-gray-400 animate-spin flex-shrink-0" />}
      {onRemove && !uploading && (
        <button onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 shadow flex items-center justify-center">
          <X size={10} className="text-white" />
        </button>
      )}
    </div>
  )
}

// Preview d'une pièce jointe confirmée par le serveur
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
      <button onClick={onDownload} className="block rounded-xl overflow-hidden max-w-[220px] shadow mt-1 active:opacity-80">
        {imgSrc
          ? <img src={imgSrc} alt={att.filename} className="max-w-full max-h-52 object-cover rounded-xl" />
          : (
            <div className={`rounded-xl overflow-hidden ${dark ? 'bg-white/20' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Loader2 size={14} className={`animate-spin flex-shrink-0 ${dark ? 'text-blue-200' : 'text-blue-400'}`} />
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
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl mt-1 text-left active:opacity-70 transition-opacity max-w-[220px] ${
        dark
          ? 'bg-white/25 border border-white/30'
          : 'bg-white border border-gray-200 shadow-sm'
      }`}>
      <FileText size={20} className={dark ? 'text-blue-100 flex-shrink-0' : 'text-blue-500 flex-shrink-0'} />
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold truncate ${dark ? 'text-white' : 'text-gray-800'}`}>{att.filename}</p>
        {att.size && <p className={`text-[10px] mt-0.5 ${dark ? 'text-blue-200' : 'text-gray-400'}`}>{(att.size / 1024).toFixed(1)} KB</p>}
      </div>
      <Download size={13} className={dark ? 'text-blue-200 flex-shrink-0' : 'text-blue-400 flex-shrink-0'} />
    </button>
  )
}

function DossierSection({ title, icon, isOpen, onToggle, children }: {
  title: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-bold text-[#1B3A5C]">{title}</p>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
        />
      </button>
      {isOpen && <div className="border-t border-gray-100 px-4 pb-4 pt-3">{children}</div>}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TicketDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [ticketId, setTicketId] = useState('')
  const [user, setUser] = useState<any>(null)
  const [ticket, setTicket] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [premiumAccepted, setPremiumAccepted] = useState(false)
  const [showPremiumPopup, setShowPremiumPopup] = useState(false)
  const [creditsConsumed, setCreditsConsumed] = useState<number | null>(null)
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [ratingScore, setRatingScore] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)
  const [docSlots, setDocSlots] = useState<Record<string, (File | null)[]>>({})
  const [submittingDocs, setSubmittingDocs] = useState<string | null>(null)
  const [scanTarget, setScanTarget] = useState<{ msgId: string; slotIdx: number } | null>(null)
  interface FileUpload {
    uid: string
    file: File
    previewUrl: string | null
    status: 'uploading' | 'done' | 'error'
    attachmentId?: string
  }
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([])
  const [open, setOpen] = useState({ equip: true, log: true, desc: true, docs: true, bl: true })
  const messagesEndRef     = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const chatInnerRef       = useRef<HTMLDivElement>(null)
  const prevMsgLenRef      = useRef(0)
  const [isScrolledUp, setIsScrolledUp]           = useState(false)
  const [unreadWhileUp, setUnreadWhileUp]         = useState(0)
  const firstUnreadIdRef                           = useRef<string | null>(null)

  function toggle(k: keyof typeof open) {
    setOpen(prev => ({ ...prev, [k]: !prev[k] }))
  }

  useEffect(() => { params.then(p => { setLocale(p.locale); setTicketId(p.id) }) }, [params])
  useEffect(() => {
    setPremiumAccepted(localStorage.getItem('eolis_premium_accepted') === '1')
    setIsOnline(navigator.onLine)
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    if (!ticketId) return
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/login`); return }
    setUser(u)
    if (!ticketId) return
    loadData()
    apiFetch(`/api/ai-usage/ticket/${ticketId}`)
      .then(r => r.json())
      .then(d => { if ((d.totalCredits ?? 0) > 0) setCreditsConsumed(d.totalCredits) })
      .catch(() => {})
    apiFetch('/api/credits/balance')
      .then(r => r.json())
      .then(d => setCreditsRemaining(Math.round(d.creditsRemaining ?? 0)))
      .catch(() => {})
  }, [ticketId, locale])

  function refreshAiCost(creditsUsed: number, creditsLeft: number) {
    setCreditsRemaining(Math.round(creditsLeft))
    setCreditsConsumed(prev => (prev ?? 0) + Math.round(creditsUsed))
  }

  // WebSocket — real-time updates (messages + ticket status)
  useTicketWS(ticketId, {
    onMessagesUpdated: () => {
      if (!ticketId) return
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
            // Carry _localFiles from pending message with same content (WS fires before step 3)
            const pending = prev.find((p: any) =>
              p.pending && !serverIds.has(p.id) &&
              p.content === m.content && p.senderType === m.senderType &&
              (p as any)._localFiles?.length > 0
            )
            if (pending) return { ...m, _localFiles: (pending as any)._localFiles }
            return m
          })
          const stillPending = prev.filter((m: any) => {
            if (!m.pending) return false
            if (serverIds.has(m.id)) return false
            return !msgs.some((s: any) => s.content === m.content && s.senderType === m.senderType && Math.abs(new Date(s.createdAt).getTime() - new Date(m.createdAt).getTime()) < 120000)
          })
          return [...mergedMsgs, ...stillPending]
        })
        if (tkt?.id) setTicket(tkt)
      }).catch(() => {})
    },
    onTicketUpdated: () => {
      if (!ticketId) return
      apiFetch(`/api/tickets/${ticketId}`).then(r => r.json()).then(tkt => {
        if (tkt?.id) setTicket(tkt)
      }).catch(() => {})
    },
  })

  useEffect(() => {
    if (!ticketId) return
    const interval = setInterval(async () => {
      try {
        const [msgs, tkt] = await Promise.all([
          apiFetch(`/api/tickets/${ticketId}/messages`).then(r => r.json()),
          apiFetch(`/api/tickets/${ticketId}`).then(r => r.json()),
        ])
        // Merge: preserve optimistic (pending) messages until server confirms them
        if (Array.isArray(msgs)) {
          setMessages(prev => {
            const serverIds = new Set(msgs.map((m: any) => m.id))
            const prevById = new Map(prev.map(m => [m.id, m]))
            // Preserve _localFiles on server messages still uploading
            const mergedMsgs = msgs.map((m: any) => {
              const local = prevById.get(m.id) as any
              return local?._localFiles?.length ? { ...m, _localFiles: local._localFiles } : m
            })
            const stillPending = prev.filter((m: any) => {
              if (!m.pending) return false
              if (serverIds.has(m.id)) return false
              const confirmed = msgs.some((s: any) =>
                s.content === m.content &&
                s.senderType === m.senderType &&
                Math.abs(new Date(s.createdAt).getTime() - new Date(m.createdAt).getTime()) < 120000
              )
              return !confirmed
            })
            return [...mergedMsgs, ...stillPending]
          })
        }
        // Update ticket status in real-time (agent assignment, closure, etc.)
        if (tkt?.id) setTicket(tkt)
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [ticketId])

  useEffect(() => {
    const prev = prevMsgLenRef.current
    const newCount = messages.length - prev
    prevMsgLenRef.current = messages.length
    if (newCount <= 0) return
    const el = chatInnerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    const newMsgs = messages.slice(-newCount)
    const myOwn = newMsgs.some((m: any) => m.senderType === 'CLIENT' && m.pending)
    if (nearBottom || myOwn) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      setUnreadWhileUp(0)
      setIsScrolledUp(false)
    } else {
      const fromOthers = newMsgs.filter((m: any) => m.senderType !== 'CLIENT').length
      if (fromOthers > 0) {
        setIsScrolledUp(true)
        setUnreadWhileUp(p => p + fromOthers)
        if (!firstUnreadIdRef.current) firstUnreadIdRef.current = newMsgs[0]?.id ?? null
      }
    }
  }, [messages])

  function handleChatScroll() {
    const el = chatInnerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    if (nearBottom) {
      setIsScrolledUp(false)
      setUnreadWhileUp(0)
      firstUnreadIdRef.current = null
    } else {
      setIsScrolledUp(true)
    }
  }

  function scrollToBottom() {
    const el = chatInnerRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setIsScrolledUp(false)
    setUnreadWhileUp(0)
    firstUnreadIdRef.current = null
  }

  async function loadData() {
    try {
      const [tk, msgs] = await Promise.all([
        apiFetch(`/api/tickets/${ticketId}`).then(r => r.json()),
        apiFetch(`/api/tickets/${ticketId}/messages`).then(r => r.json()),
      ])
      setTicket(tk)
      const msgArray = Array.isArray(msgs) ? msgs : []
      setMessages(msgArray)
      prevMsgLenRef.current = msgArray.length
      apiFetch(`/api/tickets/${ticketId}/messages/mark-read`, { method: 'POST' }).catch(() => {})
    } catch {}
    setLoading(false)
  }

  function handleFilesSelected(files: File[]) {
    const newUploads: FileUpload[] = files.map(file => ({
      uid: `fu-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      status: 'uploading' as const,
    }))
    setFileUploads(prev => [...prev, ...newUploads])

    newUploads.forEach(fu => {
      const fd = new FormData()
      fd.append('files', fu.file)
      apiUpload(`/api/tickets/${ticketId}/attachments?source=pre-upload`, fd)
        .then(r => r.json())
        .then(atts => {
          setFileUploads(prev => prev.map(f =>
            f.uid === fu.uid ? { ...f, status: 'done', attachmentId: atts[0]?.id } : f
          ))
        })
        .catch(() => {
          setFileUploads(prev => prev.map(f =>
            f.uid === fu.uid ? { ...f, status: 'error' } : f
          ))
        })
    })
  }

  function removeFileUpload(uid: string) {
    const fu = fileUploads.find(f => f.uid === uid)
    if (fu) {
      if (fu.previewUrl) URL.revokeObjectURL(fu.previewUrl)
      if (fu.attachmentId) apiFetch(`/api/attachments/${fu.attachmentId}`, { method: 'DELETE' }).catch(() => {})
    }
    setFileUploads(prev => prev.filter(f => f.uid !== uid))
  }

  async function sendMessage() {
    const hasUploading = fileUploads.some(f => f.status === 'uploading')
    if ((!text.trim() && fileUploads.length === 0) || sending || hasUploading) return

    const content = text.trim() || ' '
    const doneUploads = fileUploads.filter(f => f.status === 'done' && f.attachmentId)
    const attachmentIds = doneUploads.map(f => f.attachmentId!)
    const previewData = fileUploads.map(fu => ({
      url: fu.previewUrl,
      filename: fu.file.name,
      size: fu.file.size,
      mimeType: fu.file.type,
    }))

    setSending(true)
    setText('')
    setFileUploads([])

    const tempId = `pending-${Date.now()}`
    const optimistic: any = {
      id: tempId,
      senderType: 'CLIENT',
      content,
      createdAt: new Date().toISOString(),
      sender: getUser(),
      pending: true,
      _previewData: previewData,
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const r = await apiFetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, attachmentIds: attachmentIds.length ? attachmentIds : undefined }),
      })
      if (r.ok) {
        const msg = await r.json()
        setMessages(prev => prev.map(m => m.id === tempId ? { ...msg, _previewData: previewData } : m))
        const tk = await apiFetch(`/api/tickets/${ticketId}`).then(res => res.json()).catch(() => null)
        if (tk) {
          setTicket(tk)
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, _previewData: [] } : m))
        }
      }
    } catch {
      await offlineDb.add({ type: 'SEND_MESSAGE', payload: { ticketId, content } })
    } finally {
      setSending(false)
    }
  }

  async function submitRating() {
    if (ratingScore === 0 || submittingRating) return
    setSubmittingRating(true)
    try {
      const r = await apiFetch(`/api/tickets/${ticketId}/ratings`, {
        method: 'POST',
        body: JSON.stringify({ score: ratingScore, comment: ratingComment || null }),
      })
      if (r.ok) setRatingSubmitted(true)
    } finally {
      setSubmittingRating(false)
    }
  }

  async function submitDocSlots(msgId: string) {
    const slots = docSlots[msgId]
    if (!slots || !slots.every(f => f !== null)) return
    setSubmittingDocs(msgId)
    try {
      // Create DOCS_SUBMITTED message first to get its ID
      const r = await apiFetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: locale === 'fr' ? 'Documents envoyés' : 'Documents submitted',
          senderType: 'DOCS_SUBMITTED',
        }),
      })
      if (r.ok) {
        const newMsg = await r.json()
        // Upload files linked to the DOCS_SUBMITTED message ID so agent can see thumbnails
        const fd = new FormData()
        slots.forEach(f => { if (f) fd.append('files', f) })
        await apiUpload(`/api/tickets/${ticketId}/attachments?message_id=${newMsg.id}`, fd).catch(() => {})
        setMessages(prev => [...prev, newMsg])
        setDocSlots(prev => { const n = { ...prev }; delete n[msgId]; return n })
        const tk = await apiFetch(`/api/tickets/${ticketId}`).then(res => res.json()).catch(() => null)
        if (tk) setTicket(tk)
      }
    } finally {
      setSubmittingDocs(null)
    }
  }

  function downloadFile(attachment: any) {
    const token = getToken()
    fetch(apiUrl(`/api/attachments/${attachment.id}/download`), {
      headers: { Authorization: `Bearer ${token ?? ''}` }
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  }

  if (loading || !user || !ticket) return null

  const isFr = locale === 'fr'
  const otherLocale = locale === 'fr' ? 'en' : 'fr'

  const statusLabel: Record<string, string> = {
    PENDING:     isFr ? 'En attente' : 'Pending',
    IN_PROGRESS: isFr ? 'En cours' : 'In progress',
    TREATED:     isFr ? 'Traité' : 'Treated',
    CLOSED:      isFr ? 'Clôturé' : 'Closed',
  }

  const canRate = (ticket.status === 'TREATED' || ticket.status === 'CLOSED')
    && !ticket.satisfactionRating
    && !ratingSubmitted
    && ticket.agentId
    && messages.some((m: any) => m.senderType === 'AGENT' || m.senderType === 'FINAL_RESPONSE')

  const parsedEquipment  = ticket.equipmentType ? parseEquipmentType(ticket.equipmentType) : null
  const parsedDesc       = ticket.description   ? parseMultiDescription(ticket.description) : null
  const vesselLogistics  = parseVesselData(ticket.vesselData)
  const blData           = parseBLData(ticket.vesselData)

  // Single vessel logistics (for simple/same-vessel tickets)
  const singleHasLog = ticket.shipLine || ticket.shipName || ticket.voyageNumber || ticket.shipDate || ticket.code
  const hasLogistics = singleHasLog || !!vesselLogistics

  function switchLocale() {
    router.push(window.location.pathname.replace(`/${locale}/`, `/${otherLocale}/`))
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}>

      {/* Premium consent overlay */}
      {showPremiumPopup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4">
          <div className="bg-[#0f172a] w-full max-w-md rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <h2 className="text-base font-bold text-white">
                  {isFr ? 'Fonctionnalités Premium' : 'Premium Features'}
                </h2>
                <p className="text-xs text-blue-200 mt-0.5">
                  {isFr
                    ? "Ces fonctionnalités avancées consomment des crédits premium."
                    : 'These advanced features consume premium credits.'}
                </p>
              </div>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">📄</span>
                <p className="text-sm font-bold text-white">
                  {isFr ? 'Analyse automatique de document' : 'Automatic document analysis'}
                </p>
              </div>
              <p className="text-xs text-blue-300 pl-7">50 crédits / {isFr ? 'extraction' : 'extraction'}</p>
              <p className="text-xs text-blue-100 pl-7">
                {isFr ? '→ Lit et structure votre BL automatiquement' : '→ Reads and structures your BL automatically'}
              </p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎙️</span>
                <p className="text-sm font-bold text-white">
                  {isFr ? 'Dictée vocale → Texte' : 'Voice dictation → Text'}
                </p>
              </div>
              <p className="text-xs text-blue-300 pl-7">10 crédits / min</p>
              <p className="text-xs text-blue-100 pl-7">
                {isFr ? "→ Parlez, le texte s'écrit automatiquement" : '→ Speak, the text writes itself'}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs font-bold text-white/60 uppercase tracking-wide mb-2">
                {isFr ? 'Estimation par dossier typique' : 'Estimate per typical file'}
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-blue-200">
                  <span>{isFr ? '1 extraction BL' : '1 BL extraction'}</span>
                  <span className="font-mono">≈ 0.30 FCFA</span>
                </div>
                <div className="flex justify-between text-blue-200">
                  <span>{isFr ? '2 min de dictée' : '2 min dictation'}</span>
                  <span className="font-mono">≈ 7.20 FCFA</span>
                </div>
                <div className="border-t border-white/10 pt-1 flex justify-between text-white font-bold">
                  <span>{isFr ? 'Total estimé' : 'Estimated total'}</span>
                  <span className="font-mono">70 crédits</span>
                </div>
              </div>
              <p className="text-[10px] text-blue-400 mt-2">
                {isFr ? '(1 crédit = 1 FCFA · recharge minimum 500 crédits)' : '(1 credit = 1 FCFA · min recharge 500 credits)'}
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded"
                onChange={e => {
                  if (e.target.checked) localStorage.setItem('eolis_premium_accepted', '1')
                  else localStorage.removeItem('eolis_premium_accepted')
                }} />
              <span className="text-xs text-blue-200">
                {isFr ? 'Ne plus afficher ce message' : "Don't show this again"}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowPremiumPopup(false)}
                className="py-3.5 rounded-2xl border border-white/30 text-white text-sm font-medium">
                {isFr ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setPremiumAccepted(true)
                  setShowPremiumPopup(false)
                }}
                className="py-3.5 rounded-2xl bg-white text-[#1B3A5C] text-sm font-bold">
                {isFr ? "J'ai compris →" : 'I understand →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner modal */}
      {scanTarget && (
        <ScannerModal
          isFr={isFr}
          onClose={() => setScanTarget(null)}
          onScan={file => {
            const { msgId } = scanTarget
            if (msgId === '__chat__') {
              setClientFiles(prev => [...prev, file])
            } else {
              setDocSlots(prev => {
                const slot = prev[msgId] ?? []
                const s = [...slot]
                s[scanTarget.slotIdx] = file
                return { ...prev, [msgId]: s }
              })
            }
            setScanTarget(null)
          }}
        />
      )}
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Image src="/bg-auth.jpg" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-[#0D1F33]/55" />
      </div>

      {/* Header */}
      <header className="flex-shrink-0 sticky top-0 z-20 bg-white/15 backdrop-blur-md border-b border-white/10"
        style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center h-14 px-4 gap-3 max-w-lg mx-auto">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors -ml-1">
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white font-mono">{ticket.ref}</p>
            <p className="text-[11px] text-blue-200 truncate">
              {ticket.category}{ticket.subcategory ? ` — ${ticket.subcategory}` : ''}
            </p>
          </div>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_STYLE[ticket.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {statusLabel[ticket.status] ?? ticket.status}
          </span>
          <button onClick={switchLocale}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors">
            <Globe size={13} />
            {otherLocale.toUpperCase()}
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-3">

          {/* ── Dossier hero card ── */}
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-[#1B3A5C] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-blue-300 mb-1 tracking-widest">{ticket.ref}</p>
                  <p className="text-white font-bold text-base leading-tight">{ticket.category}</p>
                  {ticket.subcategory && (
                    <p className="text-blue-200 text-sm mt-1">{ticket.subcategory}</p>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${STATUS_STYLE[ticket.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {statusLabel[ticket.status]}
                </span>
              </div>
            </div>
            <div className="bg-white px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">{formatDate(ticket.createdAt, locale)}</p>
              {ticket.agent ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#1B3A5C] flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">
                      {ticket.agent.firstName?.[0]}{ticket.agent.lastName?.[0]}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">{ticket.agent.firstName} {ticket.agent.lastName}</span>
                </div>
              ) : (
                <span className="text-xs text-gray-400 italic">{isFr ? 'Agent non assigné' : 'No agent yet'}</span>
              )}
            </div>
          </div>

          {/* ── Crédits consommés sur ce dossier ── */}
          {creditsConsumed !== null && creditsConsumed > 0 && (
            <div className="flex items-center gap-2.5 bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5">
              <Zap size={13} className="text-amber-300 flex-shrink-0" />
              <p className="text-xs text-blue-100 flex-1">
                {isFr ? 'Crédits consommés (ce dossier)' : 'Credits used (this file)'}
              </p>
              <p className="text-xs font-bold text-white font-mono">{creditsConsumed} crédits</p>
            </div>
          )}

          {/* ── Équipement ── */}
          {parsedEquipment && (
            <DossierSection
              title={isFr ? 'Équipement' : 'Equipment'}
              icon={<Package size={14} className="text-[#4A8FC4]" />}
              isOpen={open.equip}
              onToggle={() => toggle('equip')}
            >
              {!parsedEquipment.isMulti ? (
                <span className="inline-flex items-center bg-[#EDF1F7] text-[#1B3A5C] text-sm font-semibold px-3 py-1.5 rounded-xl">
                  {parsedEquipment.containers[0]?.type}
                </span>
              ) : (
                <div>
                  {parsedEquipment.containers.map((c, i) => (
                    <div key={i} className={`flex items-start gap-3 py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                      {c.qty > 1 && (
                        <div className="bg-[#1B3A5C] text-white text-xs font-bold px-2.5 py-1.5 rounded-lg min-w-[38px] text-center mt-0.5 flex-shrink-0">
                          {c.qty}×
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{c.type}</p>
                        {c.isoNumber && (
                          <span className="inline-block bg-gray-100 text-gray-600 font-mono text-[10px] px-2 py-0.5 rounded mt-1">
                            {c.isoNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {parsedEquipment.sameVessel !== null && (
                    <div className="pt-2.5 mt-0.5 border-t border-gray-100">
                      <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                        parsedEquipment.sameVessel ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {parsedEquipment.sameVessel
                          ? (isFr ? 'Même navire pour tous' : 'Same vessel for all')
                          : (isFr ? 'Navires distincts' : 'Separate vessels')
                        }
                      </span>
                    </div>
                  )}
                </div>
              )}
            </DossierSection>
          )}

          {/* ── Logistique ── */}
          {hasLogistics && (
            <DossierSection
              title={isFr ? 'Logistique' : 'Logistics'}
              icon={<Ship size={14} className="text-[#4A8FC4]" />}
              isOpen={open.log}
              onToggle={() => toggle('log')}
            >
              {/* Multi-vessel : un bloc par navire */}
              {vesselLogistics ? (
                <div className="space-y-3">
                  {vesselLogistics.map((v, idx) => {
                    const hasAny = v.shipLine || v.shipName || v.voyageNumber || v.shipDate || v.code
                    if (!hasAny) return null
                    const vesselName = parsedDesc?.[idx]?.name || v.shipName || (isFr ? `Navire ${idx + 1}` : `Vessel ${idx + 1}`)
                    return (
                      <div key={idx} className="rounded-xl overflow-hidden border border-gray-100">
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-100">
                          <div className="w-5 h-5 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-white">{idx + 1}</span>
                          </div>
                          <p className="text-xs font-bold text-[#1B3A5C]">{vesselName}</p>
                        </div>
                        <div className="p-3 space-y-2">
                          {v.code && (
                            <div className="flex items-center justify-between bg-[#EDF1F7] rounded-lg px-2.5 py-1.5">
                              <p className="text-[10px] font-bold text-[#1B3A5C] uppercase tracking-wide">
                                {isFr ? 'N° BL / Code dossier' : 'BL no. / File code'}
                              </p>
                              <p className="text-xs font-mono font-bold text-[#1B3A5C]">{v.code}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {[
                              { label: isFr ? 'Compagnie' : 'Company',    value: v.shipLine },
                              { label: isFr ? 'Navire' : 'Ship',          value: v.shipName },
                              { label: isFr ? 'N° voyage' : 'Voyage no.', value: v.voyageNumber },
                              { label: isFr ? 'Date' : 'Date',            value: v.shipDate },
                            ].filter(f => f.value).map(f => (
                              <div key={f.label}>
                                <p className="text-[10px] text-gray-400 font-medium">{f.label}</p>
                                <p className="text-xs font-semibold text-gray-800 mt-0.5">{f.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Single vessel */
                <div className="space-y-3">
                  {ticket.code && (
                    <div className="flex items-center justify-between bg-[#EDF1F7] rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-bold text-[#1B3A5C] uppercase tracking-wide">
                        {isFr ? 'N° BL / Code dossier' : 'BL no. / File code'}
                      </p>
                      <p className="text-sm font-mono font-bold text-[#1B3A5C]">{ticket.code}</p>
                    </div>
                  )}
                  {(ticket.shipLine || ticket.shipName || ticket.voyageNumber || ticket.shipDate) && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      {[
                        { label: isFr ? 'Compagnie' : 'Company',    value: ticket.shipLine },
                        { label: isFr ? 'Navire' : 'Ship',          value: ticket.shipName },
                        { label: isFr ? 'N° voyage' : 'Voyage no.', value: ticket.voyageNumber },
                        { label: isFr ? 'Date' : 'Date',            value: ticket.shipDate },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label}>
                          <p className="text-[10px] text-gray-400 font-medium">{f.label}</p>
                          <p className="text-xs font-semibold text-gray-800 mt-0.5">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </DossierSection>
          )}

          {/* ── AI usage badge ── */}
          {ticket.aiUsage && (
            <div className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-2xl px-4 py-2.5">
              <span className="text-sm">⚡</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">
                  {isFr ? 'Extraction IA utilisée' : 'AI extraction used'}
                </p>
                <p className="text-[10px] text-blue-300">{ticket.aiUsage.model}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-bold text-white">{ticket.aiUsage.costFcfa?.toFixed(2)} FCFA</p>
                <p className="text-[10px] text-blue-300">${ticket.aiUsage.costUsd?.toFixed(6)}</p>
              </div>
            </div>
          )}

          {/* ── BL / Booking Confirmation ── */}
          {blData && (
            <DossierSection
              title="Booking Confirmation Eagle"
              icon={<Paperclip size={14} className="text-[#4A8FC4]" />}
              isOpen={open.bl}
              onToggle={() => toggle('bl')}
            >
              <div className="space-y-3 pt-1">
                {/* Références */}
                {(blData.date || blData.service || blData.customerRef) && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Références</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {[
                        { l: 'Booking no.', v: ticket.code },
                        { l: 'Date', v: blData.date },
                        { l: 'Customer ref', v: blData.customerRef },
                        { l: 'Service', v: blData.service },
                      ].filter(f => f.v).map(f => (
                        <div key={f.l}>
                          <p className="text-[10px] text-gray-400">{f.l}</p>
                          <p className="text-xs font-semibold text-gray-800">{f.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Navire */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{isFr ? 'Navire & Voyage' : 'Vessel & Voyage'}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      { l: isFr ? 'Navire' : 'Vessel', v: ticket.shipName },
                      { l: 'Voyage', v: ticket.voyageNumber },
                      { l: 'ETS', v: ticket.shipDate },
                      { l: 'ETA', v: blData.eta },
                      { l: isFr ? 'Chargement' : 'Loading', v: blData.portOfLoading },
                      { l: isFr ? 'Déchargement' : 'Discharge', v: blData.portOfDischarge },
                      { l: isFr ? 'Lieu réception' : 'Place of receipt', v: blData.placeOfReceipt },
                      { l: isFr ? 'Lieu livraison' : 'Place of delivery', v: blData.placeOfDelivery },
                    ].filter(f => f.v).map(f => (
                      <div key={f.l}>
                        <p className="text-[10px] text-gray-400">{f.l}</p>
                        <p className="text-xs font-semibold text-gray-800">{f.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Pickup */}
                {blData.pickup && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Pickup reference / Dépôt</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {[
                        { l: 'Pickup ref', v: blData.pickup.reference },
                        { l: isFr ? 'Qté' : 'Qty', v: blData.pickup.quantity != null ? String(blData.pickup.quantity) : null },
                        { l: 'Size type', v: blData.pickup.sizeType },
                        { l: 'Container usage', v: blData.pickup.containerUsage },
                        { l: 'Dépôt', v: blData.pickup.depot },
                        { l: 'Release date', v: blData.pickup.releaseDate },
                      ].filter(f => f.v).map(f => (
                        <div key={f.l}>
                          <p className="text-[10px] text-gray-400">{f.l}</p>
                          <p className="text-xs font-semibold text-gray-800">{f.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Turn in */}
                {blData.turnIn && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Turn in location</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {[
                        { l: 'Turn in ref', v: blData.turnIn.reference },
                        { l: 'Terminal', v: blData.turnIn.terminal },
                        { l: 'Terminal closing', v: blData.turnIn.terminalClosing },
                        { l: 'VGM closing', v: blData.turnIn.vgmClosing },
                        { l: 'Customs closing', v: blData.turnIn.customsClosing },
                      ].filter(f => f.v).map(f => (
                        <div key={f.l}>
                          <p className="text-[10px] text-gray-400">{f.l}</p>
                          <p className="text-xs font-semibold text-gray-800">{f.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Booking items */}
                {blData.bookingItems?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Booking items</p>
                    {blData.bookingItems.map((it: any, i: number) => (
                      <div key={i} className="rounded-xl bg-gray-50 border border-gray-100 p-3 mb-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {[
                            { l: isFr ? 'Nb colis' : 'No. packs', v: it.noOfPacks != null ? String(it.noOfPacks) : null },
                            { l: isFr ? 'Type colis' : 'Kind of pack', v: it.kindOfPack },
                            { l: isFr ? 'Marchandises' : 'Goods', v: it.descriptionOfGoods },
                            { l: 'Liner terms', v: it.linerTerms },
                            { l: 'IMO', v: it.imo },
                            { l: isFr ? 'Poids brut (t)' : 'Gross wt (t)', v: it.grossWeightTons != null ? String(it.grossWeightTons) : null },
                            { l: 'Mesure (cbm)', v: it.measurementCbm != null ? String(it.measurementCbm) : null },
                          ].filter(f => f.v).map(f => (
                            <div key={f.l} className={f.l === (isFr ? 'Marchandises' : 'Goods') ? 'col-span-2' : ''}>
                              <p className="text-[10px] text-gray-400">{f.l}</p>
                              <p className="text-xs font-semibold text-gray-800">{f.v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Container details */}
                {blData.containerDetails?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Container details</p>
                    {blData.containerDetails.map((cd: any, i: number) => (
                      <div key={i} className="rounded-xl bg-gray-50 border border-gray-100 p-3 mb-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {[
                            { l: 'Container no', v: cd.containerNo },
                            { l: 'Set point', v: cd.setPoint },
                            { l: 'Vent', v: cd.vent },
                            { l: 'Drains', v: cd.drains },
                            { l: 'Humidity', v: cd.humidity },
                            { l: isFr ? 'Remarques' : 'Remarks', v: cd.remarks },
                          ].filter(f => f.v).map(f => (
                            <div key={f.l}>
                              <p className="text-[10px] text-gray-400">{f.l}</p>
                              <p className="text-xs font-semibold text-gray-800">{f.v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Remarks */}
                {blData.remarks && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{isFr ? 'Remarques' : 'Remarks'}</p>
                    <p className="text-xs text-gray-700">{blData.remarks}</p>
                  </div>
                )}
              </div>
            </DossierSection>
          )}

          {/* ── Description ── */}
          <DossierSection
            title="Description"
            icon={<FileText size={14} className="text-[#4A8FC4]" />}
            isOpen={open.desc}
            onToggle={() => toggle('desc')}
          >
            {parsedDesc ? (
              <div className="space-y-3">
                {parsedDesc.map((v, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-[#4A8FC4] flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">{idx + 1}</span>
                      </div>
                      <p className="text-xs font-bold text-[#1B3A5C]">{v.name}</p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed pl-7">{v.description}</p>
                    {idx < parsedDesc.length - 1 && <div className="mt-3 border-t border-gray-100" />}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">{ticket.description}</p>
            )}
          </DossierSection>

          {/* ── Documents ── */}
          {ticket.attachments && ticket.attachments.length > 0 && (() => {
            const atts: any[] = ticket.attachments
            const hasGroups = atts.some((a: any) => a.source)
            const groups: { label: string | null; items: any[] }[] = hasGroups
              ? Object.values(
                  atts.reduce((acc: Record<string, { label: string | null; items: any[] }>, a: any) => {
                    const key = a.source || ''
                    if (!acc[key]) acc[key] = { label: a.source || null, items: [] }
                    acc[key].items.push(a)
                    return acc
                  }, {})
                )
              : [{ label: null, items: atts }]

            return (
              <DossierSection
                title={`Documents (${atts.length})`}
                icon={<Paperclip size={14} className="text-[#4A8FC4]" />}
                isOpen={open.docs}
                onToggle={() => toggle('docs')}
              >
                <div className="space-y-3">
                  {groups.map((group, gi) => (
                    <div key={gi}>
                      {group.label && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded-full bg-[#4A8FC4] flex items-center justify-center flex-shrink-0">
                            <span className="text-[8px] font-bold text-white">{gi + 1}</span>
                          </div>
                          <p className="text-[10px] font-bold text-[#1B3A5C] uppercase tracking-wide">{group.label}</p>
                        </div>
                      )}
                      <DocCardRow
                        attachments={group.items}
                        onDownload={att => downloadFile(att)}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </DossierSection>
            )
          })()}

          {/* ── Messagerie ── */}
          <div className="rounded-2xl overflow-hidden shadow-sm flex flex-col relative" style={{ height: '420px' }}>
            <div className="bg-[#1B3A5C] px-4 py-3 flex items-center gap-2 flex-shrink-0">
              <MessageCircle size={15} className="text-blue-300" />
              <p className="text-sm font-bold text-white flex-1">{isFr ? 'Échanges' : 'Messages'}</p>
              <span className="text-xs text-blue-300 font-medium">{messages.length}</span>
            </div>
            <div ref={chatInnerRef} onScroll={handleChatScroll} className="bg-[#EDF4FB] flex-1 overflow-y-auto px-3 py-3 space-y-2 relative">
              {/* Info banner — message deletion */}
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-[11px] text-blue-500">
                <span>ℹ️</span>
                <span>{isFr ? 'Appuyez longuement sur votre message pour le supprimer (5 min max après envoi).' : 'Long press your message to delete it (within 5 min of sending).'}</span>
              </div>
              {messages.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-6">
                  {isFr ? "Aucun échange pour l'instant" : 'No messages yet'}
                </p>
              ) : messages.map((msg: any) => {
                const isClient = msg.senderType === 'CLIENT'

                // DOCUMENT_REQUEST — per-slot upload
                if (msg.senderType === 'DOCUMENT_REQUEST') {
                  let docs: string[] = []
                  try { docs = JSON.parse(msg.documentDescription ?? '[]') } catch {}
                  if (!docs.length) docs = [msg.content]
                  const alreadyAnswered = messages.some(
                    (m: any) => m.senderType === 'DOCS_SUBMITTED' && new Date(m.createdAt) > new Date(msg.createdAt)
                  )
                  const slots = docSlots[msg.id] ?? docs.map(() => null)
                  const allFilled = slots.length > 0 && slots.every(f => f !== null)
                  const isSubmitting = submittingDocs === msg.id
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div className="w-[90%] bg-orange-50 border border-orange-200 rounded-2xl rounded-tl-sm px-3.5 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold text-orange-600 flex items-center gap-1">
                            <Paperclip size={10} /> {isFr ? 'DOCUMENTS REQUIS' : 'DOCUMENTS REQUIRED'}
                          </p>
                          {alreadyAnswered && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle size={9} /> {isFr ? 'Envoyés' : 'Sent'}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {docs.map((docName, i) => {
                            const file = slots[i] ?? null
                            return (
                              <div key={i} className={`rounded-xl bg-white border p-2.5 ${alreadyAnswered ? 'border-emerald-100 opacity-70' : 'border-orange-100'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${alreadyAnswered ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                                    {alreadyAnswered
                                      ? <CheckCircle size={11} className="text-emerald-600" />
                                      : <span className="text-[9px] font-bold text-orange-600">{i + 1}</span>
                                    }
                                  </div>
                                  <p className={`text-xs font-semibold ${alreadyAnswered ? 'text-emerald-800 line-through decoration-emerald-400' : 'text-orange-800'}`}>{docName}</p>
                                </div>
                                {!alreadyAnswered && (file ? (
                                  <div className="flex items-center gap-2">
                                    {file.type.startsWith('image/') ? (
                                      <img src={URL.createObjectURL(file)} alt={file.name}
                                        className="w-12 h-12 rounded-lg object-cover border border-orange-200 flex-shrink-0" />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                                        <FileText size={20} className="text-orange-400" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
                                      <p className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <button onClick={() => setDocSlots(prev => {
                                      const s = [...(prev[msg.id] ?? docs.map(() => null))]
                                      s[i] = null
                                      return { ...prev, [msg.id]: s }
                                    })} className="text-gray-400 hover:text-red-500 flex-shrink-0 p-1">
                                      <X size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 cursor-pointer transition-colors w-fit">
                                      <Upload size={11} />
                                      {isFr ? 'Choisir' : 'Choose'}
                                      <input type="file" className="hidden"
                                        accept="image/*,application/pdf,.doc,.docx"
                                        onChange={e => {
                                          const f = e.target.files?.[0]
                                          if (!f) return
                                          setDocSlots(prev => {
                                            const s = [...(prev[msg.id] ?? docs.map(() => null))]
                                            s[i] = f
                                            return { ...prev, [msg.id]: s }
                                          })
                                          e.target.value = ''
                                        }} />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => setScanTarget({ msgId: msg.id, slotIdx: i })}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold hover:bg-orange-200 transition-colors w-fit">
                                      <Camera size={11} />
                                      {isFr ? 'Scanner' : 'Scan'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                        {!alreadyAnswered && allFilled && (
                          <button onClick={() => submitDocSlots(msg.id)} disabled={isSubmitting}
                            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                            {isSubmitting
                              ? <Loader2 size={14} className="animate-spin" />
                              : <CheckCircle size={14} />}
                            {isFr ? 'Valider et envoyer' : 'Validate & send'}
                          </button>
                        )}
                        <p className="text-[10px] text-orange-400 mt-2">{formatDate(msg.createdAt, locale)}</p>
                      </div>
                    </div>
                  )
                }

                // FINAL_RESPONSE — green card
                if (msg.senderType === 'FINAL_RESPONSE') {
                  const msgAtts = (ticket.attachments ?? []).filter((a: any) => a.messageId === msg.id)
                  return (
                    <div key={msg.id} className="flex justify-start w-full">
                      <div className="max-w-[90%] w-full border-2 border-emerald-400 rounded-2xl overflow-hidden">
                        <div className="bg-emerald-500 px-3.5 py-2 flex items-center gap-2">
                          <CheckCircle size={13} className="text-white" />
                          <p className="text-[10px] font-bold text-white uppercase tracking-wide">
                            {isFr ? '✅ Réponse finale' : '✅ Final response'}
                          </p>
                        </div>
                        <div className="bg-emerald-50 px-3.5 py-3">
                          <p className="text-sm text-emerald-900 leading-relaxed">{msg.content}</p>
                          {msgAtts.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-emerald-200">
                              {msgAtts.map((att: any) => (
                                <button key={att.id} onClick={() => downloadFile(att)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-xs font-medium text-emerald-800 hover:bg-emerald-200 transition-colors">
                                  <FileText size={11} /> {att.filename} <Download size={10} />
                                </button>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-emerald-500 mt-2">{formatDate(msg.createdAt, locale)}</p>
                        </div>
                      </div>
                    </div>
                  )
                }

                // DOCS_SUBMITTED — teal card (right side, from client)
                if (msg.senderType === 'DOCS_SUBMITTED') {
                  const msgAtts = (ticket.attachments ?? []).filter((a: any) => a.messageId === msg.id)
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] bg-teal-50 border border-teal-200 rounded-2xl rounded-tr-sm px-3.5 py-2.5">
                        <p className="text-[10px] font-bold text-teal-600 mb-1.5 flex items-center gap-1">
                          <CheckCircle size={10} /> {isFr ? 'Documents envoyés' : 'Documents sent'}
                        </p>
                        {msgAtts.length > 0 && (
                          <DocCardRow
                            attachments={msgAtts}
                            onDownload={att => downloadFile(att)}
                            size="sm"
                          />
                        )}
                        <p className="text-[10px] text-teal-400 mt-2">{formatDate(msg.createdAt, locale)}</p>
                      </div>
                    </div>
                  )
                }

                // Normal messages (CLIENT / AGENT)
                if (msg.isDeleted) {
                  return (
                    <div key={msg.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                      <div className="px-3.5 py-2 rounded-2xl text-xs text-gray-400 italic border border-dashed border-gray-200">
                        🚫 {isFr ? 'Message supprimé' : 'Message deleted'}
                      </div>
                    </div>
                  )
                }

                const withinLimit = !msg.pending && (Date.now() - new Date(msg.createdAt).getTime()) < 5 * 60 * 1000
                const canDelete = isClient && withinLimit

                const msgAtts = (ticket.attachments ?? []).filter((a: any) => a.messageId === msg.id)
                const previewData: any[] = (msg as any)._previewData ?? []
                const showLocalPreview = previewData.length > 0 && msgAtts.length === 0
                const showAttachmentPlaceholder = !showLocalPreview && msgAtts.length === 0 && (msg.attachmentCount ?? 0) > 0
                return (
                  <div key={msg.id} className={`flex items-end gap-1.5 ${isClient ? 'justify-end' : 'justify-start'}`}>
                    {canDelete && (
                      <button
                        onClick={async () => {
                          if (!confirm(isFr ? 'Supprimer ce message ?' : 'Delete this message?')) return
                          const res = await apiFetch(`/api/tickets/${ticket.id}/messages/${msg.id}`, { method: 'DELETE' })
                          if (res.ok) {
                            setMessages((prev: any[]) => prev.map((m: any) => m.id === msg.id ? { ...m, isDeleted: true, content: '' } : m))
                          } else {
                            const d = await res.json().catch(() => ({}))
                            if (d.detail === 'delete_too_late') alert(isFr ? 'Délai de 5 min dépassé' : '5 min window expired')
                          }
                        }}
                        className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mb-1">
                        <Trash2 size={12} className="text-red-400" />
                      </button>
                    )}
                    <div className={`max-w-[80%] px-3.5 py-2.5 shadow-sm ${isClient
                      ? 'bg-[#1B3A5C] text-white rounded-2xl rounded-tr-sm'
                      : 'bg-[#D6E7F5] text-gray-900 rounded-2xl rounded-tl-sm'
                    } ${msg.pending ? 'opacity-60' : ''}`}>
                      {!isClient && msg.sender && (
                        <p className="text-[10px] font-bold text-[#4A8FC4] mb-1">
                          {msg.sender.firstName} {msg.sender.lastName}
                        </p>
                      )}
                      {msg.content.trim() && msg.content !== ' ' && (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      )}
                      {msgAtts.length > 0 && (
                        <div className={`flex flex-col gap-1 ${msg.content.trim() && msg.content !== ' ' ? 'mt-1.5' : ''}`}>
                          {msgAtts.map((att: any) => (
                            <AttachmentBubble key={att.id} att={att} onDownload={() => downloadFile(att)} dark={isClient} locale={locale} />
                          ))}
                        </div>
                      )}
                      {showLocalPreview && (
                        <div className={`flex flex-col gap-1 ${msg.content.trim() && msg.content !== ' ' ? 'mt-1.5' : ''}`}>
                          {previewData.map((pd: any, i: number) => pd.url ? (
                            <img key={i} src={pd.url} alt={pd.filename} className="max-w-full max-h-52 object-cover rounded-xl" />
                          ) : (
                            <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${isClient ? 'bg-white/25 border border-white/30' : 'bg-white border border-gray-200 shadow-sm'}`}>
                              <FileText size={18} className={isClient ? 'text-blue-100 flex-shrink-0' : 'text-blue-500 flex-shrink-0'} />
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-semibold truncate ${isClient ? 'text-white' : 'text-gray-800'}`}>{pd.filename}</p>
                                <p className={`text-[10px] ${isClient ? 'text-blue-200' : 'text-gray-400'}`}>{(pd.size/1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {showAttachmentPlaceholder && (
                        <p className={`text-[10px] italic mt-1 ${isClient ? 'text-blue-200' : 'text-gray-400'}`}>
                          📎 {isFr ? 'Ce message contient un document — il apparaîtra dès que possible.' : 'This message has an attached document — it will appear shortly.'}
                        </p>
                      )}
                      <p className={`text-[10px] mt-1 flex items-center gap-1 ${isClient ? 'text-blue-200' : 'text-gray-500'}`}>
                        {msg.pending
                          ? (isFr ? '⏱ En attente...' : '⏱ Pending...')
                          : formatDate(msg.createdAt, locale)
                        }
                        {isClient && !msg.pending && msg.isRead && (
                          <span className="opacity-80 font-medium">{isFr ? '· Lu' : '· Read'}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />

              {/* Bandeau nouveaux messages */}
              {isScrolledUp && unreadWhileUp > 0 && (
                <button
                  onClick={scrollToBottom}
                  className="sticky bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-[#1B3A5C] text-white text-xs font-semibold shadow-lg active:scale-95 transition-transform mx-auto w-fit"
                >
                  <span>↓</span>
                  {unreadWhileUp} {isFr ? 'nouveau' : 'new'}{unreadWhileUp > 1 ? (isFr ? 'x' : '') : ''}
                </button>
              )}
            </div>

            {/* Flèche scroll-to-bottom */}
            {isScrolledUp && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-20 right-3 z-20 w-9 h-9 rounded-full bg-[#1B3A5C] shadow-lg flex items-center justify-center active:scale-95 transition-transform"
              >
                {unreadWhileUp > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadWhileUp > 9 ? '9+' : unreadWhileUp}
                  </span>
                )}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M3 8l4 4 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* Input intégré dans le bloc chat */}
            {(ticket.status === 'PENDING' || ticket.status === 'IN_PROGRESS') && (
              <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 py-2.5">
                {fileUploads.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                    {fileUploads.map(fu => (
                      <div key={fu.uid} className="relative flex-shrink-0">
                        {fu.previewUrl ? (
                          <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-white shadow-md">
                            <img src={fu.previewUrl} alt={fu.file.name} className={`w-full h-full object-cover ${fu.status === 'uploading' ? 'opacity-60' : ''}`} />
                            {fu.status === 'uploading' && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                                <Loader2 size={16} className="text-white animate-spin" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm max-w-[150px]">
                            {fu.status === 'uploading'
                              ? <Loader2 size={16} className="text-blue-400 animate-spin flex-shrink-0" />
                              : <FileText size={16} className="text-blue-500 flex-shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{fu.file.name}</p>
                              <p className="text-[10px] text-gray-400">{fu.status === 'uploading' ? (isFr ? 'Envoi...' : 'Uploading...') : `${(fu.file.size/1024).toFixed(1)} KB`}</p>
                            </div>
                          </div>
                        )}
                        <button onClick={() => removeFileUpload(fu.uid)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 shadow flex items-center justify-center z-10">
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-1.5">
                  <label className="flex-shrink-0 mb-2 text-gray-400 active:text-[#1B3A5C] transition-colors cursor-pointer"
                    title={isFr ? 'Joindre un fichier' : 'Attach file'}>
                    <Paperclip size={20} />
                    <input type="file" multiple className="sr-only"
                      accept="image/*,application/pdf,.doc,.docx"
                      onChange={e => {
                        const files = Array.from(e.target.files ?? [])
                        if (files.length > 0) handleFilesSelected(files)
                        e.target.value = ''
                      }} />
                  </label>
                  <button type="button" onClick={() => setScanTarget({ msgId: '__chat__', slotIdx: 0 })}
                    title={isFr ? 'Scanner un document' : 'Scan document'}
                    className="flex-shrink-0 mb-2 text-gray-400 active:text-[#1B3A5C] transition-colors">
                    <Camera size={20} />
                  </button>
                  {ticket?.blDocumentId && (
                    premiumAccepted
                      ? <VoiceRecorder
                          className="flex-shrink-0 mb-2 text-gray-400 active:text-[#1B3A5C] transition-colors"
                          ticketId={ticketId}
                          onCostUpdate={refreshAiCost}
                          disabledReason={!isOnline ? 'offline' : (creditsRemaining !== null && creditsRemaining <= 0) ? 'no_credits' : null}
                          onDisabledClick={() => router.push(`/${locale}/recharger`)}
                          onResult={t => setText(prev => (prev + (prev ? ' ' : '') + t).trim())}
                        />
                      : <button type="button"
                          onClick={() => setShowPremiumPopup(true)}
                          className="flex-shrink-0 mb-2 text-gray-300 active:text-[#1B3A5C] transition-colors">
                          <Mic size={20} />
                        </button>
                  )}
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder={isFr ? 'Écrire un message...' : 'Write a message...'}
                    rows={1}
                    className="flex-1 text-sm bg-gray-100 rounded-2xl px-4 py-2.5 resize-none outline-none leading-relaxed text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#1B3A5C]/20 transition-all"
                    style={{ maxHeight: '5rem', overflowY: 'auto' }}
                  />
                  <button onClick={sendMessage}
                    disabled={(!text.trim() && fileUploads.length === 0) || sending || fileUploads.some(f => f.status === 'uploading')}
                    className="w-9 h-9 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-transform">
                    {sending ? <Loader2 size={15} className="text-white animate-spin" /> : <Send size={15} className="text-white" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Satisfaction ── */}
          {canRate && (
            <div className="bg-white rounded-2xl px-4 py-4 shadow-sm">
              <p className="text-sm font-bold text-gray-900 mb-0.5">
                {isFr ? 'Votre avis' : 'Your feedback'}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                {isFr ? "Comment s'est passée la résolution de votre demande ?" : 'How was the resolution of your request?'}
              </p>
              <div className="flex gap-2 mb-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setRatingScore(s)} className="active:scale-95 transition-transform">
                    <Star size={28} className={s <= ratingScore ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
                  </button>
                ))}
              </div>
              {ratingScore > 0 && (
                <>
                  <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)}
                    placeholder={isFr ? 'Commentaire optionnel...' : 'Optional comment...'}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 resize-none outline-none focus:border-[#1B3A5C] mb-3"
                    rows={2} />
                  <button onClick={submitRating} disabled={submittingRating}
                    className="w-full py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-bold disabled:opacity-50">
                    {submittingRating ? '...' : (isFr ? 'Envoyer mon avis' : 'Submit feedback')}
                  </button>
                </>
              )}
            </div>
          )}

          {ratingSubmitted && (
            <div className="bg-emerald-50 rounded-2xl px-4 py-3 text-center border border-emerald-100">
              <p className="text-sm font-bold text-emerald-700">
                {isFr ? 'Merci pour votre avis !' : 'Thank you for your feedback!'}
              </p>
            </div>
          )}

          <div className="h-2" />
        </div>
      </div>


    </div>
  )
}
