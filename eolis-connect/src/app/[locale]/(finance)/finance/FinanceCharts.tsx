'use client'

import {
  ComposedChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
  ReferenceLine,
} from 'recharts'

const EUR = 655.957; const USD = 600
function f2(n: number) { return n.toFixed(2) }
function toUsd(f: number) { return (f/USD).toFixed(2) }
function toEur(f: number) { return (f/EUR).toFixed(2) }

interface PnlRow {
  month: string
  revenue: number
  aiCost: number
  infraCost: number
  totalCost: number
  grossProfit: number
  netProfit: number
  credits: number
  marginPct: number | null
}

interface Props {
  rows: PnlRow[]
  isFr: boolean
}

function CustomTooltip({ active, payload, label, isFr }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[200px]">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-1">
          <span style={{color: p.color}} className="font-medium">{p.name}</span>
          <span className="font-bold text-gray-700">
            {f2(p.value)} FCFA
            <span className="text-gray-400 ml-1 font-normal">(${toUsd(p.value)}·€{toEur(p.value)})</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function MarginTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const row: PnlRow = payload[0]?.payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[180px]">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      <div className="flex justify-between gap-3 mb-1">
        <span className="text-emerald-600 font-medium">Revenus</span>
        <span className="font-bold">{f2(row.revenue)} FCFA</span>
      </div>
      <div className="flex justify-between gap-3 mb-1">
        <span className="text-red-500 font-medium">Coûts totaux</span>
        <span className="font-bold">{f2(row.totalCost)} FCFA</span>
      </div>
      <div className="flex justify-between gap-3 border-t border-gray-100 pt-1 mt-1">
        <span className={row.netProfit >= 0 ? 'text-violet-600 font-bold' : 'text-red-600 font-bold'}>Bénéfice net</span>
        <span className={`font-bold ${row.netProfit >= 0 ? 'text-violet-600' : 'text-red-600'}`}>{f2(row.netProfit)} FCFA</span>
      </div>
      {row.marginPct !== null && (
        <div className="flex justify-between gap-3 mt-0.5">
          <span className="text-gray-400">Marge</span>
          <span className={`font-bold ${row.marginPct >= 50 ? 'text-emerald-600' : row.marginPct >= 0 ? 'text-amber-600' : 'text-red-500'}`}>{row.marginPct}%</span>
        </div>
      )}
    </div>
  )
}

export default function FinanceCharts({ rows, isFr }: Props) {
  if (!rows.length) return null

  const L = {
    revenue:    isFr ? 'Revenus' : 'Revenue',
    aiCost:     isFr ? 'Coûts IA' : 'AI costs',
    infraCost:  isFr ? 'Charges infra' : 'Infra costs',
    netProfit:  isFr ? 'Bénéfice net' : 'Net profit',
    grossProfit:isFr ? 'Bénéfice brut' : 'Gross profit',
    credits:    isFr ? 'Prix client (crédits)' : 'Client price',
    margin:     isFr ? 'Marge %' : 'Margin %',
    trendTitle: isFr ? 'Évolution revenus & coûts' : 'Revenue & costs trend',
    pnlTitle:   isFr ? 'Bénéfice net par mois' : 'Net profit per month',
    structTitle:isFr ? 'Structure des coûts' : 'Cost structure',
    marginTitle:isFr ? 'Taux de marge mensuel' : 'Monthly margin rate',
  }

  const chartStyle = { fontSize: 11, fill: '#9ab0c4' }

  return (
    <div className="space-y-5">

      {/* ── Chart 1: Revenue + Costs trend (area + line) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-bold text-gray-900 mb-4">{L.trendTitle}</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
            <XAxis dataKey="month" tick={chartStyle} />
            <YAxis tick={chartStyle} width={60} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<CustomTooltip isFr={isFr} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="revenue"   name={L.revenue}   stroke="#22c55e" fill="url(#revGrad)"  strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="totalCost" name={isFr ? 'Coûts totaux' : 'Total costs'} stroke="#ef4444" fill="url(#costGrad)" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
            <Line  type="monotone" dataKey="credits"  name={L.credits}   stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Chart 2: Net profit bar + Margin line ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-bold text-gray-900 mb-4">{L.pnlTitle}</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
            <XAxis dataKey="month" tick={chartStyle} />
            <YAxis yAxisId="left"  tick={chartStyle} width={60} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <YAxis yAxisId="right" orientation="right" tick={chartStyle} unit="%" width={40} />
            <Tooltip content={<MarginTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine yAxisId="left" y={0} stroke="#e2e8f0" />
            <Bar yAxisId="left" dataKey="netProfit" name={L.netProfit} radius={[4, 4, 0, 0]}>
              {rows.map((r, i) => <Cell key={i} fill={r.netProfit >= 0 ? '#8b5cf6' : '#ef4444'} />)}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="marginPct" name={L.margin} stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
