'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MobileLayout } from '@/components/layout/MobileLayout'
import {
  Upload, Camera, X, FileText, ChevronRight, ChevronLeft, ChevronDown,
  Check, Loader2, Star, Plus, Trash2, WifiOff,
} from 'lucide-react'
import { getUser, apiFetch, apiUpload } from '@/lib/api-client'
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

const EQUIPMENT_FR = ['20 pieds', '40 pieds', 'Conventionnel', 'Autre']
const EQUIPMENT_EN = ['20 feet',  '40 feet',  'Conventional',  'Other']

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'categorie' | 'equipement' | 'logistique' | 'description' | 'recap'

interface FormState {
  category: string; categoryOther: string
  subcategory: string; subcategoryOther: string
  equipmentType: string; equipmentOther: string
  containerNumber: string
  shipLine: string; shipName: string; voyageNumber: string; shipDate: string
  code: string
  description: string
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
  shipLine: string; shipName: string; voyageNo: string; shipDate: string; optional: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidContainerNumber(n: string): boolean {
  return /^[A-Z]{3}[UJZ]\d{7}$/.test(n.replace(/\s/g, '').toUpperCase())
}

// ── Module-level sub-components ───────────────────────────────────────────────
// Defined outside page to prevent React from remounting inputs on every render

const Req = () => <span className="text-red-400 ml-0.5">*</span>

function LogisticsFields({ sl, sn, vn, sd, onChange, lbl }: {
  sl: string; sn: string; vn: string; sd: string
  onChange: (key: string, val: string) => void
  lbl: LogisticsLabels
}) {
  return (
    <div className="space-y-3">
      {[
        { key: 'shipLine',     label: lbl.shipLine, val: sl, required: false },
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
    containerNumber: '',
    shipLine: '', shipName: '', voyageNumber: '', shipDate: '',
    code: '',
    description: '',
  })

  const [mode, setMode]             = useState<'simple' | 'multi'>('simple')
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
    // If there are pending actions from a previous offline session, show the waiting screen
    offlineDb.hasPending().then(has => {
      if (has && !navigator.onLine) setPendingOffline(true)
      // If online, MobileLayout's sync will handle it automatically
    })
  }, [])

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

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function submit() {
    setSubmitting(true)
    try {
      const shipLine     = isMultiSeparate ? (vessels[0]?.shipLine || undefined)     : (form.shipLine || undefined)
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
            shipLine:      v.shipLine || null,
            shipName:      v.shipName || null,
            voyageNumber:  v.voyageNumber || null,
            shipDate:      v.shipDate || null,
            code:          v.code.trim() || null,
          })))
        : undefined

      const body = {
        category:      finalCategory,
        subcategory:   finalSubcat || undefined,
        equipmentType: finalEquipment || undefined,
        shipLine, shipName, voyageNumber, shipDate,
        code:        isMultiSeparate ? undefined : (form.code.trim() || undefined),
        vesselData,
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
    shipLine: 'Compagnie maritime', shipName: 'Nom du navire',
    voyageNo: 'Numéro de voyage',  shipDate: 'Date de voyage', optional: 'Optionnel',
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
    shipLine: 'Shipping company', shipName: 'Ship name',
    voyageNo: 'Voyage number',   shipDate: 'Travel date', optional: 'Optional',
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
    shipLine: t.shipLine, shipName: t.shipName,
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

  const canStep2 = mode === 'simple'
    ? (!!form.equipmentType && (form.equipmentType !== 'Autre' && form.equipmentType !== 'Other' ? true : !!form.equipmentOther.trim()))
    : containers.some(c => {
        if (!c.type) return false
        if (c.type === 'Autre' || c.type === 'Other') return c.typeOther.trim().length > 0
        return true
      })

  const canStep3 = (() => {
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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {showScanner && (
        <ScannerModal
          isFr={isFr}
          onScan={file => {
            if (scanVesselId !== null) {
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
          onClose={() => { setShowScanner(false); setScanVesselId(null) }}
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
          </div>
        )}

        {/* ── STEP 2 : Équipement ── */}
        {step === 'equipement' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(['simple', 'multi'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`py-3 rounded-2xl text-sm font-bold border-2 transition-all ${
                    mode === m ? 'border-white bg-white text-[#1B3A5C]' : 'border-white/30 text-white'
                  }`}>
                  {m === 'simple' ? t.modeSimple : t.modeMulti}
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
                  placeholder="Ex: BL-2024-XXXX"
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

            {/* Single logistics block — simple mode OR multi+sameVessel */}
            {(mode === 'simple' || sameVessel === true) && (
              <div className="bg-white rounded-2xl p-4">
                <LogisticsFields
                  sl={form.shipLine} sn={form.shipName} vn={form.voyageNumber} sd={form.shipDate}
                  onChange={(k, v) => set(k as keyof FormState, v)}
                  lbl={lbl}
                />
              </div>
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
                        sl={v.shipLine} sn={v.shipName} vn={v.voyageNumber} sd={v.shipDate}
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
                          placeholder="Ex: BL-2024-XXXX"
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
              <button onClick={() => setStep('description')}
                disabled={!canStep3}
                className="flex-1 py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold flex items-center justify-center gap-2 disabled:opacity-30">
                {t.next} <ChevronRight size={18} />
              </button>
            </div>
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
                    <p className="text-xs text-gray-300 text-right">{v.description.length}/10000</p>
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

            {/* Catégorie */}
            <RecapSection title={t.catLabel} isOpen={openRecap.cat} onToggle={() => toggleRecap('cat')}>
              <div className="pt-3">
                <p className="text-sm font-bold text-[#1B3A5C]">{finalCategory}</p>
                {finalSubcat && <p className="text-xs text-gray-500 mt-1">{finalSubcat}</p>}
              </div>
            </RecapSection>

            {/* Équipement */}
            <RecapSection title={t.equipment} isOpen={openRecap.equip} onToggle={() => toggleRecap('equip')}>
              {mode === 'simple' ? (
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
                {!isMultiSeparate && (form.shipLine || form.shipName || form.voyageNumber || form.shipDate) && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {[
                      { l: t.shipLine, v: form.shipLine },
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
                {!isMultiSeparate && !form.shipLine && !form.shipName && !form.voyageNumber && !form.shipDate && !form.code.trim() && (
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
                          { l: t.shipLine, v: v.shipLine },
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
