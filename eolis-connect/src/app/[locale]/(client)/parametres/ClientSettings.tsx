'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Lock, Globe, CheckCircle, AlertCircle, Phone, RefreshCw, Eye, EyeOff, Bell } from 'lucide-react'
import { apiFetch, apiUrl, getUser, saveSession, getToken } from '@/lib/api-client'
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/push'

interface Props {
  locale: string
  userId: string
  username: string
  initialFirstName: string
  initialLastName: string
  initialEmail: string
  initialPhone: string
  initialPhoneVerified: boolean
  currentLocale: string
}

function detectDevice(): string {
  const ua = navigator.userAgent
  const isIOS     = /iPhone|iPad|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)
  const isSamsung = /SamsungBrowser/.test(ua)
  const isFirefox = /Firefox/.test(ua)
  const isEdge    = /Edg/.test(ua)
  const isChrome  = /Chrome/.test(ua) && !isEdge && !isSamsung
  const isSafari  = /Safari/.test(ua) && !isChrome && !isSamsung
  if (isIOS)                         return 'ios-safari'
  if (isAndroid && isSamsung)        return 'android-samsung'
  if (isAndroid && isFirefox)        return 'android-firefox'
  if (isAndroid)                     return 'android-chrome'
  if (isEdge)                        return 'pc-edge'
  if (isFirefox)                     return 'pc-firefox'
  if (isSafari)                      return 'pc-safari'
  return 'pc-chrome'
}

const DEVICE_GUIDE: Record<string, { label: string; icon: string; steps: { fr: string; en: string }[] }> = {
  'android-chrome': {
    label: 'Android — Chrome', icon: '🤖',
    steps: [
      { fr: 'Ouvre Chrome sur ton Android', en: 'Open Chrome on your Android' },
      { fr: 'Appuie sur les 3 points ⋮ en haut à droite', en: 'Tap the 3 dots ⋮ at the top right' },
      { fr: 'Va dans Paramètres → Paramètres du site', en: 'Go to Settings → Site settings' },
      { fr: 'Appuie sur Notifications', en: 'Tap Notifications' },
      { fr: 'Trouve eolisconnect.online et appuie dessus', en: 'Find eolisconnect.online and tap it' },
      { fr: 'Change le réglage sur Autoriser', en: 'Change the setting to Allow' },
    ],
  },
  'android-samsung': {
    label: 'Android — Samsung Internet', icon: '📱',
    steps: [
      { fr: 'Ouvre Samsung Internet', en: 'Open Samsung Internet' },
      { fr: 'Appuie sur les 3 lignes ☰ en bas à droite', en: 'Tap the 3 lines ☰ at the bottom right' },
      { fr: 'Va dans Paramètres → Confidentialité et sécurité', en: 'Go to Settings → Privacy and security' },
      { fr: 'Appuie sur Autorisations du site → Notifications', en: 'Tap Site permissions → Notifications' },
      { fr: 'Trouve eolisconnect.online et active-le', en: 'Find eolisconnect.online and enable it' },
    ],
  },
  'android-firefox': {
    label: 'Android — Firefox', icon: '🦊',
    steps: [
      { fr: 'Ouvre Firefox sur ton Android', en: 'Open Firefox on your Android' },
      { fr: 'Appuie sur les 3 points ⋮ → Paramètres', en: 'Tap the 3 dots ⋮ → Settings' },
      { fr: 'Va dans Autorisations du site → Notifications', en: 'Go to Site permissions → Notifications' },
      { fr: 'Trouve eolisconnect.online dans la liste bloquée', en: 'Find eolisconnect.online in the blocked list' },
      { fr: 'Appuie dessus et change sur Autoriser', en: 'Tap it and change to Allow' },
    ],
  },
  'ios-safari': {
    label: 'iPhone / iPad — Safari', icon: '🍎',
    steps: [
      { fr: 'Les notifications push sur iPhone nécessitent d\'ajouter l\'app à l\'écran d\'accueil', en: 'Push notifications on iPhone require adding the app to the home screen' },
      { fr: 'Dans Safari, appuie sur le bouton Partager ⬆', en: 'In Safari, tap the Share button ⬆' },
      { fr: 'Sélectionne "Sur l\'écran d\'accueil"', en: 'Select "Add to Home Screen"' },
      { fr: 'Ouvre l\'app depuis l\'écran d\'accueil (pas depuis Safari)', en: 'Open the app from the home screen (not from Safari)' },
      { fr: 'Ensuite : Réglages iPhone → Apps → Safari → Notifications → Autoriser eolisconnect.online', en: 'Then: iPhone Settings → Apps → Safari → Notifications → Allow eolisconnect.online' },
    ],
  },
  'pc-chrome': {
    label: 'PC / Mac — Chrome', icon: '💻',
    steps: [
      { fr: 'Clique sur l\'icône 🔒 cadenas à gauche de l\'URL dans la barre d\'adresse', en: 'Click the 🔒 lock icon to the left of the URL in the address bar' },
      { fr: 'Clique sur "Paramètres du site"', en: 'Click "Site settings"' },
      { fr: 'Trouve la ligne Notifications', en: 'Find the Notifications row' },
      { fr: 'Change le menu déroulant de "Bloquer" à "Autoriser"', en: 'Change the dropdown from "Block" to "Allow"' },
      { fr: 'Recharge la page', en: 'Reload the page' },
    ],
  },
  'pc-firefox': {
    label: 'PC / Mac — Firefox', icon: '🦊',
    steps: [
      { fr: 'Clique sur l\'icône 🔒 cadenas à gauche de l\'URL', en: 'Click the 🔒 lock icon to the left of the URL' },
      { fr: 'Clique sur "Connexion sécurisée" → "Plus d\'informations"', en: 'Click "Secure connection" → "More information"' },
      { fr: 'Va dans l\'onglet Permissions', en: 'Go to the Permissions tab' },
      { fr: 'Trouve Envoyer des notifications et décoche "Bloquer"', en: 'Find Send notifications and uncheck "Block"' },
      { fr: 'Ferme et recharge la page', en: 'Close and reload the page' },
    ],
  },
  'pc-edge': {
    label: 'PC — Microsoft Edge', icon: '🌐',
    steps: [
      { fr: 'Clique sur l\'icône 🔒 cadenas à gauche de l\'URL', en: 'Click the 🔒 lock icon to the left of the URL' },
      { fr: 'Clique sur "Autorisations pour ce site"', en: 'Click "Permissions for this site"' },
      { fr: 'Trouve Notifications dans la liste', en: 'Find Notifications in the list' },
      { fr: 'Change de "Bloquer" à "Autoriser"', en: 'Change from "Block" to "Allow"' },
      { fr: 'Recharge la page', en: 'Reload the page' },
    ],
  },
  'pc-safari': {
    label: 'Mac — Safari', icon: '🧭',
    steps: [
      { fr: 'Dans le menu Safari en haut, clique sur Safari → Réglages', en: 'In the top Safari menu, click Safari → Settings' },
      { fr: 'Va dans l\'onglet Sites web', en: 'Go to the Websites tab' },
      { fr: 'Clique sur Notifications dans la colonne gauche', en: 'Click Notifications in the left column' },
      { fr: 'Trouve eolisconnect.online dans la liste', en: 'Find eolisconnect.online in the list' },
      { fr: 'Change le menu sur Autoriser', en: 'Change the dropdown to Allow' },
    ],
  },
}

export default function ClientSettings({ locale, userId, username, initialFirstName, initialLastName, initialEmail, initialPhone, initialPhoneVerified, currentLocale }: Props) {
  const router = useRouter()
  const isFr = locale === 'fr'

  const [profile, setProfile] = useState({
    firstName: initialFirstName,
    lastName: initialLastName,
    email: initialEmail,
    phone: initialPhone,
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [phoneVerified, setPhoneVerified] = useState(initialPhoneVerified)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpResent, setOtpResent] = useState(false)

  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [pushPrefs, setPushPrefs] = useState({ newMessage: true, finalResponse: true, documentRequested: true })
  const [pushSaving, setPushSaving] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<string>('')

  useEffect(() => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      setPushPermission('unsupported'); return
    }
    setPushPermission(Notification.permission)
    setSelectedDevice(detectDevice())
    isPushSubscribed().then(setPushEnabled)
    apiFetch('/api/push/preferences').then(r => r.json()).then(d => {
      if (d) setPushPrefs({ newMessage: d.newMessage ?? true, finalResponse: d.finalResponse ?? true, documentRequested: d.documentRequested ?? true })
    }).catch(() => {})
  }, [])

  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current: false, newPass: false, confirm: false })
  const [passSaving, setPassSaving] = useState(false)
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const t = {
    title: isFr ? 'Paramètres' : 'Settings',
    profile: isFr ? 'Mon profil' : 'My profile',
    usernameLabel: isFr ? 'Identifiant de connexion' : 'Login username',
    usernameNote: isFr ? 'Non modifiable' : 'Cannot be changed',
    firstName: isFr ? 'Prénom' : 'First name',
    lastName: isFr ? 'Nom' : 'Last name',
    email: isFr ? 'Email' : 'Email',
    emailNote: isFr ? 'Contactez le support pour modifier votre email.' : 'Contact support to change your email.',
    phone: isFr ? 'Téléphone' : 'Phone',
    updateProfile: isFr ? 'Mettre à jour' : 'Update profile',
    profileUpdated: isFr ? 'Profil mis à jour avec succès.' : 'Profile updated successfully.',
    changePassword: isFr ? 'Changer le mot de passe' : 'Change password',
    currentPassword: isFr ? 'Mot de passe actuel' : 'Current password',
    newPassword: isFr ? 'Nouveau mot de passe' : 'New password',
    confirmNewPassword: isFr ? 'Confirmer le nouveau mot de passe' : 'Confirm new password',
    updatePassword: isFr ? 'Changer le mot de passe' : 'Change password',
    passwordUpdated: isFr ? 'Mot de passe changé avec succès.' : 'Password changed successfully.',
    mismatch: isFr ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.',
    wrongCurrent: isFr ? 'Mot de passe actuel incorrect.' : 'Current password is incorrect.',
    language: isFr ? 'Langue' : 'Language',
    langFr: 'Français',
    langEn: 'English',
    error: isFr ? 'Une erreur est survenue.' : 'An error occurred.',
    notifications:       isFr ? 'Notifications push' : 'Push notifications',
    notifDesc:           isFr ? 'Recevez des alertes sur votre téléphone même quand l\'app est fermée.' : 'Receive alerts on your phone even when the app is closed.',
    notifEnabled:        isFr ? 'Activées' : 'Enabled',
    notifDisabled:       isFr ? 'Désactivées' : 'Disabled',
    notifNewMessage:     isFr ? 'Nouveau message de l\'agent' : 'New message from agent',
    notifFinalResponse:  isFr ? 'Réponse finale (dossier clôturé)' : 'Final response (case closed)',
    notifDocRequested:   isFr ? 'Document demandé' : 'Document requested',
    notifSaved:          isFr ? 'Préférences sauvegardées.' : 'Preferences saved.',
    phoneVerified: isFr ? 'Téléphone vérifié' : 'Phone verified',
    phoneNotVerified: isFr ? 'Non vérifié' : 'Not verified',
    sendCode: isFr ? 'Envoyer un code SMS' : 'Send SMS code',
    enterCode: isFr ? 'Entrez le code reçu par SMS' : 'Enter the code received by SMS',
    verify: isFr ? 'Vérifier' : 'Verify',
    resend: isFr ? 'Renvoyer le code' : 'Resend code',
    codeSent: isFr ? 'Code renvoyé !' : 'Code resent!',
    verifiedOk: isFr ? 'Téléphone vérifié avec succès !' : 'Phone verified successfully!',
    otpExpired: isFr ? 'Code expiré ou invalide.' : 'Code expired or invalid.',
  }

  async function sendOtp() {
    await fetch(apiUrl('/api/auth/otp/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ phone: profile.phone, userId }),
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
      body: JSON.stringify({ phone: profile.phone, code: otpCode, userId }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.verified) {
      setPhoneVerified(true)
      setOtpSent(false)
      setOtpCode('')
      setProfileMsg({ type: 'success', text: t.verifiedOk })
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

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)
    const res = await apiFetch('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone }),
    })
    if (res.ok) {
      const updated = await res.json()
      const currentUser = getUser()
      if (currentUser) {
        saveSession(getToken()!, { ...currentUser, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone, phoneVerified: updated.phoneVerified })
      }
      if (updated.phone !== initialPhone) {
        setPhoneVerified(false)
        setOtpSent(false)
      } else {
        setPhoneVerified(updated.phoneVerified ?? false)
      }
      setProfileMsg({ type: 'success', text: t.profileUpdated })
    } else {
      setProfileMsg({ type: 'error', text: t.error })
    }
    setProfileSaving(false)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (passwords.newPass !== passwords.confirm) {
      setPassMsg({ type: 'error', text: t.mismatch }); return
    }
    setPassSaving(true)
    setPassMsg(null)
    const res = await apiFetch('/api/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPass }),
    })
    if (res.ok) {
      setPassMsg({ type: 'success', text: t.passwordUpdated })
      setPasswords({ current: '', newPass: '', confirm: '' })
    } else {
      const data = await res.json().catch(() => ({}))
      const msg = data.detail === 'wrong_current_password' ? t.wrongCurrent : t.error
      setPassMsg({ type: 'error', text: msg })
    }
    setPassSaving(false)
  }

  async function togglePush() {
    if (pushEnabled) {
      await unsubscribeFromPush()
      setPushEnabled(false)
    } else {
      const ok = await subscribeToPush()
      setPushEnabled(ok)
      setPushPermission(Notification.permission)
    }
  }

  async function savePushPrefs() {
    setPushSaving(true)
    await apiFetch('/api/push/preferences', { method: 'PATCH', body: JSON.stringify(pushPrefs) }).catch(() => {})
    setPushSaving(false)
    setProfileMsg({ type: 'success', text: t.notifSaved })
    setTimeout(() => setProfileMsg(null), 3000)
  }

  function switchLang(lang: string) {
    const currentPath = window.location.pathname
    const newPath = currentPath.replace(`/${locale}/`, `/${lang}/`)
    router.push(newPath)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t.title}</h1>

      {/* Profile section */}
      <section className="bg-white rounded-2xl border border-gray-100 card-shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1B3A5C]/10 flex items-center justify-center">
            <User size={18} className="text-[#1B3A5C]" />
          </div>
          <h2 className="font-semibold text-gray-900">{t.profile}</h2>
        </div>
        <div className="px-6 py-5">
          <form onSubmit={saveProfile} className="space-y-4">
            {/* Username — read-only */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">{t.usernameLabel}</label>
                <span className="text-xs text-gray-400">{t.usernameNote}</span>
              </div>
              <input
                type="text" readOnly value={username}
                className="px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500 cursor-not-allowed font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">{t.firstName}</label>
                <input
                  type="text" required value={profile.firstName}
                  onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">{t.lastName}</label>
                <input
                  type="text" required value={profile.lastName}
                  onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
                />
              </div>
            </div>
            {/* Email — read-only */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">{t.email}</label>
              <input
                type="email" readOnly value={profile.email}
                className="px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400">{t.emailNote}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">{t.phone}</label>
                {profile.phone && (
                  phoneVerified
                    ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle size={12} /> {t.phoneVerified}</span>
                    : <span className="text-xs text-amber-600 font-medium">{t.phoneNotVerified}</span>
                )}
              </div>
              <input
                type="tel" value={profile.phone}
                onChange={e => { setProfile(p => ({ ...p, phone: e.target.value })); setPhoneVerified(false); setOtpSent(false) }}
                placeholder="+237 6XX XXX XXX"
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
              />
              {profile.phone && !phoneVerified && (
                <div className="mt-1 p-3 rounded-xl border border-[#4A8FC4]/30 bg-[#4A8FC4]/5 space-y-2">
                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={sendOtp}
                      className="flex items-center gap-1.5 text-xs text-[#4A8FC4] font-semibold hover:underline"
                    >
                      <Phone size={12} /> {t.sendCode}
                    </button>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">{t.enterCode}</p>
                      <form onSubmit={verifyOtp} className="flex gap-2">
                        <input
                          type="text" inputMode="numeric" maxLength={6}
                          value={otpCode}
                          onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError('') }}
                          placeholder="_ _ _ _ _ _"
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-center font-mono text-base tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
                        />
                        <button
                          type="submit"
                          disabled={otpCode.length < 6 || otpLoading}
                          className="px-3 py-2 rounded-lg bg-[#1B3A5C] text-white text-xs font-semibold disabled:opacity-50"
                        >
                          {otpLoading ? '...' : t.verify}
                        </button>
                      </form>
                      {otpError && <p className="text-xs text-red-500">{otpError}</p>}
                      <button type="button" onClick={resendOtp} className="flex items-center gap-1 text-xs text-[#4A8FC4] hover:underline">
                        <RefreshCw size={10} />
                        {otpResent ? t.codeSent : t.resend}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {profileMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {profileMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {profileMsg.text}
              </div>
            )}
            <button
              type="submit"
              disabled={profileSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] disabled:opacity-60 transition-colors"
            >
              {profileSaving && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {t.updateProfile}
            </button>
          </form>
        </div>
      </section>

      {/* Password section */}
      <section className="bg-white rounded-2xl border border-gray-100 card-shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4A8FC4]/10 flex items-center justify-center">
            <Lock size={18} className="text-[#4A8FC4]" />
          </div>
          <h2 className="font-semibold text-gray-900">{t.changePassword}</h2>
        </div>
        <div className="px-6 py-5">
          <form onSubmit={savePassword} className="space-y-4">
            {[
              { key: 'current', label: t.currentPassword },
              { key: 'newPass', label: t.newPassword },
              { key: 'confirm', label: t.confirmNewPassword },
            ].map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">{label}</label>
                <div className="relative">
                  <input
                    type={showPw[key as keyof typeof showPw] ? 'text' : 'password'}
                    required value={passwords[key as keyof typeof passwords]}
                    onChange={e => setPasswords(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPw(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw[key as keyof typeof showPw] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            {passMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${passMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {passMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {passMsg.text}
              </div>
            )}
            <button
              type="submit"
              disabled={passSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4A8FC4] text-white font-semibold text-sm hover:bg-[#3a7ab0] disabled:opacity-60 transition-colors"
            >
              {passSaving && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {t.updatePassword}
            </button>
          </form>
        </div>
      </section>

      {/* Notifications section */}
      {pushPermission !== 'unsupported' && (
        <section className="bg-white rounded-2xl border border-gray-100 card-shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Bell size={18} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">{t.notifications}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t.notifDesc}</p>
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
          <div className="px-6 py-5 space-y-3">
            {pushPermission === 'denied' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">🔕</span>
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      {isFr ? 'Notifications bloquées' : 'Notifications blocked'}
                    </p>
                    <p className="text-xs text-red-500 mt-0.5">
                      {isFr
                        ? 'Vous avez refusé les notifications. JavaScript ne peut pas les réactiver — c\'est l\'OS qui bloque. Suivez le guide ci-dessous.'
                        : 'You denied notifications. JavaScript can\'t re-enable them — the OS is blocking. Follow the guide below.'}
                    </p>
                  </div>
                </div>

                {/* Sélection du device */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    {isFr ? 'Sélectionne ton appareil / navigateur :' : 'Select your device / browser:'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(DEVICE_GUIDE).map(([id, d]) => (
                      <button key={id} onClick={() => setSelectedDevice(id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all ${
                          selectedDevice === id
                            ? 'border-[#1B3A5C] bg-[#1B3A5C]/5 text-[#1B3A5C]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>
                        <span className="text-base">{d.icon}</span>
                        <span className="leading-tight">{d.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Étapes pour le device sélectionné */}
                {selectedDevice && DEVICE_GUIDE[selectedDevice] && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-amber-800 mb-3">
                      {isFr ? `Guide — ${DEVICE_GUIDE[selectedDevice].label}` : `Guide — ${DEVICE_GUIDE[selectedDevice].label}`}
                    </p>
                    <ol className="space-y-2">
                      {DEVICE_GUIDE[selectedDevice].steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-xs text-amber-900 leading-relaxed">
                            {isFr ? step.fr : step.en}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
            {pushPermission === 'default' && !pushEnabled && (
              <p className="text-xs text-gray-400">
                {isFr ? 'Activez le toggle ci-dessus — le navigateur vous demandera la permission.' : 'Enable the toggle above — the browser will ask for permission.'}
              </p>
            )}
            {pushEnabled && ([
              { key: 'newMessage',        label: t.notifNewMessage },
              { key: 'finalResponse',     label: t.notifFinalResponse },
              { key: 'documentRequested', label: t.notifDocRequested },
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
            {pushEnabled && (
              <button
                onClick={savePushPrefs}
                disabled={pushSaving}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] disabled:opacity-60 transition-colors"
              >
                {pushSaving && <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {isFr ? 'Enregistrer' : 'Save'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Language section */}
      <section className="bg-white rounded-2xl border border-gray-100 card-shadow">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#8B5A2B]/10 flex items-center justify-center">
            <Globe size={18} className="text-[#8B5A2B]" />
          </div>
          <h2 className="font-semibold text-gray-900">{t.language}</h2>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            {[{ code: 'fr', label: t.langFr, flag: '🇫🇷' }, { code: 'en', label: t.langEn, flag: '🇬🇧' }].map(lang => (
              <button
                key={lang.code}
                onClick={() => switchLang(lang.code)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  locale === lang.code
                    ? 'border-[#1B3A5C] bg-[#1B3A5C]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <div className="text-left">
                  <p className="font-semibold text-sm text-gray-900">{lang.label}</p>
                  {locale === lang.code && <p className="text-xs text-[#4A8FC4]">Active</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
