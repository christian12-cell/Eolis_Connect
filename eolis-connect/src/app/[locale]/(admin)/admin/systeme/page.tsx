'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiFetch, getUser } from '@/lib/api-client'
import { Globe, Clock, Check, MessageSquare, Send, AlertTriangle, Trash2, RefreshCw, DollarSign, Wrench, WifiOff, Wifi, Mail, Bell, Phone } from 'lucide-react'
import { apiUrl } from '@/lib/api-client'

const TIMEZONES = [
  { value: 'Africa/Douala', label: 'Douala / Yaoundé (WAT, UTC+1)' },
  { value: 'Africa/Lagos', label: 'Lagos / Abuja (WAT, UTC+1)' },
  { value: 'Africa/Abidjan', label: 'Abidjan / Dakar (GMT, UTC+0)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { value: 'Europe/Brussels', label: 'Bruxelles (CET/CEST, UTC+1/2)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST, UTC+1/2)' },
  { value: 'Europe/London', label: 'Londres (GMT/BST, UTC+0/1)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
  { value: 'America/New_York', label: 'New York (EST/EDT, UTC-5/4)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT, UTC-6/5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT, UTC-8/7)' },
  { value: 'Asia/Dubai', label: 'Dubaï (GST, UTC+4)' },
  { value: 'Asia/Singapore', label: 'Singapour (SGT, UTC+8)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST, UTC+9)' },
]

export default function SystemePage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser] = useState<any>(null)
  const [timezone, setTimezone] = useState('Africa/Douala')
  const [selectedTz, setSelectedTz] = useState('Africa/Douala')
  const [now, setNow] = useState(new Date())
  const [saved, setSaved] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsResult, setSmsResult] = useState<'ok' | 'err' | null>(null)

  const [resetPhrase, setResetPhrase] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetResult, setResetResult] = useState<'ok' | 'err' | null>(null)
  const [fcfaRate, setFcfaRate]   = useState('600')
  const [fcfaSaving, setFcfaSaving] = useState(false)
  const [fcfaSaved, setFcfaSaved]   = useState(false)
  const [eurRate, setEurRate]       = useState('655.957')
  const [eurSaving, setEurSaving]   = useState(false)
  const [eurSaved, setEurSaved]     = useState(false)

  // Maintenance state
  const [maintenance, setMaintenance] = useState<{ active: boolean; message: string | null; estimatedReturn: string | null } | null>(null)
  const [maintenanceMsg, setMaintenanceMsg]   = useState('')
  const [maintenanceEta, setMaintenanceEta]   = useState('')
  const [returnMsg, setReturnMsg]             = useState('')
  const [mSendEmail, setMSendEmail]           = useState(true)
  const [mSendPush, setMSendPush]             = useState(true)
  const [mSendSms, setMSendSms]               = useState(false)
  const [mSending, setMSending]               = useState(false)
  const [mResult, setMResult]                 = useState<'ok' | 'err' | null>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (u.role !== 'SYSTEM_ADMIN') { router.replace(`/${locale}/accueil`); return }
    setUser(u)
    const savedTz = localStorage.getItem('eolis_timezone') ?? 'Africa/Douala'
    setTimezone(savedTz)
    setSelectedTz(savedTz)
    // Load exchange rates
    apiFetch('/api/admin/config').then(r => r.json()).then(cfg => {
      if (cfg.fcfa_rate) setFcfaRate(cfg.fcfa_rate)
      if (cfg.eur_rate)  setEurRate(cfg.eur_rate)
    }).catch(() => {})
    // Load maintenance status
    fetch(apiUrl('/api/maintenance/status'))
      .then(r => r.json())
      .then(d => setMaintenance(d))
      .catch(() => {})
  }, [locale])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  function applyTimezone() {
    localStorage.setItem('eolis_timezone', selectedTz)
    setTimezone(selectedTz)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function resetDb(e: React.FormEvent) {
    e.preventDefault()
    if (resetPhrase !== 'RESET') return
    setResetting(true)
    setResetResult(null)
    try {
      const res = await apiFetch('/api/users/admin/reset-db', { method: 'POST' })
      if (res.ok) {
        setResetResult('ok')
        setResetPhrase('')
      } else {
        setResetResult('err')
      }
    } catch {
      setResetResult('err')
    }
    setResetting(false)
  }

  async function saveFcfaRate(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(fcfaRate)
    if (isNaN(v) || v <= 0) return
    setFcfaSaving(true)
    try {
      await apiFetch('/api/admin/config/fcfa_rate', { method: 'PATCH', body: JSON.stringify({ value: String(v) }) })
      setFcfaSaved(true)
      setTimeout(() => setFcfaSaved(false), 2500)
    } catch {}
    setFcfaSaving(false)
  }

  async function saveEurRate(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(eurRate)
    if (isNaN(v) || v <= 0) return
    setEurSaving(true)
    try {
      await apiFetch('/api/admin/config/eur_rate', { method: 'PATCH', body: JSON.stringify({ value: String(v) }) })
      setEurSaved(true)
      setTimeout(() => setEurSaved(false), 2500)
    } catch {}
    setEurSaving(false)
  }

  async function activateMaintenance(e: React.FormEvent) {
    e.preventDefault()
    if (!maintenanceMsg.trim()) return
    setMSending(true); setMResult(null)
    try {
      const res = await apiFetch('/api/maintenance/activate', {
        method: 'POST',
        body: JSON.stringify({
          message: maintenanceMsg,
          estimated_return: maintenanceEta || null,
          send_email: mSendEmail,
          send_push: mSendPush,
          send_sms: mSendSms,
        }),
      })
      if (res.ok) {
        setMaintenance({ active: true, message: maintenanceMsg, estimatedReturn: maintenanceEta || null })
        setMResult('ok')
      } else { setMResult('err') }
    } catch { setMResult('err') }
    setMSending(false)
    setTimeout(() => setMResult(null), 4000)
  }

  async function deactivateMaintenance(e: React.FormEvent) {
    e.preventDefault()
    setMSending(true); setMResult(null)
    try {
      const res = await apiFetch('/api/maintenance/deactivate', {
        method: 'POST',
        body: JSON.stringify({
          return_message: returnMsg.trim() || null,
          send_email: mSendEmail,
          send_push: mSendPush,
          send_sms: mSendSms,
        }),
      })
      if (res.ok) {
        setMaintenance({ active: false, message: null, estimatedReturn: null })
        setReturnMsg('')
        setMResult('ok')
      } else { setMResult('err') }
    } catch { setMResult('err') }
    setMSending(false)
    setTimeout(() => setMResult(null), 4000)
  }

  async function sendTestSms(e: React.FormEvent) {
    e.preventDefault()
    setSmsSending(true)
    setSmsResult(null)
    try {
      await apiFetch('/api/users/admin/test-sms', { method: 'POST', body: JSON.stringify({ phone: testPhone }) })
      setSmsResult('ok')
    } catch {
      setSmsResult('err')
    }
    setSmsSending(false)
    setTimeout(() => setSmsResult(null), 4000)
  }

  if (!user) return null

  const isFr = locale === 'fr'
  const tzLabel = TIMEZONES.find(t => t.value === timezone)?.label ?? timezone

  const t = {
    title: isFr ? 'Paramètres système' : 'System settings',
    clockTitle: isFr ? 'Horloge système en direct' : 'Live system clock',
    tzTitle: isFr ? 'Fuseau horaire' : 'Timezone',
    tzDesc: isFr
      ? 'Le fuseau horaire sélectionné sera appliqué à toutes les dates et heures affichées dans l\'application.'
      : 'The selected timezone will apply to all dates and times displayed throughout the application.',
    apply: isFr ? 'Appliquer' : 'Apply',
    saved: isFr ? 'Enregistré !' : 'Saved!',
    active: isFr ? 'Fuseau actif' : 'Active timezone',
  }

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h1>

      {/* Taux de change */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <DollarSign size={18} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{isFr ? 'Taux de change' : 'Exchange rates'}</h2>
            <p className="text-xs text-gray-400">{isFr ? 'Utilisés pour toutes les conversions de prix dans l\'application' : 'Used for all price conversions in the application'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* USD */}
          <form onSubmit={saveFcfaRate} className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">USD → FCFA</p>
            <p className="text-[11px] text-gray-400">{isFr ? 'Taux opérationnel Eolis — utilisé pour les coûts OpenAI' : 'Eolis operational rate — used for OpenAI costs'}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-500">1 $ =</span>
              <input type="number" min="1" step="0.01" value={fcfaRate}
                onChange={e => setFcfaRate(e.target.value)}
                className="w-28 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1B3A5C]" />
              <span className="text-sm font-semibold text-gray-600">FCFA</span>
            </div>
            <button type="submit" disabled={fcfaSaving}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                fcfaSaved ? 'bg-emerald-500 text-white' : 'bg-[#1B3A5C] text-white hover:bg-[#152d47]'
              }`}>
              {fcfaSaved ? '✓' : ''} {isFr ? 'Enregistrer' : 'Save'}
            </button>
          </form>

          {/* EUR */}
          <form onSubmit={saveEurRate} className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">EUR → FCFA</p>
            <p className="text-[11px] text-gray-400">{isFr ? 'Taux fixe officiel XAF/EUR (modifiable si changement de parité)' : 'Official fixed XAF/EUR rate (editable if parity changes)'}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-500">1 € =</span>
              <input type="number" min="1" step="0.001" value={eurRate}
                onChange={e => setEurRate(e.target.value)}
                className="w-28 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1B3A5C]" />
              <span className="text-sm font-semibold text-gray-600">FCFA</span>
            </div>
            <button type="submit" disabled={eurSaving}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                eurSaved ? 'bg-emerald-500 text-white' : 'bg-[#1B3A5C] text-white hover:bg-[#152d47]'
              }`}>
              {eurSaved ? '✓' : ''} {isFr ? 'Enregistrer' : 'Save'}
            </button>
          </form>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6 max-w-4xl mb-6">
        {/* Live clock */}
        <section className="bg-white rounded-2xl border border-gray-100 card-shadow p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#1B3A5C]/10 flex items-center justify-center">
              <Clock size={18} className="text-[#1B3A5C]" />
            </div>
            <h2 className="font-semibold text-gray-900">{t.clockTitle}</h2>
          </div>

          <div className="text-center py-4">
            <p className="text-xs text-gray-400 mb-1">{t.active}</p>
            <p className="text-sm font-medium text-[#4A8FC4] mb-4">{tzLabel}</p>

            <p className="font-mono text-5xl font-bold text-[#1B3A5C] tracking-tight tabular-nums leading-none">
              {now.toLocaleTimeString(isFr ? 'fr-FR' : 'en-GB', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                timeZone: timezone,
              })}
            </p>

            <p className="text-gray-500 mt-4 text-sm capitalize">
              {now.toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                timeZone: timezone,
              })}
            </p>
          </div>
        </section>

        {/* Timezone selector */}
        <section className="bg-white rounded-2xl border border-gray-100 card-shadow p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#4A8FC4]/10 flex items-center justify-center">
              <Globe size={18} className="text-[#4A8FC4]" />
            </div>
            <h2 className="font-semibold text-gray-900">{t.tzTitle}</h2>
          </div>

          <p className="text-sm text-gray-500 mb-4">{t.tzDesc}</p>

          <select
            value={selectedTz}
            onChange={e => setSelectedTz(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent mb-4 bg-white"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>

          {/* Preview with selected (not yet saved) timezone */}
          {selectedTz !== timezone && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-blue-500 font-medium mb-1">{isFr ? 'Aperçu' : 'Preview'}</p>
              <p className="font-mono text-xl font-bold text-blue-700 tabular-nums">
                {now.toLocaleTimeString(isFr ? 'fr-FR' : 'en-GB', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                  timeZone: selectedTz,
                })}
              </p>
            </div>
          )}

          <button
            onClick={applyTimezone}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B3A5C] text-white font-semibold text-sm hover:bg-[#152d47] transition-colors"
          >
            {saved && <Check size={16} />}
            {saved ? t.saved : t.apply}
          </button>
        </section>
      </div>
      {/* Test SMS */}
      <section className="bg-white rounded-2xl border border-gray-100 card-shadow p-6 max-w-md">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <MessageSquare size={18} className="text-emerald-600" />
          </div>
          <h2 className="font-semibold text-gray-900">{isFr ? 'Test SMS Twilio' : 'Twilio SMS test'}</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {isFr
            ? 'Envoyez un SMS de test pour vérifier que la configuration Twilio est opérationnelle.'
            : 'Send a test SMS to confirm Twilio is configured and working.'}
        </p>
        <form onSubmit={sendTestSms} className="flex gap-2">
          <input
            type="tel"
            required
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="+237 6XX XXX XXX"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={smsSending}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
            {smsSending ? '...' : isFr ? 'Envoyer' : 'Send'}
          </button>
        </form>
        {smsResult === 'ok' && (
          <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1"><Check size={12} /> {isFr ? 'SMS envoyé !' : 'SMS sent!'}</p>
        )}
        {smsResult === 'err' && (
          <p className="mt-2 text-xs text-red-500">{isFr ? 'Échec d\'envoi. Vérifiez les logs.' : 'Send failed. Check server logs.'}</p>
        )}
      </section>

      {/* Danger zone — Reset DB */}
      <section className="bg-white rounded-2xl border-2 border-red-200 card-shadow p-6 max-w-md mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold text-red-700">{isFr ? 'Zone dangereuse' : 'Danger zone'}</h2>
            <p className="text-xs text-red-400">{isFr ? 'Action irréversible' : 'Irreversible action'}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          {isFr
            ? 'Supprime toutes les données opérationnelles : tickets, messages, notifications, logs, pièces jointes. Les comptes utilisateurs sont conservés.'
            : 'Deletes all operational data: tickets, messages, notifications, logs, attachments. User accounts are kept.'}
        </p>
        <p className="text-xs text-red-500 font-semibold mb-4">
          {isFr ? '⚠️ Les comptes utilisateurs ne sont jamais supprimés par cette action.' : '⚠️ User accounts are never deleted by this action.'}
        </p>
        {resetResult === 'ok' && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm mb-3">
            <Check size={15} /> {isFr ? 'Données opérationnelles supprimées.' : 'Operational data deleted.'}
          </div>
        )}
        {resetResult === 'err' && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-3">
            <AlertTriangle size={15} /> {isFr ? 'Erreur lors du reset.' : 'Reset failed.'}
          </div>
        )}
        <form onSubmit={resetDb} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              {isFr ? 'Tapez "RESET" pour confirmer' : 'Type "RESET" to confirm'}
            </label>
            <input
              type="text"
              value={resetPhrase}
              onChange={e => setResetPhrase(e.target.value.toUpperCase())}
              placeholder="RESET"
              className="w-full px-4 py-2.5 rounded-xl border border-red-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={resetPhrase !== 'RESET' || resetting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {resetting ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {isFr ? 'Réinitialiser la base de données' : 'Reset the database'}
          </button>
        </form>
      </section>

      {/* Maintenance — visible uniquement pour le compte propriétaire */}
      {user.username === 'Christian.DENMEKO' && <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 max-w-4xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${maintenance?.active ? 'bg-amber-50' : 'bg-emerald-50'}`}>
              <Wrench size={18} className={maintenance?.active ? 'text-amber-600' : 'text-emerald-600'} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{isFr ? 'Mode maintenance' : 'Maintenance mode'}</h2>
              <p className="text-xs text-gray-400">{isFr ? 'Gère l\'accès à la plateforme et notifie tous les utilisateurs' : 'Manage platform access and notify all users'}</p>
            </div>
          </div>
          {maintenance !== null && (
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${maintenance.active ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {maintenance.active ? <WifiOff size={12} /> : <Wifi size={12} />}
              {maintenance.active ? (isFr ? 'En maintenance' : 'Maintenance') : (isFr ? 'En ligne' : 'Online')}
            </span>
          )}
        </div>

        {/* Channels */}
        <div className="flex flex-wrap gap-4 mb-5 p-4 bg-gray-50 rounded-xl">
          <p className="w-full text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{isFr ? 'Canaux de notification' : 'Notification channels'}</p>
          {[
            { icon: <Mail size={13}/>, label: 'Email', val: mSendEmail, set: setMSendEmail },
            { icon: <Bell size={13}/>, label: 'Push', val: mSendPush, set: setMSendPush },
            { icon: <Phone size={13}/>, label: 'SMS', val: mSendSms, set: setMSendSms, note: isFr ? '(coût par envoi)' : '(cost per send)' },
          ].map(ch => (
            <label key={ch.label} className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={ch.val} onChange={e => ch.set(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#4A8FC4] cursor-pointer" />
              <span className="flex items-center gap-1 text-sm text-gray-700">{ch.icon} {ch.label}</span>
              {ch.note && <span className="text-[10px] text-gray-400">{ch.note}</span>}
            </label>
          ))}
        </div>

        {mResult && (
          <div className={`mb-4 flex items-center gap-2 text-sm px-4 py-3 rounded-xl border ${mResult === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {mResult === 'ok' ? <Check size={14}/> : <AlertTriangle size={14}/>}
            {mResult === 'ok' ? (isFr ? 'Opération effectuée. Broadcasts en cours d\'envoi.' : 'Done. Broadcasts are being sent.') : (isFr ? 'Erreur. Réessayez.' : 'Error. Please try again.')}
          </div>
        )}

        {maintenance?.active ? (
          /* Deactivation form */
          <form onSubmit={deactivateMaintenance} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {isFr ? 'Message de retour (optionnel) — apparaîtra dans les notifications' : 'Return message (optional) — will appear in notifications'}
              </label>
              <textarea
                value={returnMsg}
                onChange={e => setReturnMsg(e.target.value)}
                rows={4}
                placeholder={isFr ? 'Ex : Mise à jour terminée. Nouvelles fonctionnalités : …\nSi nécessaire, veuillez désinstaller et retélécharger l\'application.' : 'E.g.: Update complete. New features: …\nIf needed, please uninstall and reinstall the app.'}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
              />
            </div>
            <button type="submit" disabled={mSending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {mSending ? <RefreshCw size={15} className="animate-spin"/> : <Wifi size={15}/>}
              {isFr ? 'Remettre en ligne & notifier' : 'Bring back online & notify'}
            </button>
          </form>
        ) : (
          /* Activation form */
          <form onSubmit={activateMaintenance} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {isFr ? 'Message de maintenance *' : 'Maintenance message *'}
              </label>
              <textarea
                value={maintenanceMsg}
                onChange={e => setMaintenanceMsg(e.target.value)}
                rows={3}
                required
                placeholder={isFr ? 'Ex : La plateforme est en maintenance pour une mise à jour importante.' : 'E.g.: The platform is under maintenance for an important update.'}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {isFr ? 'Retour estimé (optionnel)' : 'Estimated return (optional)'}
              </label>
              <input
                type="datetime-local"
                value={maintenanceEta}
                onChange={e => setMaintenanceEta(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent"
              />
            </div>
            <button type="submit" disabled={mSending || !maintenanceMsg.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {mSending ? <RefreshCw size={15} className="animate-spin"/> : <WifiOff size={15}/>}
              {isFr ? 'Activer la maintenance & notifier' : 'Enable maintenance & notify'}
            </button>
          </form>
        )}
      </section>}
    </DashboardLayout>
  )
}
