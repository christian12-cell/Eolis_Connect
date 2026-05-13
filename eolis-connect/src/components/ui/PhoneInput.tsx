'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'

interface CountryCode {
  code: string
  flag: string
  name: string
  iso: string
  min: number  // min local digits
  max: number  // max local digits
}

// 9 Eolis locations — always shown first
const EOLIS_COUNTRIES: CountryCode[] = [
  { code: '+237', flag: '🇨🇲', name: 'Cameroun',        iso: 'CM', min: 9,  max: 9  },
  { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire",   iso: 'CI', min: 10, max: 10 },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal',         iso: 'SN', min: 9,  max: 9  },
  { code: '+233', flag: '🇬🇭', name: 'Ghana',           iso: 'GH', min: 9,  max: 9  },
  { code: '+212', flag: '🇲🇦', name: 'Maroc',           iso: 'MA', min: 9,  max: 9  },
  { code: '+32',  flag: '🇧🇪', name: 'Belgique',        iso: 'BE', min: 8,  max: 9  },
  { code: '+33',  flag: '🇫🇷', name: 'France',          iso: 'FR', min: 9,  max: 9  },
  { code: '+39',  flag: '🇮🇹', name: 'Italie',          iso: 'IT', min: 9,  max: 10 },
  { code: '+44',  flag: '🇬🇧', name: 'Royaume-Uni',     iso: 'GB', min: 10, max: 10 },
]

const OTHER_COUNTRIES: CountryCode[] = [
  { code: '+223', flag: '🇲🇱', name: 'Mali',              iso: 'ML', min: 8, max: 8  },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso',      iso: 'BF', min: 8, max: 8  },
  { code: '+227', flag: '🇳🇪', name: 'Niger',             iso: 'NE', min: 8, max: 8  },
  { code: '+228', flag: '🇹🇬', name: 'Togo',              iso: 'TG', min: 8, max: 8  },
  { code: '+229', flag: '🇧🇯', name: 'Bénin',             iso: 'BJ', min: 8, max: 8  },
  { code: '+241', flag: '🇬🇦', name: 'Gabon',             iso: 'GA', min: 7, max: 7  },
  { code: '+242', flag: '🇨🇬', name: 'Congo',             iso: 'CG', min: 9, max: 9  },
  { code: '+243', flag: '🇨🇩', name: 'RD Congo',          iso: 'CD', min: 9, max: 9  },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria',           iso: 'NG', min: 10, max: 10 },
  { code: '+254', flag: '🇰🇪', name: 'Kenya',             iso: 'KE', min: 9, max: 9  },
  { code: '+255', flag: '🇹🇿', name: 'Tanzanie',          iso: 'TZ', min: 9, max: 9  },
  { code: '+256', flag: '🇺🇬', name: 'Ouganda',           iso: 'UG', min: 9, max: 9  },
  { code: '+27',  flag: '🇿🇦', name: 'Afrique du Sud',    iso: 'ZA', min: 9, max: 9  },
  { code: '+213', flag: '🇩🇿', name: 'Algérie',           iso: 'DZ', min: 9, max: 9  },
  { code: '+216', flag: '🇹🇳', name: 'Tunisie',           iso: 'TN', min: 8, max: 8  },
  { code: '+20',  flag: '🇪🇬', name: 'Égypte',            iso: 'EG', min: 10, max: 10 },
  { code: '+41',  flag: '🇨🇭', name: 'Suisse',            iso: 'CH', min: 9, max: 9  },
  { code: '+34',  flag: '🇪🇸', name: 'Espagne',           iso: 'ES', min: 9, max: 9  },
  { code: '+351', flag: '🇵🇹', name: 'Portugal',          iso: 'PT', min: 9, max: 9  },
  { code: '+49',  flag: '🇩🇪', name: 'Allemagne',         iso: 'DE', min: 10, max: 11 },
  { code: '+1',   flag: '🇺🇸', name: 'États-Unis / Canada', iso: 'US', min: 10, max: 10 },
  { code: '+86',  flag: '🇨🇳', name: 'Chine',             iso: 'CN', min: 11, max: 11 },
  { code: '+91',  flag: '🇮🇳', name: 'Inde',              iso: 'IN', min: 10, max: 10 },
  { code: '+971', flag: '🇦🇪', name: 'Émirats arabes',    iso: 'AE', min: 9, max: 9  },
]

const ALL_COUNTRIES = [...EOLIS_COUNTRIES, ...OTHER_COUNTRIES]

interface Props {
  value: string
  onChange: (v: string) => void
  onValidChange?: (valid: boolean) => void
  placeholder?: string
  required?: boolean
  className?: string
  inputClassName?: string
}

function parsePhone(full: string): { dialCode: string; local: string } {
  for (const c of [...ALL_COUNTRIES].sort((a, b) => b.code.length - a.code.length)) {
    if (full.startsWith(c.code)) {
      return { dialCode: c.code, local: full.slice(c.code.length) }
    }
  }
  return { dialCode: '+237', local: full.replace(/^\+\d+/, '') }
}

function isLocalValid(local: string, country: CountryCode): boolean {
  const digits = local.replace(/\D/g, '')
  return digits.length >= country.min && digits.length <= country.max
}

export function PhoneInput({ value, onChange, onValidChange, placeholder = '6XX XXX XXX', required, className = '', inputClassName = '' }: Props) {
  const { dialCode: initDial, local: initLocal } = parsePhone(value)
  const [dialCode, setDialCode] = useState(initDial)
  const [local, setLocal]       = useState(initLocal)
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState('')
  const [touched, setTouched]   = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const selected = ALL_COUNTRIES.find(c => c.code === dialCode) ?? EOLIS_COUNTRIES[0]
  const valid = isLocalValid(local, selected)

  useEffect(() => {
    onValidChange?.(valid)
  }, [valid, onValidChange])

  useEffect(() => {
    const { dialCode: d, local: l } = parsePhone(value)
    setDialCode(d)
    setLocal(l)
  }, [value])

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
    if (!touched) setTouched(true)
  }

  const showError = touched && local.replace(/\D/g, '').length > 0 && !valid
  const showValid = touched && valid

  const eolisFiltered  = EOLIS_COUNTRIES.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)
  )
  const otherFiltered  = OTHER_COUNTRIES.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)
  )
  const hasAny = eolisFiltered.length > 0 || otherFiltered.length > 0

  const hint = touched && !valid && local.replace(/\D/g, '').length > 0
    ? `${selected.min}${selected.min !== selected.max ? `–${selected.max}` : ''} chiffres requis pour ${selected.name} (${selected.code})`
    : null

  return (
    <div className="flex flex-col gap-1">
      <div className={`flex gap-0 ${className}`} ref={dropRef}>
        {/* Dial code selector */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setOpen(p => !p)}
            className={`flex items-center gap-1.5 h-full px-3 rounded-l-xl border border-r-0 text-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent ${
              showError ? 'border-red-400 bg-red-50' : showValid ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
            } ${inputClassName}`}
            style={{ borderRight: 'none' }}
          >
            <span className="text-base leading-none">{selected.flag}</span>
            <span className="font-medium text-gray-700 text-xs">{selected.code}</span>
            <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un pays..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] bg-gray-50"
                />
              </div>
              <ul className="max-h-60 overflow-y-auto py-1">
                {eolisFiltered.length > 0 && (
                  <>
                    <li className="px-3 py-1.5 text-[10px] font-semibold text-[#4A8FC4] uppercase tracking-widest bg-blue-50/50">
                      Présence Eolis
                    </li>
                    {eolisFiltered.map(c => (
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
                  </>
                )}
                {otherFiltered.length > 0 && (
                  <>
                    {eolisFiltered.length > 0 && (
                      <li className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest border-t border-gray-100 mt-1">
                        Autres pays
                      </li>
                    )}
                    {otherFiltered.map(c => (
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
                  </>
                )}
                {!hasAny && (
                  <li className="px-3 py-4 text-xs text-gray-400 text-center">Aucun résultat</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Local number input */}
        <div className="relative flex-1 min-w-0">
          <input
            type="tel"
            value={local}
            onChange={e => handleLocal(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            required={required}
            inputMode="numeric"
            className={`w-full px-3 py-2.5 pr-9 rounded-r-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white transition-colors ${
              showError
                ? 'border-red-400 focus:ring-red-300'
                : showValid
                ? 'border-green-400 focus:ring-green-300'
                : 'border-gray-200 focus:ring-[#4A8FC4]'
            } ${inputClassName}`}
          />
          {showValid && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
              <Check size={15} strokeWidth={2.5} />
            </span>
          )}
          {showError && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">
              <X size={15} strokeWidth={2.5} />
            </span>
          )}
        </div>
      </div>

      {hint && (
        <p className="text-xs text-red-500 flex items-center gap-1.5 pl-1">
          <X size={11} strokeWidth={2.5} />
          {hint}
        </p>
      )}
    </div>
  )
}
