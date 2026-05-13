'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatusBadge, UrgencyBadge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import AgentTicketActions from './AgentTicketActions'
import { ArrowLeft, Phone, User, Ship, Hash, Package, AlertTriangle, ChevronDown, FileText, Clock, Paperclip } from 'lucide-react'
import { getUser, apiFetch, getToken, apiUrl } from '@/lib/api-client'
import { DocCardRow } from '@/components/ui/DocCard'

// ── Parsing helpers (same as client dossier) ──────────────────────────────────

function parseEquipmentType(raw: string) {
  if (!raw.startsWith('MULTI')) return { isMulti: false, sameVessel: null, containers: [{ qty: 1, type: raw, isoNumber: undefined }] }
  const sameVessel = raw.includes('même navire') || raw.includes('same vessel') ? true : raw.includes('navires distincts') || raw.includes('separate vessels') ? false : null
  const colonIdx = raw.indexOf(' : ')
  if (colonIdx === -1) return { isMulti: true, sameVessel, containers: [] }
  const containers = raw.slice(colonIdx + 3).split(' | ').map(part => {
    const m = part.match(/^(?:(\d+)×\s+)?(.+?)(?:\s+\[([^\]]+)\])?$/)
    if (!m) return { qty: 1, type: part, isoNumber: undefined }
    return { qty: m[1] ? parseInt(m[1]) : 1, type: m[2].trim(), isoNumber: m[3] || undefined }
  })
  return { isMulti: true, sameVessel, containers }
}

function parseMultiDescription(desc: string) {
  const regex = /(?:Navire|Vessel) \d+ — ([^:]+) :\n([\s\S]*?)(?=\n\n(?:Navire|Vessel) \d+|$)/g
  const matches = [...desc.matchAll(regex)]
  if (matches.length < 2) return null
  return matches.map(m => ({ name: m[1].trim(), description: m[2].trim() }))
}

function parseVesselData(raw: string | null | undefined) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    // BL tickets store an object (not array) in vesselData — only arrays are multi-vessel logistics
    return Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

function downloadFileAgent(attId: string, filename: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('eolis_token') : null
  fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/attachments/${attId}/download`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  }).then(r => r.blob()).then(blob => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  })
}

function fmtDuration(ms: number, isFr: boolean): string {
  const totalMin = Math.floor(ms / 60000)
  if (totalMin < 1) return isFr ? 'quelques secondes' : 'a few seconds'
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

export default function AgentDossierPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [ticketId, setTicketId] = useState('')
  const [user, setUser] = useState<any>(null)
  const [ticket, setTicket] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState({ equip: true, log: true, desc: true, docs: true })
  const [unreadCount, setUnreadCount] = useState(0)
  function tog(k: keyof typeof open) { setOpen(p => ({ ...p, [k]: !p[k] })) }

  useEffect(() => { params.then(p => { setLocale(p.locale); setTicketId(p.id) }) }, [params])

  useEffect(() => {
    if (!ticketId) return
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    Promise.all([
      apiFetch(`/api/tickets/${ticketId}`).then(r => r.ok ? r.json() : null),
      apiFetch(`/api/tickets/${ticketId}/messages`).then(r => r.ok ? r.json() : []),
      apiFetch('/api/notifications').then(r => r.ok ? r.json() : []),
    ]).then(([tkt, msgs, notifs]) => {
      if (!tkt) { router.replace(`/${locale}/agent/dashboard`); return }
      setTicket(tkt)
      setMessages(msgs)
      if (Array.isArray(notifs)) setUnreadCount(notifs.filter((n: any) => !n.isRead).length)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [ticketId, locale])

  const t = {
    fr: {
      back: 'Retour', clientInfo: 'Informations client', call: 'Appeler',
      ticketInfo: 'Informations du dossier', logistics: 'Logistique',
      urgency: 'Urgence', status: 'Statut', category: 'Catégorie', subcategory: 'Sous-catégorie',
      equipment: 'Équipement', createdAt: 'Créé le', description: 'Description',
      warningMsg: "Le client n'a pas consulté votre dernier message depuis plus d'1 heure.",
    },
    en: {
      back: 'Back', clientInfo: 'Client information', call: 'Call',
      ticketInfo: 'Ticket information', logistics: 'Logistics',
      urgency: 'Urgency', status: 'Status', category: 'Category', subcategory: 'Subcategory',
      equipment: 'Equipment', createdAt: 'Created on', description: 'Description',
      warningMsg: 'The client has not read your last message for over 1 hour.',
    },
  }
  const tx = t[locale as keyof typeof t] ?? t.fr

  useEffect(() => {
    if (!ticketId) return
    const iv = setInterval(() => {
      apiFetch('/api/notifications').then(r => r.ok ? r.json() : []).then(notifs => {
        if (Array.isArray(notifs)) setUnreadCount(notifs.filter((n: any) => !n.isRead).length)
      }).catch(() => {})
    }, 15000)
    return () => clearInterval(iv)
  }, [ticketId])

  if (loading || !user || !ticket) return null

  const agentMessages = messages.filter((m: any) => m.senderType === 'AGENT')
  const lastAgentMsg = agentMessages[agentMessages.length - 1]
  const isWarning = lastAgentMsg && !lastAgentMsg.isRead && new Date(lastAgentMsg.createdAt) < new Date(Date.now() - 60 * 60 * 1000)

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-[#4A8FC4] text-sm font-medium hover:text-[#1B3A5C] mb-6">
        <ArrowLeft size={16} /> {tx.back}
      </button>

      {isWarning && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-50 border border-red-300 text-red-800">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{tx.warningMsg}</p>
            {ticket.client?.phone && (
              <a href={`tel:${ticket.client.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-red-700 underline">
                <Phone size={12} /> {ticket.client.phone}
              </a>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-bold text-gray-400">{ticket.ref}</span>
              <UrgencyBadge urgency={ticket.urgency} locale={locale} />
              <StatusBadge status={ticket.status} locale={locale} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{ticket.category}</h1>
            <p className="text-gray-500 text-sm">{ticket.subcategory}</p>
          </div>
          <p className="text-xs text-gray-400">{tx.createdAt}: {formatDate(ticket.createdAt, locale)}</p>
        </div>
      </div>

      {(() => {
        const parsedEquip = ticket.equipmentType ? parseEquipmentType(ticket.equipmentType) : null
        const parsedDesc  = ticket.description ? parseMultiDescription(ticket.description) : null
        const vesselLog   = parseVesselData(ticket.vesselData)
        const hasLog      = ticket.shipLine || ticket.shipName || ticket.voyageNumber || ticket.shipDate || ticket.code || vesselLog
        const isFr        = locale === 'fr'
        const clientLang  = ticket.client?.language === 'en' ? 'en' : 'fr'

        // Warning: FINAL_RESPONSE sent >1h ago, ticket is closed
        const finalMsg = messages.find((m: any) => m.senderType === 'FINAL_RESPONSE')
        const isClosed = ticket.status === 'CLOSED' || ticket.status === 'TREATED'
        const finalWarning = isClosed && finalMsg &&
          new Date(finalMsg.createdAt) < new Date(Date.now() - 60 * 60 * 1000) &&
          !finalMsg.isRead

        function CollapseCard({ title, icon, k, children }: { title: string; icon: React.ReactNode; k: keyof typeof open; children: React.ReactNode }) {
          return (
            <Card>
              <button onClick={() => tog(k)} className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {icon}
                      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
                    </div>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${open[k] ? '' : '-rotate-90'}`} />
                  </div>
                </CardHeader>
              </button>
              {open[k] && <CardBody>{children}</CardBody>}
            </Card>
          )
        }

        return (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="space-y-4">

              {/* Warning FINAL_RESPONSE */}
              {finalWarning && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-800">
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">{isFr ? 'Réponse finale non consultée' : 'Final response not viewed'}</p>
                    <p className="text-xs mt-0.5">{isFr ? 'Le client n\'a pas encore consulté votre réponse. Pensez à le contacter.' : 'The client has not viewed your response yet. Consider contacting them.'}</p>
                    {ticket.client?.phone && (
                      <a href={`tel:${ticket.client.phone}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-amber-700 underline">
                        <Phone size={11} /> {ticket.client.phone}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Treatment timeline — OPS_ADMIN / SYSTEM_ADMIN only */}
              {(user.role === 'OPS_ADMIN' || user.role === 'SYSTEM_ADMIN') && (() => {
                const createdMs  = new Date(ticket.createdAt).getTime()
                const takenMs    = ticket.takenAt  ? new Date(ticket.takenAt).getTime()  : null
                const closedMs   = ticket.closedAt ? new Date(ticket.closedAt).getTime() : null
                const nowMs      = Date.now()
                return (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Clock size={15} className="text-gray-400" />
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {isFr ? 'Suivi de traitement' : 'Processing timeline'}
                        </h3>
                      </div>
                    </CardHeader>
                    <CardBody>
                      {/* Agent badge */}
                      {ticket.agent ? (
                        <div className="flex items-center gap-2.5 mb-4 p-2.5 rounded-xl bg-[#1B3A5C]/5 border border-[#1B3A5C]/10">
                          <div className="w-8 h-8 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-white">
                              {ticket.agent.firstName?.[0]}{ticket.agent.lastName?.[0]}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{ticket.agent.firstName} {ticket.agent.lastName}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{ticket.agent.role?.replace(/_/g, ' ')}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg mb-3 font-medium">
                          {isFr ? 'Aucun agent assigné' : 'No agent assigned'}
                        </p>
                      )}

                      {/* Timeline steps */}
                      <div className="space-y-0">

                        {/* ① Received */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#1B3A5C] mt-1 flex-shrink-0" />
                            <div className="w-0.5 bg-gray-200 flex-1 my-1" style={{ minHeight: 18 }} />
                          </div>
                          <div className="pb-3">
                            <p className="text-xs font-semibold text-gray-800">{isFr ? 'Dossier reçu' : 'Ticket received'}</p>
                            <p className="text-[10px] text-gray-400">{formatDate(ticket.createdAt, locale)}</p>
                          </div>
                        </div>

                        {/* ② Taken / Still waiting */}
                        {takenMs ? (
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                              {(closedMs || ticket.status === 'IN_PROGRESS') && (
                                <div className="w-0.5 bg-gray-200 flex-1 my-1" style={{ minHeight: 18 }} />
                              )}
                            </div>
                            <div className="pb-3">
                              <p className="text-xs font-semibold text-gray-800">{isFr ? 'Prise en charge' : 'Agent took over'}</p>
                              <p className="text-[10px] text-gray-400">{formatDate(ticket.takenAt, locale)}</p>
                              <p className="text-[10px] text-blue-600 font-medium">
                                {isFr ? 'Délai : ' : 'Response time: '}{fmtDuration(takenMs - createdMs, isFr)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 bg-white mt-1 flex-shrink-0" />
                            </div>
                            <div className="pb-1">
                              <p className="text-xs font-semibold text-amber-600">{isFr ? 'En attente d\'agent' : 'Waiting for agent'}</p>
                              <p className="text-[10px] text-amber-500">{fmtDuration(nowMs - createdMs, isFr)}</p>
                            </div>
                          </div>
                        )}

                        {/* ③ Closed / Still in progress */}
                        {closedMs ? (
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{isFr ? 'Clôturé' : 'Closed'}</p>
                              <p className="text-[10px] text-gray-400">{formatDate(ticket.closedAt, locale)}</p>
                              {takenMs && (
                                <p className="text-[10px] text-emerald-600 font-medium">
                                  {isFr ? 'Traitement : ' : 'Treatment: '}{fmtDuration(closedMs - takenMs, isFr)}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : takenMs ? (
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 bg-blue-50 mt-1 flex-shrink-0" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-blue-600">{isFr ? 'En cours...' : 'In progress...'}</p>
                              <p className="text-[10px] text-blue-400">{isFr ? 'Depuis : ' : 'For: '}{fmtDuration(nowMs - takenMs, isFr)}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Duration summary — closed tickets only */}
                      {closedMs && takenMs && (
                        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                          <div className="flex justify-between">
                            <p className="text-[11px] text-gray-500">{isFr ? 'Délai de prise en charge' : 'Response time'}</p>
                            <p className="text-[11px] font-semibold text-gray-700">{fmtDuration(takenMs - createdMs, isFr)}</p>
                          </div>
                          <div className="flex justify-between">
                            <p className="text-[11px] text-gray-500">{isFr ? 'Durée de traitement' : 'Treatment time'}</p>
                            <p className="text-[11px] font-semibold text-gray-700">{fmtDuration(closedMs - takenMs, isFr)}</p>
                          </div>
                          <div className="flex justify-between bg-[#1B3A5C]/5 rounded-lg px-2.5 py-1.5 mt-1">
                            <p className="text-[11px] font-bold text-gray-700">{isFr ? 'Durée totale' : 'Total time'}</p>
                            <p className="text-[11px] font-bold text-[#1B3A5C]">{fmtDuration(closedMs - createdMs, isFr)}</p>
                          </div>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                )
              })()}

              {/* Client info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-gray-400" />
                    <h3 className="font-semibold text-gray-900 text-sm">{tx.clientInfo}</h3>
                  </div>
                </CardHeader>
                <CardBody className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Nom</p>
                    <p className="font-semibold text-gray-900">{ticket.client?.firstName} {ticket.client?.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <a href={`mailto:${ticket.client?.email}`} className="text-sm text-[#4A8FC4] hover:underline">{ticket.client?.email}</a>
                  </div>
                  {ticket.client?.phone && (
                    <div>
                      <p className="text-xs text-gray-500">Téléphone</p>
                      <a href={`tel:${ticket.client.phone}`} className="text-sm font-medium text-gray-900 hover:text-[#4A8FC4]">{ticket.client.phone}</a>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">{isFr ? 'Langue préférée' : 'Preferred language'}</p>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 ${clientLang === 'en' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {clientLang === 'en' ? '🇬🇧 Anglais — Communiquer en anglais' : '🇫🇷 Français — Communiquer en français'}
                    </span>
                  </div>
                  {ticket.client?.phone && (
                    <a href={`tel:${ticket.client.phone}`}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#152d47] transition-colors mt-1">
                      <Phone size={15} /> {tx.call}
                    </a>
                  )}
                </CardBody>
              </Card>

              {/* Equipment */}
              {parsedEquip && (
                <CollapseCard title={tx.equipment} icon={<Package size={15} className="text-gray-400" />} k="equip">
                  <div className="space-y-2">
                    {!parsedEquip.isMulti ? (
                      <span className="inline-flex bg-gray-100 text-gray-800 text-sm font-medium px-3 py-1.5 rounded-xl">{parsedEquip.containers[0]?.type}</span>
                    ) : (
                      <>
                        {parsedEquip.containers.map((c, i) => (
                          <div key={i} className={`flex items-start gap-3 py-2 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                            {c.qty > 1 && <div className="bg-[#1B3A5C] text-white text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0">{c.qty}×</div>}
                            <div>
                              <p className="text-sm font-medium text-gray-900">{c.type}</p>
                              {c.isoNumber && <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mt-0.5 inline-block">{c.isoNumber}</span>}
                            </div>
                          </div>
                        ))}
                        {parsedEquip.sameVessel !== null && (
                          <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full ${parsedEquip.sameVessel ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                            {parsedEquip.sameVessel ? (isFr ? 'Même navire' : 'Same vessel') : (isFr ? 'Navires distincts' : 'Separate vessels')}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </CollapseCard>
              )}

              {/* Logistics */}
              {hasLog && (
                <CollapseCard title={tx.logistics} icon={<Ship size={15} className="text-gray-400" />} k="log">
                  <div className="space-y-3">
                    {vesselLog ? vesselLog.map((v: any, idx: number) => {
                      if (!v.shipLine && !v.shipName && !v.voyageNumber && !v.shipDate && !v.code) return null
                      return (
                        <div key={idx} className="rounded-xl border border-gray-100 overflow-hidden">
                          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-100">
                            <div className="w-5 h-5 rounded-full bg-[#1B3A5C] flex items-center justify-center"><span className="text-[9px] font-bold text-white">{idx+1}</span></div>
                            <p className="text-xs font-bold text-[#1B3A5C]">{parsedDesc?.[idx]?.name || v.shipName || `Navire ${idx+1}`}</p>
                          </div>
                          <div className="p-3 space-y-1.5">
                            {v.code && <div className="flex justify-between bg-[#EDF1F7] rounded-lg px-2.5 py-1.5"><p className="text-[10px] font-bold text-[#1B3A5C] uppercase">N° BL</p><p className="text-xs font-mono font-bold text-[#1B3A5C]">{v.code}</p></div>}
                            <div className="grid grid-cols-2 gap-2">
                              {[['Compagnie', v.shipLine], ['Navire', v.shipName], ['Voyage', v.voyageNumber], ['Date', v.shipDate]].filter(f => f[1]).map(([l, val]) => (
                                <div key={l as string}><p className="text-[10px] text-gray-400">{l}</p><p className="text-xs font-medium text-gray-800">{val}</p></div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    }) : (
                      <div className="space-y-2">
                        {ticket.code && <div className="flex justify-between bg-[#EDF1F7] rounded-xl px-3 py-2"><p className="text-[10px] font-bold text-[#1B3A5C] uppercase">N° BL</p><p className="text-sm font-mono font-bold text-[#1B3A5C]">{ticket.code}</p></div>}
                        <div className="grid grid-cols-2 gap-3">
                          {[['Compagnie', ticket.shipLine], ['Navire', ticket.shipName], ['Voyage', ticket.voyageNumber], ['Date', ticket.shipDate]].filter(f => f[1]).map(([l, val]) => (
                            <div key={l as string}><p className="text-xs text-gray-400">{l}</p><p className="text-sm font-medium text-gray-800">{val}</p></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapseCard>
              )}

              {/* Description */}
              <CollapseCard title={tx.description} icon={<FileText size={15} className="text-gray-400" />} k="desc">
                {parsedDesc ? (
                  <div className="space-y-3">
                    {parsedDesc.map((v, idx) => (
                      <div key={idx}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#4A8FC4] flex items-center justify-center"><span className="text-[9px] font-bold text-white">{idx+1}</span></div>
                          <p className="text-xs font-bold text-[#1B3A5C]">{v.name}</p>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed pl-7">{v.description}</p>
                        {idx < parsedDesc.length - 1 && <div className="mt-2 border-t border-gray-100" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 leading-relaxed">{ticket.description}</p>
                )}
              </CollapseCard>

              {/* Documents initiaux du dossier */}
              {(() => {
                const initAtts = (ticket.attachments ?? []).filter((a: any) => !a.messageId)
                if (!initAtts.length) return null
                const hasGroups = initAtts.some((a: any) => a.source)
                const groups: { label: string | null; items: any[] }[] = hasGroups
                  ? Object.values(
                      initAtts.reduce((acc: Record<string, { label: string | null; items: any[] }>, a: any) => {
                        const key = a.source || ''
                        if (!acc[key]) acc[key] = { label: a.source || null, items: [] }
                        acc[key].items.push(a)
                        return acc
                      }, {})
                    )
                  : [{ label: null, items: initAtts }]
                return (
                  <CollapseCard
                    title={isFr ? `Documents (${initAtts.length})` : `Documents (${initAtts.length})`}
                    icon={<Paperclip size={15} className="text-gray-400" />}
                    k="docs"
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
                            onDownload={att => downloadFileAgent(att.id, att.filename)}
                            size="sm"
                          />
                        </div>
                      ))}
                    </div>
                  </CollapseCard>
                )
              })()}
            </div>

            <div className="lg:col-span-2">
              <AgentTicketActions
                ticketId={ticket.id}
                ticketRef={ticket.ref}
                ticketStatus={ticket.status}
                agentId={ticket.agentId ?? null}
                currentAgentId={user.id}
                currentAgentName={`${user.firstName} ${user.lastName}`}
                currentAgentRole={user.role}
                clientPhone={ticket.client?.phone ?? null}
                attachments={ticket.attachments ?? []}
                locale={locale}
              />
            </div>
          </div>
        )
      })()}
    </DashboardLayout>
  )
}
