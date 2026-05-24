'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MobileLayout } from '@/components/layout/MobileLayout'
import {
  Upload, Camera, X, FileText, ChevronRight, ChevronLeft, ChevronDown,
  Check, Loader2, Star, Plus, Trash2, WifiOff, Mic, Zap, MessageCircle, Package,
} from 'lucide-react'
import { getUser, apiFetch, apiUpload } from '@/lib/api-client'
import { VoiceRecorder } from '@/components/ui/VoiceRecorder'
import { offlineDb, fileToStored } from '@/lib/offline-db'
import { getUrgency } from '@/lib/utils'
import { ScannerModal } from '@/components/scanner/ScannerModal'

// ── Static data ───────────────────────────────────────────────────────────────

const CATEGORIES_FR = ['Livraison', 'Facturation', 'Dossier', 'Information', 'Autre']
const CATEGORIES_EN = ['Delivery', 'Billing', 'File', 'Information', 'Other']

const SUBCATEGORIES_FR: Record<string, string[]> = {
  Livraison:   ['Conteneur bloqué', 'Retard de livraison', 'Problème à la réception', 'Autre'],
  Facturation: ['Retard de paiement', 'Paiement incomplet', 'Remboursement', 'Autre'],
  Dossier:     ['Dossier incomplet', 'Document manquant', 'Validation de dossier', 'Autre'],
  Information: ["Demande d'information", 'Procédure', 'Autre'],
  Autre:       [],
}
const SUBCATEGORIES_EN: Record<string, string[]> = {
  Delivery:    ['Blocked container', 'Delivery delay', 'Reception issue', 'Other'],
  Billing:     ['Late payment', 'Incomplete payment', 'Refund', 'Other'],
  File:        ['Incomplete file', 'Missing document', 'File validation', 'Other'],
  Information: ['Information request', 'Procedure', 'Other'],
  Other:       [],
}

const EQUIPMENT_FR = ['20 pieds', '40 pieds', 'Autre']
const EQUIPMENT_EN = ['20 feet',  '40 feet',  'Other']

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'categorie' | 'equipement' | 'logistique' | 'description' | 'recap'

interface FormState {
  category: string; categoryOther: string
  subcategory: string; subcategoryOther: string
  equipmentType: string; equipmentOther: string
  conventionnelDesc: string
  containerNumber: string
  shipName: string; voyageNumber: string; shipDate: string
  code: string
  description: string
  // BL manual fields
  eta: string; portOfLoading: string; portOfDischarge: string
  placeOfReceipt: string; placeOfDelivery: string
  customerRef: string; service: string; blDate: string
  bookingPartyName: string; bookingPartyRegion: string
  pickupRef: string; pickupQty: string; pickupSizeType: string
  pickupUsage: string; pickupDepot: string; pickupReleaseDate: string
  terminal: string; terminalClosing: string; vgmClosing: string; customsClosing: string
  descriptionOfGoods: string; noOfPacks: string; kindOfPack: string
  linerTerms: string; imo: string; grossWeightTons: string; measurementCbm: string
  containerTemp: string
}

interface ContainerEntry {
  id: number; type: string; typeOther: string; number: string
}

interface VesselBlock {
  id: number
  shipLine: string; shipName: string; voyageNumber: string; shipDate: string
  code: string
  description: string; files: File[]; previews: string[]
}

interface LogisticsLabels {
  shipName: string; voyageNo: string; shipDate: string; optional: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidContainerNumber(n: string): boolean {
  return /^[A-Z]{3}[UJZ]\d{7}$/.test(n.replace(/\s/g, '').toUpperCase())
}

// ── Module-level sub-components ───────────────────────────────────────────────
// Defined outside page to prevent React from remounting inputs on every render

const Req = () => <span className="text-red-400 ml-0.5">*</span>

function LogisticsFields({ sn, vn, sd, onChange, lbl }: {
  sn: string; vn: string; sd: string
  onChange: (key: string, val: string) => void
  lbl: LogisticsLabels
}) {
  return (
    <div className="space-y-3">
      {[
        { key: 'shipName',     label: lbl.shipName, val: sn, required: true },
        { key: 'voyageNumber', label: lbl.voyageNo, val: vn, required: false },
      ].map(f => (
        <div key={f.key}>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
            {f.label}{f.required && <Req />}
          </label>
          <input
            type="text"
            value={f.val}
            onChange={e => onChange(f.key, e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C]"
          />
        </div>
      ))}
      <div>
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
          {lbl.shipDate}
        </label>
        <input
          type="date"
          value={sd}
          onChange={e => onChange('shipDate', e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C]"
        />
      </div>
    </div>
  )
}

function FilePreviews({ prevs, fls, onRemove, dark = false }: {
  prevs: string[]; fls: File[]; onRemove: (i: number) => void; dark?: boolean
}) {
  if (prevs.length === 0) return null
  return (
    <div className="grid grid-cols-4 gap-2 mt-2">
      {prevs.map((src, i) => (
        <div key={i} className={`relative aspect-square rounded-xl overflow-hidden ${dark ? 'bg-white/20' : 'bg-gray-100'}`}>
          {src.startsWith('data:image') ? (
            <img src={src} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-1 gap-0.5">
              <FileText size={16} className={dark ? 'text-white' : 'text-[#1B3A5C]'} />
              <p className={`text-[7px] font-bold ${dark ? 'text-white/80' : 'text-[#1B3A5C]'}`}>PDF</p>
              <p className={`text-[7px] truncate w-full text-center px-1 ${dark ? 'text-white/60' : 'text-gray-500'}`}>
                {fls[i]?.name}
              </p>
            </div>
          )}
          <button
            onClick={() => onRemove(i)}
            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center"
          >
            <X size={9} className="text-white" />
          </button>
        </div>
      ))}
    </div>
  )
}

function RecapPreviews({ prevs, fls, noDoc, filesAdded }: {
  prevs: string[]; fls: File[]; noDoc: string; filesAdded: string
}) {
  if (prevs.length === 0) return <p className="text-xs text-gray-400 italic">{noDoc}</p>
  return (
    <>
      <div className="grid grid-cols-4 gap-2 mb-1.5">
        {prevs.map((src, i) => (
          <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
            {src.startsWith('data:image') ? (
              <img src={src} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-1 gap-0.5">
                <FileText size={14} className="text-[#1B3A5C]" />
                <p className="text-[7px] font-bold text-[#1B3A5C]">PDF</p>
                <p className="text-[7px] text-gray-500 truncate w-full text-center px-1">{fls[i]?.name}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">{fls.length} {filesAdded}</p>
    </>
  )
}

function RecapSection({ title, isOpen, onToggle, children }: {
  title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors"
      >
        <p className="text-sm font-bold text-[#1B3A5C]">{title}</p>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NouvelleDemandePage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser]     = useState<any>(null)
  const [step, setStep]     = useState<Step>('categorie')

  const [form, setForm] = useState<FormState>({
    category: '', categoryOther: '',
    subcategory: '', subcategoryOther: '',
    equipmentType: '', equipmentOther: '',
    conventionnelDesc: '',
    containerNumber: '',
    shipName: '', voyageNumber: '', shipDate: '',
    code: '',
    description: '',
    // BL manual fields
    eta: '', portOfLoading: '', portOfDischarge: '',
    placeOfReceipt: '', placeOfDelivery: '',
    customerRef: '', service: '', blDate: '',
    bookingPartyName: '', bookingPartyRegion: '',
    pickupRef: '', pickupQty: '', pickupSizeType: '',
    pickupUsage: '', pickupDepot: '', pickupReleaseDate: '',
    terminal: '', terminalClosing: '', vgmClosing: '', customsClosing: '',
    descriptionOfGoods: '', noOfPacks: '', kindOfPack: '',
    linerTerms: '', imo: '', grossWeightTons: '', measurementCbm: '',
    containerTemp: '',
  })

  const [mode, setMode]             = useState<'simple' | 'multi' | 'conventionnel'>('simple')
  const [containers, setContainers] = useState<ContainerEntry[]>([{ id: 1, type: '', typeOther: '', number: '' }])
  const [nextCId, setNextCId]       = useState(2)
  const [sameVessel, setSameVessel] = useState<boolean | null>(null)

  const [vessels, setVessels] = useState<VesselBlock[]>([{
    id: 1, shipLine: '', shipName: '', voyageNumber: '', shipDate: '',
    code: '', description: '', files: [], previews: [],
  }])
  const [nextVId, setNextVId] = useState(2)

  const [sameSituation, setSameSituation] = useState<boolean | null>(null)

  const [files, setFiles]       = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  const [showScanner, setShowScanner]   = useState(false)
  const [scanVesselId, setScanVesselId] = useState<number | null>(null)

  const [submitting, setSubmitting]         = useState(false)
  const [success, setSuccess]               = useState<{ ref: string; id: string } | null>(null)
  const [pendingOffline, setPendingOffline]   = useState(false)
  const [pendingHadFiles, setPendingHadFiles] = useState(false)

  const [pageMode, setPageMode]         = useState<null | 'manual' | 'bl' | 'info-simple' | 'info-premium'>(null)
  const [tier, setTier]                 = useState<null | 'simple' | 'premium'>(null)
  const [infoStep, setInfoStep]         = useState<'form' | 'recap'>('form')
  const [infoSubject, setInfoSubject]   = useState('')
  const [showInfoPremiumPopup, setShowInfoPremiumPopup] = useState(false)
  const [blStep, setBlStep]             = useState<'pick' | 'upload' | 'review' | 'category' | 'describe' | 'recap'>('pick')
  const [blScanMode, setBlScanMode]     = useState(false)
  const [blUploading, setBlUploading]   = useState(false)
  const [blFields, setBlFields]         = useState<any>(null)
  const [blVesselData, setBlVesselData] = useState<string | null>(null)
  const [blError, setBlError]           = useState<string | null>(null)
  const [blOpenSection, setBlOpenSection] = useState<Record<string,boolean>>({
    ref: true, vessel: true, pickup: true, turnin: false, items: true, containers: true, remarks: false,
  })
  const [blManualSections, setBlManualSections] = useState<Record<string,boolean>>({
    refs: true, transport: true, pickup: true, delays: true, goods: true,
  })
  const [showBlFrictionPopup, setShowBlFrictionPopup] = useState(false)
  const [prevBLs, setPrevBLs]           = useState<any[] | null>(null)
  const [prevBLsLoading, setPrevBLsLoading] = useState(false)
  const [blDocumentId, setBlDocumentId] = useState<string | null>(null)
  const [blCost, setBlCost]             = useState<{ usd: number; fcfa: number } | null>(null)
  const [blPreviewFile, setBlPreviewFile] = useState<File | null>(null)
  const [blPreviewUrl, setBlPreviewUrl]   = useState<string | null>(null)
  const [blPreviewIsPdf, setBlPreviewIsPdf] = useState(false)
  const [showCostPopup, setShowCostPopup] = useState(false)
  const [pendingAction, setPendingAction] = useState<'bl' | 'voice' | null>(null)
  const [premiumAccepted, setPremiumAccepted] = useState(false)
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [blSearch, setBlSearch]         = useState('')

  const [openRecap, setOpenRecap] = useState<Record<string, boolean>>({
    cat: true, equip: true, log: true, desc: true,
  })

  const uploadRef       = useRef<HTMLInputElement>(null)
  const vesselUploadRef = useRef<HTMLInputElement>(null)
  const activeVesselRef = useRef<number | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/login`); return }
    setUser(u)
  }, [locale])


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
    if (!user) return
    // Charge depuis le cache si offline
    const cached = parseInt(localStorage.getItem('eolis_credits_cache') ?? '-1')
    if (!navigator.onLine && cached >= 0) { setCreditsRemaining(cached); return }
    apiFetch('/api/credits/balance')
      .then(r => r.json())
      .then(d => {
        const rem = Math.round(d.creditsRemaining ?? 0)
        setCreditsRemaining(rem)
        localStorage.setItem('eolis_credits_cache', String(rem))
      })
      .catch(() => {})
  }, [user])

  const isFr         = locale === 'fr'
  const categories   = isFr ? CATEGORIES_FR : CATEGORIES_EN
  const subcatMap    = isFr ? SUBCATEGORIES_FR : SUBCATEGORIES_EN
  const equipOptions = isFr ? EQUIPMENT_FR : EQUIPMENT_EN
  const subcategories = form.category ? (subcatMap[form.category] ?? []) : []

  const finalCategory = (form.category === 'Autre' || form.category === 'Other') ? form.categoryOther : form.category
  const finalSubcat   = (form.subcategory === 'Autre' || form.subcategory === 'Other') ? form.subcategoryOther : form.subcategory

  const isMultiSeparate = mode === 'multi' && sameVessel === false

  function buildMultiEquipment(): string {
    const vesselPart = sameVessel === true
      ? (isFr ? ' — même navire' : ' — same vessel')
      : sameVessel === false
        ? (isFr ? ' — navires distincts' : ' — separate vessels')
        : ''
    const parts = containers
      .filter(c => (c.type && c.type !== 'Autre' && c.type !== 'Other') || c.typeOther.trim())
      .map(c => {
        const t   = (c.type === 'Autre' || c.type === 'Other') ? c.typeOther.trim() : c.type
        const num = c.number.trim() ? ` [${c.number.trim()}]` : ''
        return `${t}${num}`
      })
    return `MULTI${vesselPart} : ${parts.join(' | ')}`
  }

  const finalEquipment = mode === 'multi'
    ? buildMultiEquipment()
    : mode === 'conventionnel'
    ? (isFr ? `Conventionnel : ${form.conventionnelDesc}` : `Conventional: ${form.conventionnelDesc}`)
    : (() => {
        const base = (form.equipmentType === 'Autre' || form.equipmentType === 'Other') ? form.equipmentOther : form.equipmentType
        return form.containerNumber.trim() ? `${base} [${form.containerNumber.trim()}]` : base
      })()

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function set(key: keyof FormState, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }
  function shortOpt(opt: string) {
    return opt.replace(' pieds', 'p').replace(' feet', 'ft')
      .replace('Conventionnel', 'Conv.').replace('Conventional', 'Conv.')
  }
  function toggleRecap(k: string) {
    setOpenRecap(prev => ({ ...prev, [k]: !prev[k] }))
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    Array.from(incoming).forEach(f => {
      setFiles(prev => [...prev, f])
      const reader = new FileReader()
      reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string])
      reader.readAsDataURL(f)
    })
  }
  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  function openVesselUpload(vesselId: number) {
    activeVesselRef.current = vesselId
    vesselUploadRef.current?.click()
  }
  function handleVesselUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const vid = activeVesselRef.current
    if (!vid || !e.target.files) return
    Array.from(e.target.files).forEach(f => {
      const reader = new FileReader()
      reader.onload = ev => {
        setVessels(prev => prev.map(v =>
          v.id === vid ? { ...v, files: [...v.files, f], previews: [...v.previews, ev.target?.result as string] } : v
        ))
      }
      reader.readAsDataURL(f)
    })
    e.target.value = ''
  }
  function removeVesselFile(vesselId: number, i: number) {
    setVessels(prev => prev.map(v =>
      v.id === vesselId
        ? { ...v, files: v.files.filter((_, idx) => idx !== i), previews: v.previews.filter((_, idx) => idx !== i) }
        : v
    ))
  }

  function addContainer() {
    setContainers(prev => [...prev, { id: nextCId, type: '', typeOther: '', number: '' }])
    setNextCId(n => n + 1)
  }
  function removeContainer(id: number) {
    setContainers(prev => prev.filter(c => c.id !== id))
  }
  function updateContainer(id: number, patch: Partial<Omit<ContainerEntry, 'id'>>) {
    setContainers(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function addVessel() {
    setVessels(prev => [...prev, {
      id: nextVId, shipLine: '', shipName: '', voyageNumber: '', shipDate: '',
      code: '', description: '', files: [], previews: [],
    }])
    setNextVId(n => n + 1)
  }
  function removeVessel(id: number) {
    setVessels(prev => prev.filter(v => v.id !== id))
  }
  function updateVessel(id: number, patch: Partial<Omit<VesselBlock, 'id' | 'files' | 'previews'>>) {
    setVessels(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v))
  }

  // ── BL Upload ─────────────────────────────────────────────────────────────────

  function buildBlFieldsFromRaw(r: any) {
    const p  = r.pickup   || {}
    const ti = r.turn_in  || {}
    return {
      bookingNo:       r.booking_no        || '',
      date:            r.date              || '',
      customerRef:     r.customer_ref      || '',
      service:         r.service           || '',
      vessel:          r.vessel            || '',
      voyage:          r.voyage            || '',
      ets:             r.ets               || '',
      eta:             r.eta               || '',
      portOfLoading:   r.port_of_loading   || '',
      portOfDischarge: r.port_of_discharge || '',
      placeOfReceipt:  r.place_of_receipt  || '',
      placeOfDelivery: r.place_of_delivery || '',
      pickup: {
        reference:      p.reference       || '',
        quantity:       String(p.quantity ?? ''),
        sizeType:       p.size_type       || '',
        depot:          p.depot           || '',
        containerUsage: p.container_usage || '',
        releaseDate:    p.release_date    || '',
      },
      turnIn: {
        reference:       ti.reference        || '',
        terminal:        ti.terminal         || '',
        terminalClosing: ti.terminal_closing || '',
        vgmClosing:      ti.vgm_closing      || '',
        customsClosing:  ti.customs_closing  || '',
      },
      bookingItems: (r.booking_items || []).map((it: any) => ({
        item:               String(it.item ?? ''),
        noOfPacks:          String(it.no_of_packs ?? ''),
        kindOfPack:         it.kind_of_pack         || '',
        descriptionOfGoods: it.description_of_goods || '',
        linerTerms:         it.liner_terms          || '',
        imo:                it.imo                  || '',
        grossWeightTons:    String(it.gross_weight_tons ?? ''),
        measurementCbm:     String(it.measurement_cbm  ?? ''),
      })),
      containerDetails: (r.container_details || []).map((cd: any) => ({
        containerNo: cd.container_no || '',
        setPoint:    cd.set_point    || '',
        vent:        cd.vent         || '',
        drains:      cd.drains       || '',
        humidity:    cd.humidity     || '',
        remarks:     cd.remarks      || '',
      })),
      remarks: r.remarks || '',
    }
  }

  async function handleBLFile(file: File) {
    setBlError(null)
    setBlUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiUpload('/api/bl/extract', fd)
      if (res.ok) {
        const data = await res.json()
        setBlFields(buildBlFieldsFromRaw(data.raw || {}))
        setBlDocumentId(data.bl_id ?? null)
        setBlCost(data.cost_usd != null ? { usd: data.cost_usd, fcfa: data.cost_fcfa } : null)
        setBlStep('review')
        // Cache pour usage offline
        if (data.bl_id) {
          await offlineDb.set(`bl_raw_${data.bl_id}`, { bl_id: data.bl_id, raw: data.raw, vesselData: data.vesselData })
          const listCache = (await offlineDb.get('bl_list') as any[] | null) ?? []
          const r = data.raw || {}
          const newEntry = { id: data.bl_id, bookingNo: r.booking_no || null, vessel: r.vessel || null, voyage: r.voyage || null, portOfLoading: r.port_of_loading || null, portOfDischarge: r.port_of_discharge || null, ets: r.ets || null }
          await offlineDb.set('bl_list', [newEntry, ...listCache.filter((b: any) => b.id !== data.bl_id)])
        }
      } else {
        const err = await res.json().catch(() => ({}))
        setBlError(err.detail || (isFr ? "Erreur lors de l'extraction." : 'Extraction error.'))
      }
    } catch {
      setBlError(isFr ? 'Erreur réseau. Vérifiez votre connexion.' : 'Network error. Check your connection.')
    }
    setBlUploading(false)
  }

  async function handleBLReuse(blId: string) {
    setPrevBLsLoading(true)
    try {
      if (!isOnline) {
        const cached = await offlineDb.get(`bl_raw_${blId}`) as any | null
        if (cached) {
          setBlFields(buildBlFieldsFromRaw(cached.raw || {}))
          setBlDocumentId(blId)
          setBlStep('review')
        }
        setPrevBLsLoading(false)
        return
      }
      const res = await apiFetch(`/api/bl/${blId}/raw`)
      if (res.ok) {
        const data = await res.json()
        setBlFields(buildBlFieldsFromRaw(data.raw || {}))
        setBlDocumentId(blId)   // ← bug fix: était manquant
        setBlStep('review')
        await offlineDb.set(`bl_raw_${blId}`, data)
      }
    } catch {}
    setPrevBLsLoading(false)
  }

  function showBLPreview(file: File) {
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
    setBlPreviewIsPdf(isPdf)
    setBlPreviewFile(file)
    setBlPreviewUrl(isPdf ? null : URL.createObjectURL(file))
  }

  function clearBLPreview() {
    if (blPreviewUrl) URL.revokeObjectURL(blPreviewUrl)
    setBlPreviewFile(null)
    setBlPreviewUrl(null)
    setBlPreviewIsPdf(false)
  }

  function confirmBLExtract() {
    if (!blPreviewFile) return
    const file = blPreviewFile
    clearBLPreview()
    handleBLFile(file)
  }

  async function handleBLUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    showBLPreview(file)
  }

  function updateBLF(path: string, value: string) {
    const parts = path.split('.')
    setBlFields((prev: any) => {
      if (parts.length === 1) return { ...prev, [parts[0]]: value }
      if (parts.length === 2) return { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } }
      if (parts.length === 3) {
        const [key, idx, field] = parts
        return { ...prev, [key]: prev[key].map((item: any, i: number) => i === parseInt(idx) ? { ...item, [field]: value } : item) }
      }
      return prev
    })
  }

  function resetBL() {
    setBlFields(null)
    setBlVesselData(null)
    setBlStep(prevBLs && prevBLs.length > 0 ? 'pick' : 'upload')
    setBlError(null)
    setForm(prev => ({
      ...prev,
      shipName: '', voyageNumber: '', shipDate: '', code: '',
      equipmentType: '', equipmentOther: '', description: '',
    }))
  }

  async function enterBLMode() {
    const credits = creditsRemaining ?? parseInt(localStorage.getItem('eolis_credits_cache') ?? '0')
    if (credits < 50) {
      router.push(`/${locale}/recharger`)
      return
    }
    const accepted = typeof window !== 'undefined' && localStorage.getItem('eolis_premium_accepted') === '1'
    if (!accepted) {
      setPendingAction('bl')
      setShowCostPopup(true)
      return
    }
    _launchBLMode()
  }

  async function _launchBLMode() {
    setPageMode('bl')
    setBlStep('pick')
    setPrevBLs(null)
    setBlSearch('')

    if (!isOnline) {
      const cached = (await offlineDb.get('bl_list') as any[] | null) ?? []
      setPrevBLs(cached)
      if (cached.length === 0) setBlStep('upload')
      return
    }

    try {
      const res = await apiFetch('/api/bl/my-bls')
      if (res.ok) {
        const data = await res.json()
        const bls = Array.isArray(data) ? data : []
        setPrevBLs(bls)
        if (bls.length === 0) setBlStep('upload')
        await offlineDb.set('bl_list', bls)
      } else {
        setPrevBLs([])
        setBlStep('upload')
      }
    } catch {
      setPrevBLs([])
      setBlStep('upload')
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function submit() {
    setSubmitting(true)
    try {
      const shipName     = isMultiSeparate ? (vessels[0]?.shipName || undefined)     : (form.shipName || undefined)
      const voyageNumber = isMultiSeparate ? (vessels[0]?.voyageNumber || undefined) : (form.voyageNumber || undefined)
      const shipDate     = isMultiSeparate ? (vessels[0]?.shipDate || undefined)     : (form.shipDate || undefined)

      let description = form.description
      if (isMultiSeparate && sameSituation === false) {
        description = vessels.map((v, i) => {
          const name = v.shipName || (isFr ? `Navire ${i + 1}` : `Vessel ${i + 1}`)
          const header = isFr ? `Navire ${i + 1} — ${name}` : `Vessel ${i + 1} — ${name}`
          return `${header} :\n${v.description}`
        }).join('\n\n')
      }

      const vesselData = isMultiSeparate
        ? JSON.stringify(vessels.map(v => ({
            shipName:      v.shipName || null,
            voyageNumber:  v.voyageNumber || null,
            shipDate:      v.shipDate || null,
            code:          v.code.trim() || null,
          })))
        : blVesselData
        ? blVesselData
        : (() => {
            const hasAny = [
              form.eta, form.portOfLoading, form.portOfDischarge,
              form.placeOfReceipt, form.placeOfDelivery,
              form.customerRef, form.service, form.blDate,
              form.bookingPartyName, form.bookingPartyRegion,
              form.pickupRef, form.pickupQty, form.pickupSizeType,
              form.pickupUsage, form.pickupDepot, form.pickupReleaseDate,
              form.terminal, form.terminalClosing, form.vgmClosing, form.customsClosing,
              form.descriptionOfGoods, form.noOfPacks, form.kindOfPack,
              form.linerTerms, form.imo, form.grossWeightTons, form.measurementCbm,
              form.containerTemp,
            ].some(v => v.trim())
            if (!hasAny) return undefined
            return JSON.stringify({
              vessel:             form.shipName      || null,
              voyage:             form.voyageNumber  || null,
              eta:                form.eta           || null,
              port_of_loading:    form.portOfLoading || null,
              port_of_discharge:  form.portOfDischarge || null,
              place_of_receipt:   form.placeOfReceipt  || null,
              place_of_delivery:  form.placeOfDelivery || null,
              customer_ref:       form.customerRef   || null,
              service:            form.service       || null,
              date:               form.blDate        || null,
              booking_party_name:   form.bookingPartyName   || null,
              booking_party_region: form.bookingPartyRegion || null,
              pickup: {
                reference:       form.pickupRef        || null,
                quantity:        form.pickupQty        || null,
                size_type:       form.pickupSizeType   || null,
                container_usage: form.pickupUsage      || null,
                depot:           form.pickupDepot      || null,
                release_date:    form.pickupReleaseDate || null,
              },
              turn_in: {
                terminal:         form.terminal        || null,
                terminal_closing: form.terminalClosing || null,
                vgm_closing:      form.vgmClosing      || null,
                customs_closing:  form.customsClosing  || null,
              },
              booking_items: [{
                description_of_goods: form.descriptionOfGoods || null,
                no_of_packs:          form.noOfPacks          || null,
                kind_of_pack:         form.kindOfPack         || null,
                liner_terms:          form.linerTerms         || null,
                imo:                  form.imo                || null,
                gross_weight_tons:    form.grossWeightTons    || null,
                measurement_cbm:      form.measurementCbm     || null,
              }],
              container_details: form.containerTemp ? [{
                container_no: form.containerNumber || null,
                set_point:    form.containerTemp   || null,
              }] : [],
            })
          })()

      const body = {
        category:       finalCategory,
        subcategory:    finalSubcat || undefined,
        equipmentType:  finalEquipment || undefined,
        shipName, voyageNumber, shipDate,
        code:           isMultiSeparate ? undefined : (form.code.trim() || undefined),
        vesselData,
        blDocumentId:   blDocumentId || undefined,
        ticketMode:     pageMode === 'bl' ? 'BL_PREMIUM' : 'MANUEL',
        description,
        urgency: getUrgency(finalCategory, finalSubcat),
      }

      // ── Offline check ────────────────────────────────────────────────────────
      if (!navigator.onLine) {
        // Collect all files as ArrayBuffer (IndexedDB-serializable)
        const storedFiles = await (async () => {
          if (isMultiSeparate && sameSituation === false) {
            const result = []
            for (let i = 0; i < vessels.length; i++) {
              const v = vessels[i]
              if (!v || v.files.length === 0) continue
              const vesselName = v.shipName || (isFr ? `Navire ${i + 1}` : `Vessel ${i + 1}`)
              const source = isFr ? `Navire ${i + 1} — ${vesselName}` : `Vessel ${i + 1} — ${vesselName}`
              for (const f of v.files) result.push(await fileToStored(f, source))
            }
            return result
          }
          return Promise.all(files.map(f => fileToStored(f)))
        })()

        await offlineDb.add({ type: 'CREATE_TICKET', payload: body as Record<string, unknown>, files: storedFiles })
        setPendingHadFiles(storedFiles.length > 0)
        setPendingOffline(true)
        setSubmitting(false)
        return
      }

      const res = await apiFetch('/api/tickets', { method: 'POST', body: JSON.stringify(body) })
      if (res.ok) {
        const data = await res.json()
        if (isMultiSeparate && sameSituation === false) {
          for (let i = 0; i < vessels.length; i++) {
            const v = vessels[i]
            if (v.files.length === 0) continue
            const vesselName = v.shipName || (isFr ? `Navire ${i + 1}` : `Vessel ${i + 1}`)
            const src = isFr ? `Navire ${i + 1} — ${vesselName}` : `Vessel ${i + 1} — ${vesselName}`
            const fd = new FormData()
            v.files.forEach(f => fd.append('files', f))
            await apiUpload(`/api/tickets/${data.id}/attachments?source=${encodeURIComponent(src)}`, fd).catch(() => {})
          }
        } else if (files.length > 0) {
          const fd = new FormData()
          files.forEach(f => fd.append('files', f))
          await apiUpload(`/api/tickets/${data.id}/attachments`, fd).catch(() => {})
        }
        // Lier les enregistrements voix (description step) au ticket créé
        if (data.id) {
          apiFetch(`/api/ai-usage/link-to-ticket/${data.id}`, { method: 'POST' }).catch(() => {})
        }
        setSuccess({ ref: data.ref ?? '', id: data.id ?? '' })
      }
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  async function submitInfo() {
    setSubmitting(true)
    try {
      const ticketMode = pageMode === 'info-premium' ? 'INFO_PREMIUM' : 'INFO_SIMPLE'
      const body: Record<string, unknown> = {
        category:    isFr ? 'Demande d\'information' : 'Information request',
        ticketMode,
        subject:     infoSubject.trim() || undefined,
        description: form.description,
        urgency:     'LOW',
      }

      if (!navigator.onLine) {
        const storedFiles = await Promise.all(files.map(f => fileToStored(f)))
        await offlineDb.add({ type: 'CREATE_TICKET', payload: body, files: storedFiles })
        setPendingHadFiles(storedFiles.length > 0)
        setPendingOffline(true)
        setSubmitting(false)
        return
      }

      const res = await apiFetch('/api/tickets', { method: 'POST', body: JSON.stringify(body) })
      if (res.ok) {
        const data = await res.json()
        if (files.length > 0) {
          const fd = new FormData()
          files.forEach(f => fd.append('files', f))
          await apiUpload(`/api/tickets/${data.id}/attachments`, fd).catch(() => {})
        }
        if (data.id && pageMode === 'info-premium') {
          apiFetch(`/api/ai-usage/link-to-ticket/${data.id}`, { method: 'POST' }).catch(() => {})
        }
        setSuccess({ ref: data.ref ?? '', id: data.id ?? '' })
      }
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  if (!user) return null

  // ── Translations ──────────────────────────────────────────────────────────────

  const t = isFr ? {
    title:       'Nouvelle demande',
    stepLabels:  ['Catégorie', 'Équipement', 'Logistique', 'Description', 'Récap'],
    catTitle:    'Catégorie de la demande',
    catSub:      'Choisissez la catégorie la plus adaptée',
    subcatTitle: 'Type de problème',
    otherLabel:  'Précisez...',
    modeSimple:  'Conteneur unique',
    modeMulti:   'Multi-conteneurs',
    modeConv:    'Conventionnel',
    convTitle:   'Nature de la marchandise',
    convSub:     'Décrivez la nature de la marchandise concernée par cette demande',
    convPh:      'Ex: 3 vélos, 2 caisses de mobilier...',
    equipTitle:  "Type d'équipement",
    equipSub:    'Sélectionnez le type de conteneur concerné',
    multiTitle:  'Vos conteneurs',
    multiSub:    'Ajoutez chaque conteneur concerné par cette demande',
    addCont:     'Ajouter un conteneur',
    typeLabel: 'Type', qtyLabel: 'Quantité', numLabel: 'N° conteneur', numHint: 'Ex : MSCU1234567',
    sameVessel: 'Tous les conteneurs sont-ils sur le même navire ?',
    addVessel: 'Ajouter un navire', vesselLabel: 'Navire',
    sameSit: 'Tous les conteneurs ont-ils la même situation ?',
    yes: 'Oui', no: 'Non',
    uploadHint: 'BL, factures, photos... Autant de fichiers que nécessaire.',
    addFile: 'Ajouter', scan: 'Scanner → PDF', filesAdded: 'fichier(s)',
    logTitle: 'Informations logistiques',
    logSub:   'Ces informations accélèrent le traitement de votre demande',
    blCode:   'N° BL / Code dossier',
    shipName: 'Nom du navire',
    voyageNo: 'Numéro de voyage', shipDate: 'ETS (départ estimé)', optional: 'Optionnel',
    descTitle:           'Décrivez votre situation',
    descSub:             'Plus vous êtes précis, mieux nous pouvons vous aider',
    descPlaceholder:     'Expliquez votre problème en détail...',
    descVesselSub:       'Décrivez la situation pour les conteneurs de ce navire',
    descVesselPh:        'Ex : Le conteneur est bloqué au port depuis le...',
    recap:       'Récapitulatif', recapSub: "Vérifiez toutes les informations avant d'envoyer",
    catLabel:    'Catégorie', subcatLabel: 'Sous-catégorie', equipment: 'Équipement',
    containers:  'Conteneurs', vessel: 'Navire', vessels: 'Navires',
    documents:   'Documents',  noDoc: 'Aucun document', descLabel: 'Description',
    logistique:  'Logistique',
    noLog:       'Aucune information logistique renseignée',
    next: 'Continuer', back: 'Retour', submit: 'Envoyer ma demande',
    successTitle: 'Demande envoyée !',
    successSub:   'Votre dossier a été créé. Un agent va prendre en charge votre demande.',
    yourRef: 'Votre référence', viewFile: 'Voir mon dossier', backHome: "Retour à l'accueil",
  } : {
    title:       'New request',
    stepLabels:  ['Category', 'Equipment', 'Logistics', 'Description', 'Review'],
    catTitle:    'Request category', catSub: 'Choose the most appropriate category',
    subcatTitle: 'Type of issue',    otherLabel: 'Specify...',
    modeSimple:  'Single container', modeMulti: 'Multi-container',
    modeConv:    'Conventional',
    convTitle:   'Nature of goods',
    convSub:     'Describe the nature of the goods related to this request',
    convPh:      'E.g.: 3 bicycles, 2 boxes of furniture...',
    equipTitle:  'Equipment type',   equipSub: 'Select the type of container involved',
    multiTitle:  'Your containers',  multiSub: 'Add each container involved in this request',
    addCont:     'Add a container',
    typeLabel: 'Type', qtyLabel: 'Quantity', numLabel: 'Container no.', numHint: 'e.g. MSCU1234567',
    sameVessel: 'Are all containers on the same vessel?',
    addVessel: 'Add a vessel', vesselLabel: 'Vessel',
    sameSit: 'Do all containers share the same situation?',
    yes: 'Yes', no: 'No',
    uploadHint: 'BL, invoices, photos... As many files as needed.',
    addFile: 'Add files', scan: 'Scan → PDF', filesAdded: 'file(s)',
    logTitle: 'Logistics information',
    logSub:   'This information speeds up the processing of your request',
    blCode:   'BL no. / File code',
    shipName: 'Ship name',
    voyageNo: 'Voyage number', shipDate: 'ETS (estimated departure)', optional: 'Optional',
    descTitle:           'Describe your situation',
    descSub:             'The more precise you are, the better we can help',
    descPlaceholder:     'Explain your issue in detail...',
    descVesselSub:       'Describe the situation for the containers on this vessel',
    descVesselPh:        'E.g.: The container has been blocked at the port since...',
    recap:       'Summary', recapSub: 'Review all information before sending',
    catLabel:    'Category', subcatLabel: 'Subcategory', equipment: 'Equipment',
    containers:  'Containers', vessel: 'Vessel', vessels: 'Vessels',
    documents:   'Documents',  noDoc: 'No document', descLabel: 'Description',
    logistique:  'Logistics',
    noLog:       'No logistics information provided',
    next: 'Continue', back: 'Back', submit: 'Send my request',
    successTitle: 'Request sent!',
    successSub:   'Your file has been created. An agent will handle your request soon.',
    yourRef: 'Your reference', viewFile: 'View my file', backHome: 'Back to home',
  }

  const lbl: LogisticsLabels = {
    shipName: t.shipName,
    voyageNo: t.voyageNo, shipDate: t.shipDate, optional: t.optional,
  }

  const stepOrder: Step[] = ['categorie', 'equipement', 'logistique', 'description', 'recap']
  const stepIdx = stepOrder.indexOf(step)

  const subcatList = isFr
    ? (SUBCATEGORIES_FR[form.category] ?? [])
    : (SUBCATEGORIES_EN[form.category] ?? [])
  const needsSubcat = subcatList.length > 0
  const canStep1 = !!form.category &&
    (form.category !== 'Autre' && form.category !== 'Other' ? true : !!form.categoryOther.trim()) &&
    (!needsSubcat || (!!form.subcategory &&
      (form.subcategory !== 'Autre' && form.subcategory !== 'Other' ? true : !!form.subcategoryOther.trim())))

  const canStep2 = mode === 'conventionnel'
    ? form.conventionnelDesc.trim().length >= 3
    : mode === 'simple'
    ? (!!form.equipmentType && (form.equipmentType !== 'Autre' && form.equipmentType !== 'Other' ? true : !!form.equipmentOther.trim()))
    : containers.some(c => {
        if (!c.type) return false
        if (c.type === 'Autre' || c.type === 'Other') return c.typeOther.trim().length > 0
        return true
      })

  const canStep3 = (() => {
    // Conventionnel: only BL code required
    if (mode === 'conventionnel') return !!form.code.trim()
    // Multi mode: must choose same vessel or not before continuing
    if (mode === 'multi' && sameVessel === null) return false
    // Multi mode — separate vessels: each vessel needs ship name + BL code
    if (isMultiSeparate && sameVessel === false) {
      return vessels.every(v => v.shipName.trim().length > 0 && v.code.trim().length > 0)
    }
    // Simple mode OR multi same vessel: require ship name + BL code
    return !!form.shipName.trim() && !!form.code.trim()
  })()

  const canNextDesc = (() => {
    if (!isMultiSeparate || sameVessel !== false) return form.description.trim().length >= 10
    if (sameSituation === null) return false
    if (sameSituation === true) return form.description.trim().length >= 10
    return vessels.every(v => v.description.trim().length >= 10)
  })()

  // ── Success ───────────────────────────────────────────────────────────────────

  if (pendingOffline) {
    return (
      <MobileLayout locale={locale} title={isFr ? 'Dossier sauvegardé' : 'Request saved'}>
        <div className="flex flex-col items-center text-center pt-10 pb-4">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-white/10 animate-ping opacity-40" />
            <div className="relative w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
              <WifiOff size={40} className="text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {isFr ? 'Dossier sauvegardé !' : 'Request saved!'}
          </h2>
          <p className="text-sm text-blue-100 mb-5 max-w-xs leading-relaxed">
            {isFr
              ? 'Vous êtes hors-ligne. Votre dossier (avec vos documents) sera envoyé automatiquement dès que vous aurez du réseau.'
              : 'You are offline. Your request (including documents) will be sent automatically when you reconnect.'}
          </p>
          <div className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 mb-6">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-xs text-blue-100 font-medium">
                {isFr ? 'En attente de connexion...' : 'Waiting for connection...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/${locale}/accueil`)}
            className="w-full py-3.5 rounded-2xl border-2 border-white/30 text-white font-medium active:opacity-70"
          >
            {isFr ? "Retour à l'accueil" : 'Back to home'}
          </button>
        </div>
      </MobileLayout>
    )
  }

  if (success) {
    return (
      <MobileLayout locale={locale} title={t.successTitle}>
        <div className="flex flex-col items-center text-center pt-10 pb-4">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-40" />
            <div className="relative w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
              <Star size={40} className="text-emerald-500 fill-emerald-500 animate-bounce" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{t.successTitle}</h2>
          <p className="text-sm text-blue-100 mb-8 max-w-xs leading-relaxed">{t.successSub}</p>
          <div className="w-full bg-white/15 border border-white/30 rounded-2xl p-5 mb-6">
            <p className="text-xs text-blue-200 font-medium mb-1">{t.yourRef}</p>
            <p className="text-2xl font-bold text-white font-mono tracking-widest">{success.ref}</p>
          </div>
          <button
            onClick={() => router.push(`/${locale}/mes-demandes/${success.id}`)}
            className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold mb-3 active:opacity-80"
          >
            {t.viewFile}
          </button>
          <button
            onClick={() => router.push(`/${locale}/accueil`)}
            className="w-full py-3.5 rounded-2xl border-2 border-white/30 text-white font-medium active:opacity-70"
          >
            {t.backHome}
          </button>
        </div>
      </MobileLayout>
    )
  }

  // ── Premium features popup ────────────────────────────────────────────────────

  if (showCostPopup) {
    return (
      <MobileLayout locale={locale} title={isFr ? 'Nouvelle demande' : 'New request'} showBack>
        <div className="flex flex-col gap-4 pt-2">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h2 className="text-base font-bold text-white">
                {isFr ? 'Fonctionnalités Premium' : 'Premium Features'}
              </h2>
              <p className="text-xs text-blue-200 mt-0.5">
                {isFr
                  ? "Ces fonctionnalités avancées génèrent un coût en crédits."
                  : 'These advanced features consume premium credits.'}
              </p>
            </div>
          </div>

          {/* Feature: BL extraction */}
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

          {/* Feature: Voice */}
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

          {/* Cost estimate */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs font-bold text-white/60 uppercase tracking-wide mb-2">
              {isFr ? 'Estimation par dossier typique' : 'Estimate per typical file'}
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-blue-200">
                <span>{isFr ? '1 extraction BL' : '1 BL extraction'}</span>
                <span className="font-mono">50 crédits</span>
              </div>
              <div className="flex justify-between text-blue-200">
                <span>{isFr ? '2 min de dictée' : '2 min dictation'}</span>
                <span className="font-mono">20 crédits</span>
              </div>
              <div className="border-t border-white/10 pt-1 flex justify-between text-white font-bold">
                <span>{isFr ? 'Total estimé' : 'Estimated total'}</span>
                <span className="font-mono">70 crédits</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/15 border border-amber-400/30 rounded-2xl p-3 flex items-start gap-2">
            <span className="text-amber-400 flex-shrink-0">⚠️</span>
            <p className="text-xs text-amber-200">
              {isFr
                ? "Si vous uploadez un mauvais fichier, les 50 crédits seront quand même déduits, même si le dossier n'est pas créé."
                : "If you upload the wrong file, 50 credits will still be deducted, even if the file is not created."}
            </p>
          </div>

          {/* Notifications */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-white/60 uppercase tracking-wide">
              {isFr ? 'Notifications sur ce dossier' : 'Notifications for this file'}
            </p>
            <div className="space-y-1.5 text-xs text-blue-200">
              <div className="flex items-center gap-2"><span>✉️</span><span>{isFr ? 'Email — gratuit, toujours actif' : 'Email — free, always active'}</span></div>
              <div className="flex items-center gap-2"><span>📲</span><span>{isFr ? 'Push téléphone — gratuit, toujours actif' : 'Phone push — free, always active'}</span></div>
              <div className="flex items-center gap-2 text-blue-300"><span>📱</span><span>{isFr ? 'SMS — 160 crédits/SMS, activable après création (max 2 : demande docs + réponse finale)' : 'SMS — 160 credits/SMS, enable after creation (max 2: doc request + final response)'}</span></div>
            </div>
            <p className="text-[10px] text-blue-400">1 crédit = 1 FCFA</p>
          </div>

          {/* Checkbox */}
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

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setShowCostPopup(false); setPendingAction(null) }}
              className="py-3.5 rounded-2xl border border-white/30 text-white text-sm font-medium">
              {isFr ? 'Annuler' : 'Cancel'}
            </button>
            <button
              onClick={() => {
                setPremiumAccepted(true)
                setShowCostPopup(false)
                if (pendingAction === 'bl') _launchBLMode()
                setPendingAction(null)
              }}
              className="py-3.5 rounded-2xl bg-white text-[#1B3A5C] text-sm font-bold">
              {isFr ? "J'ai compris →" : "I understand →"}
            </button>
          </div>
        </div>
      </MobileLayout>
    )
  }

  // ── Mode selection helpers (outside conditionals to avoid React issues) ─────────

  const hasEnoughForBL   = creditsRemaining === null || creditsRemaining >= 50
  const hasEnoughForInfo = creditsRemaining === null || creditsRemaining >= 5

  const creditsBar = creditsRemaining !== null ? (
    <div className={`flex items-center justify-between rounded-2xl px-4 py-3 border ${
      creditsRemaining > 0 ? 'bg-white/10 border-white/15' : 'bg-red-500/15 border-red-400/30'
    }`}>
      <div className="flex items-center gap-2">
        <Zap size={15} className={creditsRemaining > 0 ? 'text-amber-300' : 'text-red-300'} />
        <div>
          <p className="text-sm text-white">
            {isFr ? 'Solde :' : 'Balance:'}
            <span className="font-bold ml-1">{Math.round(creditsRemaining)} crédits</span>
          </p>
          <p className="text-[10px] text-blue-300">1 crédit = 1 FCFA</p>
        </div>
      </div>
      {creditsRemaining <= 0 && (
        <button onClick={() => router.push(`/${locale}/recharger`)}
          className="text-xs font-bold text-red-300 underline">
          {isFr ? 'Recharger' : 'Top up'}
        </button>
      )}
    </div>
  ) : null

  // ── Info Premium popup (AVANT !pageMode pour éviter que !pageMode l'écrase) ──

  if (showInfoPremiumPopup) {
    return (
      <MobileLayout locale={locale} title={isFr ? 'Nouvelle demande' : 'New request'} showBack>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h2 className="text-base font-bold text-white">
                {isFr ? 'Demande d\'info Premium' : 'Premium Information Request'}
              </h2>
              <p className="text-xs text-blue-200 mt-0.5">
                {isFr ? 'Ce mode débloque des fonctionnalités avancées.' : 'This mode unlocks advanced features.'}
              </p>
            </div>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎙️</span>
              <p className="text-sm font-bold text-white">{isFr ? 'Dictée vocale dans la description' : 'Voice dictation in description'}</p>
            </div>
            <p className="text-xs text-blue-300 pl-7">10 crédits / min</p>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">💬</span>
              <p className="text-sm font-bold text-white">{isFr ? 'Voice dans le chat du dossier' : 'Voice in the ticket chat'}</p>
            </div>
            <p className="text-xs text-blue-300 pl-7">10 crédits / min</p>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">∞</span>
              <p className="text-sm font-bold text-white">{isFr ? 'Description sans limite de caractères' : 'Unlimited description length'}</p>
            </div>
            <p className="text-xs text-blue-100 pl-7">{isFr ? '→ Exprimez-vous librement' : '→ Express yourself freely'}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-xs font-bold text-white/60 uppercase tracking-wide mb-2">
              {isFr ? 'Estimation par dossier' : 'Estimate per request'}
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-blue-200">
                <span>{isFr ? 'Ouverture du dossier' : 'Request opening'}</span>
                <span className="font-mono">5 crédits</span>
              </div>
              <div className="flex justify-between text-blue-200">
                <span>{isFr ? '2 min de dictée' : '2 min dictation'}</span>
                <span className="font-mono">20 crédits</span>
              </div>
              <div className="border-t border-white/10 pt-1 flex justify-between text-white font-bold">
                <span>{isFr ? 'Total estimé' : 'Estimated total'}</span>
                <span className="font-mono">25 crédits</span>
              </div>
            </div>
          </div>


          {/* Notifications */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-white/60 uppercase tracking-wide">
              {isFr ? 'Notifications sur ce dossier' : 'Notifications for this file'}
            </p>
            <div className="space-y-1.5 text-xs text-blue-200">
              <div className="flex items-center gap-2"><span>✉️</span><span>{isFr ? 'Email — gratuit, toujours actif' : 'Email — free, always active'}</span></div>
              <div className="flex items-center gap-2"><span>📲</span><span>{isFr ? 'Push téléphone — gratuit, toujours actif' : 'Phone push — free, always active'}</span></div>
              <div className="flex items-center gap-2 text-blue-300"><span>📱</span><span>{isFr ? 'SMS — 160 crédits/SMS, activable après création (réponse finale)' : 'SMS — 160 credits/SMS, enable after creation (final response)'}</span></div>
            </div>
            <p className="text-[10px] text-blue-400">1 crédit = 1 FCFA</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded"
              onChange={e => {
                if (e.target.checked) localStorage.setItem('eolis_info_premium_accepted', '1')
                else localStorage.removeItem('eolis_info_premium_accepted')
              }} />
            <span className="text-xs text-blue-200">
              {isFr ? 'Ne plus afficher ce message' : "Don't show this again"}
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowInfoPremiumPopup(false)}
              className="py-3.5 rounded-2xl border border-white/30 text-white text-sm font-medium">
              {isFr ? 'Annuler' : 'Cancel'}
            </button>
            <button
              onClick={() => {
                setShowInfoPremiumPopup(false)
                setPageMode('info-premium')
                setInfoStep('form')
              }}
              className="py-3.5 rounded-2xl bg-white text-[#1B3A5C] text-sm font-bold">
              {isFr ? "J'ai compris →" : "I understand →"}
            </button>
          </div>
        </div>
      </MobileLayout>
    )
  }

  // ── Mode selection ────────────────────────────────────────────────────────────

  if (!pageMode) {
    // ── Level 1: J'ai un colis / J'ai une question ──
    if (tier === null) {
      return (
        <MobileLayout locale={locale} title={t.title} showBack>
          <div className="space-y-4 pt-2">
            {creditsBar}
            <p className="text-sm text-blue-100 text-center">
              {isFr ? 'Quelle est votre situation ?' : 'What is your situation?'}
            </p>

            <button onClick={() => setTier('simple')}
              className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-5 text-left active:scale-[0.99] transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Package size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-white mb-1">
                    {isFr ? '📦 J\'ai un colis / BL' : '📦 I have a shipment / BL'}
                  </p>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    {isFr
                      ? 'Vous avez une question sur un colis précis ? Livraison, conteneur bloqué, dossier en cours... et vous disposez du numéro BL ou Booking correspondant.'
                      : 'You have a question about a specific shipment? Delivery, blocked container, ongoing file... and you have the corresponding BL or Booking number.'}
                  </p>
                </div>
              </div>
            </button>

            <button onClick={() => setTier('premium')}
              className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-5 text-left active:scale-[0.99] transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-white mb-1">
                    {isFr ? '💬 J\'ai une question' : '💬 I have a question'}
                  </p>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    {isFr
                      ? 'Vous cherchez une information générale : procédure, tarif, délai, réglementation... sans BL associé.'
                      : 'You\'re looking for general information: procedure, pricing, timeline, regulations... without an associated BL.'}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </MobileLayout>
      )
    }

    // ── Level 2: Colis → Saisie manuelle / Scan Eagle BL ──
    if (tier === 'simple') {
      return (
        <MobileLayout locale={locale} title={isFr ? 'J\'ai un colis / BL' : 'I have a shipment / BL'} showBack>
          <div className="space-y-4 pt-2">
            {creditsBar}
            <p className="text-sm text-blue-100 text-center">
              {isFr ? 'Comment souhaitez-vous créer votre demande ?' : 'How would you like to create your request?'}
            </p>

            <button onClick={() => setPageMode('manual')}
              className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-5 text-left active:scale-[0.99] transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <FileText size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-white mb-1">{isFr ? 'Saisie manuelle' : 'Manual entry'}</p>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    {isFr
                      ? 'Je renseigne moi-même le BL, le navire et la logistique'
                      : 'I fill in the BL, vessel and logistics myself'}
                  </p>
                  <p className="text-[10px] text-blue-300 mt-2">📲 Push · ✉️ Email</p>
                </div>
              </div>
            </button>

            <button onClick={enterBLMode}
              className={`w-full rounded-2xl p-5 text-left active:scale-[0.99] transition-all ${
                hasEnoughForBL
                  ? 'bg-white/10 border-2 border-[#4A8FC4]/60'
                  : 'bg-white/5 border-2 border-red-400/40 opacity-80'
              }`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  hasEnoughForBL ? 'bg-[#4A8FC4]/30' : 'bg-red-500/20'
                }`}>
                  <Upload size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-base font-bold text-white">⚡ Scan Eagle BL</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      hasEnoughForBL ? 'text-[#4A8FC4] bg-[#4A8FC4]/20' : 'text-red-300 bg-red-400/20'
                    }`}>50 crédits</span>
                  </div>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    {isFr
                      ? 'Importez votre Booking Confirmation Eagle — le formulaire se remplit seul'
                      : 'Import your Eagle Booking Confirmation — the form fills itself'}
                  </p>
                  {!hasEnoughForBL && (
                    <p className="text-xs text-red-300 font-semibold mt-1.5">
                      {isFr
                        ? `Crédits insuffisants — 50 requis, vous en avez ${Math.round(creditsRemaining ?? 0)}`
                        : `Insufficient credits — need 50, you have ${Math.round(creditsRemaining ?? 0)}`}
                    </p>
                  )}
                  {hasEnoughForBL && creditsRemaining !== null && (
                    <p className="text-[10px] text-blue-300 mt-1">
                      {isFr
                        ? `Il vous restera ${Math.round(creditsRemaining - 50)} crédits après`
                        : `You will have ${Math.round(creditsRemaining - 50)} credits left after`}
                    </p>
                  )}
                  <p className="text-[10px] text-blue-300 mt-1.5">📲 Push · ✉️ Email · 📱 SMS optionnel</p>
                </div>
              </div>
            </button>

            <button onClick={() => setTier(null)}
              className="w-full py-2.5 rounded-2xl border-2 border-white/10 text-white/50 text-sm font-medium">
              ← {isFr ? 'Retour' : 'Back'}
            </button>
          </div>
        </MobileLayout>
      )
    }

    // ── Level 2: Question → Standard / Premium ──
    if (tier === 'premium') {
      return (
        <MobileLayout locale={locale} title={isFr ? 'J\'ai une question' : 'I have a question'} showBack>
          <div className="space-y-4 pt-2">
            {creditsBar}
            <p className="text-sm text-blue-100 text-center">
              {isFr ? 'Quel type de suivi souhaitez-vous ?' : 'What type of follow-up do you want?'}
            </p>

            {/* Standard */}
            <button onClick={() => {
                set('description', '')
                setInfoSubject('')
                setFiles([])
                setPreviews([])
                setInfoStep('form')
                setPageMode('info-simple')
              }}
              className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-5 text-left active:scale-[0.99] transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-white mb-1">{isFr ? 'Standard' : 'Standard'}</p>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    {isFr ? 'Écrivez votre question, réponse sous 24h' : 'Write your question, response within 24h'}
                  </p>
                  <p className="text-[10px] text-blue-300 mt-2">📲 Push · ✉️ Email</p>
                </div>
              </div>
            </button>

            {/* Premium ⚡ */}
            <button
              onClick={() => {
                if (!hasEnoughForInfo) { router.push(`/${locale}/recharger`); return }
                set('description', '')
                setInfoSubject('')
                setFiles([])
                setPreviews([])
                setInfoStep('form')
                const accepted = typeof window !== 'undefined' && localStorage.getItem('eolis_info_premium_accepted') === '1'
                if (!accepted) { setShowInfoPremiumPopup(true); return }
                setPageMode('info-premium')
              }}
              className={`w-full rounded-2xl p-5 text-left active:scale-[0.99] transition-all ${
                hasEnoughForInfo
                  ? 'bg-white/10 border-2 border-[#4A8FC4]/60'
                  : 'bg-white/5 border-2 border-red-400/40 opacity-80'
              }`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  hasEnoughForInfo ? 'bg-[#4A8FC4]/30' : 'bg-red-500/20'
                }`}>
                  <Zap size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-base font-bold text-white">⚡ Premium</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      hasEnoughForInfo ? 'text-[#4A8FC4] bg-[#4A8FC4]/20' : 'text-red-300 bg-red-400/20'
                    }`}>5 crédits</span>
                  </div>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    {isFr
                      ? 'Dictée vocale · Texte sans limite de caractères'
                      : 'Voice dictation · Unlimited text length'}
                  </p>
                  {!hasEnoughForInfo && (
                    <p className="text-xs text-red-300 font-semibold mt-1.5">
                      {isFr
                        ? `Crédits insuffisants — 5 requis, vous en avez ${Math.round(creditsRemaining ?? 0)}`
                        : `Insufficient credits — need 5, you have ${Math.round(creditsRemaining ?? 0)}`}
                    </p>
                  )}
                  <p className="text-[10px] text-blue-300 mt-1.5">📲 Push · ✉️ Email · 📱 SMS optionnel</p>
                </div>
              </div>
            </button>

            <button onClick={() => setTier(null)}
              className="w-full py-2.5 rounded-2xl border-2 border-white/10 text-white/50 text-sm font-medium">
              ← {isFr ? 'Retour' : 'Back'}
            </button>
          </div>
        </MobileLayout>
      )
    }
  }

  // ── Info Simple flow ──────────────────────────────────────────────────────────

  if (pageMode === 'info-simple') {
    const canInfoSubmit = form.description.trim().length >= 5

    if (infoStep === 'form') {
      return (
        <>
        {showScanner && (
          <ScannerModal
            isFr={isFr}
            onScan={file => {
              setFiles(prev => [...prev, file])
              setPreviews(prev => [...prev, 'pdf:' + file.name])
              setShowScanner(false)
            }}
            onClose={() => setShowScanner(false)}
          />
        )}
        <MobileLayout locale={locale} title={isFr ? 'Question Standard' : 'Standard Question'} showBack>
          <div className="space-y-4">
            <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
              <p className="text-sm font-bold text-white mb-0.5">
                {isFr ? '💬 Posez votre question' : '💬 Ask your question'}
              </p>
              <p className="text-xs text-blue-100">
                {isFr ? 'Renseignement, procédure, tarif — réponse sous 24h.' : 'Information, procedure, pricing — response within 24h.'}
              </p>
            </div>

            {/* Objet optionnel */}
            <div className="bg-white rounded-2xl p-4">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                {isFr ? 'Objet (optionnel)' : 'Subject (optional)'}
              </label>
              <input
                type="text"
                value={infoSubject}
                onChange={e => setInfoSubject(e.target.value.slice(0, 80))}
                placeholder={isFr ? 'Ex : Délai arrivée navire, Frais douane, Statut livraison...' : 'E.g.: Vessel arrival delay, Customs fees, Delivery status...'}
                className="w-full text-sm focus:outline-none text-gray-800 placeholder-gray-300"
              />
              <p className="text-xs text-gray-300 text-right mt-1">{infoSubject.length}/80</p>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-4">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                {isFr ? 'Votre question' : 'Your question'}<span className="text-red-400 ml-0.5">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value.slice(0, 10000))}
                placeholder={isFr ? 'Décrivez votre question en détail...' : 'Describe your question in detail...'}
                rows={6}
                className="w-full text-sm focus:outline-none resize-none text-gray-800 leading-relaxed"
              />
              <p className="text-xs text-gray-300 text-right mt-1">{form.description.length}/10000</p>
            </div>

            {/* Documents */}
            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 space-y-3">
              <div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-wide mb-1">{isFr ? 'Documents (optionnel)' : 'Documents (optional)'}</p>
                <p className="text-xs text-blue-100">{t.uploadHint}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="relative flex items-center justify-center gap-2 border-2 border-dashed border-white/40 rounded-xl py-3 text-white text-xs font-semibold active:opacity-70 cursor-pointer overflow-hidden">
                  <Upload size={16} /> {t.addFile}
                  <input type="file" multiple className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    accept="image/*,application/pdf,.doc,.docx"
                    onChange={e => { addFiles(e.target.files); (e.target as HTMLInputElement).value = '' }} />
                </label>
                <button onClick={() => setShowScanner(true)}
                  className="flex items-center justify-center gap-2 border-2 border-dashed border-white/40 rounded-xl py-3 text-white text-xs font-semibold active:opacity-70">
                  <Camera size={16} /> {t.scan}
                </button>
              </div>
              {files.length > 0 && <p className="text-xs text-emerald-300 font-semibold">{files.length} {t.filesAdded}</p>}
              <FilePreviews prevs={previews} fls={files} onRemove={removeFile} dark />
            </div>

            <button onClick={() => setInfoStep('recap')} disabled={!canInfoSubmit}
              className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-30">
              {t.next} <ChevronRight size={18} />
            </button>
            <button onClick={() => { setPageMode(null); setInfoStep('form'); setTier('premium') }}
              className="w-full py-2.5 rounded-2xl border-2 border-white/20 text-white/70 text-sm font-medium">
              ← {t.back}
            </button>
          </div>
        </MobileLayout>
        </>
      )
    }

    if (infoStep === 'recap') {
      return (
        <MobileLayout locale={locale} title={isFr ? 'Récapitulatif' : 'Summary'} showBack>
          <div className="space-y-3">
            <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
              <h2 className="text-base font-bold text-white mb-0.5">{t.recap}</h2>
              <p className="text-sm text-blue-100">{t.recapSub}</p>
            </div>
            {infoSubject && (
              <RecapSection title={isFr ? 'Objet' : 'Subject'} isOpen={true} onToggle={() => {}}>
                <div className="pt-3"><p className="text-sm font-bold text-[#1B3A5C]">{infoSubject}</p></div>
              </RecapSection>
            )}
            <RecapSection title={isFr ? 'Question' : 'Question'} isOpen={true} onToggle={() => {}}>
              <div className="pt-3"><p className="text-sm text-gray-700 leading-relaxed">{form.description}</p></div>
            </RecapSection>
            {files.length > 0 && (
              <RecapSection title={t.documents} isOpen={true} onToggle={() => {}}>
                <div className="pt-3"><RecapPreviews prevs={previews} fls={files} noDoc={t.noDoc} filesAdded={t.filesAdded} /></div>
              </RecapSection>
            )}
            <div className="flex gap-3 pb-4">
              <button onClick={() => setInfoStep('form')}
                className="flex items-center gap-1 px-3 py-3.5 rounded-2xl border-2 border-white/30 text-white font-medium text-sm">
                <ChevronLeft size={16} /> {t.back}
              </button>
              <button onClick={submitInfo} disabled={submitting}
                className="flex-1 py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {t.submit}
              </button>
            </div>
          </div>
        </MobileLayout>
      )
    }
  }

  // ── Info Premium flow ─────────────────────────────────────────────────────────

  if (pageMode === 'info-premium') {
    const canInfoPremiumSubmit = form.description.trim().length >= 5

    if (infoStep === 'form') {
      return (
        <>
        {showScanner && (
          <ScannerModal
            isFr={isFr}
            onScan={file => {
              setFiles(prev => [...prev, file])
              setPreviews(prev => [...prev, 'pdf:' + file.name])
              setShowScanner(false)
            }}
            onClose={() => setShowScanner(false)}
          />
        )}
        <MobileLayout locale={locale} title={isFr ? 'Question Premium ⚡' : 'Premium Question ⚡'} showBack>
          <div className="space-y-4">
            {/* Bannière info premium */}
            <div className="bg-[#4A8FC4]/20 border border-[#4A8FC4]/40 rounded-2xl px-4 py-3 flex items-start gap-2">
              <span className="text-amber-300 flex-shrink-0">⚡</span>
              <div>
                <p className="text-xs font-bold text-white">
                  {isFr ? '5 crédits débités à la création · Voice 10 cr/min' : '5 credits charged at creation · Voice 10 cr/min'}
                </p>
                {creditsRemaining !== null && (
                  <p className="text-[10px] text-blue-300 mt-0.5">
                    {isFr
                      ? `Solde après ouverture : ${Math.max(0, Math.round(creditsRemaining - 5))} crédits`
                      : `Balance after opening: ${Math.max(0, Math.round(creditsRemaining - 5))} credits`}
                  </p>
                )}
              </div>
            </div>

            {/* Objet optionnel */}
            <div className="bg-white rounded-2xl p-4">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                {isFr ? 'Objet (optionnel)' : 'Subject (optional)'}
              </label>
              <input
                type="text"
                value={infoSubject}
                onChange={e => setInfoSubject(e.target.value.slice(0, 80))}
                placeholder={isFr ? 'Ex : Délai arrivée navire, Frais douane, Statut livraison...' : 'E.g.: Vessel arrival delay, Customs fees, Delivery status...'}
                className="w-full text-sm focus:outline-none text-gray-800 placeholder-gray-300"
              />
              <p className="text-xs text-gray-300 text-right mt-1">{infoSubject.length}/80</p>
            </div>

            {/* Description sans limite */}
            <div className="bg-white rounded-2xl p-4">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                {isFr ? 'Votre question' : 'Your question'}<span className="text-red-400 ml-0.5">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder={isFr ? 'Décrivez votre question librement, sans limite...' : 'Describe your question freely, no limit...'}
                rows={7}
                className="w-full text-sm focus:outline-none resize-none text-gray-800 leading-relaxed"
              />
              <div className="flex items-center justify-between mt-1.5">
                <VoiceRecorder size="sm"
                  label={isFr ? 'Dicter' : 'Dictate'}
                  locale={locale}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EDF1F7] text-[#1B3A5C] active:bg-[#1B3A5C] active:text-white transition-colors"
                  disabledReason={!isOnline ? 'offline' : (creditsRemaining !== null && creditsRemaining <= 0) ? 'no_credits' : null}
                  onDisabledClick={() => !isOnline ? undefined : router.push(`/${locale}/recharger`)}
                  onResult={text => set('description', form.description + (form.description ? ' ' : '') + text)}
                />
                <p className="text-xs text-gray-300">{form.description.length} {isFr ? 'car.' : 'chars'}</p>
              </div>
            </div>

            {/* Documents */}
            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 space-y-3">
              <div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-wide mb-1">{isFr ? 'Documents (optionnel)' : 'Documents (optional)'}</p>
                <p className="text-xs text-blue-100">{t.uploadHint}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="relative flex items-center justify-center gap-2 border-2 border-dashed border-white/40 rounded-xl py-3 text-white text-xs font-semibold active:opacity-70 cursor-pointer overflow-hidden">
                  <Upload size={16} /> {t.addFile}
                  <input type="file" multiple className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    accept="image/*,application/pdf,.doc,.docx"
                    onChange={e => { addFiles(e.target.files); (e.target as HTMLInputElement).value = '' }} />
                </label>
                <button onClick={() => setShowScanner(true)}
                  className="flex items-center justify-center gap-2 border-2 border-dashed border-white/40 rounded-xl py-3 text-white text-xs font-semibold active:opacity-70">
                  <Camera size={16} /> {t.scan}
                </button>
              </div>
              {files.length > 0 && <p className="text-xs text-emerald-300 font-semibold">{files.length} {t.filesAdded}</p>}
              <FilePreviews prevs={previews} fls={files} onRemove={removeFile} dark />
            </div>

            <button onClick={() => setInfoStep('recap')} disabled={!canInfoPremiumSubmit}
              className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-30">
              {t.next} <ChevronRight size={18} />
            </button>
            <button onClick={() => { setPageMode(null); setInfoStep('form'); setTier('premium') }}
              className="w-full py-2.5 rounded-2xl border-2 border-white/20 text-white/70 text-sm font-medium">
              ← {t.back}
            </button>
          </div>
        </MobileLayout>
        </>
      )
    }

    if (infoStep === 'recap') {
      return (
        <MobileLayout locale={locale} title={t.recap} showBack>
          <div className="space-y-3">
            <div className="bg-[#4A8FC4]/20 border border-[#4A8FC4]/40 rounded-2xl px-4 py-3 flex items-center gap-2">
              <span className="text-amber-300">⚡</span>
              <p className="text-xs font-bold text-white">
                {isFr ? '5 crédits seront débités à l\'envoi' : '5 credits will be charged on submit'}
              </p>
            </div>
            {infoSubject && (
              <RecapSection title={isFr ? 'Objet' : 'Subject'} isOpen={true} onToggle={() => {}}>
                <div className="pt-3"><p className="text-sm font-bold text-[#1B3A5C]">{infoSubject}</p></div>
              </RecapSection>
            )}
            <RecapSection title={isFr ? 'Question' : 'Question'} isOpen={true} onToggle={() => {}}>
              <div className="pt-3"><p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{form.description}</p></div>
            </RecapSection>
            {files.length > 0 && (
              <RecapSection title={t.documents} isOpen={true} onToggle={() => {}}>
                <div className="pt-3"><RecapPreviews prevs={previews} fls={files} noDoc={t.noDoc} filesAdded={t.filesAdded} /></div>
              </RecapSection>
            )}
            <div className="flex gap-3 pb-4">
              <button onClick={() => setInfoStep('form')}
                className="flex items-center gap-1 px-3 py-3.5 rounded-2xl border-2 border-white/30 text-white font-medium text-sm">
                <ChevronLeft size={16} /> {t.back}
              </button>
              <button onClick={submitInfo} disabled={submitting}
                className="flex-1 py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {isFr ? 'Envoyer (5 crédits)' : 'Send (5 credits)'}
              </button>
            </div>
          </div>
        </MobileLayout>
      )
    }
  }

  // ── BL flow ───────────────────────────────────────────────────────────────────

  if (pageMode === 'bl') {
    // Barre de progression BL
    const BL_STEPS = isFr
      ? ['Vérification', 'Catégorie', 'Description', 'Récap']
      : ['Review', 'Category', 'Description', 'Recap']
    const blStepIdx = blStep === 'review' ? 0 : blStep === 'category' ? 1 : blStep === 'describe' ? 2 : blStep === 'recap' ? 3 : -1
    // 'pick' and 'upload' are pre-flow steps — no progress bar
    const BLProgress = blStepIdx >= 0 ? (
      <div className="flex gap-1 mb-5">
        {BL_STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${i < blStepIdx ? 'bg-white' : i === blStepIdx ? 'bg-[#4A8FC4]' : 'bg-white/25'}`} />
            <p className={`text-[9px] mt-1 font-semibold text-center ${i === blStepIdx ? 'text-white' : i < blStepIdx ? 'text-white/70' : 'text-white/35'}`}>{label}</p>
          </div>
        ))}
      </div>
    ) : null

    // Step 0 : Pick previous BL or start fresh
    if (blStep === 'pick') {
      return (
        <MobileLayout locale={locale} title={isFr ? 'Upload BL Eagle' : 'Upload Eagle BL'} showBack>
          <div className="space-y-4">
            <div className="bg-white/10 rounded-2xl px-4 py-4 border border-white/20 text-center">
              <p className="text-sm font-bold text-white mb-1">
                {isFr ? 'Votre demande est-elle liée à l\'un de vos Booking ?' : 'Is your request related to one of your previous Bookings?'}
              </p>
              <p className="text-xs text-blue-200">
                {isFr ? 'Sélectionnez le BL concerné pour un remplissage automatique instantané' : 'Select the relevant BL for instant auto-fill'}
              </p>
            </div>

            {prevBLs === null ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 rounded-full border-4 border-white/20 border-t-[#4A8FC4] animate-spin" />
              </div>
            ) : (() => {
              const filtered = prevBLs.filter(bl => {
                const q = blSearch.toLowerCase()
                if (!q) return true
                return (
                  (bl.bookingNo  || '').toLowerCase().includes(q) ||
                  (bl.vessel     || '').toLowerCase().includes(q) ||
                  (bl.voyage     || '').toLowerCase().includes(q) ||
                  (bl.ets        || '').toLowerCase().includes(q)
                )
              })
              return (
                <div className="space-y-3">
                  {/* Search bar */}
                  <div className="relative">
                    <input
                      type="text"
                      value={blSearch}
                      onChange={e => setBlSearch(e.target.value)}
                      placeholder={isFr ? 'Rechercher par Booking, Navire, Voyage, ETS…' : 'Search by Booking, Vessel, Voyage, ETS…'}
                      className="w-full px-4 py-3 rounded-2xl bg-white/15 border border-white/25 text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#4A8FC4]"
                    />
                    {blSearch && (
                      <button onClick={() => setBlSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  {/* Filtered results */}
                  {filtered.length === 0 ? (
                    <p className="text-center text-blue-200 text-sm py-4">
                      {isFr ? 'Aucun résultat.' : 'No results.'}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                      {filtered.map(bl => (
                        <button key={bl.id}
                          onClick={() => handleBLReuse(bl.id)}
                          disabled={prevBLsLoading}
                          className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 text-left active:bg-white/20 transition-all disabled:opacity-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white font-mono">{bl.bookingNo || '—'}</p>
                              <p className="text-xs text-[#4A8FC4] font-semibold mt-0.5 truncate">{bl.vessel || '—'}</p>
                              <p className="text-[10px] text-blue-200 mt-1">
                                {[bl.voyage && `Voyage ${bl.voyage}`, bl.portOfLoading && `${bl.portOfLoading} → ${bl.portOfDischarge}`, bl.ets && `ETS ${bl.ets}`].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                            {prevBLsLoading ? (
                              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin flex-shrink-0 mt-1" />
                            ) : (
                              <ChevronRight size={18} className="text-white/50 flex-shrink-0 mt-1" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {isOnline ? (
              <button onClick={() => setBlStep('upload')}
                className="w-full py-3.5 rounded-2xl border-2 border-white/30 text-white font-semibold text-sm flex items-center justify-center gap-2">
                <Upload size={16} />
                {isFr ? 'Non, importer un nouveau BL' : 'No, import a new BL'}
              </button>
            ) : (
              <div className="w-full py-3.5 rounded-2xl border-2 border-white/15 text-white/35 text-sm flex flex-col items-center justify-center gap-1 cursor-not-allowed select-none">
                <div className="flex items-center gap-2">
                  <WifiOff size={14} />
                  {isFr ? 'Importer un nouveau BL' : 'Import a new BL'}
                </div>
                <p className="text-[10px] text-white/25">{isFr ? 'Nécessite une connexion internet' : 'Requires an internet connection'}</p>
              </div>
            )}
            <button onClick={() => setPageMode(null)}
              className="w-full py-2.5 rounded-2xl border-2 border-white/10 text-white/50 text-sm font-medium">
              ← {isFr ? 'Retour' : 'Back'}
            </button>
          </div>
        </MobileLayout>
      )
    }

    // Step 1 : Upload
    if (blStep === 'upload') {
      return (
        <>
        {showScanner && (
          <ScannerModal
            isFr={isFr}
            onScan={file => {
              setBlScanMode(false)
              setShowScanner(false)
              showBLPreview(file)
            }}
            onClose={() => { setShowScanner(false); setBlScanMode(false) }}
          />
        )}
        <MobileLayout locale={locale} title={isFr ? 'Upload BL' : 'Upload BL'} showBack>
          <div className="space-y-4">
            <div className="bg-white/10 rounded-2xl px-4 py-4 border border-white/20">
              <p className="text-sm font-bold text-white mb-2">
                {isFr ? '📄 Importez votre Booking Confirmation Eagle' : '📄 Import your Eagle Booking Confirmation'}
              </p>
              <ul className="space-y-1.5">
                {(isFr
                  ? ['PDF ou photo du document', 'Émis par Eagle (Europe Africa Global Line Express)', "Le formulaire sera pré-rempli automatiquement"]
                  : ['PDF or photo of the document', 'Issued by Eagle (Europe Africa Global Line Express)', 'The form will be auto-filled automatically']
                ).map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-blue-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4A8FC4] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Preview confirmation before extraction ── */}
            {blPreviewFile && !blUploading && (
              <div className="space-y-4">
                <p className="text-sm font-bold text-white text-center">
                  {isFr ? 'Est-ce bien votre Booking Confirmation ?' : 'Is this your Booking Confirmation?'}
                </p>
                {blPreviewIsPdf ? (
                  <div className="bg-white/10 border border-white/20 rounded-2xl p-5 flex items-center gap-3">
                    <FileText size={32} className="text-red-400 flex-shrink-0" />
                    <div>
                      <p className="text-white font-semibold text-sm truncate max-w-[220px]">{blPreviewFile.name}</p>
                      <p className="text-blue-200 text-xs mt-0.5">PDF · {(blPreviewFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                ) : (
                  <img src={blPreviewUrl!} alt="preview"
                    className="w-full max-h-56 object-contain rounded-2xl border border-white/20 bg-white/5" />
                )}
                <div className="bg-amber-500/15 border border-amber-400/30 rounded-2xl p-3 flex items-start gap-2">
                  <span className="text-amber-400 flex-shrink-0">⚠️</span>
                  <p className="text-xs text-amber-200">
                    {isFr
                      ? "Si ce n'est pas le bon fichier, vos crédits seront quand même déduits une fois l'extraction lancée."
                      : "If this is not the right file, your credits will still be deducted once extraction starts."}
                  </p>
                </div>
                <button onClick={confirmBLExtract}
                  className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold text-sm flex items-center justify-center gap-2">
                  ✓ {isFr ? 'Oui, extraire ce document (50 crédits)' : 'Yes, extract this document (50 credits)'}
                </button>
                <button onClick={clearBLPreview}
                  className="w-full py-2.5 rounded-2xl border-2 border-white/30 text-white text-sm font-medium">
                  ✗ {isFr ? 'Non, choisir un autre fichier' : 'No, choose another file'}
                </button>
              </div>
            )}

            {!blUploading && !blError && !isOnline && (
              <div className="flex flex-col items-center justify-center py-12 bg-white/5 rounded-2xl border border-white/15 gap-3 text-center">
                <WifiOff size={36} className="text-blue-300/60" />
                <p className="text-white font-semibold text-sm">
                  {isFr ? 'Connexion requise' : 'Connection required'}
                </p>
                <p className="text-blue-200 text-xs max-w-[240px] leading-relaxed">
                  {isFr
                    ? "L'extraction nécessite une connexion internet. Reconnectez-vous pour uploader un nouveau BL."
                    : "Extraction requires an internet connection. Reconnect to upload a new BL."}
                </p>
                {(prevBLs?.length ?? 0) > 0 && (
                  <button onClick={() => setBlStep('pick')}
                    className="mt-2 text-xs text-[#4A8FC4] font-semibold underline">
                    ← {isFr ? 'Voir mes BLs enregistrés' : 'See my saved BLs'}
                  </button>
                )}
              </div>
            )}
            {!blUploading && !blError && isOnline && !blPreviewFile && (
              <>
                <label className="relative flex flex-col items-center justify-center w-full py-10 rounded-2xl border-2 border-dashed border-white/40 bg-white/5 active:bg-white/10 transition-colors gap-3 overflow-hidden cursor-pointer">
                  <div className="w-14 h-14 rounded-2xl bg-[#4A8FC4]/20 flex items-center justify-center">
                    <Upload size={28} className="text-[#4A8FC4]" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm mb-0.5">{isFr ? 'Importer un PDF' : 'Import a PDF'}</p>
                    <p className="text-blue-200 text-xs">PDF · max 10 MB</p>
                  </div>
                  <input type="file"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    accept="application/pdf"
                    onChange={e => { handleBLUpload(e); (e.target as HTMLInputElement).value = '' }} />
                </label>
                <button onClick={() => { setBlScanMode(true); setShowScanner(true) }}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-white/40 bg-white/5 active:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Camera size={20} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold text-sm">{isFr ? 'Scanner le document' : 'Scan the document'}</p>
                    <p className="text-blue-200 text-xs">{isFr ? 'Prendre en photo votre BL papier' : 'Take a photo of your paper BL'}</p>
                  </div>
                </button>
              </>
            )}

            {blUploading && (
              <div className="flex flex-col items-center justify-center py-14 gap-5">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-[#4A8FC4] animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-sm mb-1">{isFr ? 'Extraction en cours...' : 'Extracting...'}</p>
                  <p className="text-blue-200 text-xs">{isFr ? "Analyse de votre BL Eagle en cours" : 'Analyzing your Eagle BL'}</p>
                </div>
              </div>
            )}

            {blError && (
              <div className="bg-red-500/20 border border-red-400/40 rounded-2xl px-4 py-4 space-y-3">
                <p className="text-sm font-bold text-white">❌ {isFr ? 'Extraction échouée' : 'Extraction failed'}</p>
                <p className="text-xs text-red-200">{blError}</p>
                <button onClick={() => setBlError(null)}
                  className="w-full py-2.5 rounded-xl bg-white/20 text-white text-sm font-semibold">
                  {isFr ? 'Réessayer' : 'Try again'}
                </button>
              </div>
            )}

            <button onClick={() => prevBLs && prevBLs.length > 0 ? setBlStep('pick') : setPageMode(null)}
              className="w-full py-3 rounded-2xl border-2 border-white/20 text-white/70 text-sm font-medium">
              ← {isFr ? 'Retour' : 'Back'}
            </button>
          </div>
        </MobileLayout>
        </>
      )
    }

    // Step 2 : Review all extracted fields (editable)
    if (blStep === 'review' && blFields) {
      // (BLProgress injected below)
      const bf = blFields
      const inp = "w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C] text-gray-800"
      const lbl = "text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block"
      const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
        <div className="bg-white rounded-2xl overflow-hidden">
          <button onClick={() => setBlOpenSection(p => ({ ...p, [id]: !p[id] }))}
            className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-50">
            <p className="text-sm font-bold text-[#1B3A5C]">{title}</p>
            <ChevronDown size={15} className={`text-gray-400 transition-transform ${blOpenSection[id] ? '' : '-rotate-90'}`} />
          </button>
          {blOpenSection[id] && <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">{children}</div>}
        </div>
      )
      return (
        <MobileLayout locale={locale} title={isFr ? 'Vérifier les données BL' : 'Review BL data'} showBack>
          <div className="space-y-3">
            {BLProgress}
            <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-2xl px-4 py-3">
              <p className="text-sm font-bold text-white mb-0.5">✅ {isFr ? 'BL extrait — vérifiez et corrigez si besoin' : 'BL extracted — review and correct if needed'}</p>
              <p className="text-xs text-blue-100">{isFr ? "Le système peut parfois se tromper. Vérifiez et corrigez si besoin." : 'The system may occasionally make errors. Review and correct if needed.'}</p>
            </div>

            {/* Références */}
            <Section id="ref" title={isFr ? 'Références' : 'References'}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l: 'Booking no.', k: 'bookingNo' },
                  { l: isFr ? 'Date' : 'Date', k: 'date' },
                  { l: 'Customer ref', k: 'customerRef' },
                  { l: 'Service', k: 'service' },
                ].map(f => (
                  <div key={f.k}>
                    <label className={lbl}>{f.l}</label>
                    <input className={inp} value={bf[f.k] || ''} onChange={e => updateBLF(f.k, e.target.value)} />
                  </div>
                ))}
              </div>
            </Section>

            {/* Navire & Voyage */}
            <Section id="vessel" title={isFr ? 'Navire & Voyage' : 'Vessel & Voyage'}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l: isFr ? 'Navire' : 'Vessel', k: 'vessel' },
                  { l: 'Voyage', k: 'voyage' },
                  { l: 'ETS', k: 'ets' },
                  { l: 'ETA', k: 'eta' },
                  { l: isFr ? 'Port chargement' : 'Port of loading', k: 'portOfLoading' },
                  { l: isFr ? 'Port déchargement' : 'Port of discharge', k: 'portOfDischarge' },
                  { l: isFr ? 'Lieu réception' : 'Place of receipt', k: 'placeOfReceipt' },
                  { l: isFr ? 'Lieu livraison' : 'Place of delivery', k: 'placeOfDelivery' },
                ].map(f => (
                  <div key={f.k}>
                    <label className={lbl}>{f.l}</label>
                    <input className={inp} value={bf[f.k] || ''} onChange={e => updateBLF(f.k, e.target.value)} />
                  </div>
                ))}
              </div>
            </Section>

            {/* Pickup reference */}
            <Section id="pickup" title="Pickup reference / Dépôt">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l: 'Pickup ref', k: 'pickup.reference' },
                  { l: isFr ? 'Quantité' : 'Quantity', k: 'pickup.quantity' },
                  { l: 'Size type', k: 'pickup.sizeType' },
                  { l: 'Dépôt', k: 'pickup.depot' },
                  { l: 'Container usage', k: 'pickup.containerUsage' },
                  { l: 'Release date', k: 'pickup.releaseDate' },
                ].map(f => (
                  <div key={f.k}>
                    <label className={lbl}>{f.l}</label>
                    <input className={inp} value={(f.k.includes('.') ? bf.pickup?.[f.k.split('.')[1]] : bf[f.k]) || ''} onChange={e => updateBLF(f.k, e.target.value)} />
                  </div>
                ))}
              </div>
            </Section>

            {/* Turn in location */}
            <Section id="turnin" title="Turn in location">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l: 'Turn in ref', k: 'turnIn.reference' },
                  { l: 'Terminal', k: 'turnIn.terminal' },
                  { l: 'Terminal closing', k: 'turnIn.terminalClosing' },
                  { l: 'VGM closing', k: 'turnIn.vgmClosing' },
                  { l: 'Customs closing', k: 'turnIn.customsClosing' },
                ].map(f => (
                  <div key={f.k} className={f.k === 'turnIn.terminal' ? 'col-span-2' : ''}>
                    <label className={lbl}>{f.l}</label>
                    <input className={inp} value={bf.turnIn?.[f.k.split('.')[1]] || ''} onChange={e => updateBLF(f.k, e.target.value)} />
                  </div>
                ))}
              </div>
            </Section>

            {/* Booking items */}
            <Section id="items" title="Booking items">
              {(bf.bookingItems || []).map((item: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-gray-100 p-3 space-y-2">
                  <p className="text-[10px] font-bold text-[#1B3A5C] uppercase">Item {item.item || idx + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { l: isFr ? 'Nb colis' : 'No. of packs', k: 'noOfPacks' },
                      { l: isFr ? 'Type colis' : 'Kind of pack', k: 'kindOfPack' },
                      { l: isFr ? 'Description marchandises' : 'Description of goods', k: 'descriptionOfGoods' },
                      { l: 'Liner terms', k: 'linerTerms' },
                      { l: 'IMO', k: 'imo' },
                      { l: isFr ? 'Poids brut (t)' : 'Gross weight (t)', k: 'grossWeightTons' },
                      { l: 'Mesure (cbm)', k: 'measurementCbm' },
                    ].map(f => (
                      <div key={f.k} className={f.k === 'descriptionOfGoods' ? 'col-span-2' : ''}>
                        <label className={lbl}>{f.l}</label>
                        <input className={inp} value={item[f.k] || ''} onChange={e => updateBLF(`bookingItems.${idx}.${f.k}`, e.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Section>

            {/* Container details */}
            {(bf.containerDetails || []).length > 0 && (
              <Section id="containers" title="Container details">
                {(bf.containerDetails || []).map((cd: any, idx: number) => (
                  <div key={idx} className="rounded-xl border border-gray-100 p-3 space-y-2">
                    <p className="text-[10px] font-bold text-[#1B3A5C] uppercase">{isFr ? `Conteneur ${idx + 1}` : `Container ${idx + 1}`}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { l: 'Container no', k: 'containerNo' },
                        { l: 'Set point', k: 'setPoint' },
                        { l: 'Vent', k: 'vent' },
                        { l: 'Drains', k: 'drains' },
                        { l: 'Humidity', k: 'humidity' },
                        { l: isFr ? 'Remarques' : 'Remarks', k: 'remarks' },
                      ].map(f => (
                        <div key={f.k}>
                          <label className={lbl}>{f.l}</label>
                          <input className={inp} value={cd[f.k] || ''} onChange={e => updateBLF(`containerDetails.${idx}.${f.k}`, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {/* Remarques */}
            <Section id="remarks" title={isFr ? 'Remarques' : 'Remarks'}>
              <textarea className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C] resize-none text-gray-800" rows={3}
                value={bf.remarks || ''} onChange={e => updateBLF('remarks', e.target.value)} />
            </Section>

            <button onClick={() => {
              setBlVesselData(JSON.stringify(blFields))
              setForm(prev => ({
                ...prev,
                shipName:       blFields.vessel      || '',
                voyageNumber:   blFields.voyage       || '',
                shipDate:       blFields.ets          || '',
                code:           blFields.bookingNo    || '',
                equipmentType:  isFr ? 'Autre' : 'Other',
                equipmentOther: blFields.pickup?.sizeType || '',
              }))
              setMode('simple')
              setBlStep('category')
            }}
              className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2">
              {isFr ? 'Valider et continuer' : 'Validate & continue'} <ChevronRight size={18} />
            </button>
            <button onClick={resetBL}
              className="w-full py-2.5 rounded-2xl border-2 border-white/20 text-white/70 text-sm font-medium">
              ← {isFr ? 'Changer de BL' : 'Change BL'}
            </button>
          </div>
        </MobileLayout>
      )
    }

    // Step 3 : Category
    if (blStep === 'category') {
      const catCanNext = !!form.category &&
        (form.category !== 'Autre' && form.category !== 'Other' ? true : !!form.categoryOther.trim())
      return (
        <MobileLayout locale={locale} title={t.catTitle} showBack>
          <div className="space-y-4">
            {BLProgress}
            <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
              <h2 className="text-base font-bold text-white mb-0.5">{t.catTitle}<Req /></h2>
              <p className="text-sm text-blue-100">{t.catSub}</p>
            </div>
            <div className="space-y-2">
              {categories.map(cat => (
                <button key={cat}
                  onClick={() => { set('category', cat); set('subcategory', ''); set('categoryOther', '') }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${
                    form.category === cat ? 'border-white bg-white text-[#1B3A5C]' : 'border-white/20 bg-white/10 text-white'
                  }`}>
                  <span className="font-semibold text-sm">{cat}</span>
                  {form.category === cat && <Check size={16} />}
                </button>
              ))}
            </div>
            {(form.category === 'Autre' || form.category === 'Other') && (
              <input type="text" value={form.categoryOther} onChange={e => set('categoryOther', e.target.value)}
                placeholder={t.otherLabel}
                className="w-full px-4 py-3 rounded-2xl bg-white text-[#1B3A5C] text-sm font-medium outline-none" />
            )}
            {form.category && subcategories.length > 0 && (
              <div className="bg-white/10 rounded-2xl p-3 border border-white/15 space-y-2">
                <p className="text-xs font-bold text-white/60 uppercase tracking-wide px-1">{t.subcatTitle}</p>
                {subcategories.map(sub => (
                  <button key={sub}
                    onClick={() => { set('subcategory', sub); set('subcategoryOther', '') }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      form.subcategory === sub ? 'border-[#4A8FC4] bg-[#4A8FC4] text-white' : 'border-white/20 bg-white/10 text-white/80'
                    }`}>
                    <span className="text-sm font-medium">{sub}</span>
                    {form.subcategory === sub && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
            {(form.subcategory === 'Autre' || form.subcategory === 'Other') && (
              <input type="text" value={form.subcategoryOther} onChange={e => set('subcategoryOther', e.target.value)}
                placeholder={t.otherLabel}
                className="w-full px-4 py-3 rounded-2xl bg-white text-[#1B3A5C] text-sm font-medium outline-none" />
            )}
            <button onClick={() => setBlStep('describe')} disabled={!catCanNext}
              className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-30">
              {t.next} <ChevronRight size={18} />
            </button>
            <button onClick={() => setBlStep('review')}
              className="w-full py-2.5 rounded-2xl border-2 border-white/20 text-white/70 text-sm font-medium">
              <ChevronLeft size={14} className="inline" /> {t.back}
            </button>
          </div>
        </MobileLayout>
      )
    }

    // Step 4 : Description + fichiers
    if (blStep === 'describe') {
      const descCanNext = form.description.trim().length >= 10
      return (
        <>
        {showScanner && (
          <ScannerModal
            isFr={isFr}
            onScan={file => {
              setFiles(prev => [...prev, file])
              setPreviews(prev => [...prev, 'pdf:' + file.name])
              setShowScanner(false)
            }}
            onClose={() => setShowScanner(false)}
          />
        )}
        <MobileLayout locale={locale} title={t.descTitle} showBack>
          <div className="space-y-4">
            {BLProgress}
            <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
              <h2 className="text-base font-bold text-white mb-0.5">{t.descTitle}<Req /></h2>
              <p className="text-sm text-blue-100">{t.descSub}</p>
            </div>
            <div className="bg-white rounded-2xl p-4">
              <textarea value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder={t.descPlaceholder} rows={6}
                className="w-full text-sm focus:outline-none resize-none text-gray-800 leading-relaxed" />
              <div className="flex items-center justify-end mt-1.5">
                {premiumAccepted
                  ? <VoiceRecorder size="sm"
                      label={isFr ? 'Dicter' : 'Dictate'}
                      locale={locale}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EDF1F7] text-[#1B3A5C] active:bg-[#1B3A5C] active:text-white transition-colors"
                      disabledReason={!isOnline ? 'offline' : (creditsRemaining !== null && creditsRemaining <= 0) ? 'no_credits' : null}
                      onDisabledClick={() => router.push(`/${locale}/recharger`)}
                      onResult={text => set('description', form.description + (form.description ? ' ' : '') + text)}
                    />
                  : <button type="button"
                      onClick={() => { setPendingAction('voice'); setShowCostPopup(true) }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EDF1F7] text-[#1B3A5C] text-xs font-medium active:bg-[#1B3A5C] active:text-white transition-colors">
                      <Mic size={12} />
                      <span>{isFr ? 'Dicter' : 'Dictate'}</span>
                    </button>
                }
              </div>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 space-y-3">
              <div>
                <p className="text-xs font-bold text-white/80 uppercase tracking-wide mb-1">Documents</p>
                <p className="text-xs text-blue-100">{t.uploadHint}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="relative flex items-center justify-center gap-2 border-2 border-dashed border-white/40 rounded-xl py-3 text-white text-xs font-semibold active:opacity-70 cursor-pointer overflow-hidden">
                  <Upload size={16} /> {t.addFile}
                  <input type="file" multiple
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    accept="image/*,application/pdf,.doc,.docx"
                    onChange={e => { addFiles(e.target.files); (e.target as HTMLInputElement).value = '' }} />
                </label>
                <button onClick={() => { setScanVesselId(null); setShowScanner(true) }}
                  className="flex items-center justify-center gap-2 border-2 border-dashed border-white/40 rounded-xl py-3 text-white text-xs font-semibold active:opacity-70">
                  <Camera size={16} /> {t.scan}
                </button>
              </div>
              {files.length > 0 && <p className="text-xs text-emerald-300 font-semibold">{files.length} {t.filesAdded}</p>}
              <FilePreviews prevs={previews} fls={files} onRemove={removeFile} dark />
            </div>
            <button onClick={() => setBlStep('recap')} disabled={!descCanNext}
              className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-30">
              {t.next} <ChevronRight size={18} />
            </button>
            <button onClick={() => setBlStep('category')}
              className="w-full py-2.5 rounded-2xl border-2 border-white/20 text-white/70 text-sm font-medium">
              <ChevronLeft size={14} className="inline" /> {t.back}
            </button>
          </div>
        </MobileLayout>
        </>
      )
    }

    // Step 5 : Recap + submit
    if (blStep === 'recap') {
      return (
        <MobileLayout locale={locale} title={t.recap} showBack>
          <div className="space-y-3">
            {BLProgress}
            <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
              <h2 className="text-base font-bold text-white mb-0.5">{t.recap}</h2>
              <p className="text-sm text-blue-100">{t.recapSub}</p>
            </div>
            {blFields && (
              <RecapSection title={isFr ? 'BL / Logistique' : 'BL / Logistics'} isOpen={openRecap.log} onToggle={() => toggleRecap('log')}>
                <div className="pt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {[
                    { l: 'Booking no.', v: blFields.bookingNo },
                    { l: isFr ? 'Navire' : 'Vessel',        v: blFields.vessel },
                    { l: 'Voyage',                           v: blFields.voyage },
                    { l: 'ETS',                              v: blFields.ets },
                    { l: 'ETA',                              v: blFields.eta },
                    { l: isFr ? 'Chargement' : 'Loading',   v: blFields.portOfLoading },
                    { l: isFr ? 'Déchargement' : 'Discharge',v: blFields.portOfDischarge },
                    { l: isFr ? 'Conteneur' : 'Container',  v: blFields.pickup?.sizeType },
                    { l: isFr ? 'Marchandise' : 'Goods',    v: blFields.bookingItems?.[0]?.descriptionOfGoods },
                  ].filter(f => f.v).map(f => (
                    <div key={f.l}>
                      <p className="text-[10px] text-gray-400 font-medium">{f.l}</p>
                      <p className="text-xs font-semibold text-gray-800">{f.v}</p>
                    </div>
                  ))}
                </div>
              </RecapSection>
            )}
            <RecapSection title={t.catLabel} isOpen={openRecap.cat} onToggle={() => toggleRecap('cat')}>
              <div className="pt-3"><p className="text-sm font-bold text-[#1B3A5C]">{finalCategory}</p></div>
            </RecapSection>
            <RecapSection title={t.descLabel} isOpen={openRecap.desc} onToggle={() => toggleRecap('desc')}>
              <div className="pt-3 space-y-3">
                <p className="text-sm text-gray-700 leading-relaxed">{form.description}</p>
                {files.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{t.documents}</p>
                    <RecapPreviews prevs={previews} fls={files} noDoc={t.noDoc} filesAdded={t.filesAdded} />
                  </div>
                )}
              </div>
            </RecapSection>
            <div className="flex gap-3 pb-4">
              <button onClick={() => setBlStep('describe')}
                className="flex items-center gap-1 px-3 py-3.5 rounded-2xl border-2 border-white/30 text-white font-medium text-sm">
                <ChevronLeft size={16} /> {t.back}
              </button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg active:scale-[0.99] transition-transform">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {t.submit}
              </button>
            </div>
          </div>
        </MobileLayout>
      )
    }
  }

  // ── Manual flow ───────────────────────────────────────────────────────────────

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {showScanner && (
        <ScannerModal
          isFr={isFr}
          onScan={file => {
            if (blScanMode) {
              handleBLFile(file)
              setBlScanMode(false)
            } else if (scanVesselId !== null) {
              setVessels(prev => prev.map(v =>
                v.id === scanVesselId
                  ? { ...v, files: [...v.files, file], previews: [...v.previews, 'pdf:' + file.name] }
                  : v
              ))
            } else {
              setFiles(prev => [...prev, file])
              setPreviews(prev => [...prev, 'pdf:' + file.name])
            }
            setShowScanner(false)
            setScanVesselId(null)
          }}
          onClose={() => { setShowScanner(false); setScanVesselId(null); setBlScanMode(false) }}
        />
      )}

      <input ref={uploadRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
      <input ref={vesselUploadRef} type="file" multiple className="hidden" onChange={handleVesselUpload} />

      <MobileLayout locale={locale} title={t.title} showBack>

        {/* Progress bar */}
        <div className="flex gap-1 mb-5">
          {t.stepLabels.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all duration-300 ${
                i < stepIdx ? 'bg-white' : i === stepIdx ? 'bg-[#4A8FC4]' : 'bg-white/25'
              }`} />
              <p className={`text-[9px] mt-1 font-semibold text-center ${
                i === stepIdx ? 'text-white' : i < stepIdx ? 'text-white/70' : 'text-white/35'
              }`}>{label}</p>
            </div>
          ))}
        </div>

        {/* ── STEP 1 : Catégorie ── */}
        {step === 'categorie' && (
          <div className="space-y-4">
            <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
              <h2 className="text-base font-bold text-white mb-0.5">{t.catTitle}<Req /></h2>
              <p className="text-sm text-blue-100">{t.catSub}</p>
            </div>
            <div className="space-y-2">
              {categories.map(cat => (
                <button key={cat}
                  onClick={() => { set('category', cat); set('subcategory', ''); set('categoryOther', '') }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${
                    form.category === cat ? 'border-white bg-white text-[#1B3A5C]' : 'border-white/20 bg-white/10 text-white'
                  }`}>
                  <span className="font-semibold text-sm">{cat}</span>
                  {form.category === cat && <Check size={16} />}
                </button>
              ))}
            </div>
            {(form.category === 'Autre' || form.category === 'Other') && (
              <input type="text" value={form.categoryOther} onChange={e => set('categoryOther', e.target.value)}
                placeholder={t.otherLabel} autoFocus
                className="w-full px-4 py-3 rounded-2xl bg-white text-[#1B3A5C] text-sm font-medium outline-none placeholder-gray-400" />
            )}
            {form.category && form.category !== 'Autre' && form.category !== 'Other' && subcategories.length > 0 && (
              <div className="bg-white/10 rounded-2xl p-3 border border-white/15 space-y-2">
                <p className="text-xs font-bold text-white/60 uppercase tracking-wide px-1">{t.subcatTitle}<Req /></p>
                {subcategories.map(sub => (
                  <button key={sub}
                    onClick={() => { set('subcategory', sub); set('subcategoryOther', '') }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      form.subcategory === sub ? 'border-[#4A8FC4] bg-[#4A8FC4] text-white' : 'border-white/20 bg-white/10 text-white/80'
                    }`}>
                    <span className="text-sm font-medium">{sub}</span>
                    {form.subcategory === sub && <Check size={14} />}
                  </button>
                ))}
                {(form.subcategory === 'Autre' || form.subcategory === 'Other') && (
                  <input type="text" value={form.subcategoryOther} onChange={e => set('subcategoryOther', e.target.value)}
                    placeholder={t.otherLabel}
                    className="w-full px-4 py-3 rounded-xl bg-white text-[#1B3A5C] text-sm font-medium outline-none" />
                )}
              </div>
            )}
            <button onClick={() => setStep('equipement')} disabled={!canStep1}
              className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-30 active:scale-[0.99] transition-transform">
              {t.next} <ChevronRight size={18} />
            </button>
            <button onClick={() => { setPageMode(null); setStep('categorie') }}
              className="w-full py-2.5 rounded-2xl border-2 border-white/10 text-white/50 text-sm font-medium">
              ← {t.back}
            </button>
          </div>
        )}

        {/* ── STEP 2 : Équipement ── */}
        {step === 'equipement' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(['simple', 'multi', 'conventionnel'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`py-3 rounded-2xl text-sm font-bold border-2 transition-all ${
                    mode === m ? 'border-white bg-white text-[#1B3A5C]' : 'border-white/30 text-white'
                  }`}>
                  {m === 'simple' ? t.modeSimple : m === 'multi' ? t.modeMulti : t.modeConv}
                </button>
              ))}
            </div>

            {mode === 'simple' && (
              <>
                <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
                  <h2 className="text-base font-bold text-white mb-0.5">{t.equipTitle}<Req /></h2>
                  <p className="text-sm text-blue-100">{t.equipSub}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {equipOptions.map(opt => (
                    <button key={opt}
                      onClick={() => { set('equipmentType', opt); set('equipmentOther', '') }}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${
                        form.equipmentType === opt ? 'border-white bg-white text-[#1B3A5C]' : 'border-white/20 bg-white/10 text-white'
                      }`}>
                      <span className="font-semibold text-sm">{opt}</span>
                      {form.equipmentType === opt && <Check size={15} />}
                    </button>
                  ))}
                </div>
                {(form.equipmentType === 'Autre' || form.equipmentType === 'Other') && (
                  <input type="text" value={form.equipmentOther} onChange={e => set('equipmentOther', e.target.value)}
                    placeholder={t.otherLabel} autoFocus
                    className="w-full px-4 py-3 rounded-2xl bg-white text-[#1B3A5C] text-sm font-medium outline-none" />
                )}
              </>
            )}

            {mode === 'conventionnel' && (
              <>
                <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
                  <h2 className="text-base font-bold text-white mb-0.5">{t.convTitle}<Req /></h2>
                  <p className="text-sm text-blue-100">{t.convSub}</p>
                </div>
                <textarea
                  value={form.conventionnelDesc}
                  onChange={e => set('conventionnelDesc', e.target.value)}
                  placeholder={t.convPh}
                  rows={4}
                  className="w-full px-4 py-3 rounded-2xl bg-white text-[#1B3A5C] text-sm font-medium outline-none placeholder-gray-400 resize-none"
                />
              </>
            )}

            {mode === 'multi' && (
              <>
                <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
                  <h2 className="text-base font-bold text-white mb-0.5">{t.multiTitle}</h2>
                  <p className="text-sm text-blue-100">{t.multiSub}</p>
                </div>
                <div className="space-y-3">
                  {containers.map((c, idx) => (
                    <div key={c.id} className="bg-white rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-[#1B3A5C]/5 border-b border-gray-100">
                        <p className="text-xs font-bold text-[#1B3A5C] uppercase tracking-wide">
                          {isFr ? `Conteneur ${idx + 1}` : `Container ${idx + 1}`}
                        </p>
                        {containers.length > 1 && (
                          <button onClick={() => removeContainer(c.id)}
                            className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center">
                            <Trash2 size={11} className="text-red-400" />
                          </button>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t.typeLabel}</p>
                        <div className="grid grid-cols-4 gap-1.5 mb-3">
                          {equipOptions.map(opt => (
                            <button key={opt} onClick={() => updateContainer(c.id, { type: opt, typeOther: '' })}
                              className={`py-2 rounded-xl text-[11px] font-bold border-2 transition-all ${
                                c.type === opt ? 'border-[#1B3A5C] bg-[#1B3A5C] text-white' : 'border-gray-200 text-gray-600'
                              }`}>
                              {shortOpt(opt)}
                            </button>
                          ))}
                        </div>
                        {(c.type === 'Autre' || c.type === 'Other') && (
                          <input type="text" value={c.typeOther}
                            onChange={e => updateContainer(c.id, { typeOther: e.target.value })}
                            placeholder={t.otherLabel}
                            className="w-full mb-3 px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#1B3A5C]" />
                        )}
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                            {t.numLabel}
                          </p>
                          <div className="relative">
                            <input
                              type="text"
                              value={c.number}
                              onChange={e => updateContainer(c.id, { number: e.target.value.toUpperCase() })}
                              placeholder={t.numHint}
                              maxLength={12}
                              className={`w-full px-3 py-2.5 rounded-xl border text-[11px] outline-none font-mono pr-8 ${
                                c.number.trim() === ''
                                  ? 'border-gray-200 focus:border-[#1B3A5C]'
                                  : isValidContainerNumber(c.number)
                                  ? 'border-emerald-400 bg-emerald-50/40'
                                  : 'border-red-300 bg-red-50/40'
                              }`}
                            />
                            {c.number.trim() !== '' && (
                              <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold ${
                                isValidContainerNumber(c.number) ? 'text-emerald-500' : 'text-red-400'
                              }`}>
                                {isValidContainerNumber(c.number) ? '✓' : '✗'}
                              </span>
                            )}
                          </div>
                          {c.number.trim() !== '' && !isValidContainerNumber(c.number) && (
                            <p className="text-[9px] text-red-400 mt-1 font-medium">
                              {isFr ? 'Format attendu : ABCU1234567' : 'Expected format: ABCU1234567'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={addContainer}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-white/40 text-white text-sm font-semibold hover:bg-white/10 active:opacity-70 transition-all">
                    <Plus size={16} /> {t.addCont}
                  </button>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('categorie')}
                className="flex items-center gap-1 px-4 py-3.5 rounded-2xl border-2 border-white/30 text-white font-medium text-sm">
                <ChevronLeft size={16} /> {t.back}
              </button>
              <button onClick={() => setStep('logistique')} disabled={!canStep2}
                className="flex-1 py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-30">
                {t.next} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 : Logistique ── */}
        {step === 'logistique' && (
          <div className="space-y-4">
            <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
              <h2 className="text-base font-bold text-white mb-0.5">{t.logTitle}</h2>
              <p className="text-sm text-blue-100">{t.logSub}</p>
            </div>

            {/* N° conteneur — mode simple uniquement */}
            {mode === 'simple' && (
              <div className="bg-white rounded-2xl p-4">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                  {t.numLabel}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.containerNumber}
                    onChange={e => set('containerNumber', e.target.value.toUpperCase())}
                    placeholder={t.numHint}
                    maxLength={12}
                    className={`w-full px-4 py-3 rounded-xl border-2 bg-gray-50 text-sm focus:outline-none font-mono pr-10 ${
                      form.containerNumber.trim() === ''
                        ? 'border-gray-100 focus:border-[#1B3A5C]'
                        : isValidContainerNumber(form.containerNumber)
                        ? 'border-emerald-400 bg-emerald-50/40'
                        : 'border-red-300 bg-red-50/40'
                    }`}
                  />
                  {form.containerNumber.trim() !== '' && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold ${
                      isValidContainerNumber(form.containerNumber) ? 'text-emerald-500' : 'text-red-400'
                    }`}>
                      {isValidContainerNumber(form.containerNumber) ? '✓' : '✗'}
                    </span>
                  )}
                </div>
                {form.containerNumber.trim() !== '' && !isValidContainerNumber(form.containerNumber) && (
                  <p className="text-[10px] text-red-400 mt-1.5 font-medium">
                    {isFr ? 'Format attendu : MSCU1234567' : 'Expected format: MSCU1234567'}
                  </p>
                )}
              </div>
            )}

            {/* BL / Code dossier — global uniquement si pas multi-navires distincts */}
            {!isMultiSeparate && (
              <div className="bg-white rounded-2xl p-4">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                  {t.blCode}<Req />
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => set('code', e.target.value)}
                  placeholder="Ex: EA2604921DLAPME"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C] font-mono"
                />
              </div>
            )}

            {/* Same-vessel toggle (multi only) */}
            {mode === 'multi' && (
              <div className="bg-white/10 rounded-2xl px-4 py-4 border border-white/15">
                <p className="text-sm font-semibold text-white mb-3">{t.sameVessel}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map(val => (
                    <button key={String(val)} onClick={() => setSameVessel(val)}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        sameVessel === val ? 'border-white bg-white text-[#1B3A5C]' : 'border-white/30 text-white'
                      }`}>
                      {val ? t.yes : t.no}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Single logistics block — simple, conventionnel, OR multi+sameVessel */}
            {(mode === 'simple' || mode === 'conventionnel' || sameVessel === true) && (
              <div className="bg-white rounded-2xl p-4">
                <LogisticsFields
                  sn={form.shipName} vn={form.voyageNumber} sd={form.shipDate}
                  onChange={(k, v) => set(k as keyof FormState, v)}
                  lbl={lbl}
                />
              </div>
            )}

            {/* BL manual fields — mode simple uniquement */}
            {mode === 'simple' && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
                  <span className="text-base mt-0.5">⚡</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">
                      {isFr ? 'Ces informations sont extraites automatiquement avec Premium' : 'These fields are auto-filled with Premium BL extraction'}
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                      {isFr
                        ? 'Renseignez-les manuellement ou importez votre BL pour un traitement accéléré.'
                        : 'Fill them manually or import your BL for faster processing.'}
                    </p>
                  </div>
                </div>

                {/* Références */}
                <div className="bg-white rounded-2xl overflow-hidden">
                  <button type="button"
                    onClick={() => setBlManualSections(p => ({ ...p, refs: !p.refs }))}
                    className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors">
                    <p className="text-sm font-bold text-[#1B3A5C]">{isFr ? 'Références BL' : 'BL References'}</p>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${blManualSections.refs ? '' : '-rotate-90'}`} />
                  </button>
                  {blManualSections.refs && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                      {([
                        { key: 'customerRef',      label: isFr ? 'Réf. client' : 'Customer ref',        type: 'text' },
                        { key: 'service',           label: 'Service',                                    type: 'text' },
                        { key: 'blDate',            label: isFr ? 'Date du BL' : 'BL date',              type: 'date' },
                        { key: 'bookingPartyName',  label: isFr ? 'Booking party (nom)' : 'Booking party (name)', type: 'text' },
                        { key: 'bookingPartyRegion',label: isFr ? 'Région booking party' : 'Booking party region', type: 'text' },
                      ] as { key: keyof FormState; label: string; type: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">{f.label}</label>
                          <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C]" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Transport */}
                <div className="bg-white rounded-2xl overflow-hidden">
                  <button type="button"
                    onClick={() => setBlManualSections(p => ({ ...p, transport: !p.transport }))}
                    className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors">
                    <p className="text-sm font-bold text-[#1B3A5C]">Transport</p>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${blManualSections.transport ? '' : '-rotate-90'}`} />
                  </button>
                  {blManualSections.transport && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                      {([
                        { key: 'eta',             label: isFr ? 'ETA (arrivée estimée)' : 'ETA (estimated arrival)', type: 'date' },
                        { key: 'portOfLoading',   label: isFr ? 'Port de chargement' : 'Port of loading',           type: 'text' },
                        { key: 'portOfDischarge', label: isFr ? 'Port de déchargement' : 'Port of discharge',       type: 'text' },
                        { key: 'placeOfReceipt',  label: isFr ? 'Lieu de réception' : 'Place of receipt',           type: 'text' },
                        { key: 'placeOfDelivery', label: isFr ? 'Lieu de livraison' : 'Place of delivery',          type: 'text' },
                      ] as { key: keyof FormState; label: string; type: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">{f.label}</label>
                          <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C]" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pickup / Conteneur */}
                <div className="bg-white rounded-2xl overflow-hidden">
                  <button type="button"
                    onClick={() => setBlManualSections(p => ({ ...p, pickup: !p.pickup }))}
                    className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors">
                    <p className="text-sm font-bold text-[#1B3A5C]">{isFr ? 'Pickup / Conteneur' : 'Pickup / Container'}</p>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${blManualSections.pickup ? '' : '-rotate-90'}`} />
                  </button>
                  {blManualSections.pickup && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                      {([
                        { key: 'pickupRef',        label: isFr ? 'Référence pickup' : 'Pickup reference',      type: 'text' },
                        { key: 'pickupQty',        label: isFr ? 'Quantité' : 'Quantity',                      type: 'text' },
                        { key: 'pickupSizeType',   label: isFr ? 'Size/Type conteneur' : 'Container size/type',type: 'text' },
                        { key: 'pickupUsage',      label: isFr ? 'Usage conteneur' : 'Container usage',        type: 'text' },
                        { key: 'pickupDepot',      label: isFr ? 'Dépôt pickup' : 'Pickup depot',              type: 'text' },
                        { key: 'pickupReleaseDate',label: isFr ? 'Date de release' : 'Release date',           type: 'date' },
                        { key: 'containerTemp',    label: isFr ? 'Température (reefer)' : 'Temperature (reefer)', type: 'text' },
                      ] as { key: keyof FormState; label: string; type: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">{f.label}</label>
                          <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C]" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Délais terminal */}
                <div className="bg-white rounded-2xl overflow-hidden">
                  <button type="button"
                    onClick={() => setBlManualSections(p => ({ ...p, delays: !p.delays }))}
                    className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors">
                    <p className="text-sm font-bold text-[#1B3A5C]">{isFr ? 'Délais terminal' : 'Terminal deadlines'}</p>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${blManualSections.delays ? '' : '-rotate-90'}`} />
                  </button>
                  {blManualSections.delays && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                      {([
                        { key: 'terminal',        label: 'Terminal',                                          type: 'text' },
                        { key: 'terminalClosing', label: isFr ? 'Fermeture terminal' : 'Terminal closing',    type: 'text' },
                        { key: 'vgmClosing',      label: 'VGM closing',                                       type: 'text' },
                        { key: 'customsClosing',  label: isFr ? 'Clôture douane' : 'Customs closing',         type: 'text' },
                      ] as { key: keyof FormState; label: string; type: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">{f.label}</label>
                          <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C]" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Marchandises */}
                <div className="bg-white rounded-2xl overflow-hidden">
                  <button type="button"
                    onClick={() => setBlManualSections(p => ({ ...p, goods: !p.goods }))}
                    className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 transition-colors">
                    <p className="text-sm font-bold text-[#1B3A5C]">{isFr ? 'Marchandises' : 'Goods'}</p>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${blManualSections.goods ? '' : '-rotate-90'}`} />
                  </button>
                  {blManualSections.goods && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                      {([
                        { key: 'descriptionOfGoods', label: isFr ? 'Description des marchandises' : 'Description of goods', type: 'text' },
                        { key: 'noOfPacks',          label: isFr ? 'Nombre de colis' : 'Number of packs',                  type: 'text' },
                        { key: 'kindOfPack',         label: isFr ? 'Type de colis' : 'Kind of pack',                       type: 'text' },
                        { key: 'linerTerms',         label: 'Liner terms',                                                  type: 'text' },
                        { key: 'imo',                label: isFr ? 'IMO / Marchandise dangereuse' : 'IMO / Hazardous goods', type: 'text' },
                        { key: 'grossWeightTons',    label: isFr ? 'Poids brut (tonnes)' : 'Gross weight (tons)',           type: 'text' },
                        { key: 'measurementCbm',     label: isFr ? 'Volume (m³)' : 'Measurement (CBM)',                    type: 'text' },
                      ] as { key: keyof FormState; label: string; type: string }[]).map(f => (
                        <div key={f.key}>
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">{f.label}</label>
                          <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C]" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Multiple vessel blocks — multi+separateVessels */}
            {isMultiSeparate && (
              <div className="space-y-3">
                {vessels.map((v, idx) => (
                  <div key={v.id} className="bg-white rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-[#1B3A5C]/5 border-b border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-white">{idx + 1}</span>
                        </div>
                        <p className="text-sm font-bold text-[#1B3A5C]">
                          {t.vesselLabel} {idx + 1}{v.shipName ? ` — ${v.shipName}` : ''}
                        </p>
                      </div>
                      {vessels.length > 1 && (
                        <button onClick={() => removeVessel(v.id)}
                          className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center">
                          <Trash2 size={11} className="text-red-400" />
                        </button>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <LogisticsFields
                        sn={v.shipName} vn={v.voyageNumber} sd={v.shipDate}
                        onChange={(k, val) => updateVessel(v.id, { [k]: val })}
                        lbl={lbl}
                      />
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                          {t.blCode}
                        </label>
                        <input
                          type="text"
                          value={v.code}
                          onChange={e => updateVessel(v.id, { code: e.target.value })}
                          placeholder="Ex: EA2604921DLAPME"
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C] font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addVessel}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-white/40 text-white text-sm font-semibold hover:bg-white/10 active:opacity-70 transition-all">
                  <Plus size={16} /> {t.addVessel}
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('equipement')}
                className="flex items-center gap-1 px-4 py-3.5 rounded-2xl border-2 border-white/30 text-white font-medium text-sm">
                <ChevronLeft size={16} /> {t.back}
              </button>
              <button
                disabled={!canStep3}
                onClick={() => {
                  if (mode === 'simple') {
                    const blFilled = [
                      form.eta, form.portOfLoading, form.portOfDischarge, form.placeOfReceipt, form.placeOfDelivery,
                      form.customerRef, form.service, form.blDate, form.bookingPartyName, form.bookingPartyRegion,
                      form.pickupRef, form.pickupQty, form.pickupSizeType, form.pickupUsage, form.pickupDepot, form.pickupReleaseDate,
                      form.terminal, form.terminalClosing, form.vgmClosing, form.customsClosing,
                      form.descriptionOfGoods, form.noOfPacks, form.kindOfPack, form.linerTerms, form.imo, form.grossWeightTons, form.measurementCbm,
                      form.containerTemp,
                    ].filter(v => v.trim()).length
                    if (blFilled === 0) { setShowBlFrictionPopup(true); return }
                  }
                  setStep('description')
                }}
                className="flex-1 py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-30">
                {t.next} <ChevronRight size={18} />
              </button>
            </div>

            {/* Popup friction Premium */}
            {showBlFrictionPopup && (
              <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50" onClick={() => setShowBlFrictionPopup(false)}>
                <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-col items-center text-center gap-3 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl">⚡</div>
                    <h3 className="text-base font-bold text-[#1B3A5C]">
                      {isFr ? 'Dossier presque vide' : 'Almost empty file'}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {isFr
                        ? 'Vous n\'avez renseigné que les informations de base. Avec Premium, les 28 autres champs sont extraits automatiquement de votre BL en quelques secondes.'
                        : 'You only filled in the basic information. With Premium, the other 28 fields are extracted automatically from your BL in seconds.'}
                    </p>
                    <div className="w-full bg-[#EDF1F7] rounded-xl px-4 py-3 text-left space-y-1">
                      {[
                        isFr ? '✓ ETA, ports, lieux de livraison' : '✓ ETA, ports, delivery places',
                        isFr ? '✓ Références pickup et release' : '✓ Pickup and release references',
                        isFr ? '✓ Délais terminal, VGM, douane' : '✓ Terminal, VGM, customs deadlines',
                        isFr ? '✓ Description et poids des marchandises' : '✓ Goods description and weight',
                      ].map(item => (
                        <p key={item} className="text-xs font-medium text-[#1B3A5C]">{item}</p>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowBlFrictionPopup(false); setPageMode('bl'); setBlStep('pick') }}
                    className="w-full py-3.5 rounded-2xl bg-[#1B3A5C] text-white font-bold mb-3 active:opacity-80">
                    {isFr ? 'Scanner mon BL' : 'Scan my BL'}
                  </button>
                  <button
                    onClick={() => { setShowBlFrictionPopup(false); setStep('description') }}
                    className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-medium text-sm active:bg-gray-50">
                    {isFr ? 'Continuer quand même' : 'Continue anyway'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4 : Description + Documents ── */}
        {step === 'description' && (
          <div className="space-y-4">
            <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
              <h2 className="text-base font-bold text-white mb-0.5">{t.descTitle}<Req /></h2>
              <p className="text-sm text-blue-100">{t.descSub}</p>
            </div>

            {/* Same-situation toggle — multi + separate vessels only */}
            {isMultiSeparate && (
              <div className="bg-white/10 rounded-2xl px-4 py-4 border border-white/15">
                <p className="text-sm font-semibold text-white mb-3">{t.sameSit}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map(val => (
                    <button key={String(val)} onClick={() => setSameSituation(val)}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        sameSituation === val ? 'border-white bg-white text-[#1B3A5C]' : 'border-white/30 text-white'
                      }`}>
                      {val ? t.yes : t.no}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Per-vessel description blocks (multi + separate + different situations) */}
            {isMultiSeparate && sameSituation === false && vessels.map((v, idx) => (
              <div key={v.id} className="rounded-2xl overflow-hidden border border-white/20">
                {/* Vessel header */}
                <div className="bg-[#1B3A5C]/70 px-4 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#4A8FC4] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">
                      {v.shipName ? v.shipName : `${t.vesselLabel} ${idx + 1}`}
                    </p>
                    {v.shipLine && <p className="text-xs text-blue-200 mt-0.5">{v.shipLine}</p>}
                  </div>
                </div>
                {/* Content */}
                <div className="bg-white p-4 space-y-4">
                  {/* Description */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{t.descLabel}</p>
                    <p className="text-[11px] text-gray-400 mb-2">{t.descVesselSub}</p>
                    <textarea
                      value={v.description}
                      onChange={e => updateVessel(v.id, { description: e.target.value.slice(0, 10000) })}
                      placeholder={t.descVesselPh}
                      rows={4}
                      className="w-full text-sm focus:outline-none resize-none text-gray-800 leading-relaxed"
                    />
                    <p className="text-xs text-gray-300 text-right mt-0.5">{v.description.length}/10000</p>
                  </div>
                  {/* Documents */}
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Documents</p>
                    <p className="text-xs text-gray-400 mb-3">{t.uploadHint}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => openVesselUpload(v.id)}
                        className="flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-gray-500 text-xs font-semibold hover:border-[#4A8FC4] hover:text-[#4A8FC4] transition-all">
                        <Upload size={13} /> {t.addFile}
                      </button>
                      <button onClick={() => { setScanVesselId(v.id); setShowScanner(true) }}
                        className="flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-xl py-2.5 text-gray-500 text-xs font-semibold hover:border-[#4A8FC4] hover:text-[#4A8FC4] transition-all">
                        <Camera size={13} /> {t.scan}
                      </button>
                    </div>
                    {v.files.length > 0 && (
                      <p className="text-xs text-emerald-600 font-semibold mt-2">{v.files.length} {t.filesAdded}</p>
                    )}
                    <FilePreviews prevs={v.previews} fls={v.files} onRemove={i => removeVesselFile(v.id, i)} />
                  </div>
                </div>
              </div>
            ))}

            {/* Single description + docs (simple / sameVessel / sameSituation) */}
            {(!isMultiSeparate || sameSituation === true) && (
              <>
                <div className="bg-white rounded-2xl p-4">
                  <textarea
                    value={form.description}
                    onChange={e => set('description', e.target.value.slice(0, 10000))}
                    placeholder={t.descPlaceholder}
                    rows={6}
                    className="w-full text-sm focus:outline-none resize-none text-gray-800 leading-relaxed"
                  />
                  <p className="text-xs text-gray-300 text-right mt-1">{form.description.length}/10000</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-4 border border-white/15 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-white/80 uppercase tracking-wide mb-1">Documents</p>
                    <p className="text-xs text-blue-100 leading-relaxed">{t.uploadHint}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => uploadRef.current?.click()}
                      className="flex items-center justify-center gap-2 border-2 border-dashed border-white/40 rounded-xl py-3 text-white text-xs font-semibold hover:bg-white/10 active:opacity-70 transition-all">
                      <Upload size={16} /> {t.addFile}
                    </button>
                    <button onClick={() => { setScanVesselId(null); setShowScanner(true) }}
                      className="flex items-center justify-center gap-2 border-2 border-dashed border-white/40 rounded-xl py-3 text-white text-xs font-semibold hover:bg-white/10 active:opacity-70 transition-all">
                      <Camera size={16} /> {t.scan}
                    </button>
                  </div>
                  {files.length > 0 && (
                    <p className="text-xs text-emerald-300 font-semibold">{files.length} {t.filesAdded}</p>
                  )}
                  <FilePreviews prevs={previews} fls={files} onRemove={removeFile} dark />
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('logistique')}
                className="flex items-center gap-1 px-4 py-3.5 rounded-2xl border-2 border-white/30 text-white font-medium text-sm">
                <ChevronLeft size={16} /> {t.back}
              </button>
              <button onClick={() => setStep('recap')} disabled={!canNextDesc}
                className="flex-1 py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-30">
                {t.next} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5 : Récapitulatif ── */}
        {step === 'recap' && (
          <div className="space-y-3">
            <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
              <h2 className="text-base font-bold text-white mb-0.5">{t.recap}</h2>
              <p className="text-sm text-blue-100">{t.recapSub}</p>
            </div>

            {/* Avertissement dossier incomplet — mode simple sans champs BL */}
            {mode === 'simple' && (() => {
              const blFilled = [
                form.eta, form.portOfLoading, form.portOfDischarge, form.placeOfReceipt, form.placeOfDelivery,
                form.customerRef, form.service, form.blDate, form.bookingPartyName, form.bookingPartyRegion,
                form.pickupRef, form.pickupQty, form.pickupSizeType, form.pickupUsage, form.pickupDepot, form.pickupReleaseDate,
                form.terminal, form.terminalClosing, form.vgmClosing, form.customsClosing,
                form.descriptionOfGoods, form.noOfPacks, form.kindOfPack, form.linerTerms, form.imo, form.grossWeightTons, form.measurementCbm,
                form.containerTemp,
              ].filter(v => v.trim()).length
              const missing = 28 - blFilled
              if (missing <= 0) return null
              return (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-orange-800">
                        {isFr
                          ? `Dossier incomplet — ${missing} information${missing > 1 ? 's' : ''} manquante${missing > 1 ? 's' : ''}`
                          : `Incomplete file — ${missing} missing field${missing > 1 ? 's' : ''}`}
                      </p>
                      <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                        {isFr
                          ? 'Les agents devront vous recontacter pour obtenir ces informations, allongeant le délai de traitement.'
                          : 'Agents will need to contact you to obtain this information, increasing processing time.'}
                      </p>
                      <button
                        onClick={() => { setPageMode('bl'); setBlStep('pick') }}
                        className="mt-2.5 inline-flex items-center gap-1.5 bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1.5 rounded-xl active:opacity-70">
                        ⚡ {isFr ? 'Scanner mon BL à la place' : 'Scan my BL instead'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Catégorie */}
            <RecapSection title={t.catLabel} isOpen={openRecap.cat} onToggle={() => toggleRecap('cat')}>
              <div className="pt-3">
                <p className="text-sm font-bold text-[#1B3A5C]">{finalCategory}</p>
                {finalSubcat && <p className="text-xs text-gray-500 mt-1">{finalSubcat}</p>}
              </div>
            </RecapSection>

            {/* Équipement */}
            <RecapSection title={t.equipment} isOpen={openRecap.equip} onToggle={() => toggleRecap('equip')}>
              {mode === 'conventionnel' ? (
                <div className="pt-3">
                  <span className="inline-flex items-center bg-[#1B3A5C]/8 text-[#1B3A5C] text-xs font-semibold px-3 py-1.5 rounded-xl mb-2">
                    {isFr ? 'Conventionnel' : 'Conventional'}
                  </span>
                  <p className="text-sm text-gray-700">{form.conventionnelDesc}</p>
                </div>
              ) : mode === 'simple' ? (
                <div className="pt-3 space-y-2">
                  <span className="inline-flex items-center bg-[#1B3A5C]/8 text-[#1B3A5C] text-sm font-semibold px-3 py-1.5 rounded-xl">
                    {(form.equipmentType === 'Autre' || form.equipmentType === 'Other') ? form.equipmentOther : form.equipmentType}
                  </span>

                  {form.containerNumber.trim() && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block bg-gray-100 text-gray-600 font-mono text-[11px] px-2.5 py-1 rounded">
                        {form.containerNumber.trim()}
                      </span>
                      {isValidContainerNumber(form.containerNumber) && (
                        <span className="text-[10px] font-bold text-emerald-500">✓</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-3">
                  {containers.filter(c => (c.type && c.type !== 'Autre' && c.type !== 'Other') || c.typeOther.trim()).map((c, i) => {
                    const actual = (c.type === 'Autre' || c.type === 'Other') ? c.typeOther : c.type
                    return (
                      <div key={c.id} className={`py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                        <p className="text-sm font-semibold text-gray-900">{actual}</p>
                        {c.number.trim() && (
                          <span className="inline-block bg-gray-100 text-gray-600 font-mono text-[10px] px-2 py-0.5 rounded mt-1">
                            {c.number.trim()}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {sameVessel !== null && (
                    <div className="pt-2.5 mt-0.5 border-t border-gray-100">
                      <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                        sameVessel ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {sameVessel
                          ? (isFr ? 'Même navire pour tous' : 'Same vessel for all')
                          : (isFr ? 'Navires distincts' : 'Separate vessels')
                        }
                      </span>
                    </div>
                  )}
                </div>
              )}
            </RecapSection>

            {/* Logistique */}
            <RecapSection title={t.logistique} isOpen={openRecap.log} onToggle={() => toggleRecap('log')}>
              <div className="pt-3 space-y-3">
                {/* BL / Code */}
                {form.code.trim() && (
                  <div className="flex items-center justify-between bg-[#EDF1F7] rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-bold text-[#1B3A5C] uppercase tracking-wide">{t.blCode}</p>
                    <p className="text-sm font-mono font-bold text-[#1B3A5C]">{form.code.trim()}</p>
                  </div>
                )}
                {/* Single ship info */}
                {!isMultiSeparate && (form.shipName || form.voyageNumber || form.shipDate) && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {[
                      { l: t.shipName, v: form.shipName },
                      { l: t.voyageNo, v: form.voyageNumber },
                      { l: t.shipDate, v: form.shipDate },
                    ].filter(f => f.v).map(f => (
                      <div key={f.l}>
                        <p className="text-[10px] text-gray-400 font-medium">{f.l}</p>
                        <p className="text-xs font-semibold text-gray-800 mt-0.5">{f.v}</p>
                      </div>
                    ))}
                  </div>
                )}
                {!isMultiSeparate && !form.shipName && !form.voyageNumber && !form.shipDate && !form.code.trim() && (
                  <p className="text-xs text-gray-400 italic">{t.noLog}</p>
                )}
                {/* Per-vessel ship info */}
                {isMultiSeparate && vessels.map((v, idx) => (
                  <div key={v.id} className="rounded-xl overflow-hidden border border-gray-100">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-100">
                      <div className="w-5 h-5 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">{idx + 1}</span>
                      </div>
                      <p className="text-xs font-bold text-[#1B3A5C]">
                        {t.vesselLabel} {idx + 1}{v.shipName ? ` — ${v.shipName}` : ''}
                      </p>
                    </div>
                    <div className="p-3 space-y-2">
                      {v.code.trim() && (
                        <div className="flex items-center justify-between bg-[#EDF1F7] rounded-lg px-2.5 py-1.5">
                          <p className="text-[10px] font-bold text-[#1B3A5C] uppercase tracking-wide">{t.blCode}</p>
                          <p className="text-xs font-mono font-bold text-[#1B3A5C]">{v.code.trim()}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {[
                          { l: isFr ? 'Armateur' : 'Shipping line', v: v.shipLine },
                          { l: t.shipName, v: v.shipName },
                          { l: t.voyageNo, v: v.voyageNumber },
                          { l: t.shipDate, v: v.shipDate },
                        ].filter(f => f.v).map(f => (
                          <div key={f.l}>
                            <p className="text-[10px] text-gray-400 font-medium">{f.l}</p>
                            <p className="text-xs font-semibold text-gray-800 mt-0.5">{f.v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {/* BL manual fields recap — mode simple */}
                {mode === 'simple' && (() => {
                  const hasRefs     = form.customerRef || form.service || form.blDate || form.bookingPartyName || form.bookingPartyRegion
                  const hasTransport = form.eta || form.portOfLoading || form.portOfDischarge || form.placeOfReceipt || form.placeOfDelivery
                  const hasPickup   = form.pickupRef || form.pickupQty || form.pickupSizeType || form.pickupUsage || form.pickupDepot || form.pickupReleaseDate || form.containerTemp
                  const hasDelays   = form.terminal || form.terminalClosing || form.vgmClosing || form.customsClosing
                  const hasGoods    = form.descriptionOfGoods || form.noOfPacks || form.kindOfPack || form.linerTerms || form.imo || form.grossWeightTons || form.measurementCbm
                  if (!hasRefs && !hasTransport && !hasPickup && !hasDelays && !hasGoods) return null
                  const Row = ({ label, value }: { label: string; value: string }) => (
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
                      <p className="text-xs font-semibold text-gray-800 mt-0.5">{value}</p>
                    </div>
                  )
                  return (
                    <div className="space-y-3 mt-1 pt-3 border-t border-gray-100">
                      {hasRefs && (
                        <div>
                          <p className="text-[10px] font-bold text-[#1B3A5C] uppercase tracking-wide mb-2">{isFr ? 'Références BL' : 'BL References'}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {form.customerRef    && <Row label={isFr ? 'Réf. client' : 'Customer ref'} value={form.customerRef} />}
                            {form.service        && <Row label="Service"                                value={form.service} />}
                            {form.blDate         && <Row label={isFr ? 'Date BL' : 'BL date'}          value={form.blDate} />}
                            {form.bookingPartyName   && <Row label={isFr ? 'Booking party' : 'Booking party'} value={form.bookingPartyName} />}
                            {form.bookingPartyRegion && <Row label={isFr ? 'Région' : 'Region'}          value={form.bookingPartyRegion} />}
                          </div>
                        </div>
                      )}
                      {hasTransport && (
                        <div>
                          <p className="text-[10px] font-bold text-[#1B3A5C] uppercase tracking-wide mb-2">Transport</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {form.eta             && <Row label="ETA"                                           value={form.eta} />}
                            {form.portOfLoading   && <Row label={isFr ? 'Port chargement' : 'Port of loading'} value={form.portOfLoading} />}
                            {form.portOfDischarge && <Row label={isFr ? 'Port déchargement' : 'Port of discharge'} value={form.portOfDischarge} />}
                            {form.placeOfReceipt  && <Row label={isFr ? 'Lieu réception' : 'Place of receipt'} value={form.placeOfReceipt} />}
                            {form.placeOfDelivery && <Row label={isFr ? 'Lieu livraison' : 'Place of delivery'} value={form.placeOfDelivery} />}
                          </div>
                        </div>
                      )}
                      {hasPickup && (
                        <div>
                          <p className="text-[10px] font-bold text-[#1B3A5C] uppercase tracking-wide mb-2">{isFr ? 'Pickup / Conteneur' : 'Pickup / Container'}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {form.pickupRef        && <Row label={isFr ? 'Référence' : 'Reference'}          value={form.pickupRef} />}
                            {form.pickupQty        && <Row label={isFr ? 'Quantité' : 'Quantity'}            value={form.pickupQty} />}
                            {form.pickupSizeType   && <Row label="Size/Type"                                   value={form.pickupSizeType} />}
                            {form.pickupUsage      && <Row label="Usage"                                       value={form.pickupUsage} />}
                            {form.pickupDepot      && <Row label="Dépôt"                                       value={form.pickupDepot} />}
                            {form.pickupReleaseDate && <Row label="Release"                                   value={form.pickupReleaseDate} />}
                            {form.containerTemp    && <Row label={isFr ? 'Température' : 'Temperature'}      value={form.containerTemp} />}
                          </div>
                        </div>
                      )}
                      {hasDelays && (
                        <div>
                          <p className="text-[10px] font-bold text-[#1B3A5C] uppercase tracking-wide mb-2">{isFr ? 'Délais terminal' : 'Terminal deadlines'}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {form.terminal        && <Row label="Terminal"                                             value={form.terminal} />}
                            {form.terminalClosing && <Row label={isFr ? 'Fermeture terminal' : 'Terminal closing'}    value={form.terminalClosing} />}
                            {form.vgmClosing      && <Row label="VGM"                                                 value={form.vgmClosing} />}
                            {form.customsClosing  && <Row label={isFr ? 'Douane' : 'Customs'}                        value={form.customsClosing} />}
                          </div>
                        </div>
                      )}
                      {hasGoods && (
                        <div>
                          <p className="text-[10px] font-bold text-[#1B3A5C] uppercase tracking-wide mb-2">{isFr ? 'Marchandises' : 'Goods'}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {form.descriptionOfGoods && <Row label={isFr ? 'Description' : 'Description'} value={form.descriptionOfGoods} />}
                            {form.noOfPacks          && <Row label={isFr ? 'Nb. colis' : 'No. of packs'}  value={form.noOfPacks} />}
                            {form.kindOfPack         && <Row label={isFr ? 'Type colis' : 'Kind of pack'} value={form.kindOfPack} />}
                            {form.linerTerms         && <Row label="Liner terms"                           value={form.linerTerms} />}
                            {form.imo                && <Row label="IMO"                                   value={form.imo} />}
                            {form.grossWeightTons    && <Row label={isFr ? 'Poids (t)' : 'Weight (t)'}   value={form.grossWeightTons} />}
                            {form.measurementCbm     && <Row label={isFr ? 'Volume (m³)' : 'Volume (CBM)'} value={form.measurementCbm} />}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </RecapSection>

            {/* Description + Documents */}
            <RecapSection title={t.descLabel} isOpen={openRecap.desc} onToggle={() => toggleRecap('desc')}>
              <div className="pt-3 space-y-4">
                {/* Per-vessel when different situations */}
                {isMultiSeparate && sameSituation === false && vessels.map((v, idx) => (
                  <div key={v.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-[#4A8FC4] flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-white">{idx + 1}</span>
                      </div>
                      <p className="text-xs font-bold text-[#1B3A5C]">
                        {v.shipName ? v.shipName : `${t.vesselLabel} ${idx + 1}`}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed pl-7 mb-3">{v.description}</p>
                    {v.files.length > 0 && (
                      <div className="pl-7">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                          {t.documents}
                        </p>
                        <RecapPreviews prevs={v.previews} fls={v.files} noDoc={t.noDoc} filesAdded={t.filesAdded} />
                      </div>
                    )}
                    {idx < vessels.length - 1 && (
                      <div className="mt-3 border-t border-gray-100" />
                    )}
                  </div>
                ))}
                {/* Single description + docs */}
                {(!isMultiSeparate || sameSituation === true) && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700 leading-relaxed">{form.description}</p>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{t.documents}</p>
                      <RecapPreviews prevs={previews} fls={files} noDoc={t.noDoc} filesAdded={t.filesAdded} />
                    </div>
                  </div>
                )}
              </div>
            </RecapSection>

            <div className="flex gap-3 pb-4">
              <button onClick={() => setStep('description')}
                className="flex items-center gap-1 px-4 py-3.5 rounded-2xl border-2 border-white/30 text-white font-medium text-sm">
                <ChevronLeft size={16} /> {t.back}
              </button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg active:scale-[0.99] transition-transform">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {t.submit}
              </button>
            </div>
          </div>
        )}
      </MobileLayout>
    </>
  )
}
