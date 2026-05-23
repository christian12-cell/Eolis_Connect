'use client'

import { useState, useEffect, useCallback } from 'react'
import { Cookie, X } from 'lucide-react'

const STORAGE_KEY = 'eolis_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [locale, setLocale] = useState<'fr' | 'en'>('fr')

  useEffect(() => {
    const already = localStorage.getItem(STORAGE_KEY)
    if (!already) setVisible(true)

    const lang = window.location.pathname.startsWith('/en') ? 'en' : 'fr'
    setLocale(lang)
  }, [])

  const accept = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }, [])

  if (!visible) return null

  const t = {
    fr: {
      title: 'Ce site utilise des cookies',
      message: 'Eolis Connect n\'utilise que des cookies strictement nécessaires au fonctionnement de l\'application — uniquement pour gérer votre session de connexion. Aucun cookie publicitaire, aucun suivi tiers. Sans ces cookies, la connexion est impossible.',
      accept: 'Compris',
    },
    en: {
      title: 'This site uses cookies',
      message: 'Eolis Connect only uses strictly necessary cookies to manage your login session. No advertising cookies, no third-party tracking. Without these cookies, logging in is not possible.',
      accept: 'Got it',
    },
  }
  const text = t[locale]

  return (
    <div
      role="dialog"
      aria-label={text.title}
      className="fixed bottom-0 left-0 right-0 z-50 p-4 lg:p-6"
    >
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#1B3A5C]/10 flex items-center justify-center">
          <Cookie className="w-5 h-5 text-[#1B3A5C]" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 mb-0.5">{text.title}</p>
          <p className="text-xs text-gray-500 leading-relaxed">{text.message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={accept}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1B3A5C] text-white hover:bg-[#4A8FC4] transition-colors"
          >
            {text.accept}
          </button>
          <button
            onClick={accept}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
