'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type FilterMode = 'day' | 'week' | 'month' | 'year' | 'all'

export interface DateRange {
  from: string   // YYYY-MM-DD
  to: string     // YYYY-MM-DD
}

interface PeriodFilterProps {
  onChange: (range: DateRange | null, label: string) => void
  isFr: boolean
  dark?: boolean  // true = white text (mobile), false = dark text (desktop)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

function getWeeks(year: number, month: number): { start: number; end: number }[] {
  const total = daysInMonth(year, month)
  const weeks: { start: number; end: number }[] = []
  let s = 1
  while (s <= total) {
    weeks.push({ start: s, end: Math.min(s + 6, total) })
    s += 7
  }
  return weeks
}

const MONTH_NAMES_FR = ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LONG_FR  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTH_LONG_EN  = ['January','February','March','April','May','June','July','August','September','October','November','December']

function monthName(m: number, long: boolean, isFr: boolean): string {
  const arr = isFr ? (long ? MONTH_LONG_FR : MONTH_NAMES_FR) : (long ? MONTH_LONG_EN : MONTH_NAMES_EN)
  return arr[m - 1] ?? ''
}

function availableYears(): number[] {
  const y = new Date().getFullYear()
  return [y - 1, y, y + 1].filter(x => x >= 2025)
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PeriodFilter({ onChange, isFr, dark = false }: PeriodFilterProps) {
  const now = new Date()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<FilterMode>('month')
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [label, setLabel] = useState(isFr ? 'Ce mois' : 'This month')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Emit on mode=all immediately
  function selectAll() {
    const lbl = isFr ? 'Toute la période' : 'All time'
    setLabel(lbl)
    onChange(null, lbl)
    setOpen(false)
  }

  function selectDay(day: number) {
    const lbl = `${day} ${monthName(month, false, isFr)} ${year}`
    setLabel(lbl)
    const iso = toISO(year, month, day)
    onChange({ from: iso, to: iso }, lbl)
    setOpen(false)
  }

  function selectWeek(start: number, end: number) {
    const mn = monthName(month, false, isFr)
    const lbl = `${mn} ${start}–${end} ${year}`
    setLabel(lbl)
    onChange({ from: toISO(year, month, start), to: toISO(year, month, end) }, lbl)
    setOpen(false)
  }

  function selectMonth(m: number) {
    const last = daysInMonth(year, m)
    const lbl = `${monthName(m, true, isFr)} ${year}`
    setLabel(lbl)
    onChange({ from: toISO(year, m, 1), to: toISO(year, m, last) }, lbl)
    setOpen(false)
  }

  function selectYear(y: number) {
    const lbl = String(y)
    setLabel(lbl)
    onChange({ from: `${y}-01-01`, to: `${y}-12-31` }, lbl)
    setOpen(false)
  }

  // Init: emit current month on mount
  useEffect(() => {
    const last = daysInMonth(now.getFullYear(), now.getMonth() + 1)
    const lbl = isFr ? 'Ce mois' : 'This month'
    onChange(
      { from: toISO(now.getFullYear(), now.getMonth() + 1, 1), to: toISO(now.getFullYear(), now.getMonth() + 1, last) },
      lbl
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const txt = dark ? 'text-white' : 'text-[#1B3A5C]'
  const bg  = dark ? 'bg-white/15 border-white/25 text-white' : 'bg-white border-gray-200 text-gray-800'
  const panelBg = 'bg-white'
  const weeks = getWeeks(year, month)
  const totalDays = daysInMonth(year, month)

  const MODE_LABELS: Record<FilterMode, string> = {
    day:   isFr ? 'Jour'    : 'Day',
    week:  isFr ? 'Semaine' : 'Week',
    month: isFr ? 'Mois'    : 'Month',
    year:  isFr ? 'Année'   : 'Year',
    all:   isFr ? 'Tout'    : 'All',
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${bg}`}>
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={`absolute top-full mt-2 right-0 z-50 ${panelBg} rounded-2xl shadow-2xl border border-gray-100 p-4 min-w-[300px]`}>

          {/* Mode selector */}
          <div className="flex gap-1 mb-4 flex-wrap">
            {(Object.keys(MODE_LABELS) as FilterMode[]).map(m => (
              <button key={m}
                onClick={() => { if (m === 'all') { selectAll(); } else { setMode(m); } }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mode === m && m !== 'all'
                    ? 'bg-[#1B3A5C] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Year + Month pickers (shown for day/week/month) */}
          {(mode === 'day' || mode === 'week' || mode === 'month') && (
            <div className="flex gap-2 mb-4">
              {/* Year */}
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="flex-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#1B3A5C]">
                {availableYears().map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {/* Month (not shown in year mode) */}
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="flex-1 px-2.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#1B3A5C]">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{monthName(m, true, isFr)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Year only picker */}
          {mode === 'year' && (
            <div className="flex gap-2 flex-wrap mb-2">
              {availableYears().map(y => (
                <button key={y} onClick={() => selectYear(y)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gray-100 hover:bg-[#1B3A5C] hover:text-white transition-all">
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* Day grid */}
          {mode === 'day' && (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
                <button key={d} onClick={() => selectDay(d)}
                  className="aspect-square rounded-lg text-xs font-semibold text-gray-700 hover:bg-[#1B3A5C] hover:text-white transition-all">
                  {d}
                </button>
              ))}
            </div>
          )}

          {/* Week list */}
          {mode === 'week' && (
            <div className="space-y-1.5">
              {weeks.map((w, i) => {
                const mn = monthName(month, false, isFr)
                return (
                  <button key={i} onClick={() => selectWeek(w.start, w.end)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-[#1B3A5C] hover:text-white transition-all">
                    <span>{isFr ? `Semaine ${i + 1}` : `Week ${i + 1}`}</span>
                    <span className="text-xs font-mono">{mn} {w.start}–{w.end}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Month grid */}
          {mode === 'month' && (
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <button key={m} onClick={() => selectMonth(m)}
                  className="py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-[#1B3A5C] hover:text-white transition-all">
                  {monthName(m, false, isFr)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
