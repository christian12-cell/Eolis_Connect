import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { Suspense } from 'react'
import LoadingScreen from '@/components/ui/LoadingScreen'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <Suspense fallback={<LoadingScreen />}>
        {children}
      </Suspense>
    </NextIntlClientProvider>
  )
}
