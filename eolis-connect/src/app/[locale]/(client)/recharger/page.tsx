'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { ScannerModal } from '@/components/scanner/ScannerModal'
import { apiFetch, apiUpload, getUser } from '@/lib/api-client'
import { offlineDb, fileToStored } from '@/lib/offline-db'
import { Upload, Camera, X, Zap, FileText, Bell, Wallet, ChevronRight } from 'lucide-react'

const ORANGE_NUMBER = '689 506 319'
const MTN_NUMBER    = '676 652 945'
const ACCOUNT_NAME  = 'Blandine Denmeko'
const MIN_AMOUNT    = 500
const ACCEPT        = 'image/*,application/pdf,.pdf'

export default function RechargerPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]       = useState('fr')
  const [step, setStep]           = useState<'form' | 'confirm' | 'done' | 'pending_offline'>('form')
  const [amount, setAmount]       = useState('')
  const [proof, setProof]         = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [proofIsPdf, setProofIsPdf]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [balance, setBalance]     = useState<{ creditsRemaining: number } | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/accueil`); return }
    apiFetch('/api/credits/balance').then(r => r.json()).then(setBalance).catch(() => {})
  }, [locale])

  const isFr    = locale === 'fr'
  const credits = parseInt(amount) || 0

  function handleFile(file: File) {
    setProof(file)
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
    setProofIsPdf(isPdf)
    if (!isPdf) {
      setProofPreview(URL.createObjectURL(file))
    } else {
      setProofPreview(null)
    }
  }

  function clearProof() {
    setProof(null)
    setProofPreview(null)
    setProofIsPdf(false)
  }

  async function submit() {
    if (!proof || credits < MIN_AMOUNT) return
    setSubmitting(true)
    try {
      if (!navigator.onLine) {
        const stored = await fileToStored(proof)
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
      fd.append('photo', proof, proof.name)
      const res = await apiUpload('/api/credits/request', fd)
      if (res.ok) setStep('done')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Page de confirmation ───────────────────────────────────────────────────

  if (step === 'done' || step === 'pending_offline') {
    const isOffline = step === 'pending_offline'
    return (
      <MobileLayout locale={locale} title={isFr ? 'Demande envoyée' : 'Request sent'}>
        <div className="flex flex-col items-center gap-6 pt-4">

          {/* Animated icon */}
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
            isOffline ? 'bg-amber-400/20' : 'bg-emerald-400/20'
          } animate-pulse`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isOffline ? 'bg-amber-400/30' : 'bg-emerald-400/30'
            }`}>
              {isOffline
                ? <span className="text-4xl">📶</span>
                : <span className="text-4xl">✅</span>}
            </div>
          </div>

          {/* Title */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">
              {isOffline
                ? (isFr ? 'Demande mise en attente' : 'Request queued')
                : (isFr ? 'Demande envoyée !' : 'Request sent!')}
            </h2>
            <p className="text-sm text-blue-200 leading-relaxed max-w-xs mx-auto">
              {isOffline
                ? (isFr
                    ? 'Pas de connexion détectée. Votre demande sera envoyée automatiquement dès que vous serez reconnecté.'
                    : 'No connection detected. Your request will be sent automatically when you reconnect.')
                : (isFr
                    ? `Votre demande de ${credits} crédits a bien été reçue et est en cours de vérification.`
                    : `Your request for ${credits} credits has been received and is being reviewed.`)}
            </p>
          </div>

          {/* What happens next */}
          {!isOffline && (
            <div className="w-full bg-white rounded-2xl p-5 shadow-sm space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                {isFr ? 'Prochaines étapes' : 'What happens next'}
              </p>
              {[
                {
                  icon: '🔍',
                  text: isFr ? 'Un administrateur vérifie votre preuve de paiement.' : 'An admin verifies your payment proof.',
                },
                {
                  icon: <Bell size={16} className="text-[#4A8FC4]" />,
                  text: isFr ? 'Vous recevrez une notification dès que vos crédits sont ajoutés.' : 'You will receive a notification once your credits are added.',
                },
                {
                  icon: <Zap size={16} className="text-amber-500" />,
                  text: isFr ? `${credits} crédits apparaîtront dans votre solde.` : `${credits} credits will appear in your balance.`,
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#EDF1F7] flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                    {typeof item.icon === 'string' ? item.icon : item.icon}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* CTA buttons */}
          <div className="w-full space-y-3">
            <button
              onClick={() => router.push(`/${locale}/depenses`)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white shadow-sm active:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EDF1F7] flex items-center justify-center">
                  <Wallet size={16} className="text-[#1B3A5C]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">
                    {isFr ? 'Voir mes crédits' : 'View my credits'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {isFr ? 'Solde et historique' : 'Balance and history'}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </button>

            <button
              onClick={() => router.push(`/${locale}/accueil`)}
              className="w-full py-3 rounded-2xl border border-white/30 text-white/70 text-sm">
              {isFr ? 'Retour à l\'accueil' : 'Back to home'}
            </button>
          </div>
        </div>
      </MobileLayout>
    )
  }

  // ── Récapitulatif ─────────────────────────────────────────────────────────

  if (step === 'confirm') {
    return (
      <MobileLayout locale={locale} title={isFr ? 'Confirmer' : 'Confirm'} showBack>
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
            <h2 className="text-base font-bold text-gray-900">
              {isFr ? 'Récapitulatif de votre demande' : 'Request summary'}
            </h2>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-500">{isFr ? 'Montant envoyé' : 'Amount sent'}</span>
              <span className="font-bold text-gray-900">{credits} FCFA</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-500">{isFr ? 'Crédits à recevoir' : 'Credits to receive'}</span>
              <span className="font-bold text-[#1B3A5C]">{credits} crédits</span>
            </div>
            <div className="flex justify-between items-center py-2 text-sm">
              <span className="text-gray-500">{isFr ? 'Justificatif' : 'Proof'}</span>
              <div className="flex items-center gap-1.5 text-gray-700">
                {proofIsPdf
                  ? <><FileText size={14} className="text-red-400" /><span className="text-xs font-medium max-w-[120px] truncate">{proof?.name}</span></>
                  : <span className="text-xs font-medium text-emerald-600">✓ {isFr ? 'Image ajoutée' : 'Image added'}</span>
                }
              </div>
            </div>
            {proofPreview && (
              <img src={proofPreview} alt="proof"
                className="w-full rounded-xl max-h-48 object-cover border border-gray-100 mt-1" />
            )}
          </div>
          <button onClick={submit} disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting
              ? <><span className="w-4 h-4 border-2 border-[#1B3A5C]/30 border-t-[#1B3A5C] rounded-full animate-spin" />{isFr ? 'Envoi...' : 'Sending...'}</>
              : (isFr ? 'Envoyer la demande ✓' : 'Submit request ✓')}
          </button>
          <button onClick={() => setStep('form')}
            className="w-full py-3 text-white/60 text-sm">
            ← {isFr ? 'Modifier' : 'Edit'}
          </button>
        </div>
      </MobileLayout>
    )
  }

  // ── Formulaire principal ──────────────────────────────────────────────────

  return (
    <MobileLayout locale={locale} title={isFr ? 'Recharger mes crédits' : 'Top up credits'} showBack>
      {showScanner && (
        <ScannerModal
          isFr={isFr}
          onClose={() => setShowScanner(false)}
          onScan={file => { handleFile(file); setShowScanner(false) }}
        />
      )}

      <div className="space-y-4">

        {/* Solde actuel */}
        {balance !== null && (
          <div className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-2xl px-4 py-3">
            <Zap size={16} className="text-amber-300 flex-shrink-0" />
            <p className="text-sm text-white">
              {isFr ? 'Solde actuel :' : 'Current balance:'}
              <span className="font-bold ml-1">{balance.creditsRemaining} crédits</span>
            </p>
          </div>
        )}

        {/* Mode d'emploi */}
        <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            {isFr ? 'Comment recharger' : 'How to top up'}
          </h2>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="font-bold text-[#1B3A5C] w-5 flex-shrink-0">1.</span>
              {isFr ? 'Envoyez le montant via MTN MoMo ou Orange Money' : 'Send via MTN MoMo or Orange Money'}
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-[#1B3A5C] w-5 flex-shrink-0">2.</span>
              {isFr ? 'Prenez une capture ou téléchargez le reçu (image ou PDF)' : 'Screenshot or download the receipt (image or PDF)'}
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-[#1B3A5C] w-5 flex-shrink-0">3.</span>
              {isFr ? 'Remplissez le formulaire et soumettez votre demande' : 'Fill in the form and submit your request'}
            </li>
          </ol>
          <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
            {isFr ? '1 crédit = 1 FCFA · minimum 500 FCFA' : '1 credit = 1 FCFA · minimum 500 FCFA'}
          </p>
        </div>

        {/* Numéros de paiement */}
        <div className="space-y-2">
          {[
            { op: 'Orange Money', num: ORANGE_NUMBER, bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-400' },
            { op: 'MTN MoMo',     num: MTN_NUMBER,    bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-400' },
          ].map(({ op, num, bg, border, dot }) => (
            <div key={op} className={`${bg} ${border} border rounded-2xl px-4 py-3.5 flex items-center gap-3`}>
              <div className={`w-2.5 h-2.5 rounded-full ${dot} flex-shrink-0`} />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{op}</p>
                <p className="text-xl font-bold text-gray-900 font-mono tracking-wider">{num}</p>
                <p className="text-xs text-gray-500 mt-0.5">{ACCOUNT_NAME}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl p-5 space-y-5 shadow-sm">

          {/* Montant */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
              {isFr ? 'Montant envoyé (FCFA)' : 'Amount sent (FCFA)'}
            </label>
            <input
              type="number" min={MIN_AMOUNT} value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="500"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C] font-mono text-lg"
            />
            {credits >= MIN_AMOUNT && (
              <p className="text-xs text-emerald-600 font-semibold mt-1.5">
                ✓ {credits} crédits {isFr ? 'seront ajoutés à votre compte' : 'will be added to your account'}
              </p>
            )}
            {amount && credits < MIN_AMOUNT && (
              <p className="text-xs text-red-400 mt-1">
                {isFr ? `Minimum 500 FCFA requis` : 'Minimum 500 FCFA required'}
              </p>
            )}
          </div>

          {/* Upload justificatif */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">
              {isFr ? 'Justificatif de paiement' : 'Payment proof'}
            </label>
            <p className="text-[10px] text-gray-400 mb-2">
              {isFr ? 'Capture d\'écran, photo ou PDF acceptés' : 'Screenshot, photo or PDF accepted'}
            </p>

            {proof ? (
              <div className="relative">
                {proofPreview ? (
                  <img src={proofPreview} alt=""
                    className="w-full rounded-xl max-h-44 object-cover border border-gray-100" />
                ) : (
                  <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <FileText size={24} className="text-red-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{proof.name}</p>
                      <p className="text-xs text-gray-400">{(proof.size / 1024).toFixed(0)} KB · PDF</p>
                    </div>
                  </div>
                )}
                <button onClick={clearProof}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow">
                  <X size={12} className="text-white" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {/* Galerie / fichier */}
                <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-400 text-xs font-medium cursor-pointer hover:border-[#4A8FC4] hover:text-[#4A8FC4] transition-colors">
                  <Upload size={18} />
                  <span>{isFr ? 'Galerie' : 'Gallery'}</span>
                  <input type="file" accept={ACCEPT} className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); (e.target as HTMLInputElement).value = '' }} />
                </label>

                {/* PDF */}
                <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-400 text-xs font-medium cursor-pointer hover:border-red-400 hover:text-red-400 transition-colors">
                  <FileText size={18} />
                  <span>PDF</span>
                  <input type="file" accept="application/pdf,.pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); (e.target as HTMLInputElement).value = '' }} />
                </label>

                {/* Caméra via ScannerModal */}
                <button type="button" onClick={() => setShowScanner(true)}
                  className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-400 text-xs font-medium hover:border-[#4A8FC4] hover:text-[#4A8FC4] transition-colors">
                  <Camera size={18} />
                  <span>{isFr ? 'Caméra' : 'Camera'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setStep('confirm')}
          disabled={credits < MIN_AMOUNT || !proof}
          className="w-full py-3.5 rounded-2xl bg-white text-[#1B3A5C] font-bold disabled:opacity-30 transition-opacity">
          {isFr ? 'Continuer →' : 'Continue →'}
        </button>
      </div>
    </MobileLayout>
  )
}
