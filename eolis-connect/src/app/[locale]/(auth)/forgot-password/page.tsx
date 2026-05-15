'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Mail, Phone, ArrowLeft, CheckCircle, AlertCircle, RefreshCw, ShieldCheck, UserCheck, HeadphonesIcon } from 'lucide-react'
import { apiUrl } from '@/lib/api-client'
import { PhoneInput } from '@/components/ui/PhoneInput'

type Step = 'mode' | 'input' | 'confirm' | 'otp' | 'username' | 'done' | 'not-found' | 'support'
type Mode = 'email' | 'phone'

export default function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState('fr')
  const [step, setStep]     = useState<Step>('mode')
  const [mode, setMode]     = useState<Mode>('email')

  const [inputValue, setInputValue] = useState('')
  const [phoneValid, setPhoneValid] = useState(false)

  const [masked, setMasked]               = useState('')
  const [lookupToken, setLookupToken]     = useState('')
  const [otpCode, setOtpCode]             = useState('')
  const [maskedUsername, setMaskedUsername] = useState('')
  const [verifiedToken, setVerifiedToken] = useState('')

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [otpSent, setOtpSent]   = useState(false)
  const [resent, setResent]     = useState(false)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  const isFr = locale !== 'en'

  // ── translations ─────────────────────────────────────────────────────────────
  const T = {
    title:         isFr ? 'Mot de passe oublié'           : 'Forgot password',
    chooseMode:    isFr ? 'Comment souhaitez-vous être identifié(e) ?' : 'How would you like to be identified?',
    byEmail:       isFr ? 'Par email'                     : 'By email',
    byPhone:       isFr ? 'Par téléphone'                 : 'By phone',
    enterEmail:    isFr ? 'Entrez votre adresse email'    : 'Enter your email address',
    enterPhone:    isFr ? 'Entrez votre numéro de téléphone' : 'Enter your phone number',
    emailLabel:    isFr ? 'Adresse email'                 : 'Email address',
    phoneLabel:    isFr ? 'Numéro de téléphone'           : 'Phone number',
    search:        isFr ? 'Rechercher mon compte'         : 'Find my account',
    foundTitle:    isFr ? 'Compte trouvé'                 : 'Account found',
    foundEmail:    isFr ? 'Nous avons trouvé un compte associé à cet email :' : 'We found an account linked to this email:',
    foundPhone:    isFr ? 'Nous avons trouvé un compte associé à ce numéro :' : 'We found an account linked to this number:',
    isYours:       isFr ? 'Est-ce bien le vôtre ?'        : 'Is this yours?',
    yes:           isFr ? 'Oui, c\'est le mien'           : 'Yes, this is mine',
    no:            isFr ? 'Non, ce n\'est pas le mien'    : 'No, this is not mine',
    otpSentEmail:  isFr ? 'Un code à 6 chiffres a été envoyé sur cet email.' : 'A 6-digit code was sent to this email.',
    otpSentPhone:  isFr ? 'Un code à 6 chiffres a été envoyé sur ce numéro.' : 'A 6-digit code was sent to this number.',
    enterCode:     isFr ? 'Entrez le code'                : 'Enter the code',
    verify:        isFr ? 'Vérifier'                      : 'Verify',
    resend:        isFr ? 'Renvoyer le code'              : 'Resend code',
    resent:        isFr ? 'Code renvoyé !'                : 'Code resent!',
    usernameTitle: isFr ? 'Confirmation du compte'        : 'Account confirmation',
    usernameDesc:  isFr ? 'Le compte associé à cet identifiant est :' : 'The account linked to this identifier is:',
    usernameQ:     isFr ? 'Est-ce bien votre compte ?'   : 'Is this your account?',
    sendLink:      isFr ? 'Oui, envoyer le lien de réinitialisation' : 'Yes, send the reset link',
    doneTitle:     isFr ? 'Lien envoyé !'                : 'Link sent!',
    doneMsg:       isFr ? `Le lien de réinitialisation a été envoyé sur votre ${mode === 'email' ? 'email' : 'téléphone'}.` : `The reset link was sent to your ${mode === 'email' ? 'email' : 'phone'}.`,
    doneWarn:      isFr ? '⚠️ Ce lien est à usage unique et expire dans 48h.' : '⚠️ This link is single-use and expires in 48h.',
    goLogin:       isFr ? 'Retour à la connexion'        : 'Back to login',
    notFoundTitle: isFr ? 'Aucun compte trouvé'          : 'No account found',
    notFoundMsg:   isFr ? `Aucun compte actif n'est associé à ${mode === 'email' ? 'cet email' : 'ce numéro'}.` : `No active account is linked to this ${mode === 'email' ? 'email' : 'number'}.`,
    tryOther:      isFr ? `Essayer avec ${mode === 'email' ? 'mon téléphone' : 'mon email'}` : `Try with my ${mode === 'email' ? 'phone' : 'email'}`,
    supportTitle:  isFr ? 'Contactez le support'        : 'Contact support',
    supportMsg:    isFr ? 'Si vous ne reconnaissez pas ce compte ou avez besoin d\'aide, contactez notre équipe.' : 'If you do not recognize this account or need help, contact our team.',
    supportEmail:  'support@eolisconnect.online',
    backToLogin:   isFr ? 'Retour à la connexion'        : 'Back to login',
    errGeneric:    isFr ? 'Une erreur est survenue. Réessayez.' : 'An error occurred. Please try again.',
    errOtpExpired: isFr ? 'Code expiré. Renvoyez un nouveau code.' : 'Code expired. Please resend.',
    errOtpMax:     isFr ? 'Trop de tentatives. Renvoyez un nouveau code.' : 'Too many attempts. Please resend.',
    errToken:      isFr ? 'Session expirée. Recommencez.' : 'Session expired. Please start over.',
  }

  function resetFlow() {
    setStep('mode'); setInputValue(''); setPhoneValid(false)
    setMasked(''); setLookupToken(''); setOtpCode('')
    setMaskedUsername(''); setVerifiedToken(''); setError('')
  }

  function switchMode() {
    setMode(m => m === 'email' ? 'phone' : 'email')
    setStep('input'); setInputValue(''); setPhoneValid(false); setError('')
  }

  async function handleLookup() {
    setLoading(true); setError('')
    try {
      const res = await fetch(apiUrl('/api/auth/forgot-password/lookup'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, value: inputValue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(T.errGeneric); return }
      if (!data.found) { setStep('not-found'); return }
      setMasked(data.masked)
      setLookupToken(data.lookupToken)
      setStep('confirm')
    } catch { setError(T.errGeneric) }
    finally { setLoading(false) }
  }

  async function handleSendOtp() {
    setLoading(true); setError('')
    try {
      const res = await fetch(apiUrl('/api/auth/forgot-password/send-otp'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookupToken }),
      })
      if (!res.ok) { setError(T.errToken); return }
      setOtpSent(true)
      setStep('otp')
    } catch { setError(T.errGeneric) }
    finally { setLoading(false) }
  }

  async function handleResendOtp() {
    setLoading(true)
    try {
      await fetch(apiUrl('/api/auth/forgot-password/send-otp'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookupToken }),
      })
      setResent(true); setOtpCode(''); setError('')
      setTimeout(() => setResent(false), 3000)
    } catch {}
    finally { setLoading(false) }
  }

  async function handleVerifyOtp() {
    setLoading(true); setError('')
    try {
      const res = await fetch(apiUrl('/api/auth/forgot-password/verify-otp'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookupToken, code: otpCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.detail === 'otp_expired') setError(T.errOtpExpired)
        else if (data.detail === 'otp_max_attempts') setError(T.errOtpMax)
        else if (data.detail?.startsWith('otp_wrong:')) {
          const rem = data.detail.split(':')[1]
          setError(isFr ? `Code incorrect. ${rem} tentative(s) restante(s).` : `Wrong code. ${rem} attempt(s) left.`)
        } else setError(T.errGeneric)
        return
      }
      setMaskedUsername(data.maskedUsername)
      setVerifiedToken(data.verifiedToken)
      setStep('username')
    } catch { setError(T.errGeneric) }
    finally { setLoading(false) }
  }

  async function handleSendReset() {
    setLoading(true); setError('')
    try {
      const res = await fetch(apiUrl('/api/auth/forgot-password/send-reset'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verifiedToken }),
      })
      if (!res.ok) { setError(T.errToken); return }
      setStep('done')
    } catch { setError(T.errGeneric) }
    finally { setLoading(false) }
  }

  // ── Shared layout wrapper ─────────────────────────────────────────────────
  const canSubmitInput = mode === 'email'
    ? inputValue.includes('@') && inputValue.includes('.')
    : phoneValid

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <Image src="/bg-auth.jpg" alt="" fill className="object-cover" priority />
      <div className="absolute inset-0 bg-[#0D1F33]/75" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Image src="/logo.png" alt="Eolis" width={28} height={28} className="object-contain" />
          </div>
          <span className="font-bold text-white text-lg">Eolis Connect</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* ── STEP: mode ─────────────────────────────────────────────── */}
          {step === 'mode' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{T.title}</h2>
              <p className="text-gray-500 text-sm mb-6">{T.chooseMode}</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setMode('email'); setStep('input') }}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 hover:border-[#1B3A5C] hover:bg-[#1B3A5C]/5 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-[#1B3A5C]/10 flex items-center justify-center group-hover:bg-[#1B3A5C]/20 transition-colors">
                    <Mail className="w-6 h-6 text-[#1B3A5C]" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{T.byEmail}</span>
                </button>
                <button onClick={() => { setMode('phone'); setStep('input') }}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 hover:border-[#1B3A5C] hover:bg-[#1B3A5C]/5 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-[#1B3A5C]/10 flex items-center justify-center group-hover:bg-[#1B3A5C]/20 transition-colors">
                    <Phone className="w-6 h-6 text-[#1B3A5C]" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{T.byPhone}</span>
                </button>
              </div>
              <div className="mt-6 text-center">
                <Link href={`/${locale}/login`} className="inline-flex items-center gap-2 text-[#4A8FC4] hover:text-[#1B3A5C] text-sm font-medium">
                  <ArrowLeft size={16} /> {T.backToLogin}
                </Link>
              </div>
            </>
          )}

          {/* ── STEP: input ────────────────────────────────────────────── */}
          {step === 'input' && (
            <>
              <button onClick={() => setStep('mode')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1B3A5C] mb-5 transition-colors">
                <ArrowLeft size={14} /> {isFr ? 'Changer de mode' : 'Change mode'}
              </button>
              <div className="w-12 h-12 rounded-xl bg-[#1B3A5C]/10 flex items-center justify-center mb-4">
                {mode === 'email' ? <Mail className="w-6 h-6 text-[#1B3A5C]" /> : <Phone className="w-6 h-6 text-[#1B3A5C]" />}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{T.title}</h2>
              <p className="text-gray-500 text-sm mb-5">{mode === 'email' ? T.enterEmail : T.enterPhone}</p>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">{mode === 'email' ? T.emailLabel : T.phoneLabel}</label>
                  {mode === 'email' ? (
                    <input type="email" value={inputValue} onChange={e => { setInputValue(e.target.value); setError('') }}
                      placeholder="vous@exemple.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
                  ) : (
                    <PhoneInput value={inputValue || '+237'} onChange={v => { setInputValue(v); setError('') }} onValidChange={setPhoneValid} required />
                  )}
                </div>
                {error && (
                  <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><p className="text-xs">{error}</p>
                  </div>
                )}
                <button onClick={handleLookup} disabled={!canSubmitInput || loading}
                  className="w-full py-3 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                  {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {T.search}
                </button>
              </div>
            </>
          )}

          {/* ── STEP: confirm identity ──────────────────────────────────── */}
          {step === 'confirm' && (
            <>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{T.foundTitle}</h2>
              <p className="text-gray-500 text-sm mb-4">{mode === 'email' ? T.foundEmail : T.foundPhone}</p>
              <div className="bg-[#1B3A5C]/5 border border-[#1B3A5C]/20 rounded-xl p-4 mb-4 text-center">
                <p className="text-xl font-bold text-[#1B3A5C] font-mono tracking-wider">{masked}</p>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-4">{T.isYours}</p>
              {error && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 mb-4"><AlertCircle size={16} className="flex-shrink-0"/><p className="text-xs">{error}</p></div>}
              <div className="flex flex-col gap-2">
                <button onClick={handleSendOtp} disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {T.yes}
                </button>
                <button onClick={() => { setStep('input'); setError('') }}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">
                  {T.no}
                </button>
              </div>
            </>
          )}

          {/* ── STEP: OTP ──────────────────────────────────────────────── */}
          {step === 'otp' && (
            <>
              <div className="w-12 h-12 rounded-xl bg-[#1B3A5C]/10 flex items-center justify-center mb-4">
                {mode === 'email' ? <Mail className="w-6 h-6 text-[#1B3A5C]" /> : <Phone className="w-6 h-6 text-[#1B3A5C]" />}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{T.enterCode}</h2>
              <p className="text-gray-500 text-sm mb-5">{mode === 'email' ? T.otpSentEmail : T.otpSentPhone}</p>
              <div className="space-y-4">
                <input type="text" inputMode="numeric" maxLength={6} value={otpCode}
                  onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setError('') }}
                  placeholder="_ _ _ _ _ _"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center font-mono text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#4A8FC4]" />
                {error && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700"><AlertCircle size={16} className="flex-shrink-0"/><p className="text-xs">{error}</p></div>}
                <button onClick={handleVerifyOtp} disabled={otpCode.length < 6 || loading}
                  className="w-full py-3 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {T.verify}
                </button>
                <button onClick={handleResendOtp} disabled={loading}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-[#4A8FC4] hover:underline">
                  <RefreshCw size={13} />
                  {resent ? T.resent : T.resend}
                </button>
              </div>
            </>
          )}

          {/* ── STEP: confirm username ──────────────────────────────────── */}
          {step === 'username' && (
            <>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                <UserCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{T.usernameTitle}</h2>
              <p className="text-gray-500 text-sm mb-4">{T.usernameDesc}</p>
              <div className="bg-[#1B3A5C]/5 border border-[#1B3A5C]/20 rounded-xl p-4 mb-4 text-center">
                <p className="text-xl font-bold text-[#1B3A5C] font-mono tracking-wider">{maskedUsername}</p>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-4">{T.usernameQ}</p>
              {error && <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 mb-4"><AlertCircle size={16} className="flex-shrink-0"/><p className="text-xs">{error}</p></div>}
              <div className="flex flex-col gap-2">
                <button onClick={handleSendReset} disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {T.sendLink}
                </button>
                <button onClick={() => setStep('support')}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">
                  {T.no}
                </button>
              </div>
            </>
          )}

          {/* ── STEP: done ─────────────────────────────────────────────── */}
          {step === 'done' && (
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">{T.doneTitle}</h2>
              <p className="text-gray-500 text-sm mb-4 leading-relaxed">{T.doneMsg}</p>
              <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium text-left">
                {T.doneWarn}
              </div>
              <Link href={`/${locale}/login`} className="inline-flex items-center gap-2 text-[#4A8FC4] hover:text-[#1B3A5C] text-sm font-medium">
                <ArrowLeft size={16} /> {T.goLogin}
              </Link>
            </div>
          )}

          {/* ── STEP: not-found ────────────────────────────────────────── */}
          {step === 'not-found' && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">{T.notFoundTitle}</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">{T.notFoundMsg}</p>
              <div className="flex flex-col gap-2">
                <button onClick={switchMode}
                  className="w-full py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#152d47] transition-all">
                  {T.tryOther}
                </button>
                <button onClick={resetFlow}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">
                  {isFr ? 'Recommencer' : 'Start over'}
                </button>
                <button onClick={() => setStep('support')} className="mt-1 text-sm text-[#4A8FC4] hover:underline">
                  {isFr ? 'Contacter le support' : 'Contact support'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: support ──────────────────────────────────────────── */}
          {step === 'support' && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-[#1B3A5C]/10 flex items-center justify-center mx-auto mb-4">
                <HeadphonesIcon className="w-7 h-7 text-[#1B3A5C]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">{T.supportTitle}</h2>
              <p className="text-gray-500 text-sm mb-5 leading-relaxed">{T.supportMsg}</p>
              <a href={`mailto:${T.supportEmail}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#152d47] transition-all mb-4">
                <Mail size={15} /> {T.supportEmail}
              </a>
              <div className="mt-4">
                <button onClick={resetFlow} className="text-sm text-[#4A8FC4] hover:underline">
                  {isFr ? 'Recommencer depuis le début' : 'Start over'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Back to login (outside card on non-done/non-support steps) */}
        {!['done', 'support', 'mode'].includes(step) && (
          <div className="mt-4 text-center">
            <Link href={`/${locale}/login`} className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors">
              <ArrowLeft size={14} /> {T.backToLogin}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
