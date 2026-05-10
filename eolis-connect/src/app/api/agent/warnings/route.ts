import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  if (!['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN'].includes(user.role)) {
    return NextResponse.json({ warnings: [] })
  }

  const oneHourAgo = new Date(Date.now() - 3600000)

  // Find tickets where agent sent last message > 1h ago and client hasn't read it
  const tickets = await db.ticket.findMany({
    where: {
      agentId: user.id,
      status: 'IN_PROGRESS',
      messages: {
        some: {
          senderType: 'AGENT',
          createdAt: { lt: oneHourAgo },
          isRead: false,
        },
      },
    },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      messages: {
        where: { senderType: 'AGENT', isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  const warnings = tickets
    .filter(t => t.messages.length > 0)
    .map(t => ({
      ticketId: t.id,
      ref: t.ref,
      client: t.client,
      lastMessageAt: t.messages[0].createdAt,
    }))

  return NextResponse.json({ warnings })
}
