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
  const status = searchParams.get('status')
  const role = searchParams.get('role')
  const search = searchParams.get('search')
  const page = Number(searchParams.get('page') ?? 1)
  const limit = Number(searchParams.get('limit') ?? 20)

  const where: any = {}
  if (status) where.status = status
  if (role) where.role = role
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
    ]
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, role: true, status: true, language: true, createdAt: true,
        _count: { select: { clientTickets: true, agentTickets: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ])

  return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) })
}
