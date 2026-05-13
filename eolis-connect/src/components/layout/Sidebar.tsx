'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home, FileText, PlusCircle, Settings, LayoutDashboard,
  List, Clock, BarChart2, Trophy, Users, ScrollText, X, Globe, Bell, BookOpen, Shield, Zap,
} from 'lucide-react'

interface SidebarProps {
  locale: string
  role: string
  isOpen?: boolean
  onClose?: () => void
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

function getNavItems(locale: string, role: string): NavItem[] {
  const base = `/${locale}`

  if (role === 'CLIENT') {
    return [
      { label: locale === 'fr' ? 'Accueil' : 'Home',            href: `${base}/accueil`,         icon: <Home size={18} /> },
      { label: locale === 'fr' ? 'Nouvelle demande' : 'New request', href: `${base}/nouvelle-demande`, icon: <PlusCircle size={18} /> },
      { label: locale === 'fr' ? 'Mes demandes' : 'My requests', href: `${base}/mes-demandes`,    icon: <FileText size={18} /> },
      { label: locale === 'fr' ? 'Paramètres' : 'Settings',      href: `${base}/parametres`,      icon: <Settings size={18} /> },
      { label: locale === 'fr' ? 'Aide' : 'Help',                href: `${base}/aide`,            icon: <BookOpen size={18} /> },
    ]
  }

  if (role === 'AGENT') {
    return [
      { label: locale === 'fr' ? 'Tableau de bord' : 'Dashboard',    href: `${base}/agent/dashboard`,       icon: <LayoutDashboard size={18} /> },
      { label: locale === 'fr' ? 'File de dossiers' : 'Ticket queue', href: `${base}/agent/dashboard`,       icon: <List size={18} /> },
      { label: locale === 'fr' ? 'Historique' : 'History',            href: `${base}/agent/historique`,      icon: <Clock size={18} /> },
      { label: locale === 'fr' ? 'Notifications' : 'Notifications',   href: `${base}/agent/notifications`,   icon: <Bell size={18} /> },
      { label: locale === 'fr' ? 'Paramètres' : 'Settings',           href: `${base}/agent/parametres`,      icon: <Settings size={18} /> },
      { label: locale === 'fr' ? 'Aide' : 'Help',                    href: `${base}/agent/aide`,            icon: <BookOpen size={18} /> },
    ]
  }

  if (role === 'OPS_ADMIN') {
    return [
      { label: locale === 'fr' ? 'Vue d\'ensemble' : 'Overview',      href: `${base}/ops/dashboard`,         icon: <LayoutDashboard size={18} /> },
      { label: locale === 'fr' ? 'File des dossiers' : 'Ticket queue', href: `${base}/agent/dashboard`,      icon: <List size={18} /> },
      { label: locale === 'fr' ? 'Dossiers traités' : 'Treated tickets', href: `${base}/agent/historique`,   icon: <Clock size={18} /> },
      { label: locale === 'fr' ? 'Performances' : 'Performance',       href: `${base}/ops/performances`,     icon: <BarChart2 size={18} /> },
      { label: locale === 'fr' ? 'Classement' : 'Rankings',            href: `${base}/ops/classement`,       icon: <Trophy size={18} /> },
      { label: locale === 'fr' ? 'Coûts IA' : 'AI Costs',             href: `${base}/admin/ia-couts`,       icon: <Zap size={18} /> },
      { label: locale === 'fr' ? 'Notifications' : 'Notifications',    href: `${base}/agent/notifications`,  icon: <Bell size={18} /> },
      { label: locale === 'fr' ? 'Paramètres' : 'Settings',            href: `${base}/agent/parametres`,     icon: <Settings size={18} /> },
      { label: locale === 'fr' ? 'Aide' : 'Help',                     href: `${base}/agent/aide`,           icon: <BookOpen size={18} /> },
    ]
  }

  if (role === 'SYSTEM_ADMIN') {
    return [
      { label: locale === 'fr' ? 'Tableau de bord' : 'Dashboard',      href: `${base}/admin/dashboard`,      icon: <LayoutDashboard size={18} /> },
      { label: locale === 'fr' ? 'File des dossiers' : 'Ticket queue',  href: `${base}/agent/dashboard`,     icon: <List size={18} /> },
      { label: locale === 'fr' ? 'Dossiers traités' : 'Treated tickets', href: `${base}/agent/historique`,   icon: <Clock size={18} /> },
      { label: locale === 'fr' ? 'Utilisateurs' : 'Users',              href: `${base}/admin/utilisateurs`,  icon: <Users size={18} /> },
      { label: locale === 'fr' ? 'Journaux' : 'Logs',                   href: `${base}/admin/logs`,          icon: <ScrollText size={18} /> },
      { label: locale === 'fr' ? 'Performances' : 'Performance',        href: `${base}/ops/performances`,    icon: <BarChart2 size={18} /> },
      { label: locale === 'fr' ? 'Classement' : 'Rankings',             href: `${base}/ops/classement`,      icon: <Trophy size={18} /> },
      { label: locale === 'fr' ? 'Notifications' : 'Notifications',     href: `${base}/agent/notifications`, icon: <Bell size={18} /> },
      { label: locale === 'fr' ? 'Coûts IA' : 'AI Costs',               href: `${base}/admin/ia-couts`,      icon: <Zap size={18} /> },
      { label: locale === 'fr' ? 'Sessions' : 'Sessions',               href: `${base}/admin/sessions`,      icon: <Shield size={18} /> },
      { label: locale === 'fr' ? 'Système' : 'System',                  href: `${base}/admin/systeme`,       icon: <Globe size={18} /> },
      { label: locale === 'fr' ? 'Paramètres' : 'Settings',             href: `${base}/agent/parametres`,    icon: <Settings size={18} /> },
      { label: locale === 'fr' ? 'Aide' : 'Help',                      href: `${base}/agent/aide`,          icon: <BookOpen size={18} /> },
    ]
  }

  return []
}

export function Sidebar({ locale, role, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const items = getNavItems(locale, role)

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Mobile close button */}
      {onClose && (
        <div className="flex items-center justify-between px-4 py-4 lg:hidden border-b border-gray-100">
          <span className="font-semibold text-gray-900 text-sm">Navigation</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-[#1B3A5C] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <span className={isActive ? 'text-white' : 'text-gray-400'}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom brand */}
      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 italic text-center">
          {locale === 'fr' ? '«Ensemble, tissons des liens...»' : '“Together, let us weave connections...”'}
        </p>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-100 h-full flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
          <aside className="relative w-72 bg-white h-full flex flex-col shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
