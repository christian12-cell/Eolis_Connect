import { cn } from '@/lib/utils'

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 card-shadow', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-6 py-4 border-b border-gray-100', className)}>{children}</div>
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>
}

export function StatCard({
  title, value, subtitle, icon, color = 'navy',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  color?: 'navy' | 'blue' | 'brown' | 'success' | 'warning' | 'danger'
}) {
  const colors = {
    navy: 'bg-[#1B3A5C]/10 text-[#1B3A5C]',
    blue: 'bg-[#4A8FC4]/10 text-[#4A8FC4]',
    brown: 'bg-[#8B5A2B]/10 text-[#8B5A2B]',
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    danger: 'bg-red-100 text-red-500',
  }
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        {icon && (
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', colors[color])}>
            {icon}
          </div>
        )}
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </CardBody>
    </Card>
  )
}
