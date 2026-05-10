import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import type { NextRequest } from 'next/server'

const intlMiddleware = createMiddleware(routing)

export async function proxy(req: NextRequest) {
  return intlMiddleware(req)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
