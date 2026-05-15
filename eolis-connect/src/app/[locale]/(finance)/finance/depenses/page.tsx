'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { apiFetch, getUser } from '@/lib/api-client'
import { Building2, Plus, Trash2, Loader2, ExternalLink, AlertCircle } from 'lucide-react'

const EUR = 655.957; const USD = 600
function f2(n: number) { return n.toFixed(2) }
function toUsd(f: number) { return (f/USD).toFixed(2) }
function toEur(f: number) { return (f/EUR).toFixed(2) }

const CATEGORIES = ['vercel','railway','neon','aws_s3','twilio','cloudflare','domain','openai','maintenance','other']
const CAT_LABELS: Record<string,string> = {
  vercel:      'Vercel',
  railway:     'Railway',
  neon:        'Neon (BDD)',
  aws_s3:      'AWS S3',
  twilio:      'Twilio (SMS)',
  cloudflare:  'Cloudflare',
  domain:      'Domaine',
  openai:      'OpenAI (forfait)',
  maintenance: 'Maintenance',
  other:       'Autre',
}
const CAT_COLORS: Record<string,string> = {
  vercel:      'bg-black text-white',
  railway:     'bg-purple-600 text-white',
  neon:        'bg-teal-600 text-white',
  aws_s3:      'bg-yellow-500 text-white',
  twilio:      'bg-red-600 text-white',
  cloudflare:  'bg-orange-500 text-white',
  domain:      'bg-blue-500 text-white',
  openai:      'bg-emerald-600 text-white',
  maintenance: 'bg-amber-500 text-white',
  other:       'bg-gray-500 text-white',
}

export default function FinanceDepensesPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale]   = useState('fr')
  const [user, setUser]       = useState<any>(null)
  const [costs, setCosts]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ category: 'vercel', label: '', currency: 'eur', amount: '', period: new Date().toISOString().slice(0,7), invoice_url: '' })

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['FINANCE_AGENT','SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  const load = useCallback(() => {
    setLoading(true)
    apiFetch('/api/finance/infra-costs').then(r => r.json()).then(d => { setCosts(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { if (user) load() }, [user]) // eslint-disable-line

  const isFr = locale === 'fr'
  const isReadOnly = user?.role === 'SYSTEM_ADMIN'

  const amtNum  = parseFloat(form.amount) || 0
  const amtFcfa = form.currency === 'fcfa' ? amtNum : form.currency === 'eur' ? amtNum * EUR : amtNum * USD
  const amtUsd  = amtFcfa / USD
  const amtEur  = amtFcfa / EUR

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label || !form.amount || !form.period) return
    setSaving(true)
    const res = await apiFetch('/api/finance/infra-costs', {
      method: 'POST',
      body: JSON.stringify({
        category: form.category,
        label: form.label,
        amount_fcfa: amtFcfa,
        amount_usd: amtUsd,
        period: form.period,
        invoice_url: form.invoice_url || null,
      }),
    })
    setSaving(false)
    if (res.ok) { setShowForm(false); setForm({ category:'vercel',label:'',currency:'eur',amount:'',period:new Date().toISOString().slice(0,7),invoice_url:'' }); load() }
  }

  async function del(id: string) {
    if (!confirm(isFr ? 'Supprimer cette charge ?' : 'Delete this cost?')) return
    await apiFetch(`/api/finance/infra-costs/${id}`, { method: 'DELETE' })
    load()
  }

  const total = costs.reduce((s, c) => s + c.amountFcfa, 0)

  return (
    <DashboardLayout locale={locale} userName={user ? `${user.firstName} ${user.lastName}` : ''} role={user?.role ?? ''}>
      <div className="space-y-6 max-w-4xl">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 size={22} className="text-amber-600" />
              {isFr ? 'Charges infrastructure' : 'Infrastructure costs'}
            </h1>
            {isReadOnly && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle size={12}/> {isFr ? 'Mode lecture seule' : 'Read-only mode'}</p>}
          </div>
          {!isReadOnly && (
            <button onClick={() => setShowForm(s => !s)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white text-sm font-bold rounded-xl">
              <Plus size={16} /> {isFr ? 'Ajouter une charge' : 'Add cost'}
            </button>
          )}
        </div>

        {/* Total */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm col-span-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{isFr ? 'Total charges' : 'Total costs'}</p>
            <p className="text-2xl font-bold text-amber-600">{f2(total)} FCFA</p>
            <p className="text-[10px] text-gray-400 font-mono">${toUsd(total)} · €{toEur(total)}</p>
          </div>
          {Object.entries(
            costs.reduce((acc: any, c) => { acc[c.category] = (acc[c.category] || 0) + c.amountFcfa; return acc }, {})
          ).slice(0,4).map(([cat, amt]: any) => (
            <div key={cat} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_COLORS[cat] || 'bg-gray-500 text-white'}`}>{CAT_LABELS[cat] || cat}</span>
              <p className="text-xl font-bold text-gray-800 mt-2">{f2(amt)} FCFA</p>
              <p className="text-[10px] text-gray-400 font-mono">${toUsd(amt)} · €{toEur(amt)}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">{isFr ? 'Nouvelle charge' : 'New cost entry'}</h3>
            <form onSubmit={submit} className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Catégorie' : 'Category'}</label>
                <select value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]">
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Période (AAAA-MM)' : 'Period (YYYY-MM)'}</label>
                <input type="month" value={form.period} onChange={e => setForm(f => ({...f, period:e.target.value}))}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]" required />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Description' : 'Label'}</label>
                <input type="text" value={form.label} onChange={e => setForm(f => ({...f, label:e.target.value}))}
                  placeholder={isFr ? 'Ex: Vercel Pro — mai 2026' : 'Ex: Vercel Pro — May 2026'}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]" required />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'Montant' : 'Amount'}</label>
                <div className="mt-1 flex gap-2">
                  <select value={form.currency} onChange={e => setForm(f => ({...f, currency: e.target.value}))}
                    className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]">
                    <option value="eur">€ EUR</option>
                    <option value="usd">$ USD</option>
                    <option value="fcfa">FCFA</option>
                  </select>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                    placeholder="0.00" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]" required />
                </div>
                {amtNum > 0 && (
                  <div className="mt-2 flex gap-4 text-xs font-mono text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                    {form.currency !== 'fcfa' && <span className="text-amber-600 font-semibold">{f2(amtFcfa)} FCFA</span>}
                    {form.currency !== 'usd'  && <span>${toUsd(amtFcfa)}</span>}
                    {form.currency !== 'eur'  && <span>€{toEur(amtFcfa)}</span>}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isFr ? 'URL de la facture (optionnel)' : 'Invoice URL (optional)'}</label>
                <input type="url" value={form.invoice_url} onChange={e => setForm(f => ({...f, invoice_url:e.target.value}))}
                  placeholder="https://..." className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]" />
              </div>
              <div className="col-span-2 flex gap-3">
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#1B3A5C] text-white text-sm font-bold rounded-xl disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : (isFr ? 'Enregistrer' : 'Save')}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl">
                  {isFr ? 'Annuler' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        {loading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-amber-500" /></div> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-900">{isFr ? 'Toutes les charges' : 'All cost entries'}</p>
            </div>
            {costs.length === 0 ? (
              <div className="py-16 text-center"><Building2 size={32} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">{isFr ? 'Aucune charge enregistrée.' : 'No cost entries yet.'}</p></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {costs.map(c => (
                  <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${CAT_COLORS[c.category] || 'bg-gray-500 text-white'}`}>{CAT_LABELS[c.category] || c.category}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.label}</p>
                      <p className="text-xs text-gray-400">{c.period} · {isFr ? 'ajouté par' : 'added by'} {c.addedBy}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-800">{f2(c.amountFcfa)} FCFA</p>
                      <p className="text-[10px] text-gray-400 font-mono">${toUsd(c.amountFcfa)} · €{toEur(c.amountFcfa)}</p>
                    </div>
                    {c.invoiceUrl && (
                      <a href={c.invoiceUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#4A8FC4]"><ExternalLink size={15}/></a>
                    )}
                    {!isReadOnly && (
                      <button onClick={() => del(c.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={15}/></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
