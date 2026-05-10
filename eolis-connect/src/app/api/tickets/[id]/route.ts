import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendTicketStatusEmail } from '@/lib/email'
import { sendTicketUpdateSMS } from '@/lib/sms'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/tickets/[id]'>) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await ctx.params
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, language: true } },
      agent: { select: { id: true, firstName: true, lastName: true } },
      messages: {
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, role: true } },
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      attachments: true,
      rating: true,
    },
  })

  if (!ticket) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

  const user = session.user as any
  if (user.role === 'CLIENT' && ticket.clientId !== user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  return NextResponse.json({ ticket })
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/tickets/[id]'>) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any
  const { id } = await ctx.params
  const body = await req.json()
  const { action } = body

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: { client: true },
  })
  if (!ticket) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

  const allowedRoles = ['AGENT', 'OPS_ADMIN', 'SYSTEM_ADMIN']
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
  }

  let updated

  if (action === 'take') {
    if (ticket.status !== 'PENDING') {
      return NextResponse.json({ error: 'Ce dossier est déjà pris en charge' }, { status: 409 })
    }
    updated = await db.ticket.update({
      where: { id },
      data: { status: 'IN_PROGRESS', agentId: user.id, takenAt: new Date() },
    })
    await db.notification.create({
      data: {
        userId: ticket.clientId,
        ticketId: id,
        type: 'STATUS_UPDATE',
        title: 'Dossier en cours',
        message: `Votre dossier ${ticket.ref} est en cours de traitement.`,
      },
    })
    await sendTicketStatusEmail(ticket.client.email, ticket.client.firstName, ticket.ref, 'IN_PROGRESS', ticket.client.language).catch(console.error)
    await sendTicketUpdateSMS(ticket.client.phone, ticket.ref, 'IN_PROGRESS', ticket.client.language).catch(console.error)
  } else if (action === 'close') {
    updated = await db.ticket.update({
      where: { id },
      data: { status: 'TREATED', closedAt: new Date() },
    })
    await db.notification.create({
      data: {
        userId: ticket.clientId,
        ticketId: id,
        type: 'STATUS_UPDATE',
        title: 'Dossier traité',
        message: `Votre dossier ${ticket.ref} a été traité et clôturé.`,
      },
    })
    await sendTicketStatusEmail(ticket.client.email, ticket.client.firstName, ticket.ref, 'TREATED', ticket.client.language).catch(console.error)
    await sendTicketUpdateSMS(ticket.client.phone, ticket.ref, 'TREATED', ticket.client.language).catch(console.error)
  } else {
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  }

  await db.log.create({
    data: { userId: user.id, action: `TICKET_${action.toUpperCase()}`, entity: 'Ticket', entityId: id },
  })

  return NextResponse.json({ ticket: updated })
}
