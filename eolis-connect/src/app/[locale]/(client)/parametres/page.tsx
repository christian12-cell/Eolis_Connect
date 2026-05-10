'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { LogOut, Save, Lock, User, Phone, CheckCircle, RefreshCw, Home, FileText, Bell } from 'lucide-react'
import { getUser, apiFetch, clearSession, saveSession, getToken } from '@/lib/api-client'
import { PhoneInput } from '@/components/ui/PhoneInput'

const FAV_KEY = 'eolis_fav_page'

export default function ParametresPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Profile
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [lang, setLang] = useState('fr')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Phone (separate section with OTP)
  const [phone, setPhone] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [savedPhone, setSavedPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpResent, setOtpResent] = useState(false)
  const [phoneMsg, setPhoneMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Favourite page
  const [favPage, setFavPage] = useState('accueil')

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'CLIENT') { router.replace(`/${locale}/login`); return }
    setUser(u)
    setFirstName(u.firstName ?? '')
    setLastName(u.lastName ?? '')
    setEmail(u.email ?? '')
    setPhone(u.phone ?? '')
    setSavedPhone(u.phone ?? '')
    setPhoneVerified(u.phoneVerified ?? false)
    setLang(u.language ?? 'fr')
    setFavPage(localStorage.getItem(FAV_KEY) ?? 'accueil')
    setLoading(false)
  }, [locale])

  const isFr = locale === 'fr'
  const phoneChanged = phone.trim() !== savedPhone

  async function saveProfile() {
    if (profileSaving) return
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      const r = await apiFetch('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ email, language: lang }),
      })
      if (r.ok) {
        const updated = await r.json()
        saveSession(getToken()!, { ...getUser(), ...updated })
        setUser((p: any) => ({ ...p, ...updated }))
        setProfileMsg({ ok: true, text: isFr ? 'Profil mis à jour !' : 'Profile updated!' })
        // Switch locale URL if language changed
        if (lang !== locale) {
          router.push(window.location.pathname.replace(`/${locale}/`, `/${lang}/`))
        }
      } else {
        setProfileMsg({ ok: false, text: isFr ? 'Erreur, réessayez.' : 'Error, try again.' })
      }
    } catch {
      setProfileMsg({ ok: false, text: isFr ? 'Erreur de connexion.' : 'Connection error.' })
    } finally {
      setProfileSaving(false)
    }
  }

  async function sendOtp() {
    setOtpError('')
    setOtpCode('')
    await apiFetch('/api/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone: phone.trim(), userId: user.id }),
    }).catch(() => {})
    setOtpSent(true)
  }

  async function resendOtp() {
    await sendOtp()
    setOtpResent(true)
    setTimeout(() => setOtpResent(false), 3000)
  }

  async function verifyAndSavePhone(e: React.FormEvent) {
    e.preventDefault()
    if (otpCode.length < 6) return
    setOtpLoading(true)
    setOtpError('')
    try {
      const r = await apiFetch('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), code: otpCode, userId: user.id }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok && data.verified) {
        // OTP verified — now save the phone
        const r2 = await apiFetch('/api/users/me', {
          method: 'PATCH',
          body: JSON.stringify({ phone: phone.trim() }),
        })
        if (r2.ok) {
          const updated = await r2.json()
          saveSession(getToken()!, { ...getUser(), ...updated })
          setUser((p: any) => ({ ...p, ...updated }))
          setSavedPhone(phone.trim())
          setPhoneVerified(true)
          setOtpSent(false)
          setOtpCode('')
          setPhoneMsg({ ok: true, text: isFr ? 'Téléphone vérifié et enregistré !' : 'Phone verified and saved!' })
        }
      } else if (data.detail?.startsWith('otp_wrong:')) {
        const rem = data.detail.split(':')[1]
        setOtpError(isFr ? `Code incorrect. ${rem} tentative(s) restante(s).` : `Wrong code. ${rem} attempt(s) left.`)
      } else if (data.detail === 'otp_max_attempts') {
        setOtpError(isFr ? 'Trop de tentatives. Renvoyez un code.' : 'Too many attempts. Resend code.')
        setOtpSent(false)
      } else {
        setOtpError(isFr ? 'Code expiré ou invalide.' : 'Expired or invalid code.')
      }
    } catch {
      setOtpError(isFr ? 'Erreur de connexion.' : 'Connection error.')
    } finally {
      setOtpLoading(false)
    }
  }

  async function changePassword() {
    if (pwSaving) return
    setPwMsg(null)
    if (!currentPw || !newPw) {
      setPwMsg({ ok: false, text: isFr ? 'Remplissez tous les champs.' : 'Fill all fields.' }); return
    }
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: isFr ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.' }); return
    }
    if (newPw.length < 6) {
      setPwMsg({ ok: false, text: isFr ? 'Minimum 6 caractères.' : 'Minimum 6 characters.' }); return
    }
    setPwSaving(true)
    try {
      const r = await apiFetch('/api/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      if (r.ok) {
        setPwMsg({ ok: true, text: isFr ? 'Mot de passe modifié !' : 'Password changed!' })
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
      } else {
        const err = await r.json().catch(() => ({}))
        const text = err.detail === 'wrong_current_password'
          ? (isFr ? 'Mot de passe actuel incorrect.' : 'Current password is incorrect.')
          : (isFr ? 'Erreur, réessayez.' : 'Error, try again.')
        setPwMsg({ ok: false, text })
      }
    } catch {
      setPwMsg({ ok: false, text: isFr ? 'Erreur de connexion.' : 'Connection error.' })
    } finally {
      setPwSaving(false)
    }
  }

  function saveFavPage(page: string) {
    setFavPage(page)
    localStorage.setItem(FAV_KEY, page)
  }

  function logout() {
    clearSession()
    router.replace(`/${locale}/login`)
  }

  if (loading || !user) return null

  const favOptions = [
    { key: 'accueil', label: isFr ? 'Accueil' : 'Home', icon: Home },
    { key: 'mes-demandes', label: isFr ? 'Mes demandes' : 'Requests', icon: FileText },
    { key: 'notifications', label: isFr ? 'Notifications' : 'Notifications', icon: Bell },
  ]

  return (
    <MobileLayout locale={locale} title={isFr ? 'Profil' : 'Profile'} unreadCount={0}>

      {/* Avatar */}
      <div className="flex flex-col items-center py-5 mb-4">
        <div className="w-16 h-16 rounded-2xl bg-[#1B3A5C] flex items-center justify-center mb-3">
          <span className="text-2xl font-bold text-white">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </span>
        </div>
        <p className="text-base font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
        <p className="text-xs text-gray-400 mt-0.5 font-mono">{user.username}</p>
      </div>

      {/* — Profile info — */}
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 mb-3">
        <div className="flex items-center gap-2 mb-4">
          <User size={15} className="text-[#1B3A5C]" />
          <p className="text-sm font-semibold text-gray-900">{isFr ? 'Informations' : 'Information'}</p>
        </div>
        <div className="space-y-3">
          {/* Username — read-only */}
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">{isFr ? 'Identifiant (non modifiable)' : 'Username (read-only)'}</label>
            <input value={user.username ?? ''} readOnly
              className="w-full text-sm bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 outline-none text-gray-400 cursor-not-allowed font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">{isFr ? 'Prénom' : 'First name'}</label>
              <input value={firstName} readOnly
                className="w-full text-sm bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 outline-none text-gray-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">{isFr ? 'Nom' : 'Last name'}</label>
              <input value={lastName} readOnly
                className="w-full text-sm bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 outline-none text-gray-500 cursor-not-allowed" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-1">{isFr ? 'Identifiant, prénom et nom non modifiables.' : 'Username, first and last name cannot be changed.'}</p>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#1B3A5C]" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">{isFr ? 'Langue' : 'Language'}</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ code: 'fr', label: 'Français' }, { code: 'en', label: 'English' }].map(l => (
                <button key={l.code} onClick={() => setLang(l.code)}
                  className={`py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                    lang === l.code ? 'border-[#1B3A5C] bg-[#1B3A5C]/5 text-[#1B3A5C]' : 'border-gray-200 text-gray-600'
                  }`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {profileMsg && (
          <p className={`text-xs mt-3 font-medium ${profileMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {profileMsg.text}
          </p>
        )}
        <button onClick={saveProfile} disabled={profileSaving}
          className="w-full mt-4 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          <Save size={14} />
          {profileSaving ? '...' : (isFr ? 'Enregistrer' : 'Save')}
        </button>
      </div>

      {/* — Phone with OTP verification — */}
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 mb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone size={15} className="text-[#1B3A5C]" />
            <p className="text-sm font-semibold text-gray-900">{isFr ? 'Téléphone' : 'Phone'}</p>
          </div>
          {savedPhone && !phoneChanged && (
            phoneVerified
              ? <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle size={12} /> {isFr ? 'Vérifié' : 'Verified'}</span>
              : <span className="text-[11px] font-semibold text-amber-500">{isFr ? 'Non vérifié' : 'Unverified'}</span>
          )}
        </div>

        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">{isFr ? 'Numéro' : 'Number'}</label>
          <PhoneInput value={phone} onChange={v => { setPhone(v); setOtpSent(false); setOtpError(''); setPhoneMsg(null) }} required />
        </div>

        {/* OTP flow: show if phone differs from saved, or if saved phone is unverified */}
        {phone.trim() && (phoneChanged || (!phoneVerified && savedPhone)) && (
          <div className="mt-3 p-3 rounded-xl bg-[#EEF6FF] border border-[#4A8FC4]/20 space-y-2">
            {!otpSent ? (
              <button onClick={sendOtp}
                className="flex items-center gap-1.5 text-xs text-[#1B3A5C] font-semibold">
                <Phone size={12} />
                {isFr ? 'Envoyer un code SMS de vérification' : 'Send SMS verification code'}
              </button>
            ) : (
              <>
                <p className="text-xs text-gray-600">{isFr ? 'Entrez le code reçu par SMS' : 'Enter the code received by SMS'}</p>
                <form onSubmit={verifyAndSavePhone} className="flex gap-2">
                  <input
                    type="text" inputMode="numeric" maxLength={6}
                    value={otpCode}
                    onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError('') }}
                    placeholder="_ _ _ _ _ _"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-center font-mono text-sm tracking-widest bg-white outline-none focus:border-[#1B3A5C]"
                  />
                  <button type="submit" disabled={otpCode.length < 6 || otpLoading}
                    className="px-4 py-2 rounded-xl bg-[#1B3A5C] text-white text-xs font-semibold disabled:opacity-50">
                    {otpLoading ? '...' : (isFr ? 'Vérifier' : 'Verify')}
                  </button>
                </form>
                {otpError && <p className="text-xs text-red-500">{otpError}</p>}
                <button onClick={resendOtp}
                  className="flex items-center gap-1 text-xs text-[#4A8FC4] font-medium">
                  <RefreshCw size={10} />
                  {otpResent ? (isFr ? 'Code renvoyé !' : 'Code resent!') : (isFr ? 'Renvoyer le code' : 'Resend code')}
                </button>
              </>
            )}
          </div>
        )}

        {phoneMsg && (
          <p className={`text-xs mt-3 font-medium ${phoneMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {phoneMsg.text}
          </p>
        )}
      </div>

      {/* — Favourite page — */}
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 mb-3">
        <div className="flex items-center gap-2 mb-4">
          <Home size={15} className="text-[#1B3A5C]" />
          <p className="text-sm font-semibold text-gray-900">{isFr ? 'Page de démarrage' : 'Start page'}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {favOptions.map(opt => {
            const Icon = opt.icon
            return (
              <button key={opt.key} onClick={() => saveFavPage(opt.key)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                  favPage === opt.key
                    ? 'border-[#1B3A5C] bg-[#1B3A5C]/5 text-[#1B3A5C]'
                    : 'border-gray-200 text-gray-500'
                }`}>
                <Icon size={18} />
                {opt.label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          {isFr ? 'Cette page s\'ouvrira à chaque connexion.' : 'This page will open on each login.'}
        </p>
      </div>

      {/* — Password — */}
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 mb-3">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={15} className="text-[#1B3A5C]" />
          <p className="text-sm font-semibold text-gray-900">{isFr ? 'Mot de passe' : 'Password'}</p>
        </div>
        <div className="space-y-3">
          {[
            { val: currentPw, set: setCurrentPw, label: isFr ? 'Mot de passe actuel' : 'Current password' },
            { val: newPw, set: setNewPw, label: isFr ? 'Nouveau mot de passe' : 'New password' },
            { val: confirmPw, set: setConfirmPw, label: isFr ? 'Confirmer' : 'Confirm' },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs text-gray-500 font-medium mb-1 block">{f.label}</label>
              <input value={f.val} onChange={e => f.set(e.target.value)} type="password"
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#1B3A5C]" />
            </div>
          ))}
        </div>
        {pwMsg && (
          <p className={`text-xs mt-3 font-medium ${pwMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {pwMsg.text}
          </p>
        )}
        <button onClick={changePassword} disabled={pwSaving}
          className="w-full mt-4 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          <Lock size={14} />
          {pwSaving ? '...' : (isFr ? 'Changer le mot de passe' : 'Change password')}
        </button>
      </div>

      {/* — Logout — */}
      <button onClick={logout}
        className="w-full py-3 rounded-2xl border border-red-100 bg-red-50 text-red-600 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform mb-6">
        <LogOut size={15} />
        {isFr ? 'Se déconnecter' : 'Log out'}
      </button>
    </MobileLayout>
  )
}
