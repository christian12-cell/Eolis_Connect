'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { apiFetch, getUser } from '@/lib/api-client'
import { offlineDb, fileToStored } from '@/lib/offline-db'
import { Upload, Camera, CheckCircle, Clock, X, Zap } from 'lucide-react'

const ORANGE_NUMBER = '689 506 319'
const MTN_NUMBER    = '676 652 945'
const ACCOUNT_NAME  = 'Blandine Denmeko'
const MIN_AMOUNT    = 500

export default function RechargerPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [step, setStep]     = useState<'form' | 'confirm' | 'done' | 'pending_offline'>('form')
  const [amount, setAmount] = useState('')
  const [photo, setPhoto]   = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [balance, setBalance] = useState<{ creditsRemaining: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/accueil`); return }
    apiFetch('/api/credits/balance').then(r => r.json()).then(setBalance).catch(() => {})
  }, [locale])

  const isFr    = locale === 'fr'
  const credits = amount ? parseInt(amount) || 0 : 0

  function handlePhoto(file: File) {
    setPhoto(file)
    const url = URL.createObjectURL(file)
    setPhotoPreview(url)
  }

  async function submit() {
    if (!photo || credits < MIN_AMOUNT) return
    setSubmitting(true)
    try {
      if (!navigator.onLine) {
        const stored = await fileToStored(photo)
        await offlineDb.add({
          type: 'CREDIT_REQUEST',
          payload: { amountDeclared: credits },
          files: [stored],
        })
        setStep('pending_offline')
        return
      }
      const fd = new FormData()
      fd.append('amount_declared', String(credits))
      fd.append('photo', photo, photo.name)
      const res = await apiFetch('/api/credits/request', { method: 'POST', body: fd })
      if (res.ok) setStep('done')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'done' || step === 'pending_offline') {
    return (
      <MobileLayout locale={locale} title={isFr ? 'Recharger' : 'Top up'} showBack>
        <div className="flex flex-col items-center text-center gap-5 pt-6">
          {step === 'done'
            ? <CheckCircle size={56} className="text-emerald-400" />
            : <Clock size={56} className="text-amber-400" />}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">
              {step === 'done'
                ? (isFr ? 'Demande envoyée !' : 'Request sent!')
                : (isFr ? 'Demande en attente' : 'Request queued')}
            </h2>
            <p className="text-sm text-blue-100 leading-relaxed max-w-xs mx-auto">
              {step === 'done'
                ? (isFr ? 'Votre demande est en cours de validation. Vous recevrez une notification dès que vos crédits seront ajoutés.' : 'Your request is being reviewed. You will be notified once credits are added.')
                : (isFr ? 'Votre demande sera envoyée automatiquement dès le retour de votre connexion.' : 'Your request will be sent automatically when your connection is restored.')}
            </p>
          </div>
          <button onClick={() => router.push(`/${locale}/depenses`)}
            className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold">
            {isFr ? 'Voir mes crédits' : 'View my credits'}
          </button>
        </div>
      </MobileLayout>
    )
  }

  if (step === 'confirm') {
    return (
      <MobileLayout locale={locale} title={isFr ? 'Confirmer' : 'Confirm'} showBack>
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
            <h2 className="text-base font-bold text-gray-900">{isFr ? 'Récapitulatif' : 'Summary'}</h2>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{isFr ? 'Montant envoyé' : 'Amount sent'}</span>
              <span className="font-bold text-gray-900">{credits} FCFA</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{isFr ? 'Crédits à recevoir' : 'Credits to receive'}</span>
              <span className="font-bold text-[#1B3A5C]">{credits} crédits</span>
            </div>
            {photoPreview && (
              <img src={photoPreview} alt="proof" className="w-full rounded-xl max-h-48 object-cover border border-gray-100" />
            )}
          </div>
          <button onClick={submit} disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold disabled:opacity-50">
            {submitting ? '...' : (isFr ? 'Envoyer la demande' : 'Submit request')}
          </button>
          <button onClick={() => setStep('form')}
            className="w-full py-3 text-white/60 text-sm">
            ← {isFr ? 'Modifier' : 'Edit'}
          </button>
        </div>
      </MobileLayout>
    )
  }

  return (
    <MobileLayout locale={locale} title={isFr ? 'Recharger mes crédits' : 'Top up credits'} showBack>
      <div className="space-y-4">

        {/* Current balance */}
        {balance !== null && (
          <div className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-2xl px-4 py-3">
            <Zap size={16} className="text-amber-300 flex-shrink-0" />
            <p className="text-sm text-white">
              {isFr ? 'Solde actuel :' : 'Current balance:'}
              <span className="font-bold ml-1">{balance.creditsRemaining} crédits</span>
            </p>
          </div>
        )}

        {/* How it works */}
        <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            {isFr ? 'Comment recharger' : 'How to top up'}
          </h2>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2"><span className="font-bold text-[#1B3A5C] w-4 flex-shrink-0">1.</span>{isFr ? 'Envoyez le montant via MTN ou Orange Money' : 'Send via MTN or Orange Money'}</li>
            <li className="flex gap-2"><span className="font-bold text-[#1B3A5C] w-4 flex-shrink-0">2.</span>{isFr ? 'Prenez une capture du message de confirmation' : 'Screenshot the confirmation message'}</li>
            <li className="flex gap-2"><span className="font-bold text-[#1B3A5C] w-4 flex-shrink-0">3.</span>{isFr ? 'Remplissez le formulaire ci-dessous' : 'Fill in the form below'}</li>
          </ol>
          <p className="text-xs text-gray-400">{isFr ? '1 crédit = 1 FCFA · minimum 500 FCFA' : '1 credit = 1 FCFA · minimum 500 FCFA'}</p>
        </div>

        {/* Payment numbers */}
        <div className="space-y-2">
          {[
            { op: 'Orange Money', num: ORANGE_NUMBER, color: 'bg-orange-50 border-orange-200' },
            { op: 'MTN MoMo',     num: MTN_NUMBER,    color: 'bg-yellow-50 border-yellow-200' },
          ].map(({ op, num, color }) => (
            <div key={op} className={`${color} border rounded-2xl px-4 py-3 flex items-center justify-between`}>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{op}</p>
                <p className="text-lg font-bold text-gray-900 font-mono">{num}</p>
                <p className="text-xs text-gray-500">{ACCOUNT_NAME}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-sm">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
              {isFr ? 'Montant envoyé (FCFA)' : 'Amount sent (FCFA)'}
            </label>
            <input type="number" min={MIN_AMOUNT} value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="500"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C]" />
            {credits >= MIN_AMOUNT && (
              <p className="text-xs text-[#4A8FC4] mt-1">→ {credits} crédits seront ajoutés</p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
              {isFr ? 'Capture de confirmation' : 'Confirmation screenshot'}
            </label>
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="" className="w-full rounded-xl max-h-40 object-cover" />
                <button onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center">
                  <X size={12} className="text-white" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-3 text-gray-500 text-xs font-semibold cursor-pointer">
                  <Upload size={14} /> {isFr ? 'Galerie' : 'Gallery'}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f) }} />
                </label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-3 text-gray-500 text-xs font-semibold cursor-pointer">
                  <Camera size={14} /> {isFr ? 'Caméra' : 'Camera'}
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f) }} />
                </label>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setStep('confirm')}
          disabled={credits < MIN_AMOUNT || !photo}
          className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold disabled:opacity-30">
          {isFr ? 'Continuer →' : 'Continue →'}
        </button>
      </div>
    </MobileLayout>
  )
}
