import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'

  const notifications = await db.notification.findMany({
    where: { userId: user.id, ...(unreadOnly && { isRead: false }) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const unreadCount = await db.notification.count({
    where: { userId: user.id, isRead: false },
  })

  return NextResponse.json({ notifications, unreadCount })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  const { ids } = await req.json()

  if (ids === 'all') {
    await db.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    })
  } else if (Array.isArray(ids)) {
    await db.notification.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: { isRead: true },
    })
  }

  return NextResponse.json({ success: true })
}
