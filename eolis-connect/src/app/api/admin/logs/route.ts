import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  if (!['OPS_ADMIN', 'SYSTEM_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const page = Number(searchParams.get('page') ?? 1)
  const limit = Number(searchParams.get('limit') ?? 50)

  const where: any = {}
  if (action) where.action = { contains: action }

  const [logs, total] = await Promise.all([
    db.log.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.log.count({ where }),
  ])

  return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / limit) })
}
