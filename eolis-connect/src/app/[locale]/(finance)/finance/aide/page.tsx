'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { getUser } from '@/lib/api-client'
import {
  BookOpen, TrendingUp, TrendingDown, DollarSign, Building2,
  PieChart, Shield, ShieldCheck, Wallet, Bell, FileSpreadsheet,
  CheckCircle, AlertCircle, Clock, ChevronDown, ChevronRight,
  Zap, BarChart2,
} from 'lucide-react'

function Section({ icon, title, children, defaultOpen = false }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#1B3A5C]/10 flex items-center justify-center text-[#1B3A5C]">
            {icon}
          </div>
          <p className="font-bold text-gray-900">{title}</p>
        </div>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-50">{children}</div>}
    </div>
  )
}

function Kpi({ color, label, formula, desc }: { color: string; label: string; formula: string; desc: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-sm font-bold text-gray-900 mb-1">{label}</p>
      <p className="text-xs font-mono bg-white/60 rounded px-2 py-1 text-gray-700 mb-2 inline-block">{formula}</p>
      <p className="text-xs text-gray-600">{desc}</p>
    </div>
  )
}

function Row({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="flex-shrink-0 mt-0.5 text-[#4A8FC4]">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

export default function FinanceAidePage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  const [locale, setLocale] = useState('fr')
  const [user, setUser]     = useState<any>(null)

  useEffect(() => { params.then(p => setLocale(p.locale)) }, [params])
  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace(`/${locale}/login`); return }
    if (!['FINANCE_AGENT', 'SYSTEM_ADMIN'].includes(u.role)) { router.replace(`/${locale}/accueil`); return }
    setUser(u)
  }, [locale])

  if (!user) return null
  const isFr = locale === 'fr'

  return (
    <DashboardLayout locale={locale} userName={`${user.firstName} ${user.lastName}`} role={user.role}>
      <div className="space-y-5 max-w-3xl">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={22} className="text-[#1B3A5C]" />
            {isFr ? 'Guide Finance — Mode d\'emploi' : 'Finance Guide — How it works'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {isFr
              ? 'Tout ce qu\'il faut savoir pour utiliser l\'espace financier Eolis Connect'
              : 'Everything you need to know to use the Eolis Connect finance space'}
          </p>
        </div>

        {/* Modèle économique */}
        <Section icon={<Zap size={16}/>} title={isFr ? 'Modèle économique Eolis Connect' : 'Eolis Connect business model'} defaultOpen>
          <div className="pt-4 space-y-3">
            <p className="text-sm text-gray-600">
              {isFr
                ? 'Eolis Connect facture ses clients en crédits prépayés. 1 crédit = 1 FCFA. Les clients achètent des crédits puis les consomment pour les fonctionnalités avancées (extraction BL, dictée vocale). Le coût réel de traitement est très faible — la différence est le bénéfice d\'Eolis.'
                : 'Eolis Connect bills clients in prepaid credits. 1 credit = 1 FCFA. Clients buy credits then consume them for advanced features (BL extraction, voice dictation). The actual processing cost is very low — the difference is Eolis\'s profit.'}
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-700 space-y-1">
              <p>Client recharge → 10 000 FCFA encaissés</p>
              <p>Client utilise BL extraction → 50 crédits consommés</p>
              <p>Coût traitement → ~0,60 FCFA</p>
              <p className="text-emerald-600 font-bold">Bénéfice sur cet usage → 49,40 FCFA (98,8% marge)</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <p className="font-bold text-emerald-700">📄 Extraction BL</p>
                <p className="text-gray-600 mt-1">Client : 50 crédits (50 FCFA)</p>
                <p className="text-gray-600">Traitement : ~0,60 FCFA</p>
                <p className="text-emerald-600 font-bold">Marge : ~98,8%</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="font-bold text-blue-700">🎙️ Dictée vocale</p>
                <p className="text-gray-600 mt-1">Client : 10 cr./min</p>
                <p className="text-gray-600">Traitement : ~3,60 FCFA/min</p>
                <p className="text-blue-600 font-bold">Marge : ~64%</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Dashboard — KPIs */}
        <Section icon={<BarChart2 size={16}/>} title={isFr ? 'Tableau de bord — Les KPIs' : 'Dashboard — KPIs'}>
          <div className="pt-4 space-y-3">
            <p className="text-xs text-gray-500 mb-2">{isFr ? 'Les 7 indicateurs clés affichés sur le dashboard :' : '7 key indicators shown on the dashboard:'}</p>
            <Kpi color="border-emerald-200 bg-emerald-50" label={isFr ? 'Revenus recharges' : 'Top-up revenue'}
              formula={isFr ? 'Somme des recharges approuvées' : 'Sum of approved top-ups'}
              desc={isFr ? 'L\'argent réellement encaissé sur la période. C\'est ton chiffre d\'affaires.' : 'Money actually collected in the period. This is your revenue.'} />
            <Kpi color="border-blue-200 bg-blue-50" label={isFr ? 'Prix client (crédits)' : 'Client price (credits)'}
              formula={isFr ? 'Somme des crédits consommés' : 'Sum of credits consumed'}
              desc={isFr ? 'Valeur en FCFA de tous les usages des clients. Peut différer des revenus si des clients ont des crédits non utilisés.' : 'FCFA value of all client usage. May differ from revenue if clients have unused credits.'} />
            <Kpi color="border-red-200 bg-red-50" label={isFr ? 'Coûts traitement' : 'Processing costs'}
              formula={isFr ? 'Calculé automatiquement à chaque opération' : 'Auto-calculated at every operation'}
              desc={isFr ? 'Ce que coûte réellement chaque opération. Très faible grâce au modèle par usage.' : 'What each operation actually costs. Very low thanks to the pay-per-use model.'} />
            <Kpi color="border-amber-200 bg-amber-50" label={isFr ? 'Charges infra' : 'Infra costs'}
              formula={isFr ? 'Saisie manuelle dans Charges infra' : 'Manually entered in Infra costs'}
              desc={isFr ? 'Vercel, Railway, Neon, AWS S3, Twilio, etc. À saisir chaque mois dans la page Charges infra.' : 'Vercel, Railway, Neon, AWS S3, Twilio, etc. Enter each month in the Infra costs page.'} />
            <Kpi color="border-blue-200 bg-blue-50" label={isFr ? 'Bénéfice sur usages' : 'Usage profit'}
              formula={isFr ? 'Crédits consommés − Coûts traitement' : 'Credits consumed − Processing costs'}
              desc={isFr ? 'La marge pure sur les traitements. C\'est ici que se trouve la vraie rentabilité d\'Eolis.' : 'The pure processing margin. This is where Eolis\'s real profitability lies.'} />
            <Kpi color="border-emerald-200 bg-emerald-50" label={isFr ? 'Bénéfice brut' : 'Gross profit'}
              formula={isFr ? 'Revenus − Coûts traitement' : 'Revenue − Processing costs'}
              desc={isFr ? 'Ce que tu gagnes après les coûts de traitement, avant les charges d\'infrastructure.' : 'What you earn after processing costs, before infrastructure costs.'} />
            <Kpi color="border-violet-200 bg-violet-50" label={isFr ? 'Bénéfice net ⭐' : 'Net profit ⭐'}
              formula={isFr ? 'Revenus − Coûts traitement − Charges infra' : 'Revenue − Processing costs − Infra'}
              desc={isFr ? 'Le plus important. Ce qui reste vraiment après TOUT. Vert = rentable. Rouge = à surveiller.' : 'The most important. What truly remains after EVERYTHING. Green = profitable. Red = watch out.'} />
          </div>
        </Section>

        {/* Alertes */}
        <Section icon={<AlertCircle size={16}/>} title={isFr ? 'Alertes automatiques' : 'Automatic alerts'}>
          <div className="pt-4 space-y-1">
            <Row icon={<Bell size={15}/>}
              title={isFr ? '💬 Demandes en attente' : '💬 Pending requests'}
              desc={isFr ? 'Des clients ont soumis une preuve de paiement. À traiter dans Validation crédits.' : 'Clients have submitted payment proof. Handle in Credit approval.'} />
            <Row icon={<AlertCircle size={15}/>}
              title={isFr ? '🚨 Bénéfice net négatif' : '🚨 Negative net profit'}
              desc={isFr ? 'Tu dépenses plus que tu n\'encaisses sur la période. Vérifier les charges infra ou augmenter les recharges.' : 'You\'re spending more than earning. Check infra costs or increase top-ups.'} />
            <Row icon={<AlertCircle size={15}/>}
              title={isFr ? '⚠️ Charges infra élevées' : '⚠️ High infra costs'}
              desc={isFr ? 'L\'infrastructure dépasse 30% des revenus. À surveiller : les coûts fixes ne doivent pas dépasser la croissance.' : 'Infrastructure exceeds 30% of revenue. Watch: fixed costs shouldn\'t outpace growth.'} />
            <Row icon={<CheckCircle size={15}/>}
              title={isFr ? '✅ Excellente marge' : '✅ Excellent margin'}
              desc={isFr ? 'Marge nette > 50%. Eolis est très rentable sur la période.' : 'Net margin > 50%. Eolis is very profitable in the period.'} />
          </div>
        </Section>

        {/* Validation crédits */}
        <Section icon={<Wallet size={16}/>} title={isFr ? 'Validation crédits — Comment ça marche' : 'Credit approval — How it works'}>
          <div className="pt-4 space-y-3">
            <p className="text-sm text-gray-600">
              {isFr ? 'Quand un client veut recharger, il transfère de l\'argent par Orange Money ou MTN Money, prend un screenshot du SMS de confirmation, et le soumet dans l\'application. Le FINANCE_AGENT vérifie la preuve et valide.' : 'When a client wants to top up, they transfer money via Orange Money or MTN Money, take a screenshot of the confirmation SMS, and submit it in the app. The FINANCE_AGENT verifies the proof and approves.'}
            </p>
            <div className="space-y-2 text-xs">
              {[
                { step: '1', label: isFr ? 'Client soumet preuve de paiement' : 'Client submits payment proof', color: 'bg-gray-100 text-gray-700' },
                { step: '2', label: isFr ? 'Tu reçois une notification' : 'You receive a notification', color: 'bg-blue-100 text-blue-700' },
                { step: '3', label: isFr ? 'Tu ouvres le justificatif (obligatoire)' : 'You open the proof (required)', color: 'bg-amber-100 text-amber-700' },
                { step: '4', label: isFr ? 'Tu entres le montant reçu (≤ montant déclaré)' : 'You enter amount received (≤ declared amount)', color: 'bg-amber-100 text-amber-700' },
                { step: '5a', label: isFr ? 'Si < 100 000 FCFA → crédités immédiatement' : 'If < 100,000 FCFA → credited immediately', color: 'bg-emerald-100 text-emerald-700' },
                { step: '5b', label: isFr ? 'Si ≥ 100 000 FCFA → en attente confirmation SYSTEM_ADMIN (principe 4 yeux)' : 'If ≥ 100,000 FCFA → pending SYSTEM_ADMIN confirmation (4-eyes principle)', color: 'bg-orange-100 text-orange-700' },
              ].map(s => (
                <div key={s.step} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${s.color}`}>
                  <span className="font-bold font-mono w-6 text-center">{s.step}</span>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
              <p className="font-bold mb-1">🔒 Règles de sécurité</p>
              <p>• Montant approuvé ≤ montant déclaré (impossible de gonfler)</p>
              <p>• Toute action est enregistrée dans le Journal d'audit avec ton IP</p>
              <p>• Connexion protégée par code SMS 2FA à chaque login</p>
            </div>
          </div>
        </Section>

        {/* Charges infra */}
        <Section icon={<Building2 size={16}/>} title={isFr ? 'Charges infrastructure — Comment saisir' : 'Infrastructure costs — How to enter'}>
          <div className="pt-4 space-y-3">
            <p className="text-sm text-gray-600">
              {isFr ? 'À chaque facture reçue (Vercel, Railway, Neon, etc.), tu la saisis manuellement pour qu\'elle apparaisse dans le P&L.' : 'Each time you receive an invoice (Vercel, Railway, Neon, etc.), you enter it manually so it appears in the P&L.'}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Vercel', isFr ? 'Hébergement frontend' : 'Frontend hosting'],
                ['Railway', isFr ? 'Hébergement API' : 'API hosting'],
                ['Neon (BDD)', isFr ? 'Base de données' : 'Database'],
                ['AWS S3', isFr ? 'Stockage fichiers' : 'File storage'],
                ['Twilio (SMS)', isFr ? 'OTP 2FA et SMS' : 'OTP 2FA and SMS'],
                ['Cloudflare', 'DNS / protection'],
              ].map(([cat, desc]) => (
                <div key={cat} className="bg-gray-50 rounded-xl p-2.5">
                  <p className="font-bold text-gray-800">{cat}</p>
                  <p className="text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              {isFr ? '💡 La période est au format YYYY-MM (ex: 2026-05). Saisis les charges du mois en cours dès que tu reçois les factures.' : '💡 Period format is YYYY-MM (e.g. 2026-05). Enter the current month\'s costs as soon as you receive invoices.'}
            </p>
          </div>
        </Section>

        {/* Rapport P&L */}
        <Section icon={<PieChart size={16}/>} title={isFr ? 'Rapport P&L — Profits & Pertes' : 'P&L Report — Profit & Loss'}>
          <div className="pt-4 space-y-3">
            <p className="text-sm text-gray-600">
              {isFr ? 'Le rapport P&L montre mois par mois tous les revenus, coûts et bénéfices. Tu peux filtrer par période, par urgence de dossier, et exporter en Excel.' : 'The P&L report shows revenue, costs and profits month by month. You can filter by period, ticket urgency, and export to Excel.'}
            </p>
            <Row icon={<TrendingUp size={15}/>}
              title={isFr ? 'Prévision mois prochain' : 'Next month forecast'}
              desc={isFr ? 'Calculée par régression linéaire sur les données historiques. Indicatif — basé sur la tendance actuelle.' : 'Calculated by linear regression on historical data. Indicative — based on current trend.'} />
            <Row icon={<FileSpreadsheet size={15}/>}
              title={isFr ? 'Export Excel (.xlsx)' : 'Excel export (.xlsx)'}
              desc={isFr ? 'Génère un fichier Excel formaté avec en-têtes colorés, chiffres alignés, ligne de totaux. Respecte les filtres actifs.' : 'Generates a formatted Excel file with colored headers, aligned numbers, totals row. Respects active filters.'} />
          </div>
        </Section>

        {/* Journal d'audit */}
        <Section icon={<ShieldCheck size={16}/>} title={isFr ? 'Journal d\'audit financier' : 'Financial audit log'}>
          <div className="pt-4 space-y-3">
            <p className="text-sm text-gray-600">
              {isFr ? 'Toutes les actions financières sont enregistrées de façon permanente et immuable : approbations, rejets, ajouts/suppressions de charges, confirmations admin.' : 'All financial actions are permanently and immutably recorded: approvals, rejections, cost additions/deletions, admin confirmations.'}
            </p>
            <div className="space-y-1 text-xs">
              {[
                { badge: 'bg-emerald-50 text-emerald-700', label: isFr ? 'Recharge approuvée' : 'Credit approved', desc: isFr ? 'Crédits ajoutés au client' : 'Credits added to client' },
                { badge: 'bg-red-50 text-red-700',         label: isFr ? 'Recharge refusée' : 'Credit rejected',  desc: isFr ? 'Demande rejetée avec motif' : 'Request rejected with reason' },
                { badge: 'bg-orange-50 text-orange-700',   label: isFr ? 'En attente admin' : 'Pending admin',    desc: isFr ? 'Montant ≥ 100 000 FCFA — attente SYSTEM_ADMIN' : 'Amount ≥ 100,000 FCFA — awaiting SYSTEM_ADMIN' },
                { badge: 'bg-emerald-50 text-emerald-700', label: isFr ? 'Confirmé admin' : 'Admin confirmed',    desc: isFr ? 'SYSTEM_ADMIN a validé la grosse recharge' : 'SYSTEM_ADMIN confirmed the large top-up' },
                { badge: 'bg-amber-50 text-amber-700',     label: isFr ? 'Charge ajoutée' : 'Cost added',         desc: isFr ? 'Nouvelle charge infra enregistrée' : 'New infra cost recorded' },
                { badge: 'bg-gray-100 text-gray-700',      label: isFr ? 'Charge supprimée' : 'Cost deleted',     desc: isFr ? 'Charge infra supprimée' : 'Infra cost deleted' },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${a.badge}`}>{a.label}</span>
                  <span className="text-gray-500">{a.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
              {isFr ? '🔒 Le journal est immuable — aucune entrée ne peut être modifiée ou supprimée. Les 200 dernières actions sont visibles.' : '🔒 The log is immutable — no entry can be modified or deleted. The last 200 actions are visible.'}
            </p>
          </div>
        </Section>

        {/* Taux de change */}
        <Section icon={<DollarSign size={16}/>} title={isFr ? 'Taux de change utilisés' : 'Exchange rates used'}>
          <div className="pt-4 space-y-2 text-sm text-gray-600">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="font-bold text-gray-900 text-lg">600</p>
                <p className="text-xs text-gray-500">FCFA = 1 USD</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Taux opérationnel Eolis</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="font-bold text-gray-900 text-lg">655,957</p>
                <p className="text-xs text-gray-500">FCFA = 1 EUR</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Taux fixe XAF/EUR officiel</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {isFr ? 'Ces taux sont fixes dans le système. Toutes les conversions affichées ($ · €) utilisent ces valeurs.' : 'These rates are fixed in the system. All displayed conversions ($ · €) use these values.'}
            </p>
          </div>
        </Section>

        {/* Contact support */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <Clock size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-500">
              {isFr ? 'Une question sur les données financières ou le fonctionnement de la plateforme ?' : 'A question about financial data or how the platform works?'}
            </p>
            <a href="mailto:support@eolisconnect.online"
              className="inline-block mt-1.5 text-sm font-semibold text-[#1B3A5C] underline underline-offset-2">
              support@eolisconnect.online
            </a>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
