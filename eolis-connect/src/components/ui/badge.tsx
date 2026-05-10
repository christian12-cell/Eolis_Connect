import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'navy' | 'blue' | 'brown' | 'success' | 'warning' | 'danger' | 'gray'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  const variants = {
    navy: 'bg-[#1B3A5C]/10 text-[#1B3A5C]',
    blue: 'bg-[#4A8FC4]/10 text-[#4A8FC4]',
    brown: 'bg-[#8B5A2B]/10 text-[#8B5A2B]',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-600',
    gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status, locale = 'fr' }: { status: string; locale?: string }) {
  const config: Record<string, { variant: BadgeProps['variant']; label: { fr: string; en: string } }> = {
    PENDING: { variant: 'gray', label: { fr: 'En attente', en: 'Pending' } },
    IN_PROGRESS: { variant: 'blue', label: { fr: 'En cours', en: 'In progress' } },
    TREATED: { variant: 'success', label: { fr: 'Traité', en: 'Treated' } },
  }
  const c = config[status] ?? { variant: 'gray', label: { fr: status, en: status } }
  return <Badge variant={c.variant}>{c.label[locale as 'fr' | 'en'] ?? status}</Badge>
}

export function UrgencyBadge({ urgency, locale = 'fr' }: { urgency: string; locale?: string }) {
  const config: Record<string, { variant: BadgeProps['variant']; label: { fr: string; en: string } }> = {
    HIGH: { variant: 'danger', label: { fr: 'Élevée', en: 'High' } },
    MEDIUM: { variant: 'warning', label: { fr: 'Moyenne', en: 'Medium' } },
    LOW: { variant: 'success', label: { fr: 'Faible', en: 'Low' } },
  }
  const c = config[urgency] ?? { variant: 'gray', label: { fr: urgency, en: urgency } }
  return <Badge variant={c.variant}>{c.label[locale as 'fr' | 'en'] ?? urgency}</Badge>
}
