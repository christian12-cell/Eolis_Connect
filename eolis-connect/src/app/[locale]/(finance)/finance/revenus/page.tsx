'use client'
// Finance revenus page — redirects to the shared admin/ia-couts page
// which already shows revenue & AI costs for FINANCE_AGENT
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function FinanceRevenusPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  useEffect(() => {
    params.then(p => router.replace(`/${p.locale}/admin/ia-couts`))
  }, [params, router])
  return null
}
