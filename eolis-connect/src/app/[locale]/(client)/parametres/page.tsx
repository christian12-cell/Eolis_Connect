'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { LogOut, Save, Lock, User, Phone, CheckCircle, RefreshCw, Home, FileText, Bell, Eye, EyeOff } from 'lucide-react'
import { getUser, apiFetch, clearSession, saveSession, getToken } from '@/lib/api-client'
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/push'
import { PhoneInput } from '@/components/ui/PhoneInput'

const FAV_KEY = 'eolis_fav_page'

function detectDevice(): string {
  const ua = navigator.userAgent
  const isIOS     = /iPhone|iPad|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)
  const isSamsung = /SamsungBrowser/.test(ua)
  const isFirefox = /Firefox/.test(ua)
  const isEdge    = /Edg/.test(ua)
  const isChrome  = /Chrome/.test(ua) && !isEdge && !isSamsung
  const isSafari  = /Safari/.test(ua) && !isChrome && !isSamsung
  if (isIOS)                  return 'ios-safari'
  if (isAndroid && isSamsung) return 'android-samsung'
  if (isAndroid && isFirefox) return 'android-firefox'
  if (isAndroid)              return 'android-chrome'
  if (isEdge)                 return 'pc-edge'
  if (isFirefox)              return 'pc-firefox'
  if (isSafari)               return 'pc-safari'
  return 'pc-chrome'
}

const DEVICE_GUIDE: Record<string, { label: string; icon: string; steps: { fr: string; en: string }[] }> = {
  'android-chrome':  { label: 'Android — Chrome',          icon: '🤖', steps: [
    { fr: 'Ouvre Chrome sur ton Android', en: 'Open Chrome on your Android' },
    { fr: 'Appuie sur les 3 points ⋮ en haut à droite', en: 'Tap the 3 dots ⋮ at the top right' },
    { fr: 'Va dans Paramètres → Paramètres du site', en: 'Go to Settings → Site settings' },
    { fr: 'Appuie sur Notifications', en: 'Tap Notifications' },
    { fr: 'Trouve eolisconnect.online et appuie dessus', en: 'Find eolisconnect.online and tap it' },
    { fr: 'Change le réglage sur Autoriser', en: 'Change the setting to Allow' },
  ]},
  'android-samsung': { label: 'Android — Samsung Internet', icon: '📱', steps: [
    { fr: 'Ouvre Samsung Internet', en: 'Open Samsung Internet' },
    { fr: 'Appuie sur les 3 lignes ☰ en bas à droite', en: 'Tap the 3 lines ☰ at the bottom right' },
    { fr: 'Va dans Paramètres → Confidentialité et sécurité', en: 'Go to Settings → Privacy and security' },
    { fr: 'Appuie sur Autorisations du site → Notifications', en: 'Tap Site permissions → Notifications' },
    { fr: 'Trouve eolisconnect.online et active-le', en: 'Find eolisconnect.online and enable it' },
  ]},
  'android-firefox': { label: 'Android — Firefox',          icon: '🦊', steps: [
    { fr: 'Ouvre Firefox sur ton Android', en: 'Open Firefox on your Android' },
    { fr: 'Appuie sur les 3 points ⋮ → Paramètres', en: 'Tap the 3 dots ⋮ → Settings' },
    { fr: 'Va dans Autorisations du site → Notifications', en: 'Go to Site permissions → Notifications' },
    { fr: 'Trouve eolisconnect.online dans la liste bloquée', en: 'Find eolisconnect.online in the blocked list' },
    { fr: 'Appuie dessus et change sur Autoriser', en: 'Tap it and change to Allow' },
  ]},
  'ios-safari':      { label: 'iPhone / iPad — Safari',     icon: '🍎', steps: [
    { fr: 'Les notifs push sur iPhone nécessitent d\'ajouter l\'app à l\'écran d\'accueil', en: 'Push notifications on iPhone require adding the app to the home screen' },
    { fr: 'Dans Safari, appuie sur le bouton Partager ⬆', en: 'In Safari, tap the Share button ⬆' },
    { fr: 'Sélectionne "Sur l\'écran d\'accueil"', en: 'Select "Add to Home Screen"' },
    { fr: 'Ouvre l\'app depuis l\'écran d\'accueil (pas depuis Safari)', en: 'Open the app from the home screen (not from Safari)' },
    { fr: 'Ensuite : Réglages → Apps → Safari → Notifications → Autoriser eolisconnect.online', en: 'Then: Settings → Apps → Safari → Notifications → Allow eolisconnect.online' },
  ]},
  'pc-chrome':       { label: 'PC / Mac — Chrome',          icon: '💻', steps: [
    { fr: 'Clique sur l\'icône 🔒 à gauche de l\'URL dans la barre d\'adresse', en: 'Click the 🔒 icon to the left of the URL in the address bar' },
    { fr: 'Clique sur "Paramètres du site"', en: 'Click "Site settings"' },
    { fr: 'Trouve la ligne Notifications', en: 'Find the Notifications row' },
    { fr: 'Change de "Bloquer" à "Autoriser"', en: 'Change from "Block" to "Allow"' },
    { fr: 'Recharge la page', en: 'Reload the page' },
  ]},
  'pc-firefox':      { label: 'PC / Mac — Firefox',         icon: '🦊', steps: [
    { fr: 'Clique sur l\'icône 🔒 à gauche de l\'URL', en: 'Click the 🔒 icon to the left of the URL' },
    { fr: 'Clique sur "Connexion sécurisée" → "Plus d\'informations"', en: 'Click "Secure connection" → "More information"' },
    { fr: 'Va dans l\'onglet Permissions', en: 'Go to the Permissions tab' },
    { fr: 'Trouve "Envoyer des notifications" et décoche "Bloquer"', en: 'Find "Send notifications" and uncheck "Block"' },
    { fr: 'Ferme et recharge la page', en: 'Close and reload the page' },
  ]},
  'pc-edge':         { label: 'PC — Microsoft Edge',        icon: '🌐', steps: [
    { fr: 'Clique sur l\'icône 🔒 à gauche de l\'URL', en: 'Click the 🔒 icon to the left of the URL' },
    { fr: 'Clique sur "Autorisations pour ce site"', en: 'Click "Permissions for this site"' },
    { fr: 'Trouve Notifications dans la liste', en: 'Find Notifications in the list' },
    { fr: 'Change de "Bloquer" à "Autoriser"', en: 'Change from "Block" to "Allow"' },
    { fr: 'Recharge la page', en: 'Reload the page' },
  ]},
  'pc-safari':       { label: 'Mac — Safari',               icon: '🧭', steps: [
    { fr: 'Dans le menu en haut, clique sur Safari → Réglages', en: 'In the top menu, click Safari → Settings' },
    { fr: 'Va dans l\'onglet Sites web', en: 'Go to the Websites tab' },
    { fr: 'Clique sur Notifications dans la colonne gauche', en: 'Click Notifications in the left column' },
    { fr: 'Trouve eolisconnect.online dans la liste', en: 'Find eolisconnect.online in the list' },
    { fr: 'Change le menu sur Autoriser', en: 'Change the dropdown to Allow' },
  ]},
}

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
  const [otpCountdown, setOtpCountdown] = useState(0)
  const otpCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [otpError, setOtpError] = useState('')
  const [otpResent, setOtpResent] = useState(false)
  const [phoneMsg, setPhoneMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwOtpSent, setPwOtpSent]       = useState(false)
  const [pwOtpCode, setPwOtpCode]       = useState('')
  const [pwOtpCountdown, setPwOtpCountdown] = useState(0)
  const [pwOtpSkipped, setPwOtpSkipped] = useState(false)
  const pwOtpCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Push notifications
  const [pushEnabled, setPushEnabled]       = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [pushPrefs, setPushPrefs]           = useState({ newMessage: true, finalResponse: true, documentRequested: true })
  const [pushSaving, setPushSaving]         = useState(false)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [guideOpen, setGuideOpen]           = useState(false)

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
    if ('Notification' in window && 'PushManager' in window) {
      setPushPermission(Notification.permission)
      setSelectedDevice(detectDevice())
      if (Notification.permission === 'denied') setGuideOpen(true)
      isPushSubscribed().then(setPushEnabled)
      apiFetch('/api/push/preferences').then(r => r.json()).then(d => {
        if (d) setPushPrefs({ newMessage: d.newMessage ?? true, finalResponse: d.finalResponse ?? true, documentRequested: d.documentRequested ?? true })
      }).catch(() => {})
    } else {
      setPushPermission('unsupported')
    }
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

  function startOtpCountdown() {
    if (otpCountdownRef.current) clearInterval(otpCountdownRef.current)
    setOtpCountdown(30)
    otpCountdownRef.current = setInterval(() => {
      setOtpCountdown(c => {
        if (c <= 1) { clearInterval(otpCountdownRef.current!); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function sendOtp() {
    setOtpError('')
    setOtpCode('')
    await apiFetch('/api/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone: phone.trim(), userId: user.id }),
    }).catch(() => {})
    setOtpSent(true)
    startOtpCountdown()
  }

  async function resendOtp() {
    await sendOtp()
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

  function startPwOtpCountdown() {
    if (pwOtpCountdownRef.current) clearInterval(pwOtpCountdownRef.current)
    setPwOtpCountdown(30)
    pwOtpCountdownRef.current = setInterval(() => {
      setPwOtpCountdown(c => { if (c <= 1) { clearInterval(pwOtpCountdownRef.current!); return 0 } return c - 1 })
    }, 1000)
  }

  async function requestPwOtp() {
    setPwMsg(null)
    const r = await apiFetch('/api/users/me/password/request-otp', { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    if (d.skipped) { setPwOtpSkipped(true); setPwOtpSent(true) }
    else { setPwOtpSent(true); startPwOtpCountdown() }
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
    if (!pwOtpSkipped && !pwOtpCode) {
      setPwMsg({ ok: false, text: isFr ? 'Entrez le code de vérification.' : 'Enter the verification code.' }); return
    }
    setPwSaving(true)
    try {
      const r = await apiFetch('/api/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw, otpCode: pwOtpSkipped ? undefined : pwOtpCode }),
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

  async function togglePush() {
    if (pushEnabled) {
      await unsubscribeFromPush(); setPushEnabled(false)
    } else {
      const ok = await subscribeToPush(); setPushEnabled(ok)
      setPushPermission(Notification.permission)
    }
  }

  async function savePushPrefs() {
    setPushSaving(true)
    await apiFetch('/api/push/preferences', { method: 'PATCH', body: JSON.stringify(pushPrefs) }).catch(() => {})
    setPushSaving(false)
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
                <button onClick={resendOtp} disabled={otpCountdown > 0}
                  className="flex items-center gap-1 text-xs text-[#4A8FC4] font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                  <RefreshCw size={10} />
                  {otpCountdown > 0
                    ? (isFr ? `Renvoyer le code (${otpCountdown}s)` : `Resend code (${otpCountdown}s)`)
                    : (isFr ? 'Renvoyer le code' : 'Resend code')}
                </button>
                {otpCountdown === 0 && (
                  <p className="text-[10px] text-gray-400">
                    {isFr ? 'Code non reçu ? ' : 'Code not received? '}
                    <a href="mailto:support@eolisconnect.online" className="text-[#4A8FC4] underline">
                      support@eolisconnect.online
                    </a>
                  </p>
                )}
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
            { val: currentPw, set: setCurrentPw, key: 'current' as const, label: isFr ? 'Mot de passe actuel' : 'Current password' },
            { val: newPw,     set: setNewPw,     key: 'new'     as const, label: isFr ? 'Nouveau mot de passe' : 'New password' },
            { val: confirmPw, set: setConfirmPw, key: 'confirm' as const, label: isFr ? 'Confirmer' : 'Confirm' },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs text-gray-500 font-medium mb-1 block">{f.label}</label>
              <div className="relative">
                <input value={f.val} onChange={e => f.set(e.target.value)}
                  type={showPw[f.key] ? 'text' : 'password'}
                  className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-10 outline-none focus:border-[#1B3A5C]" />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPw(p => ({ ...p, [f.key]: !p[f.key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw[f.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
        {pwMsg && (
          <p className={`text-xs mt-3 font-medium ${pwMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {pwMsg.text}
          </p>
        )}
        {!pwOtpSent ? (
          <button onClick={requestPwOtp}
            className="w-full mt-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
            <Phone size={14} /> {isFr ? 'Envoyer un code de vérification' : 'Send verification code'}
          </button>
        ) : !pwOtpSkipped && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-500">{isFr ? 'Code envoyé par SMS — saisissez-le ci-dessous' : 'Code sent by SMS — enter it below'}</p>
            <div className="flex gap-2">
              <input type="text" inputMode="numeric" maxLength={6} value={pwOtpCode}
                onChange={e => setPwOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="_ _ _ _ _ _"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-center font-mono text-sm tracking-widest focus:outline-none focus:border-[#1B3A5C]" />
            </div>
            <button onClick={requestPwOtp} disabled={pwOtpCountdown > 0}
              className="flex items-center gap-1 text-xs text-[#4A8FC4] disabled:opacity-40 disabled:cursor-not-allowed">
              <RefreshCw size={10} />
              {pwOtpCountdown > 0 ? (isFr ? `Renvoyer (${pwOtpCountdown}s)` : `Resend (${pwOtpCountdown}s)`) : (isFr ? 'Renvoyer le code' : 'Resend code')}
            </button>
          </div>
        )}
        <button onClick={changePassword} disabled={pwSaving || (!pwOtpSkipped && pwOtpSent && pwOtpCode.length < 6) || !pwOtpSent}
          className="w-full mt-4 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          <Lock size={14} />
          {pwSaving ? '...' : (isFr ? 'Confirmer le changement' : 'Confirm change')}
        </button>
      </div>

      {/* — Notifications push — */}
      {pushPermission !== 'unsupported' && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-amber-500" />
              <p className="text-sm font-semibold text-gray-900">{isFr ? 'Notifications' : 'Notifications'}</p>
            </div>
            {pushPermission !== 'denied' && (
              <button onClick={togglePush}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pushEnabled ? 'bg-[#1B3A5C]' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${pushEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            )}
          </div>

          {/* Accordion — toujours visible, auto-ouvert si bloqué */}
          <div className="border-t border-gray-100 pt-3">
            <button onClick={() => setGuideOpen(o => !o)}
              className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors">
              <span>{isFr ? '❓ Problème avec les notifications ?' : '❓ Problem with notifications?'}</span>
              <span className={`transition-transform ${guideOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {guideOpen && (
              <div className="mt-3 space-y-3">
                {pushPermission === 'denied' && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                    <span className="text-base flex-shrink-0">🔕</span>
                    <div>
                      <p className="text-sm font-semibold text-red-700">{isFr ? 'Notifications bloquées' : 'Notifications blocked'}</p>
                      <p className="text-xs text-red-500 mt-0.5">{isFr ? 'Vous avez refusé les notifications. Suivez le guide ci-dessous pour les réactiver.' : 'You denied notifications. Follow the guide below to re-enable them.'}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs font-semibold text-gray-600">{isFr ? 'Sélectionne ton appareil :' : 'Select your device:'}</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(DEVICE_GUIDE).map(([id, d]) => (
                    <button key={id} onClick={() => setSelectedDevice(id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all ${selectedDevice === id ? 'border-[#1B3A5C] bg-[#1B3A5C]/5 text-[#1B3A5C]' : 'border-gray-200 text-gray-600'}`}>
                      <span className="text-base">{d.icon}</span>
                      <span className="leading-tight">{d.label}</span>
                    </button>
                  ))}
                </div>
                {selectedDevice && DEVICE_GUIDE[selectedDevice] && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-amber-800 mb-3">{DEVICE_GUIDE[selectedDevice].label}</p>
                    <ol className="space-y-2">
                      {DEVICE_GUIDE[selectedDevice].steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                          <span className="text-xs text-amber-900 leading-relaxed">{isFr ? step.fr : step.en}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pas encore demandé */}
          {pushPermission === 'default' && !pushEnabled && (
            <p className="text-xs text-gray-400">{isFr ? 'Activez le toggle — le navigateur demandera la permission.' : 'Enable the toggle — the browser will ask for permission.'}</p>
          )}

          {/* Activé — préférences */}
          {pushEnabled && (
            <div className="space-y-2 mt-1">
              {([
                { key: 'newMessage',        label: isFr ? 'Nouveau message de l\'agent' : 'New message from agent' },
                { key: 'finalResponse',     label: isFr ? 'Réponse finale (dossier clôturé)' : 'Final response (case closed)' },
                { key: 'documentRequested', label: isFr ? 'Document demandé' : 'Document requested' },
              ] as { key: keyof typeof pushPrefs; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{label}</span>
                  <button onClick={() => setPushPrefs(p => ({ ...p, [key]: !p[key] }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pushPrefs[key] ? 'bg-[#4A8FC4]' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${pushPrefs[key] ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
              <button onClick={savePushPrefs} disabled={pushSaving}
                className="w-full mt-2 py-2 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold disabled:opacity-50">
                {pushSaving ? '...' : (isFr ? 'Enregistrer' : 'Save')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* — Logout — */}
      <button onClick={logout}
        className="w-full py-3 rounded-2xl border border-red-100 bg-red-50 text-red-600 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform mb-6">
        <LogOut size={15} />
        {isFr ? 'Se déconnecter' : 'Log out'}
      </button>
    </MobileLayout>
  )
}
