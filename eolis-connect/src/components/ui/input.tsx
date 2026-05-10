import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>}
        <input
          id={id}
          ref={ref}
          className={cn(
            'w-full px-4 py-2.5 rounded-lg border text-sm transition-colors',
            'border-gray-200 bg-white placeholder-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent',
            error && 'border-red-400 focus:ring-red-300',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
