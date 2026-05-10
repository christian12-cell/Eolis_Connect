'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface CountryCode {
  code: string   // e.g. "+237"
  flag: string
  name: string
  iso: string
}

// Most used countries — Cameroon default
const COUNTRIES: CountryCode[] = [
  { code: '+237', flag: '🇨🇲', name: 'Cameroun',          iso: 'CM' },
  { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire",     iso: 'CI' },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal',           iso: 'SN' },
  { code: '+223', flag: '🇲🇱', name: 'Mali',              iso: 'ML' },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso',      iso: 'BF' },
  { code: '+227', flag: '🇳🇪', name: 'Niger',             iso: 'NE' },
  { code: '+228', flag: '🇹🇬', name: 'Togo',              iso: 'TG' },
  { code: '+229', flag: '🇧🇯', name: 'Bénin',             iso: 'BJ' },
  { code: '+241', flag: '🇬🇦', name: 'Gabon',             iso: 'GA' },
  { code: '+242', flag: '🇨🇬', name: 'Congo',             iso: 'CG' },
  { code: '+243', flag: '🇨🇩', name: 'RD Congo',          iso: 'CD' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria',           iso: 'NG' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana',             iso: 'GH' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya',             iso: 'KE' },
  { code: '+255', flag: '🇹🇿', name: 'Tanzanie',          iso: 'TZ' },
  { code: '+256', flag: '🇺🇬', name: 'Ouganda',           iso: 'UG' },
  { code: '+27',  flag: '🇿🇦', name: 'Afrique du Sud',    iso: 'ZA' },
  { code: '+212', flag: '🇲🇦', name: 'Maroc',             iso: 'MA' },
  { code: '+213', flag: '🇩🇿', name: 'Algérie',           iso: 'DZ' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisie',           iso: 'TN' },
  { code: '+20',  flag: '🇪🇬', name: 'Égypte',            iso: 'EG' },
  { code: '+33',  flag: '🇫🇷', name: 'France',            iso: 'FR' },
  { code: '+32',  flag: '🇧🇪', name: 'Belgique',          iso: 'BE' },
  { code: '+41',  flag: '🇨🇭', name: 'Suisse',            iso: 'CH' },
  { code: '+44',  flag: '🇬🇧', name: 'Royaume-Uni',       iso: 'GB' },
  { code: '+1',   flag: '🇺🇸', name: 'États-Unis / Canada', iso: 'US' },
  { code: '+49',  flag: '🇩🇪', name: 'Allemagne',         iso: 'DE' },
  { code: '+39',  flag: '🇮🇹', name: 'Italie',            iso: 'IT' },
  { code: '+34',  flag: '🇪🇸', name: 'Espagne',           iso: 'ES' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal',          iso: 'PT' },
  { code: '+86',  flag: '🇨🇳', name: 'Chine',             iso: 'CN' },
  { code: '+91',  flag: '🇮🇳', name: 'Inde',              iso: 'IN' },
  { code: '+971', flag: '🇦🇪', name: 'Émirats arabes',    iso: 'AE' },
]

interface Props {
  value: string           // full international number e.g. "+237612345678"
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  inputClassName?: string
}

function parsePhone(full: string): { dialCode: string; local: string } {
  for (const c of [...COUNTRIES].sort((a, b) => b.code.length - a.code.length)) {
    if (full.startsWith(c.code)) {
      return { dialCode: c.code, local: full.slice(c.code.length) }
    }
  }
  return { dialCode: '+237', local: full.replace(/^\+\d+/, '') }
}

export function PhoneInput({ value, onChange, placeholder = '6XX XXX XXX', required, className = '', inputClassName = '' }: Props) {
  const { dialCode: initDial, local: initLocal } = parsePhone(value)
  const [dialCode, setDialCode] = useState(initDial)
  const [local, setLocal]       = useState(initLocal)
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState('')
  const dropRef = useRef<HTMLDivElement>(null)

  // Sync when value changes externally
  useEffect(() => {
    const { dialCode: d, local: l } = parsePhone(value)
    setDialCode(d)
    setLocal(l)
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function selectCountry(c: CountryCode) {
    setDialCode(c.code)
    setOpen(false)
    setSearch('')
    onChange(c.code + local.replace(/\s/g, ''))
  }

  function handleLocal(v: string) {
    const clean = v.replace(/[^\d\s]/g, '')
    setLocal(clean)
    onChange(dialCode + clean.replace(/\s/g, ''))
  }

  const selected = COUNTRIES.find(c => c.code === dialCode) ?? COUNTRIES[0]
  const filtered = COUNTRIES.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)
  )

  return (
    <div className={`flex gap-0 ${className}`} ref={dropRef}>
      {/* Dial code selector */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          className={`flex items-center gap-1.5 h-full px-3 rounded-l-xl border border-r-0 border-gray-200 bg-white text-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent ${inputClassName}`}
          style={{ borderRight: 'none' }}
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <span className="font-medium text-gray-700 text-xs">{selected.code}</span>
          <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] bg-gray-50"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {filtered.map(c => (
                <li key={c.iso}>
                  <button
                    type="button"
                    onClick={() => selectCountry(c)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left ${c.code === dialCode ? 'bg-[#EDF1F7] font-semibold' : ''}`}
                  >
                    <span className="text-base">{c.flag}</span>
                    <span className="flex-1 truncate text-gray-700 text-xs">{c.name}</span>
                    <span className="text-gray-400 text-xs font-mono flex-shrink-0">{c.code}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-xs text-gray-400 text-center">Aucun résultat</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Local number input */}
      <input
        type="tel"
        value={local}
        onChange={e => handleLocal(e.target.value)}
        placeholder={placeholder}
        required={required}
        inputMode="numeric"
        className={`flex-1 min-w-0 px-3 py-2.5 rounded-r-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent bg-white ${inputClassName}`}
      />
    </div>
  )
}
