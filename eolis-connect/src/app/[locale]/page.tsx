'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'

export default function LanguageSelectPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<'fr' | 'en' | null>(null)

  function handleContinue() {
    if (!selected) return
    router.push(`/${selected}/login`)
  }

  const options = [
    {
      code: 'fr' as const,
      flag: '🇫🇷',
      name: 'Français',
      sub: 'Je préfère le français',
      btn: 'Continuer en français',
    },
    {
      code: 'en' as const,
      flag: '🇬🇧',
      name: 'English',
      sub: 'I prefer English',
      btn: 'Continue in English',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <Image src="/bg-auth.jpg" alt="" fill className="object-cover" priority />
      <div className="absolute inset-0 bg-[#0D1F33]/78" />

      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-4 shadow-2xl">
            <Image src="/logo.png" alt="Eolis Connect" width={56} height={56} className="object-contain" priority />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">Eolis Connect</h1>
          <p className="text-blue-200 text-sm mt-1">Global Logistics Platform</p>
        </div>

        {/* Card */}
        <div className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 shadow-2xl">

          {/* Heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/70 text-xs mb-4">
              <span>🌐</span>
              <span>Langue préférée · Preferred language</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Choisissez votre langue</h2>
            <p className="text-white/60 text-sm mt-1">Choose your preferred language</p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {options.map(opt => {
              const isSelected = selected === opt.code
              return (
                <button
                  key={opt.code}
                  onClick={() => setSelected(opt.code)}
                  className={`relative rounded-2xl p-6 text-center transition-all duration-200 border-2 cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#4A8FC4] shadow-lg scale-[1.02]'
                      : 'bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/40'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#4A8FC4] flex items-center justify-center">
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                  <div className="text-4xl mb-3">{opt.flag}</div>
                  <p className={`font-bold text-lg ${isSelected ? 'text-[#1B3A5C]' : 'text-white'}`}>{opt.name}</p>
                  <p className={`text-xs mt-1 ${isSelected ? 'text-gray-500' : 'text-white/50'}`}>{opt.sub}</p>
                </button>
              )
            })}
          </div>

          {/* Continue button */}
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-[#4A8FC4] hover:bg-[#1B3A5C] text-white shadow-lg"
          >
            {selected
              ? options.find(o => o.code === selected)?.btn
              : 'Choisissez une langue · Choose a language'}
            {selected && <ArrowRight size={16} />}
          </button>
        </div>

        {/* Tagline */}
        <div className="mt-8 text-center">
          <p className="text-amber-300 font-semibold italic drop-shadow text-sm">
            &ldquo;Ensemble, tissons des liens...&rdquo;
          </p>
          <p className="text-white/40 text-xs mt-2">
            &copy; {new Date().getFullYear()} Eolis Connect. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  )
}
