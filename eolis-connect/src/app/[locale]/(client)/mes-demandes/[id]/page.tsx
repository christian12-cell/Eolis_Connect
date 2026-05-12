'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft, Globe, Send, Star, Ship, Package, FileText,
  MessageCircle, Paperclip, Download, ChevronDown, Upload, CheckCircle,
  X, Loader2, Camera, Trash2,
} from 'lucide-react'
import { DocCardRow } from '@/components/ui/DocCard'
import { ScannerModal } from '@/components/scanner/ScannerModal'
import { getUser, apiFetch, apiUpload, getToken, apiUrl } from '@/lib/api-client'
import { offlineDb } from '@/lib/offline-db'
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
  try { return JSON.parse(raw) } catch { return null }
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
  const [ratingScore, setRatingScore] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)
  const [docSlots, setDocSlots] = useState<Record<string, (File | null)[]>>({})
  const [submittingDocs, setSubmittingDocs] = useState<string | null>(null)
  const [scanTarget, setScanTarget] = useState<{ msgId: string; slotIdx: number } | null>(null)
  const [open, setOpen] = useState({ equip: true, log: true, desc: true, docs: true })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevMsgLenRef = useRef(0)

  function toggle(k: keyof typeof open) {
    setOpen(prev => ({ ...prev, [k]: !prev[k] }))
  }

  useEffect(() => { params.then(p => { setLocale(p.locale); setTicketId(p.id) }) }, [params])

  useEffect(() => {
    if (!ticketId) return
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/login`); return }
    setUser(u)
    loadData()
  }, [ticketId, locale])

  useEffect(() => {
    if (!ticketId) return
    const interval = setInterval(() => {
      apiFetch(`/api/tickets/${ticketId}/messages`).then(r => r.json()).then(msgs => {
        if (Array.isArray(msgs)) setMessages(msgs)
      }).catch(() => {})
    }, 6000)
    return () => clearInterval(interval)
  }, [ticketId])

  useEffect(() => {
    const newMsgArrived = messages.length > prevMsgLenRef.current
    prevMsgLenRef.current = messages.length
    if (!newMsgArrived) return
    const el = scrollContainerRef.current
    const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 150
    if (nearBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadData() {
    try {
      const [tk, msgs] = await Promise.all([
        apiFetch(`/api/tickets/${ticketId}`).then(r => r.json()),
        apiFetch(`/api/tickets/${ticketId}/messages`).then(r => r.json()),
      ])
      setTicket(tk)
      setMessages(Array.isArray(msgs) ? msgs : [])
      // Mark agent messages as read (so agent's "not viewed" card disappears)
      apiFetch(`/api/tickets/${ticketId}/messages/mark-read`, { method: 'POST' }).catch(() => {})
    } catch {}
    setLoading(false)
  }

  async function sendMessage() {
    if (!text.trim() || sending) return
    const content = text.trim()
    setSending(true)
    setText('')
    try {
      const r = await apiFetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
      if (r.ok) {
        const msg = await r.json()
        setMessages(prev => [...prev, msg])
      }
    } catch {
      // Offline — queue the message and show optimistically
      await offlineDb.add({
        type: 'SEND_MESSAGE',
        payload: { ticketId, content },
      })
      const optimistic = {
        id: `pending-${Date.now()}`,
        senderType: 'CLIENT',
        content,
        createdAt: new Date().toISOString(),
        sender: getUser(),
        pending: true,
      }
      setMessages(prev => [...prev, optimistic])
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

  // Single vessel logistics (for simple/same-vessel tickets)
  const singleHasLog = ticket.shipLine || ticket.shipName || ticket.voyageNumber || ticket.shipDate || ticket.code
  const hasLogistics = singleHasLog || !!vesselLogistics

  function switchLocale() {
    router.push(window.location.pathname.replace(`/${locale}/`, `/${otherLocale}/`))
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Scanner modal */}
      {scanTarget && (
        <ScannerModal
          isFr={isFr}
          onClose={() => setScanTarget(null)}
          onScan={file => {
            const { msgId, slotIdx } = scanTarget
            setDocSlots(prev => {
              const slot = prev[msgId] ?? []
              const s = [...slot]
              s[slotIdx] = file
              return { ...prev, [msgId]: s }
            })
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
      <header className="flex-shrink-0 bg-white/15 backdrop-blur-md border-b border-white/10"
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
          <div className="rounded-2xl overflow-hidden shadow-sm flex flex-col" style={{ height: '420px' }}>
            <div className="bg-[#1B3A5C] px-4 py-3 flex items-center gap-2 flex-shrink-0">
              <MessageCircle size={15} className="text-blue-300" />
              <p className="text-sm font-bold text-white flex-1">{isFr ? 'Échanges' : 'Messages'}</p>
              <span className="text-xs text-blue-300 font-medium">{messages.length}</span>
            </div>
            <div className="bg-[#EDF4FB] flex-1 overflow-y-auto px-3 py-3 space-y-2">
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
                  const slots = docSlots[msg.id] ?? docs.map(() => null)
                  const allFilled = slots.length > 0 && slots.every(f => f !== null)
                  const isSubmitting = submittingDocs === msg.id
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div className="w-[90%] bg-orange-50 border border-orange-200 rounded-2xl rounded-tl-sm px-3.5 py-3">
                        <p className="text-[10px] font-bold text-orange-600 mb-2 flex items-center gap-1">
                          <Paperclip size={10} /> {isFr ? 'DOCUMENTS REQUIS' : 'DOCUMENTS REQUIRED'}
                        </p>
                        <div className="space-y-2">
                          {docs.map((docName, i) => {
                            const file = slots[i] ?? null
                            return (
                              <div key={i} className="rounded-xl bg-white border border-orange-100 p-2.5">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[9px] font-bold text-orange-600">{i + 1}</span>
                                  </div>
                                  <p className="text-xs font-semibold text-orange-800">{docName}</p>
                                </div>
                                {file ? (
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
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {allFilled && (
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

                return (
                  <div key={msg.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                    <div className="relative group">
                      <div className={`max-w-[80%] px-3.5 py-2.5 shadow-sm ${isClient
                        ? 'bg-[#1B3A5C] text-white rounded-2xl rounded-tr-sm'
                        : 'bg-[#D6E7F5] text-gray-900 rounded-2xl rounded-tl-sm'
                      } ${msg.pending ? 'opacity-60' : ''}`}>
                        {!isClient && msg.sender && (
                          <p className="text-[10px] font-bold text-[#4A8FC4] mb-1">
                            {msg.sender.firstName} {msg.sender.lastName}
                          </p>
                        )}
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isClient ? 'text-blue-200' : 'text-gray-500'}`}>
                          {msg.pending
                            ? (isFr ? '⏱ En attente...' : '⏱ Pending...')
                            : formatDate(msg.createdAt, locale)
                          }
                        </p>
                      </div>
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
                          className="absolute -top-1.5 -left-6 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                          <Trash2 size={10} className="text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input intégré dans le bloc chat */}
            {(ticket.status === 'PENDING' || ticket.status === 'IN_PROGRESS') && (
              <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 py-2.5">
                <div className="flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder={isFr ? 'Écrire un message...' : 'Write a message...'}
                    rows={1}
                    className="flex-1 text-sm bg-gray-100 rounded-2xl px-4 py-2.5 resize-none outline-none leading-relaxed text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#1B3A5C]/20 transition-all"
                    style={{ maxHeight: '5rem', overflowY: 'auto' }}
                  />
                  <button onClick={sendMessage} disabled={!text.trim() || sending}
                    className="w-9 h-9 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-transform">
                    <Send size={15} className="text-white" />
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
