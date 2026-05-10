import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { ticketId } = await req.json()
  const user = session.user as any

  await db.message.updateMany({
    where: {
      ticketId,
      isRead: false,
      senderId: { not: user.id },
    },
    data: { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
