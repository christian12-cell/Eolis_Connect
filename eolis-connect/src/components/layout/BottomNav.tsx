'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, FileText, PlusCircle, Bell, User } from 'lucide-react'

interface BottomNavProps {
  locale: string
  unreadCount?: number
}

export function BottomNav({ locale, unreadCount = 0 }: BottomNavProps) {
  const pathname = usePathname()

  const tabs = [
    { href: `/${locale}/accueil`, icon: Home, label: locale === 'fr' ? 'Accueil' : 'Home' },
    { href: `/${locale}/mes-demandes`, icon: FileText, label: locale === 'fr' ? 'Demandes' : 'Requests' },
    { href: `/${locale}/nouvelle-demande`, icon: PlusCircle, label: locale === 'fr' ? 'Nouveau' : 'New', primary: true },
    { href: `/${locale}/notifications`, icon: Bell, label: locale === 'fr' ? 'Alertes' : 'Alerts', badge: unreadCount },
    { href: `/${locale}/parametres`, icon: User, label: locale === 'fr' ? 'Profil' : 'Profile' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 safe-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map(tab => {
          const active = pathname.startsWith(tab.href)
          const Icon = tab.icon
          if (tab.primary) {
            return (
              <Link key={tab.href} href={tab.href}
                className="flex flex-col items-center justify-center -mt-5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  active ? 'bg-[#4A8FC4] scale-105' : 'bg-[#1B3A5C]'
                }`}>
                  <Icon size={26} className="text-white" />
                </div>
              </Link>
            )
          }
          return (
            <Link key={tab.href} href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 relative">
              <div className="relative">
                <Icon size={22} className={active ? 'text-[#1B3A5C]' : 'text-gray-400'} />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-[#1B3A5C]' : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
