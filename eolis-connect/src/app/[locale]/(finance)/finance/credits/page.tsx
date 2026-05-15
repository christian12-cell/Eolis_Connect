'use client'
// Finance credits page — redirects to the shared admin/credits page
// which now accepts FINANCE_AGENT role
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function FinanceCreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter()
  useEffect(() => {
    params.then(p => router.replace(`/${p.locale}/admin/credits`))
  }, [params, router])
  return null
}
