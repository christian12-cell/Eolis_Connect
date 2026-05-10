import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendNewMessageSMS_email } from '@/lib/email'
import { sendNewMessageSMS, sendDocumentRequestSMS } from '@/lib/sms'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const user = session.user as any

  try {
    const body = await req.json()
    const { ticketId, content, senderType, isDocumentRequest = false } = body

    if (!ticketId || !content) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      include: {
        client: { select: { id: true, firstName: true, email: true, phone: true, language: true } },
      },
    })
    if (!ticket) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    if (user.role === 'CLIENT' && ticket.clientId !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const resolvedSenderType = user.role === 'CLIENT' ? 'CLIENT' : senderType ?? 'AGENT'

    const message = await db.message.create({
      data: {
        ticketId,
        senderId: user.id,
        senderType: resolvedSenderType,
        content,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        attachments: true,
      },
    })

    if (resolvedSenderType === 'AGENT') {
      await db.notification.create({
        data: {
          userId: ticket.clientId,
          ticketId,
          type: isDocumentRequest ? 'DOCUMENT_REQUEST' : 'NEW_MESSAGE',
          title: isDocumentRequest ? 'Documents requis' : 'Nouveau message',
          message: isDocumentRequest
            ? `Le service client a besoin de documents pour votre dossier ${ticket.ref}.`
            : `Vous avez un nouveau message concernant votre dossier ${ticket.ref}.`,
        },
      })

      if (isDocumentRequest) {
        await sendDocumentRequestSMS(ticket.client.phone, ticket.ref, ticket.client.language).catch(console.error)
      } else {
        await sendNewMessageSMS(ticket.client.phone, ticket.ref, ticket.client.language).catch(console.error)
        await sendNewMessageSMS_email(ticket.client.email, ticket.client.firstName, ticket.ref, ticket.client.language).catch(console.error)
      }
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
