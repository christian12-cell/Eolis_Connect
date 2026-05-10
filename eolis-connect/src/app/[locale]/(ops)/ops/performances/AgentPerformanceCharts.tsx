'use client'

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface TrendPoint {
  date: string
  count: number
  avgSat: number | null
  avgTime: number | null
}
interface UrgencyPoint { name: string; value: number; color: string }

interface Props {
  trendData:   TrendPoint[]
  urgencyData: UrgencyPoint[]
  locale:      string
}

export default function AgentPerformanceCharts({ trendData, urgencyData, locale }: Props) {
  const isFr     = locale === 'fr'
  const hasTrend = trendData.some(p => p.count > 0)
  const hasUrg   = urgencyData.some(u => u.value > 0)

  const L = {
    treated:   isFr ? 'Dossiers traités'          : 'Treated tickets',
    sat:       isFr ? 'Satisfaction moy. (/5)'    : 'Avg satisfaction (/5)',
    time:      isFr ? 'Délai résolution moy. (h)' : 'Avg resolution (h)',
    urgency:   isFr ? 'Répartition par urgence'   : 'Urgency breakdown',
    count:     isFr ? 'Dossiers'                  : 'Tickets',
    satLabel:  isFr ? 'Satisfaction'              : 'Satisfaction',
    timeLabel: isFr ? 'Délai moy.'                : 'Avg time',
    empty:     isFr ? 'Pas de données'            : 'No data',
  }

  function TreatedTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    const d: TrendPoint = payload[0]?.payload
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[150px]">
        <p className="font-bold text-gray-700 mb-2">{label}</p>
        <p className="text-[#1B3A5C]">{L.count}: <span className="font-bold">{d.count}</span></p>
        {d.avgSat  !== null && <p className="text-amber-500 mt-1">⭐ {L.satLabel}: <span className="font-bold">{d.avgSat}/5</span></p>}
        {d.avgTime !== null && <p className="text-blue-500 mt-1">⏱ {L.timeLabel}: <span className="font-bold">{d.avgTime}h</span></p>}
      </div>
    )
  }

  const chartEmpty = (
    <div className="h-[190px] flex items-center justify-center text-gray-300 text-sm">{L.empty}</div>
  )

  return (
    <div className="grid lg:grid-cols-3 gap-4">

      {/* Dossiers traités */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{L.treated}</h3>
        {hasTrend ? (
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<TreatedTooltip />} />
              <Line dataKey="count" name={L.count} stroke="#1B3A5C" strokeWidth={2}
                dot={{ r: 3, fill: '#1B3A5C', strokeWidth: 0 }} activeDot={{ r: 5 }} type="monotone" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : chartEmpty}
      </div>

      {/* Satisfaction trend */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{L.sat}</h3>
        {hasTrend ? (
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 5]} ticks={[0,1,2,3,4,5]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`${v}/5`, L.satLabel]} />
              <Line dataKey="avgSat" name={L.satLabel} stroke="#F59E0B" strokeWidth={2}
                dot={{ r: 3, fill: '#F59E0B', strokeWidth: 0 }} activeDot={{ r: 5 }} type="monotone" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : chartEmpty}
      </div>

      {/* Urgency breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{L.urgency}</h3>
        {hasUrg ? (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={urgencyData} barSize={38}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="value" name={L.count} radius={[4, 4, 0, 0]}>
                {urgencyData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : chartEmpty}
      </div>

      {/* Resolution time trend (full width) */}
      <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">{L.time}</h3>
        {hasTrend ? (
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`${v}h`, L.timeLabel]} />
              <Line dataKey="avgTime" name={L.timeLabel} stroke="#3B82F6" strokeWidth={2}
                dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }} activeDot={{ r: 5 }} type="monotone" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : chartEmpty}
      </div>

    </div>
  )
}
