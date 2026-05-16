'use client'

import {
  ComposedChart, Bar, Line,
  LineChart, PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface VolumePoint {
  date: string
  nouveaux: number
  highT: number
  mediumT: number
  lowT: number
}
interface UrgencyDetail {
  composite: number | null
  avgSat: number | null
  avgTime: number | null
  satScore: number | null
  speedScore: number | null
  slaScore: number | null
  firstRScore: number | null
  avgFirstR: number | null
  count: number
}
interface PerfPoint {
  date: string
  HIGH: number | null
  MEDIUM: number | null
  LOW: number | null
  highDetail: UrgencyDetail
  mediumDetail: UrgencyDetail
  lowDetail: UrgencyDetail
  totalCount: number
}
interface StatusPoint   { name: string; value: number; color: string }
interface CategoryPoint { name: string; value: number }

interface Props {
  volumeData:   VolumePoint[]
  perfData:     PerfPoint[]
  statusData:   StatusPoint[]
  categoryData: CategoryPoint[]
  locale:       string
}

const CATEGORY_COLORS = ['#1B3A5C', '#4A8FC4', '#10B981', '#F59E0B', '#8B5A2B', '#8B5CF6']

export default function OpsDashboardCharts({ volumeData, perfData, statusData, categoryData, locale }: Props) {
  const isFr    = locale === 'fr'
  const barSize = volumeData.length > 25 ? 5 : volumeData.length > 14 ? 9 : 18
  const hasPerf = perfData.some(p => p.HIGH !== null || p.MEDIUM !== null || p.LOW !== null)

  const L = {
    volume:      isFr ? 'Volume de dossiers'              : 'Ticket volume',
    nouveaux:    isFr ? 'Nouveaux'                        : 'New',
    highT:       isFr ? 'Traités HIGH'                   : 'Treated HIGH',
    mediumT:     isFr ? 'Traités MEDIUM'                 : 'Treated MEDIUM',
    lowT:        isFr ? 'Traités LOW'                    : 'Treated LOW',
    volumeSub:   isFr
      ? 'Barres = nouveaux tickets · Courbes = traités par urgence'
      : 'Bars = new tickets · Lines = treated by urgency',
    status:      isFr ? 'Répartition des statuts'        : 'Status breakdown',
    perf:        isFr ? 'Performance globale par urgence' : 'Global performance by urgency',
    perfSub:     isFr
      ? 'Score 0-100 : satisfaction(25%)⭐ + vitesse(25%)🏁 + SLA(30%)🎯 + 1ère réponse(20%)⚡'
      : 'Score 0-100: satisfaction(25%)⭐ + speed(25%)🏁 + SLA(30%)🎯 + first response(20%)⚡',
    perfEmpty:    isFr ? 'Pas encore de données de performance' : 'No performance data yet',
    category:     isFr ? 'Par catégorie'                  : 'By category',
    high:         isFr ? '🔴 Élevée'                      : '🔴 High',
    medium:       isFr ? '🟡 Moyenne'                     : '🟡 Medium',
    low:          isFr ? '🟢 Faible'                      : '🟢 Low',
    score:        'Score /100',
    totalT:       isFr ? 'Total traités'                  : 'Total treated',
    noDataShort:  isFr ? 'Pas de données'                 : 'No data',
  }

  function fmtH(h: number | null): string {
    if (h === null) return '—'
    if (h < 1) return `${Math.round(h * 60)}min`
    const hr = Math.floor(h); const mn = Math.round((h - hr) * 60)
    return mn > 0 ? `${hr}h ${mn}min` : `${hr}h`
  }

  function PerfTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    const d: PerfPoint = payload[0]?.payload
    const sections = [
      { det: d.highDetail,   emoji: '🔴', label: L.high,   scoreColor: 'text-red-600'     },
      { det: d.mediumDetail, emoji: '🟡', label: L.medium, scoreColor: 'text-amber-600'   },
      { det: d.lowDetail,    emoji: '🟢', label: L.low,    scoreColor: 'text-emerald-600' },
    ]
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[230px]">
        <p className="font-bold text-gray-800 mb-1">{label}</p>
        <p className="text-[10px] text-gray-400 mb-3 pb-2 border-b border-gray-100">
          {L.totalT}: <span className="font-semibold text-gray-600">{d.totalCount}</span>
        </p>
        {sections.map(({ det, emoji, label: uLabel, scoreColor }, i) => (
          <div key={i} className={`${i < sections.length - 1 ? 'mb-2.5 pb-2.5 border-b border-gray-100' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`font-semibold text-[11px] ${scoreColor}`}>{emoji} {uLabel} <span className="text-gray-400 font-normal">({det.count})</span></span>
              {det.composite !== null
                ? <span className="font-black text-gray-800">{det.composite}<span className="text-gray-400 font-normal text-[10px]">/100</span></span>
                : <span className="text-gray-300 text-[10px]">{isFr ? 'Pas de données' : 'No data'}</span>
              }
            </div>
            {det.count > 0 && (
              <div className="space-y-0.5 pl-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">⭐ {isFr ? 'Satisfaction' : 'Satisfaction'}</span>
                  <span className="text-gray-600">
                    {det.avgSat !== null ? `${det.avgSat}/5` : '—'}
                    {det.satScore !== null && <span className="text-gray-400 ml-1">→ {det.satScore}pts</span>}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">🏁 {isFr ? 'Délai moy.' : 'Avg time'}</span>
                  <span className="text-gray-600">
                    {fmtH(det.avgTime)}
                    {det.speedScore !== null && <span className="text-gray-400 ml-1">→ {det.speedScore}pts</span>}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">🎯 SLA %</span>
                  <span className="text-gray-600">
                    {det.slaScore !== null ? `${det.slaScore}%` : '—'}
                    {det.slaScore !== null && <span className="text-gray-400 ml-1">→ {det.slaScore}pts</span>}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">⚡ {isFr ? '1ère réponse' : '1st response'}</span>
                  <span className="text-gray-600">
                    {fmtH(det.avgFirstR)}
                    {det.firstRScore !== null && <span className="text-gray-400 ml-1">→ {det.firstRScore}pts</span>}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  function VolumeTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
        <p className="font-bold text-gray-700 mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex justify-between mb-0.5" style={{ color: p.color }}>
            <span>{p.name}</span>
            <span className="font-semibold ml-4">{p.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">

      {/* Volume (2 cols) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{L.volume}</h3>
        <p className="text-xs text-gray-400 mb-4">{L.volumeSub}</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={volumeData} barSize={barSize}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<VolumeTooltip />} />
            <Bar  dataKey="nouveaux" name={L.nouveaux} fill="#4A8FC4" radius={[3, 3, 0, 0]} opacity={0.8} />
            <Line dataKey="highT"   name={L.highT}   stroke="#EF4444" strokeWidth={1.5} dot={false} type="monotone" connectNulls />
            <Line dataKey="mediumT" name={L.mediumT} stroke="#F59E0B" strokeWidth={1.5} dot={false} type="monotone" connectNulls />
            <Line dataKey="lowT"    name={L.lowT}    stroke="#10B981" strokeWidth={1.5} dot={false} type="monotone" connectNulls />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Status donut (1 col) */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{L.status}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={statusData} cx="50%" cy="45%" innerRadius={55} outerRadius={82} paddingAngle={3} dataKey="value">
              {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Performance trend — 3 urgency lines (2 cols) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <div className="flex items-start justify-between mb-0.5">
          <h3 className="text-sm font-semibold text-gray-900">{L.perf}</h3>
          <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 whitespace-nowrap">{L.score}</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">{L.perfSub}</p>
        {hasPerf ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={perfData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<PerfTooltip />} />
              <Line dataKey="HIGH"   name={L.high}   stroke="#EF4444" strokeWidth={2} dot={{ r: 3, fill: '#EF4444', strokeWidth: 0 }} activeDot={{ r: 5 }} type="monotone" connectNulls />
              <Line dataKey="MEDIUM" name={L.medium} stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: '#F59E0B', strokeWidth: 0 }} activeDot={{ r: 5 }} type="monotone" connectNulls />
              <Line dataKey="LOW"    name={L.low}    stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 5 }} type="monotone" connectNulls />
              <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex flex-col items-center justify-center gap-3 text-gray-300">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <p className="text-sm text-gray-400">{L.perfEmpty}</p>
          </div>
        )}
      </div>

      {/* Category pie (1 col) */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{L.category}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={categoryData} cx="50%" cy="45%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
              {categoryData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
