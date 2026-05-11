'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Save, Lock, User, CheckCircle, AlertCircle, Phone, RefreshCw, Globe, Eye, EyeOff } from 'lucide-react'
import { getUser, apiFetch, saveSession, getToken, apiUrl } from '@/lib/api-client'
import { PhoneInput } from '@/components/ui/PhoneInput'

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return (
    <div className={`flex items-center gap-2 text-sm p-3 rounded-xl border ${msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
      {msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      {msg.text}
    </div>
  )
}

export default function AgentParametresPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)

  const [username, setUsername]     = useState('')
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [email, setEmail]           = useState('')
  const [lang, setLang]             = useState('fr')
  const [phone, setPhone]           = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [otpSent, setOtpSent]       = useState(false)
  const [otpCode, setOtpCode]       = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError]     = useState('')
  const [otpResent, setOtpResent]   = useState(false)

  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [showPw, setShowPw]         = useState({ current: false, new: false, confirm: false })
  const [pwSaving, setPwSaving]     = useState(false)
  const [pwMsg, setPwMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/login`); return }
    setUser(u)
    setUsername(u.username ?? '')
    setFirstName(u.firstName ?? '')
    setLastName(u.lastName ?? '')
    setEmail(u.email ?? '')
    setLang(u.language ?? 'fr')
    setPhone(u.phone ?? '')
    setPhoneVerified(u.phoneVerified ?? false)
  }, [locale])

  const isFr = locale === 'fr'

  const t = {
    title:         isFr ? 'Paramètres' : 'Settings',
    profile:       isFr ? 'Informations du profil' : 'Profile information',
    usernameLabel: isFr ? 'Identifiant (non modifiable)' : 'Username (read-only)',
    firstName:     isFr ? 'Prénom' : 'First name',
    lastName:      isFr ? 'Nom' : 'Last name',
    email:         isFr ? 'Adresse email' : 'Email address',
    language:      isFr ? 'Langue de l\'interface' : 'Interface language',
    save:          isFr ? 'Enregistrer' : 'Save',
    phone:         isFr ? 'Numéro de téléphone' : 'Phone number',
    phoneVerified: isFr ? 'Vérifié' : 'Verified',
    phoneNotVerified: isFr ? 'Non vérifié' : 'Not verified',
    sendCode:      isFr ? 'Envoyer un code SMS' : 'Send SMS code',
    enterCode:     isFr ? 'Code reçu par SMS' : 'Code received by SMS',
    verify:        isFr ? 'Vérifier' : 'Verify',
    resend:        isFr ? 'Renvoyer' : 'Resend',
    codeSent:      isFr ? 'Code renvoyé !' : 'Code resent!',
    verifiedOk:    isFr ? 'Numéro vérifié !' : 'Number verified!',
    otpExpired:    isFr ? 'Code expiré ou invalide.' : 'Code expired or invalid.',
    password:      isFr ? 'Changer le mot de passe' : 'Change password',
    currentPw:     isFr ? 'Mot de passe actuel' : 'Current password',
    newPw:         isFr ? 'Nouveau mot de passe' : 'New password',
    confirmPw:     isFr ? 'Confirmer' : 'Confirm',
    mismatch:      isFr ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.',
    profileOk:     isFr ? 'Profil mis à jour.' : 'Profile updated.',
    profileErr:    isFr ? 'Erreur lors de la mise à jour.' : 'Update failed.',
    pwOk:          isFr ? 'Mot de passe changé.' : 'Password changed.',
    pwErr:         isFr ? 'Mot de passe actuel incorrect.' : 'Current password is incorrect.',
    pwWeak:        isFr ? 'Minimum 8 caractères.' : 'Minimum 8 characters.',
  }

  async function sendOtp() {
    await fetch(apiUrl('/api/auth/otp/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ phone, userId: user?.id }),
    }).catch(() => {})
    setOtpSent(true)
    setOtpError('')
    setOtpCode('')
  }

  async function resendOtp() {
    await sendOtp()
    setOtpResent(true)
    setTimeout(() => setOtpResent(false), 3000)
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setOtpLoading(true)
    setOtpError('')
    const res = await fetch(apiUrl('/api/auth/otp/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ phone, code: otpCode, userId: user?.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.verified) {
      setPhoneVerified(true)
      setOtpSent(false)
      setOtpCode('')
      setProfileMsg({ ok: true, text: t.verifiedOk })
      const tok = getToken()
      if (tok && user) saveSession(tok, { ...user, phone, phoneVerified: true })
    } else if (data.detail?.startsWith('otp_wrong:')) {
      const remaining = data.detail.split(':')[1]
      setOtpError(isFr ? `Code incorrect. ${remaining} tentative(s) restante(s).` : `Wrong code. ${remaining} attempt(s) left.`)
    } else if (data.detail === 'otp_max_attempts') {
      setOtpError(isFr ? 'Trop de tentatives. Renvoyez un nouveau code.' : 'Too many attempts. Resend a new code.')
      setOtpSent(false)
    } else {
      setOtpError(t.otpExpired)
    }
    setOtpLoading(false)
  }

  async function saveProfile() {
    setProfileSaving(true)
    setProfileMsg(null)
    const res = await apiFetch('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ email, language: lang, phone }),
    })
    if (res.ok) {
      const data = await res.json()
      const tok = getToken()
      if (tok && user) {
        const updated = { ...user, ...data }
        saveSession(tok, updated)
        setUser(updated)
        if (data.phone !== user.phone) { setPhoneVerified(false); setOtpSent(false) }
        else setPhoneVerified(data.phoneVerified ?? false)
      }
      setProfileMsg({ ok: true, text: t.profileOk })
    } else {
      setProfileMsg({ ok: false, text: t.profileErr })
    }
    setProfileSaving(false)
  }

  async function changePassword() {
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: t.mismatch }); return }
    if (newPw.length < 8)    { setPwMsg({ ok: false, text: t.pwWeak });   return }
    setPwSaving(true)
    setPwMsg(null)
    const res = await apiFetch('/api/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
    })
    if (res.ok) {
      setPwMsg({ ok: true, text: t.pwOk })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } else {
      setPwMsg({ ok: false, text: t.pwErr })
    }
    setPwSaving(false)
  }

  if (!user) return null

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>

        {/* Profile */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User size={16} className="text-gray-400" />
            <h2 className="font-semibold text-gray-900">{t.profile}</h2>
          </div>

          {/* Username — read-only */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">{t.usernameLabel}</label>
            <input readOnly value={username}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-400 cursor-not-allowed font-mono" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: t.firstName, value: firstName },
              { label: t.lastName,  value: lastName  },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
                <input readOnly value={f.value}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-400 cursor-not-allowed" />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 -mt-1">
            {isFr ? 'Prénom et nom non modifiables — contactez un administrateur.' : 'First and last name cannot be changed — contact an administrator.'}
          </p>

          {/* Email — éditable */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">{t.email}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent" />
          </div>

          {/* Phone + OTP */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 font-medium">{t.phone}</label>
              {phone && (
                phoneVerified
                  ? <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold"><CheckCircle size={10} /> {t.phoneVerified}</span>
                  : <span className="text-[10px] text-amber-600 font-semibold">{t.phoneNotVerified}</span>
              )}
            </div>
            <PhoneInput value={phone}
              onChange={v => { setPhone(v); setPhoneVerified(false); setOtpSent(false) }}
              required />

            {phone && !phoneVerified && (
              <div className="mt-2 p-3 rounded-xl border border-[#4A8FC4]/30 bg-[#4A8FC4]/5 space-y-2">
                {!otpSent ? (
                  <button type="button" onClick={sendOtp}
                    className="flex items-center gap-1.5 text-xs text-[#4A8FC4] font-semibold hover:underline">
                    <Phone size={12} /> {t.sendCode}
                  </button>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">{t.enterCode}</p>
                    <form onSubmit={verifyOtp} className="flex gap-2">
                      <input type="text" inputMode="numeric" maxLength={6}
                        value={otpCode}
                        onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError('') }}
                        placeholder="_ _ _ _ _ _"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-center font-mono text-base tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#4A8FC4]" />
                      <button type="submit" disabled={otpCode.length < 6 || otpLoading}
                        className="px-3 py-2 rounded-lg bg-[#1B3A5C] text-white text-xs font-semibold disabled:opacity-50">
                        {otpLoading ? '...' : t.verify}
                      </button>
                    </form>
                    {otpError && <p className="text-xs text-red-500">{otpError}</p>}
                    <button type="button" onClick={resendOtp}
                      className="flex items-center gap-1 text-xs text-[#4A8FC4] hover:underline">
                      <RefreshCw size={10} /> {otpResent ? t.codeSent : t.resend}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Language */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-2">{t.language}</label>
            <div className="flex gap-2">
              {[{ val: 'fr', label: '🇫🇷 Français' }, { val: 'en', label: '🇬🇧 English' }].map(o => (
                <button key={o.val} onClick={() => setLang(o.val)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${lang === o.val ? 'border-[#1B3A5C] bg-[#1B3A5C] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <Msg msg={profileMsg} />
          <button onClick={saveProfile} disabled={profileSaving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#152d47] disabled:opacity-60 transition-colors">
            <Save size={15} /> {t.save}
          </button>
        </div>

        {/* Password */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock size={16} className="text-gray-400" />
            <h2 className="font-semibold text-gray-900">{t.password}</h2>
          </div>
          {[
            { label: t.currentPw, value: currentPw, set: setCurrentPw, key: 'current' as const },
            { label: t.newPw,     value: newPw,     set: setNewPw,     key: 'new'     as const },
            { label: t.confirmPw, value: confirmPw, set: setConfirmPw, key: 'confirm' as const },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
              <div className="relative">
                <input
                  type={showPw[f.key] ? 'text' : 'password'}
                  value={f.value} onChange={e => f.set(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPw(p => ({ ...p, [f.key]: !p[f.key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw[f.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}
          <Msg msg={pwMsg} />
          <button onClick={changePassword} disabled={pwSaving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#152d47] disabled:opacity-60 transition-colors">
            <Save size={15} /> {t.save}
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
