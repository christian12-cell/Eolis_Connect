'use client'

import { useState } from 'react'
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
interface ScorePoint {
  date: string
  composite:   number | null
  satScore:    number | null
  speedScore:  number | null
  slaScore:    number | null
  firstRScore: number | null
}

interface Props {
  trendData:     TrendPoint[]
  urgencyData:   UrgencyPoint[]
  scoreEvolution: { points: ScorePoint[]; granularity: 'day' | 'week' | 'month' }
  locale:        string
}

const CURVES = [
  { key: 'composite',   color: '#1B3A5C', dashed: false, labelFr: 'Score composite',       labelEn: 'Composite score',       descFr: 'Moyenne pondérée des 4 critères (sat 25%, vitesse 25%, SLA 30%, 1ère réponse 20%)', descEn: 'Weighted avg of 4 criteria (sat 25%, speed 25%, SLA 30%, first response 20%)' },
  { key: 'satScore',    color: '#F59E0B', dashed: true,  labelFr: 'Satisfaction (/100)',    labelEn: 'Satisfaction (/100)',    descFr: 'Note client convertie en /100 (5★ = 100)', descEn: 'Client rating converted to /100 (5★ = 100)' },
  { key: 'speedScore',  color: '#3B82F6', dashed: true,  labelFr: 'Vitesse résolution',    labelEn: 'Resolution speed',       descFr: 'Score basé sur le temps de résolution vs cible SLA par urgence', descEn: 'Score based on resolution time vs SLA target per urgency' },
  { key: 'slaScore',    color: '#10B981', dashed: true,  labelFr: 'Respect SLA',           labelEn: 'SLA compliance',         descFr: '% de dossiers clôturés dans les délais SLA', descEn: '% of tickets closed within SLA deadlines' },
  { key: 'firstRScore', color: '#8B5CF6', dashed: true,  labelFr: '1ère réponse',          labelEn: 'First response',         descFr: 'Score basé sur le délai de 1ère réponse vs cible (SLA/3)', descEn: 'Score based on first response time vs target (SLA/3)' },
] as const

export default function AgentPerformanceCharts({ trendData, urgencyData, scoreEvolution, locale }: Props) {
  const isFr     = locale === 'fr'
  const hasTrend = trendData.some(p => p.count > 0)
  const hasUrg   = urgencyData.some(u => u.value > 0)

  const [visible, setVisible] = useState<Record<string, boolean>>({
    composite: true, satScore: false, speedScore: false, slaScore: false, firstRScore: false,
  })

  const { points: evPoints, granularity } = scoreEvolution
  const hasEvolution = evPoints.some(p => p.composite !== null)

  const granLabel = isFr
    ? (granularity === 'day' ? 'par jour' : granularity === 'week' ? 'par semaine' : 'par mois')
    : (granularity === 'day' ? 'by day'   : granularity === 'week' ? 'by week'     : 'by month')

  const L = {
    treated:   isFr ? 'Dossiers traités'          : 'Treated tickets',
    sat:       isFr ? 'Satisfaction moy. (/5)'    : 'Avg satisfaction (/5)',
    time:      isFr ? 'Délai résolution moy. (h)' : 'Avg resolution (h)',
    urgency:   isFr ? 'Répartition par urgence'   : 'Urgency breakdown',
    count:     isFr ? 'Dossiers'                  : 'Tickets',
    satLabel:  isFr ? 'Satisfaction'              : 'Satisfaction',
    timeLabel: isFr ? 'Délai moy.'                : 'Avg time',
    empty:     isFr ? 'Pas de données'            : 'No data',
    scoreTitle: isFr ? 'Évolution du score (/100)' : 'Score evolution (/100)',
    clickLegend: isFr ? 'Cliquez sur la légende pour afficher les sous-scores'
                      : 'Click the legend to show sub-scores',
  }

  function ScoreTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    const d: ScorePoint = payload[0]?.payload
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[220px]">
        <p className="font-bold text-gray-700 mb-2">{label}</p>
        {CURVES.map(c => {
          const val = d[c.key as keyof ScorePoint]
          if (val === null || val === undefined) return null
          return (
            <div key={c.key} className="mt-1.5">
              <div className="flex items-center justify-between gap-4">
                <span style={{ color: c.color }} className="font-semibold flex items-center gap-1">
                  {c.dashed && <span style={{ borderTop: `2px dashed ${c.color}`, width: 12, display: 'inline-block', verticalAlign: 'middle' }} />}
                  {!c.dashed && <span style={{ borderTop: `2px solid ${c.color}`, width: 12, display: 'inline-block', verticalAlign: 'middle' }} />}
                  {isFr ? c.labelFr : c.labelEn}
                </span>
                <span className="font-bold text-gray-800">{typeof val === 'number' ? +val.toFixed(2) : val}/100</span>
              </div>
              <p className="text-gray-400 text-[10px] mt-0.5 leading-snug">{isFr ? c.descFr : c.descEn}</p>
            </div>
          )
        })}
      </div>
    )
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
    <div className="space-y-4">

      {/* ── Score evolution (full width) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{L.scoreTitle}</h3>
          <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-lg">
            {granLabel} · {L.clickLegend}
          </span>
        </div>

        {/* Clickable legend */}
        <div className="flex flex-wrap gap-3 mb-4 mt-2">
          {CURVES.map(c => (
            <button key={c.key}
              onClick={() => setVisible(v => ({ ...v, [c.key]: !v[c.key] }))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                visible[c.key]
                  ? 'border-transparent text-white'
                  : 'border-gray-200 text-gray-400 bg-gray-50'
              }`}
              style={visible[c.key] ? { backgroundColor: c.color } : {}}>
              {c.dashed
                ? <span style={{ borderTop: `2px dashed ${visible[c.key] ? '#fff' : c.color}`, width: 14, display: 'inline-block', verticalAlign: 'middle' }} />
                : <span style={{ borderTop: `2.5px solid ${visible[c.key] ? '#fff' : c.color}`, width: 14, display: 'inline-block', verticalAlign: 'middle' }} />
              }
              {isFr ? c.labelFr : c.labelEn}
            </button>
          ))}
        </div>

        {hasEvolution ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={evPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} ticks={[0,25,50,75,100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ScoreTooltip />} />
              {CURVES.map(c => visible[c.key] && (
                <Line key={c.key} dataKey={c.key} stroke={c.color}
                  strokeWidth={c.dashed ? 1.5 : 3}
                  strokeDasharray={c.dashed ? '5 4' : undefined}
                  dot={{ r: 3, fill: c.color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  type="monotone" connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : chartEmpty}
      </div>

      {/* ── Existing charts grid ── */}
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
    </div>
  )
}
