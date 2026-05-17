'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Save, Lock, User, CheckCircle, AlertCircle, Phone, RefreshCw, Globe, Eye, EyeOff, Bell } from 'lucide-react'
import { getUser, apiFetch, saveSession, getToken, apiUrl } from '@/lib/api-client'
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/push'
import { PhoneInput } from '@/components/ui/PhoneInput'

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
  'pc-chrome':       { label: 'PC / Mac — Chrome',          icon: '💻', steps: [
    { fr: 'Clique sur l\'icône 🔒 à gauche de l\'URL dans la barre d\'adresse', en: 'Click the 🔒 icon to the left of the URL in the address bar' },
    { fr: 'Clique sur "Paramètres du site"', en: 'Click "Site settings"' },
    { fr: 'Trouve la ligne Notifications et change de "Bloquer" à "Autoriser"', en: 'Find the Notifications row and change from "Block" to "Allow"' },
    { fr: 'Recharge la page', en: 'Reload the page' },
  ]},
  'pc-firefox':      { label: 'PC / Mac — Firefox',         icon: '🦊', steps: [
    { fr: 'Clique sur l\'icône 🔒 à gauche de l\'URL', en: 'Click the 🔒 icon to the left of the URL' },
    { fr: 'Clique sur "Connexion sécurisée" → "Plus d\'informations"', en: 'Click "Secure connection" → "More information"' },
    { fr: 'Onglet Permissions → Notifications → décoche "Bloquer"', en: 'Permissions tab → Notifications → uncheck "Block"' },
    { fr: 'Ferme et recharge la page', en: 'Close and reload the page' },
  ]},
  'pc-edge':         { label: 'PC — Microsoft Edge',        icon: '🌐', steps: [
    { fr: 'Clique sur l\'icône 🔒 à gauche de l\'URL', en: 'Click the 🔒 icon to the left of the URL' },
    { fr: 'Clique sur "Autorisations pour ce site"', en: 'Click "Permissions for this site"' },
    { fr: 'Notifications → change de "Bloquer" à "Autoriser"', en: 'Notifications → change from "Block" to "Allow"' },
    { fr: 'Recharge la page', en: 'Reload the page' },
  ]},
  'pc-safari':       { label: 'Mac — Safari',               icon: '🧭', steps: [
    { fr: 'Menu Safari → Réglages → onglet Sites web', en: 'Safari menu → Settings → Websites tab' },
    { fr: 'Clique sur Notifications dans la colonne gauche', en: 'Click Notifications in the left column' },
    { fr: 'Trouve eolisconnect.online → change sur Autoriser', en: 'Find eolisconnect.online → change to Allow' },
  ]},
  'android-chrome':  { label: 'Android — Chrome',          icon: '🤖', steps: [
    { fr: '3 points ⋮ → Paramètres → Paramètres du site → Notifications', en: '3 dots ⋮ → Settings → Site settings → Notifications' },
    { fr: 'Trouve eolisconnect.online et change sur Autoriser', en: 'Find eolisconnect.online and change to Allow' },
  ]},
  'android-samsung': { label: 'Android — Samsung Internet', icon: '📱', steps: [
    { fr: '☰ → Paramètres → Confidentialité → Autorisations du site → Notifications', en: '☰ → Settings → Privacy → Site permissions → Notifications' },
    { fr: 'Trouve eolisconnect.online et active-le', en: 'Find eolisconnect.online and enable it' },
  ]},
  'android-firefox': { label: 'Android — Firefox',          icon: '🦊', steps: [
    { fr: '3 points ⋮ → Paramètres → Autorisations du site → Notifications', en: '3 dots ⋮ → Settings → Site permissions → Notifications' },
    { fr: 'Trouve eolisconnect.online et change sur Autoriser', en: 'Find eolisconnect.online and change to Allow' },
  ]},
  'ios-safari':      { label: 'iPhone / iPad — Safari',     icon: '🍎', steps: [
    { fr: 'Sur iPhone, les notifs push nécessitent d\'ajouter l\'app à l\'écran d\'accueil', en: 'On iPhone, push notifications require adding the app to the home screen' },
    { fr: 'Safari → bouton Partager ⬆ → "Sur l\'écran d\'accueil"', en: 'Safari → Share button ⬆ → "Add to Home Screen"' },
    { fr: 'Ensuite : Réglages → Apps → Safari → Notifications → Autoriser eolisconnect.online', en: 'Then: Settings → Apps → Safari → Notifications → Allow eolisconnect.online' },
  ]},
}

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

  const [pushEnabled, setPushEnabled]       = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [pushPrefs, setPushPrefs]           = useState({ newMessage: true, internalNote: true, mention: true, clientMsgUnread: true, finalUnread: true, highOnly: false })
  const [pushSaving, setPushSaving]         = useState(false)
  const [pushMsg, setPushMsg]               = useState<{ ok: boolean; text: string } | null>(null)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [guideOpen, setGuideOpen]           = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      setPushPermission('unsupported'); return
    }
    setPushPermission(Notification.permission)
    setSelectedDevice(detectDevice())
    if (Notification.permission === 'denied') setGuideOpen(true)
    isPushSubscribed().then(setPushEnabled)
    apiFetch('/api/push/preferences').then(r => r.json()).then(d => {
      if (d) setPushPrefs(p => ({ ...p, ...{
        newMessage: d.newMessage ?? true, internalNote: d.internalNote ?? true,
        mention: d.mention ?? true, clientMsgUnread: d.clientMsgUnread ?? true,
        finalUnread: d.finalUnread ?? true, highOnly: d.highOnly ?? false,
      }}))
    }).catch(() => {})
  }, [])

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
    if (!['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN', 'FINANCE_AGENT'].includes(u.role)) { router.replace(`/${locale}/login`); return }
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

  async function togglePush() {
    if (pushEnabled) {
      await unsubscribeFromPush()
      setPushEnabled(false)
    } else {
      const ok = await subscribeToPush()
      setPushEnabled(ok)
    }
  }

  async function savePushPrefs() {
    setPushSaving(true)
    setPushMsg(null)
    const res = await apiFetch('/api/push/preferences', { method: 'PATCH', body: JSON.stringify(pushPrefs) }).catch(() => null)
    setPushMsg(res?.ok ? { ok: true, text: isFr ? 'Préférences sauvegardées.' : 'Preferences saved.' } : { ok: false, text: isFr ? 'Erreur.' : 'Error.' })
    setPushSaving(false)
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

        {/* Notifications */}
        {pushPermission !== 'unsupported' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-amber-500" />
              <h2 className="font-semibold text-gray-900">{isFr ? 'Notifications push' : 'Push notifications'}</h2>
            </div>
            {pushPermission !== 'denied' && (
            <button
              onClick={togglePush}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pushEnabled ? 'bg-[#1B3A5C]' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${pushEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            )}
          </div>
          <p className="text-xs text-gray-400 -mt-2">{isFr ? 'Alertes système sur votre ordinateur/téléphone même app fermée.' : 'System alerts on your computer/phone even when app is closed.'}</p>

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
                      <p className="text-xs text-red-500 mt-0.5">{isFr ? 'Vous avez refusé les notifications. Sélectionnez votre navigateur ci-dessous pour débloquer.' : 'You denied notifications. Select your browser below to unblock.'}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs font-semibold text-gray-600">{isFr ? 'Sélectionnez votre navigateur / appareil :' : 'Select your browser / device:'}</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(DEVICE_GUIDE).map(([id, d]) => (
                    <button key={id} onClick={() => setSelectedDevice(id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all ${selectedDevice === id ? 'border-[#1B3A5C] bg-[#1B3A5C]/5 text-[#1B3A5C]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
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

          {pushEnabled && (
            <div className="space-y-2.5 pt-1">
              {([
                { key: 'newMessage',      label: isFr ? 'Nouveau message client' : 'New client message' },
                { key: 'internalNote',    label: isFr ? 'Note interne' : 'Internal note' },
                { key: 'mention',         label: isFr ? 'Mention @nom' : '@mention' },
                { key: 'clientMsgUnread', label: isFr ? 'Client non répondu depuis 1h' : 'Client unanswered for 1h' },
                { key: 'finalUnread',     label: isFr ? 'Réponse finale non lue 12h' : 'Final response unread 12h' },
                { key: 'highOnly',        label: isFr ? 'Uniquement urgence HIGH' : 'HIGH urgency only' },
              ] as { key: keyof typeof pushPrefs; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{label}</span>
                  <button
                    onClick={() => setPushPrefs(p => ({ ...p, [key]: !p[key] }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pushPrefs[key] ? 'bg-[#4A8FC4]' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${pushPrefs[key] ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
              <Msg msg={pushMsg} />
              <button onClick={savePushPrefs} disabled={pushSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#152d47] disabled:opacity-60 transition-colors">
                <Save size={14} /> {isFr ? 'Enregistrer' : 'Save'}
              </button>
            </div>
          )}
        </div>
        )}

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
